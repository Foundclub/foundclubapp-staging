import React, { useCallback, useMemo, useState } from 'react';
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
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import ScreenContainer from '@/components/templates/ScreenContainer';
import useAuth from '@/domains/auth/useAuth';
import { RouteNames } from '@/navigation/routeNames';
import {
  cancelMatch,
  confirmParticipation,
  declineParticipation,
  fetchMatch,
  markVenueBooked,
} from '@/services/league/leagueMatchService';
import useTheme from '@/theme/themeContext';
import {
  canCaptainSubmitScore,
  getMatchStatusBadgeConfig,
  isMatchPastEnd,
  isVenueBookedForMatch,
  normalizeMatchStatus,
  shouldMaskOpponentIdentity,
} from '@/views/league/match/utils/matchStatus';

const normalizeId = (value) => (value === null || value === undefined ? '' : String(value));
const isSameId = (left, right) => normalizeId(left) !== '' && normalizeId(left) === normalizeId(right);
const normalizeComparableText = (value) => String(value || '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();
const resolveVenueLabel = (match) => match?.venue || match?.proposed_venue || 'Lieu a definir';
const resolveAddressLabel = (match) => match?.location?.address || match?.address || '';

function LeagueMatchDetails({ navigation, route }) {
  const { matchId } = route.params;
  const { Colors, Fonts, Images } = useTheme();
  const { userData } = useAuth();

  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const userId = userData?.documentId || userData?.id;

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
    }, [loadMatch])
  );

  const isInTeamA = useMemo(() => {
    const rosterA = match?.team_a?.roster || [];
    const membersA = match?.team_a?.members || [];
    return (
      rosterA.some((m) => isSameId(m.documentId || m.id, userId))
      || membersA.some((m) => isSameId(m.documentId || m.id, userId))
      || isSameId(match?.team_a?.captain?.documentId || match?.team_a?.captain?.id, userId)
    );
  }, [match, userId]);

  const isInTeamB = useMemo(() => {
    const rosterB = match?.team_b?.roster || [];
    const membersB = match?.team_b?.members || [];
    return (
      rosterB.some((m) => isSameId(m.documentId || m.id, userId))
      || membersB.some((m) => isSameId(m.documentId || m.id, userId))
      || isSameId(match?.team_b?.captain?.documentId || match?.team_b?.captain?.id, userId)
    );
  }, [match, userId]);

  const teamSide = isInTeamA ? 'a' : (isInTeamB ? 'b' : null);
  const myTeam = teamSide === 'a' ? match?.team_a : (teamSide === 'b' ? match?.team_b : null);

  const isCaptainA = isSameId(match?.team_a?.captain?.documentId || match?.team_a?.captain?.id, userId);
  const isCaptainB = isSameId(match?.team_b?.captain?.documentId || match?.team_b?.captain?.id, userId);
  const isCaptain = isCaptainA || isCaptainB;

  const participations = teamSide === 'a' ? (match?.participations_a || []) : (match?.participations_b || []);
  const hasConfirmed = participations.some((p) => isSameId(p.documentId || p.id, userId));
  const participationCount = participations.length;

  const normalizedStatus = useMemo(() => normalizeMatchStatus(match?.status), [match?.status]);
  const isVenueBooked = useMemo(() => isVenueBookedForMatch(match), [match]);
  const isAnonymous = useMemo(() => shouldMaskOpponentIdentity(match), [match]);
  const canSubmitScore = useMemo(
    () => canCaptainSubmitScore({ isCaptain, match }),
    [isCaptain, match]
  );
  const isScoreLockedByTime = useMemo(
    () => isCaptain && normalizedStatus === 'scheduled' && isVenueBooked && !isMatchPastEnd(match),
    [isCaptain, isVenueBooked, match, normalizedStatus]
  );

  const venueLabel = useMemo(() => resolveVenueLabel(match), [match]);
  const addressLabel = useMemo(() => resolveAddressLabel(match), [match]);
  const showAddressLine = useMemo(
    () => Boolean(addressLabel && normalizeComparableText(addressLabel) !== normalizeComparableText(venueLabel)),
    [addressLabel, venueLabel]
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
    const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
    const winA = Math.round(k * (1 - expectedA));
    const lossA = Math.round(k * (0 - expectedA));
    return {
      lossA,
      lossB: -winA,
      winA,
      winB: -lossA,
    };
  }, [match]);

  const matchEndedOrScored = useMemo(
    () => isMatchPastEnd(match) || ['pending_validation', 'disputed', 'valid', 'forfeit', 'no_show', 'cancelled'].includes(normalizedStatus),
    [match, normalizedStatus]
  );

  const progressSteps = useMemo(() => ([
    { done: true, key: 'found', label: 'Trouve' },
    { done: isVenueBooked || matchEndedOrScored, key: 'booked', label: 'Terrain reserve' },
    { done: matchEndedOrScored, key: 'played', label: 'Match joue' },
    { done: ['pending_validation', 'disputed', 'valid', 'forfeit', 'no_show', 'cancelled'].includes(normalizedStatus), key: 'result', label: 'Resultat' },
  ]), [isVenueBooked, matchEndedOrScored, normalizedStatus]);

  const canShowCaptainPrimary = (canSubmitScore || isScoreLockedByTime) || (normalizedStatus === 'scheduled' && !isVenueBooked);
  const canShowCaptainCancel = normalizedStatus === 'scheduled';
  const hasBottomPresenceBar = Boolean(teamSide && normalizedStatus === 'scheduled');
  const scrollBottomPadding = hasBottomPresenceBar
    ? ((isCaptain && (canShowCaptainPrimary || canShowCaptainCancel)) ? 320 : 250)
    : 52;
  const isScoreToSubmitBadge = statusConfig.label === 'Score a saisir';

  const handleConfirmParticipation = async () => {
    if (!teamSide) return;
    setActionLoading(true);
    try {
      const result = await confirmParticipation(matchId, teamSide);
      Alert.alert('Confirme', result.message || 'Presence confirmee');
      await loadMatch();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Echec confirmation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineParticipation = async () => {
    if (!teamSide) return;
    setActionLoading(true);
    try {
      await declineParticipation(matchId, teamSide);
      Alert.alert('Decline', 'Votre participation a ete annulee');
      await loadMatch();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Echec annulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkVenueBooked = async () => {
    setActionLoading(true);
    try {
      await markVenueBooked(matchId);
      Alert.alert('Succes', 'Terrain marque comme reserve');
      await loadMatch();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Impossible de mettre a jour le statut');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMatch = () => {
    Alert.alert(
      'Annuler le match ?',
      'Action irreversible. Etes-vous sur ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          onPress: async () => {
            setActionLoading(true);
            try {
              await cancelMatch(matchId, myTeam?.documentId, 'Annule par le capitaine');
              Alert.alert('Match annule', 'Le match a ete annule.');
              navigation.goBack();
            } catch (_error) {
              Alert.alert('Erreur', 'Echec annulation');
            } finally {
              setActionLoading(false);
            }
          },
          style: 'destructive',
          text: 'Oui, annuler',
        },
      ]
    );
  };

  const handleOpenChat = () => {
    if (!match?.chat?.documentId) return;
    navigation.navigate('Conversation', {
      chatId: match.chat.documentId,
      title: `${match.team_a?.name} vs ${match.team_b?.name}`,
    });
  };

  const handleGoToScoreEntry = () => {
    if (isScoreLockedByTime) {
      Alert.alert(
        'Score indisponible',
        "Vous pourrez saisir le score une fois l'heure de fin du match depassee."
      );
      return;
    }

    const params = { matchId };
    const currentRouteNames = navigation?.getState?.()?.routeNames || [];
    if (currentRouteNames.includes('EndMatchScreen')) {
      navigation.navigate('EndMatchScreen', params);
      return;
    }

    const parentNavigation = navigation?.getParent?.();
    const parentRouteNames = parentNavigation?.getState?.()?.routeNames || [];
    if (parentRouteNames.includes('EndMatchScreen')) {
      parentNavigation.navigate('EndMatchScreen', params);
      return;
    }
    if (parentRouteNames.includes(RouteNames.LeagueDashboard)) {
      parentNavigation.navigate(RouteNames.LeagueDashboard, {
        params,
        screen: 'EndMatchScreen',
      });
      return;
    }

    navigation.navigate(RouteNames.LeagueHomeTab, {
      params: {
        params,
        screen: 'EndMatchScreen',
      },
      screen: RouteNames.LeagueDashboard,
    });
  };

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
          <Text style={[Fonts.h4, styles.headerTitle, { color: Colors.neutral100 }]}>Details du match</Text>
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
          <Text style={[Fonts.h3, styles.headerTitle, { color: Colors.gold500 }]}>Details du match</Text>
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
                loadMatch();
              }}
              refreshing={refreshing}
              tintColor={Colors.primary500}
            />
          )}
        >
          <View style={styles.heroSection}>
            <View style={styles.teamColumn}>
              <TeamShield initials={match.team_a?.initials || match.team_a?.name || '?'} size={80} />
              <Text style={[Fonts.h4, styles.teamName, { color: Colors.neutral00 }]}>{match.team_a?.name || 'Equipe A'}</Text>
            </View>

            <View style={styles.scoreColumn}>
              {match.score_a !== null && match.score_b !== null ? (
                <Text style={[Fonts.h1, { color: Colors.neutral00, fontSize: 32 }]}>
                  {match.score_a} - {match.score_b}
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
                    <Text style={{ color: Colors.neutral200, fontSize: 30 }}>{'?'}</Text>
                  </View>
                  <Text style={[Fonts.h4, styles.teamName, { color: Colors.neutral500, fontStyle: 'italic' }]}>
                    Mystère
                  </Text>
                </>
              ) : (
                <>
                  <TeamShield initials={match.team_b?.initials || match.team_b?.name || '?'} isNeutral={true} size={80} />
                  <Text style={[Fonts.h4, styles.teamName, { color: Colors.neutral00 }]}>{match.team_b?.name || 'Equipe B'}</Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.progressChipsRow}>
            {progressSteps.map((step) => (
              <View
                key={step.key}
                style={[
                  styles.progressChip,
                  step.done ? styles.progressChipDone : styles.progressChipTodo,
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.progressChipText,
                    { color: step.done ? Colors.primary500 : Colors.neutral300 },
                  ]}
                >
                  {step.label}
                </Text>
              </View>
            ))}
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
              <Image source={Images.location} style={{ height: 20, tintColor: Colors.gold500, width: 20 }} />
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
                        +{eloPrediction.winA}
                        {' / '}
                        <Text style={{ color: Colors.error500 }}>{eloPrediction.lossA}</Text>
                      </Text>
                    </View>
                    <View style={[styles.verticalSep, { backgroundColor: 'rgba(255,255,255,0.16)' }]} />
                    <View style={styles.eloTeam}>
                      <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{isAnonymous ? '???' : match.team_b?.name}</Text>
                      <Text style={[Fonts.p1, { color: Colors.success500 }]}>
                        +{eloPrediction.winB}
                        {' / '}
                        <Text style={{ color: Colors.error500 }}>{eloPrediction.lossB}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </LeagueCard>

          <Text style={[Fonts.h4, styles.sectionTitle, { color: Colors.neutral100 }]}>
            Compositions ({match.participations_a?.length || 0} vs {match.participations_b?.length || 0})
          </Text>

          <LeagueCard>
            <View style={styles.compoRow}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 12 }]}>{match.team_a?.name}</Text>
                {(match.participations_a || []).map((p, i) => (
                  <View key={`${p.documentId || p.id || i}-a`} style={styles.playerRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.gold500 }]} />
                    <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>{p.firstName || p.username}</Text>
                    {p.isCaptain ? <Text style={{ color: Colors.gold500, fontSize: 10, marginLeft: 4 }}>{'C'}</Text> : null}
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
                    {(match.participations_b || []).map((p, i) => (
                      <View key={`${p.documentId || p.id || i}-b`} style={styles.playerRow}>
                        <View style={[styles.dot, { backgroundColor: Colors.neutral300 }]} />
                        <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>{p.firstName || p.username}</Text>
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
                    title={isScoreLockedByTime ? 'Score verrouille (match en cours)' : 'Saisir le score final'}
                    variant="Primary"
                  />
                ) : null}
                {isScoreLockedByTime ? (
                  <Text style={[Fonts.p3, { color: Colors.neutral300, marginBottom: 12 }]}>
                    Le score sera disponible apres l'heure de fin du match.
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
                <Text style={[Fonts.p1, { color: Colors.success500 }]}>{'Presence confirmee'}</Text>
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
                  disabled={actionLoading || participationCount >= 5}
                  onPress={handleConfirmParticipation}
                  style={{ backgroundColor: Colors.gold500, flex: 1.35 }}
                  textStyle={{ color: Colors.primary900 }}
                  title={`Présent (${participationCount}/5)`}
                  variant="Primary"
                />
              </View>
            )}
            </View>
          </View>
        ) : null}
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
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
