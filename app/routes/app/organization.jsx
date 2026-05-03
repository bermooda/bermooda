import {
  BuildingOffice2Icon,
  EnvelopeIcon,
  GlobeAltIcon,
  TrashIcon,
  UserMinusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Form, useActionData, useLoaderData } from 'react-router';

import { auth, authContext } from '#/libs/auth/index.server';
import { handleError } from '#/libs/error.server';
import prisma from '#/libs/prisma.server';
import useToaster from '#/hooks/use-toaster';
import { ButtonSubmit } from '#/components/ui/button';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DOMAIN_PATTERN = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function meta() {
  return [
    { title: 'Organization - Your Account' },
    { name: 'description', content: 'Manage your organization' },
  ];
}

async function getUserOrganization(user, request) {
  const member = await prisma.member.findFirst({
    where: { userId: user.id },
    include: { organization: true },
  });

  if (!member) {
    return null;
  }

  await auth.api.setActiveOrganization({
    headers: request.headers,
    body: { organizationId: member.organizationId },
  });

  const org = await auth.api.getFullOrganization({
    headers: request.headers,
    query: { organizationId: member.organizationId },
  });

  return { organization: org, role: member.role };
}

export async function loader({ context, request }) {
  const user = context.get(authContext);

  const result = await getUserOrganization(user, request);

  if (!result) {
    return { hasOrganization: false };
  }

  const { organization, role } = result;
  const isAdmin = role === 'owner' || role === 'admin';

  let metadata = {};
  try {
    if (organization.metadata) {
      metadata = JSON.parse(organization.metadata);
    }
  } catch {
    metadata = {};
  }

  return {
    hasOrganization: true,
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    },
    members: organization.members || [],
    invitations: (organization.invitations || []).filter(
      (inv) => inv.status === 'pending'
    ),
    allowedDomains: metadata.allowedDomains || [],
    role,
    isAdmin,
  };
}

