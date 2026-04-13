import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Image, ImageBackground, Linking, Platform, Text, TouchableOpacity, View,
} from 'react-native';

import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { formatDateWithDayPrefix } from '@/utils/date';
import {
  resolveExternalMatchDisplay,
  resolveExternalMatchLocation,
} from '@/utils/externalMatchDisplay';
import {
  normalizeLocationInput,
  getLocationCoordinates as resolveLocationCoordinates,
} from '@/utils/location';
import safeJsonParse from '@/utils/safeJsonParse';

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
  if (
    normalizedType.includes('match')
    || normalizedType.includes('competition')
    || normalizedType.includes('tournoi')
  ) return BG_MATCH;
  if (normalizedType.includes('entrainement')) return BG_TRAINING;
  if (normalizedType.includes('detection')) return BG_DETECTION;
  if (normalizedType.includes('reservation')) return BG_RESERVATION;
  return BG_OTHER;
};

/**
 * @param {unknown} value
 * @returns {string}
 */
const toDisplayText = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (!value || typeof value !== 'object') {
    return '';
  }

  if (typeof value.description === 'string') {
    return value.description.trim();
  }
  if (typeof value.label === 'string') {
    return value.label.trim();
  }
  if (value.label && typeof value.label === 'object') {
    return toDisplayText(value.label);
  }
  if (typeof value.address === 'string') {
    return value.address.trim();
  }
  if (typeof value.name === 'string') {
    return value.name.trim();
  }
  if (value.address && typeof value.address === 'object') {
    return toDisplayText(value.address);
  }
  return '';
};

/**
 *
 * @param root0
 * @param root0.event
 */
