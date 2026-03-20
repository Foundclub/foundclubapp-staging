import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { navigateToEndMatchScreen } from '@/views/league/match/utils/leagueNavigation';
import {
  getMatchDerivedPhase,
  getMatchStatusBadgeConfig,
  isVenueBookedForMatch,
  normalizeMatchStatus,
  shouldMaskOpponentIdentity,
} from '@/views/league/match/utils/matchStatus';

import { RouteNames } from '@/navigation/routeNames';

import {
  cancelMatch,
  confirmParticipation,
  declineParticipation,
  fetchMatch,
  markVenueBooked,
} from '@/services/league/leagueMatchService';
import { useGetLeagueMatchStats } from '@/services/matchStats/matchStatsQueries';

import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';

/**
 * @typedef {{navigation: any, route: {params: {matchId: string}}}} LeagueMatchDetailsProps
 */

const normalizeComparableText = (/** @type {unknown} */ value) => String(value || '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();
const resolveVenueLabel = (/** @type {LeagueMatch | null} */ match) => match?.venue || match?.proposed_venue || 'Lieu a definir';
const resolveAddressLabel = (/** @type {LeagueMatch | null} */ match) => match?.location?.address || match?.address || '';
const normalizePhoneCandidate = (/** @type {unknown} */ value) => String(value || '').replace(/[\s().-]/g, '');
const looksLikePhone = (/** @type {unknown} */ value) => /^\+?\d{8,15}$/.test(normalizePhoneCandidate(value));
const getParticipantDisplayName = (/** @type {User | null | undefined} */ participant) => {
  const firstName = participant?.firstname || participant?.firstName || '';
  const lastName = participant?.lastname || participant?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) return fullName;
  if (firstName) return firstName;
  if (lastName) return lastName;
  if (participant?.username && !looksLikePhone(participant.username)) return participant.username;
  return 'Joueur';
};

/**
 * @param {unknown} sportValue
 * @returns {number}
 */
const getRequiredPlayersForSport = (sportValue) => {
  const normalized = String(sportValue || '').trim().toLowerCase();
  if (normalized.includes('padel')) return 2;
  return 5;
};

/**
 * @param {LeagueMatchDetailsProps} props
 * @returns {import('react').ReactElement}
 */
