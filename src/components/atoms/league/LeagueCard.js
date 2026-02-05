import React from 'react';
import { View, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';

/**
 * Standardized Card component for League features.
 * Enforces consistency in background, radius, and spacing.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {import('react-native').ViewStyle} [props.style]
 * @param {boolean} [props.isGold] - If true, adds a gold border
 */
const LeagueCard = ({ children, style, isGold = false }) => {
    const { Colors, ApplicationStyle } = useTheme();

    return (
        <View style={[
            styles.card,
            { backgroundColor: Colors.card || '#1A1A1A', borderColor: Colors.border || '#333' },
            ApplicationStyle.borderRadius16, // Enforce Radius LG (16)
            isGold && { borderColor: Colors.gold500 || '#D4AF37', borderWidth: 1 },
            style
        ]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        padding: 16, // Spacing.lg
        marginBottom: 16, // Spacing.lg
        borderWidth: 1,
    }
});

export default LeagueCard;
