// @ts-nocheck
import { useMutation } from '@tanstack/react-query';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

import useAuth from '@/domains/auth/useAuth';
import { storage } from '@/store/appContext';

import { switchManagedClub } from '@/services/auth/authService';

import { displayErrorAlert } from '@/utils/errors/displayError';

const CLUB_SCOPE_STORAGE_KEY = 'clubScopesByUser';

const ClubScopeContext = createContext(/** @type {any} */ (null));

const normalizeId = (value) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readStoredScopes = () => {
  try {
    const rawValue = storage.getString(CLUB_SCOPE_STORAGE_KEY);
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
      return {};
    }

    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_error) {
    return {};
  }
};

const persistStoredScopes = (scopes) => {
  try {
    storage.set(CLUB_SCOPE_STORAGE_KEY, JSON.stringify(scopes || {}));
  } catch (_error) {
    // Ignore storage failures to keep the app responsive.
  }
};

const getFirstManagedSectionId = (userData) => (
  (Array.isArray(userData?.multisportClubs) ? userData.multisportClubs : [])
    .flatMap((multisportClub) => (
      Array.isArray(multisportClub?.sections) ? multisportClub.sections : []
    ))
    .map((section) => normalizeId(section?.documentId || section?.id))
    .find(Boolean)
);

const getDefaultScopeForUser = (userData) => {
  const currentClub = userData?.club || {};
  const currentClubId = normalizeId(currentClub?.documentId || currentClub?.id);
  const parentMultisportId = normalizeId(currentClub?.parentMultisport?.documentId || currentClub?.parentMultisport?.id);
  const firstMultisportClubId = normalizeId(userData?.multisportClubs?.[0]?.documentId || userData?.multisportClubs?.[0]?.id);
  const firstManagedSectionId = parentMultisportId
    ? currentClubId
    : getFirstManagedSectionId(userData) || null;
  const hasMultisportAccess = Array.isArray(userData?.multisportClubs) && userData.multisportClubs.length > 0;

  let activeMode = 'multisport';
  if (!hasMultisportAccess && currentClubId) {
    activeMode = 'section';
  }

  return {
    activeMode,
    activeMultisportClubId: parentMultisportId || firstMultisportClubId || null,
    activeSectionClubId: firstManagedSectionId,
    updatedAt: null,
  };
};

const normalizeScopeRecord = (scopeRecord, userData) => {
  const fallback = getDefaultScopeForUser(userData);
  const activeMode = scopeRecord?.activeMode === 'section' ? 'section' : 'multisport';
  const activeMultisportClubId = normalizeId(scopeRecord?.activeMultisportClubId)
    || fallback.activeMultisportClubId;
  const activeSectionClubId = normalizeId(scopeRecord?.activeSectionClubId)
    || fallback.activeSectionClubId;

  return {
    activeMode,
    activeMultisportClubId,
    activeSectionClubId,
    updatedAt: typeof scopeRecord?.updatedAt === 'string' ? scopeRecord.updatedAt : fallback.updatedAt,
  };
};

/**
 *
 * @param root0
 * @param root0.children
 */
