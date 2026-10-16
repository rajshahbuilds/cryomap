# CryoMap Privacy Policy

> **Draft — not legal advice.** A starting-point privacy policy for the official
> CryoMap hosted beta. Review and adapt with qualified counsel (and align it with
> GDPR/CCPA if you have users in those jurisdictions) before relying on it.
> **Effective date:** _TBD at launch._ Applies to the official hosted service at
> https://cryomap.vercel.app, operated by Raj Shah ("we"). It does **not** apply
> to third-party self-hosted deployments — those operators are their own data
> controllers.

## What we store

- **Account data** — when you sign in with Google, we store your Google account
  identifier, email address, display name, and avatar URL (provided by Google via
  OAuth). We do **not** receive or store your Google password.
- **Workspace data** — workspaces you create or join, your role in each, and
  invite links.
- **Diagram data** — the fridges, sheets, stages, lines, components, connections,
  custom definitions, annotations, versions, and notes you create, plus authorship
  and timestamps.
- **Operational data** — standard server and platform logs (e.g. request
  metadata, errors) from our hosting providers. We aim not to log diagram
  contents beyond what's needed to operate and debug the service.

We do **not** sell your data or use it for advertising.

## How access works

Your data lives in a workspace and is visible only to members of that workspace,
according to role:

- **Admin** — full access; manages members, invites, and workspace settings.
- **Editor** — can view and edit diagrams.
- **Viewer** — read-only.

Access is enforced in the database with row-level security, not just in the UI.
People who are not members of your workspace cannot read your diagrams.

## Sub-processors

The hosted service runs on:

- **Supabase** — database, authentication, and hosting of your stored data.
- **Vercel** — application hosting and delivery.
- **Google** — OAuth sign-in (identity only).

Each processes data on our behalf under their own terms.

## Your choices

- **Export** — you can export any diagram you can view as PNG, PDF, or JSON from
  the diagram toolbar at any time.
- **Workspace deletion** — a workspace admin can delete a workspace in Workspace
  Settings; this permanently removes the workspace and all its fridges and
  diagram data.
- **Leaving** — any member can leave a workspace, which removes their access.
- **Account deletion** — to delete your account and associated profile data,
  email **rajshahbuilds@gmail.com** from your account email and we will delete it on a
  best-effort basis. (Self-serve account deletion is a planned enhancement.)

## Retention

We keep your data until you (or your workspace admin) delete it, or until the
service is discontinued. Backups may persist for a limited period after deletion
before rotating out.

## Security

We use Google OAuth for sign-in, workspace-scoped row-level security for access
control, and encrypted transport (HTTPS). No service is perfectly secure; see
[`SECURITY.md`](./SECURITY.md) to report a vulnerability.

## Beta & changes

CryoMap is beta software provided without warranty. We may update this policy;
material changes will be noted with a new effective date.

## Contact

Questions or data requests: **rajshahbuilds@gmail.com**.
