/* eslint-disable indent */
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { useClubScope } from '@/context/ClubScopeContext';
import useClub from '@/domains/club/useClub';
import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
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
  getCMTeams,
  getCMWeekendResults,
  getMultisportClubById,
  remindCMWeekendScore,
} from '@/services/multisportClub/multisportClubService';

import { displayErrorAlert } from '@/utils/errors/displayError';

// Même motif que `EventDetails.web.js` : `import/order` veut `@/responsive` AVANT les voisins,
// `perfectionist` APRÈS ; les deux règles se contredisent sur ce seul bloc.
/* eslint-disable perfectionist/sort-imports */
import { useIsDesktop } from '@/responsive';
import ClubCompactHeader from './components/ClubCompactHeader';
import ClubResultsBoard from './components/ClubResultsBoard';
import MultisportActionGrid from './components/MultisportActionGrid';
import MultisportAdminsSection from './components/MultisportAdminsSection';
import MultisportHeroCard from './components/MultisportHeroCard';
import MultisportSectionsList from './components/MultisportSectionsList';
import MultisportSponsorsSection from './components/MultisportSponsorsSection';
import MultisportStatsRow from './components/MultisportStatsRow';
import WeekendResultsCard, { weekendRowKey } from './components/WeekendResultsCard';
/* eslint-enable perfectionist/sort-imports */

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
  || normalizeErrorMessage(error).includes('accès refuse')
  || normalizeErrorMessage(error).includes('accès refusé')
  || normalizeErrorMessage(error).includes('forbidden')
);

