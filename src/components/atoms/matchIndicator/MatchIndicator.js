import React from 'react';
import { View, Text } from 'react-native';
import useTheme from '@/theme/themeContext';

/**
 * Match Indicator Component
 * Displays a compatibility score with a visual gauge
 * @param {number} score - Compatibility score (0-100)
 */
const MatchIndicator = ({ score }) => {
  const { Colors, Fonts } = useTheme();

  // Determine color based on score
  const getColor = () => {
    if (score >= 80) return Colors.primary500; // High match
    if (score >= 50) return '#FFB800'; // Medium match (Orange/Yellow)
    return Colors.neutral500; // Low match
  };

  const color = getColor();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {/* Circular Gauge or simple Badge */}
      <View style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        backgroundColor: color + '20', // 20% opacity background
        borderWidth: 1,
        borderColor: color,
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Text style={[Fonts.p3Bold, { color: color }]}>
          {Math.round(score)}% Match
        </Text>
      </View>
    </View>
  );
};

export default MatchIndicator;
