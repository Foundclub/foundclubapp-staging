import MaskedView from '@react-native-masked-view/masked-view';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import {
  getSubscriptionEntryPointLock,
  getSubscriptionQuotaItem,
} from '@/domains/subscription/subscriptionDecision';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WebFloatingOverlay from '@/components/atoms/webFloatingOverlay/WebFloatingOverlay';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import PremiumBadge from '@/components/molecules/premiumBadge/PremiumBadge';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import SubscriptionPaywallSheet
  from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';

import { getFloatingActionContainerStyle } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import {
  useGetLeagueTeamContext,
} from '@/services/leagueTeam/leagueTeamQueries';
import { useGetTeams } from '@/services/team/teamQueries';

import { getTeamMemberCount } from '@/utils/teamMemberCount';
import { sortTeamsForDisplay } from '@/utils/teamSort';

/** @typedef {any} Team */
/** @typedef {any} User */
/** @typedef {{ requestId?: string } & Team} PendingTeam */

/**
 * Team list content to be used in home page or dedicated team list screen
 * @param {object} props
 * @param {string} [props.clubId] - The ID of the club to fetch teams for
 * @param {boolean} [props.isLeagueMode] - League mode renders squads instead of classic teams.
 * @param {boolean} [props.showOnlyMyTeams] - Hide non-affiliated teams and keep only the user's teams.
 * @param {string} [props.assignmentTrainerId] - Optional trainer to preselect on TeamDetails trainer picker.
 * @param {string} [props.assignmentTrainerName] - Optional trainer display name for assignment flow.
 * @returns {import('react').ReactElement} Team list content component
 */
