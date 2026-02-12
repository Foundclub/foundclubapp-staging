import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ScreenContainer from '@/components/templates/ScreenContainer';
import useAuth from '@/domains/auth/useAuth';
import { getImageUrl } from '@/utils/imageUrl';
import { getMatch, requestRematch } from '@/services/league/leagueMatchService';
import useTheme from '@/theme/themeContext';

const normalizeId = (value) => (value === null || value === undefined ? '' : String(value));
const isSameId = (left, right) => normalizeId(left) !== '' && normalizeId(left) === normalizeId(right);
const normalizeComparableText = (value) => String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const resolveVenueLabel = (match) => match?.venue || match?.proposed_venue || 'Lieu a definir';
const resolveAddressLabel = (match) => match?.location?.address || match?.address || '';

const PastMatchDetails = () => {
    const { Colors, Fonts, Images } = useTheme();
    const route = useRoute();
    const navigation = useNavigation();
    const { userData } = useAuth();

    const { matchId, myTeamId } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [match, setMatch] = useState(null);
    const [requestingRematch, setRequestingRematch] = useState(false);

    const loadMatch = useCallback(async () => {
        try {
            const data = await getMatch(matchId);
            setMatch(data);
        } catch (error) {
            console.error('Error loading match:', error);
            Alert.alert('Erreur', 'Impossible de charger le match');
        } finally {
            setLoading(false);
        }
    }, [matchId]);

    useEffect(() => {
        loadMatch();
    }, [loadMatch]);

    const currentUserId = userData?.documentId || userData?.id;

    const teamA = match?.team_a;
    const teamB = match?.team_b;
    const teamAId = teamA?.documentId || teamA?.id;
    const teamBId = teamB?.documentId || teamB?.id;

    const isUserInTeamA = useMemo(() => {
        if (!teamA || !currentUserId) return false;
        return isSameId(teamA?.captain?.documentId || teamA?.captain?.id, currentUserId)
            || (teamA?.roster || []).some((member) => isSameId(member?.documentId || member?.id, currentUserId));
    }, [teamA, currentUserId]);

    const isTeamA = useMemo(() => {
        if (myTeamId) return isSameId(teamAId, myTeamId);
        return isUserInTeamA;
    }, [myTeamId, teamAId, isUserInTeamA]);

    const myTeam = isTeamA ? teamA : teamB;
    const opponent = isTeamA ? teamB : teamA;

    const myScore = isTeamA ? match?.score_a : match?.score_b;
    const oppScore = isTeamA ? match?.score_b : match?.score_a;

    const resultConfig = useMemo(() => {
        if (myScore > oppScore) {
            return {
                borderColor: 'rgba(39, 214, 163, 0.55)',
                chipBg: 'rgba(39, 214, 163, 0.2)',
                color: Colors.success500,
                label: 'VICTOIRE',
            };
        }
        if (myScore < oppScore) {
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
    }, [Colors.error500, Colors.success500, Colors.warning500, myScore, oppScore]);

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
        [addressLabel, venueLabel]
    );

    const eloInfo = useMemo(() => {
        const current = Number(myTeam?.elo || 1200);
        const opponentElo = Number(opponent?.elo || 1200);
        const expectedWin = 1 / (1 + Math.pow(10, (opponentElo - current) / 400));
        const actualScore = myScore > oppScore ? 1 : myScore < oppScore ? 0 : 0.5;
        const delta = Math.round(32 * (actualScore - expectedWin));
        return {
            after: current,
            before: current - delta,
            delta,
        };
    }, [myScore, myTeam?.elo, oppScore, opponent?.elo]);

    const canRematch = useMemo(() => {
        const isCaptain = isSameId(myTeam?.captain?.documentId || myTeam?.captain?.id, currentUserId);
        return Boolean(isCaptain && match?.status === 'valid');
    }, [currentUserId, match?.status, myTeam?.captain?.documentId, myTeam?.captain?.id]);

    const handleRematch = () => {
        const myTeamDocId = myTeam?.documentId || myTeam?.id;
        const opponentDocId = opponent?.documentId || opponent?.id;

        if (!myTeamDocId || !opponentDocId) {
            Alert.alert('Erreur', 'Impossible de lancer la revanche pour ce match.');
            return;
        }

        Alert.alert(
            'Demander une revanche',
            `Voulez-vous demander une revanche contre ${opponent?.name || 'cette equipe'} ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Oui, revanche',
                    onPress: async () => {
                        setRequestingRematch(true);
                        try {
                            const result = await requestRematch(myTeamDocId, opponentDocId, matchId);
                            Alert.alert(
                                result?.matched ? 'Match cree' : 'Demande envoyee',
                                result?.message || 'Votre demande a bien ete envoyee.'
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
                },
            ]
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

    if (!match) {
        return (
            <ScreenContainer bgImage="bg2" style={[styles.screenContainer]}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={styles.centered}>
                        <Text style={[Fonts.p2, { color: Colors.neutral400 }]}>Match introuvable</Text>
                    </View>
                </SafeAreaView>
            </ScreenContainer>
        );
    }

    const goalsByPlayer = match?.player_goals && typeof match.player_goals === 'object'
        ? Object.entries(match.player_goals)
        : [];

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
                    <Text style={[Fonts.h3, styles.headerTitle, { color: Colors.neutral100 }]}>Match termine</Text>
                    <View style={styles.headerSide} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
                    </View>

                    <LeagueCard isGold style={styles.scoreCard}>
                        <View style={styles.matchupRow}>
                            <View style={styles.teamBlock}>
                                <TeamShield initials={teamA?.name?.substring(0, 2) || 'A'} size={62} />
                                <Text numberOfLines={1} style={[Fonts.p2Bold, styles.teamName, { color: Colors.neutral100 }]}>
                                    {teamA?.name || 'Equipe A'}
                                </Text>
                            </View>

                            <View style={styles.scoreBlock}>
                                <Text style={[Fonts.h1Bold, { color: Colors.neutral00 }]}>{match?.score_a ?? '-'}</Text>
                                <Text style={[Fonts.h2, { color: Colors.neutral300, marginHorizontal: 10 }]}>-</Text>
                                <Text style={[Fonts.h1Bold, { color: Colors.neutral00 }]}>{match?.score_b ?? '-'}</Text>
                            </View>

                            <View style={styles.teamBlock}>
                                {opponent?.crest?.url ? (
                                    <Image source={{ uri: getImageUrl(opponent.crest.url) }} style={styles.opponentCrest} />
                                ) : (
                                    <TeamShield initials={teamB?.name?.substring(0, 2) || 'B'} size={62} />
                                )}
                                <Text numberOfLines={1} style={[Fonts.p2Bold, styles.teamName, { color: Colors.neutral100 }]}>
                                    {teamB?.name || 'Equipe B'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.cardDivider} />

                        <View style={styles.infoRow}>
                            <Image source={Images.calendar} style={[styles.infoIcon, { tintColor: Colors.primary500 }]} />
                            <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>{formattedDate}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Image source={Images.pin} style={[styles.infoIcon, { tintColor: Colors.primary500 }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>{venueLabel}</Text>
                                {showAddressLine ? (
                                    <Text style={[Fonts.p3, { color: Colors.neutral400, marginTop: 2 }]}>{addressLabel}</Text>
                                ) : null}
                            </View>
                        </View>
                    </LeagueCard>

                    <LeagueCard style={styles.eloCard}>
                        <Text style={[Fonts.p2Bold, { color: Colors.neutral100, marginBottom: 12 }]}>Impact ELO</Text>
                        <View style={styles.eloRow}>
                            <View style={styles.eloCol}>
                                <Text style={[Fonts.p3, { color: Colors.neutral400 }]}>Avant</Text>
                                <Text style={[Fonts.h3, { color: Colors.neutral100, marginTop: 4 }]}>{eloInfo.before}</Text>
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
                                <Text style={[Fonts.h3, { color: resultConfig.color }]}>
                                    {eloInfo.delta > 0 ? '+' : ''}{eloInfo.delta}
                                </Text>
                            </View>

                            <View style={styles.eloCol}>
                                <Text style={[Fonts.p3, { color: Colors.neutral400 }]}>Apres</Text>
                                <Text style={[Fonts.h3, { color: Colors.neutral100, marginTop: 4 }]}>{eloInfo.after}</Text>
                            </View>
                        </View>
                    </LeagueCard>

                    {goalsByPlayer.length > 0 ? (
                        <LeagueCard style={styles.goalsCard}>
                            <Text style={[Fonts.p2Bold, { color: Colors.neutral100, marginBottom: 10 }]}>Buteurs</Text>
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
                                    <Text style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>Joueur {playerId.slice(0, 8)}...</Text>
                                    <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>{goals}</Text>
                                </View>
                            ))}
                        </LeagueCard>
                    ) : null}

                    {canRematch ? (
                        <Button
                            disabled={requestingRematch}
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
};

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
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        minWidth: 84,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    eloRow: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    goalRow: {
        alignItems: 'center',
        flexDirection: 'row',
        paddingVertical: 8,
    },
    goalsCard: {
        marginTop: 10,
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
    infoIcon: {
        height: 16,
        marginRight: 10,
        width: 16,
    },
    infoRow: {
        alignItems: 'flex-start',
        flexDirection: 'row',
        marginTop: 4,
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
    screenContainer: {
        paddingHorizontal: 0,
    },
    scrollContent: {
        paddingBottom: 44,
        paddingHorizontal: 16,
        paddingTop: 16,
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
