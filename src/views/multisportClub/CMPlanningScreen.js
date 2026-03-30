import { useTranslation } from 'react-i18next';

import CMPlanningContent from '@/components/organisms/planning/CMPlanningContent';

import MultisportStateView from './components/MultisportStateView';
import useResolvedMultisportClub from './useResolvedMultisportClub';

/**
 * CM Planning - Unified planning view for all sections of a MultisportClub
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function CMPlanningScreen({ navigation, route }) {
  const { cmId } = route?.params ?? {};
  const { t } = useTranslation();
  const {
    cmData,
    cmError,
    isLoadingCmData,
    isLoadingUserData,
    refetchCm,
    refetchUserData,
    resolvedCmId,
    userDataError,
  } = useResolvedMultisportClub(cmId);

  if (isLoadingUserData && !resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.planning.loadingUser', 'Nous preparons le planning de votre structure multisport.')}
        isLoading
        title={t('multisport.planning.loadingUserTitle', 'Chargement du club')}
      />
    );
  }

  if (userDataError && !resolvedCmId) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'Reessayer')}
        description={t('multisport.planning.userError', "Impossible de retrouver votre structure multisport pour le moment.")}
        onAction={() => refetchUserData()}
        title={t('multisport.planning.userErrorTitle', 'Planning indisponible')}
      />
    );
  }

  if (!resolvedCmId) {
    return (
      <MultisportStateView
        description={t('multisport.fallback.noClub', 'Aucun club multisport associe a ce compte.')}
        title={t('multisport.fallback.noClubTitle', 'Aucun club multisport')}
      />
    );
  }

  if (isLoadingCmData && !cmData) {
    return (
      <MultisportStateView
        description={t('multisport.planning.loading', 'Nous chargeons les informations de votre structure multisport.')}
        isLoading
        title={t('multisport.planning.loadingTitle', 'Chargement du planning')}
      />
    );
  }

  if (cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'Reessayer')}
        description={t('multisport.planning.error', "Impossible de charger cette structure multisport pour le moment.")}
        onAction={() => refetchCm()}
        title={t('multisport.planning.errorTitle', 'Planning indisponible')}
      />
    );
  }

  if (!isLoadingCmData && !cmError && !cmData) {
    return (
      <MultisportStateView
        actionLabel={t('common.retry', 'Actualiser')}
        description={t('multisport.planning.notFound', "Cette structure multisport est introuvable ou n'est plus accessible.")}
        onAction={() => refetchCm()}
        title={t('multisport.planning.notFoundTitle', 'Club introuvable')}
      />
    );
  }

  return <CMPlanningContent cmId={resolvedCmId} navigation={navigation} />;
}

export default CMPlanningScreen;
