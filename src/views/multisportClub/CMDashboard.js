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

/**
 * @typedef {{ url?: string }} ImageAsset
 * @typedef {{ documentId?: string; firstname?: string; lastname?: string; avatar?: ImageAsset }} CMAdmin
 * @typedef {{ title?: string; link?: string; logo?: ImageAsset }} CMSponsor
 * @typedef {{ teams?: number; members?: number }} CMSectionStats
 * @typedef {{ documentId?: string; name?: string; sport?: string; logoUrl?: string; stats?: CMSectionStats }} CMSectionRow
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

  const {
    data: cmData,
    error: cmError,
    isLoading: cmLoading,
    refetch: refetchCM,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => {
      if (!cmId) return Promise.resolve(null);
      return getMultisportClubById(cmId);
    },
    queryKey: ['multisport-club', cmId],
  });

  const {
    data: sectionsDataRaw,
    error: sectionsError,
    isLoading: sectionsLoading,
    refetch: refetchSections,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => {
      if (!cmId) return Promise.resolve({ data: [] });
      return getCMClubs(cmId);
    },
    queryKey: ['cm-clubs', cmId],
  });

  const cm = /** @type {CMMultisport | null | undefined} */ (cmData);
  const sectionsData = /** @type {{ data?: CMSectionRow[] } | undefined} */ (sectionsDataRaw);
  const sections = useMemo(() => sectionsData?.data || [], [sectionsData?.data]);
  const sponsors = useMemo(() => cm?.sponsor || [], [cm?.sponsor]);
  const admins = useMemo(() => cm?.admins || [], [cm?.admins]);
  const isLoading = cmLoading || sectionsLoading;
  const error = cmError || sectionsError;

  const isCmAdmin = useMemo(
    () => admins.some((admin) => admin.documentId === userData?.documentId),
    [admins, userData?.documentId],
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

  const deleteMutation = useMutation({
    mutationFn: (sectionId) => {
      if (!cmId) throw new Error('Missing cmId');
      return deleteCMSection(cmId, sectionId);
    },
    onError: (err) => {
      displayErrorAlert(err);
    },
    onSuccess: () => {
      refetchSections();
      Alert.alert(t('common.actions.delete'), t('multisport.sectionDeleted'));
    },
  });

  const handleOpenManageClub = useCallback(() => {
    if (!cmId) return;
    navigation.navigate(RouteNames.MultisportClubEdit, { cmId });
  }, [cmId, navigation]);

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

  const handleCreateSection = useCallback(() => {
    navigation.navigate(RouteNames.CreateSection, { cmId });
  }, [cmId, navigation]);

  const handleCreateSponsor = useCallback(() => {
    navigation.navigate(RouteNames.AddSponsor, { cmId });
  }, [cmId, navigation]);

  const handleSectionPress = useCallback((section) => {
    if (!section?.documentId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId: section.documentId },
      screen: RouteNames.Club,
    });
  }, [navigation]);

  const handleDeleteSection = useCallback((section) => {
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

  const handleAdminPress = useCallback((admin) => {
    if (!admin?.documentId) return;
    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: admin.documentId },
      screen: RouteNames.UserDetails,
    });
  }, [navigation]);

  const actionItems = useMemo(() => ([
    {
      icon: 'users',
      key: 'manage-club',
      onPress: handleOpenManageClub,
      subtitle: t('multisport.actions.manageClub.subtitle', 'Modifier les informations et réglages du club.'),
      title: t('multisport.actions.manageClub.title', 'Gérer mon club'),
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
  ]), [
    handleAddEvent,
    handleAddRecruitmentAd,
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
      onPress: () => navigation.navigate(RouteNames.CMTeams, { cmId }),
      value: globalStats.teams,
    },
    {
      key: 'members',
      label: t('multisport.stats.members', 'Membres'),
      onPress: () => navigation.navigate(RouteNames.CMMembers, { cmId }),
      value: globalStats.members,
    },
  ]), [cmId, globalStats.members, globalStats.sections, globalStats.teams, navigation, t]);

  const isMissingCmId = !cmId;
  const isCmNotFound = Boolean(cmId) && !isLoading && !error && !cm;

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
            <Button onPress={refetch} title="R\u00E9essayer" variant="Primary" />
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

              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                  {t('multisport.titles.quickActions', 'Actions rapides')}
                </Text>
                <MultisportActionGrid items={actionItems} />
              </View>

              <MultisportSponsorsSection
                canEdit={isCmAdmin}
                onAddSponsor={handleCreateSponsor}
                sponsors={sponsors}
              />

              <MultisportSectionsList
                getClubInitials={getClubInitials}
                onDeleteSection={isCmAdmin ? handleDeleteSection : undefined}
                onSectionPress={handleSectionPress}
                sections={sections}
                title={t('multisport.titles.sections', 'Mes sections')}
              />

              <MultisportAdminsSection admins={admins} onAdminPress={handleAdminPress} />

              {isCmAdmin ? (
                <View style={[Spaces.marginTop[4]]}>
                  <Button
                    icon="plus"
                    onPress={handleCreateSection}
                    title={t('multisport.actions.createSection.title', 'Créer une section')}
                    variant="Secondary"
                  />
                </View>
              ) : null}
            </WithDataWrapper>
          </ScrollView>
        </OnboardingWrapper>
      </ScreenContainer>
    </TutorialFlowBoundary>
  );
}

export default CMDashboard;
