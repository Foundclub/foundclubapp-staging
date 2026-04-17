import { useNavigation, useRoute } from '@react-navigation/native';
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
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';
import { getProposalLocationLabel } from '@/views/league/match/utils/proposalPayload';

import { RouteNames } from '@/navigation/routeNames';

import { getMatch, requestRematch } from '@/services/league/leagueMatchService';

import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';
import { getImageUrl } from '@/utils/imageUrl';

/**
 * @param {unknown} value
 * @returns {string}
 */
const normalizeComparableText = (value) => String(value || '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

/**
 * @param {LeagueMatch | null} match
 * @returns {string}
 */
const resolveVenueLabel = (match) => (
  getProposalLocationLabel(match?.venue)
    || getProposalLocationLabel(match?.proposed_venue)
    || 'Lieu \u00E0 d\u00E9finir'
);

/**
 * @param {LeagueMatch | null} match
 * @returns {string}
 */
const resolveAddressLabel = (match) => (
  getProposalLocationLabel(match?.location?.address)
    || getProposalLocationLabel(match?.address)
    || ''
);

/**
 * @returns {import('react').ReactElement}
 */
function PastMatchDetails() {
  const { Colors, Fonts, Images } = useTheme();
  const leagueCardTextColor = Colors.primary500;
  const leagueAccentSurface = 'rgba(1, 179, 244, 0.12)';
  const leagueGoldSurface = 'rgba(255, 215, 0, 0.08)';
  const route = /** @type {any} */ (useRoute());
  const navigation = /** @type {any} */ (useNavigation());
  const { userData } = /** @type {{ userData: User | null }} */ (useAuth());

  const routeParams = /** @type {{ matchId?: string | number, myTeamId?: string | number } | undefined } */ (
    route.params
  );
  const matchId = routeParams?.matchId ? String(routeParams.matchId) : '';
  const myTeamId = routeParams?.myTeamId ? String(routeParams.myTeamId) : '';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [match, setMatch] = useState(/** @type {LeagueMatch | null} */ (null));
  const [refreshing, setRefreshing] = useState(false);
  const [requestingRematch, setRequestingRematch] = useState(false);

  const loadMatch = useCallback(async () => {
    if (!matchId) {
      setLoadError("Aucun match n'est associe a ce lien.");
      setMatch(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoadError('');
      const data = await getMatch(matchId);
      setMatch(/** @type {LeagueMatch | null} */ (data || null));
    } catch (error) {
      console.error('Error loading match:', error);
      setMatch(null);
      setLoadError(error?.message || 'Impossible de charger le match termine.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [matchId]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  const currentUserId = getEntityDocumentId(userData);

  const teamA = match?.team_a;
  const teamB = match?.team_b;
  const teamAId = getEntityDocumentId(teamA);

  const isUserInTeamA = useMemo(() => {
    if (!teamA || !currentUserId) return false;
    return areSameEntityId(getEntityDocumentId(teamA?.captain), currentUserId)
      || (teamA?.roster || []).some(
        (/** @type {User} */ member) => areSameEntityId(getEntityDocumentId(member), currentUserId),
      );
  }, [currentUserId, teamA]);

  const isTeamA = useMemo(() => {
    if (myTeamId) return areSameEntityId(teamAId, myTeamId);
    return isUserInTeamA;
  }, [isUserInTeamA, myTeamId, teamAId]);

  const myTeam = isTeamA ? teamA : teamB;
  const opponent = isTeamA ? teamB : teamA;

  const myScore = isTeamA ? match?.score_a : match?.score_b;
  const oppScore = isTeamA ? match?.score_b : match?.score_a;
  const myScoreValue = Number.isFinite(Number(myScore)) ? Number(myScore) : 0;
  const oppScoreValue = Number.isFinite(Number(oppScore)) ? Number(oppScore) : 0;

  const resultConfig = useMemo(() => {
    if (myScoreValue > oppScoreValue) {
      return {
        borderColor: 'rgba(39, 214, 163, 0.55)',
        chipBg: 'rgba(39, 214, 163, 0.2)',
        color: Colors.success500,
        label: 'VICTOIRE',
      };
    }

    if (myScoreValue < oppScoreValue) {
      return {
        borderColor: 'rgba(255, 40, 79, 0.55)',
        chipBg: 'rgba(255, 40, 79, 0.2)',
        color: Colors.error500,
        label: 'DEFAITE',
      };
    }

    return {
      borderColor: 'rgba(255, 161, 21, 0.55)',
      chipBg: 'rgba(255, 161, 21, 0.2)',
      color: Colors.warning500,
      label: 'MATCH NUL',
    };
  }, [Colors.error500, Colors.success500, Colors.warning500, myScoreValue, oppScoreValue]);

  const formattedDate = useMemo(() => {
    if (!match?.date) return 'Date inconnue';
    try {
      return format(new Date(match.date), "EEEE d MMMM yyyy 'a' HH'h'mm", { locale: fr });
    } catch (_error) {
      return match.date;
    }
  }, [match?.date]);

  const venueLabel = useMemo(() => resolveVenueLabel(match), [match]);
  const addressLabel = useMemo(() => resolveAddressLabel(match), [match]);
  const showAddressLine = useMemo(
    () => Boolean(addressLabel && normalizeComparableText(addressLabel) !== normalizeComparableText(venueLabel)),
    [addressLabel, venueLabel],
  );
  const teamContextMeta = useMemo(() => (isTeamA
    ? {
      backgroundColor: 'rgba(1, 179, 244, 0.16)',
      borderColor: 'rgba(1, 179, 244, 0.35)',
      label: 'DOMICILE',
      textColor: Colors.primary500,
    }
    : {
      backgroundColor: 'rgba(255, 215, 0, 0.12)',
      borderColor: 'rgba(255, 215, 0, 0.28)',
      label: 'EXTERIEUR',
      textColor: Colors.gold500,
    }), [Colors.gold500, Colors.primary500, isTeamA]);

  const eloInfo = useMemo(() => {
    const current = Number(myTeam?.elo || 1200);
    const opponentElo = Number(opponent?.elo || 1200);
    const expectedWin = 1 / (1 + 10 ** ((opponentElo - current) / 400));
    let actualScore = 0.5;
    if (myScoreValue > oppScoreValue) actualScore = 1;
    if (myScoreValue < oppScoreValue) actualScore = 0;
    const delta = Math.round(32 * (actualScore - expectedWin));

    return {
      after: current,
      before: current - delta,
      delta,
    };
  }, [myScoreValue, myTeam?.elo, oppScoreValue, opponent?.elo]);

  const resultSummaryText = useMemo(() => {
    if (myScoreValue > oppScoreValue) return 'Tu remportes ce duel League.';
    if (myScoreValue < oppScoreValue) return 'Le match a bascule du cote adverse.';
    return 'Les deux \u00E9quipes repartent dos \u00E0 dos.';
  }, [myScoreValue, oppScoreValue]);

  const canRematch = useMemo(() => {
    const isCaptain = areSameEntityId(getEntityDocumentId(myTeam?.captain), currentUserId);
    return Boolean(isCaptain && match?.status === 'valid');
  }, [currentUserId, match?.status, myTeam?.captain]);

  const renderSectionHeader = useCallback((title, accentColor = leagueCardTextColor) => (
    <View style={styles.sectionHeaderRow}>
      <View style={[styles.sectionHeaderDot, { backgroundColor: accentColor }]} />
      <Text style={[Fonts.h4, styles.sectionHeaderText, { color: accentColor }]}>{title}</Text>
      <View style={[styles.sectionHeaderLine, { backgroundColor: `${accentColor}33` }]} />
    </View>
  ), [Fonts.h4, leagueCardTextColor]);

  const handleRematch = () => {
    const myTeamDocId = getEntityDocumentId(myTeam);
    const opponentDocId = getEntityDocumentId(opponent);

    if (!myTeamDocId || !opponentDocId) {
      Alert.alert('Erreur', 'Impossible de lancer la revanche pour ce match.');
      return;
    }

    Alert.alert(
      'Demander une revanche',
      `Voulez-vous demander une revanche contre ${opponent?.name || 'cette \u00E9quipe'} ?`,
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: async () => {
            setRequestingRematch(true);
            try {
              const result = await requestRematch(myTeamDocId, opponentDocId, matchId);
              Alert.alert(
                result?.matched ? 'Match cr\u00E9\u00E9' : 'Demande envoy\u00E9e',
                result?.message || 'Votre demande a bien \u00E9t\u00E9 envoy\u00E9e.',
              );
              if (result?.matched) {
                navigation.goBack();
              }
            } catch (_error) {
              Alert.alert('Erreur', 'Impossible de demander une revanche');
            } finally {
              setRequestingRematch(false);
            }
          },
          text: 'Oui, revanche',
        },
      ],
    );
  };

  if (loading) {
    return (
      <ScreenContainer bgImage="bg2" style={[styles.screenContainer]}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.centered}>
            <ActivityIndicator color={Colors.primary500} size="large" />
          </View>
        </SafeAreaView>
      </ScreenContainer>
    );
  }

  if (loadError && !match) {
    return (
      <LeagueStateView
        actionLabel="Recharger"
        description={loadError}
        onAction={() => {
          setLoading(true);
          loadMatch();
        }}
        title="Chargement impossible"
      />
    );
  }

  if (!match) {
    return (
      <LeagueStateView
        actionLabel="Retour au dashboard"
        description="Ce match termine n'est plus accessible depuis ce lien."
        onAction={() => navigation.navigate(RouteNames.LeagueDashboard)}
        title="Match introuvable"
      />
    );
  }

  const goalsByPlayer = /** @type {Array<[string, number]>} */ (
    match?.player_goals && typeof match.player_goals === 'object'
      ? Object.entries(match.player_goals)
      : []
  );

  return (
    <ScreenContainer bgImage="bg2" style={[styles.screenContainer]}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerBar}>
          <View style={styles.headerSide}>
            <HeaderBackButton
              borderColor="primary500"
              color="primary500"
              onPress={() => navigation.goBack()}
              style={styles.headerBackButton}
              withDefaultMargin={false}
            />
          </View>
          <Text style={[Fonts.h3, styles.headerTitle, { color: Colors.gold500 }]}>Match termine</Text>
          <View style={styles.headerSide} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={(
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                loadMatch();
              }}
              refreshing={refreshing}
              tintColor={Colors.primary500}
            />
          )}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.resultBadge,
              {
                backgroundColor: resultConfig.chipBg,
                borderColor: resultConfig.borderColor,
              },
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: resultConfig.color, letterSpacing: 0.8 }]}>
              {resultConfig.label}
            </Text>
            <Text style={[Fonts.p4, { color: leagueCardTextColor, marginTop: 6, textAlign: 'center' }]}>
              {resultSummaryText}
            </Text>
          </View>

          <LeagueCard isGold style={styles.scoreCard}>
            <View style={styles.matchupRow}>
              <View style={styles.teamBlock}>
                <TeamShield initials={teamA?.name?.substring(0, 2) || 'A'} isGold size={62} />
                <Text numberOfLines={1} style={[Fonts.p2Bold, styles.teamName, { color: Colors.neutral100 }]}>
                  {teamA?.name || '\u00C9quipe A'}
                </Text>
              </View>

              <View
                style={[
                  styles.scoreHeroCard,
                  {
                    backgroundColor: resultConfig.chipBg,
                    borderColor: resultConfig.borderColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.heroContextPill,
                    {
                      backgroundColor: teamContextMeta.backgroundColor,
                      borderColor: teamContextMeta.borderColor,
                    },
                  ]}
                >
                  <Text style={[Fonts.label, { color: teamContextMeta.textColor }]}>
                    {teamContextMeta.label}
                  </Text>
                </View>
                <View style={styles.scoreBlock}>
                  <Text style={[Fonts.h1Bold, { color: Colors.neutral00 }]}>{match?.score_a ?? '-'}</Text>
                  <Text style={[Fonts.h2, { color: Colors.neutral300, marginHorizontal: 10 }]}>-</Text>
                  <Text style={[Fonts.h1Bold, { color: Colors.neutral00 }]}>{match?.score_b ?? '-'}</Text>
                </View>
                <Text style={[Fonts.p4Bold, { color: resultConfig.color, marginTop: 8 }]}>Score officialise</Text>
              </View>

              <View style={styles.teamBlock}>
                {opponent?.crest?.url ? (
                  <Image source={{ uri: getImageUrl(opponent.crest.url) }} style={styles.opponentCrest} />
                ) : (
                  <TeamShield initials={teamB?.name?.substring(0, 2) || 'B'} isGold size={62} />
                )}
                <Text numberOfLines={1} style={[Fonts.p2Bold, styles.teamName, { color: Colors.neutral100 }]}>
                  {teamB?.name || '\u00C9quipe B'}
                </Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.infoStack}>
              <View
                style={[
                  styles.infoPill,
                  {
                    backgroundColor: leagueGoldSurface,
                    borderColor: 'rgba(255, 215, 0, 0.18)',
                  },
                ]}
              >
                <View style={[styles.infoIconWrap, { backgroundColor: 'rgba(255, 215, 0, 0.14)' }]}>
                  <Image source={Images.calendar} style={[styles.infoIcon, { tintColor: Colors.gold500 }]} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={[Fonts.p4Bold, { color: Colors.gold500, marginBottom: 4 }]}>Date et heure</Text>
                  <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>{formattedDate}</Text>
                </View>
              </View>

              <View
                style={[
                  styles.infoPill,
                  {
                    backgroundColor: leagueAccentSurface,
                    borderColor: 'rgba(1, 179, 244, 0.18)',
                  },
                ]}
              >
                <View style={[styles.infoIconWrap, { backgroundColor: 'rgba(1, 179, 244, 0.14)' }]}>
                  <Image source={Images.pin} style={[styles.infoIcon, { tintColor: Colors.primary500 }]} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={[Fonts.p4Bold, { color: leagueCardTextColor, marginBottom: 4 }]}>Lieu du match</Text>
                  <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>{venueLabel}</Text>
                  {showAddressLine ? (
                    <Text style={[Fonts.p4, { color: leagueCardTextColor, marginTop: 4 }]}>{addressLabel}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          </LeagueCard>

          {renderSectionHeader('Impact ELO')}
          <LeagueCard style={styles.eloCard}>
            <View style={styles.eloRow}>
              <View
                style={[
                  styles.eloCol,
                  styles.eloStatCard,
                  {
                    backgroundColor: leagueAccentSurface,
                    borderColor: 'rgba(1, 179, 244, 0.22)',
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: leagueCardTextColor }]}>Avant</Text>
                <Text style={[Fonts.h3, { color: Colors.neutral100, marginTop: 6 }]}>{eloInfo.before}</Text>
              </View>

              <View
                style={[
                  styles.eloDelta,
                  {
                    backgroundColor: resultConfig.chipBg,
                    borderColor: resultConfig.borderColor,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: leagueCardTextColor, marginBottom: 4 }]}>Delta</Text>
                <Text style={[Fonts.h3, { color: resultConfig.color }]}>
                  {eloInfo.delta > 0 ? '+' : ''}
                  {eloInfo.delta}
                </Text>
              </View>

              <View
                style={[
                  styles.eloCol,
                  styles.eloStatCard,
                  {
                    backgroundColor: leagueGoldSurface,
                    borderColor: 'rgba(255, 215, 0, 0.22)',
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>Apres</Text>
                <Text style={[Fonts.h3, { color: Colors.neutral100, marginTop: 6 }]}>{eloInfo.after}</Text>
              </View>
            </View>
          </LeagueCard>

          {goalsByPlayer.length > 0 ? (
            <>
              {renderSectionHeader('Buteurs', Colors.gold500)}
              <LeagueCard style={styles.goalsCard}>
                {goalsByPlayer.map(([playerId, goals], index) => (
                  <View
                    key={playerId}
                    style={[
                      styles.goalRow,
                      {
                        borderBottomColor: 'rgba(255,255,255,0.09)',
                        borderBottomWidth: index === goalsByPlayer.length - 1 ? 0 : 1,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p3, { color: leagueCardTextColor, flex: 1 }]}>
                      Joueur
                      {' '}
                      {playerId.slice(0, 8)}
                      ...
                    </Text>
                    <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>{goals}</Text>
                  </View>
                ))}
              </LeagueCard>
            </>
          ) : null}

          {canRematch ? (
            <Button
              disabled={requestingRematch}
              icon="flag"
              iconColor={Colors.primary900}
              iconPosition="before"
              isLoading={requestingRematch}
              onPress={handleRematch}
              style={{ backgroundColor: Colors.gold500, marginTop: 6 }}
              textStyle={{ color: Colors.primary900 }}
              title="Demander une revanche"
              variant="Primary"
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardDivider: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    height: 1,
    marginBottom: 12,
    marginTop: 14,
    width: '100%',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  eloCard: {
    marginBottom: 6,
  },
  eloCol: {
    alignItems: 'center',
    flex: 1,
  },
  eloDelta: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 92,
    minWidth: 84,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  eloRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  eloStatCard: {
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 92,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  goalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  goalsCard: {
    marginTop: 0,
  },
  headerBackButton: {
    marginLeft: 0,
  },
  headerBar: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerSide: {
    alignItems: 'flex-start',
    minWidth: 42,
  },
  headerTitle: {
    flex: 1,
    letterSpacing: 0.8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  heroContextPill: {
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  infoIcon: {
    height: 16,
    width: 16,
  },
  infoIconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  infoPill: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  infoStack: {
    gap: 10,
  },
  infoTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  matchupRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  opponentCrest: {
    height: 62,
    resizeMode: 'contain',
    width: 62,
  },
  resultBadge: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  safeArea: {
    flex: 1,
  },
  scoreBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: 116,
  },
  scoreCard: {
    marginBottom: 10,
  },
  scoreHeroCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 132,
    paddingHorizontal: 12,
    paddingVertical: 14,
    width: '40%',
  },
  screenContainer: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: 44,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionHeaderDot: {
    borderRadius: 999,
    height: 10,
    marginRight: 10,
    width: 10,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    marginLeft: 12,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
    marginTop: 24,
  },
  sectionHeaderText: {
    letterSpacing: 0.4,
  },
  teamBlock: {
    alignItems: 'center',
    flex: 1,
  },
  teamName: {
    marginTop: 8,
    textAlign: 'center',
  },
});

export default PastMatchDetails;
