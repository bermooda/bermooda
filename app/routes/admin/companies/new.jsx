import { redirect, useActionData, useNavigation } from 'react-router';

import { createCompany, parseCreateCompanyForm } from '#/core/b2b/index.server';
import CompanyEditor from '#/components/admin/company-editor';

export async function action({ request }) {
  const formData = await request.formData();

  try {
    const company = await createCompany(parseCreateCompanyForm(formData));
    return redirect(`/admin/companies/${company.id}`);
  } catch (err) {
    return { error: err.message ?? 'Could not create company.' };
  }
}

export function meta() {
  return [{ title: 'New company — Companies' }];
}

export default function AdminNewCompanyRoute() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return <CompanyEditor actionData={actionData} isSaving={isSaving} />;
}
