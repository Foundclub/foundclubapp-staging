import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { formatDateWithDayPrefix } from '@/utils/date';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';
import { getImageUrl } from '@/utils/imageUrl';

/**
 * @typedef {{
 *  type?: { name?: string };
 *  team?: { club?: Club };
 *  club?: Club;
 *  locationDetails?: string;
 *  location?: string;
 *  pricePerPerson?: number;
 *  startTime?: string;
 *  endTime?: string;
 *  date?: string;
 * }} FeaturedReservation
 */

/**
 * @param {string | undefined} input
 * @returns {string}
 */
const getShortAddress = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input.split(',').slice(0, 2).join(',').trim();
};

/**
 * FeaturedReservationCard component - Styled like Planning Card
 * Dimensions: Width 335, Flexible Height (matching Planning style)
 * @param {{
 *  actionLabel?: string;
 *  item: FeaturedReservation;
 *  onPress?: (item: FeaturedReservation) => void;
 *  onParticipate?: (item: FeaturedReservation) => void;
 *  style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
 * }} props
 * @returns {import('react').ReactElement}
 */
function FeaturedReservationCard({
  actionLabel, item, onPress, onParticipate, style,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { getClubInitials } = useClub();

  // Get sponsors from team's club
  const sponsors = item?.team?.club?.sponsor || item?.club?.sponsor || [];

  // Parse location
  const getLocation = () => {
    return getShortAddress(
      item.locationDetails ||
      item.club?.addressDetails ||
      item.team?.club?.addressDetails ||
      item.location
    );
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onPress?.(item)}
      style={[
        styles.container,
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius24,
        { padding: moderateScale(24) },
        Alignments.justifySpaceBetween,
        style,
      ]}
    >
      <View style={[Alignments.fullWidth, { gap: verticalScale(12) }]}>
        {/* Header Section */}
        <View style={[Alignments.fullWidth]}>
          <View style={[Alignments.fullWidth, Alignments.alignEnd]}>
            {item?.type ? (
              <View style={{
                paddingVertical: 4,
                paddingHorizontal: 16,
                height: 22,
                borderRadius: 7.33,
                borderWidth: 0.43,
                borderColor: '#01B3F4',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <Text style={[Fonts.p3, {
                  fontSize: 12,
                  color: '#01B3F4',
                  lineHeight: 18,
                }]}>
                  {item?.type?.name || ''}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={[
            Alignments.row,
            Alignments.fullWidth,
            Alignments.alignCenter,
            { gap: horizontalScale(8) },
          ]}
          >
            {(item?.team?.club?.logo?.url || item?.club?.logo?.url) ? (
              <ProfileAvatar
                imageUrl={item?.team?.club?.logo?.url || item?.club?.logo?.url}
                size={moderateScale(40)}
                style={{ borderRadius: moderateScale(20) }}
                imageStyle={{ borderRadius: moderateScale(20) }}
              />
            ) : (
              <TeamShield
                initials={item?.team?.club?.name ? getClubInitials(item?.team?.club?.name) : ''}
                isSmall
                size={moderateScale(40)}
              />
            )}
            <View style={[{ gap: verticalScale(4) }, { maxWidth: '80%' }]}>
              <Text
                ellipsizeMode="tail"
                numberOfLines={2}
                style={[Fonts.p1Bold, Fonts.neutral00]}
              >
                {item?.team?.club?.name || item?.club?.name || 'FoundClub'}
              </Text>
            </View>
          </View>
        </View>

        {/* Sponsors Section (Unique to Featured) */}
        {sponsors.length > 0 && (
          <View style={[Alignments.fullWidth, { marginTop: verticalScale(8) }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[{ gap: horizontalScale(12) }]}
            >
              {sponsors.map((/** @type {Sponsor} */ sponsor, idx) => (
                <TouchableOpacity
                  key={sponsor.link || idx}
                  onPress={() => {
                    if (sponsor.link) {
                      Linking.openURL(sponsor.link);
                    }
                  }}
                  style={styles.sponsorWrapper}
                >
                  <Image
                    source={{ uri: getImageUrl(sponsor.logo?.url) }}
                    style={styles.sponsorLogo}
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Info Section */}
        <View style={[
          Alignments.alignCenter,
          { gap: horizontalScale(8) },
          Alignments.row,
          Alignments.wrap,
        ]}
        >
          {/* Price */}
          {item?.pricePerPerson !== undefined && (
            <View style={[Alignments.row, { gap: horizontalScale(8) }, { marginRight: horizontalScale(16) }]}>
              <Image
                source={Images.euroCircle}
                style={[{ width: moderateScale(22), height: moderateScale(22) }, ApplicationStyle.tintColor.neutral00]}
              />
              <Text style={[Fonts.p2, { fontSize: moderateScale(12), lineHeight: moderateScale(14), color: '#FFFFFF' }]}>
                {item.pricePerPerson === 0 ? 'Gratuit' : `${item.pricePerPerson}€`}
              </Text>
            </View>
          )}

          {/* Activity */}
          <View style={[Alignments.row, { gap: horizontalScale(8) }, { marginRight: horizontalScale(16) }]}>
            <Image
              source={Images.running}
              style={[{ width: moderateScale(22), height: moderateScale(22) }, ApplicationStyle.tintColor.neutral00]}
            />
            <Text style={[Fonts.p2, { fontSize: moderateScale(12), lineHeight: moderateScale(14), color: '#FFFFFF' }]}>
              {item?.type?.name || 'Sport'}
            </Text>
          </View>

          {/* Time */}
          {item?.startTime && item?.endTime && (
            <View style={[Alignments.row, { gap: horizontalScale(8) }, { marginRight: horizontalScale(16) }]}>
              <Image
                source={Images.clock}
                style={[{ width: moderateScale(22), height: moderateScale(22) }, ApplicationStyle.tintColor.neutral00]}
              />
              <Text style={[Fonts.p2, { fontSize: moderateScale(12), lineHeight: moderateScale(14), color: '#FFFFFF' }]}>
                {item.startTime.substring(0, 5)} - {item.endTime.substring(0, 5)}
              </Text>
            </View>
          )}

          {/* Date */}
          {item?.date && (
            <View style={[Alignments.row, { gap: horizontalScale(8) }, { marginRight: horizontalScale(16) }]}>
              <Image
                source={Images.calendar}
                style={[{ width: moderateScale(22), height: moderateScale(22) }, ApplicationStyle.tintColor.neutral00]}
              />
              <Text style={[Fonts.p2, { fontSize: moderateScale(12), lineHeight: moderateScale(14), color: '#FFFFFF' }]}>
                {formatDateWithDayPrefix(item.date)}
              </Text>
            </View>
          )}

          {/* Address */}
          <View style={[Alignments.row, { gap: horizontalScale(8) }, { marginRight: horizontalScale(16) }]}>
            <Image
              source={Images.pin}
              style={[{ width: moderateScale(22), height: moderateScale(22) }, ApplicationStyle.tintColor.neutral00]}
            />
            <Text
              numberOfLines={1}
              style={[Fonts.p2, { fontSize: moderateScale(12), lineHeight: moderateScale(14), color: '#FFFFFF', maxWidth: horizontalScale(150) }]}
            >
              {getLocation() || 'Lieu non défini'}
            </Text>
          </View>
        </View>
      </View>

      {/* Button */}
      <View style={{ marginTop: verticalScale(16) }}>
        <TouchableOpacity
          onPress={() => onParticipate?.(item)}
          style={[
            Alignments.fullWidth,
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              height: verticalScale(43),
              backgroundColor: '#01B3F4',
              borderRadius: moderateScale(20),
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, { fontSize: moderateScale(13), color: '#001218' }]}>
            {actionLabel || t('reservation.actions.participate') || 'Réserver'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

import { Dimensions } from 'react-native';
import { horizontalScale, verticalScale, moderateScale } from '@/theme/scaling';

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    width: horizontalScale(335),
    minHeight: verticalScale(280), // Increased from 262
    paddingVertical: verticalScale(6),
    paddingHorizontal: horizontalScale(16),
  },
  sponsorWrapper: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: moderateScale(15),
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  sponsorLogo: {
    width: '80%',
    height: '80%',
    resizeMode: 'contain',
  },
});

export default FeaturedReservationCard;
