import React from 'react';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * MercatoCard component
 * @param {object} props
 * @param {object} props.user
 * @param {Function} [props.onPress]
 * @returns {React.ReactElement}
 */
function MercatoCard({ onPress, user }) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();

  const avatarSource = user.avatar?.url
    ? { uri: getImageUrl(user.avatar.url) }
    : Images.roundAvatar;

  // Data for badges
  const position = user.position || 'Joueur';
  const category = user.category || user.section?.name;

  return (
    <TouchableOpacity
      onPress={() => onPress && onPress(user)}
      style={[
        {
          backgroundColor: Colors.neutral800,
          borderColor: Colors.neutral700,
          borderRadius: 16,
          borderWidth: 1,
          // Shadow for depth
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { height: 2, width: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        },
        Spaces.padding[16],
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[16],
      ]}
    >
      {/* Avatar with Status Border */}
      <View style={{
        backgroundColor: Colors.primary500, // Primary border for "Looking for club"
        borderRadius: 32,
        padding: 2,
      }}
      >
        <Image
          source={avatarSource}
          style={{
            backgroundColor: Colors.neutral200,
            borderRadius: 30,
            height: 60,
            width: 60,
          }}
        />
      </View>

      {/* Info Section */}
      <View style={[Alignments.fill, Spaces.gap[8]]}>
        {/* Name */}
        <Text style={[Fonts.h4, { color: Colors.neutral100 }]}>
          {user.firstname}
          {' '}
          {user.lastname}
        </Text>

        {/* Badges Row */}
        <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
          {/* Position Badge (Priority) - Solid Style */}
          <View style={{
            backgroundColor: Colors.primary500,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>
              {position}
            </Text>
          </View>

          {/* Category Badge (if available) */}
          {category && (
          <View style={{
            backgroundColor: Colors.neutral700,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>
              {category}
            </Text>
          </View>
          )}
        </View>
      </View>

      {/* Action Button - Simple Chevron */}
      <Image
        source={Images.arrowRight}
        style={{
          height: 20,
          resizeMode: 'contain',
          tintColor: Colors.neutral500,
          width: 20,
        }}
      />
    </TouchableOpacity>
  );
}

export default MercatoCard;
