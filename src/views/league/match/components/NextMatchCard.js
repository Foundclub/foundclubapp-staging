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
import {
    getMatchDerivedPhase,
    isMatchPastStart,
    isMatchPastEnd,
    normalizeMatchStatus,
    shouldMaskOpponentIdentity,
} from '@/views/league/match/utils/matchStatus';
import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';
import { navigateToEndMatchScreen } from '@/views/league/match/utils/leagueNavigation';

const BG_MATCH = require('@/assets/background-card-event/card-match.png');

const resolveAddressLabel = (match) => {
    const location = match?.location;
    if (typeof location === 'string') return location;
    if (location && typeof location === 'object') {
        return location.address || location.label || location.city || '';
    }
    return match?.address || '';
};

const normalizeComparableLabel = (value) => String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const NextMatchCard = ({ match, event, myTeamId, onRefresh, onPress }) => {
    const { Colors, Fonts, Images: ThemeImages } = useTheme();
    const navigation = useNavigation();
    const { userData } = useAuth();

    // Identify Teams
    // Safe chaining for team_a/team_b in case they are just IDs or partial objects
    const teamAId = getEntityDocumentId(match.team_a);
    const isTeamA = areSameEntityId(teamAId, myTeamId);
    const myTeam = isTeamA ? match.team_a : match.team_b;
    const opponent = isTeamA ? match.team_b : match.team_a;

    // Check if current user is captain
    const isCaptain = areSameEntityId(getEntityDocumentId(myTeam?.captain), getEntityDocumentId(userData));

    const normalizedStatus = normalizeMatchStatus(match?.status);
    const derivedPhase = getMatchDerivedPhase(match, event);
    const isAnonymous = shouldMaskOpponentIdentity(match, event);
    const isTerminalStatus = ['cancelled', 'forfeit', 'no_show', 'valid'].includes(normalizedStatus);
    const isVenueBooked = event?.venueBooked === true || match?.venueBooked === true || match?.venue_booked === true;
    const hasMatchStarted = isMatchPastStart(match, event);
    const hasMatchEnded = isMatchPastEnd(match, event);
    const isScoreLockedByTime = normalizedStatus === 'scheduled' && isVenueBooked && !hasMatchStarted;

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

    const myParticipation = participations.find((p) => areSameEntityId(getEntityDocumentId(p), getEntityDocumentId(userData)));
    
    // Count confirmed
    const confirmedCount = participations.length; 
    const isQuorumReached = confirmedCount >= 5;

    // Calculate hours until match
    const matchDate = new Date(event?.date || match?.date || new Date());
    const hoursUntilMatch = (matchDate - new Date()) / (1000 * 60 * 60);
    const matchAddressLabel = resolveAddressLabel(match);
    const venueLabel = match.venue || match.proposed_venue || "Lieu à définir";
    const showAddressDetails = Boolean(
        matchAddressLabel
        && normalizeComparableLabel(matchAddressLabel) !== normalizeComparableLabel(venueLabel)
    );
    const startTimeLabel = format(matchDate, 'HH:mm', { locale: fr });
    const endTimeLabel = useMemo(() => {
        const explicitEndDate = event?.endDate || match?.location?.proposed_end_time || null;
        if (explicitEndDate) {
            const parsed = new Date(explicitEndDate);
            if (!Number.isNaN(parsed.getTime())) {
                return format(parsed, 'HH:mm', { locale: fr });
            }
        }

        if (match?.recurring_end_hour) {
            return String(match.recurring_end_hour).slice(0, 5);
        }

        const plusOneHour = new Date(matchDate.getTime() + (60 * 60 * 1000));
        return format(plusOneHour, 'HH:mm', { locale: fr });
    }, [event?.endDate, match?.location?.proposed_end_time, match?.recurring_end_hour, matchDate]);

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

    const progressSteps = useMemo(() => {
        const matchPlayed = hasMatchEnded
            || ['waiting_score', 'pending_validation', 'disputed'].includes(derivedPhase)
            || ['valid', 'forfeit', 'no_show'].includes(normalizedStatus);
        const resultSubmitted = ['pending_validation', 'disputed', 'valid', 'forfeit', 'no_show', 'cancelled']
            .includes(normalizedStatus) || ['pending_validation', 'disputed'].includes(derivedPhase);

        return [
            { done: true, key: 'found', label: 'Trouve' },
            { done: isVenueBooked || matchPlayed || resultSubmitted, key: 'booked', label: 'Terrain reserve' },
            { done: matchPlayed || resultSubmitted, key: 'played', label: 'Match joue' },
            { done: resultSubmitted, key: 'result', label: 'Resultat' },
        ];
    }, [derivedPhase, hasMatchEnded, isVenueBooked, normalizedStatus]);

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
                await confirmParticipation(getEntityDocumentId(match), isTeamA ? 'a' : 'b');
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
                 await declineParticipation(getEntityDocumentId(match), isTeamA ? 'a' : 'b');
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
                await markLeagueMatchVenueBooked(getEntityDocumentId(match));
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
                            const teamIdToUse = getEntityDocumentId(myTeam);
                            const matchIdToUse = getEntityDocumentId(match);
                            
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
                        {derivedPhase === 'confirmed_upcoming' && (
                            <View style={[styles.badge, { backgroundColor: '#4CAF50' }]}> 
                                <Text style={styles.badgeText}>A VENIR</Text>
                            </View>
                        )}
                        {derivedPhase === 'waiting_venue' && (
                            <View style={[styles.badge, { backgroundColor: '#FFC107' }]}> 
                                <Text style={[styles.badgeText, { color: '#0B1820' }]}>EN ATTENTE TERRAIN</Text>
                            </View>
                        )}
                        {derivedPhase === 'pending_validation' && (
                            <View style={[styles.badge, { backgroundColor: '#FFC107' }]}> 
                                <Text style={[styles.badgeText, { color: '#0B1820' }]}>SCORE EN ATTENTE</Text>
                            </View>
                        )}
                        {derivedPhase === 'disputed' && (
                            <View style={[styles.badge, { backgroundColor: '#EF4444' }]}> 
                                <Text style={styles.badgeText}>LITIGE</Text>
                            </View>
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
                                style={[
                                    styles.progressChipText,
                                    step.done ? styles.progressChipTextDone : styles.progressChipTextTodo,
                                ]}
                                numberOfLines={1}
                            >
                                {step.label}
                            </Text>
                        </View>
                    ))}
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
                         {isAnonymous ? (
                             <>
                                <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.24)' }}>
                                    <Text style={{ fontSize: 24 }}>❓</Text>
                                </View>
                                <Text style={[styles.teamName, { fontStyle: 'italic', color: '#ADB1B2' }]} numberOfLines={1}>Adversaire Mystère</Text>
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
                            {`${format(new Date(event?.date || match?.date || new Date()), 'EEEE d MMMM', { locale: fr }).toUpperCase()} • ${startTimeLabel}-${endTimeLabel}`}
                        </Text>
                    </View>
                    <View style={styles.row}>
                        <Image source={ThemeImages.pin} style={styles.icon} />
                        <View>
                            <Text style={styles.detailText}>
                                {venueLabel}
                            </Text>
                            {/* Address Display */}
                            {showAddressDetails ? (
                                <Text style={styles.detailSubText}>
                                    {matchAddressLabel}
                                </Text>
                            ) : null}
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
                        {myTeam.name} ({eloPrediction.myElo}) vs {isAnonymous ? "???" : `${opponent.name} (${eloPrediction.oppElo})`}
                    </Text>
                </View>

                {/* Captain Booking Section */}
                {isCaptain && derivedPhase === 'waiting_venue' && !isTerminalStatus && (
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
                {isCaptain && (['waiting_score', 'pending_validation', 'disputed'].includes(derivedPhase) || isScoreLockedByTime) && !isTerminalStatus && (
                     <TouchableOpacity 
                        onPress={() => {
                            if (isScoreLockedByTime) {
                                Alert.alert(
                                    'Score indisponible',
                                    "Vous pourrez saisir le score une fois l'heure de debut du match depassee."
                                );
                                return;
                            }
                            // Match tab is not inside LeagueNavigator stack.
                            navigateToEndMatchScreen(navigation, match);
                        }}
                        style={[
                            styles.bookingButton,
                            isScoreLockedByTime
                                ? { borderColor: Colors.neutral600, backgroundColor: 'rgba(255,255,255,0.06)' }
                                : { borderColor: Colors.primary500, backgroundColor: 'rgba(1, 179, 244, 0.15)' }
                        ]}
                    >
                        <Text style={[styles.bookingButtonText, { color: isScoreLockedByTime ? Colors.neutral400 : Colors.primary500 }]}>
                            {isScoreLockedByTime ? '⚽ SCORE VERROUILLE (AVANT DEBUT)' : '⚽ SAISIR LE SCORE'}
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Attendance Gauge */}
                <View style={styles.attendance}>
                    <Text style={styles.attendanceTitle}>Presences joueurs confirmees ({confirmedCount}/5)</Text>
                    <Text style={styles.attendanceHint}>
                        {isQuorumReached
                            ? "Quorum atteint. Equipe prete."
                            : `Minimum requis: 5 joueurs. Il manque ${Math.max(5 - confirmedCount, 0)} joueur(s).`}
                    </Text>
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
                                    style={{ backgroundColor: '#01B3F4', borderRadius: 14, width: '100%', height: 48 }}
                                    textStyle={{ fontSize: 13 }}
                                />
                            </View>
                            <View style={{ width: 10 }} />
                            <View style={{ flex: 1 }}>
                                <Button 
                                    title="Absent"
                                    onPress={handleDecline} 
                                    variant="Secondary" 
                                    style={{ borderColor: '#F44336', borderRadius: 14, width: '100%', height: 48 }}
                                    textStyle={{ color: '#F44336', fontSize: 13 }}
                                />
                            </View>
                        </View>
                    )}
                </View>

                {/* Captain Cancel Match (Secondary Action) */}
                {isCaptain && !isTerminalStatus && (
                    <TouchableOpacity
                        onPress={handleCancelMatch}
                        style={styles.cancelLinkButton}
                    >
                        <Text style={styles.cancelLinkText}>Annuler ce match</Text>
                    </TouchableOpacity>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        overflow: 'hidden',
        minHeight: 220,
        marginBottom: 24,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(11, 18, 32, 0.78)',
    },
    content: {
        padding: 22,
        paddingBottom: 24, // Ensure padding at bottom for buttons
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    headerTitle: {
        fontFamily: 'Montserrat-Bold',
        fontSize: 14,
        color: '#01B3F4',
        letterSpacing: 1
    },
    progressChipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    progressChip: {
        borderRadius: 999,
        borderWidth: 1,
        minWidth: 66,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    progressChipDone: {
        backgroundColor: 'rgba(1, 179, 244, 0.14)',
        borderColor: 'rgba(1, 179, 244, 0.45)',
    },
    progressChipTodo: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderColor: 'rgba(255,255,255,0.18)',
    },
    progressChipText: {
        fontFamily: 'Montserrat-SemiBold',
        fontSize: 10,
        textAlign: 'center',
    },
    progressChipTextDone: {
        color: '#01B3F4',
    },
    progressChipTextTodo: {
        color: '#A7B0BF',
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
        marginBottom: 18,
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
        marginBottom: 18,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
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
    detailSubText: {
        color: '#A7B0BF',
        fontSize: 12,
        marginTop: 2,
    },
    attendance: {
        marginBottom: 16,
        marginTop: 2,
    },
    attendanceTitle: {
        color: '#C0C8D6',
        fontSize: 12,
        marginBottom: 4,
    },
    attendanceHint: {
        color: '#8E9AAD',
        fontSize: 11,
        marginBottom: 10,
    },
    gaugeBg: {
        height: 8,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 3,
        overflow: 'hidden'
    },
    gaugeFill: {
        height: '100%',
        borderRadius: 3
    },
    actions: {
        marginTop: 12,
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
        borderRadius: 14,
        minHeight: 48,
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    bookingButtonText: {
        color: '#FFC107',
        fontWeight: 'bold',
        fontSize: 14,
        fontFamily: 'Montserrat-Bold'
    },
    cancelLinkButton: {
        alignItems: 'center',
        marginTop: 14,
        paddingVertical: 6,
    },
    cancelLinkText: {
        color: '#F44336',
        fontFamily: 'Montserrat-SemiBold',
        fontSize: 12,
        textDecorationLine: 'underline',
    },
    eloPrediction: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 18,
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


