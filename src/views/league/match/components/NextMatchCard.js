import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ImageBackground, Image, TouchableOpacity, Alert } from 'react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import useTheme from '@/theme/themeContext';
import { getImageUrl } from '@/utils/imageUrl';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import useAuth from '@/domains/auth/useAuth';
import { missingEvent, markVenueBooked } from '@/services/event/eventService';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { cancelMatch, getCancellationPenalty } from '@/services/league/leagueMatchService';
import Button from '@/components/atoms/button/Button';

const BG_MATCH = require('@/assets/background-card-event/card-match.png');

const NextMatchCard = ({ match, event, myTeamId, onRefresh, onPress }) => {
    const { Colors, Fonts, Images: ThemeImages, Spaces } = useTheme();
    const { userData } = useAuth();

    // Identify Teams
    const isTeamA = match.team_a.documentId === myTeamId;
    const myTeam = isTeamA ? match.team_a : match.team_b;
    const opponent = isTeamA ? match.team_b : match.team_a;

    // Check if current user is captain
    const isCaptain = myTeam.captain?.documentId === userData?.documentId;

    // Venue booking status
    const isVenueBooked = event?.venueBooked === true;

    // Match cancellation status
    const isCancelledOrForfeit = match.status === 'cancelled' || match.status === 'forfeit' || match.status === 'no_show';

    // Participations
    // event.participations contains user details.
    // We check if current user is in there.
    const participations = event?.participations || [];
    const myParticipation = participations.find(p => p.documentId === userData?.documentId || p.id === userData?.id);
    
    // Count confirmed
    const confirmedCount = participations.length; 
    const isQuorumReached = confirmedCount >= 5;

    // Calculate hours until match
    const matchDate = new Date(event?.date || match.date);
    const hoursUntilMatch = (matchDate - new Date()) / (1000 * 60 * 60);

    // Handlers
    const handleConfirm = async () => {
        try {
            await createEventParticipation({
                event: event.documentId,
                user: userData.documentId,
                participationStatus: 'accepted' // Optional depending on schema, but good to be explicit
            });
            Alert.alert("Succès", "Présence confirmée !");
            onRefresh && onRefresh();
        } catch (error) {
            console.error(error);
            Alert.alert("Erreur", "Impossible de confirmer");
        }
    };

    const handleDecline = async () => {
        try {
            await missingEvent(event.documentId);
            Alert.alert("Noté", "Absence notée.");
            onRefresh && onRefresh();
        } catch (error) {
            console.error(error);
            Alert.alert("Erreur", "Impossible de décliner");
        }
    };

    const handleMarkVenueBooked = async () => {
        try {
            await markVenueBooked(event.documentId);
            Alert.alert("Terrain Réservé ✅", "Le terrain est confirmé !");
            onRefresh && onRefresh();
        } catch (error) {
            console.error(error);
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
                            const result = await cancelMatch(match.documentId, myTeam.documentId, 'captain_request');
                            Alert.alert(
                                result.penalty > 0 ? "Match Annulé ⚠️" : "Match Annulé",
                                result.message
                            );
                            onRefresh && onRefresh();
                        } catch (error) {
                            console.error(error);
                            Alert.alert("Erreur", "Impossible d'annuler le match");
                        }
                    }
                }
            ]
        );
    };

    return (
        <TouchableOpacity 
            style={styles.container}
            onPress={onPress}
            activeOpacity={0.9}
        >
            <ImageBackground
                source={BG_MATCH}
                style={StyleSheet.absoluteFill}
                imageStyle={{ borderRadius: 24, padding: 10}}
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
                                <Text style={styles.badgeText}>RÉSERVÉ ✅</Text>
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
                        <TeamShield initials={myTeam.name.substring(0,2)} size={50} />
                        <Text style={styles.teamName} numberOfLines={1}>{myTeam.name}</Text>
                    </View>
                    <Text style={styles.vsText}>VS</Text>
                    <View style={styles.teamContainer}>
                         {opponent.crest?.url ? ( 
                             <Image source={{ uri: getImageUrl(opponent.crest.url) }} style={{ width: 50, height: 50, resizeMode: 'contain' }} />
                         ) : (
                             <TeamShield initials={opponent.name.substring(0,2)} size={50} />
                         )}
                        <Text style={styles.teamName} numberOfLines={1}>{opponent.name}</Text>
                    </View>
                </View>

                {/* Details */}
                <View style={styles.details}>
                    <View style={styles.row}>
                        <Image source={ThemeImages.calendar} style={styles.icon} />
                        <Text style={styles.detailText}>
                            {format(new Date(event.date || match.date), 'EEEE d MMMM à HH:mm', { locale: fr }).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Image source={ThemeImages.pin} style={styles.icon} />
                        <Text style={styles.detailText}>
                            {match.venue || match.proposed_venue || "Lieu à définir"}
                        </Text>
                    </View>
                </View>

                {/* Captain Booking Section */}
                {isCaptain && !isVenueBooked && (
                    <TouchableOpacity 
                        onPress={handleMarkVenueBooked}
                        style={styles.bookingButton}
                    >
                        <Text style={styles.bookingButtonText}>🏟️ MARQUER TERRAIN RÉSERVÉ</Text>
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
                             <TouchableOpacity onPress={handleDecline}>
                                 <Text style={styles.linkText}>Annuler</Text>
                             </TouchableOpacity>
                         </View>
                    ) : (
                        <View style={styles.buttonRow}>
                            <Button 
                                label="Confirmer" 
                                onPress={handleConfirm} 
                                size="s" 
                                style={{ backgroundColor: '#01B3F4', flex: 1 }} 
                            />
                            <Button 
                                label="Absents" 
                                onPress={handleDecline} 
                                size="s" 
                                variant="outline" 
                                style={{ flex: 1, borderColor: '#F44336' }}
                            />
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
        backgroundColor: 'rgba(0,0,0,0.7)'
    },
    content: {
        padding: 20,
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
        marginTop: 5
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10
    },
    statusContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 10,
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
    }
});

export default NextMatchCard;
