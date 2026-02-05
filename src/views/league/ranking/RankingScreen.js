import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { getRanking, getMyLeagueTeam } from '@/services/leagueTeam/leagueTeamService';
import SectionHeader from '@/components/atoms/SectionHeader/SectionHeader';
import useAuth from '@/domains/auth/useAuth';

const RankingScreen = () => {
    const { Colors, Fonts, Images } = useTheme();
    const navigation = useNavigation();
    const { userData } = useAuth();
    const [ranking, setRanking] = useState([]);
    const [loading, setLoading] = useState(true);
    const [division, setDivision] = useState(10); // Default division

    // Load User Team to set initial Division
    useEffect(() => {
        const init = async () => {
            if (userData) {
                try {
                    const teams = await getMyLeagueTeam(userData.documentId);
                    if (teams && teams.length > 0) {
                        setDivision(teams[0].division || 10);
                    }
                } catch (e) { console.log(e); }
            }
        };
        init();
    }, [userData]);

    // Load data
    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getRanking(division);
            setRanking(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [division]);

    const changeDivision = (delta) => {
        const newDiv = division + delta;
        if (newDiv >= 1 && newDiv <= 10) setDivision(newDiv);
    };

    const renderItem = ({ item, index }) => {
        return (
            <TouchableOpacity 
                style={[styles.row, { borderBottomColor: Colors.neutral800, backgroundColor: Colors.neutral900 }]}
                // onPress={() => navigation.navigate('TeamDetails', { id: item.documentId })}
            >
                <View style={styles.rankCol}>
                    <Text style={[Fonts.h3, { color: index < 3 ? Colors.gold500 : Colors.neutral300 }]}>
                        {index + 1}
                    </Text>
                </View>
                
                <View style={[styles.teamCol]}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.neutral800, marginRight: 12, overflow: 'hidden' }}>
                        {item.crest?.url ? (
                            <Image source={{ uri: item.crest.url }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <Text style={[Fonts.p3Bold, { color: Colors.neutral500 }]}>{item.name.substring(0, 2).toUpperCase()}</Text>
                            </View>
                        )}
                    </View>
                    <View>
                        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{item.name}</Text>
                        <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>{item.wins}V - {item.draws}N - {item.losses}D</Text>
                    </View>
                </View>

                <View style={styles.pointsCol}>
                    <Text style={[Fonts.h3, { color: Colors.primary500 }]}>{item.elo}</Text>
                    <Text style={[Fonts.p3, { color: Colors.primary500, opacity: 0.7 }]}>PTS</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenContainer bgImage="bg2">
            <View style={{ flex: 1, paddingTop: 60, paddingHorizontal: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                     <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
                        <Text style={{ color: Colors.neutral00, fontSize: 24 }}>←</Text>
                     </TouchableOpacity>
                     <Text style={[Fonts.h1, { color: Colors.neutral00 }]}>CLASSEMENT</Text>
                     <View style={{ width: 40 }} />
                </View>

                {/* Division Selector */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <TouchableOpacity onPress={() => changeDivision(-1)} style={{ padding: 10 }}>
                        <Text style={[Fonts.h2, { color: Colors.gold500 }]}>◀</Text>
                    </TouchableOpacity>
                    <Text style={[Fonts.h2, { color: Colors.neutral00, marginHorizontal: 20 }]}>DIVISION {division}</Text>
                    <TouchableOpacity onPress={() => changeDivision(1)} style={{ padding: 10 }}>
                        <Text style={[Fonts.h2, { color: Colors.gold500 }]}>▶</Text>
                    </TouchableOpacity>
                </View>

                {/* Header */}
                <View style={[styles.headerRow, { borderBottomColor: Colors.neutral700 }]}>
                    <Text style={[Fonts.p3Bold, { color: Colors.neutral500, width: 40, textAlign: 'center' }]}>#</Text>
                    <Text style={[Fonts.p3Bold, { color: Colors.neutral500, flex: 1 }]}>ÉQUIPE</Text>
                    <Text style={[Fonts.p3Bold, { color: Colors.neutral500, width: 60, textAlign: 'center' }]}>ELO</Text>
                </View>

                <FlatList
                    data={ranking}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={loadData} tintColor={Colors.primary500} />
                    }
                    contentContainerStyle={{ paddingBottom: 40 }}
                />
            </View>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        marginBottom: 8,
        borderRadius: 12,
        paddingHorizontal: 12
    },
    headerRow: {
        flexDirection: 'row',
        paddingVertical: 8,
        borderBottomWidth: 1,
        marginBottom: 8,
        paddingHorizontal: 12
    },
    rankCol: {
        width: 30,
        alignItems: 'center',
        marginRight: 8
    },
    teamCol: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center'
    },
    pointsCol: {
        width: 60,
        alignItems: 'center'
    }
});

export default RankingScreen;