export async function action({ context, request }) {
  try {
    const user = context.get(authContext);
    const formData = await request.formData();
    const intent = formData.get('intent');

    if (intent === 'create-organization') {
      const name = String(formData.get('name') || '').trim();

      if (!name || name.length < 2) {
        return {
          success: false,
          error: 'Organization name must be at least 2 characters',
        };
      }

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      await auth.api.createOrganization({
        headers: request.headers,
        body: { name, slug },
      });

      return { success: true, message: 'Organization created' };
    }

    const member = await prisma.member.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });

    if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
      return {
        success: false,
        error: 'You do not have permission to perform this action',
      };
    }

    const orgId = member.organizationId;

    switch (intent) {
      case 'invite-user': {
        const email = String(formData.get('email') || '')
          .trim()
          .toLowerCase();
        const role = formData.get('role') || 'member';

        if (!email || !EMAIL_PATTERN.test(email)) {
          return {
            success: false,
            error: 'Please enter a valid email address',
          };
        }

        if (email === user.email) {
          return { success: false, error: 'You cannot invite yourself' };
        }

        const existingMember = await prisma.member.findFirst({
          where: {
            organizationId: orgId,
            user: { email },
          },
        });

        if (existingMember) {
          return {
            success: false,
            error: 'This user is already a member',
          };
        }

        await auth.api.createInvitation({
          headers: request.headers,
          body: {
            organizationId: orgId,
            email,
            role,
          },
        });

        return { success: true, message: `Invitation sent to ${email}` };
      }

      case 'add-domain': {
        const domain = String(formData.get('domain') || '')
          .trim()
          .toLowerCase();

        if (!domain || !DOMAIN_PATTERN.test(domain)) {
          return {
            success: false,
            error: 'Please enter a valid domain (e.g. company.com)',
          };
        }

        let metadata = {};
        try {
          if (member.organization.metadata) {
            metadata = JSON.parse(member.organization.metadata);
          }
        } catch {
          metadata = {};
        }

        const domains = metadata.allowedDomains || [];
        if (domains.includes(domain)) {
          return {
            success: false,
            error: 'This domain is already allowed',
          };
        }

        domains.push(domain);
        metadata.allowedDomains = domains;

        await prisma.organization.update({
          where: { id: orgId },
          data: { metadata: JSON.stringify(metadata) },
        });

        return {
          success: true,
          message: `Domain @${domain} added. Users with this domain can now be invited.`,
        };
      }

      case 'remove-domain': {
        const domain = String(formData.get('domain') || '')
          .trim()
          .toLowerCase();

        let metadata = {};
        try {
          if (member.organization.metadata) {
            metadata = JSON.parse(member.organization.metadata);
          }
        } catch {
          metadata = {};
        }

        metadata.allowedDomains = (metadata.allowedDomains || []).filter(
          (d) => d !== domain
        );

        await prisma.organization.update({
          where: { id: orgId },
          data: { metadata: JSON.stringify(metadata) },
        });

        return { success: true, message: `Domain @${domain} removed` };
      }

      case 'invite-domain': {
        const domain = String(formData.get('domain') || '')
          .trim()
          .toLowerCase();

        if (!domain || !DOMAIN_PATTERN.test(domain)) {
          return { success: false, error: 'Please enter a valid domain' };
        }

        const usersWithDomain = await prisma.user.findMany({
          where: {
            email: { endsWith: `@${domain}` },
            id: { not: user.id },
          },
          select: { id: true, email: true },
        });

        const existingMembers = await prisma.member.findMany({
          where: { organizationId: orgId },
          select: { userId: true },
        });
        const memberIds = new Set(existingMembers.map((m) => m.userId));

        let invited = 0;
        for (const u of usersWithDomain) {
          if (memberIds.has(u.id)) continue;

          try {
            await auth.api.createInvitation({
              headers: request.headers,
              body: {
                organizationId: orgId,
                email: u.email,
                role: 'member',
              },
            });
            invited++;
          } catch {
            // Skip if invitation already pending
          }
        }

        return {
          success: true,
          message:
            invited > 0
              ? `Sent ${invited} invitation${invited > 1 ? 's' : ''} to @${domain} users`
              : `No new users found with @${domain} to invite`,
        };
      }

      case 'remove-member': {
        const memberId = formData.get('memberId');
        const targetMember = await prisma.member.findUnique({
          where: { id: memberId },
        });

        if (!targetMember) {
          return { success: false, error: 'Member not found' };
        }

        if (targetMember.userId === user.id) {
          return { success: false, error: 'You cannot remove yourself' };
        }

        if (targetMember.role === 'owner' && member.role !== 'owner') {
          return {
            success: false,
            error: 'Only owners can remove other owners',
          };
        }

        await auth.api.removeMember({
          headers: request.headers,
          body: {
            organizationId: orgId,
            memberIdOrEmail: memberId,
          },
        });

        return {
          success: true,
          message: 'Member removed from the organization',
        };
      }

      case 'update-role': {
        const memberId = formData.get('memberId');
        const newRole = formData.get('role');

        const targetMember = await prisma.member.findUnique({
          where: { id: memberId },
        });

        if (!targetMember) {
          return { success: false, error: 'Member not found' };
        }

        if (targetMember.userId === user.id) {
          return {
            success: false,
            error: 'You cannot change your own role',
          };
        }

        await auth.api.updateMemberRole({
          headers: request.headers,
          body: {
            organizationId: orgId,
            memberId,
            role: newRole,
          },
        });

        return { success: true, message: 'Member role updated' };
      }

      case 'cancel-invitation': {
        const invitationId = formData.get('invitationId');

        await auth.api.cancelInvitation({
          headers: request.headers,
          body: {
            organizationId: orgId,
            invitationId,
          },
        });

        return { success: true, message: 'Invitation cancelled' };
      }

      case 'delete-user': {
        const userId = formData.get('userId');

        if (userId === user.id) {
          return { success: false, error: 'You cannot delete yourself' };
        }

        const targetMember = await prisma.member.findFirst({
          where: { organizationId: orgId, userId },
        });

        if (targetMember?.role === 'owner' && member.role !== 'owner') {
          return {
            success: false,
            error: 'Only owners can delete other owners',
          };
        }

        if (targetMember) {
          await auth.api.removeMember({
            headers: request.headers,
            body: {
              organizationId: orgId,
              memberIdOrEmail: targetMember.id,
            },
          });
        }

        await prisma.session.deleteMany({ where: { userId } });
        await prisma.account.deleteMany({ where: { userId } });
        await prisma.twoFactor.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });

        return { success: true, message: 'User deleted' };
      }

      case 'update-org-name': {
        const name = String(formData.get('name') || '').trim();

        if (!name || name.length < 2) {
          return {
            success: false,
            error: 'Organization name must be at least 2 characters',
          };
        }

        await auth.api.updateOrganization({
          headers: request.headers,
          body: {
            organizationId: orgId,
            data: { name },
          },
        });

        return { success: true, message: 'Organization name updated' };
      }

      default:
        return { success: false, error: 'Unknown action' };
    }
  } catch (error) {
    return handleError(error, {
      message: 'Error managing organization',
      source: 'routes/user/organization action',
      userMessage: error?.message || 'Failed to complete the action',
    });
  }
}

