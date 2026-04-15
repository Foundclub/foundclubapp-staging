import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo } from 'react';
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
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';
import useEvent from '@/domains/event/useEvent';
import { resolveParticipationFlow } from '@/domains/participation/participationFlow';
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

const getBackgroundImage = (typeName, Images) => {
  const normalizedType = (typeName?.toLowerCase() || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (normalizedType.includes('match')) return Images.eventCardMatch;
  if (normalizedType.includes('entrainement')) return Images.eventCardTraining;
  if (normalizedType.includes('detection')) return Images.eventCardDetection;
  if (normalizedType.includes('reservation')) return Images.eventCardReservation;
  return Images.eventCardOther;
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

const normalizeComparableText = (value) => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();

const stripMatchPrefix = (value) => String(value || '')
  .trim()
  .replace(/^vs\b\.?\s*/i, '')
  .trim();

const formatEventDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatted = format(date, 'EEEE dd MMMM', { locale: fr });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const formatCompactEventDateLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const formatted = format(date, 'EEE dd MMM', { locale: fr });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

const formatStagePeriodLabel = (startValue, endValue) => {
  if (!startValue) return '';

  const startDate = new Date(startValue);
  if (Number.isNaN(startDate.getTime())) return '';

  if (!endValue) return formatEventDateLabel(startDate);

  const endDate = new Date(endValue);
  if (Number.isNaN(endDate.getTime())) return formatEventDateLabel(startDate);

  if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
    return formatEventDateLabel(startDate);
  }

  return `${formatCompactEventDateLabel(startDate)} - ${formatCompactEventDateLabel(endDate)}`;
};

const resolveTeamFocusedPrimaryTitle = ({
  clubName,
  eventTitle,
  invitedTeamNames,
  isMatchEvent,
  teamName,
  matchContext,
}) => {
  if (!isMatchEvent) {
    return teamName || clubName || 'Equipe';
  }

  const opponentFromContext = stripMatchPrefix(matchContext?.opponentName);
  if (opponentFromContext) return opponentFromContext;

  const opponentFromTitle = stripMatchPrefix(eventTitle);
  if (opponentFromTitle) return opponentFromTitle;

  const normalizedTeamName = normalizeComparableText(teamName);
  const invitedOpponent = invitedTeamNames.find((name) => (
    normalizeComparableText(name) && normalizeComparableText(name) !== normalizedTeamName
  ));
  if (invitedOpponent) return invitedOpponent;

  return teamName || clubName || 'Match';
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
 * @param {'default' | 'teamFocused'} [props.displayProfile]
 * @param {boolean} [props.useFacilityAccentColor]
 */
function EventCardNew({
  actionLabel,
  displayProfile = 'default',
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

  const participationState = getCurrentUserEventParticipationState({
    missings: item?.missings,
    participationRequests: item?.participationRequests,
    participations: item?.participations,
    user: userData,
  });

  // Check if user has already joined (for reservations)
  const alreadyJoined = haveIAlreadyJoined({
    participations: item?.participations,
    userId: userData?.documentId,
  });
  const { hasAcceptedRequest, hasPendingRequest } = participationState;
  const participationFlow = useMemo(() => resolveParticipationFlow(item, {
    participationState,
    user: userData,
  }), [item, participationState, userData]);

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
  const isStageParentEvent = String(item?.eventFormat || '').toLowerCase() === 'stage_parent';
  const isShareMode = mode === 'share';
  const isTeamFocusedCard = displayProfile === 'teamFocused' && !isShareMode && !isReservation;
  const backgroundImage = getBackgroundImage(typeName, Images);
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
  const defaultPrimaryTitle = isMatchEvent && eventTitle ? eventTitle : clubName;
  const defaultSecondaryTitle = isMatchEvent && eventTitle
    ? [matchContextLabel, clubName].filter(Boolean).join(' - ')
    : teamName;
  const teamSection = getDisplayLabel(item?.team?.section || item?.section);
  const teamLevel = getDisplayLabel(item?.team?.level || item?.level);
  const teamCategory = getDisplayLabel(item?.team?.category || item?.category);
  const defaultTeamMetaLine = [teamCategory, teamSection, teamLevel]
    .filter((value) => !!value)
    .join(' • ');
  const invitedTeamNames = (item?.invitedTeams || [])
    .map((team) => team?.name)
    .filter(Boolean);
  const primaryTitle = isTeamFocusedCard
    ? resolveTeamFocusedPrimaryTitle({
      clubName,
      eventTitle,
      invitedTeamNames,
      isMatchEvent,
      matchContext: item?.matchContext,
      teamName,
    })
    : defaultPrimaryTitle;
  const secondaryTitle = isTeamFocusedCard
    ? [teamName, clubName].filter((value, index, values) => value && values.indexOf(value) === index).join(' • ')
    : defaultSecondaryTitle;
  const teamMetaLine = isTeamFocusedCard
    ? [typeName, matchContextLabel, defaultTeamMetaLine].filter(Boolean).join(' • ')
    : defaultTeamMetaLine;
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
  const resolvedHeaderContainerStyle = [
    styles.headerContainer,
    isTeamFocusedCard && styles.headerContainerTeamFocused,
    headerAccentStyle,
  ];
  const resolvedHeaderTextStyle = [
    styles.headerText,
    isTeamFocusedCard && styles.headerTextTeamFocused,
    headerTextAccentStyle,
  ];
  const resolvedPrimaryTitleStyle = [
    styles.clubName,
    showClubHeader && { fontSize: 20 },
    isTeamFocusedCard && styles.clubNameTeamFocused,
  ];
  const resolvedSecondaryTitleStyle = [
    styles.category,
    isTeamFocusedCard && styles.categoryTeamFocused,
  ];
  const resolvedTeamMetaStyle = [
    styles.teamMetaInline,
    isTeamFocusedCard && styles.teamMetaInlineTeamFocused,
  ];
  const resolvedLocationTextStyle = [
    styles.detailText,
    locationTextAccentStyle,
    isTeamFocusedCard && styles.detailTextTeamFocused,
  ];
  const resolvedSportTextStyle = [
    styles.detailText,
    isTeamFocusedCard && styles.detailTextSecondary,
    { flex: 0, textAlign: 'right' },
  ];
  const dateLabel = isStageParentEvent
    ? formatStagePeriodLabel(item?.stageStartDate || item?.date, item?.stageEndDate)
    : formatEventDateLabel(item?.date);

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
          <View style={resolvedHeaderContainerStyle}>
            <Text style={resolvedHeaderTextStyle}>{isReservation ? sportName.toUpperCase() : headerTitle}</Text>
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
              <Text numberOfLines={2} style={resolvedPrimaryTitleStyle}>{primaryTitle}</Text>
              {secondaryTitle ? <Text numberOfLines={1} style={resolvedSecondaryTitleStyle}>{secondaryTitle}</Text> : null}
              {teamMetaLine ? <Text numberOfLines={1} style={resolvedTeamMetaStyle}>{teamMetaLine}</Text> : null}
              {!isTeamFocusedCard && invitedTeamNames.length > 0 ? (
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
                  {dateLabel}
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
                      <Text numberOfLines={1} style={resolvedLocationTextStyle}>
                            {locationText || 'Lieu non défini'}
                          </Text>
                    </View>
                    <View style={styles.detailRightStandard}>
                      <Image source={Images.running} style={styles.icon} />
                      <Text numberOfLines={1} style={resolvedSportTextStyle}>{sportName}</Text>
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
              <View style={[Alignments.fullWidth, Spaces.gap[10]]}>
                <Pressable
                  disabled={!participationFlow?.canAct}
                  onPress={() => onParticipate?.(item)}
                  style={[
                    styles.reservationButton,
                    !participationFlow?.canAct ? styles.reservationButtonDisabled : null,
                  ]}
                >
                  <Text style={styles.reservationButtonText}>
                  {actionLabel || t('reservation.actions.participate') || 'Réserver'}
                </Text>
              </Pressable>
              {!participationFlow?.canAct && participationFlow?.blockedReason ? (
                <Text style={[Fonts.p4, Fonts.neutral300]}>
                  {participationFlow.blockedReason}
                </Text>
              ) : null}
            </View>
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
              participationFlow={participationFlow}
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
  categoryTeamFocused: {
    color: '#D6E7EE',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    marginTop: 3,
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
  clubNameTeamFocused: {
    fontSize: 20,
    lineHeight: 24,
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
  detailTextSecondary: {
    color: '#A9C6D5',
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
  },
  detailTextTeamFocused: {
    color: '#EAF8FF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
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
  headerContainerTeamFocused: {
    backgroundColor: 'rgba(1, 179, 244, 0.07)',
    borderColor: 'rgba(1, 179, 244, 0.55)',
    borderWidth: 1,
    marginBottom: 8,
    paddingVertical: 2,
  },
  headerText: {
    color: '#01B3F4',
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  headerTextTeamFocused: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    letterSpacing: 0.4,
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
  reservationButtonDisabled: {
    opacity: 0.55,
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
  teamMetaInlineTeamFocused: {
    color: '#A9C6D5',
    fontFamily: 'Montserrat-Medium',
    fontSize: 11,
    marginTop: 4,
  },
  timeText: {
    color: '#EAF8FF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default EventCardNew;

