import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import useTheme from '@/theme/themeContext';
import useAuth from '@/domains/auth/useAuth';
import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';

import {
  fetchMatch,
  confirmParticipation,
  declineParticipation,
  markVenueBooked,
  cancelMatch,
  getCancellationPenalty,
} from '@/services/league/leagueMatchService';

const LeagueMatchDetails = ({ navigation, route }) => {
  const { matchId } = route.params;
  const { Colors, Fonts } = useTheme();
  const { userData } = useAuth();
  
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Determine user context
  const userId = userData?.documentId || userData?.id;
  const isInTeamA = match?.team_a?.members?.some(m => m.documentId === userId || m.id === userId) ||
                    match?.team_a?.captain?.documentId === userId;
  const isInTeamB = match?.team_b?.members?.some(m => m.documentId === userId || m.id === userId) ||
                    match?.team_b?.captain?.documentId === userId;
  const teamSide = isInTeamA ? 'a' : (isInTeamB ? 'b' : null);
  
  const isCaptainA = match?.team_a?.captain?.documentId === userId;
  const isCaptainB = match?.team_b?.captain?.documentId === userId;
  const isCaptain = isCaptainA || isCaptainB;

  // Check if user already confirmed
  const participations = teamSide === 'a' ? match?.participations_a : match?.participations_b;
  const hasConfirmed = participations?.some(p => p.documentId === userId || p.id === userId);
  const participationCount = participations?.length || 0;

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
      Alert.alert('Erreur', 'Échec');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkVenueBooked = async () => {
    setActionLoading(true);
    try {
      const result = await markVenueBooked(matchId);
      Alert.alert('✅', result.message);
      loadMatch();
    } catch (err) {
      console.error(err);
      Alert.alert('Erreur', 'Échec');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMatch = async () => {
    if (!match) return;
    const matchDate = new Date(match.date);
    const hoursUntil = (matchDate.getTime() - new Date().getTime()) / (1000 * 60 * 60);
    const { penalty, message, isSevere } = getCancellationPenalty(hoursUntil);

    const teamId = isCaptainA ? match.team_a?.documentId : match.team_b?.documentId;

    Alert.alert(
      'Annuler le match ?',
      message,
      [
        { text: 'Non', style: 'cancel' },
        {
          text: isSevere ? 'Confirmer le forfait' : 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const result = await cancelMatch(matchId, teamId);
              Alert.alert('Match annulé', result.message);
              navigation.goBack();
            } catch (err) {
              console.error(err);
              Alert.alert('Erreur', 'Échec annulation');
            } finally {
              setActionLoading(false);
            }
          },
        },
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

  // Format date
  const formatMatchDate = (dateStr) => {
    if (!dateStr) return 'Date à définir';
    try {
      return format(new Date(dateStr), "EEEE d MMMM 'à' HH'h'mm", { locale: fr });
    } catch {
      return dateStr;
    }
  };

  // Status badge
  const getStatusConfig = (status) => {
    const statusMap = {
      scheduled: { label: 'Programmé', color: Colors.primary500 },
      pending_validation: { label: 'En attente', color: Colors.warning500 || '#f59e0b' },
      negotiating: { label: 'Négociation', color: Colors.warning500 || '#f59e0b' },
      valid: { label: 'Validé', color: Colors.success500 || '#22c55e' },
      cancelled: { label: 'Annulé', color: Colors.error500 || '#ef4444' },
      forfeit: { label: 'Forfait', color: Colors.error500 || '#ef4444' },
      no_show: { label: 'No-show', color: Colors.error500 || '#ef4444' },
    };
    return statusMap[status] || { label: status, color: Colors.neutral500 };
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: Colors.neutral900 }]}>
        <ActivityIndicator size="large" color={Colors.primary500} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={[styles.container, { backgroundColor: Colors.neutral900 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>← Retour</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={[Fonts.p1, { color: Colors.neutral500 }]}>Match introuvable</Text>
        </View>
      </View>
    );
  }

  const statusConfig = getStatusConfig(match.status);

  return (
    <View style={[styles.container, { backgroundColor: Colors.neutral900 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[Fonts.h3, { color: Colors.neutral00 }]}>← Retour</Text>
        </TouchableOpacity>
        <Text style={[Fonts.h2, { color: Colors.neutral00 }]}>Détails du match</Text>
        {match.chat && (
          <TouchableOpacity onPress={handleOpenChat} style={styles.chatButton}>
            <Text style={[Fonts.p1, { color: Colors.primary500 }]}>💬 Chat</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMatch(); }} />
        }
      >
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '30' }]}>
            <Text style={[Fonts.label, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
          {match.venueBooked && (
            <View style={[styles.statusBadge, { backgroundColor: (Colors.success500 || '#22c55e') + '30' }]}>
              <Text style={[Fonts.label, { color: Colors.success500 || '#22c55e' }]}>Terrain réservé ✓</Text>
            </View>
          )}
        </View>

        {/* Match Card */}
        <View style={[styles.matchCard, { backgroundColor: Colors.neutral800 }]}>
          {/* Team A */}
          <View style={styles.teamContainer}>
            <TeamShield 
              team={match.team_a} 
              size={60}
            />
            <Text style={[Fonts.h4, { color: Colors.neutral00, marginTop: 8, textAlign: 'center' }]}>
              {match.team_a?.name || 'Équipe A'}
            </Text>
            <Text style={[Fonts.caption, { color: Colors.neutral500 }]}>
              {match.participations_a?.length || 0}/5 confirmés
            </Text>
          </View>

          {/* VS */}
          <View style={styles.vsContainer}>
            <Text style={[Fonts.h1, { color: Colors.primary500 }]}>VS</Text>
            {match.score_a != null && (
              <Text style={[Fonts.h2, { color: Colors.neutral00, marginTop: 8 }]}>
                {match.score_a} - {match.score_b}
              </Text>
            )}
          </View>

          {/* Team B */}
          <View style={styles.teamContainer}>
            <TeamShield 
              team={match.team_b} 
              size={60}
            />
            <Text style={[Fonts.h4, { color: Colors.neutral00, marginTop: 8, textAlign: 'center' }]}>
              {match.team_b?.name || 'Équipe B'}
            </Text>
            <Text style={[Fonts.caption, { color: Colors.neutral500 }]}>
              {match.participations_b?.length || 0}/5 confirmés
            </Text>
          </View>
        </View>

        {/* Match Info */}
        <View style={[styles.infoCard, { backgroundColor: Colors.neutral800 }]}>
          <View style={styles.infoRow}>
            <Text style={[Fonts.p1, { color: Colors.primary500 }]}>📅</Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00, marginLeft: 12 }]}>
              {formatMatchDate(match.date)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[Fonts.p1, { color: Colors.primary500 }]}>📍</Text>
            <Text style={[Fonts.p1, { color: Colors.neutral00, marginLeft: 12 }]}>
              {match.venue || match.proposed_venue || 'Lieu à définir'}
            </Text>
          </View>
        </View>

        {/* Participation Actions */}
        {teamSide && match.status === 'scheduled' && (
          <View style={[styles.actionCard, { backgroundColor: Colors.neutral800 }]}>
            <Text style={[Fonts.h4, { color: Colors.neutral00, marginBottom: 16 }]}>
              Ma participation
            </Text>
            
            {hasConfirmed ? (
              <View>
                <View style={styles.confirmedBadge}>
                  <Text style={[Fonts.p1, { color: Colors.success500 || '#22c55e' }]}>
                    ✓ Participation confirmée
                  </Text>
                </View>
                <Button
                  title="Annuler ma participation"
                  variant="SecondaryLight"
                  onPress={handleDeclineParticipation}
                  disabled={actionLoading}
                  style={{ marginTop: 12 }}
                />
              </View>
            ) : (
              <View style={styles.actionButtons}>
                <Button
                  title={`Confirmer (${participationCount}/5)`}
                  variant="Primary"
                  onPress={handleConfirmParticipation}
                  disabled={actionLoading || participationCount >= 5}
                  style={{ flex: 1, marginRight: 8 }}
                />
                <Button
                  title="Décliner"
                  variant="SecondaryLight"
                  onPress={handleDeclineParticipation}
                  disabled={actionLoading}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </View>
        )}

        {/* Captain Actions */}
        {isCaptain && match.status === 'scheduled' && (
          <View style={[styles.actionCard, { backgroundColor: Colors.neutral800 }]}>
            <Text style={[Fonts.h4, { color: Colors.neutral00, marginBottom: 16 }]}>
              Actions capitaine
            </Text>
            
            {!match.venueBooked && (
              <Button
                title="Marquer terrain réservé"
                variant="Primary"
                onPress={handleMarkVenueBooked}
                disabled={actionLoading}
                style={{ marginBottom: 12 }}
              />
            )}
            
            <Button
              title="Annuler le match"
              variant="SecondaryLight"
              onPress={handleCancelMatch}
              disabled={actionLoading}
            />
          </View>
        )}

        {/* Participations List */}
        <View style={[styles.participationsCard, { backgroundColor: Colors.neutral800 }]}>
          <Text style={[Fonts.h4, { color: Colors.neutral00, marginBottom: 16 }]}>
            Joueurs confirmés
          </Text>
          
          <View style={styles.participationsRow}>
            {/* Team A Players */}
            <View style={styles.teamParticipations}>
              <Text style={[Fonts.label, { color: Colors.primary500, marginBottom: 8 }]}>
                {match.team_a?.name}
              </Text>
              {(match.participations_a || []).map((player, idx) => (
                <View key={idx} style={styles.playerRow}>
                  <View style={[styles.playerDot, { backgroundColor: Colors.primary500 }]} />
                  <Text style={[Fonts.p2, { color: Colors.neutral00, marginLeft: 8 }]}>
                    {player.username || player.email?.split('@')[0] || `Joueur ${idx + 1}`}
                  </Text>
                </View>
              ))}
              {(match.participations_a || []).length === 0 && (
                <Text style={[Fonts.caption, { color: Colors.neutral500 }]}>Aucun joueur</Text>
              )}
            </View>

            <View style={styles.separator} />

            {/* Team B Players */}
            <View style={styles.teamParticipations}>
              <Text style={[Fonts.label, { color: Colors.primary500, marginBottom: 8 }]}>
                {match.team_b?.name}
              </Text>
              {(match.participations_b || []).map((player, idx) => (
                <View key={idx} style={styles.playerRow}>
                  <View style={[styles.playerDot, { backgroundColor: Colors.primary500 }]} />
                  <Text style={[Fonts.p2, { color: Colors.neutral00, marginLeft: 8 }]}>
                    {player.username || player.email?.split('@')[0] || `Joueur ${idx + 1}`}
                  </Text>
                </View>
              ))}
              {(match.participations_b || []).length === 0 && (
                <Text style={[Fonts.caption, { color: Colors.neutral500 }]}>Aucun joueur</Text>
              )}
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  chatButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  vsContainer: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  infoCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  participationsCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 32,
  },
  participationsRow: {
    flexDirection: 'row',
  },
  teamParticipations: {
    flex: 1,
  },
  separator: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 16,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  playerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default LeagueMatchDetails;