function RoleBadge({ role }) {
  const colors = {
    owner:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    member: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-700/30 dark:text-zinc-300',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[role] || colors.member}`}
    >
      {role}
    </span>
  );
}

function MemberRow({ member, isAdmin, currentRole }) {
  const [showConfirm, setShowConfirm] = useState(null);
  const canManage =
    isAdmin &&
    member.role !== 'owner' &&
    !(member.role === 'admin' && currentRole !== 'owner');

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {(member.user?.name || member.user?.email || '?')
              .charAt(0)
              .toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
              {member.user?.name || 'Unknown'}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {member.user?.email}
            </p>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4">
        <RoleBadge role={member.role} />
      </td>
      <td className="py-3 text-right">
        {canManage && (
          <div className="flex items-center justify-end gap-1">
            {showConfirm === 'remove' ? (
              <div className="flex items-center gap-1">
                <Form method="post">
                  <input type="hidden" name="intent" value="remove-member" />
                  <input type="hidden" name="memberId" value={member.id} />
                  <button
                    type="submit"
                    className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Confirm
                  </button>
                </Form>
                <button
                  type="button"
                  onClick={() => setShowConfirm(null)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            ) : showConfirm === 'delete' ? (
              <div className="flex items-center gap-1">
                <Form method="post">
                  <input type="hidden" name="intent" value="delete-user" />
                  <input type="hidden" name="userId" value={member.userId} />
                  <button
                    type="submit"
                    className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Delete
                  </button>
                </Form>
                <button
                  type="button"
                  onClick={() => setShowConfirm(null)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <Form method="post" className="inline">
                  <input type="hidden" name="intent" value="update-role" />
                  <input type="hidden" name="memberId" value={member.id} />
                  <select
                    name="role"
                    defaultValue={member.role}
                    onChange={(e) => e.target.form.requestSubmit()}
                    className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    <option value="member">member</option>
                    <option value="admin">admin</option>
                    {currentRole === 'owner' && (
                      <option value="owner">owner</option>
                    )}
                  </select>
                </Form>
                <button
                  type="button"
                  onClick={() => setShowConfirm('remove')}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                  title="Remove from organization"
                >
                  <UserMinusIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm('delete')}
                  className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                  title="Delete user account"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

function InvitationRow({ invitation, isAdmin }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <tr className="border-b border-zinc-100 dark:border-zinc-800">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-50 text-sm text-zinc-400 dark:bg-zinc-800/50 dark:text-zinc-500">
            <EnvelopeIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
              {invitation.email}
            </p>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4">
        <RoleBadge role={invitation.role} />
      </td>
      <td className="py-3 pr-4">
        <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
          pending
        </span>
      </td>
      <td className="py-3 text-right">
        {isAdmin &&
          (showConfirm ? (
            <div className="flex items-center justify-end gap-1">
              <Form method="post">
                <input type="hidden" name="intent" value="cancel-invitation" />
                <input
                  type="hidden"
                  name="invitationId"
                  value={invitation.id}
                />
                <button
                  type="submit"
                  className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700"
                >
                  Confirm
                </button>
              </Form>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              title="Cancel invitation"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          ))}
      </td>
    </tr>
  );
}

function DomainTag({ domain, isAdmin }) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800/50">
      <GlobeAltIcon className="h-4 w-4 text-zinc-400" />
      <span className="text-sm text-zinc-700 dark:text-zinc-300">
        @{domain}
      </span>
      {isAdmin && (
        <div className="ml-auto flex items-center gap-1">
          {showConfirm ? (
            <>
              <Form method="post" className="inline">
                <input type="hidden" name="intent" value="remove-domain" />
                <input type="hidden" name="domain" value={domain} />
                <button
                  type="submit"
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Remove
                </button>
              </Form>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded px-1.5 py-0.5 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <Form method="post" className="inline">
                <input type="hidden" name="intent" value="invite-domain" />
                <input type="hidden" name="domain" value={domain} />
                <button
                  type="submit"
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                  title="Invite all existing users with this domain"
                >
                  Invite all
                </button>
              </Form>
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <XMarkIcon className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CreateOrganizationView() {
  const [orgName, setOrgName] = useState('');

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center space-x-2">
          <BuildingOffice2Icon className="h-8 w-8" />
          <h1 className="text-2xl/8 font-semibold text-zinc-950 sm:text-xl/8 dark:text-white">
            Organization
          </h1>
        </div>

        <hr
          role="presentation"
          className="my-10 mt-6 w-full border-t border-zinc-950/10 dark:border-white/10"
        />

        <section className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          <div className="space-y-1">
            <h2 className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">
              Create Organization
            </h2>
            <p
              data-slot="text"
              className="text-base/6 text-zinc-500 sm:text-sm/6 dark:text-zinc-400"
            >
              Create an organization to invite and manage team members.
            </p>
          </div>
          <div>
            <Form method="post">
              <input type="hidden" name="intent" value="create-organization" />
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="org-name"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Organization name
                  </label>
                  <span
                    data-slot="control"
                    className="relative mt-1 block w-full before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500 dark:before:hidden"
                  >
                    <input
                      id="org-name"
                      name="name"
                      type="text"
                      placeholder="Acme Inc."
                      required
                      minLength={2}
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      className="relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] text-base/6 text-zinc-950 placeholder:text-zinc-500 focus:outline-hidden sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)] sm:text-sm/6 dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </span>
                </div>
                <div className="flex justify-end">
                  <ButtonSubmit className="min-w-36">
                    Create Organization
                  </ButtonSubmit>
                </div>
              </div>
            </Form>
          </div>
        </section>
      </div>
    </div>
  );
}

function OrganizationManagementView({
  organization,
  members,
  invitations,
  allowedDomains,
  role,
  isAdmin,
}) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [newDomain, setNewDomain] = useState('');

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center space-x-2">
          <BuildingOffice2Icon className="h-8 w-8" />
          <h1 className="text-2xl/8 font-semibold text-zinc-950 sm:text-xl/8 dark:text-white">
            Organization
          </h1>
        </div>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Manage{' '}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {organization.name}
          </span>
        </p>

        <hr
          role="presentation"
          className="my-10 mt-6 w-full border-t border-zinc-950/10 dark:border-white/10"
        />

        {/* Invite User */}
        {isAdmin && (
          <section>
            <h2 className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">
              Invite User
            </h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Send an invitation email to add a new member.
            </p>
            <Form method="post" className="mt-4">
              <input type="hidden" name="intent" value="invite-user" />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label
                    htmlFor="invite-email"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Email address
                  </label>
                  <span
                    data-slot="control"
                    className="relative mt-1 block w-full before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500 dark:before:hidden"
                  >
                    <input
                      id="invite-email"
                      name="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-sm/6 text-zinc-950 placeholder:text-zinc-500 focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </span>
                </div>
                <div className="w-full sm:w-32">
                  <label
                    htmlFor="invite-role"
                    className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Role
                  </label>
                  <span
                    data-slot="control"
                    className="relative mt-1 block w-full before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500 dark:before:hidden"
                  >
                    <select
                      id="invite-role"
                      name="role"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-sm/6 text-zinc-950 focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-white"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </span>
                </div>
                <ButtonSubmit className="min-w-28 sm:mb-0">
                  Send Invite
                </ButtonSubmit>
              </div>
            </Form>
          </section>
        )}

        <hr
          role="presentation"
          className="my-10 w-full border-t border-zinc-950/5 dark:border-white/5"
        />

        {/* Domain Access */}
        {isAdmin && (
          <>
            <section>
              <h2 className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">
                Domain Access
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Allow all users from specific email domains. You can also bulk
                invite all existing users with a domain.
              </p>

              {allowedDomains.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {allowedDomains.map((domain) => (
                    <DomainTag key={domain} domain={domain} isAdmin={isAdmin} />
                  ))}
                </div>
              )}

              <Form method="post" className="mt-4">
                <input type="hidden" name="intent" value="add-domain" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label
                      htmlFor="new-domain"
                      className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Email domain
                    </label>
                    <span
                      data-slot="control"
                      className="relative mt-1 block w-full before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500 dark:before:hidden"
                    >
                      <input
                        id="new-domain"
                        name="domain"
                        type="text"
                        placeholder="company.com"
                        value={newDomain}
                        onChange={(e) => setNewDomain(e.target.value)}
                        className="relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-sm/6 text-zinc-950 placeholder:text-zinc-500 focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </span>
                  </div>
                  <ButtonSubmit className="min-w-28 sm:mb-0">
                    Add Domain
                  </ButtonSubmit>
                </div>
              </Form>
            </section>

            <hr
              role="presentation"
              className="my-10 w-full border-t border-zinc-950/5 dark:border-white/5"
            />
          </>
        )}

        {/* Members Table */}
        <section>
          <h2 className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">
            Members
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {members.length} member{members.length !== 1 ? 's' : ''} in the
            organization.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-2 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                    User
                  </th>
                  <th className="pb-2 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                    Role
                  </th>
                  <th className="pb-2 text-right text-xs font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                    {isAdmin ? 'Actions' : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    isAdmin={isAdmin}
                    currentRole={role}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <>
            <hr
              role="presentation"
              className="my-10 w-full border-t border-zinc-950/5 dark:border-white/5"
            />
            <section>
              <h2 className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">
                Pending Invitations
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {invitations.length} pending invitation
                {invitations.length !== 1 ? 's' : ''}.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700">
                      <th className="pb-2 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                        Email
                      </th>
                      <th className="pb-2 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                        Role
                      </th>
                      <th className="pb-2 text-left text-xs font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                        Status
                      </th>
                      <th className="pb-2 text-right text-xs font-medium tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
                        {isAdmin ? 'Actions' : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitations.map((invitation) => (
                      <InvitationRow
                        key={invitation.id}
                        invitation={invitation}
                        isAdmin={isAdmin}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {/* Organization Settings (admin only) */}
        {isAdmin && (
          <>
            <hr
              role="presentation"
              className="my-10 w-full border-t border-zinc-950/5 dark:border-white/5"
            />
            <section>
              <h2 className="text-base/7 font-semibold text-zinc-950 sm:text-sm/6 dark:text-white">
                Organization Settings
              </h2>
              <Form method="post" className="mt-4">
                <input type="hidden" name="intent" value="update-org-name" />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label
                      htmlFor="org-name"
                      className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Organization name
                    </label>
                    <span
                      data-slot="control"
                      className="relative mt-1 block w-full before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:ring-transparent after:ring-inset sm:focus-within:after:ring-2 sm:focus-within:after:ring-blue-500 dark:before:hidden"
                    >
                      <input
                        id="org-name"
                        name="name"
                        type="text"
                        defaultValue={organization.name}
                        className="relative block w-full appearance-none rounded-lg border border-zinc-950/10 bg-transparent px-[calc(--spacing(3)-1px)] py-[calc(--spacing(1.5)-1px)] text-sm/6 text-zinc-950 placeholder:text-zinc-500 focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                    </span>
                  </div>
                  <ButtonSubmit className="min-w-28 sm:mb-0">
                    Update Name
                  </ButtonSubmit>
                </div>
              </Form>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

export default function OrganizationRoute() {
  const data = useLoaderData();
  const actionData = useActionData();

  useToaster(actionData);

  if (!data.hasOrganization) {
    return <CreateOrganizationView />;
  }

  return (
    <OrganizationManagementView
      organization={data.organization}
      members={data.members}
      invitations={data.invitations}
      allowedDomains={data.allowedDomains}
      role={data.role}
      isAdmin={data.isAdmin}
    />
  );
}
