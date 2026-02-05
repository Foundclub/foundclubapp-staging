import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';
import LeagueCard from '@/components/atoms/league/LeagueCard';

/**
 * SearchCountdown Component
 * Shows remaining time before matchmaking request expires (24h timeout)
 */
const SearchCountdown = ({ createdAt, onExpired }) => {
    const { Colors, Fonts } = useTheme();
    const [timeRemaining, setTimeRemaining] = useState(null);

    const TIMEOUT_HOURS = 24;

    useEffect(() => {
        if (!createdAt) return;

        const calculateRemaining = () => {
            const created = new Date(createdAt).getTime();
            const expiresAt = created + (TIMEOUT_HOURS * 60 * 60 * 1000);
            const now = Date.now();
            const remaining = expiresAt - now;

            if (remaining <= 0) {
                setTimeRemaining(null);
                onExpired?.();
                return;
            }

            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            setTimeRemaining({ hours, minutes, seconds, total: remaining });
        };

        calculateRemaining();
        const interval = setInterval(calculateRemaining, 1000);
        return () => clearInterval(interval);
    }, [createdAt]);

    if (!timeRemaining) return null;

    const isUrgent = timeRemaining.hours < 2;
    const urgentColor = isUrgent ? Colors.error500 || '#f44336' : Colors.primary500 || '#d4af37';

    const formatNumber = (num) => String(num).padStart(2, '0');

    return (
        <LeagueCard style={[styles.container, isUrgent && { borderColor: urgentColor, borderWidth: 1 }]}>
            <View style={styles.header}>
                <Text style={{ fontSize: 16, marginRight: 8 }}>⏱️</Text>
                <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
                    TEMPS RESTANT
                </Text>
            </View>

            <View style={styles.timerRow}>
                <View style={styles.timerBlock}>
                    <Text style={[styles.timerValue, { color: urgentColor }]}>
                        {formatNumber(timeRemaining.hours)}
                    </Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>H</Text>
                </View>

                <Text style={[styles.separator, { color: urgentColor }]}>:</Text>

                <View style={styles.timerBlock}>
                    <Text style={[styles.timerValue, { color: urgentColor }]}>
                        {formatNumber(timeRemaining.minutes)}
                    </Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>M</Text>
                </View>

                <Text style={[styles.separator, { color: urgentColor }]}>:</Text>

                <View style={styles.timerBlock}>
                    <Text style={[styles.timerValue, { color: urgentColor }]}>
                        {formatNumber(timeRemaining.seconds)}
                    </Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral500 }]}>S</Text>
                </View>
            </View>

            {isUrgent && (
                <Text style={[Fonts.p3, { color: Colors.error500, textAlign: 'center', marginTop: 8 }]}>
                    ⚠️ La recherche expire bientôt !
                </Text>
            )}
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
    }
});

export default SearchCountdown;
