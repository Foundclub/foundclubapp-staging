import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ImageBackground, Image, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import useTheme from '@/theme/themeContext';
import { getImageUrl } from '@/utils/imageUrl';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import useAuth from '@/domains/auth/useAuth';
import { missingEvent, markVenueBooked as markEventVenueBooked } from '@/services/event/eventService';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { 
    cancelMatch, 
    getCancellationPenalty, 
    markVenueBooked as markLeagueMatchVenueBooked,
    confirmParticipation,
    declineParticipation
} from '@/services/league/leagueMatchService';
import Button from '@/components/atoms/button/Button';

const BG_MATCH = require('@/assets/background-card-event/card-match.png');

const NextMatchCard = ({ match, event, myTeamId, onRefresh, onPress }) => {
    const { Colors, Fonts, Images: ThemeImages, Spaces } = useTheme();
    const navigation = useNavigation();
    const { userData } = useAuth();

    // Identify Teams
    // Safe chaining for team_a/team_b in case they are just IDs or partial objects
    const teamAId = match.team_a?.documentId || match.team_a?.id;
    const isTeamA = teamAId === myTeamId;
    const myTeam = isTeamA ? match.team_a : match.team_b;
    const opponent = isTeamA ? match.team_b : match.team_a;

    // Check if current user is captain
    const isCaptain = myTeam?.captain?.documentId === userData?.documentId || myTeam?.captain?.id === userData?.id;

    // Venue booking status
    // Use match.venue_booked (if exists in future schema) or event.venueBooked
    const isVenueBooked = event?.venueBooked === true || match.venue_booked === true;

    // Match cancellation status
    const isCancelledOrForfeit = match.status === 'cancelled' || match.status === 'forfeit' || match.status === 'no_show';

    // Participations
    // SOT: use event.participations if available (Event Mode)
    // OR match.participations_a / match.participations_b (League Mode)
    let participations = [];
    if (event && event.participations) {
        participations = event.participations;
    } else {
        // League Match Mode
        participations = isTeamA ? (match.participations_a || []) : (match.participations_b || []);
    }

    const myParticipation = participations.find(p => p.documentId === userData?.documentId || p.id === userData?.id);
    
    // Count confirmed
    const confirmedCount = participations.length; 
    const isQuorumReached = confirmedCount >= 5;

    // Calculate hours until match
    const matchDate = new Date(event?.date || match?.date || new Date());
    const hoursUntilMatch = (matchDate - new Date()) / (1000 * 60 * 60);

    // ELO Prediction: Calculate expected win/loss points
    const eloPrediction = useMemo(() => {
        const myElo = myTeam?.elo || 1200;
        const oppElo = opponent?.elo || 1200;
        const K = 32;
        
        // Expected score using Elo formula
        const expectedWin = 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
        
        // Points if you win (result=1) or lose (result=0)
        const pointsIfWin = Math.round(K * (1 - expectedWin));
        const pointsIfLoss = Math.round(K * (0 - expectedWin));
        
        return {
            ifWin: pointsIfWin > 0 ? `+${pointsIfWin}` : pointsIfWin,
            ifLoss: pointsIfLoss,
            myElo,
            oppElo
        };
    }, [myTeam?.elo, opponent?.elo]);

    // Handlers
    const handleConfirm = async () => {
        try {
            if (event) {
                // Event Mode
                await createEventParticipation({
                    event: event.documentId,
                    user: userData.documentId,
                    participationStatus: 'accepted' 
                });
            } else {
                // League Match Mode
                await confirmParticipation(match.documentId || match.id, isTeamA ? 'a' : 'b');
            }
            Alert.alert("Succès", "Présence confirmée !");
            onRefresh && onRefresh();
        } catch (error) {
            console.error("Confirm participation error:", error);
            Alert.alert("Erreur", error.response?.data?.error?.message || "Impossible de confirmer");
        }
    };

    const handleDecline = async () => {
        try {
            if (event) {
                 await missingEvent(event.documentId);
            } else {
                 await declineParticipation(match.documentId || match.id, isTeamA ? 'a' : 'b');
            }
            Alert.alert("Noté", "Absence notée.");
            onRefresh && onRefresh();
        } catch (error) {
            console.error("Decline participation error:", error);
            Alert.alert("Erreur", error.response?.data?.error?.message || "Impossible de décliner");
        }
    };

    const handleMarkVenueBooked = async () => {
        try {
            if (event) {
                await markEventVenueBooked(event.documentId);
            } else {
                await markLeagueMatchVenueBooked(match.documentId || match.id);
            }
            Alert.alert("Terrain Réservé ✅", "Le terrain est confirmé !");
            onRefresh && onRefresh();
        } catch (error) {
            console.error("Mark venue booked error:", error);
            Alert.alert("Erreur", "Impossible de confirmer la réservation");
        }
    };

    const handleCancelMatch = () => {
        const penaltyInfo = getCancellationPenalty(hoursUntilMatch);
        
        Alert.alert(
            "Annuler le match ?",
            `${penaltyInfo.message}\n\nCette action est irréversible.`,
            [
                { text: "Non", style: "cancel" },
                { 
                    text: penaltyInfo.isSevere ? "Oui, forfait" : "Oui, annuler",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            // Ensure we use the correct team ID (myTeam.documentId)
                            const teamIdToUse = myTeam.documentId || myTeam.id;
                            const matchIdToUse = match.documentId || match.id;
                            
                            const result = await cancelMatch(matchIdToUse, teamIdToUse, 'captain_request');
                            Alert.alert(
                                result.penalty > 0 ? "Match Annulé ⚠️" : "Match Annulé",
                                result.message || "Le match a été annulé."
                            );
                            onRefresh && onRefresh();
                        } catch (error) {
                            console.error("Cancel match error:", error);
                            Alert.alert("Erreur", "Impossible d'annuler le match");
                        }
                    }
                }
            ]
        );
    };

    if (!myTeam || !opponent) return null;

    return (
        <TouchableOpacity 
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <ImageBackground
                source={BG_MATCH}
                style={StyleSheet.absoluteFill}
                imageStyle={{ borderRadius: 24 }}
                resizeMode="cover"
            />
            
            {/* Overlay */}
            <View style={styles.overlay} />

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>PROCHAIN MATCH</Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {isVenueBooked && (
                            <View style={[styles.badge, { backgroundColor: '#4CAF50' }]}>
                                <Text style={styles.badgeText}>À VENIR ✅</Text>
                            </View>
                        )}
                        {match.status === 'scheduled' && !isVenueBooked && (
                            <View style={[styles.badge, { backgroundColor: '#FFC107' }]}>
                                <Text style={[styles.badgeText, { color: '#000' }]}>EN ATTENTE</Text>
                            </View>
                        )}
                    </View>
                </View>

                {/* Matchup */}
                <View style={styles.matchup}>
                    <View style={styles.teamContainer}>
                        <TeamShield initials={myTeam.name?.substring(0,2) || '??'} size={50} />
                        <Text style={styles.teamName} numberOfLines={1}>{myTeam.name}</Text>
                    </View>
                    <Text style={styles.vsText}>VS</Text>
                    <View style={styles.teamContainer}>
                         {/* Anonymization Logic */}
                         {!isVenueBooked && match.status === 'scheduled' ? (
                             <>
                                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#555' }}>
                                    <Text style={{ fontSize: 24 }}>❓</Text>
                                </View>
                                <Text style={[styles.teamName, { fontStyle: 'italic', color: '#AAA' }]} numberOfLines={1}>Adversaire Mystère</Text>
                             </>
                         ) : (
                             <>
                                {opponent.crest?.url ? ( 
                                    <Image source={{ uri: getImageUrl(opponent.crest.url) }} style={{ width: 50, height: 50, resizeMode: 'contain' }} />
                                ) : (
                                    <TeamShield initials={opponent.name?.substring(0,2) || '??'} size={50} />
                                )}
                                <Text style={styles.teamName} numberOfLines={1}>{opponent.name}</Text>
                             </>
                         )}
                    </View>
                </View>

                {/* Details */}
                <View style={styles.details}>
                    <View style={styles.row}>
                        <Image source={ThemeImages.calendar} style={styles.icon} />
                        <Text style={styles.detailText}>
                            {format(new Date(event?.date || match?.date || new Date()), 'EEEE d MMMM à HH:mm', { locale: fr }).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Image source={ThemeImages.pin} style={styles.icon} />
                        <View>
                            <Text style={styles.detailText}>
                                {match.venue || match.proposed_venue || "Lieu à définir"}
                            </Text>
                            {/* Address Display */}
                            {(match.location?.address || match.address) && (
                                <Text style={[styles.detailText, { fontSize: 12, color: '#AAA', marginTop: 2 }]}>
                                    {match.location?.address || match.address}
                                </Text>
                            )}
                        </View>
                    </View>
                </View>

                {/* ELO Prediction */}
                <View style={styles.eloPrediction}>
                    <Text style={styles.eloPredictionTitle}>📊 ENJEU ELO</Text>
                    <View style={styles.eloPredictionRow}>
                        <View style={[styles.eloPredictionBadge, { backgroundColor: 'rgba(76, 175, 80, 0.2)' }]}>
                            <Text style={{ color: '#4CAF50', fontWeight: 'bold' }}>Victoire: {eloPrediction.ifWin}</Text>
                        </View>
                        <View style={[styles.eloPredictionBadge, { backgroundColor: 'rgba(244, 67, 54, 0.2)' }]}>
                            <Text style={{ color: '#F44336', fontWeight: 'bold' }}>Défaite: {eloPrediction.ifLoss}</Text>
                        </View>
                    </View>
                    <Text style={styles.eloPredictionDetails}>
                        {myTeam.name} ({eloPrediction.myElo}) vs {!isVenueBooked && match.status === 'scheduled' ? "???" : `${opponent.name} (${eloPrediction.oppElo})`}
                    </Text>
                </View>

                {/* Captain Booking Section */}
                {isCaptain && !isVenueBooked && match.status !== 'cancelled' && (
                    <TouchableOpacity 
                        onPress={handleMarkVenueBooked}
                        style={styles.bookingButton}
                    >
                        <Text style={styles.bookingButtonText} numberOfLines={1} adjustsFontSizeToFit>
                            🏟️ MARQUER TERRAIN RÉSERVÉ
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Score Entry Section (Post-Match) */}
                {isCaptain && isVenueBooked && new Date() > matchDate && match.status !== 'cancelled' && (
                     <TouchableOpacity 
                        onPress={() => {
                            // Navigate to EndMatchScreen
                            // Assuming navigation is available via hook
                            navigation.navigate('LeagueMatch', { 
                                screen: 'EndMatchScreen', 
                                params: { matchId: match.documentId || match.id } 
                            });
                        }}
                        style={[styles.bookingButton, { borderColor: Colors.primary500, backgroundColor: 'rgba(1, 179, 244, 0.15)' }]}
                    >
                        <Text style={[styles.bookingButtonText, { color: Colors.primary500 }]}>
                            ⚽ SAISIR LE SCORE
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Captain Cancel Match */}
                {isCaptain && !isCancelledOrForfeit && (
                    <TouchableOpacity 
                        onPress={handleCancelMatch}
                        style={styles.cancelButton}
                    >
                        <Text style={styles.cancelButtonText}>❌ ANNULER LE MATCH</Text>
                    </TouchableOpacity>
                )}

                {/* Attendance Gauge */}
                <View style={styles.attendance}>
                    <Text style={styles.attendanceTitle}>Présence d'équipe ({confirmedCount}/5)</Text>
                    <View style={styles.gaugeBg}>
                        <View style={[styles.gaugeFill, { width: `${Math.min((confirmedCount/5)*100, 100)}%`, backgroundColor: isQuorumReached ? '#4CAF50' : '#FFC107' }]} />
                    </View>
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    {myParticipation ? (
                         <View style={styles.statusContainer}>
                             <Text style={styles.statusText}>✅ Vous participez</Text>
                             <TouchableOpacity onPress={handleDecline} style={{ padding: 8 }}>
                                 <Text style={styles.linkText}>Annuler</Text>
                             </TouchableOpacity>
                         </View>
                    ) : (
                        <View style={styles.buttonRow}>
                            <View style={{ flex: 1 }}>
                                <Button 
                                    title="Confirmer"
                                    onPress={handleConfirm} 
                                    variant="Primary" 
                                    style={{ backgroundColor: '#01B3F4', width: '100%', height: 44 }}
                                    textStyle={{ fontSize: 13 }}
                                />
                            </View>
                            <View style={{ width: 10 }} />
                            <View style={{ flex: 1 }}>
                                <Button 
                                    title="Absents"
                                    onPress={handleDecline} 
                                    variant="Secondary" 
                                    style={{ borderColor: '#F44336', width: '100%', height: 44 }}
                                    textStyle={{ color: '#F44336', fontSize: 13 }}
                                />
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        minHeight: 220,
        marginBottom: 20,
        backgroundColor: '#1E1E1E'
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)' // Slightly darker for better contrast
    },
    content: {
        padding: 20,
        paddingBottom: 25 // Ensure padding at bottom for buttons
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15
    },
    headerTitle: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 14,
        color: '#01B3F4',
        letterSpacing: 1
    },
    badge: {
        backgroundColor: '#4CAF50',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold'
    },
    matchup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    teamContainer: {
        alignItems: 'center',
        width: '40%'
    },
    teamName: {
        color: 'white',
        marginTop: 8,
        fontSize: 14,
        fontFamily: 'Montserrat-Bold',
        textAlign: 'center'
    },
    vsText: {
        color: '#888',
        fontSize: 20,
        fontFamily: 'Montserrat-Black',
        fontStyle: 'italic'
    },
    details: {
        gap: 8,
        marginBottom: 15
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    icon: {
        width: 16,
        height: 16,
        tintColor: '#01B3F4'
    },
    detailText: {
        color: '#DDD',
        fontSize: 14,
        fontFamily: 'Montserrat-Medium'
    },
    attendance: {
        marginBottom: 15
    },
    attendanceTitle: {
        color: '#AAA',
        fontSize: 12,
        marginBottom: 5
    },
    gaugeBg: {
        height: 6,
        backgroundColor: '#333',
        borderRadius: 3,
        overflow: 'hidden'
    },
    gaugeFill: {
        height: '100%',
        borderRadius: 3
    },
    actions: {
        marginTop: 10
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    statusContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(76, 175, 80, 0.1)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#4CAF50'
    },
    statusText: {
        color: '#4CAF50',
        fontWeight: 'bold'
    },
    linkText: {
        color: '#F44336',
        textDecorationLine: 'underline',
        fontSize: 12
    },
    bookingButton: {
        backgroundColor: 'rgba(255, 193, 7, 0.15)',
        borderWidth: 1,
        borderColor: '#FFC107',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        marginBottom: 15
    },
    bookingButtonText: {
        color: '#FFC107',
        fontWeight: 'bold',
        fontSize: 14,
        fontFamily: 'Montserrat-Bold'
    },
    cancelButton: {
        backgroundColor: 'rgba(244, 67, 54, 0.15)',
        borderWidth: 1,
        borderColor: '#F44336',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignItems: 'center',
        marginBottom: 15
    },
    cancelButtonText: {
        color: '#F44336',
        fontWeight: 'bold',
        fontSize: 12,
        fontFamily: 'Montserrat-Bold'
    },
    eloPrediction: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 15,
        alignItems: 'center'
    },
    eloPredictionTitle: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12,
        marginBottom: 8,
        fontFamily: 'Montserrat-Bold'
    },
    eloPredictionRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8
    },
    eloPredictionBadge: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8
    },
    eloPredictionDetails: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10
    }
});

export default NextMatchCard;
