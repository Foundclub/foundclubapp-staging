import { useTranslation } from 'react-i18next';

import { useGetMe } from '@/services/auth/authQueries';

import CMDashboard from './CMDashboard';
import MultisportStateView from './components/MultisportStateView';

/**
 * Deprecated fallback screen.
 * Keeps backward compatibility while reusing the new multisport dashboard UI.
 * @param {{ navigation: any; route: { params?: { cmId?: string } } }} props
 */
function MyClubsScreen({ navigation, route }) {
  const { t } = useTranslation();
  const {
    data: userData,
    error: userDataError,
    isLoading: isLoadingUserData,
    refetch: refetchUserData,
  } = useGetMe();

  const fallbackCmId = route?.params?.cmId || userData?.multisportClubs?.[0]?.documentId;

  if (isLoadingUserData && !fallbackCmId) {
    return (
      <MultisportStateView
        description={t('multisport.fallback.loading', 'Nous preparons votre espace multisport.')}
        isLoading
        title={t('multisport.fallback.loadingTitle', 'Chargement du club')}
      />
    );
  }

  if (userDataError && !fallbackCmId) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'R\u00E9essayer')}
        description={t('multisport.fallback.error', "Impossible de charger vos informations multisport pour le moment.")}
        onAction={() => refetchUserData()}
        title={t('multisport.fallback.errorTitle', 'Club indisponible')}
      />
    );
  }

  if (!fallbackCmId) {
    return (
      <MultisportStateView
        description={t('multisport.fallback.noClub', 'Aucun club multisport associe a ce compte.')}
        title={t('multisport.fallback.noClubTitle', 'Aucun club multisport')}
      />
    );
  }

  return (
    <CMDashboard
      navigation={navigation}
      route={{
        ...route,
        params: {
          ...(route?.params || {}),
          cmId: fallbackCmId,
        },
      }}
    />
  );
}

export default MyClubsScreen;
