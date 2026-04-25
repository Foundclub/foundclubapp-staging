import { useCallback, useEffect, useMemo } from 'react';
import { Platform } from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import { useAppContext } from '@/store/appContext';

import AdminStateView from '@/views/admin/components/AdminStateView';
import ComingSoonLeagueScreen from '@/views/league/ComingSoonLeagueScreen';

import { RouteNames } from '@/navigation/routeNames';
import { buildWebPath } from '@/navigation/webRoutes';

import { useLeaguePlatformRuntime } from '@/services/league/leaguePlatformQueries';

const getCurrentWebPath = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return '';
  }
  return String(window.location?.pathname || '').trim();
};

const navigateWebTo = (targetPath) => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }
  window.location.assign(targetPath);
};

function LeaguePlatformGate({ children }) {
  const [{ auth }] = useAppContext();
  const currentWebPath = getCurrentWebPath();
  const isSuperAdminPath = currentWebPath.startsWith('/superadmin');
  const currentRoleKey = getUserRoleKey(auth?.user?.role?.type || auth?.user?.role?.name);
  const isSuperAdmin = currentRoleKey === 'superAdmin';

  const runtimeQuery = useLeaguePlatformRuntime({
    enabled: !isSuperAdmin,
  });

  const handleGoToLogin = useCallback(() => {
    navigateWebTo(buildWebPath(RouteNames.Login, { origin: 'superadmin' }));
  }, []);

  const handleGoHome = useCallback(() => {
    navigateWebTo(buildWebPath(RouteNames.HomeTab));
  }, []);

  const runtime = runtimeQuery.data || null;
  const shouldShowLoadingState = !isSuperAdmin
    && runtimeQuery.isLoading
    && !runtime;

  const gateState = useMemo(() => {
    if (isSuperAdminPath) {
      if (!auth?.token) return 'login-required';
      if (!isSuperAdmin) return 'access-denied';
      return 'allowed';
    }

    if (isSuperAdmin) return 'allowed';
    if (runtime?.effectivePlatformIsOpen === false) return 'platform-closed';
    return 'allowed';
  }, [auth?.token, isSuperAdmin, isSuperAdminPath, runtime]);

  useEffect(() => {
    if (isSuperAdminPath && !auth?.token) {
      handleGoToLogin();
    }
  }, [auth?.token, handleGoToLogin, isSuperAdminPath]);

  if (shouldShowLoadingState) {
    return (
      <AdminStateView
        description="Nous vérifions l'état de Found Club League."
        isLoading
        title="Préparation de la plateforme"
      />
    );
  }

  if (gateState === 'login-required') {
    return (
      <AdminStateView
        actionLabel="Se connecter"
        description="Cette zone Super Admin est réservée aux comptes autorisés."
        onAction={handleGoToLogin}
        title="Connexion requise"
      />
    );
  }

  if (gateState === 'access-denied') {
    return (
      <AdminStateView
        actionLabel="Retour à l'accueil"
        description="Votre compte n'a pas les droits pour accéder à l'espace Super Admin League."
        onAction={handleGoHome}
        title="Accès refusé"
      />
    );
  }

  if (gateState === 'platform-closed') {
    return <ComingSoonLeagueScreen runtime={runtime} />;
  }

  return children;
}

export default LeaguePlatformGate;
