import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import SvgIcon from '@/components/atoms/SvgIcon/SvgIcon';
import Tag from '@/components/atoms/tag/Tag';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { formatDateWithDayPrefix } from '@/utils/date';
import { getShortAddress } from '@/utils/location';

/**
 * ReservationCard component - PIXEL-PERFECT Figma design
 * Dimensions: 303x278px
 * @param {object} props
 * @param {object} props
 * @param {object} props.item - The reservation item
 * @param {Function} props.onPress - The function to call when the card is pressed
 * @param {Function} [props.onParticipate] - The function to call when participate button is pressed
 * @returns {import('react').ReactElement} ReservationCard component
 */
function ReservationCard({ item, onParticipate, onPress }) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  // Format time from HH:mm:ss.SSS to HH:mm
  /**
   * @param {string} timeString
   */
  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.split(':').slice(0, 2).join(':');
  };

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
      style={styles.container}
    >
      {/* Header - Frame 1441 */}
      <View style={styles.header}>
        {/* Logo + Nom */}
        <View style={styles.headerLeft}>
          {/* Logo */}
          <View style={styles.logo}>
            <ClubLogoMark
              club={item?.team?.club}
              logoStyle={{ borderRadius: 20 }}
              size={40}
            />
          </View>
          {/* Nom + Catégorie */}
          <View style={styles.headerTextContainer}>
            {/* MARQUEE — le nom du club se lit en entier */}
            <MarqueeText
              style={styles.clubName}
              text={item.team?.club?.name || 'FoundClub'}
            />
            <Text style={styles.category}>
              {item.team?.category?.name || 'Masculin'}
            </Text>
          </View>
        </View>
      </View>

      {/* Badge - position absolute */}
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {item.type?.name || 'Match'}
        </Text>
      </View>

      {/* Sponsors Section */}
      {(item?.club?.sponsor || item?.team?.club?.sponsor) && (
        <View style={[Alignments.row, Spaces.gap[8], Spaces.marginTop[8]]}>
          {(item?.club?.sponsor || item?.team?.club?.sponsor).map((/** @type {any} */ sponsor, /** @type {number} */ idx) => (
            <SponsorLogoTile
              borderRadius={15}
              height={30}
              imageUrl={sponsor.logo?.url}
              key={sponsor.documentId || idx}
              link={sponsor.link}
              showTitle={false}
              title={sponsor.title}
              width={30}
            />
          ))}
        </View>
      )}

      {/* Ligne séparatrice */}
      <View style={styles.separator} />

      {/* Info bloc 1 - Frame 1455 */}
      <View style={styles.infoBlock1}>
        {/* Colonne 1: Joueurs + Niveau */}
        <View style={styles.infoCol}>
          <SvgIcon color="#FFFFFF" height={22} name="users" width={22} />
          <View style={styles.infoTextRow}>
            <Text style={styles.infoText}>
              {item.team?.level?.name || 'U18'}
            </Text>
            <View style={styles.infoDivider} />
            <Text style={styles.infoText}>
              {item.team?.section?.name || 'DEPARTEMENTALE'}
            </Text>
          </View>
        </View>
        {/* Colonne 2: Sport */}
        <View style={styles.infoCol}>
          <SvgIcon color="#FFFFFF" height={20} name="Player" width={18} />
          <Text style={styles.infoText}>
            {item.activity?.name || 'Basketball'}
          </Text>
        </View>
      </View>

      {/* Info bloc 2 - Frame 1456 */}
      <View style={styles.infoBlock2}>
        {/* Colonne 1: Lieu */}
        <View style={styles.infoCol}>
          <Image
            source={Images.pin}
            style={[styles.icon18, { tintColor: '#FFFFFF' }]}
          />
          <Text numberOfLines={2} style={styles.infoTextMultiline}>
            {getLocation() || 'Stade Jean Bouin 13001 Marseille'}
          </Text>
        </View>
        {/* Colonne 2: Date */}
        {item.date && (
          <View style={styles.infoCol}>
            <SvgIcon color="#FFFFFF" height={20} name="calendar-days" width={20} />
            <Text style={[Fonts.p2, Fonts.neutral00]}>
              {formatDateWithDayPrefix(item.date)}
            </Text>
          </View>
        )}
      </View>

      {/* Info bloc 3 */}
      <View style={styles.infoBlock3}>
        {/* Colonne 1: Prix */}
        {item.pricePerPerson != null && (
          <View style={styles.infoCol}>
            <SvgIcon color="#FFFFFF" height={18} name="money_bag" width={18} />
            <Text style={styles.infoText}>
              {item.pricePerPerson}
              €/pers
            </Text>
          </View>
        )}
        {/* Colonne 2: Horaire */}
        {item.startTime && item.endTime && (
          <View style={styles.infoCol}>
            <SvgIcon color="#FFFFFF" height={22} name="clock-two-thirty" width={22} />
            <Text style={styles.infoText}>
              {formatTime(item.startTime)}
              {' '}
              -
              {formatTime(item.endTime)}
            </Text>
          </View>
        )}
      </View>

      {/* Bouton Participer */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => onParticipate?.(item)}
        style={styles.button}
      >
        <Text style={styles.buttonText}>
          {t('reservation.actions.participate') || 'Participer'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Container principal - 303x278px
  container: {
    backgroundColor: '#173844',
    borderRadius: 24,
    height: 278,
    marginRight: 16,
    position: 'relative',
    width: 303,
  },
  // Header - Frame 1441
  category: {
    color: '#01B3F4',
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  clubName: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Black',
    fontSize: 12,
    lineHeight: 18,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    left: 16,
    position: 'absolute',
    top: 24,
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  headerTextContainer: {
    flexDirection: 'column',
    gap: 0,
  },
  logo: {
    alignItems: 'center',
    backgroundColor: '#474B4C',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  logoText: {
    color: '#01B3F4',
    fontFamily: 'Montserrat-Black',
    fontSize: 5,
    lineHeight: 22,
  },
  // Badge - position absolute
  badge: {
    borderColor: '#01B3F4',
    borderRadius: 7.33,
    borderWidth: 0.437,
    paddingHorizontal: 16,
    paddingVertical: 4,
    position: 'absolute',
    right: 8,
    top: 8,
  },
  badgeText: {
    color: '#01B3F4',
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  // Sponsors - Frame 1419
  // Ligne séparatrice
  separator: {
    backgroundColor: '#FFFFFF',
    height: 0.5,
    left: 40,
    position: 'absolute',
    top: 110,
    width: 247,
  },
  // Info bloc 1 - Frame 1455 (2 colonnes)
  infoBlock1: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    left: 17,
    position: 'absolute',
    top: 115, // Moved up
    width: 273,
  },
  // Info bloc 2 - Frame 1456 (2 colonnes)
  infoBlock2: {
    flexDirection: 'row',
    gap: 15,
    justifyContent: 'space-between',
    left: 19,
    position: 'absolute',
    top: 145, // Moved up
    width: 273,
  },
  // Info bloc 3 (2 colonnes)
  infoBlock3: {
    flexDirection: 'row',
    gap: 15,
    justifyContent: 'space-between',
    left: 19,
    position: 'absolute',
    top: 175, // Moved up
    width: 273,
  },
  infoCol: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8, // Increased gap
  },
  infoDivider: {
    borderWidth: 0, // Removed border width, use background color for divider line if needed, or keep border.
    height: 10, // Adjusted height
    width: 2,
    // Wait, original was borderLeftWidth? No, it was width 2, height 0, borderWidth 1.
    // Let's make it a simple line.
    backgroundColor: '#FFFFFF',
    height: 12,
    width: 1,
  },
  infoText: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Regular',
    fontSize: 12, // Increased from 10
    lineHeight: 14,
  },
  infoTextMultiline: {
    color: '#FFFFFF',
    flex: 1,
    fontFamily: 'Montserrat-Regular',
    fontSize: 12, // Increased from 10
    lineHeight: 14,
  },
  infoTextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  // Icon 18x18 -> 22x22
  icon18: {
    height: 22,
    resizeMode: 'contain',
    width: 22,
  },
  // Bouton Participer
  button: {
    alignItems: 'center',
    backgroundColor: '#01B3F4',
    borderRadius: 21.56,
    bottom: 16, // Slightly adjusted
    height: 42.68,
    justifyContent: 'center',
    left: (303 - 222) / 2,
    position: 'absolute',
    width: 222,
  },
  buttonText: {
    color: '#001218',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14.45,
    lineHeight: 21,
  },
});

export default ReservationCard;