function LeagueMatchDetails({ navigation, route }) {
  const { matchId } = route.params;
  const { Colors, Fonts, Images } = useTheme();
  const { userData } = /** @type {{ userData: User | null }} */ (useAuth());

  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(/** @type {LeagueMatch | null} */ (null));
  const [isMatchStatsPromptVisible, setIsMatchStatsPromptVisible] = useState(false);
  const [hasDismissedMatchStatsPrompt, setHasDismissedMatchStatsPrompt] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const userId = getEntityDocumentId(userData);

  const loadMatch = useCallback(async () => {
    try {
      const data = await fetchMatch(matchId);
      setMatch(data);
    } catch (error) {
      console.error('Error loading match:', error);
      Alert.alert('Erreur', 'Impossible de charger le match');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      loadMatch();
    }, [loadMatch]),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      loadMatch();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadMatch]);

  const isInTeamA = useMemo(() => {
    const rosterA = match?.team_a?.roster || [];
    const membersA = match?.team_a?.members || [];
    return (
      rosterA.some((/** @type {User} */ m) => areSameEntityId(getEntityDocumentId(m), userId))
      || membersA.some((/** @type {User} */ m) => areSameEntityId(getEntityDocumentId(m), userId))
      || areSameEntityId(getEntityDocumentId(match?.team_a?.captain), userId)
    );
  }, [match, userId]);

  const isInTeamB = useMemo(() => {
    const rosterB = match?.team_b?.roster || [];
    const membersB = match?.team_b?.members || [];
    return (
      rosterB.some((/** @type {User} */ m) => areSameEntityId(getEntityDocumentId(m), userId))
      || membersB.some((/** @type {User} */ m) => areSameEntityId(getEntityDocumentId(m), userId))
      || areSameEntityId(getEntityDocumentId(match?.team_b?.captain), userId)
    );
  }, [match, userId]);

  const teamSide = useMemo(() => {
    if (isInTeamA) return 'a';
    if (isInTeamB) return 'b';
    return null;
  }, [isInTeamA, isInTeamB]);
  const myTeam = useMemo(() => {
    if (teamSide === 'a') return match?.team_a || null;
    if (teamSide === 'b') return match?.team_b || null;
    return null;
  }, [match?.team_a, match?.team_b, teamSide]);
  const myTeamId = getEntityDocumentId(myTeam);

  const {
    data: leagueMatchStatsPayload,
    isFetching: isLeagueMatchStatsFetching,
    refetch: refetchLeagueMatchStats,
  } = useGetLeagueMatchStats(matchId, myTeamId || undefined, {
    enabled: Boolean(matchId && myTeamId && String(match?.status || '').toLowerCase() === 'valid'),
  });

  const isCaptainA = areSameEntityId(getEntityDocumentId(match?.team_a?.captain), userId);
  const isCaptainB = areSameEntityId(getEntityDocumentId(match?.team_b?.captain), userId);
  const isCaptain = isCaptainA || isCaptainB;

  const participations = teamSide === 'a' ? (match?.participations_a || []) : (match?.participations_b || []);
  const hasConfirmed = participations.some((/** @type {User} */ p) => areSameEntityId(getEntityDocumentId(p), userId));
  const participationCount = participations.length;
  const requiredPlayers = useMemo(() => getRequiredPlayersForSport(myTeam?.sport), [myTeam?.sport]);

  const normalizedStatus = useMemo(() => normalizeMatchStatus(match?.status), [match?.status]);
  const isVenueBooked = useMemo(() => isVenueBookedForMatch(match), [match]);
  const isAnonymous = useMemo(() => shouldMaskOpponentIdentity(match), [match]);
  const matchPhase = useMemo(() => getMatchDerivedPhase(match), [match]);
  const leagueStatsReport = leagueMatchStatsPayload?.report || null;
  const isLeagueStatsFinal = leagueStatsReport?.status === 'final';
  const isLeagueStatsReviewRequired = Boolean(leagueStatsReport?.needsReview);
  const isLeagueStatsCompleted = isLeagueStatsFinal && !isLeagueStatsReviewRequired;
  const canViewLeagueStats = Boolean(leagueMatchStatsPayload?.permissions?.canView || teamSide);
  const canManageLeagueStats = Boolean(leagueMatchStatsPayload?.permissions?.canManage || teamSide);
  const canSubmitScore = useMemo(
    () => isCaptain && ['disputed', 'pending_validation', 'waiting_score'].includes(matchPhase),
    [isCaptain, matchPhase],
  );
  const isScoreLockedByTime = useMemo(
    () => isCaptain && normalizedStatus === 'scheduled' && isVenueBooked && !canSubmitScore,
    [canSubmitScore, isCaptain, isVenueBooked, normalizedStatus],
  );

  const venueLabel = useMemo(() => resolveVenueLabel(match), [match]);
  const addressLabel = useMemo(() => resolveAddressLabel(match), [match]);
  const showAddressLine = useMemo(
    () => Boolean(addressLabel && normalizeComparableText(addressLabel) !== normalizeComparableText(venueLabel)),
    [addressLabel, venueLabel],
  );

  const formattedDate = useMemo(() => {
    if (!match?.date) return 'Date a definir';
    try {
      return format(new Date(match.date), "EEEE d MMMM 'a' HH'h'mm", { locale: fr });
    } catch (_error) {
      return match.date;
    }
  }, [match?.date]);

  const statusConfig = useMemo(() => getMatchStatusBadgeConfig(match, Colors), [Colors, match]);

  const eloPrediction = useMemo(() => {
    if (!match?.team_a?.elo || !match?.team_b?.elo) return null;
    const eloA = match.team_a.elo;
    const eloB = match.team_b.elo;
    const k = 32;
    const expectedA = 1 / (1 + 10 ** ((eloB - eloA) / 400));
    const winA = Math.round(k * (1 - expectedA));
    const lossA = Math.round(k * (0 - expectedA));
    return {
      lossA,
      lossB: -winA,
      winA,
      winB: -lossA,
    };
  }, [match]);

  const canShowCaptainPrimary = (canSubmitScore || isScoreLockedByTime) || (normalizedStatus === 'scheduled' && !isVenueBooked);
  const canShowCaptainCancel = normalizedStatus === 'scheduled';
  const hasBottomPresenceBar = Boolean(teamSide && normalizedStatus === 'scheduled');
  const scrollBottomPadding = useMemo(() => {
    if (!hasBottomPresenceBar) return 52;
    if (isCaptain && (canShowCaptainPrimary || canShowCaptainCancel)) return 320;
    return 250;
  }, [canShowCaptainCancel, canShowCaptainPrimary, hasBottomPresenceBar, isCaptain]);
  const isScoreToSubmitBadge = statusConfig.label === 'Score a saisir';
  const leagueStatsAction = useMemo(() => {
    if (normalizedStatus !== 'valid') {
      return {
        disabled: true,
        subtitle: 'Les stats seront disponibles une fois le score valide.',
        title: 'Stats bientot disponibles',
      };
    }

    if (isLeagueStatsReviewRequired) {
      return {
        disabled: false,
        subtitle: 'Le score officiel a change. Verifie puis republie cette version.',
        title: 'Mettre a jour apres score officiel',
      };
    }

    if (isLeagueStatsFinal) {
      return {
        disabled: false,
        subtitle: leagueStatsReport?.finalizedAt
          ? `Rapport finalise le ${new Date(leagueStatsReport.finalizedAt).toLocaleString('fr-FR')}`
          : 'Rapport finalise',
        title: 'Voir les stats du match',
      };
    }

    if (canManageLeagueStats) {
      return {
        disabled: false,
        subtitle: 'Temps de jeu et stats cles a completer pour ton equipe.',
        title: 'Saisir les stats du match',
      };
    }

    return {
      disabled: true,
      subtitle: 'Les membres de ton equipe peuvent encore finaliser ce rapport.',
      title: "En attente de l'equipe",
    };
  }, [
    canManageLeagueStats,
    isLeagueStatsFinal,
    isLeagueStatsReviewRequired,
    leagueStatsReport?.finalizedAt,
    normalizedStatus,
  ]);
  const leagueStatsSummaryText = useMemo(() => {
    if (isLeagueStatsReviewRequired) {
      return 'Le score officiel a change. Verification requise avant nouvelle publication.';
    }

    if (isLeagueStatsFinal) {
      return 'Le rapport stats de ton equipe est finalise.';
    }

    if (normalizedStatus !== 'valid') {
      return 'Les stats seront disponibles une fois le score valide.';
    }

    if (canManageLeagueStats) {
      return 'Complete les stats de ton equipe maintenant que le score est valide.';
    }

    return 'Les membres de ton equipe peuvent encore finaliser ce rapport.';
  }, [canManageLeagueStats, isLeagueStatsFinal, isLeagueStatsReviewRequired, normalizedStatus]);
  const leagueStatsStatusMeta = useMemo(() => {
    if (isLeagueStatsReviewRequired) {
      return {
        backgroundColor: `${Colors.warning500}20`,
        borderColor: `${Colors.warning500}45`,
        label: 'Verification requise',
        textColor: Colors.warning500,
      };
    }

    if (isLeagueStatsFinal) {
      return {
        backgroundColor: `${Colors.success500}20`,
        borderColor: `${Colors.success500}45`,
        label: 'Stats publiees',
        textColor: Colors.success500,
      };
    }

    if (normalizedStatus !== 'valid') {
      return {
        backgroundColor: `${Colors.gold500}20`,
        borderColor: `${Colors.gold500}45`,
        label: 'Score valide en attente',
        textColor: Colors.gold500,
      };
    }

    return {
      backgroundColor: `${Colors.primary500}20`,
      borderColor: `${Colors.primary500}45`,
      label: 'A finaliser',
      textColor: Colors.primary500,
    };
  }, [Colors.gold500, Colors.primary500, Colors.success500, Colors.warning500, isLeagueStatsFinal, isLeagueStatsReviewRequired, normalizedStatus]);
  const leagueStatsCardButtonTitle = useMemo(() => {
    if (isLeagueStatsReviewRequired) return 'Mettre a jour';
    if (isLeagueStatsCompleted) return 'Voir';
    return 'Ouvrir';
  }, [isLeagueStatsCompleted, isLeagueStatsReviewRequired]);

  const handleConfirmParticipation = async () => {
    if (!teamSide) return;
    setActionLoading(true);
    try {
      const result = await confirmParticipation(matchId, teamSide);
      Alert.alert('ConfirmÃƒÂ©', result.message || 'Presence confirmee');
      await loadMatch();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Ãƒâ€°chec confirmation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineParticipation = async () => {
    if (!teamSide) return;
    setActionLoading(true);
    try {
      await declineParticipation(matchId, teamSide);
      Alert.alert('Decline', 'Votre participation a ÃƒÂ©tÃƒÂ© annulÃƒÂ©e');
      await loadMatch();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Ãƒâ€°chec annulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkVenueBooked = async () => {
    setActionLoading(true);
    try {
      await markVenueBooked(matchId);
      Alert.alert('SuccÃƒÂ¨s', 'Terrain marque comme reserve');
      await loadMatch();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Impossible de mettre ÃƒÂ  jour le statut');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMatch = () => {
    Alert.alert(
      'Annuler le match ?',
      'Action irrÃƒÂ©versible. ÃƒÅ tes-vous sÃƒÂ»r ?',
      [
        { style: 'cancel', text: 'Non' },
        {
          onPress: async () => {
            setActionLoading(true);
            try {
              const targetTeamId = getEntityDocumentId(myTeam);
              if (!targetTeamId) {
                Alert.alert('Erreur', 'Ãƒâ€°quipe introuvable.');
                return;
              }
              await cancelMatch(matchId, targetTeamId, 'AnnulÃƒÂ© par le capitaine');
              Alert.alert('Match annulÃƒÂ©', 'Le match a ÃƒÂ©tÃƒÂ© annulÃƒÂ©.');
              navigation.goBack();
            } catch (_error) {
              Alert.alert('Erreur', 'Ãƒâ€°chec annulation');
            } finally {
              setActionLoading(false);
            }
          },
          style: 'destructive',
          text: 'Oui, annuler',
        },
      ],
    );
  };

  const handleOpenChat = () => {
    if (!match) return;
    const chatId = getEntityDocumentId(match?.chat);
    if (!chatId) return;
    navigation.navigate('Conversation', {
      chatId,
      title: `${match.team_a?.name} vs ${match.team_b?.name}`,
    });
  };

  const handleGoToScoreEntry = () => {
    if (isScoreLockedByTime) {
      Alert.alert(
        'Score indisponible',
        "Vous pourrez saisir le score une fois l'heure de dÃƒÂ©but du match dÃƒÂ©passÃƒÂ©e de 1 minute.",
      );
      return;
    }

    navigateToEndMatchScreen(navigation, matchId);
  };

  const handleOpenMatchStats = useCallback(() => {
    if (!myTeamId) return;

    navigation.navigate(RouteNames.MatchStatsEditor, {
      matchId,
      matchLabel: `${match?.team_a?.name || 'Equipe A'} VS ${match?.team_b?.name || 'Equipe B'}`,
      sourceType: 'league',
      sport: myTeam?.sport || match?.team_a?.sport || match?.team_b?.sport || 'football',
      teamId: myTeamId,
      teamName: myTeam?.name || null,
      title: 'Stats du match',
    });
  }, [match?.team_a?.name, match?.team_a?.sport, match?.team_b?.name, match?.team_b?.sport, matchId, myTeam?.name, myTeam?.sport, myTeamId, navigation]);

  useFocusEffect(
    useCallback(() => {
      setHasDismissedMatchStatsPrompt(false);
      return () => {
        setIsMatchStatsPromptVisible(false);
      };
    }, []),
  );

  useEffect(() => {
    if (!canManageLeagueStats || normalizedStatus !== 'valid' || isLeagueStatsCompleted) {
      setIsMatchStatsPromptVisible(false);
      return;
    }

    if (leagueMatchStatsPayload && !isLeagueMatchStatsFetching && !hasDismissedMatchStatsPrompt) {
      setIsMatchStatsPromptVisible(true);
    }
  }, [
    canManageLeagueStats,
    hasDismissedMatchStatsPrompt,
    isLeagueMatchStatsFetching,
    isLeagueStatsCompleted,
    leagueMatchStatsPayload,
    normalizedStatus,
  ]);

  const screenContainerStyle = useMemo(() => ({
    paddingHorizontal: 0,
  }), []);

  if (loading) {
    return (
      <ScreenContainer bgImage="bg2" style={[screenContainerStyle]}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary500} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!match) {
    return (
      <ScreenContainer bgImage="bg2" style={[screenContainerStyle]}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <HeaderBackButton
              borderColor="primary500"
              color="primary500"
              onPress={() => navigation.goBack()}
              style={styles.headerBackButton}
              withDefaultMargin={false}
            />
          </View>
          <Text style={[Fonts.h4, styles.headerTitle, { color: Colors.neutral100 }]}>DÃƒÂ©tails du match</Text>
          <View style={[styles.headerSide, styles.headerSideRight]} />
        </View>
        <View style={styles.centered}>
          <Text style={[Fonts.p1, { color: Colors.neutral500 }]}>Match introuvable</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bgImage="bg2" style={[screenContainerStyle]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <HeaderBackButton
              borderColor="primary500"
              color="primary500"
              onPress={() => navigation.goBack()}
              style={styles.headerBackButton}
              withDefaultMargin={false}
            />
          </View>
          <Text style={[Fonts.h3, styles.headerTitle, { color: Colors.gold500 }]}>DÃƒÂ©tails du match</Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            {match.chat ? (
              <TouchableOpacity onPress={handleOpenChat} style={styles.chatButton}>
                <Image source={Images.envelope} style={{ height: 18, tintColor: Colors.gold500, width: 18 }} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: scrollBottomPadding, paddingHorizontal: 16 }}
          refreshControl={(
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                if (myTeamId && normalizedStatus === 'valid') {
                  refetchLeagueMatchStats();
                }
                loadMatch();
              }}
              refreshing={refreshing}
              tintColor={Colors.primary500}
            />
          )}
        >
          <View style={styles.heroSection}>
            <View style={styles.teamColumn}>
              <TeamShield initials={String(match.team_a?.initials || match.team_a?.name || '?')} isGold size={80} />
              <Text style={[Fonts.h4, styles.teamName, { color: Colors.neutral00 }]}>{match.team_a?.name || 'Equipe A'}</Text>
            </View>

            <View style={styles.scoreColumn}>
              {match.score_a !== null && match.score_b !== null ? (
                <Text style={[Fonts.h1, { color: Colors.neutral00, fontSize: 32 }]}>
                  {match.score_a}
                  {' '}
                  -
                  {match.score_b}
                </Text>
              ) : (
                <Text style={[Fonts.h1, { color: Colors.gold500, fontSize: 24, fontStyle: 'italic' }]}>VS</Text>
              )}
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isScoreToSubmitBadge ? 'rgba(255, 215, 0, 0.18)' : statusConfig.bg,
                    borderColor: isScoreToSubmitBadge ? 'rgba(255, 215, 0, 0.45)' : 'transparent',
                    borderWidth: isScoreToSubmitBadge ? 1 : 0,
                  },
                ]}
              >
                <Text style={[Fonts.label, { color: statusConfig.color, textTransform: 'uppercase' }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>

            <View style={styles.teamColumn}>
              {isAnonymous ? (
                <>
                  <View style={[styles.mysteryShield, { borderColor: Colors.gold500 }]}>
                    <Text style={{ color: Colors.neutral200, fontSize: 30 }}>?</Text>
                  </View>
                  <Text style={[Fonts.h4, styles.teamName, { color: Colors.neutral500, fontStyle: 'italic' }]}>
                    MystÃƒÂ¨re
                  </Text>
                </>
              ) : (
                <>
                  <TeamShield initials={String(match.team_b?.initials || match.team_b?.name || '?')} isGold size={80} />
                  <Text style={[Fonts.h4, styles.teamName, { color: Colors.neutral00 }]}>{match.team_b?.name || 'Equipe B'}</Text>
                </>
              )}
            </View>
          </View>

          <LeagueCard isGold>
            <View style={styles.infoRow}>
              <Image source={Images.calendar} style={{ height: 20, tintColor: Colors.gold500, width: 20 }} />
              <Text style={[Fonts.p1, { color: Colors.neutral00, flex: 1, marginLeft: 12 }]}>
                {formattedDate}
              </Text>
            </View>
            <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />

            <View style={styles.infoRow}>
              <Image source={Images.pin} style={{ height: 20, tintColor: Colors.gold500, width: 20 }} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{venueLabel}</Text>
                {showAddressLine ? (
                  <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 4 }]}>
                    {addressLabel}
                  </Text>
                ) : null}
              </View>
            </View>

            {eloPrediction ? (
              <>
                <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                <View style={styles.eloContainer}>
                  <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 8, textAlign: 'center' }]}>
                    ENJEUX DU MATCH (ELO)
                  </Text>
                  <View style={styles.eloRow}>
                    <View style={styles.eloTeam}>
                      <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{match.team_a?.name}</Text>
                      <Text style={[Fonts.p1, { color: Colors.success500 }]}>
                        +
                        {eloPrediction.winA}
                        {' / '}
                        <Text style={{ color: Colors.error500 }}>{eloPrediction.lossA}</Text>
                      </Text>
                    </View>
                    <View style={[styles.verticalSep, { backgroundColor: 'rgba(255,255,255,0.16)' }]} />
                    <View style={styles.eloTeam}>
                      <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{isAnonymous ? '???' : match.team_b?.name}</Text>
                      <Text style={[Fonts.p1, { color: Colors.success500 }]}>
                        +
                        {eloPrediction.winB}
                        {' / '}
                        <Text style={{ color: Colors.error500 }}>{eloPrediction.lossB}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </LeagueCard>

          {canViewLeagueStats ? (
            <>
              <Text style={[Fonts.h4, styles.sectionTitle, { color: Colors.neutral100 }]}>
                Stats du match
              </Text>
              <LeagueCard>
                <View style={{ gap: 12 }}>
                  <View style={[styles.infoRow, { alignItems: 'flex-start' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 6 }]}>SUIVI POST-MATCH</Text>
                      <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
                        {leagueMatchStatsPayload?.score?.available
                          ? `${leagueMatchStatsPayload?.score?.scoreFor ?? '-'} - ${leagueMatchStatsPayload?.score?.scoreAgainst ?? '-'}`
                          : 'Score en attente'}
                      </Text>
                    </View>
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: leagueStatsStatusMeta.backgroundColor,
                        borderColor: leagueStatsStatusMeta.borderColor,
                        borderRadius: 999,
                        borderWidth: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={[Fonts.p4Bold, { color: leagueStatsStatusMeta.textColor }]}>
                        {leagueStatsStatusMeta.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
                    {leagueStatsSummaryText}
                  </Text>

                  {leagueStatsReport ? (
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <View
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 16,
                          flex: 1,
                          padding: 12,
                        }}
                      >
                        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Version</Text>
                        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                          {`v${Number(leagueStatsReport?.version || 1)}`}
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 16,
                          flex: 2,
                          padding: 12,
                        }}
                      >
                        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Publication</Text>
                        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                          {leagueStatsReport?.finalizedAt
                            ? new Date(leagueStatsReport.finalizedAt).toLocaleString('fr-FR')
                            : '-'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {isLeagueStatsReviewRequired ? (
                    <View
                      style={{
                        backgroundColor: `${Colors.warning500}14`,
                        borderColor: `${Colors.warning500}45`,
                        borderRadius: 16,
                        borderWidth: 1,
                        padding: 12,
                      }}
                    >
                      <Text style={[Fonts.p3, { color: Colors.warning400 }]}>
                        Le score officiel a change apres la premiere publication. Une mise a jour est requise.
                      </Text>
                    </View>
                  ) : null}

                  <Button
                    disabled={leagueStatsAction.disabled || isLeagueMatchStatsFetching}
                    onPress={handleOpenMatchStats}
                    size="small"
                    title={leagueStatsCardButtonTitle}
                    variant="Secondary"
                  />
                </View>
              </LeagueCard>
            </>
          ) : null}

          <Text style={[Fonts.h4, styles.sectionTitle, { color: Colors.neutral100 }]}>
            Compositions (
            {match.participations_a?.length || 0}
            {' '}
            vs
            {' '}
            {match.participations_b?.length || 0}
            )
          </Text>

          <LeagueCard>
            <View style={styles.compoRow}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 12 }]}>{match.team_a?.name}</Text>
                {(match.participations_a || []).map((/** @type {User} */ p, /** @type {number} */ i) => (
                  <View key={`${getEntityDocumentId(p) || i}-a`} style={styles.playerRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.gold500 }]} />
                    <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>{getParticipantDisplayName(p)}</Text>
                    {p.isCaptain ? <Text style={{ color: Colors.gold500, fontSize: 10, marginLeft: 4 }}>C</Text> : null}
                  </View>
                ))}
                {(!match.participations_a || match.participations_a.length === 0) ? (
                  <Text style={[Fonts.p2, { color: Colors.neutral500, fontStyle: 'italic' }]}>Aucun joueur</Text>
                ) : null}
              </View>

              <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', marginHorizontal: 16, width: 1 }} />

              <View style={{ flex: 1 }}>
                <Text style={[Fonts.label, { color: Colors.neutral300, marginBottom: 12 }]}>
                  {isAnonymous ? 'Adversaire' : match.team_b?.name}
                </Text>
                {isAnonymous ? (
                  <Text style={[Fonts.p2, { color: Colors.neutral500, fontStyle: 'italic' }]}>Masque</Text>
                ) : (
                  <>
                    {(match.participations_b || []).map((/** @type {User} */ p, /** @type {number} */ i) => (
                      <View key={`${getEntityDocumentId(p) || i}-b`} style={styles.playerRow}>
                        <View style={[styles.dot, { backgroundColor: Colors.neutral300 }]} />
                        <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>{getParticipantDisplayName(p)}</Text>
                      </View>
                    ))}
                    {(!match.participations_b || match.participations_b.length === 0) ? (
                      <Text style={[Fonts.p2, { color: Colors.neutral500, fontStyle: 'italic' }]}>Aucun joueur</Text>
                    ) : null}
                  </>
                )}
              </View>
            </View>
          </LeagueCard>

          {isCaptain && (canShowCaptainPrimary || canShowCaptainCancel) ? (
            <>
              <Text style={[Fonts.h4, styles.sectionTitle, { color: Colors.neutral100 }]}>
                Zone Capitaine
              </Text>
              <LeagueCard>
                {canSubmitScore || isScoreLockedByTime ? (
                  <Button
                    disabled={actionLoading}
                    onPress={handleGoToScoreEntry}
                    style={{
                      backgroundColor: isScoreLockedByTime ? 'rgba(255,255,255,0.08)' : Colors.primary500,
                      borderColor: isScoreLockedByTime ? 'rgba(255,255,255,0.2)' : Colors.primary500,
                      marginBottom: 12,
                    }}
                    textStyle={{ color: isScoreLockedByTime ? Colors.neutral300 : Colors.neutral00 }}
                    title={isScoreLockedByTime ? 'Score verrouillÃƒÂ© (avant dÃƒÂ©but + 1 min)' : 'Saisir le score final'}
                    variant="Primary"
                  />
                ) : null}
                {isScoreLockedByTime ? (
                  <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 12 }]}>
                    Le score sera disponible aprÃƒÂ¨s l&apos;heure de dÃƒÂ©but du match (+1 min).
                  </Text>
                ) : null}
                {normalizedStatus === 'scheduled' && !isVenueBooked ? (
                  <Button
                    disabled={actionLoading}
                    onPress={handleMarkVenueBooked}
                    style={{ backgroundColor: Colors.gold500, marginBottom: 10 }}
                    textStyle={{ color: Colors.primary900 }}
                    title="Marquer terrain reserve"
                    variant="Primary"
                  />
                ) : null}
                {canShowCaptainCancel ? (
                  <TouchableOpacity
                    disabled={actionLoading}
                    onPress={handleCancelMatch}
                    style={{ alignItems: 'center', paddingVertical: 6 }}
                  >
                    <Text style={[Fonts.p3Bold, { color: Colors.error500, textDecorationLine: 'underline' }]}>
                      Annuler le match
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </LeagueCard>
            </>
          ) : null}
        </ScrollView>

        {teamSide && normalizedStatus === 'scheduled' ? (
          <View style={styles.bottomBar}>
            <View style={styles.bottomBarContent}>
              {hasConfirmed ? (
                <View style={styles.confirmedRow}>
                  <Text style={[Fonts.p1, { color: Colors.success500 }]}>Presence confirmee</Text>
                  <Button
                    disabled={actionLoading}
                    onPress={handleDeclineParticipation}
                    size="small"
                    style={{ backgroundColor: 'transparent', borderColor: Colors.error500, minWidth: 132 }}
                    textStyle={{ color: Colors.error500 }}
                    title="Passer absent"
                    variant="Secondary"
                  />
                </View>
              ) : (
                <View style={styles.presenceActionsRow}>
                  <Button
                    disabled={actionLoading}
                    onPress={handleDeclineParticipation}
                    style={{ backgroundColor: 'transparent', borderColor: Colors.error500, flex: 1 }}
                    textStyle={{ color: Colors.error500 }}
                    title="Absent"
                    variant="Secondary"
                  />
                  <Button
                    disabled={actionLoading || participationCount >= requiredPlayers}
                    onPress={handleConfirmParticipation}
                    style={{ backgroundColor: Colors.gold500, flex: 1.35 }}
                    textStyle={{ color: Colors.primary900 }}
                    title={`Present (${participationCount}/${requiredPlayers})`}
                    variant="Primary"
                  />
                </View>
              )}
            </View>
          </View>
        ) : null}

        <BottomModal
          close={() => {
            setHasDismissedMatchStatsPrompt(true);
            setIsMatchStatsPromptVisible(false);
          }}
          isVisible={isMatchStatsPromptVisible}
          snapPoints={['40%']}
        >
          <View style={{ gap: 16, paddingBottom: 12 }}>
            <View style={{ gap: 4 }}>
              <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Stats de fin de match</Text>
              <Text style={[Fonts.p2, { color: Colors.neutral100 }]}>
                {isLeagueStatsReviewRequired
                  ? 'Le score officiel a change. Verifie les lignes puis republie ce rapport.'
                  : 'Le score est valide. Tu peux maintenant completer le temps de jeu et les stats cles de ton equipe.'}
              </Text>
            </View>

            <LeagueCard>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Equipe concernee</Text>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginTop: 6 }]}>
                {myTeam?.name || 'Mon equipe'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.gold500, marginTop: 6 }]}>
                {match?.team_a?.name || 'Equipe A'}
                {' VS '}
                {match?.team_b?.name || 'Equipe B'}
              </Text>
            </LeagueCard>

            <Button
              onPress={() => {
                setHasDismissedMatchStatsPrompt(true);
                setIsMatchStatsPromptVisible(false);
                handleOpenMatchStats();
              }}
              title={leagueStatsAction.title}
              variant="Primary"
            />
            <Button
              onPress={() => {
                setHasDismissedMatchStatsPrompt(true);
                setIsMatchStatsPromptVisible(false);
              }}
              title="Plus tard"
              variant="Secondary"
            />
          </View>
        </BottomModal>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    backgroundColor: 'rgba(10, 28, 43, 0.96)',
    borderTopColor: 'rgba(1, 179, 244, 0.25)',
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    paddingBottom: 30,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
  },
  bottomBarContent: {
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.42)',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  compoRow: {
    flexDirection: 'row',
  },
  confirmedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  dot: {
    borderRadius: 3,
    height: 6,
    marginRight: 8,
    width: 6,
  },
  eloContainer: {
    marginTop: 8,
  },
  eloRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  eloTeam: {
    alignItems: 'center',
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBackButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
  },
  headerSide: {
    alignItems: 'flex-start',
    minWidth: 42,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  heroSection: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 10,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  mysteryShield: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 40,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  playerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  presenceActionsRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  progressChip: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 70,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  progressChipDone: {
    backgroundColor: 'rgba(1, 179, 244, 0.14)',
    borderColor: 'rgba(1, 179, 244, 0.42)',
  },
  progressChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  progressChipText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    textAlign: 'center',
  },
  progressChipTodo: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  scoreColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '40%',
  },
  sectionTitle: {
    marginBottom: 12,
    marginTop: 24,
  },
  separator: {
    height: 1,
    marginVertical: 8,
    width: '100%',
  },
  statusBadge: {
    borderRadius: 4,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  teamColumn: {
    alignItems: 'center',
    width: '30%',
  },
  teamName: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  verticalSep: {
    height: 30,
    marginHorizontal: 16,
    width: 1,
  },
});

export default LeagueMatchDetails;
