import { StyleSheet, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Standardized Card component for League features.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {import('react-native').ViewStyle | import('react-native').ViewStyle[]} [props.style]
 * @param {boolean} [props.isGold]
 * @returns {import('react').ReactElement}
 */
function LeagueCard({ children, isGold = false, style }) {
  const { ApplicationStyle, Colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        ApplicationStyle.card,
        isGold && { borderColor: Colors.gold500 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    elevation: 2,
    marginBottom: 16,
    padding: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
});

export default LeagueCard;
