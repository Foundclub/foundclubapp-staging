import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import useTheme from '@/theme/themeContext';
import Button from '@/components/atoms/button/Button';
import FutCard from '@/components/organisms/league/FutCard';
import { getMatchDetails, reportMatchResult, confirmMatch, disputeMatch } from '@/services/league/MatchService';
import ReportResultModal from './ReportResultModal';
import useAuth from '@/domains/auth/useAuth';

export default function MatchDetailsScreen({ route, navigation }) {
    const { matchId } = route.params;
    const { Colors, Fonts, Spaces } = useTheme();
    const { userData } = useAuth();
    
    const [match, setMatch] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        // Mock load for testing UI without real backend data
        if (matchId === 'test-match-1') {
             setMatch({
                id: 'test-1',
                attributes: {
                    date: new Date().toISOString(),
                    status: 'scheduled',
                    team_a: { data: { attributes: { name: 'FC Barcelona', captain: { data: { id: userData?.id } } } } },
                    team_b: { data: { attributes: { name: 'Real Madrid', captain: { data: { id: 'other' } } } } },
                    score_a: null,
                    score_b: null,
                }
             });
             return;
        }
        loadMatch();
    }, [matchId]);

    const loadMatch = async () => {
        try {
            const data = await getMatchDetails(matchId);
            setMatch(data.data);
        } catch (e) {
            console.error(e);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadMatch();
        setRefreshing(false);
    };

    const handleReport = async ({ scoreA, scoreB, photo }) => {
        setLoading(true);
        try {
            await reportMatchResult({
                matchId,
                scoreA,
                scoreB,
                photo
            });
            setModalVisible(false);
            alert('Result submitted for validation!');
            loadMatch();
        } catch (e) {
            console.error(e);
            alert('Failed to report result');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            await confirmMatch(matchId);
            alert('Match Confirmed! ELO Updated.');
            loadMatch();
        } catch (e) {
            console.error(e);
            alert('Error confirming match');
        } finally {
            setLoading(false);
        }
    };

    const handleDispute = async () => {
        setLoading(true);
        try {
            await disputeMatch(matchId);
            alert('Match Disputed. Admin will review.');
            loadMatch();
        } catch (e) {
            console.error(e);
            alert('Error disputing match');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <View style={[styles.center, { backgroundColor: Colors.neutral900 }]}><Text style={{color: Colors.neutral00}}>Processing...</Text></View>;
    if (!match) return <View style={[styles.center, { backgroundColor: Colors.neutral900 }]}><Text style={{color: Colors.neutral00}}>Match not found</Text></View>;

    const { attributes } = match;
    const isCaptain = userData?.id === attributes.team_a?.data?.attributes?.captain?.data?.id || 
                      userData?.id === attributes.team_b?.data?.attributes?.captain?.data?.id;

    return (
        <View style={{ flex: 1, backgroundColor: Colors.neutral900 }}>
            <ScrollView 
                contentContainerStyle={[Spaces.padding[20]]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.gold500} />}
            >
                <Text style={[Fonts.h2, { color: Colors.gold500, textAlign: 'center', marginBottom: 20 }]}>
                    Match Details
                </Text>


            <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 30 }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <FutCard team={attributes.team_a?.data?.attributes || { name: 'Team A' }} />
                </View>
                <Text style={[Fonts.h1, { color: Colors.gold500 }]}>VS</Text>
                <View style={{ flex: 1, alignItems: 'center' }}>
                    <FutCard team={attributes.team_b?.data?.attributes || { name: 'Team B' }} />
                </View>
            </View>

            <View style={[styles.infoBox, { backgroundColor: Colors.neutral800 }]}>
                <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>Status: {attributes.status}</Text>
                <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>Date: {new Date(attributes.date).toLocaleDateString()}</Text>
            </View>

            {attributes.status === 'scheduled' && isCaptain && (
                <Button 
                    title="Report Result" 
                    variant="Primary"
                    onPress={() => setModalVisible(true)}
                    style={{ marginTop: 20 }}
                />
            )}

            {attributes.status === 'pending_validation' && isCaptain && (
                <View style={{ gap: 10, marginTop: 20, width: '100%' }}>
                    <Text style={[Fonts.p2, { color: Colors.warning500, textAlign: 'center' }]}>
                        Action Required: Validate Result
                    </Text>
                    <View style={[styles.scoreBoard, { backgroundColor: Colors.neutral800, borderColor: Colors.gold500 }]}>
                        <Text style={[Fonts.h1, { color: Colors.gold500 }]}>
                           Proposed: {attributes.score_a} - {attributes.score_b}
                        </Text>
                    </View>
                    <Button 
                        title="Confirm Result" 
                        variant="Primary"
                        onPress={handleConfirm}
                        isLoading={loading}
                    />
                    <Button 
                        title="Dispute Result" 
                        variant="Secondary"
                        onPress={handleDispute}
                        isLoading={loading}
                    />
                </View>
            )}

            { attributes.status === 'valid' && (
                <View style={[styles.scoreBoard, { backgroundColor: Colors.neutral800, borderColor: Colors.success500 }]}>
                    <Text style={[Fonts.h1, { color: Colors.neutral00 }]}>
                        {attributes.score_a} - {attributes.score_b}
                    </Text>
                    <Text style={[Fonts.p2, { color: Colors.success500, marginTop: 5 }]}>
                        Match Validated
                    </Text>
                </View>
            )}

            <ReportResultModal 
                visible={modalVisible} 
                onClose={() => setModalVisible(false)} 
                onSubmit={handleReport}
                isLoading={loading}
            />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    infoBox: {
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        gap: 5
    },
    scoreBoard: {
        marginTop: 20,
        padding: 20,
        borderRadius: 10,
        alignItems: 'center',
        borderWidth: 1,
    }
});
