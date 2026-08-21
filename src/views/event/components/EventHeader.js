import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Image, ImageBackground, Linking, Platform, Text, TouchableOpacity, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import { formatDateWithDayPrefix } from '@/utils/date';
import {
  resolveExternalMatchDisplay,
  resolveExternalMatchLocation,
} from '@/utils/externalMatchDisplay';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
  normalizeLocationInput,
  getLocationCoordinates as resolveLocationCoordinates,
} from '@/utils/location';
import safeJsonParse from '@/utils/safeJsonParse';

// Assets — imports statiques (pas require) : require n'existe pas sur le rendu web ESM.
import BG_OTHER from '@/assets/background-card-event/card-autre.png';
import BG_DETECTION from '@/assets/background-card-event/card-detection.png';
import BG_TRAINING from '@/assets/background-card-event/card-entrainement.png';
import BG_MATCH from '@/assets/background-card-event/card-match.png';
import BG_RESERVATION from '@/assets/background-card-event/card-reservation.png';

const getBackgroundImage = (/** @type {any} */ typeName) => {
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

  const entity = /** @type {any} */ (value);
  if (typeof entity.description === 'string') {
    return entity.description.trim();
  }
  if (typeof entity.label === 'string') {
    return entity.label.trim();
  }
  if (entity.label && typeof entity.label === 'object') {
    return toDisplayText(entity.label);
  }
  if (typeof entity.address === 'string') {
    return entity.address.trim();
  }
  if (typeof entity.name === 'string') {
    return entity.name.trim();
  }
  if (entity.address && typeof entity.address === 'object') {
    return toDisplayText(entity.address);
  }
  return '';
};

/**
 * @param {{
 *   event: any;
 *   matchScoreSummary?: {
 *     badgeLabel: string;
 *     helperText?: string | null;
 *     value: string;
 *   } | null;
 * }} props
 */
function EventHeader({ event, matchScoreSummary = null }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const SpacesAny = /** @type {any} */ (Spaces);
  const { t } = useTranslation();

  const backgroundImage = getBackgroundImage(event?.type?.name);
  // La couleur appartient au LIEU, pas au type : deux evenements au meme
  // endroit portent le meme accent. Sans installation, on garde le cyan
  // d'avant AD09, donc un evenement sans lieu ne change pas d'apparence.
  const accentColor = resolveFacilityPlanningColor(event?.facility) || Colors.primary500;
  const normalizedTypeName = String(event?.type?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const clubName = toDisplayText(event?.team?.club?.name || event?.club?.name);
  const matchDisplay = resolveExternalMatchDisplay(event);
  const externalMatchLocation = resolveExternalMatchLocation(event);
  const eventTitle = matchDisplay.title;
  const isTournamentEvent = normalizedTypeName.includes('tournoi');
  const sectionName = toDisplayText(event?.team?.section?.name || event?.tournamentSection?.name);
  const categoryName = toDisplayText(event?.team?.category?.name || event?.tournamentCategory?.name);
  const levelName = toDisplayText(event?.team?.level?.name);
  const activityName = toDisplayText(event?.team?.activities?.[0]?.name || event?.tournamentActivity?.name);
  const eventClub = event?.team?.club || event?.club;
  const logoUrl = eventClub?.logo?.url;
  const locationDetails = event?.locationDetails;
  // Le nom du lieu est une DONNEE, pas un libelle : aucune clef de traduction.
  const facilityName = toDisplayText(event?.facility?.name);
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
  const tournamentTitle = toDisplayText(event?.name) || 'Tournoi';
  let headerPrimaryTitle = clubName;
  if (showMatchTitle) {
    headerPrimaryTitle = eventTitle;
  } else if (isTournamentEvent) {
    headerPrimaryTitle = tournamentTitle;
  }

  let headerSecondaryTitle = '';
  if (showMatchTitle) {
    headerSecondaryTitle = [matchContextLabel, clubName].filter(Boolean).join(' - ');
  } else if (isTournamentEvent) {
    headerSecondaryTitle = [clubName, activityName, categoryName].filter(Boolean).join(' - ');
  }
  const invitedTeamNames = (event?.invitedTeams || [])
    .map((/** @type {any} */ team) => toDisplayText(team?.name))
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
      source={/** @type {any} */ (backgroundImage)}
      style={[
        ApplicationStyle.borderRadius24,
        Alignments.alignCenter,
        Alignments.relative,
        Spaces.gap[8],
        Spaces.paddingHorizontal[24],
        Spaces.paddingVertical[32],
        // Lisere gauche : la couleur du lieu reste lisible meme quand le fond
        // photo la mange. 4 est une LARGEUR DE BORD, pas un espacement : elle
        // ne passe pas par la rampe Spaces (cf. { height: 45, width: 1 } plus bas).
        { borderLeftColor: accentColor, borderLeftWidth: 4 },
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
        <ClubLogoMark
          club={eventClub}
          logoStyle={[
            ApplicationStyle.borderWidth1,
            ApplicationStyle.borderColor.neutral00,
            { borderRadius: 60 },
          ]}
          logoUrl={logoUrl}
          name={clubName}
          size={60}
        />
        <View style={[Spaces.gap[4], { maxWidth: '75%' }]}>
          <Text style={[showMatchTitle ? Fonts.h3Black : Fonts.p1Bold, Fonts.neutral00]}>
            {headerPrimaryTitle}
          </Text>
          {headerSecondaryTitle ? (
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {headerSecondaryTitle}
            </Text>
          ) : null}
          {facilityName ? (
            <View
              style={[
                ApplicationStyle.borderRadius100,
                Alignments.selfStart,
                Spaces.paddingHorizontal[8],
                Spaces.paddingVertical[4],
                { backgroundColor: withAlpha(accentColor, 0.14) },
              ]}
            >
              <Text style={[Fonts.p4, Fonts.neutral00]}>
                {facilityName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {matchScoreSummary ? (
        <View
          style={[
            ApplicationStyle.borderRadius24,
            Alignments.alignCenter,
            Spaces.paddingVertical[12],
            SpacesAny.paddingHorizontal[18],
            Spaces.gap[8],
            {
              backgroundColor: withAlpha(accentColor, 0.09),
              borderColor: withAlpha(accentColor, 0.33),
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
        <Text style={[Fonts.p2Bold, Fonts.textRight, Alignments.fullWidth, { color: accentColor }]}>
          {sectionName}
        </Text>
        <View style={[Alignments.fullWidth, ApplicationStyle.separator, { backgroundColor: accentColor }]} />
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
            <Text style={[Fonts.p4, Fonts.textCenter, { color: accentColor }]}>
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

            {(categoryName || levelName || activityName) && (
              <View style={[Spaces.gap[8]]}>
                {categoryName ? (
                  <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, Fonts.uppercase]}>
                    {categoryName}
                  </Text>
                ) : null}
                <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, Fonts.uppercase]}>
                  {levelName || activityName}
                </Text>
              </View>
            )}
          </View>
        )}

        {invitedTeamNames.length > 0 && (
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p3Bold, { color: accentColor }]}>
              Équipes invitées
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
