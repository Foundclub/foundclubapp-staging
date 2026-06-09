/* eslint-disable indent */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  deleteCMSection,
  getCMClubs,
  getMultisportClubById,
} from '@/services/multisportClub/multisportClubService';

import { displayErrorAlert } from '@/utils/errors/displayError';

import MultisportActionGrid from './components/MultisportActionGrid';
import MultisportAdminsSection from './components/MultisportAdminsSection';
import MultisportHeroCard from './components/MultisportHeroCard';
import MultisportSectionsList from './components/MultisportSectionsList';
import MultisportSponsorsSection from './components/MultisportSponsorsSection';
import MultisportStatsRow from './components/MultisportStatsRow';

/** @param {any} error */
const normalizeErrorMessage = (error) => String(
  error?.message
  || error?.error?.message
  || error?.response?.data?.error?.message
  || '',
).trim().toLowerCase();

/** @param {any} error */
const getErrorStatus = (error) => Number(
  error?.status
  || error?.statusCode
  || error?.response?.status
  || error?.response?.data?.status
  || 0,
);

/** @param {any} error */
const isForbiddenError = (error) => (
  getErrorStatus(error) === 403
  || normalizeErrorMessage(error).includes('acces refuse')
  || normalizeErrorMessage(error).includes('accès refusé')
  || normalizeErrorMessage(error).includes('forbidden')
);

/**
 * @typedef {{ url?: string }} ImageAsset
 * @typedef {{ documentId?: string; firstname?: string; lastname?: string; avatar?: ImageAsset }} CMAdmin
 * @typedef {{ title?: string; link?: string; logo?: ImageAsset }} CMSponsor
 * @typedef {{ teams?: number; members?: number }} CMSectionStats
 * @typedef {{ documentId?: string; name?: string; sport?: string; logoUrl?: string; stats?: CMSectionStats }} CMSectionRow
 * @typedef {{ documentId?: string; name?: string; admins?: CMAdmin[]; sections?: Array<{ documentId?: string; name?: string }> }} CMMultisportSummary
 * @typedef {{
 *  documentId?: string;
 *  name?: string;
 *  logo?: ImageAsset;
 *  addressDetails?: string;
 *  phoneNumber?: string;
 *  email?: string;
 *  sponsor?: CMSponsor[];
 *  admins?: CMAdmin[];
 * }} CMMultisport
 */

/**
 * @param {{ navigation: any; route: { params?: { cmId?: string } } }} props
 */
