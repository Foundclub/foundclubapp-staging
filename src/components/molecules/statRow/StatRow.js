import React from 'react';
import { Image, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * StatRow component - displays a player's statistics in a row
 * @param {object} props
 * @param {object} props.player - Player data with user info and stats
 * @param {Array<{key: string, label: string}>} props.columns - Column definitions
 * @param {boolean} [props.isEven] - For zebra striping
 * @returns {React.ReactElement}
 */
function StatRow({ columns, isEven = false, player }) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();

  const avatarSource = player.user?.avatar?.url
    ? { uri: getImageUrl(player.user.avatar.url) }
    : Images.roundAvatar;

  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.padding[12],
        Spaces.gap[12],
        {
          backgroundColor: isEven ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
          borderColor: isEven ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
          borderRadius: 12,
          borderWidth: 1,
        },
      ]}
    >
      {/* Player Column - Bigger Avatar and Name */}
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 2 }]}>
        <Image
          source={avatarSource}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderColor: Colors.neutral600,
            borderRadius: 25,
            borderWidth: 1,
            height: 50,
            width: 50,
          }}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
            {player.user?.firstname}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
            {player.user?.lastname}
          </Text>
          {player.user?.position && (
            <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300, marginTop: 2 }]}>
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
              Alignments.justifyCenter,
              {
                backgroundColor: col.key === 'attendanceCount' ? 'rgba(22, 163, 74, 0.15)' : 'transparent',
                borderColor: col.key === 'attendanceCount' ? 'rgba(22, 163, 74, 0.3)' : 'transparent',
                borderRadius: 8,
                borderWidth: col.key === 'attendanceCount' ? 1 : 0,
                paddingVertical: 6,
                width: 44,
              },
            ]}
          >
            <Text
              style={[
                Fonts.p3Bold,
                {
                  color: col.key === 'attendanceCount' ? '#4ade80'
                    : col.key === 'absenceCount' ? '#f87171' // Red for Absence
                      : col.key === 'retardCount' || col.key === 'lateCount' ? '#fbbf24' // Amber for Retard
                        : Colors.neutral100,
                  textAlign: 'center',
                },
              ]}
            >
              {player[col.key] ?? 0}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default StatRow;
