import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import {
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useEvent from '@/domains/event/useEvent';
import useTheme from '@/theme/themeContext';

import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { RouteNames } from '@/navigation/routeNames';

import { formatDateWithDayPrefix } from '@/utils/date';
import {
  resolveExternalMatchDisplay,
  resolveExternalMatchLocation,
} from '@/utils/externalMatchDisplay';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import { getShortAddress } from '@/utils/location';

// Assets
const BG_OTHER = require('@/assets/background-card-event/card-autre.png');
const BG_DETECTION = require('@/assets/background-card-event/card-detection.png');
const BG_TRAINING = require('@/assets/background-card-event/card-entrainement.png');
const BG_MATCH = require('@/assets/background-card-event/card-match.png');
const BG_RESERVATION = require('@/assets/background-card-event/card-reservation.png');

const getBackgroundImage = (typeName) => {
  const normalizedType = (typeName?.toLowerCase() || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalizedType.includes('match')) return BG_MATCH;
  if (normalizedType.includes('entrainement')) return BG_TRAINING;
  if (normalizedType.includes('detection')) return BG_DETECTION;
  if (normalizedType.includes('reservation')) return BG_RESERVATION;
  return BG_OTHER;
};

const getHeaderTitle = (typeName) => {
  const normalizedType = (typeName?.toLowerCase() || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalizedType.includes('match')) return 'MATCH';
  if (normalizedType.includes('entrainement')) return 'ENTRAINEMENT';
  if (normalizedType.includes('detection')) return 'DETECTION';
  if (normalizedType.includes('reservation')) return 'RESERVATION';
  return typeName?.toUpperCase() || 'ÉVÈNEMENT';
};

const getDisplayLabel = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    if (typeof value.name === 'string') return value.name.trim();
    if (typeof value.label === 'string') return value.label.trim();
    if (typeof value.title === 'string') return value.title.trim();
  }
  return '';
};

const formatEventDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatted = format(date, 'EEEE dd MMMM', { locale: fr });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

/**
 * Event Card component (New Design)
 * @param {object} props
 * @param {FCEvent} props.item
 * @param {Function} props.onPress
 * @param {Function} props.onJoin
 * @param {Function} props.onDecline
 * @param {Function} props.onParticipate
 * @param {Function} props.onLogin
 * @param {string} [props.actionLabel] - Custom label for the action button (used in reservations)
 * @param props.onRefuse
 * @param props.onValidate
 * @param props.showClubHeader
 * @param {'default' | 'share'} [props.mode]
 * @param {boolean} [props.useFacilityAccentColor]
 */