function EventHeader({ event, matchScoreSummary = null }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { getClubInitials } = useClub();

  const backgroundImage = getBackgroundImage(event?.type?.name);
  const normalizedTypeName = String(event?.type?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const clubName = toDisplayText(event?.team?.club?.name);
  const matchDisplay = resolveExternalMatchDisplay(event);
  const externalMatchLocation = resolveExternalMatchLocation(event);
  const eventTitle = matchDisplay.title;
  const sectionName = toDisplayText(event?.team?.section?.name);
  const logoUrl = event?.team?.club?.logo?.url;
  const locationDetails = event?.locationDetails;
  const isImportedExternalMatch = (
    event?.externalAutoSource === 'external_competition'
    || Array.isArray(event?.team?.externalCalendarData)
  );
  const showMatchTitle = Boolean(eventTitle && (
    normalizedTypeName.includes('match')
    || normalizedTypeName.includes('competition')
    || normalizedTypeName.includes('tournoi')
  ));
  const matchContextLabel = showMatchTitle ? matchDisplay.contextLabel : '';
  const headerPrimaryTitle = showMatchTitle ? eventTitle : clubName;
  const headerSecondaryTitle = showMatchTitle
    ? [matchContextLabel, clubName].filter(Boolean).join(' - ')
    : '';
  const invitedTeamNames = (event?.invitedTeams || [])
    .map((team) => toDisplayText(team?.name))
    .filter(Boolean);

  const getParsedLocationDetails = () => {
    if (!locationDetails) return null;
    return safeJsonParse(locationDetails, null);
  };

  const getLocationText = () => {
    const parsed = getParsedLocationDetails();
    const fromDetails = toDisplayText(parsed?.address);
    const fromEventLocation = toDisplayText(event?.location);
    const normalized = normalizeLocationInput(parsed?.address || event?.location || parsed);
    if (isImportedExternalMatch && externalMatchLocation) {
      return externalMatchLocation;
    }
    return fromDetails || fromEventLocation || normalized?.label || normalized?.address || externalMatchLocation || '';
  };

  const getLocationCoordinates = () => {
    const parsed = getParsedLocationDetails();
    return resolveLocationCoordinates(event?.location)
      || resolveLocationCoordinates(parsed?.address)
      || resolveLocationCoordinates(parsed);
  };

  const handleOpenLocationInGps = () => {
    const addressLabel = getLocationText().trim();
    if (!addressLabel) return;

    const coordinates = getLocationCoordinates();
    const encodedAddress = encodeURIComponent(addressLabel);
    const fallbackUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

    const nativeUrl = coordinates
      ? Platform.select({
        android: `geo:${coordinates.lat},${coordinates.lng}?q=${coordinates.lat},${coordinates.lng}(${encodedAddress})`,
        default: fallbackUrl,
        ios: `maps:${coordinates.lat},${coordinates.lng}?q=${encodedAddress}`,
      })
      : Platform.select({
        android: `geo:0,0?q=${encodedAddress}`,
        default: fallbackUrl,
        ios: `maps:0,0?q=${encodedAddress}`,
      });

    if (!nativeUrl) {
      Linking.openURL(fallbackUrl).catch(() => {});
      return;
    }

    Linking.canOpenURL(nativeUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(nativeUrl);
        }
        return Linking.openURL(fallbackUrl);
      })
      .catch(() => {
        Linking.openURL(fallbackUrl).catch(() => {});
      });
  };

  return (
    <ImageBackground
      imageStyle={{ borderRadius: 24 }}
      resizeMode="cover"
      source={backgroundImage}
      style={[
        ApplicationStyle.borderRadius24,
        Alignments.alignCenter,
        Alignments.relative,
        Spaces.gap[8],
        Spaces.paddingHorizontal[24],
        Spaces.paddingVertical[32],
      ]}
    >
      {/* Header: Logo + Main label */}
      <View
        style={[
          Spaces.gap[4],
          Alignments.alignCenter,
          Alignments.fullWidth,
          Alignments.row,
        ]}
      >
        {logoUrl ? (
          <ProfileAvatar
            imageStyle={{ borderRadius: 60 }}
            imageUrl={logoUrl}
            size={60}
            style={[
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral00,
              { borderRadius: 60 },
            ]}
            variant="logo"
          />
        ) : (
          <TeamShield
            initials={clubName ? getClubInitials(clubName) : ''}
            isSmall
          />
        )}
        <View style={[Spaces.gap[4], { maxWidth: '75%' }]}>
          <Text style={[showMatchTitle ? Fonts.h3Black : Fonts.p1Bold, Fonts.neutral00]}>
            {headerPrimaryTitle}
          </Text>
          {headerSecondaryTitle ? (
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {headerSecondaryTitle}
            </Text>
          ) : null}
        </View>
      </View>

      {matchScoreSummary ? (
        <View
          style={[
            ApplicationStyle.borderRadius24,
            Alignments.alignCenter,
            Spaces.paddingVertical[12],
            Spaces.paddingHorizontal[18],
            Spaces.gap[8],
            {
              backgroundColor: `${Colors.primary500}18`,
              borderColor: `${Colors.primary500}55`,
              borderWidth: 1,
              minWidth: 172,
            },
          ]}
        >
          <Text style={[Fonts.p4Bold, Fonts.primary100]}>
            {matchScoreSummary.badgeLabel}
          </Text>
          <Text style={[Fonts.h4Black, Fonts.neutral00]}>
            {matchScoreSummary.value}
          </Text>
          {matchScoreSummary.helperText ? (
            <Text style={[Fonts.p4, Fonts.primary100, Fonts.textCenter]}>
              {matchScoreSummary.helperText}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Section Name */}
      <View style={[Alignments.fullWidth, Spaces.gap[8], Spaces.marginBottom[12]]}>
        <Text style={[Fonts.p2Bold, Fonts.primary500, Fonts.textRight, Alignments.fullWidth]}>
          {sectionName}
        </Text>
        <View style={[Alignments.fullWidth, ApplicationStyle.separator, ApplicationStyle.backgroundColor.primary500]} />
      </View>

      {/* Info: Location, Date, Time, Team Category */}
      <View style={[Spaces.gap[24], Alignments.fill]}>
        {getLocationText() ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleOpenLocationInGps}
            style={[Alignments.justifyCenter, Spaces.gap[8]]}
          >
            <View style={[Alignments.row, Alignments.justifyCenter, Spaces.gap[8]]}>
              <Image
                source={Images.pin}
                style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
              />
              <Text style={[Fonts.p2, Fonts.primary100, { maxWidth: '90%' }]}>
                {getLocationText()}
              </Text>
            </View>
            <Text style={[Fonts.p4, Fonts.primary500, Fonts.textCenter]}>
              {t('common.openInGps', 'Ouvrir dans le GPS')}
            </Text>
          </TouchableOpacity>
        ) : null}

        {event?.date && (
          <View style={[Alignments.row, Alignments.fill, Spaces.gap[16]]}>
            <View style={[Spaces.gap[8]]}>
              <View style={[Alignments.row, Spaces.gap[8]]}>
                <Image
                  source={Images.calendar}
                  style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
                />
                <Text style={[Fonts.p2, Fonts.neutral00]}>
                  {formatDateWithDayPrefix(event.date)}
                </Text>
              </View>

              <View style={[Alignments.row, Spaces.gap[4]]}>
                <Image
                  source={Images.clock}
                  style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
                />
                <Text style={[Fonts.p2, Fonts.primary100]}>
                  {event?.startTime && event?.endTime
                    ? `${event.startTime.substring(0, 5)} - ${event.endTime.substring(0, 5)}`
                    : format(new Date(event.date), 'HH:mm')}
                </Text>
              </View>
            </View>

            <View style={[{ height: 45, width: 1 }, ApplicationStyle.backgroundColor.neutral00]} />

            {event?.team && (
              <View style={[Spaces.gap[8]]}>
                <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, Fonts.uppercase]}>
                  {event?.team?.category?.name}
                </Text>
                <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, Fonts.uppercase]}>
                  {event?.team?.level?.name}
                </Text>
              </View>
            )}
          </View>
        )}

        {invitedTeamNames.length > 0 && (
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              Equipes invitees
            </Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {invitedTeamNames.join(' \u2022 ')}
            </Text>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

export default EventHeader;
