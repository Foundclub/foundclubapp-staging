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
  const recruitmentSurface = `${Colors.primary900}F0`;
  const recruitmentSurfaceSoft = `${Colors.primary500}14`;
  const recruitmentBorder = `${Colors.primary500}2E`;
  const recruitmentMutedText = `${Colors.neutral100}C4`;

  const avatarSource = user.avatar?.url
    ? { uri: getImageUrl(user.avatar.url) }
    : Images.roundAvatar;

  // Data for badges
  const position = user.position || 'Joueur';
  const category = user.category || user.section?.name;
  const preferredSport = user.preferredSport || null;
  const currentClubName = user.club?.name || '';
  const headerSubtitle = currentClubName || 'Ouvert au recrutement';

  return (
    <TouchableOpacity
      onPress={() => onPress && onPress(user)}
      style={[
        {
          backgroundColor: recruitmentSurface,
          borderColor: recruitmentBorder,
          borderRadius: 20,
          borderWidth: 1,
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
        backgroundColor: recruitmentSurfaceSoft,
        borderColor: Colors.primary500,
        borderRadius: 36,
        borderWidth: 1,
        padding: 3,
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
        <Text numberOfLines={1} style={[Fonts.p3, { color: recruitmentMutedText }]}>
          {headerSubtitle}
        </Text>

        {/* Badges Row */}
        <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
          <View style={{
            backgroundColor: Colors.primary500,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral900 }]}>
              {position}
            </Text>
          </View>

          {category && (
          <View style={{
            backgroundColor: recruitmentSurfaceSoft,
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>
              {category}
            </Text>
          </View>
          )}

          {preferredSport ? (
            <View style={{
              backgroundColor: recruitmentSurfaceSoft,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>
                {preferredSport}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={{
        alignItems: 'center',
        backgroundColor: recruitmentSurfaceSoft,
        borderRadius: 999,
        height: 32,
        justifyContent: 'center',
        width: 32,
      }}
      >
        <Image
          source={Images.arrowRight}
          style={{
            height: 16,
            resizeMode: 'contain',
            tintColor: Colors.primary500,
            width: 16,
          }}
        />
      </View>
    </TouchableOpacity>
  );
}

export default MercatoCard;