function EventCardNew({
  actionLabel,
  item,
  mode = 'default',
  onDecline,
  onJoin,
  onLogin,
  onParticipate,
  onPress,
  onRefuse,
  onValidate,
  showClubHeader = false,
  useFacilityAccentColor = false,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { getClubInitials } = useClub();
  const { userData } = useAuth();
  const { haveIAlreadyJoined } = useEvent();

  // Check if user has already joined (for reservations)
  const alreadyJoined = haveIAlreadyJoined({
    participations: item?.participations,
    userId: userData?.documentId,
  });
  const doesRequestBelongToCurrentUser = (request) => {
    if (userData?.documentId && request?.user?.documentId) {
      return request.user.documentId === userData.documentId;
    }

    if (userData?.id != null && request?.user?.id != null) {
      return String(request.user.id) === String(userData.id);
    }

    return false;
  };
  const hasPendingRequest = (item?.participationRequests || []).some((request) => {
    if (request?.isActive === false || request?.participationStatus !== 'pending') {
      return false;
    }
    return doesRequestBelongToCurrentUser(request);
  });
  const hasAcceptedRequest = (item?.participationRequests || []).some((request) => {
    if (request?.isActive === false || request?.participationStatus !== 'accepted') {
      return false;
    }
    return doesRequestBelongToCurrentUser(request);
  });

  // Booking status for reservations
  const bookingStatus = item?.bookingStatus || 'open';
  const isLastMinuteAlert = item?.isLastMinuteAlert || false;
  const currentPlayers = item?.currentPlayers || 0;
  const totalPlayers = item?.totalPlayers || 4;
  const missingPlayers = item?.missingPlayers || (totalPlayers - currentPlayers);
  const fillPercentage = totalPlayers > 0 ? (currentPlayers / totalPlayers) * 100 : 0;
  const isShared = bookingStatus === 'shared';
  const isBooked = bookingStatus === 'booked';

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 100 });
    opacity.value = withTiming(0.9, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  const typeName = item?.type?.name || '';
  const isReservation = typeName.toLowerCase().includes('réservation') || typeName.toLowerCase().includes('reservation');
  const isMatchEvent = typeName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('match');
  const isShareMode = mode === 'share';
  const backgroundImage = getBackgroundImage(typeName);
  const headerTitle = getHeaderTitle(typeName);

  // Sponsors
  const sponsors = item?.club?.sponsor || item?.team?.club?.sponsor || [];
  const externalMatchLocation = isMatchEvent ? resolveExternalMatchLocation(item) : '';
  const isImportedExternalMatch = isMatchEvent && (
    item?.externalAutoSource === 'external_competition'
    || Array.isArray(item?.team?.externalCalendarData)
  );

  // Location - check facility first (club installation), then other options
  const locationText = isImportedExternalMatch
    ? (
      item?.facility?.name
      || externalMatchLocation
      || getShortAddress(item?.locationDetails)
      || getShortAddress(item?.location)
      || t('eventDetails.locationUnknown', 'Lieu a confirmer')
    )
    : (
      item?.facility?.name
      || getShortAddress(item?.locationDetails)
      || getShortAddress(item?.club?.addressDetails)
      || getShortAddress(item?.team?.club?.addressDetails)
      || getShortAddress(item?.location)
      || externalMatchLocation
      || null
    );

  // Sport/Activity
  const sportName = item?.team?.activities?.map(({ name }) => name)?.join(', ') || item?.type?.name || 'Sport';

  const clubName = item?.team?.club?.name || item?.club?.name || 'FoundClub';
  const clubLogo = item?.team?.club?.logo?.url || item?.club?.logo?.url;
  const teamName = item?.team?.name || '';
  const matchDisplay = isMatchEvent ? resolveExternalMatchDisplay(item) : { contextLabel: '', title: '' };
  const eventTitle = matchDisplay.title;
  const matchContextLabel = matchDisplay.contextLabel;
  const primaryTitle = isMatchEvent && eventTitle ? eventTitle : clubName;
  const secondaryTitle = isMatchEvent && eventTitle
    ? [matchContextLabel, clubName].filter(Boolean).join(' - ')
    : teamName;
  const teamSection = getDisplayLabel(item?.team?.section || item?.section);
  const teamLevel = getDisplayLabel(item?.team?.level || item?.level);
  const teamCategory = getDisplayLabel(item?.team?.category || item?.category);
  const teamMetaLine = [teamCategory, teamSection, teamLevel]
    .filter((value) => !!value)
    .join(' • ');
  const invitedTeamNames = (item?.invitedTeams || [])
    .map((team) => team?.name)
    .filter(Boolean);
  const facilityAccentColor = useFacilityAccentColor ? resolveFacilityPlanningColor(item?.facility) : null;
  const containerAccentStyle = facilityAccentColor ? { borderColor: facilityAccentColor } : null;
  const headerAccentStyle = facilityAccentColor
    ? {
      backgroundColor: `${facilityAccentColor}1A`,
      borderColor: facilityAccentColor,
    }
    : null;
  const headerTextAccentStyle = facilityAccentColor ? { color: facilityAccentColor } : null;
  const locationIconAccentStyle = facilityAccentColor ? { tintColor: facilityAccentColor } : null;
  const locationTextAccentStyle = facilityAccentColor ? { color: facilityAccentColor } : null;

  return (

    <Animated.View style={[styles.container, containerAccentStyle, animatedStyle]}>
      {/* Background Image */}
      <ImageBackground
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
        source={backgroundImage}
        style={StyleSheet.absoluteFill}
      />

      {/* Main Card Pressable (Background) */}
      <Pressable
        onPress={() => onPress?.(item)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={StyleSheet.absoluteFill}
      />

      {/* Content Container */}
      <View pointerEvents="box-none" style={styles.contentContainer}>

        {/* Non-interactive Content (Passes touches to background Pressable) */}
        <View pointerEvents="none">
          {/* Header: Event Type or Sport for Réservations */}
          <View style={[styles.headerContainer, headerAccentStyle]}>
            <Text style={[styles.headerText, headerTextAccentStyle]}>{isReservation ? sportName.toUpperCase() : headerTitle}</Text>
          </View>

          {/* Club / Team Info */}
          <View style={styles.clubInfoContainer}>
            <View style={styles.clubLogoContainer}>
              {clubLogo ? (
                <ProfileAvatar
                  imageStyle={{ borderRadius: 20 }}
                  imageUrl={clubLogo}
                  size={40}
                  variant="logo"
                  style={{ borderRadius: 20 }}
                />
              ) : (
                <TeamShield
                    initials={clubName ? getClubInitials(clubName) : ''}
                    isSmall
                    size={40}
                  />
              )}
            </View>
            <View style={styles.clubTextContainer}>
              <Text numberOfLines={2} style={[styles.clubName, showClubHeader && { fontSize: 20 }]}>{primaryTitle}</Text>
              {secondaryTitle ? <Text numberOfLines={1} style={styles.category}>{secondaryTitle}</Text> : null}
              {teamMetaLine ? <Text numberOfLines={1} style={styles.teamMetaInline}>{teamMetaLine}</Text> : null}
              {invitedTeamNames.length > 0 ? (
                <Text numberOfLines={1} style={styles.invitedTeamsInline}>
                  {`équipes invitées: ${invitedTeamNames.join(', ')}`}
                </Text>
              ) : null}
            </View>
          </View>

          {/* Date + Time (Hidden for reservations as it's in details) */}
          {item?.date && !isReservation && (
            <View style={styles.dateTimeContainer}>
              <View style={styles.dateMetaGroup}>
                <Image source={Images.calendar} style={styles.dateMetaIcon} />
                <Text numberOfLines={1} style={styles.dateText}>
                  {formatEventDateLabel(item.date)}
                </Text>
              </View>
              <View style={styles.dateMetaGroupRight}>
                <Image source={Images.clock} style={styles.dateMetaIcon} />
                <Text style={styles.timeText}>
                  {item.startTime && item.endTime
                    ? `${item.startTime.substring(0, 5)} - ${item.endTime.substring(0, 5)}`
                    : format(new Date(item.date), 'HH:mm')}
                </Text>
              </View>
            </View>
          )}

          {/* Location + Sport (or Price for Reservation) */}
          <View style={styles.detailsContainer}>
            {isReservation ? (
              <>
                {/* Reservation Layout - Similar to Events */}
                {/* Date Row (Prominent) */}
                {item?.date && (
                  <View style={styles.dateTimeContainer}>
                    <View style={styles.dateMetaGroup}>
                      <Image source={Images.calendar} style={styles.dateMetaIcon} />
                      <Text numberOfLines={1} style={styles.dateText}>
                              {formatEventDateLabel(item.date)}
                            </Text>
                    </View>
                    <View style={styles.dateMetaGroupRight}>
                      <Image source={Images.clock} style={styles.dateMetaIcon} />
                      <Text style={styles.timeText}>
                              {item.startTime && item.endTime
                                ? `${item.startTime.substring(0, 5)} - ${item.endTime.substring(0, 5)}`
                                : (item.startTime ? item.startTime.substring(0, 5) : '')}
                            </Text>
                    </View>
                  </View>
                )}

                {/* Status Badges */}
                {(isLastMinuteAlert || isShared || isBooked) && (
                  <View style={styles.statusBadgesRow}>
                    {isLastMinuteAlert && (
                    <View style={[styles.statusBadge, styles.sosBadge]}>
                            <Text style={styles.statusBadgeText}>🔥 Dernière minute</Text>
                          </View>
                    )}
                    {isShared && !isLastMinuteAlert && (
                    <View style={[styles.statusBadge, styles.sharedBadge]}>
                            <Text style={styles.statusBadgeText}>👥 Joueurs recherchés</Text>
                          </View>
                    )}
                    {isBooked && (
                    <View style={[styles.statusBadge, styles.bookedBadge]}>
                            <Text style={styles.statusBadgeText}>✅ Complet</Text>
                          </View>
                    )}
                  </View>
                )}

                {/* Fill Gauge for shared reservations */}
                {isShared && (
                  <View style={styles.fillGaugeContainer}>
                    <View style={styles.fillGaugeBackground}>
                      <View
                              style={[
                                styles.fillGaugeFill,
                                {
                                  backgroundColor: isLastMinuteAlert ? '#FF6B35' : '#01B3F4',
                                  width: `${fillPercentage}%`,
                                },
                              ]}
                            />
                    </View>
                    <Text style={styles.fillGaugeText}>
                      {missingPlayers > 0
                              ? `Il manque ${missingPlayers} joueur${missingPlayers > 1 ? 's' : ''} (${currentPlayers}/${totalPlayers})`
                              : `${currentPlayers}/${totalPlayers} joueurs`}
                    </Text>
                  </View>
                )}

                {/* Price + Players Row */}
                <View style={styles.detailRow}>
                  <View style={styles.detailLeft}>
                      <Image source={Images.euroCircle} style={styles.icon} />
                      <Text numberOfLines={1} style={styles.detailText}>
                        {item.pricePerPerson !== undefined ? `${item.pricePerPerson}€ / pers` : 'Prix non défini'}
                      </Text>
                    </View>
                  <View style={styles.detailRight}>
                      <Image source={Images.running} style={styles.icon} />
                      <Text numberOfLines={1} style={styles.detailText}>
                        {!isShared && totalPlayers ? `${totalPlayers} joueurs` : (sportName || 'Sport')}
                      </Text>
                    </View>
                </View>

                {/* Location Row */}
                <View style={styles.detailRow}>
                  <Image source={Images.pin} style={[styles.icon, locationIconAccentStyle]} />
                  <Text numberOfLines={1} style={[styles.detailText, locationTextAccentStyle]}>
                      {locationText || 'Lieu non défini'}
                    </Text>
                </View>
              </>
            ) : (
              <>
                {/* Standard Event Layout */}
                <View style={styles.detailRow}>
                    <View style={styles.detailLeft}>
                      <Image source={Images.pin} style={[styles.icon, locationIconAccentStyle]} />
                      <Text numberOfLines={1} style={[styles.detailText, locationTextAccentStyle]}>
                            {locationText || 'Lieu non défini'}
                          </Text>
                    </View>
                    <View style={styles.detailRightStandard}>
                      <Image source={Images.running} style={styles.icon} />
                      <Text numberOfLines={1} style={[styles.detailText, { flex: 0, textAlign: 'right' }]}>{sportName}</Text>
                    </View>
                  </View>
              </>
            )}
          </View>

          {/* Sponsors */}
          {sponsors.length > 0 && (
            <View style={styles.sponsorsContainer}>
              <ScrollView contentContainerStyle={styles.sponsorsScroll} horizontal showsHorizontalScrollIndicator={false}>
                {sponsors.map((sponsor, index) => (
                  <SponsorLogoTile
                    containerStyle={styles.sponsorItem}
                    height={46}
                    imageUrl={sponsor.logo?.url}
                    key={sponsor.documentId || sponsor.id || index}
                    link={sponsor.link}
                    title={sponsor.title}
                    titleStyle={styles.sponsorName}
                    width={92}
                  />
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* CTA - Interactive (Captures touches) */}
        {!isShareMode ? (
          <View pointerEvents="auto" style={[styles.ctaContainer, { elevation: 999, zIndex: 999 }]}>
          {onValidate && onRefuse ? (
            <View style={{
              elevation: 999, flexDirection: 'row', gap: 10, zIndex: 999,
            }}
            >
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  console.log('Valider pressed for item:', item?.documentId);
                  onValidate && onValidate(item);
                }}
                style={[styles.reservationButton, { backgroundColor: Colors.primary500, flex: 1 }]}
              >
                <Text style={styles.reservationButtonText}>Valider</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  console.log('Refuser pressed for item:', item?.documentId);
                  onRefuse && onRefuse(item);
                }}
                style={[
                  styles.reservationButton,
                  {
                    backgroundColor: 'transparent',
                    borderColor: Colors.error500,
                    borderWidth: 1,
                    flex: 1,
                  },
                ]}
              >
                <Text style={[styles.reservationButtonText, { color: Colors.error500 }]}>Refuser</Text>
              </TouchableOpacity>
            </View>
          ) : isReservation ? (
            alreadyJoined ? (
              <View style={[Alignments.fullWidth]}>
                <Tag
                  text={t('eventList.info.alreadyJoined', 'Je participe !')}
                  textStyle={Fonts.p1Bold}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => onParticipate?.(item)}
                style={styles.reservationButton}
              >
                <Text style={styles.reservationButtonText}>
                  {actionLabel || t('reservation.actions.participate') || 'Réserver'}
                </Text>
              </Pressable>
            )
          ) : (
            <EventAnswerButtons
              event={item}
              hasAcceptedRequest={hasAcceptedRequest}
              hasPendingRequest={hasPendingRequest}
              onAbout={() => onPress?.(item)}
              onDecline={() => onDecline?.(item)}
              onJoin={() => onJoin?.(item)}
              onLogin={onLogin}
              onParticipate={() => onParticipate?.(item)}
            />
          )}
          </View>
        ) : null}

      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    borderRadius: 24,
    opacity: 1,
  },
  bookedBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
  },
  category: {
    color: '#BFD5E2',
    fontFamily: 'Montserrat-Medium', // Medium weight
    fontSize: 13,
    marginTop: 2,
  },
  clubInfoContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  clubLogoContainer: {
    // Optional: Add specific styling for the logo container if needed
  },
  clubName: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 17,
    fontWeight: '800', // Extra bold
    lineHeight: 22,
  },
  clubTextContainer: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 6,
  },
  container: {
    backgroundColor: '#173844',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 200, // Flexible height
    overflow: 'hidden',
  },
  contentContainer: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    // Add a dark overlay on top of the background image for better contrast
    backgroundColor: 'rgba(0, 0, 0, 0.56)',
    flex: 1,
  },
  ctaContainer: {
    marginTop: 8,
    width: '100%',
  },
  dateMetaGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    marginRight: 6,
  },
  dateMetaGroupRight: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'flex-end',
    maxWidth: '45%',
  },
  dateMetaIcon: {
    height: 14,
    resizeMode: 'contain',
    tintColor: '#CDE6F2',
    width: 14,
  },
  dateText: {
    color: '#EAF8FF',
    flexShrink: 1,
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dateTimeContainer: {
    alignItems: 'center',
    borderBottomColor: 'rgba(255,255,255,0.12)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    marginTop: 10,
    paddingBottom: 8,
  },
  detailLeft: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  detailRight: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  detailRightStandard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    marginLeft: 8,
    maxWidth: '45%',
  },
  detailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  detailsContainer: {
    gap: 8,
  },
  detailText: {
    color: '#D6E7EE',
    flex: 1,
    fontFamily: 'Montserrat-Medium',
    fontSize: 13,
  },
  fillGaugeBackground: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    height: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  fillGaugeContainer: {
    marginBottom: 8,
  },
  fillGaugeFill: {
    borderRadius: 4,
    height: '100%',
  },
  fillGaugeText: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
  },
  headerContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(1, 179, 244, 0.10)',
    borderColor: '#01B3F4',
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: 'center',
    marginBottom: 6,
    paddingVertical: 3,
    width: '100%',
  },
  headerText: {
    color: '#01B3F4',
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  icon: {
    height: 16,
    resizeMode: 'contain',
    tintColor: '#CDE6F2',
    width: 16,
  },
  invitedTeamsInline: {
    color: '#9ED9F0',
    fontFamily: 'Montserrat-Medium',
    fontSize: 11,
    marginTop: 2,
  },
  reservationButton: {
    alignItems: 'center',
    backgroundColor: '#01B3F4',
    borderRadius: 19,
    height: 38,
    justifyContent: 'center',
    width: '100%',
  },
  reservationButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
    fontWeight: 'bold',
  },
  sharedBadge: {
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
  },
  sosBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.9)',
  },
  sponsorItem: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sponsorName: {
    color: '#EAF8FF',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    textAlign: 'center',
  },
  sponsorsContainer: {
    borderTopWidth: 0,
    marginTop: 10,
  },
  sponsorsScroll: {
    alignItems: 'flex-start',
    gap: 12,
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 11,
  },
  teamMetaInline: {
    color: '#D9F4FF',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    marginTop: 3,
  },
  timeText: {
    color: '#EAF8FF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default EventCardNew;