function CMDashboard({ navigation, route }) {
  const { cmId } = route?.params ?? {};
  const { t } = useTranslation();
  const {
    Alignments,
    Fonts,
    Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();
  const parentMultisportSummary = /** @type {CMMultisportSummary | null} */ (
    userData?.club?.parentMultisport || null
  );
  const relatedCmSummaries = useMemo(() => {
    /** @type {Map<string, CMMultisportSummary>} */
    const map = new Map();
    const candidates = [
      ...(Array.isArray(userData?.multisportClubs) ? userData.multisportClubs : []),
      parentMultisportSummary,
    ];

    candidates.forEach((candidate) => {
      const documentId = String(candidate?.documentId || '').trim();
      if (!documentId || map.has(documentId)) return;
      map.set(documentId, candidate);
    });

    return Array.from(map.values());
  }, [parentMultisportSummary, userData?.multisportClubs]);
  const resolvedCmId = cmId || relatedCmSummaries[0]?.documentId || '';
  const managedCmSummary = useMemo(
    () => relatedCmSummaries.find((/** @type {CMMultisportSummary} */ club) => club?.documentId === resolvedCmId) || null,
    [relatedCmSummaries, resolvedCmId],
  );
  const isManagedCmByAuth = Boolean(
    resolvedCmId
    && managedCmSummary?.documentId
    && managedCmSummary.documentId === resolvedCmId,
  );

  const {
    data: cmData,
    error: cmError,
    isLoading: cmLoading,
    refetch: refetchCM,
  } = useQuery({
    enabled: !!resolvedCmId,
    queryFn: () => {
      if (!resolvedCmId) return Promise.resolve(null);
      return getMultisportClubById(resolvedCmId);
    },
    queryKey: ['multisport-club', resolvedCmId],
  });

  const {
    data: sectionsDataRaw,
    error: sectionsError,
    isLoading: sectionsLoading,
    refetch: refetchSections,
  } = useQuery({
    enabled: !!resolvedCmId,
    queryFn: () => {
      if (!resolvedCmId) return Promise.resolve({ data: [] });
      return getCMClubs(resolvedCmId);
    },
    queryKey: ['cm-clubs', resolvedCmId],
  });

  const canFallbackToManagedSummary = Boolean(
    managedCmSummary?.documentId
    && managedCmSummary.documentId === resolvedCmId
    && isForbiddenError(cmError),
  );
  const cm = /** @type {CMMultisport | null | undefined} */ (cmData || managedCmSummary);
  const sectionsData = /** @type {{ data?: CMSectionRow[] } | undefined} */ (sectionsDataRaw);
  const sections = useMemo(() => sectionsData?.data || [], [sectionsData?.data]);
  const sponsors = useMemo(() => cm?.sponsor || [], [cm?.sponsor]);
  const admins = useMemo(() => {
    const cmAdmins = Array.isArray(cm?.admins) ? cm.admins : [];
    const baseAdmins = /** @type {CMAdmin[]} */ (
      cmAdmins
    ).filter(Boolean);
    const connectedAdmin = isManagedCmByAuth && userData?.documentId
      ? {
        avatar: userData?.avatar,
        documentId: userData.documentId,
        firstname: userData?.firstname,
        lastname: userData?.lastname,
      }
      : null;

    if (!connectedAdmin) {
      return baseAdmins;
    }

    if (baseAdmins.some((admin) => admin?.documentId === connectedAdmin.documentId)) {
      return baseAdmins;
    }

    return [...baseAdmins, connectedAdmin];
  }, [
    cm?.admins,
    isManagedCmByAuth,
    userData?.avatar,
    userData?.documentId,
    userData?.firstname,
    userData?.lastname,
  ]);
  const isLoading = cmLoading || sectionsLoading;
  const error = sectionsError || (canFallbackToManagedSummary ? null : cmError);

  const isCmAdmin = useMemo(
    () => isManagedCmByAuth || canFallbackToManagedSummary || admins.some((admin) => admin.documentId === userData?.documentId),
    [admins, canFallbackToManagedSummary, isManagedCmByAuth, userData?.documentId],
  );

  const refetch = useCallback(() => {
    refetchCM();
    refetchSections();
  }, [refetchCM, refetchSections]);

  const globalStats = useMemo(() => {
    let totalTeams = 0;
    let totalMembers = 0;
    sections.forEach((section) => {
      totalTeams += section.stats?.teams || 0;
      totalMembers += section.stats?.members || 0;
    });
    return {
      members: totalMembers,
      sections: sections.length,
      teams: totalTeams,
    };
  }, [sections]);

  const deleteMutation = /** @type {import('@tanstack/react-query').UseMutationResult<any, any, string, unknown>} */ (useMutation({
    mutationFn: (/** @type {string} */ sectionId) => {
      if (!resolvedCmId) throw new Error('Missing cmId');
      return deleteCMSection(resolvedCmId, sectionId);
    },
    onError: (err) => {
      displayErrorAlert(err);
    },
    onSuccess: () => {
      refetchSections();
      Alert.alert(t('common.actions.delete'), t('multisport.sectionDeleted'));
    },
  }));

  const handleOpenManageClub = useCallback(() => {
    if (!resolvedCmId) return;
    navigation.navigate(RouteNames.MultisportClubEdit, { cmId: resolvedCmId });
  }, [navigation, resolvedCmId]);

  const handleOpenRequestsHub = useCallback(() => {
    navigateToRequestsHub(navigation, {
      initialFilter: 'all',
      source: 'cm_dashboard',
    });
  }, [navigation]);

  const handleAddEvent = useCallback(() => {
    navigation.navigate(RouteNames.EventStack, {
      screen: RouteNames.EventWizardType,
    });
  }, [navigation]);

  const handleAddRecruitmentAd = useCallback(() => {
    navigation.navigate(RouteNames.AdWizardStack);
  }, [navigation]);

  const handleOpenLicenses = useCallback(() => {
    if (!resolvedCmId) return;
    navigation.navigate(RouteNames.CMLicensesDashboard, { cmId: resolvedCmId });
  }, [navigation, resolvedCmId]);

  const handleCreateSection = useCallback(() => {
    if (!resolvedCmId) return;
    navigation.navigate(RouteNames.CreateSection, { cmId: resolvedCmId });
  }, [navigation, resolvedCmId]);

  const handleCreateSponsor = useCallback(() => {
    if (!resolvedCmId) return;
    navigation.navigate(RouteNames.AddSponsor, { cmId: resolvedCmId });
  }, [navigation, resolvedCmId]);

  const handleSectionPress = useCallback((/** @type {CMSectionRow} */ section) => {
    if (!section?.documentId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId: section.documentId },
      screen: RouteNames.Club,
    });
  }, [navigation]);

  const handleDeleteSection = useCallback((/** @type {CMSectionRow} */ section) => {
    Alert.alert(
      t('multisport.deleteSectionTitle'),
      t('multisport.deleteSectionConfirm', { name: section.name }),
      [
        { style: 'cancel', text: t('common.actions.cancel') },
        {
          onPress: () => {
            if (section.documentId) {
              deleteMutation.mutate(section.documentId);
            }
          },
          style: 'destructive',
          text: t('common.actions.delete'),
        },
      ],
    );
  }, [deleteMutation, t]);

  const handleAdminPress = useCallback((/** @type {CMAdmin} */ admin) => {
    if (!admin?.documentId) return;
    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: admin.documentId },
      screen: RouteNames.UserDetails,
    });
  }, [navigation]);

  const actionItems = useMemo(() => {
    /** @type {Array<{ key: string; title: string; subtitle: string; icon: keyof import('@/theme/types').AllImages; onPress?: () => void; disabled?: boolean }>} */
    const items = [
    {
      icon: 'users',
      key: 'manage-club',
      onPress: handleOpenManageClub,
      subtitle: t('multisport.actions.manageClub.subtitle', 'Modifier les informations et réglages du club.'),
      title: t('multisport.actions.manageClub.title', 'Gérer mon club'),
    },
    {
      icon: 'euroCircle',
      key: 'licenses',
      onPress: handleOpenLicenses,
      subtitle: t('multisport.actions.licenses.subtitle', 'Piloter les cotisations et paiements de toutes les sections.'),
      title: t('multisport.actions.licenses.title', 'Cotisations multisport'),
    },
    {
      icon: 'bell',
      key: 'manage-requests',
      onPress: handleOpenRequestsHub,
      subtitle: t('multisport.actions.requests.subtitle', 'Traiter les demandes en attente de votre organisation.'),
      title: t('multisport.actions.requests.title', 'Demandes'),
    },
    {
      icon: 'calendar',
      key: 'add-event',
      onPress: handleAddEvent,
      subtitle: t('multisport.actions.addEvent.subtitle', 'Créer un événement pour une section ou une équipe.'),
      title: t('multisport.actions.addEvent.title', 'Ajouter un événement'),
    },
    {
      icon: 'running',
      key: 'add-ad',
      onPress: handleAddRecruitmentAd,
      subtitle: t('multisport.actions.addAd.subtitle', 'Publier une annonce de recherche de profil.'),
      title: t('multisport.actions.addAd.title', 'Ajouter une annonce'),
    },
    ];
    return items;
  }, [
    handleAddEvent,
    handleAddRecruitmentAd,
    handleOpenLicenses,
    handleOpenManageClub,
    handleOpenRequestsHub,
    t,
  ]);

  const statsItems = useMemo(() => ([
    {
      key: 'sections',
      label: t('multisport.stats.sections', 'Sections'),
      value: globalStats.sections,
    },
    {
      key: 'teams',
      label: t('multisport.stats.teams', 'Équipes'),
      onPress: () => navigation.navigate(RouteNames.CMTeams, { cmId: resolvedCmId }),
      value: globalStats.teams,
    },
    {
      key: 'members',
      label: t('multisport.stats.members', 'Membres'),
      onPress: () => navigation.navigate(RouteNames.CMMembers, { cmId: resolvedCmId }),
      value: globalStats.members,
    },
  ]), [globalStats.members, globalStats.sections, globalStats.teams, navigation, resolvedCmId, t]);

  const isMissingCmId = !resolvedCmId;
  const isCmNotFound = Boolean(resolvedCmId) && !isLoading && !error && !cm;

  if (isMissingCmId || isCmNotFound) {
    return (
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingVertical[24],
          Alignments.column,
          Alignments.justifyCenter,
          Alignments.fill,
        ]}
      >
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {isMissingCmId ? 'Club multisport introuvable' : 'Cet espace multisport est introuvable'}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {isMissingCmId
              ? 'Aucun identifiant multisport n a ete fourni.'
              : 'Le lien est peut-etre obsolete ou cet espace a ete supprime.'}
          </Text>
          <Button onPress={() => navigation.navigate(RouteNames.MyClubs)} title="Retour aux clubs" variant="Secondary" />
          {!isMissingCmId ? (
            <Button onPress={refetch} title="Réessayer" variant="Primary" />
          ) : null}
        </View>
      </ScreenContainer>
    );
  }

  return (
    <TutorialFlowBoundary
      onForceStartHandled={() => {
        navigation.setParams({
          startTutorial: undefined,
          tutorialId: undefined,
          tutorialSource: undefined,
          tutorialStartToken: undefined,
        });
      }}
      routeParams={route?.params}
      tutorialId={TutorialIds.MY_TEAMS}
      userId={userData?.documentId}
    >
      <ScreenContainer
        bgImage="bg2"
        contentContainerStyle={[
          Spaces.paddingVertical[24],
          Alignments.column,
          Alignments.fill,
        ]}
      >
        <OnboardingWrapper
          description={t('multisport.tutorial.mainDescription', 'Gérez vos sections, vos membres et vos actions rapides depuis un seul écran.')}
          id="cm-dashboard-main-content"
          order={1}
          spotlight={{
            borderRadius: 16,
            maxHeight: 280,
            overlayOpacity: 0.4,
            paddingX: 2,
            paddingY: 2,
          }}
          style={{ flex: 1 }}
          title={t('multisport.tutorial.mainTitle', 'Gestion multisport')}
        >
          <ScrollView
            contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[40]]}
            refreshControl={<RefreshControl onRefresh={refetch} refreshing={isLoading} />}
            showsVerticalScrollIndicator={false}
          >
            <WithDataWrapper
              error={error}
              isLoading={isLoading}
              wrapperStyle={[Spaces.gap[24]]}
            >
              <MultisportHeroCard
                canEdit={isCmAdmin}
                cm={cm}
                getClubInitials={getClubInitials}
                onEditPress={handleOpenManageClub}
              />

              <MultisportStatsRow items={statsItems} />

              <MultisportSponsorsSection
                canEdit={isCmAdmin}
                onAddSponsor={handleCreateSponsor}
                sponsors={sponsors}
              />

              <MultisportSectionsList
                canEdit={isCmAdmin}
                getClubInitials={getClubInitials}
                onAddSection={isCmAdmin ? handleCreateSection : undefined}
                onDeleteSection={isCmAdmin ? handleDeleteSection : undefined}
                onSectionPress={handleSectionPress}
                sections={sections}
                title={t('multisport.titles.sections', 'Mes sections')}
              />

              <MultisportAdminsSection admins={admins} onAdminPress={handleAdminPress} />

              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                  {t('multisport.titles.quickActions', 'Actions rapides')}
                </Text>
                <MultisportActionGrid items={actionItems} />
              </View>
            </WithDataWrapper>
          </ScrollView>
        </OnboardingWrapper>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default CMDashboard;
