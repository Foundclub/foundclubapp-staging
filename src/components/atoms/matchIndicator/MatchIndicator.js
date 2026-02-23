import React from 'react';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Match Indicator Component
 * Displays a compatibility score with a visual gauge
 * @param {number} score - Compatibility score (0-100)
 */
function MatchIndicator({ score }) {
  const { Colors, Fonts } = useTheme();

  // Determine color based on score
  const getColor = () => {
    if (score >= 80) return Colors.primary500; // High match
    if (score >= 50) return '#FFB800'; // Medium match (Orange/Yellow)
    return Colors.neutral500; // Low match
  };

  const color = getColor();

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row' }}>
      {/* Circular Gauge or simple Badge */}
      <View style={{
        alignItems: 'center',
        backgroundColor: `${color}20`, // 20% opacity background
        borderColor: color,
        borderRadius: 8,
        borderWidth: 1,
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
      }}
      >
        <Text style={[Fonts.p3Bold, { color }]}>
          {Math.round(score)}
          % Match
        </Text>
      </View>
    </View>
  );
}

export default MatchIndicator;
