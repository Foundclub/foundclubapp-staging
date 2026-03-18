import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { getMultisportClubById } from '@/services/multisportClub/multisportClubService';

import MultisportActionGrid from './components/MultisportActionGrid';
import MultisportAdminsSection from './components/MultisportAdminsSection';
import MultisportHeroCard from './components/MultisportHeroCard';
import MultisportSectionsList from './components/MultisportSectionsList';
import MultisportSponsorsSection from './components/MultisportSponsorsSection';
import MultisportStatsRow from './components/MultisportStatsRow';

/**
 * @typedef {{ url?: string }} ImageAsset
 * @typedef {{ documentId?: string; firstname?: string; lastname?: string; avatar?: ImageAsset }} CMAdmin
 * @typedef {{ name?: string }} SectionActivity
 * @typedef {{ documentId?: string; name?: string; logo?: ImageAsset; activites?: SectionActivity[]; teams?: unknown[] }} CMSection
 * @typedef {{ title?: string; link?: string; logo?: ImageAsset }} CMSponsor
 * @typedef {{
 *  documentId?: string;
 *  name?: string;
 *  logo?: ImageAsset;
 *  addressDetails?: string;
 *  phoneNumber?: string;
 *  email?: string;
 *  sponsor?: CMSponsor[];
 *  admins?: CMAdmin[];
 *  sections?: CMSection[];
 * }} MultisportClub
 */

/**
 * @param {{ navigation: any; route: { params?: { cmId?: string } } }} props
 */
function MultisportClubDetails({ navigation, route }) {
  const { cmId } = route?.params ?? {};
  const { t } = useTranslation();
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { userData } = useAuth();
  const { getClubInitials } = useClub();

  const {
    data: cmData,
    error,
    isLoading,
    refetch,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => {
      if (!cmId) return Promise.resolve(null);
      return getMultisportClubById(cmId);
    },
    queryKey: ['multisport-club', cmId],
  });

  const cm = /** @type {MultisportClub | null | undefined} */ (cmData);
  const sponsors = useMemo(() => cm?.sponsor || [], [cm?.sponsor]);
  const sections = useMemo(() => cm?.sections || [], [cm?.sections]);
  const admins = useMemo(() => cm?.admins || [], [cm?.admins]);
  const canEdit = useMemo(
    () => admins.some((admin) => admin.documentId === userData?.documentId),
    [admins, userData?.documentId],
  );

  const handleSectionPress = useCallback((section) => {
    if (!section?.documentId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId: section.documentId },
      screen: RouteNames.Club,
    });
  }, [navigation]);

  const handleAdminPress = useCallback((admin) => {
    if (!admin?.documentId) return;
    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: admin.documentId },
      screen: RouteNames.UserDetails,
    });
  }, [navigation]);

  const handleOpenManageClub = useCallback(() => {
    if (!cmId) return;
    navigation.navigate(RouteNames.MultisportClubEdit, { cmId });
  }, [cmId, navigation]);

  const handleOpenRequests = useCallback(() => {
    navigateToRequestsHub(navigation, {
      initialFilter: 'all',
      source: 'multisport_details',
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

  const handleAddSponsor = useCallback(() => {
    navigation.navigate(RouteNames.AddSponsor, { cmId });
  }, [cmId, navigation]);

  const statsItems = useMemo(() => {
    const teamsCount = sections.reduce((total, section) => total + (section.teams?.length || 0), 0);
    return [
      {
        key: 'sections',
        label: t('multisport.stats.sections', 'Sections'),
        value: sections.length,
      },
      {
        key: 'teams',
        label: t('multisport.stats.teams', 'Équipes'),
        value: teamsCount,
      },
      {
        key: 'admins',
        label: t('multisport.stats.admins', 'Dirigeants'),
        value: admins.length,
      },
    ];
  }, [admins.length, sections, t]);

  const actionItems = useMemo(() => {
    if (!canEdit) return [];
    return [
      {
        icon: 'users',
        key: 'manage-club',
        onPress: handleOpenManageClub,
        subtitle: t('multisport.actions.manageClub.subtitle', 'Modifier les informations et réglages du club.'),
        title: t('multisport.actions.manageClub.title', 'Gérer mon club'),
      },
      {
        icon: 'bell',
        key: 'requests',
        onPress: handleOpenRequests,
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
  }, [
    canEdit,
    handleAddEvent,
    handleAddRecruitmentAd,
    handleOpenManageClub,
    handleOpenRequests,
    t,
  ]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[40]]}
        refreshControl={<RefreshControl onRefresh={refetch} refreshing={isLoading} />}
        showsVerticalScrollIndicator={false}
      >
        <WithDataWrapper
          error={error?.message}
          isLoading={isLoading}
          wrapperStyle={[Spaces.gap[24]]}
        >
          <MultisportHeroCard
            canEdit={canEdit}
            cm={cm}
            getClubInitials={getClubInitials}
            onEditPress={handleOpenManageClub}
          />

          <MultisportStatsRow items={statsItems} />

          {actionItems.length ? (
            <View style={[Spaces.gap[12]]}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                {t('multisport.titles.quickActions', 'Actions rapides')}
              </Text>
              <MultisportActionGrid items={actionItems} />
            </View>
          ) : null}

          <MultisportSponsorsSection
            canEdit={canEdit}
            onAddSponsor={handleAddSponsor}
            sponsors={sponsors}
          />

          <MultisportSectionsList
            getClubInitials={getClubInitials}
            onSectionPress={handleSectionPress}
            sections={sections}
            title={t('multisport.titles.sections', 'Mes sections')}
          />

          <MultisportAdminsSection admins={admins} onAdminPress={handleAdminPress} />

          {canEdit ? (
            <Button
              onPress={() => navigation.navigate(RouteNames.CreateSection, { cmId })}
              title={t('multisport.actions.createSection.title', 'Créer une section')}
              variant="Secondary"
            />
          ) : null}
        </WithDataWrapper>
      </ScrollView>
    </ScreenContainer>
  );
}

export default MultisportClubDetails;
