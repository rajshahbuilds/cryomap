/**
 * Data-access layer. Feature code uses these repository factories instead of
 * touching the Supabase client directly, keeping DB access in one testable seam.
 */
export { fridgesRepo } from "./fridges";
export { sheetsRepo } from "./sheets";
export { stagesRepo } from "./stages";
export { linesRepo } from "./lines";
export { componentsRepo } from "./components";
export { connectionsRepo } from "./connections";
export { annotationsRepo } from "./annotations";
export { customComponentDefsRepo } from "./customComponentDefs";
export { locksRepo } from "./locks";
export { versionsRepo } from "./versions";
export { profilesRepo, type ProfileUpsertInput } from "./profiles";
export { workspacesRepo } from "./workspaces";
export { workspaceMembersRepo, type MemberAddInput } from "./members";
export { workspaceInvitesRepo, type InviteCreateInput } from "./invites";
export { accountRepo } from "./account";
export { RepositoryError, type Db } from "./_support";
