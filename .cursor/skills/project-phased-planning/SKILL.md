---
name: project-phased-planning
description: Turn product ideas and feature requests into phased, handoff-ready implementation plans with detailed todos, dependencies, and parallel workstreams for this React Router 7 SaaS boilerplate stack.
license: Apache-2.0
---

Use this skill to transform a high-level SaaS idea and requested features into an execution plan that can be split across engineers/agents.

## Current Project Foundation

This project/repository is a React Router 7 boilerplate with all you need to build a SaaS, AI tool, or any other web app.

It includes authentication, database integration, payment processing, and more, all pre-configured and ready to go.

### Technology Stack

- React Router 7 in framework mode
- Vite
- Oxlint
- Prettier
- Tailwind CSS
- Prisma with SQLite
- Litequu (for queue background jobs)
- Resend (for email communication)
- Better Auth (for authentication)
- Stripe

## Input Shape

The user typically provides:

- Main idea: "I want to build a SaaS that allows users to [...]."
- New features list

If inputs are incomplete, don't make assumptions, ask for further information.

## Primary Objective

Organise the work in phases with detailed todos so the phased work can be handed off to different engineers/agents in chunks that can be done sequentially and/or in parallel.

## Planning Guidance

- Favor small, independently shippable phases.
- Separate foundation/setup tasks from feature tasks.
- Surface cross-cutting concerns early (auth, billing, background jobs, email, DB schema).
- Highlight migration and rollback considerations when data model changes.
- Add validation steps at the end of each phase (tests, lint, manual verification).
- Keep language concrete and handoff-ready for other engineers/agents.
