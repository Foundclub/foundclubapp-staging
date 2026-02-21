import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import { formatDateWithDayPrefix } from '@/utils/date';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import Tag from '@/components/atoms/tag/Tag';
import SvgIcon from '@/components/atoms/SvgIcon/SvgIcon';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import TeamShield from '@/components/atoms/teamShield/TeamShield';

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
function ReservationCard({ item, onPress, onParticipate }) {
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
      style={styles.container}
    >
      {/* Header - Frame 1441 */}
      <View style={styles.header}>
        {/* Logo + Nom */}
        <View style={styles.headerLeft}>
          {/* Logo */}
          <View style={styles.logo}>
            {item?.team?.club?.logo?.url ? (
              <ProfileAvatar
                imageUrl={item.team.club.logo.url}
                size={40}
                style={{ borderRadius: 20 }}
                imageStyle={{ borderRadius: 20 }}
              />
            ) : (
              <TeamShield
                initials={item?.team?.club?.name ? item.team.club.name.slice(0, 3).toUpperCase() : ''}
                isSmall
                size={40}
              />
            )}
          </View>
          {/* Nom + Catégorie */}
          <View style={styles.headerTextContainer}>
            <Text style={styles.clubName} numberOfLines={1}>
              {item.team?.club?.name || 'FoundClub'}
            </Text>
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
              key={sponsor.documentId || idx}
              imageUrl={sponsor.logo?.url}
              link={sponsor.link}
              title={sponsor.title}
              showTitle={false}
              width={30}
              height={30}
              borderRadius={15}
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
          <SvgIcon color="#FFFFFF" name="users" width={22} height={22} />
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
          <SvgIcon color="#FFFFFF" name="Player" width={18} height={20} />
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
          <Text style={styles.infoTextMultiline} numberOfLines={2}>
            {getLocation() || 'Stade Jean Bouin 13001 Marseille'}
          </Text>
        </View>
        {/* Colonne 2: Date */}
        {item.date && (
          <View style={styles.infoCol}>
            <SvgIcon color="#FFFFFF" name="calendar-days" width={20} height={20} />
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
            <SvgIcon color="#FFFFFF" name="money_bag" width={18} height={18} />
            <Text style={styles.infoText}>
              {item.pricePerPerson}€/pers
            </Text>
          </View>
        )}
        {/* Colonne 2: Horaire */}
        {item.startTime && item.endTime && (
          <View style={styles.infoCol}>
            <SvgIcon color="#FFFFFF" name="clock-two-thirty" width={22} height={22} />
            <Text style={styles.infoText}>
              {formatTime(item.startTime)} - {formatTime(item.endTime)}
            </Text>
          </View>
        )}
      </View>

      {/* Bouton Participer */}
      <TouchableOpacity
        onPress={() => onParticipate?.(item)}
        style={styles.button}
        activeOpacity={0.8}
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
    position: 'relative',
    width: 303,
    height: 278,
    backgroundColor: '#173844',
    borderRadius: 24,
    marginRight: 16,
  },
  // Header - Frame 1441
  header: {
    position: 'absolute',
    top: 24,
    left: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#474B4C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    fontFamily: 'Montserrat-Black',
    fontSize: 5,
    lineHeight: 22,
    color: '#01B3F4',
  },
  headerTextContainer: {
    flexDirection: 'column',
    gap: 0,
  },
  clubName: {
    fontFamily: 'Montserrat-Black',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
  },
  category: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#01B3F4',
  },
  // Badge - position absolute
  badge: {
    position: 'absolute',
    right: 8,
    top: 8,
    borderWidth: 0.437,
    borderColor: '#01B3F4',
    borderRadius: 7.33,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  badgeText: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#01B3F4',
  },
  // Sponsors - Frame 1419
  // Ligne séparatrice
  separator: {
    position: 'absolute',
    top: 110,
    left: 40,
    width: 247,
    height: 0.5,
    backgroundColor: '#FFFFFF',
  },
  // Info bloc 1 - Frame 1455 (2 colonnes)
  infoBlock1: {
    position: 'absolute',
    top: 115, // Moved up
    left: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: 273,
  },
  // Info bloc 2 - Frame 1456 (2 colonnes)
  infoBlock2: {
    position: 'absolute',
    top: 145, // Moved up
    left: 19,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    width: 273,
  },
  // Info bloc 3 (2 colonnes)
  infoBlock3: {
    position: 'absolute',
    top: 175, // Moved up
    left: 19,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
    width: 273,
  },
  infoCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Increased gap
  },
  infoTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12, // Increased from 10
    lineHeight: 14,
    color: '#FFFFFF',
  },
  infoTextMultiline: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12, // Increased from 10
    lineHeight: 14,
    color: '#FFFFFF',
    flex: 1,
  },
  infoDivider: {
    width: 2,
    height: 10, // Adjusted height
    borderWidth: 0, // Removed border width, use background color for divider line if needed, or keep border. 
    // Wait, original was borderLeftWidth? No, it was width 2, height 0, borderWidth 1.
    // Let's make it a simple line.
    backgroundColor: '#FFFFFF',
    width: 1,
    height: 12,
  },
  // Icon 18x18 -> 22x22
  icon18: {
    width: 22,
    height: 22,
    resizeMode: 'contain',
  },
  // Bouton Participer
  button: {
    position: 'absolute',
    bottom: 16, // Slightly adjusted
    left: (303 - 222) / 2,
    width: 222,
    height: 42.68,
    backgroundColor: '#01B3F4',
    borderRadius: 21.56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14.45,
    lineHeight: 21,
    color: '#001218',
  },
});

export default ReservationCard;