/**
 * @typedef {{ url?: string }} ImageAsset
 * @typedef {{ documentId?: string; firstname?: string; lastname?: string; avatar?: ImageAsset }} CMAdmin
 * @typedef {{ title?: string; link?: string; logo?: ImageAsset }} CMSponsor
 * @typedef {{ teams?: number; members?: number }} CMSectionStats
 * @typedef {{ documentId?: string; name?: string; sport?: string; activites?: Array<{ name?: string }>; logoUrl?: string; stats?: CMSectionStats }} CMSectionRow
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
  const clubScope = useClubScope() || {};
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
  const resolvedCmId = cmId
    || clubScope.activeMultisportClubId
    || relatedCmSummaries[0]?.documentId
    || '';
  const managedCmSummary = useMemo(
    () => relatedCmSummaries.find((/** @type {CMMultisportSummary} */ club) => club?.documentId === resolvedCmId) || null,
    [relatedCmSummaries, resolvedCmId],
  );
  // BH03 · P14-02 : `parentMultisport` dit quel club AFFICHER, jamais qui l'administre ;
  // seuls les clubs de `userData.multisportClubs` sont geres.
  const isManagedCmByAuth = Boolean(
    resolvedCmId
    && (Array.isArray(userData?.multisportClubs) ? userData.multisportClubs : [])
      .some((/** @type {CMMultisportSummary} */ club) => club?.documentId === resolvedCmId),
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
    isManagedCmByAuth
    && managedCmSummary?.documentId
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

  // ST-VUES2 (planche 18) — « Résultats du week-end » : la route est reservee au dirigeant
  // DU club (politique is-dirigeant-omnisport) ; on ne la demande qu'a lui.
  const {
    data: weekendResults,
    error: weekendError,
    isLoading: weekendLoading,
    refetch: refetchWeekend,
  } = useQuery({
    enabled: Boolean(resolvedCmId) && isCmAdmin,
    queryFn: () => getCMWeekendResults(resolvedCmId),
    queryKey: ['cm-weekend-results', resolvedCmId],
  });
  // « score A » : le dirigeant qui n'entraine pas l'equipe relance son entraineur. La ligne
  // relancee le dit pour la session ; le serveur, lui, n'envoie qu'une relance par jour.
  const [remindedKeys, setRemindedKeys] = useState(() => new Set());
  const remindMutation = useMutation({
    mutationFn: (/** @type {{ eventId: string, teamId: string }} */ row) => (
      remindCMWeekendScore(resolvedCmId, { eventId: row.eventId, teamId: row.teamId })
    ),
    onError: (err) => {
      displayErrorAlert(err);
    },
    onSuccess: (_result, row) => {
      setRemindedKeys((previous) => new Set(previous).add(weekendRowKey(row)));
    },
  });

  // ST-VUES3-ORDI (planche 18, ordinateur) — la colonne de droite liste « Les équipes » du
  // club : la même lecture (et le même cache) que la liste « Équipes ». Le téléphone ne la
  // demande pas.
  const isDesktop = useIsDesktop();
  const { data: cmTeamsData } = useQuery({
    enabled: Boolean(resolvedCmId) && isCmAdmin && isDesktop,
    queryFn: () => getCMTeams(resolvedCmId),
    queryKey: ['cm-teams', resolvedCmId],
  });
  const cmTeams = useMemo(
    () => (Array.isArray(cmTeamsData?.data) ? cmTeamsData.data : []),
    [cmTeamsData?.data],
  );
  // ECRAN18-OMNI (06/10, décision d'Adel `omni A`) — sur ordinateur, la grande carte du
  // téléphone laisse la place à la ligne de la planche P5-club-ordi, comme pour un club simple
  // (ECRAN18-ENTETE). Même bascule que la planche à 2 colonnes ; le téléphone et un visiteur
  // gardent la carte.
  const enTeteCompact = isDesktop && isCmAdmin;
  // Les sports du club, une fois chacun : ceux de ses sections (même lecture que « Mes
  // sections » : `sport`, sinon la première activité).
  const sportsDesSections = useMemo(() => [...new Set(sections
    .map((section) => section?.sport || section?.activites?.[0]?.name || '')
    .filter(Boolean))].join(' · '), [sections]);

  const refetch = useCallback(() => {
    refetchCM();
    refetchSections();
    if (isCmAdmin) refetchWeekend();
  }, [isCmAdmin, refetchCM, refetchSections, refetchWeekend]);

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
      t('multisport.deleteSectionConfirm', { name: section.name, ...SANS_ECHAPPEMENT }),
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

  // ST-VUES2 (planche 18) — un score saisi ouvre le match ; « Saisir » aussi : c'est sur la
  // page du match que l'entraineur saisit le score.
  const handleOpenWeekendMatch = useCallback((/** @type {{ eventId: string }} */ row) => {
    if (!row?.eventId) return;
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: row.eventId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  // ST-VUES3-ORDI — « Stats » d'une équipe de la planche ordinateur ouvre son onglet Stats.
  const handleOpenTeamStats = useCallback((/** @type {{ documentId?: string }} */ team) => {
    if (!team?.documentId) return;
    navigation.navigate(RouteNames.TeamStack, {
      params: { initialTab: 'stats', teamId: team.documentId },
      screen: RouteNames.TeamDetails,
    });
  }, [navigation]);

  // Etat 4 — un club sans equipe : une equipe dans sa premiere section, ou d'abord une section.
  const weekendEmptyAction = useMemo(() => {
    if (!isCmAdmin) return null;
    const firstSectionId = sections[0]?.documentId;
    if (!firstSectionId) {
      return {
        label: t('weekendResults.createSection', 'Créer une section'),
        onPress: handleCreateSection,
      };
    }
    return {
      label: t('weekendResults.createTeam', 'Créer une équipe'),
      onPress: () => navigation.navigate(RouteNames.TeamStack, {
        params: { clubId: firstSectionId },
        screen: RouteNames.TeamWizardName,
      }),
    };
  }, [handleCreateSection, isCmAdmin, navigation, sections, t]);

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
      subtitle: t('multisport.actions.requests.subtitle', 'Traiter les demandes en attente de ton organisation.'),
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

  // ST-VUES (planche 18) — « les trois chiffres se touchent tous » : « Sections » descend a
  // « Mes sections », sur cette page ; « Équipes » et « Membres » ouvraient deja leur liste.
  const scrollRef = useRef(/** @type {any} */ (null));
  const sectionsOffsetRef = useRef(0);
  const statsItems = useMemo(() => ([
    {
      key: 'sections',
      label: t('multisport.stats.sections', 'Sections'),
      onPress: () => scrollRef.current?.scrollTo({ animated: true, y: sectionsOffsetRef.current }),
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

  // La carte reçoit la même chose au téléphone et dans la planche ordinateur.
  const weekendCardProps = {
    data: weekendResults,
    emptyAction: weekendEmptyAction,
    error: weekendError,
    isLoading: weekendLoading,
    onEnterScore: handleOpenWeekendMatch,
    onOpenMatch: handleOpenWeekendMatch,
    onRemind: (/** @type {{ eventId: string, teamId: string }} */ row) => remindMutation
      .mutate(row),
    onRetry: refetchWeekend,
    remindedKeys,
    remindingKey: remindMutation.isPending && remindMutation.variables
      ? weekendRowKey(remindMutation.variables)
      : null,
  };

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
            {isMissingCmId ? t(
              'cmDashboard.notFound.missingIdTitle',
              'Club multisport introuvable',
            ) : t(
              'cmDashboard.notFound.title',
              'Cet espace multisport est introuvable',
            )}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {isMissingCmId
              ? t(
                'cmDashboard.notFound.missingIdMessage',
                'Aucun identifiant multisport n a été fourni.',
              )
              : t(
                'cmDashboard.notFound.message',
                'Le lien est peut-être obsolète ou cet espace a été supprimé.',
              )}
          </Text>
          <Button
            onPress={() => navigation.navigate(RouteNames.MyClubs)}
            title={t(
            'cmDashboard.notFound.backToClubs',
            'Retour aux clubs',
          )}
            variant="Secondary"
          />
          {!isMissingCmId ? (
            <Button
              onPress={refetch}
              title={t(
              'cmDashboard.notFound.retry',
              'Réessayer',
            )}
              variant="Primary"
            />
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
          description={t('multisport.tutorial.mainDescription', 'Gère tes sections, tes membres et tes actions rapides depuis un seul écran.')}
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
            ref={scrollRef}
            refreshControl={<RefreshControl onRefresh={refetch} refreshing={isLoading} />}
            showsVerticalScrollIndicator={false}
          >
            <WithDataWrapper
              error={error}
              isLoading={isLoading}
              wrapperStyle={[Spaces.gap[24]]}
            >
              {/* ECRAN18-OMNI — la ligne compacte sur ordinateur. Rien n'est perdu : « Modifier »
                  et le badge OMNISPORT y sont ; l'adresse, le téléphone et l'e-mail (absents de la
                  planche) restent dans « Modifier ». */}
              {enTeteCompact ? (
                <ClubCompactHeader
                  badge={t('multisport.badge', 'OMNISPORT')}
                  club={cm || undefined}
                  editAccessibilityLabel={t(
                    'multisport.accessibility.editClub',
                    'Modifier les informations du club',
                  )}
                  onEdit={handleOpenManageClub}
                  subtitle={sportsDesSections}
                  title={cm?.name || '-'}
                />
              ) : (
                <MultisportHeroCard
                  canEdit={isCmAdmin}
                  cm={cm}
                  getClubInitials={getClubInitials}
                  onEditPress={handleOpenManageClub}
                />
              )}

              {/* ST-VUES3-ORDI (planche 18, ordinateur) — le tableau du week-end a gauche, les
                  trois chiffres et « Les équipes » a droite. Le telephone ne change pas. */}
              {isDesktop && isCmAdmin ? (
                <ClubResultsBoard
                  onOpenTeamStats={handleOpenTeamStats}
                  statsItems={statsItems}
                  teams={cmTeams}
                  weekendCard={weekendCardProps}
                />
              ) : (
                <>
                  <MultisportStatsRow items={statsItems} />

                  {isCmAdmin ? (
                    <WeekendResultsCard
                      // eslint-disable-next-line react/jsx-props-no-spreading
                      {...weekendCardProps}
                    />
                  ) : null}

                  {/* ST-VUES (planche 18, etat 2) — chaque fiche d equipe a son onglet
                      Stats pour le dirigeant (STATS-ENQUETE, defaut 3) : un lien y mene,
                      par la liste. */}
                  <TouchableOpacity
                    accessibilityRole="link"
                    onPress={() => navigation.navigate(RouteNames.CMTeams, { cmId: resolvedCmId })}
                    style={{ alignSelf: 'flex-start', justifyContent: 'center', minHeight: 44 }}
                    testID="cm-team-stats-link"
                  >
                    <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                      {t('clubStatsView.eachTeamStats', 'Les stats de chaque équipe')}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              <MultisportSponsorsSection
                canEdit={isCmAdmin}
                onAddSponsor={handleCreateSponsor}
                sponsors={sponsors}
              />

              <View
                onLayout={(/** @type {any} */ event) => {
                  sectionsOffsetRef.current = event?.nativeEvent?.layout?.y || 0;
                }}
              >
                <MultisportSectionsList
                  canEdit={isCmAdmin}
                  getClubInitials={getClubInitials}
                  onAddSection={isCmAdmin ? handleCreateSection : undefined}
                  onDeleteSection={isCmAdmin ? handleDeleteSection : undefined}
                  onSectionPress={handleSectionPress}
                  sections={sections}
                  title={t('multisport.titles.sections', 'Mes sections')}
                />
              </View>

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
