import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';
import LeagueCard from '@/components/atoms/league/LeagueCard';

/**
 * SearchCountdown Component
 * Displays elapsed search time (no auto-expiration).
 */
const SearchCountdown = ({ createdAt }) => {
    const { Colors, Fonts } = useTheme();
    const [elapsed, setElapsed] = useState(null);
    const leagueSurface = {
        backgroundColor: 'rgba(10, 28, 43, 0.82)',
        borderColor: 'rgba(1, 179, 244, 0.22)',
    };

    useEffect(() => {
        if (!createdAt) return;

        const updateElapsed = () => {
            const created = new Date(createdAt).getTime();
            if (Number.isNaN(created)) {
                setElapsed(null);
                return;
            }

            const diff = Math.max(0, Date.now() - created);
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diff % (1000 * 60)) / 1000);

            setElapsed({ hours, minutes, seconds });
        };

        updateElapsed();
        const interval = setInterval(updateElapsed, 1000);
        return () => clearInterval(interval);
    }, [createdAt]);

    if (!elapsed) return null;

    const formatNumber = (num) => String(num).padStart(2, '0');

    return (
        <LeagueCard style={[styles.container, leagueSurface]}>
            <View style={styles.header}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>⏱️</Text>
                <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
                    TEMPS DE RECHERCHE
                </Text>
            </View>

            <View style={styles.timerRow}>
                <View style={styles.timerBlock}>
                    <Text style={[styles.timerValue, { color: Colors.primary500 || '#01B3F4' }]}>
                        {formatNumber(elapsed.hours)}
                    </Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>H</Text>
                </View>

                <Text style={[styles.separator, { color: Colors.primary500 || '#01B3F4' }]}>:</Text>

                <View style={styles.timerBlock}>
                    <Text style={[styles.timerValue, { color: Colors.primary500 || '#01B3F4' }]}>
                        {formatNumber(elapsed.minutes)}
                    </Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>M</Text>
                </View>

                <Text style={[styles.separator, { color: Colors.primary500 || '#01B3F4' }]}>:</Text>

                <View style={styles.timerBlock}>
                    <Text style={[styles.timerValue, { color: Colors.primary500 || '#01B3F4' }]}>
                        {formatNumber(elapsed.seconds)}
                    </Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>S</Text>
                </View>
            </View>
        </LeagueCard>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingVertical: 16,
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    timerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timerBlock: {
        alignItems: 'center',
        marginHorizontal: 4,
    },
    timerValue: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    separator: {
        fontSize: 28,
        fontWeight: 'bold',
        marginHorizontal: 2,
    },
});

export default SearchCountdown;
