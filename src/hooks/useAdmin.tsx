'use client';

import { useUser } from './useUser';

export function useAdmin() {
  const { user, profile } = useUser();

  const role = profile?.role || '';
  const isArchitect = role === 'architect';
  const isAdmin = ['architect', 'admin'].includes(role);
  const isModerator = ['architect', 'admin', 'moderator'].includes(role);

  return { user, profile, isArchitect, isAdmin, isModerator };
}
