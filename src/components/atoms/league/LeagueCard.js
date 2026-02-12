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
  const baseBackground = Colors.card && Colors.card !== Colors.neutral00
    ? Colors.card
    : 'rgba(9, 27, 42, 0.84)';
  const baseBorder = Colors.border && Colors.border !== Colors.neutral00
    ? Colors.border
    : 'rgba(1, 179, 244, 0.22)';

  return (
    <View style={[
      styles.card,
      { backgroundColor: baseBackground, borderColor: baseBorder },
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
    elevation: 2,
    padding: 16, // Spacing.lg
    marginBottom: 16, // Spacing.lg
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  }
});

export default LeagueCard;
