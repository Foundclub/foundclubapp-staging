import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import useTheme from '@/theme/themeContext';
import useAuth from '@/domains/auth/useAuth';
import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueCard from '@/components/atoms/league/LeagueCard';

import {
  fetchMatch,
  confirmParticipation,
  declineParticipation,
  markVenueBooked,
  cancelMatch,
} from '@/services/league/leagueMatchService';

const LeagueMatchDetails = ({ navigation, route }) => {
  const { matchId } = route.params;
  const { Colors, Fonts, Images } = useTheme();
  const { userData } = useAuth();
  
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Determine user context
  const userId = userData?.documentId || userData?.id;
  
  const loadMatch = useCallback(async () => {
    try {
      const data = await fetchMatch(matchId);
      setMatch(data);
    } catch (err) {
      console.error('Error loading match:', err);
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

  // --- Derived State ---
  const isInTeamA = useMemo(() => match?.team_a?.members?.some(m => m.documentId === userId || m.id === userId) ||
                    match?.team_a?.captain?.documentId === userId, [match, userId]);

  const isInTeamB = useMemo(() => match?.team_b?.members?.some(m => m.documentId === userId || m.id === userId) ||
                    match?.team_b?.captain?.documentId === userId, [match, userId]);

  const teamSide = isInTeamA ? 'a' : (isInTeamB ? 'b' : null);
  const myTeam = teamSide === 'a' ? match?.team_a : (teamSide === 'b' ? match?.team_b : null);
  
  const isCaptainA = match?.team_a?.captain?.documentId === userId;
  const isCaptainB = match?.team_b?.captain?.documentId === userId;
  const isCaptain = isCaptainA || isCaptainB;

  const participations = teamSide === 'a' ? match?.participations_a : match?.participations_b;
  const hasConfirmed = participations?.some(p => p.documentId === userId || p.id === userId);
  const participationCount = participations?.length || 0;

  const isVenueBooked = match?.venueBooked;
  const isAnonymous = !isVenueBooked && match?.status === 'scheduled';

  // Format date
  const formattedDate = useMemo(() => {
    if (!match?.date) return 'Date à définir';
    try {
      return format(new Date(match.date), "EEEE d MMMM 'à' HH'h'mm", { locale: fr });
    } catch {
      return match.date;
    }
  }, [match?.date]);

  // Status badge config
  const statusConfig = useMemo(() => {
    if (!match) return {};
    if (match.status === 'scheduled' && !match.venueBooked) {
        return { label: 'En attente terrain', color: Colors.warning500 || '#f59e0b', bg: (Colors.warning500 || '#f59e0b') + '20' };
    }
    const map = {
      scheduled: { label: 'Programmé', color: Colors.primary500, bg: Colors.primary500 + '20' },
      pending_validation: { label: 'En attente', color: Colors.warning500, bg: Colors.warning500 + '20' },
      negotiating: { label: 'Négociation', color: Colors.warning500, bg: Colors.warning500 + '20' },
      valid: { label: 'Validé', color: Colors.success500, bg: Colors.success500 + '20' },
      cancelled: { label: 'Annulé', color: Colors.error500, bg: Colors.error500 + '20' },
      forfeit: { label: 'Forfait', color: Colors.error500, bg: Colors.error500 + '20' },
      no_show: { label: 'No-show', color: Colors.error500, bg: Colors.error500 + '20' },
    };
    return map[match.status] || { label: match.status, color: Colors.neutral500, bg: Colors.neutral500 + '20' };
  }, [match, Colors]);

  // Elo Calculation
  const eloPrediction = useMemo(() => {
    if (!match?.team_a?.elo || !match?.team_b?.elo) return null;
    const eloA = match.team_a.elo;
    const eloB = match.team_b.elo;
    
    const K = 32;
    const expectedA = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
    const winA = Math.round(K * (1 - expectedA));
    const lossA = Math.round(K * (0 - expectedA));
    
    return { winA, lossA, winB: -lossA, lossB: -winA }; // Symmetric
  }, [match]);

  // Handlers
    const handleConfirmParticipation = async () => {
    if (!teamSide) return;
    setActionLoading(true);
    try {
      const result = await confirmParticipation(matchId, teamSide);
      Alert.alert('✅ Confirmé', result.message);
      loadMatch();
    } catch (err) {
      console.error(err);
      Alert.alert('Erreur', 'Échec confirmation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineParticipation = async () => {
    if (!teamSide) return;
    setActionLoading(true);
    try {
      await declineParticipation(matchId, teamSide);
      Alert.alert('Décliné', 'Votre participation a été annulée');
      loadMatch();
    } catch (err) {
      console.error(err);
      Alert.alert('Erreur', 'Échec annulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkVenueBooked = async () => {
    setActionLoading(true);
    try {
      await markVenueBooked(matchId);
      Alert.alert('Succès', 'Terrain marqué comme réservé');
      loadMatch();
    } catch (err) {
      console.error(err);
      Alert.alert('Erreur', 'Impossible de mettre à jour le statut');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMatch = async () => {
    Alert.alert(
      'Annuler le match ?',
      'Action irréversible. Êtes-vous sûr ?',
      [
        { text: 'Non', style: 'cancel' },
        { 
          text: 'Oui, annuler', 
          style: 'destructive',
          onPress: async () => {
              setActionLoading(true);
              try {
                  await cancelMatch(matchId, myTeam?.documentId, "Annulé par le capitaine");
                  Alert.alert('Match annulé', 'Le match a été annulé.');
                  navigation.goBack();
              } catch (err) {
                  Alert.alert('Erreur', 'Échec annulation');
              } finally {
                  setActionLoading(false);
              }
          }
        }
      ]
    );
  };

  const handleOpenChat = () => {
    if (match?.chat?.documentId) {
      navigation.navigate('Conversation', {
        chatId: match.chat.documentId,
        title: `${match.team_a?.name} vs ${match.team_b?.name}`,
      });
    }
  };


  if (loading) {
    return (
      <ScreenContainer bgImage="bg2">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary500} />
        </View>
      </ScreenContainer>
    );
  }

  if (!match) {
    return (
      <ScreenContainer bgImage="bg2">
         <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>← Retour</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={[Fonts.p1, { color: Colors.neutral500 }]}>Match introuvable</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
        <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Image source={Images.arrowLeft} style={{ width: 24, height: 24, tintColor: Colors.neutral00 }} />
                </TouchableOpacity>
                <Text style={[Fonts.h3, { color: Colors.gold500, textTransform: 'uppercase', letterSpacing: 1 }]}>
                    Détails du match
                </Text>
                {match.chat ? (
                    <TouchableOpacity onPress={handleOpenChat} style={styles.chatButton}>
                         <Image source={Images.chat} style={{ width: 24, height: 24, tintColor: Colors.gold500 }} />
                    </TouchableOpacity>
                ) : <View style={{ width: 44 }} />}
            </View>

            <ScrollView 
                contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMatch(); }} tintColor={Colors.primary500} />}
            >
                {/* Hero Section */}
                <View style={styles.heroSection}>
                    <View style={styles.teamColumn}>
                        <TeamShield initials={match.team_a?.initials || match.team_a?.name || '?'} size={80} />
                        <Text style={[Fonts.h4, styles.teamName]}>{match.team_a?.name || 'Équipe A'}</Text>
                    </View>

                    <View style={styles.scoreColumn}>
                        {match.score_a !== null ? (
                             <Text style={[Fonts.h1, { color: Colors.neutral00, fontSize: 32 }]}>
                                {match.score_a} - {match.score_b}
                             </Text>
                        ) : (
                            <Text style={[Fonts.h1, { color: Colors.gold500, fontSize: 24, fontStyle: 'italic' }]}>VS</Text>
                        )}
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                            <Text style={[Fonts.label, { color: statusConfig.color, textTransform: 'uppercase' }]}>{statusConfig.label}</Text>
                        </View>
                    </View>

                    <View style={styles.teamColumn}>
                         {isAnonymous ? (
                             <>
                                <View style={[styles.mysteryShield, { borderColor: Colors.gold500 }]}>
                                    <Text style={{ fontSize: 30 }}>❓</Text>
                                </View>
                                <Text style={[Fonts.h4, styles.teamName, { color: Colors.neutral500, fontStyle: 'italic' }]}>Mystère</Text>
                             </>
                         ) : (
                            <>
                                <TeamShield initials={match.team_b?.initials || match.team_b?.name || '?'} size={80} isNeutral={true} />
                                <Text style={[Fonts.h4, styles.teamName]}>{match.team_b?.name || 'Équipe B'}</Text>
                            </>
                         )}
                    </View>
                </View>

                {/* Info Card */}
                <LeagueCard isGold>
                    <View style={styles.infoRow}>
                        <Image source={Images.calendar} style={{ width: 20, height: 20, tintColor: Colors.gold500 }} />
                        <Text style={[Fonts.p1, { color: Colors.neutral00, marginLeft: 12, flex: 1 }]}>
                            {formattedDate}
                        </Text>
                    </View>
                    <View style={[styles.separator, { backgroundColor: Colors.neutral800 }]} />
                    
                    <View style={styles.infoRow}>
                        <Image source={Images.location} style={{ width: 20, height: 20, tintColor: Colors.gold500 }} />
                        <View style={{ marginLeft: 12, flex: 1 }}>
                            <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
                                {match.venue || match.proposed_venue || 'Lieu à définir'}
                            </Text>
                            {(match.location?.address || match.address) && (
                                <Text style={[Fonts.p2, { color: Colors.neutral400, marginTop: 4 }]}>
                                    {match.location?.address || match.address}
                                </Text>
                            )}
                        </View>
                    </View>
                    
                    {eloPrediction && (
                        <>
                            <View style={[styles.separator, { backgroundColor: Colors.neutral800 }]} />
                            <View style={styles.eloContainer}>
                                <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 8, textAlign: 'center' }]}>ENJEUX DU MATCH (ELO)</Text>
                                <View style={styles.eloRow}>
                                    <View style={styles.eloTeam}>
                                        <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{match.team_a?.name}</Text>
                                        <Text style={[Fonts.p1, { color: Colors.success500 }]}>+{eloPrediction.winA} / <Text style={{ color: Colors.error500 }}>{eloPrediction.lossA}</Text></Text>
                                    </View>
                                    <View style={[styles.verticalSep, { backgroundColor: Colors.neutral700 }]} />
                                    <View style={styles.eloTeam}>
                                        <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{isAnonymous ? '???' : match.team_b?.name}</Text>
                                        <Text style={[Fonts.p1, { color: Colors.success500 }]}>+{eloPrediction.winB} / <Text style={{ color: Colors.error500 }}>{eloPrediction.lossB}</Text></Text>
                                    </View>
                                </View>
                            </View>
                        </>
                    )}
                </LeagueCard>

                {/* Participations Section */}
                 <Text style={[Fonts.h4, { color: Colors.neutral100, marginTop: 24, marginBottom: 12 }]}>
                    Compositions ({match.participations_a?.length || 0} vs {match.participations_b?.length || 0})
                </Text>
                
                <LeagueCard>
                    <View style={styles.compoRow}>
                         {/* Team A */}
                         <View style={{ flex: 1 }}>
                            <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 12 }]}>{match.team_a?.name}</Text>
                            {match.participations_a?.map((p, i) => (
                                <View key={i} style={styles.playerRow}>
                                    <View style={[styles.dot, { backgroundColor: Colors.gold500 }]} />
                                    <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
                                        {p.firstName || p.username}
                                    </Text>
                                    {p.isCaptain && <Text style={{ fontSize: 10, marginLeft: 4 }}>👑</Text>}
                                </View>
                            ))}
                            {(!match.participations_a || match.participations_a.length === 0) && (
                                <Text style={[Fonts.p2, { color: Colors.neutral500, fontStyle: 'italic' }]}>Aucun joueur</Text>
                            )}
                         </View>

                         {/* Separator */}
                         <View style={{ width: 1, backgroundColor: Colors.neutral800, marginHorizontal: 16 }} />

                         {/* Team B */}
                         <View style={{ flex: 1 }}>
                            <Text style={[Fonts.label, { color: Colors.neutral400, marginBottom: 12 }]}>
                                {isAnonymous ? 'Adversaire' : match.team_b?.name}
                            </Text>
                            {isAnonymous ? (
                                <Text style={[Fonts.p2, { color: Colors.neutral500, fontStyle: 'italic' }]}>Masqué</Text>
                            ) : (
                                <>
                                    {match.participations_b?.map((p, i) => (
                                        <View key={i} style={styles.playerRow}>
                                            <View style={[styles.dot, { backgroundColor: Colors.neutral400 }]} />
                                            <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
                                                {p.firstName || p.username}
                                            </Text>
                                        </View>
                                    ))}
                                    {(!match.participations_b || match.participations_b.length === 0) && (
                                        <Text style={[Fonts.p2, { color: Colors.neutral500, fontStyle: 'italic' }]}>Aucun joueur</Text>
                                    )}
                                </>
                            )}
                         </View>
                    </View>
                </LeagueCard>

                {/* Captain Actions */}
                {isCaptain && match.status === 'scheduled' && (
                    <>
                        <Text style={[Fonts.h4, { color: Colors.neutral100, marginTop: 24, marginBottom: 12 }]}>
                             Zone Capitaine
                        </Text>
                        <LeagueCard style={{ borderColor: Colors.error500 }}>
                            {!isVenueBooked && (
                                <Button
                                    title="Marquer terrain réservé"
                                    variant="Primary"
                                    onPress={handleMarkVenueBooked}
                                    disabled={actionLoading}
                                    style={{ marginBottom: 12, backgroundColor: Colors.gold500 }}
                                    textStyle={{ color: Colors.black }}
                                />
                            )}
                            <Button
                                title="Annuler le match"
                                variant="Secondary"
                                onPress={handleCancelMatch}
                                disabled={actionLoading}
                                style={{ borderColor: Colors.error500 }}
                                textStyle={{ color: Colors.error500 }}
                            />
                        </LeagueCard>
                    </>
                )}

            </ScrollView>

            {teamSide && match.status === 'scheduled' && (
                 <View style={[styles.bottomBar, { backgroundColor: Colors.card, borderTopColor: Colors.gold500 }]}>
                    {hasConfirmed ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                             <Text style={[Fonts.p1, { color: Colors.success500 }]}>✅ Présence confirmée</Text>
                             <Button
                                title="Passer Absent"
                                variant="Secondary"
                                size="small"
                                onPress={handleDeclineParticipation}
                                disabled={actionLoading}
                                style={{ minWidth: 120, borderColor: Colors.neutral700, backgroundColor: Colors.neutral900 }}
                             />
                        </View>
                    ) : (
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <Button
                                title="Absent"
                                variant="Secondary"
                                onPress={handleDeclineParticipation}
                                disabled={actionLoading}
                                style={{ flex: 1, borderColor: Colors.error500, backgroundColor: Colors.neutral900 }}
                                textStyle={{ color: Colors.error500 }}
                            />
                            <Button
                                title={`Présent (${participationCount}/5)`}
                                variant="Primary"
                                onPress={handleConfirmParticipation}
                                disabled={actionLoading || participationCount >= 5}
                                style={{ flex: 2, backgroundColor: Colors.gold500 }}
                                textStyle={{ color: Colors.black }}
                            />
                        </View>
                    )}
                 </View>
            )}
        </SafeAreaView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  chatButton: {
    padding: 8,
  },
  heroSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 24,
  },
  teamColumn: {
    alignItems: 'center',
    width: '30%',
  },
  scoreColumn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '40%',
  },
  teamName: {
    marginTop: 8,
    textAlign: 'center',
    color: 'white',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 8,
  },
  mysteryShield: {
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: '#333', 
    justifyContent: 'center', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderStyle: 'dashed'
  },
  infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
  },
  separator: {
      height: 1,
      width: '100%',
      marginVertical: 8,
  },
  eloContainer: {
      marginTop: 8,
  },
  eloRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
  },
  eloTeam: {
      alignItems: 'center',
      flex: 1,
  },
  verticalSep: {
      width: 1,
      height: 30,
      marginHorizontal: 16,
  },
  compoRow: {
      flexDirection: 'row',
  },
  playerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
  },
  dot: {
      width: 6, 
      height: 6, 
      borderRadius: 3, 
      marginRight: 8 
  },
  bottomBar: {
      padding: 16,
      borderTopWidth: 1,
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1A1A1A', // Colors.card fallback
      paddingBottom: 30, // Safe area hint
  }
});

export default LeagueMatchDetails;