function TeamListContent({
  assignmentTrainerId = undefined,
  assignmentTrainerName = undefined,
  clubId = undefined,
  isLeagueMode = false,
  showOnlyMyTeams = false,
}) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { getClubInitials } = useClub();

  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const {
    canManageTeam, freeUsageSummary, subscriptionAccessLevel, userData,
  } = /** @type {any} */ (useAuth());
  const [{ teamFilters }] = useAppContext();
  const navigation = useNavigation();
  const { floatingActionBottomOffset, sceneBottomInset } = useBottomDockLayout();
  const { width } = useWindowDimensions();
  const isCompactScreen = width <= 375;
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  // Le juge partage du grisage (§2.3) : rend `null` des qu'il resterait du
  // quota, que l'utilisateur est abonne, ou qu'il ne peut pas acheter.
  const newTeamLock = useMemo(
    () => getSubscriptionEntryPointLock({
      freeUsageSummary,
      quotaType: 'FREE_TEAM',
      roleKey: getUserRoleKey(userData?.role?.type || userData?.role?.name),
      subscriptionAccessLevel,
    }),
    [freeUsageSummary, subscriptionAccessLevel, userData?.role?.name, userData?.role?.type],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  const classicTeamQueryParams = useMemo(() => ({
    activities: teamFilters?.activities || undefined,
    category: Array.isArray(teamFilters?.category) && teamFilters?.category?.length
      ? teamFilters?.category
      : undefined,
    clubId,
    level: Array.isArray(teamFilters?.level) && teamFilters?.level?.length
      ? teamFilters?.level
      : undefined,
    name: debouncedSearch || teamFilters?.name?.trim() || undefined,
    section: teamFilters?.section || undefined,
  }), [
    clubId,
    debouncedSearch,
    teamFilters?.activities,
    teamFilters?.category,
    teamFilters?.level,
    teamFilters?.name,
    teamFilters?.section,
  ]);

  const filterNumber = useMemo(() => {
    if (isLeagueMode) return 0;

    let count = 0;
    if (teamFilters?.activities) count += 1;
    if (teamFilters?.section) count += 1;
    if (Array.isArray(teamFilters?.category) && teamFilters?.category?.length) count += 1;
    if (Array.isArray(teamFilters?.level) && teamFilters?.level?.length) count += 1;
    if (teamFilters?.name?.trim()) count += 1;

    return count;
  }, [
    isLeagueMode,
    teamFilters?.activities,
    teamFilters?.category,
    teamFilters?.level,
    teamFilters?.name,
    teamFilters?.section,
  ]);

  const {
    data: classicData,
    error: classicError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isLoadingClassic,
    refetch: refetchClassic,
  } = useGetTeams(classicTeamQueryParams, {
    enabled: !isLeagueMode,
  });

  const {
    data: leagueTeamContext,
    error: leagueError,
    isLoading: isLoadingLeague,
    refetch: refetchLeague,
  } = useGetLeagueTeamContext(userData?.documentId || '', { enabled: isLeagueMode && !!userData });
  const leagueData = useMemo(
    () => (Array.isArray(leagueTeamContext?.squads) ? leagueTeamContext.squads : []),
    [leagueTeamContext?.squads],
  );
  const invitedLeagueData = useMemo(
    () => (Array.isArray(leagueTeamContext?.invitedSquads) ? leagueTeamContext.invitedSquads : []),
    [leagueTeamContext?.invitedSquads],
  );
  const pendingLeagueData = useMemo(
    () => (Array.isArray(leagueTeamContext?.pendingSquads) ? leagueTeamContext.pendingSquads : []),
    [leagueTeamContext?.pendingSquads],
  );

  const teams = useMemo(() => {
    if (isLeagueMode) return (leagueData || []).filter(Boolean);
    return classicData?.pages?.flatMap((page) => page?.data || [])?.filter(Boolean) || [];
  }, [classicData, leagueData, isLeagueMode]);

  const myTeamIds = useMemo(() => new Set(
    [
      ...(Array.isArray(userData?.myTeams) ? userData.myTeams : []),
      ...(Array.isArray(userData?.trainedTeams) ? userData.trainedTeams : []),
    ]
      .map((team) => String(team?.documentId || '').trim())
      .filter(Boolean),
  ), [userData?.myTeams, userData?.trainedTeams]);

  const scopedClassicTeams = useMemo(() => {
    if (isLeagueMode || !showOnlyMyTeams) {
      return teams;
    }

    return teams.filter((team) => myTeamIds.has(String(team?.documentId || '').trim()));
  }, [isLeagueMode, myTeamIds, showOnlyMyTeams, teams]);

  const isLoadingTeams = isLeagueMode
    ? isLoadingLeague
    : isLoadingClassic;
  const refetchTeams = useCallback(() => {
    if (isLeagueMode) {
      return refetchLeague();
    }
    return refetchClassic();
  }, [isLeagueMode, refetchClassic, refetchLeague]);
  const error = isLeagueMode ? leagueError : classicError;

  const {
    invitedTeams,
    myTeams,
    otherTeams,
    pendingTeams,
  } = useMemo(() => {
    if (!userData) {
      return {
        invitedTeams: [],
        myTeams: [],
        otherTeams: [],
        pendingTeams: [],
      };
    }

    if (isLeagueMode) {
      const joinedIds = new Set(
        (teams || [])
          .map((/** @type {Team} */ team) => team?.documentId)
          .filter((documentId) => typeof documentId === 'string' && documentId.length > 0),
      );
      const pendingIds = new Set(
        (pendingLeagueData || [])
          .map((/** @type {Team} */ team) => team?.documentId)
          .filter((documentId) => typeof documentId === 'string' && documentId.length > 0),
      );
      const pendingLeagueTeams = (pendingLeagueData || [])
        .filter(Boolean)
        .filter((/** @type {Team} */ team) => {
          const documentId = String(team?.documentId || '');
          return documentId.length > 0 && !joinedIds.has(documentId);
        });
      const invitedLeagueTeams = (invitedLeagueData || [])
        .filter(Boolean)
        .filter((/** @type {Team} */ team) => {
          const documentId = String(team?.documentId || '');
          return documentId.length > 0 && !joinedIds.has(documentId) && !pendingIds.has(documentId);
        });

      return {
        invitedTeams: sortTeamsForDisplay(invitedLeagueTeams),
        myTeams: sortTeamsForDisplay(teams),
        otherTeams: [],
        pendingTeams: sortTeamsForDisplay(pendingLeagueTeams),
      };
    }

    const my = /** @type {Team[]} */ ([]);
    const other = /** @type {Team[]} */ ([]);

    const teamRequests = userData.teamMembershipRequests || [];
    const pending = teamRequests
      .filter((/** @type {{ state?: string; team?: Team }} */ r) => r.state === 'pending' && r.team)
      .map((/** @type {{ team?: Team; documentId?: string }} */ r) => ({ ...r.team, requestId: r.documentId }));

    const clubRequests = userData.clubMembershipRequests || [];
    const pendingClubs = clubRequests
      .filter((/** @type {{ state?: string; club?: any }} */ r) => r.state === 'pending' && r.club)
      .map((/** @type {{ club?: any }} */ r) => ({
        ...r.club,
        activities: r.club.activities || [],
        club: r.club,
        documentId: r.club.documentId,
        name: r.club.name,
        type: 'club',
      }));

    scopedClassicTeams.forEach((/** @type {Team} */ team) => {
      const teamDocumentId = String(team?.documentId || '').trim();
      const isMyTeam = teamDocumentId && myTeamIds.has(teamDocumentId);
      const isPending = pending.some((/** @type {PendingTeam} */ p) => p.documentId === team.documentId);

      if (isMyTeam) {
        my.push(team);
      } else if (!showOnlyMyTeams && !isPending) {
        other.push(team);
      }
    });

    return {
      invitedTeams: [],
      myTeams: sortTeamsForDisplay(my),
      otherTeams: sortTeamsForDisplay(other),
      pendingTeams: sortTeamsForDisplay([...pending, ...pendingClubs]),
    };
  }, [invitedLeagueData, isLeagueMode, myTeamIds, pendingLeagueData, scopedClassicTeams, showOnlyMyTeams, teams, userData]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleTeamSelect = useCallback((/** @type {Team} */ team) => {
    if (team.type === 'club') {
      /** @type {any} */ (navigation).navigate(RouteNames.ClubStack, {
        params: { clubId: team.documentId },
        screen: RouteNames.Club,
      });
      return;
    }

    if (isLeagueMode) {
      /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, {
        params: { teamId: team.documentId },
        screen: RouteNames.SquadDetails,
      });
      return;
    }

    /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, {
      params: {
        assignmentTrainerId,
        assignmentTrainerName,
        teamId: team.documentId,
      },
      screen: RouteNames.TeamDetails,
    });
  }, [assignmentTrainerId, assignmentTrainerName, isLeagueMode, navigation]);

  useFocusEffect(
    useCallback(() => {
      refetchTeams();
    }, [refetchTeams]),
  );

  const handleOpenFilters = useCallback(() => {
    if (isLeagueMode) {
      /** @type {any} */ (navigation).navigate(RouteNames.SquadFilters);
      return;
    }

    const localRouteNames = navigation.getState?.()?.routeNames || [];
    if (localRouteNames.includes(RouteNames.TeamFilters)) {
      /** @type {any} */ (navigation).navigate(RouteNames.TeamFilters);
      return;
    }

    /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, {
      screen: RouteNames.TeamFilters,
    });
  }, [isLeagueMode, navigation]);

  const floatingActionBottom = floatingActionBottomOffset;
  const hasClubContext = Boolean(
    userData?.club?.documentId
      || userData?.club?.id
      || (Array.isArray(userData?.multisportClubs) && userData.multisportClubs.length > 0),
  );
  const shouldShowClubSearchCta = !isLeagueMode && !hasClubContext;

  const listBottomPadding = useMemo(
    () => (isLeagueMode
      ? Math.max(sceneBottomInset, floatingActionBottom + 92)
      : sceneBottomInset),
    [floatingActionBottom, isLeagueMode, sceneBottomInset],
  );

  const handleOpenClubSearch = useCallback(() => {
    // R06 — meme defaut que TeamWizardName : cet organisme est rendu par des
    // ecrans montes AUSSI sur le navigateur racine (TeamDetails, TeamList), ou
    // la route `Search` n'existe pas. La forme a trois niveaux marche partout.
    navigateToSearchHub(navigation, 'clubs');
  }, [navigation]);

  // Carte pointillee « Nouvelle équipe » avec statut du quota (handoff 9a).
  // L10-C : quand le quota gratuit est deja epuise, ce point d'entree se grise
  // et s'etiquette AVANT le tunnel — l'appui ouvre la feuille de vente au lieu
  // de faire remplir le wizard pour refuser a la fin (§2.3).
  const renderNewTeamFooterCard = useCallback(() => {
    if (isLeagueMode || !canManageTeam) {
      return null;
    }
    const freeTeamQuota = getSubscriptionQuotaItem(
      freeUsageSummary,
      'FREE_TEAM',
      subscriptionAccessLevel,
    );
    let quotaHint = 'Crée une équipe pour ton club.';
    if (freeTeamQuota) {
      quotaHint = freeTeamQuota.remaining > 0
        ? `Il te reste ${freeTeamQuota.remaining} création gratuite`
        : "Ta création gratuite est utilisée — débloque l'offre Équipe";
    }
    return (
      <TouchableOpacity
        accessibilityHint={quotaHint}
        accessibilityLabel="Nouvelle équipe"
        accessibilityRole="button"
        onPress={() => {
          if (newTeamLock) {
            setSubscriptionPaywallDecision(newTeamLock.decision);
            return;
          }

          /** @type {any} */ (navigation).navigate(RouteNames.TeamStack, {
            params: { clubId },
            screen: RouteNames.TeamWizardName,
          });
        }}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Spaces.gap[12],
          {
            borderColor: 'rgba(1,179,244,0.45)',
            borderRadius: 20,
            borderStyle: 'dashed',
            borderWidth: 1.5,
            marginTop: 12,
            minHeight: 64,
            paddingHorizontal: 16,
            paddingVertical: 10,
          },
          // Grise, mais jamais muet ni inerte : l'etiquette dit pourquoi et
          // l'appui reste actif pour ouvrir la vente (§2.3).
          Boolean(newTeamLock) && { opacity: 0.55 },
        ]}
      >
        <Text style={[Fonts.p1Bold, Fonts.primary500]}>+</Text>
        <View style={[Alignments.fill, Spaces.gap[4]]}>
          {newTeamLock ? (
            <View style={[Alignments.row]}>
              <PremiumBadge label={newTeamLock.badgeLabel} scope={newTeamLock.scope} />
            </View>
          ) : null}
          <Text style={[Fonts.p2Bold, Fonts.primary500]}>Nouvelle équipe</Text>
          <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral400, { marginTop: 1 }]}>
            {quotaHint}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [
    Alignments,
    canManageTeam,
    clubId,
    Fonts,
    freeUsageSummary,
    isLeagueMode,
    navigation,
    newTeamLock,
    Spaces,
    subscriptionAccessLevel,
  ]);

  const renderTeamCard = useCallback((/** @type {Team} */ item, stateVariant = null) => {
    const isPending = stateVariant === 'pending';
    const isInvitation = stateVariant === 'invited';
    const pendingBorderColor = Colors.warning500 || Colors.gold500;
    const invitationBorderColor = Colors.gold500 || Colors.primary500;
    let cardAccentColor = Colors.primary500;
    if (isPending) {
      cardAccentColor = pendingBorderColor;
    } else if (isInvitation) {
      cardAccentColor = invitationBorderColor;
    }
    const cardPadding = isCompactScreen ? 14 : 18;
    const sportLabel = item?.activities?.[0]?.name || item?.sport;
    const isLeagueCard = isLeagueMode;
    let stateLabel = '';
    if (isPending) {
      stateLabel = 'EN ATTENTE';
    } else if (isInvitation) {
      stateLabel = 'INVITATION';
    }

    const activityTag = sportLabel ? (
      <Tag
        style={{
          backgroundColor: `${Colors.primary500}14`,
          borderColor: Colors.primary500,
          maxWidth: isCompactScreen ? 96 : 128,
        }}
        text={sportLabel}
        textStyle={Fonts.p3Bold}
      />
    ) : null;

    let identityAvatar = isLeagueCard ? (
      <TeamShield
        initials={getClubInitials(item.name)}
        isGold
        size={80}
      />
    ) : (
      <ClubLogoMark
        club={item?.club}
        logoStyle={[
          ApplicationStyle.borderWidth1,
          ApplicationStyle.borderColor.primary500,
          { borderRadius: 16 },
        ]}
        name={item?.club?.name || item?.name}
        size={60}
      />
    );

    if (isLeagueCard && item.crest?.url) {
      identityAvatar = (
        <ProfileAvatar
          imageUrl={item.crest.url}
          shape="rounded"
          size={80}
          style={{
            backgroundColor: Colors.neutral00,
            borderColor: Colors.gold500,
            borderRadius: 20,
            borderWidth: 1,
          }}
          variant="logo"
        />
      );
    }

    const renderClassicContent = () => {
      const isSelfTrainer = Array.isArray(item?.trainers)
        && item.trainers.some(
          (/** @type {any} */ trainer) => trainer?.documentId === userData?.documentId,
        );
      const isSelfPlayer = Array.isArray(item?.players)
        && item.players.some(
          (/** @type {any} */ player) => player?.documentId === userData?.documentId,
        );
      let roleTagLabel = '';
      if (isSelfTrainer) {
        roleTagLabel = 'Coach';
      } else if (isSelfPlayer) {
        roleTagLabel = 'Joueur·se';
      }
      const memberCount = getTeamMemberCount(item);
      const metaLine = [
        sportLabel,
        item?.section?.name,
        item?.category?.name || item?.category,
        item?.level?.name || item?.level,
      ].filter(Boolean).join(' · ');
      const allSponsors = Array.isArray(item?.club?.sponsor) ? item.club.sponsor.filter(Boolean) : [];
      const sponsors = allSponsors.slice(0, 5);

      return (
        <>
          <View
            style={[
              Alignments.fullWidth,
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[12],
            ]}
          >
            <View>{identityAvatar}</View>
            <View style={[Alignments.fill, { minWidth: 0 }]}>
              <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                {item.name}
              </Text>
              {item?.club?.name ? (
                <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral300, { marginTop: 2 }]}>
                  {item.club.name}
                </Text>
              ) : null}
            </View>
            {roleTagLabel ? (
              <Tag
                style={{
                  backgroundColor: `${Colors.primary500}14`,
                  borderColor: Colors.primary500,
                }}
                text={roleTagLabel}
                textStyle={Fonts.p3Bold}
              />
            ) : null}
          </View>

          {metaLine ? (
            <Text
              numberOfLines={1}
              style={[Fonts.p3Bold, Fonts.primary200, Spaces.marginTop[12], Alignments.fullWidth]}
            >
              {metaLine}
            </Text>
          ) : null}

          <View
            style={[
              Alignments.fullWidth,
              Alignments.row,
              Alignments.alignCenter,
              Spaces.marginTop[12],
              Spaces.gap[12],
              {
                borderTopColor: 'rgba(255,255,255,0.08)',
                borderTopWidth: 1,
                paddingTop: 12,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, Fonts.neutral100]}>
              {`${memberCount} membre${memberCount > 1 ? 's' : ''}`}
            </Text>
          </View>

          {sponsors.length > 0 ? (
            <View style={[Alignments.fullWidth, Spaces.marginTop[12], Spaces.gap[8]]}>
              <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
                {sponsors.map((sponsor) => (
                  <SponsorLogoTile
                    borderRadius={16}
                    containerStyle={{ minWidth: isCompactScreen ? 86 : 94 }}
                    height={isCompactScreen ? 34 : 38}
                    imageUrl={sponsor?.logo?.url}
                    key={sponsor?.documentId || sponsor?.id || sponsor?.link || sponsor?.title}
                    link={sponsor?.link}
                    title={sponsor?.title || sponsor?.name}
                    titleLines={2}
                    titleStyle={[
                      Fonts.p4Bold,
                      Fonts.neutral100,
                      {
                        lineHeight: 14,
                        marginTop: 4,
                      },
                    ]}
                    width={isCompactScreen ? 86 : 94}
                  />
                ))}
              </View>
              {allSponsors.length > sponsors.length ? (
                <Text style={[Fonts.p3Bold, Fonts.primary100]}>
                  {`+${allSponsors.length - sponsors.length} autres sponsors`}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      );
    };

    const renderLeagueContent = () => (
      <View style={[Alignments.fullWidth, { flex: 1, position: 'relative' }]}>
        {stateLabel ? (
          <View
            style={{
              backgroundColor: `${cardAccentColor}20`,
              borderColor: cardAccentColor,
              borderRadius: 999,
              borderWidth: 1,
              left: 0,
              paddingHorizontal: 12,
              paddingVertical: 6,
              position: 'absolute',
              top: 0,
              zIndex: 2,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: cardAccentColor }]}>
              {stateLabel}
            </Text>
          </View>
        ) : null}
        <View style={{
          position: 'absolute', right: 0, top: 0, zIndex: 2,
        }}
        >
          {activityTag}
        </View>

        <View
          style={[
            Alignments.fullWidth,
            {
              alignItems: 'center',
              flex: 1,
              gap: 12,
              justifyContent: 'center',
              transform: [{ translateY: -10 }],
            },
          ]}
        >
          <View>{identityAvatar}</View>
          <View style={{ alignItems: 'center', width: '100%' }}>
            <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.h2, Fonts.neutral00, { textAlign: 'center' }]}>
              {item.name}
            </Text>
            <Text style={[Fonts.p3Bold, { color: Colors.gold500, marginTop: 4, textAlign: 'center' }]}>
              DIV
              {' '}
              {item.division || 5}
            </Text>
          </View>
        </View>
      </View>
    );

    if (isLeagueCard) {
      return (
        <View style={[{ height: 250, marginVertical: 12, position: 'relative' }]}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => handleTeamSelect(item)} style={{ flex: 1 }}>
            <LinearGradient
              colors={[`${Colors.primary200}33`, `${Colors.primary200}0A`, `${Colors.primary200}00`]}
              end={{ x: 1, y: 1 }}
              start={{ x: 0, y: 0 }}
              style={[
                ApplicationStyle.borderRadius24,
                {
                  flex: 1,
                  justifyContent: 'center',
                },
              ]}
            />

            <MaskedView
              maskElement={(
                <View
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: 'black',
                    borderRadius: 24,
                    borderWidth: 2,
                    height: '100%',
                    width: '100%',
                  }}
                />
              )}
              style={{
                height: '100%', left: 0, position: 'absolute', top: 0, width: '100%',
              }}
            >
              <LinearGradient
                colors={[Colors.primary500, Colors.gold500]}
                end={{ x: 1, y: 1 }}
                start={{ x: 0, y: 0 }}
                style={{ flex: 1 }}
              />
            </MaskedView>

            <View
              style={[
                {
                  height: '100%',
                  justifyContent: 'center',
                  padding: cardPadding,
                  position: 'absolute',
                  width: '100%',
                },
              ]}
            >
              {renderLeagueContent()}
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[{ position: 'relative' }]}>
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => handleTeamSelect(item)}
          style={[
            Spaces.marginVertical[12],
            {
              borderRadius: 24,
            },
          ]}
        >
          <View
            style={{
              backgroundColor: Colors.primary700,
              borderColor: cardAccentColor,
              borderRadius: 24,
              borderWidth: 1,
              justifyContent: 'center',
              minHeight: isCompactScreen ? 138 : 150,
              padding: cardPadding,
            }}
          >
            {renderClassicContent()}
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
    getClubInitials,
    handleTeamSelect,
    isCompactScreen,
    isLeagueMode,
    userData?.documentId,
  ]);

  const headerComponent = useMemo(() => (
    <View>
      {isLeagueMode ? (
        <View style={[Spaces.marginBottom[16], { flexDirection: 'row', gap: 10 }]}>
          <Button
            onPress={() => /** @type {any} */ (navigation).navigate(RouteNames.SquadSearch)}
            style={{ flex: 1 }}
            title="Rechercher une squad"
            variant="Secondary"
          />
        </View>
      ) : null}

      <View style={[Spaces.marginBottom[16]]}>
        <SearchComponent
          filterNumber={filterNumber}
          handleSearchField={setSearchValue}
          openFilters={handleOpenFilters}
          placeholder={t('teamList.searchPlaceholder', 'Mes équipes')}
          searchDefaultValue={searchValue || teamFilters?.name || ''}
        />
      </View>

      {invitedTeams.length > 0 ? (
        <View>
          <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16]]}>
            Invitations reçues
          </Text>
          {invitedTeams.map((team) => (
            <View key={`invited-${team.documentId}`}>
              {renderTeamCard(team, 'invited')}
            </View>
          ))}
        </View>
      ) : null}

      {pendingTeams.length > 0 ? (
        <View>
          <Text style={[
            Fonts.h3,
            Fonts.neutral00,
            Spaces.marginBottom[16],
            invitedTeams.length > 0 && Spaces.marginTop[24],
          ]}
          >
            Demandes en attente
          </Text>
          {pendingTeams.map((team) => (
            <View key={`pending-${team.documentId}`}>
              {renderTeamCard(team, 'pending')}
            </View>
          ))}
        </View>
      ) : null}

      {myTeams.length > 0 ? (
        <View>
          <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16], (pendingTeams.length > 0 || invitedTeams.length > 0) && Spaces.marginTop[24]]}>
            Mes équipes
          </Text>
          {myTeams.map((team) => (
            <View key={`joined-${team.documentId}`}>
              {renderTeamCard(team)}
            </View>
          ))}
        </View>
      ) : null}

      {otherTeams.length > 0 ? (
        <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[16], (myTeams.length > 0 || pendingTeams.length > 0 || invitedTeams.length > 0) && Spaces.marginTop[24]]}>
          {clubId ? 'Autres équipes du club' : 'Autres équipes'}
        </Text>
      ) : null}
    </View>
  ), [
    filterNumber,
    Fonts,
    Spaces,
    handleOpenFilters,
    clubId,
    invitedTeams,
    isLeagueMode,
    myTeams,
    navigation,
    otherTeams.length,
    pendingTeams,
    renderTeamCard,
    searchValue,
    teamFilters?.name,
    t,
  ]);

  const renderEmptyList = () => (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.borderRadius16,
        Alignments.alignCenter,
        Spaces.gap[32],
        Spaces.padding[24],
        Spaces.marginVertical[24],
      ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {shouldShowClubSearchCta
          ? t('teamList.noClubEmptyTitle', "Tu n'as pas encore d'équipe")
          : t('teamList.noData')}
      </Text>
      {shouldShowClubSearchCta ? (
        <>
          <Text style={[Fonts.p2, Fonts.neutral200, Fonts.textCenter, { lineHeight: 22 }]}>
            {t(
              'teamList.noClubEmptyDescription',
              'Recherche un club, ouvre sa fiche, puis demande à rejoindre une équipe.',
            )}
          </Text>
          <Button
            icon="search"
            iconPosition="after"
            onPress={handleOpenClubSearch}
            style={{ minWidth: 240 }}
            title={t('teamList.findTeamCta', 'Rechercher une équipe')}
            variant="Primary"
          />
        </>
      ) : null}
      {isLeagueMode ? (
        <Button
          onPress={() => /** @type {any} */ (navigation).navigate(RouteNames.SquadSearch)}
          style={{ minWidth: 220 }}
          title="Rechercher une squad"
          variant="Secondary"
        />
      ) : null}
    </View>
  );

  return (
    <View style={[Spaces.gap[40], Alignments.fill, { position: 'relative' }]}>
      <WithDataWrapper
        error={error}
        isLoading={isLoadingTeams && !isFetchingNextPage}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[Alignments.fill, ApplicationStyle.borderRadius2]}>
          <FlashList
            contentContainerStyle={{ paddingBottom: listBottomPadding }}
            data={otherTeams}
            estimatedItemSize={200}
            keyExtractor={(item) => item?.documentId || 'unknown'}
            ListEmptyComponent={
              myTeams.length === 0 && pendingTeams.length === 0 && invitedTeams.length === 0
                ? renderEmptyList
                : null
            }
            ListFooterComponent={renderNewTeamFooterCard}
            ListHeaderComponent={headerComponent}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={refetchTeams}
            refreshing={isLoadingTeams && !isFetchingNextPage}
            renderItem={({ item }) => renderTeamCard(item, false)}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {isLeagueMode ? (
          <WebFloatingOverlay
            style={getFloatingActionContainerStyle(floatingActionBottom, { zIndex: 1100 })}
          >
            <TouchableOpacity
              accessibilityLabel="Créer une squad"
              activeOpacity={0.85}
              onPress={() => /** @type {any} */ (navigation).navigate(
                RouteNames.TeamStack,
                { screen: RouteNames.CreateSquad },
              )}
              style={[
                ApplicationStyle.shadow200,
                {
                  alignItems: 'center',
                  backgroundColor: Colors.primary500,
                  borderColor: 'rgba(255,255,255,0.18)',
                  borderRadius: 32,
                  borderWidth: 1,
                  elevation: 8,
                  height: 64,
                  justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: {
                    height: 6,
                    width: 0,
                  },
                  shadowOpacity: 0.32,
                  shadowRadius: 12,
                  width: 64,
                },
              ]}
            >
              <Image
                resizeMode="contain"
                source={Images.strokeShield}
                style={{
                  height: 24,
                  tintColor: Colors.neutral00,
                  width: 24,
                }}
              />
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: Colors.primary200,
                  borderColor: 'rgba(255,255,255,0.36)',
                  borderRadius: 999,
                  borderWidth: 1,
                  height: 20,
                  justifyContent: 'center',
                  position: 'absolute',
                  right: 8,
                  top: 8,
                  width: 20,
                }}
              >
                <Image
                  resizeMode="contain"
                  source={Images.plus}
                  style={{
                    height: 10,
                    tintColor: Colors.primary900,
                    width: 10,
                  }}
                />
              </View>
            </TouchableOpacity>
          </WebFloatingOverlay>
        ) : null}
      </WithDataWrapper>

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </View>
  );
}

export default TeamListContent;