export function ClubScopeProvider({ children }) {
  const { refetchUserData, userData } = useAuth();
  const userDocumentId = normalizeId(userData?.documentId);
  const [scopesByUser, setScopesByUser] = useState(() => readStoredScopes());

  const currentScope = useMemo(() => {
    if (!userDocumentId) {
      return getDefaultScopeForUser(userData);
    }

    return normalizeScopeRecord(scopesByUser[userDocumentId], userData);
  }, [scopesByUser, userData, userDocumentId]);

  const hasMultisportAccess = useMemo(() => (
    Boolean(userData?.documentId)
    && Array.isArray(userData?.multisportClubs)
    && userData.multisportClubs.length > 0
  ), [userData?.documentId, userData?.multisportClubs]);

  const updateCurrentUserScope = useCallback((scopeRecord) => {
    if (!userDocumentId) return;

    setScopesByUser((previousScopes) => {
      const nextScopes = {
        ...(previousScopes || {}),
        [userDocumentId]: normalizeScopeRecord(scopeRecord, userData),
      };
      persistStoredScopes(nextScopes);
      return nextScopes;
    });
  }, [userData, userDocumentId]);

  const activateMultisportScope = useCallback(async () => {
    if (!hasMultisportAccess) {
      return { ok: false, reason: 'no_multisport_access' };
    }

    const nextScope = normalizeScopeRecord({
      activeMode: 'multisport',
      activeMultisportClubId: currentScope.activeMultisportClubId,
      activeSectionClubId: currentScope.activeSectionClubId,
      updatedAt: new Date().toISOString(),
    }, userData);

    updateCurrentUserScope(nextScope);
    return { ok: true, scope: nextScope };
  }, [currentScope.activeMultisportClubId, currentScope.activeSectionClubId, hasMultisportAccess, updateCurrentUserScope, userData]);

  const switchManagedClubMutation = useMutation({
    mutationFn: switchManagedClub,
    onError: (error) => {
      displayErrorAlert(error, 'Impossible de basculer sur cette section pour le moment.');
    },
  });

  const activateSectionScope = useCallback(async ({
    clubId,
    parentMultisportClubId,
  }) => {
    const normalizedClubId = normalizeId(clubId);
    if (!normalizedClubId) {
      return { ok: false, reason: 'missing_club_id' };
    }

    const normalizedParentMultisportId = normalizeId(parentMultisportClubId)
      || normalizeId(userData?.club?.parentMultisport?.documentId || userData?.club?.parentMultisport?.id)
      || currentScope.activeMultisportClubId
      || normalizeId(userData?.multisportClubs?.[0]?.documentId || userData?.multisportClubs?.[0]?.id)
      || null;
    const currentClubId = normalizeId(userData?.club?.documentId || userData?.club?.id);

    if (currentClubId !== normalizedClubId) {
      await switchManagedClubMutation.mutateAsync({ clubId: normalizedClubId });
      await refetchUserData?.();
    }

    const nextScope = normalizeScopeRecord({
      activeMode: 'section',
      activeMultisportClubId: normalizedParentMultisportId,
      activeSectionClubId: normalizedClubId,
      updatedAt: new Date().toISOString(),
    }, userData);

    updateCurrentUserScope(nextScope);
    return { ok: true, scope: nextScope };
  }, [
    currentScope.activeMultisportClubId,
    refetchUserData,
    switchManagedClubMutation,
    updateCurrentUserScope,
    userData,
  ]);

  const toggleClubScope = useCallback(async () => {
    if (currentScope.activeMode === 'section') {
      return activateMultisportScope();
    }

    if (currentScope.activeSectionClubId) {
      return activateSectionScope({
        clubId: currentScope.activeSectionClubId,
        parentMultisportClubId: currentScope.activeMultisportClubId,
      });
    }

    return { ok: false, reason: 'no_section_available' };
  }, [
    activateMultisportScope,
    activateSectionScope,
    currentScope.activeMode,
    currentScope.activeMultisportClubId,
    currentScope.activeSectionClubId,
  ]);

  const value = useMemo(() => ({
    activateMultisportScope,
    activateSectionScope,
    activeMode: currentScope.activeMode,
    activeMultisportClubId: currentScope.activeMultisportClubId,
    activeSectionClubId: currentScope.activeSectionClubId,
    hasMultisportAccess,
    isSectionMode: currentScope.activeMode === 'section',
    isSwitching: switchManagedClubMutation.isPending,
    toggleClubScope,
  }), [
    activateMultisportScope,
    activateSectionScope,
    currentScope.activeMode,
    currentScope.activeMultisportClubId,
    currentScope.activeSectionClubId,
    hasMultisportAccess,
    switchManagedClubMutation.isPending,
    toggleClubScope,
  ]);

  return React.createElement(
    ClubScopeContext.Provider,
    { value },
    children,
  );
}

export const useClubScope = () => useContext(ClubScopeContext);

export default ClubScopeContext;
