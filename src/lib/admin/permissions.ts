export const ADMIN_PERMISSIONS = {
  architect: {
    canAssignArchitect: false,
    canAssignAdmin: true,
    canAssignModerator: true,
    canChangeAnyRole: true,
    canBanUsers: true,
    canDeleteAnyEntry: true,
    canToggleFeatures: true,
    canEditSystemSettings: true,
    canOverrideRating: true,
    canViewAllStats: true,
    canViewAuditLog: true,
    canAccessApi: true,
    canResetScoring: true,
    canPurgeData: true,
  },
  admin: {
    canAssignArchitect: false,
    canAssignAdmin: false,
    canAssignModerator: true,
    canChangeAnyRole: true,
    canBanUsers: true,
    canDeleteAnyEntry: true,
    canToggleFeatures: true,
    canEditSystemSettings: true,
    canOverrideRating: true,
    canViewAllStats: true,
    canViewAuditLog: true,
    canAccessApi: false,
    canResetScoring: true,
    canPurgeData: false,
  },
  moderator: {
    canAssignArchitect: false,
    canAssignAdmin: false,
    canAssignModerator: false,
    canChangeAnyRole: false,
    canBanUsers: true,
    canDeleteAnyEntry: true,
    canToggleFeatures: false,
    canEditSystemSettings: false,
    canOverrideRating: false,
    canViewAllStats: true,
    canViewAuditLog: true,
    canAccessApi: false,
    canResetScoring: false,
    canPurgeData: false,
  },
} as const;

export type AdminRole = keyof typeof ADMIN_PERMISSIONS;
export type AdminPermission = keyof typeof ADMIN_PERMISSIONS.architect;

export function hasPermission(role: string, permission: AdminPermission): boolean {
  const perms = ADMIN_PERMISSIONS[role as AdminRole];
  return Boolean(perms?.[permission]);
}
