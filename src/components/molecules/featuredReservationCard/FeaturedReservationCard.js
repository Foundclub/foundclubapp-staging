import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import {
  Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity,
  View,
} from 'react-native';

import { horizontalScale, moderateScale, verticalScale } from '@/theme/scaling';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import Tag from '@/components/atoms/tag/Tag';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { formatDateWithDayPrefix } from '@/utils/date';

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
  actionLabel, item, onParticipate, onPress, style,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();

  // Get sponsors from team's club
  const sponsors = item?.team?.club?.sponsor || item?.club?.sponsor || [];

  // Parse location
  const getLocation = () => getShortAddress(
    item.locationDetails
      || item.club?.addressDetails
      || item.team?.club?.addressDetails
      || item.location,
  );

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
                alignItems: 'center',
                borderColor: '#01B3F4',
                borderRadius: 7.33,
                borderWidth: 0.43,
                height: 22,
                justifyContent: 'center',
                paddingHorizontal: 16,
                paddingVertical: 4,
              }}
              >
                <Text style={[Fonts.p3, {
                  color: '#01B3F4',
                  fontSize: 12,
                  lineHeight: 18,
                }]}
                >
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
            <ClubLogoMark
              club={item?.team?.club || item?.club}
              logoStyle={{ borderRadius: moderateScale(20) }}
              size={moderateScale(40)}
            />
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
              contentContainerStyle={[{ gap: horizontalScale(12) }]}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {sponsors.map((/** @type {Sponsor} */ sponsor, idx) => (
                <SponsorLogoTile
                  height={46}
                  imageUrl={sponsor.logo?.url}
                  key={sponsor.link || idx}
                  link={sponsor.link}
                  title={sponsor.title}
                  titleStyle={styles.sponsorTitle}
                  width={92}
                />
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
                style={[{ height: moderateScale(22), width: moderateScale(22) }, ApplicationStyle.tintColor.neutral00]}
              />
              <Text style={[Fonts.p2, { color: '#FFFFFF', fontSize: moderateScale(12), lineHeight: moderateScale(14) }]}>
                {item.pricePerPerson === 0 ? 'Gratuit' : `${item.pricePerPerson}€`}
              </Text>
            </View>
          )}

          {/* Activity */}
          <View style={[Alignments.row, { gap: horizontalScale(8) }, { marginRight: horizontalScale(16) }]}>
            <Image
              source={Images.running}
              style={[{ height: moderateScale(22), width: moderateScale(22) }, ApplicationStyle.tintColor.neutral00]}
            />
            <Text style={[Fonts.p2, { color: '#FFFFFF', fontSize: moderateScale(12), lineHeight: moderateScale(14) }]}>
              {item?.type?.name || 'Sport'}
            </Text>
          </View>

          {/* Time */}
          {item?.startTime && item?.endTime && (
            <View style={[Alignments.row, { gap: horizontalScale(8) }, { marginRight: horizontalScale(16) }]}>
              <Image
                source={Images.clock}
                style={[{ height: moderateScale(22), width: moderateScale(22) }, ApplicationStyle.tintColor.neutral00]}
              />
              <Text style={[Fonts.p2, { color: '#FFFFFF', fontSize: moderateScale(12), lineHeight: moderateScale(14) }]}>
                {item.startTime.substring(0, 5)}
                {' '}
                -
                {item.endTime.substring(0, 5)}
              </Text>
            </View>
          )}

          {/* Date */}
          {item?.date && (
            <View style={[Alignments.row, { gap: horizontalScale(8) }, { marginRight: horizontalScale(16) }]}>
              <Image
                source={Images.calendar}
                style={[{ height: moderateScale(22), width: moderateScale(22) }, ApplicationStyle.tintColor.neutral00]}
              />
              <Text style={[Fonts.p2, { color: '#FFFFFF', fontSize: moderateScale(12), lineHeight: moderateScale(14) }]}>
                {formatDateWithDayPrefix(item.date)}
              </Text>
            </View>
          )}

          {/* Address */}
          <View style={[Alignments.row, { gap: horizontalScale(8) }, { marginRight: horizontalScale(16) }]}>
            <Image
              source={Images.pin}
              style={[{ height: moderateScale(22), width: moderateScale(22) }, ApplicationStyle.tintColor.neutral00]}
            />
            {/* MARQUEE — le lieu de la reservation se lit en entier */}
            <MarqueeText
              // ⚠️ `maxWidth` est de la PLACE : laissé dans `style`, il aurait
              // aussi bridé la SONDE de mesure, qui aurait alors mesuré 150 au
              // lieu de la largeur réelle du nom — et rien n'aurait jamais
              // semblé dépasser.
              containerStyle={{ maxWidth: horizontalScale(150) }}
              style={[Fonts.p2, {
                color: '#FFFFFF', fontSize: moderateScale(12), lineHeight: moderateScale(14),
              }]}
              text={getLocation() || 'Lieu non défini'}
            />
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
              backgroundColor: '#01B3F4',
              borderRadius: moderateScale(20),
              height: verticalScale(43),
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, { color: '#001218', fontSize: moderateScale(13) }]}>
            {actionLabel || t('reservation.actions.participate') || 'Réserver'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    minHeight: verticalScale(280), // Increased from 262
    paddingHorizontal: horizontalScale(16),
    paddingVertical: verticalScale(6),
    width: horizontalScale(335),
  },
  sponsorTitle: {
    color: '#EAF8FF',
    fontSize: moderateScale(10),
  },
});

export default FeaturedReservationCard;
