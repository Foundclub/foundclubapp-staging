import React from 'react';
import { Image, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * StatRow component - displays a player's statistics in a row
 * @param {object} props
 * @param {object} props.player - Player data with user info and stats
 * @param {Array<{key: string, label: string}>} props.columns - Column definitions
 * @param {boolean} [props.isEven] - For zebra striping
 * @returns {React.ReactElement}
 */
const StatRow = ({ player, columns, isEven = false }) => {
  const { Alignments, Colors, Fonts, Images, Spaces } = useTheme();

  const avatarSource = player.user?.avatar?.url
    ? { uri: player.user.avatar.url }
    : Images.roundAvatar;

  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.padding[12],
        Spaces.gap[12],
        {
          backgroundColor: isEven ? Colors.neutral800 : Colors.neutral900,
          borderRadius: 8,
        },
      ]}
    >
      {/* Avatar + Name */}
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
        <Image
          source={avatarSource}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: Colors.neutral700,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]} numberOfLines={1}>
            {player.user?.firstname} {player.user?.lastname}
          </Text>
          {player.user?.position && (
            <Text style={[Fonts.p3, { color: Colors.neutral400 }]} numberOfLines={1}>
              {player.user.position}
            </Text>
          )}
        </View>
      </View>

      {/* Stats Columns */}
      <View style={[Alignments.row, Spaces.gap[8]]}>
        {columns.map((col) => (
          <View
            key={col.key}
            style={[
              Alignments.alignCenter,
              {
                width: 40,
                paddingVertical: 4,
                paddingHorizontal: 2,
                backgroundColor: col.isPrimary ? Colors.primary500 + '20' : 'transparent',
                borderRadius: 4,
              },
            ]}
          >
            <Text
              style={[
                Fonts.p3Bold,
                { color: col.isPrimary ? Colors.primary500 : Colors.neutral200 },
              ]}
            >
              {player[col.key] ?? 0}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

export default StatRow;
