
import React from 'react';
import { View, Text, Image, ImageBackground } from 'react-native';
import { format } from 'date-fns';
import useTheme from '@/theme/themeContext';
import { formatDateWithDayPrefix } from '@/utils/date';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import useClub from '@/domains/club/useClub';

// Assets
const BG_MATCH = require('@/assets/background-card-event/card-match.png');
const BG_TRAINING = require('@/assets/background-card-event/card-entrainement.png');
const BG_DETECTION = require('@/assets/background-card-event/card-detection.png');
const BG_RESERVATION = require('@/assets/background-card-event/card-reservation.png');
const BG_OTHER = require('@/assets/background-card-event/card-autre.png');

const getBackgroundImage = (typeName) => {
  const normalizedType = typeName?.toLowerCase() || '';
  if (normalizedType.includes('match') || normalizedType.includes('compétition') || normalizedType.includes('tournoi')) return BG_MATCH;
  if (normalizedType.includes('entrainement') || normalizedType.includes('entraînement')) return BG_TRAINING;
  if (normalizedType.includes('detection') || normalizedType.includes('détection')) return BG_DETECTION;
  if (normalizedType.includes('réservation') || normalizedType.includes('reservation')) return BG_RESERVATION;
  return BG_OTHER;
};

const EventHeader = ({ event }) => {
  const { ApplicationStyle, Fonts, Images, Spaces, Alignments } = useTheme();
  const { getClubInitials } = useClub();

  const backgroundImage = getBackgroundImage(event?.type?.name);
  const clubName = event?.team?.club?.name;
  const sectionName = event?.team?.section?.name;
  const logoUrl = event?.team?.club?.logo?.url;
  const locationDetails = event?.locationDetails;
  const invitedTeamNames = (event?.invitedTeams || [])
    .map((team) => team?.name)
    .filter(Boolean);

  const getLocationText = () => {
    try {
        if (!locationDetails) return '';
        const parsed = JSON.parse(locationDetails);
        const addr = parsed?.address;
        return (typeof addr === 'object' ? addr?.description : addr) || '';
    } catch (e) {
        return '';
    }
  };

  return (
    <ImageBackground
      source={backgroundImage}
      imageStyle={{ borderRadius: 24 }}
      resizeMode="cover"
      style={[
        ApplicationStyle.borderRadius24,
        Alignments.alignCenter,
        Alignments.relative,
        Spaces.gap[8],
        Spaces.paddingHorizontal[24],
        Spaces.paddingVertical[32],
      ]}
    >
      {/* Header: Logo + Club Name */}
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
            imageUrl={logoUrl}
            size={60}
            style={[
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.neutral00,
              { borderRadius: 60 },
            ]}
            imageStyle={{ borderRadius: 60 }}
          />
        ) : (
          <TeamShield
            initials={clubName ? getClubInitials(clubName) : ''}
            isSmall
          />
        )}
        <Text style={[Fonts.p1Bold, Fonts.neutral00, { maxWidth: '75%' }]}>
          {clubName}
        </Text>
      </View>

      {/* Section Name */}
      <View style={[Alignments.fullWidth, Spaces.gap[8], Spaces.marginBottom[12]]}>
        <Text style={[Fonts.p2Bold, Fonts.primary500, Fonts.textRight, Alignments.fullWidth]}>
          {sectionName}
        </Text>
        <View style={[Alignments.fullWidth, ApplicationStyle.separator, ApplicationStyle.backgroundColor.primary500]} />
      </View>

      {/* Info: Location, Date, Time, Team Category */}
      <View style={[Spaces.gap[24], Alignments.fill]}>
        {locationDetails && (
          <View style={[Alignments.row, Alignments.justifyCenter, Spaces.gap[8]]}>
            <Image
              source={Images.pin}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
            />
            <Text style={[Fonts.p2, Fonts.primary100, { maxWidth: '90%' }]}>
              {getLocationText()}
            </Text>
          </View>
        )}

        <View style={[Alignments.row, Alignments.fill, Spaces.gap[16]]}>
          {event?.date && (
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
          )}

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

        {invitedTeamNames.length > 0 && (
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              Equipes invitees
            </Text>
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {invitedTeamNames.join(' • ')}
            </Text>
          </View>
        )}
      </View>
    </ImageBackground>
  );
};

export default EventHeader;
