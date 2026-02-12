import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';
import LeagueCard from '@/components/atoms/league/LeagueCard';

/**
 * Hero component for League Dashboard.
 * Displays ELO, Division, and Promotion/Relegation progress.
 * @param {object} props
 * @param {number} props.elo
 * @param {number|string} props.division
 * @param {number} props.rank
 * @param {string} props.teamName
 */
const CompetitiveHero = ({ elo = 1200, division = 10, rank = '-', teamName, nextDivisionElo = 1300 }) => {
    const { Colors, Fonts, Spaces } = useTheme();
    const leagueSurface = {
        backgroundColor: 'rgba(10, 28, 43, 0.82)',
        borderColor: 'rgba(212, 175, 55, 0.45)',
    };

    // Calculate progress: 0% at 100 pts below target (arbitrary floor for visualisation) or simply based on a range.
    // For simplicity: Let's say the range is 200pts wide.
    const range = 200;
    const minElo = nextDivisionElo - range;
    const progress = Math.min(Math.max(((elo - minElo) / range) * 100, 0), 100);

    return (
        <LeagueCard isGold={true} style={[styles.container, leagueSurface]}>
            <View style={{ alignItems: 'center' }}>
                <Text style={[Fonts.h4, { color: Colors.gold500, letterSpacing: 2, marginBottom: 4 }]}>
                    DIVISION {division}
                </Text>
                
                <View style={{ marginVertical: 12, alignItems: 'center' }}>
                    <Text style={[Fonts.h1Bold, { fontSize: 48, color: Colors.neutral00, lineHeight: 56 }]}>
                        {elo}
                    </Text>
                    <Text style={[Fonts.p3Bold, { color: Colors.neutral300, textTransform: 'uppercase' }]}>
                        POINTS ELO
                    </Text>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, width: '100%' }}>
                        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>Division {division}</Text>
                        <Text style={[Fonts.p3, { color: Colors.gold500 }]}>
                             {nextDivisionElo} PTS <Text style={{ fontSize: 10, color: Colors.neutral300 }}>(PROMOTION)</Text>
                        </Text>
                     </View>
                     <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                         <View style={[styles.bar, { width: `${progress}%`, backgroundColor: Colors.gold500 }]} />
                     </View>
                     <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 4, width: '100%', textAlign: 'center' }]}>
                        <Text style={{ color: Colors.gold500 }}>{nextDivisionElo - elo}</Text> points pour la promotion
                     </Text>
                </View>

                {/* Footer Infos */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 16 }}>
                    <View>
                        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>SQUAD</Text>
                        <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>{teamName || 'Mon Équipe'}</Text>
                    </View>
                   <View style={{ alignItems: 'flex-end'}}>
                        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>RANK</Text>
                        <Text style={[Fonts.h4, { color: Colors.gold500 }]}>#{rank}</Text>
                    </View>
                </View>
            </View>
        </LeagueCard>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: 24,
    },
    progressContainer: {
        width: '100%',
        marginTop: 8,
    },
    track: {
        height: 6,
        borderRadius: 3,
        width: '100%',
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: 3,
    }
});

export default CompetitiveHero;
