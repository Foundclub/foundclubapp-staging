import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import SvgIcon from '@/components/atoms/SvgIcon/SvgIcon';
import Tag from '@/components/atoms/tag/Tag';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';

import { RouteNames } from '@/navigation/routeNames';

import { formatDateWithDayPrefix } from '@/utils/date';
import {
  resolveExternalMatchDisplay,
  resolveExternalMatchLocation,
} from '@/utils/externalMatchDisplay';
import { getShortAddress } from '@/utils/location';

/**
 * Event Card component (Classic Design)
 * @param {object} props
 * @param {any} props.item
 * @param {(event: any) => void} props.onPress
 * @param {() => void} props.onJoin
 * @param {() => void} props.onDecline
 * @param {() => void} props.onParticipate
 * @param {() => void} props.onLogin
 */
function EventCard({
  item,
  onDecline,
  onJoin,
  onLogin,
  onParticipate,
  onPress,
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

  // Helper to safely access club data
  const club = item?.team?.club || item?.club;
  const clubName = club?.name || '';
  const clubLogo = club?.logo?.url;
  const sponsors = club?.sponsor || [];
  const isMatchEvent = String(item?.type?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .includes('match');
  const matchDisplay = isMatchEvent ? resolveExternalMatchDisplay(item) : { contextLabel: '', title: '' };
  const externalMatchLocation = isMatchEvent ? resolveExternalMatchLocation(item) : '';
  const isImportedExternalMatch = isMatchEvent && (
    item?.externalAutoSource === 'external_competition'
    || Array.isArray(item?.team?.externalCalendarData)
  );
  const primaryTitle = isMatchEvent && matchDisplay.title ? matchDisplay.title : clubName;
  const secondaryTitle = isMatchEvent && matchDisplay.title
    ? [matchDisplay.contextLabel, clubName].filter(Boolean).join(' - ')
    : item?.team?.name;
  const locationText = isImportedExternalMatch
    ? (
      externalMatchLocation
      || getShortAddress(item?.locationDetails)
      || getShortAddress(item?.location)
      || t('eventDetails.locationUnknown', 'Lieu à confirmer')
    )
    : (
      getShortAddress(item?.locationDetails)
      || getShortAddress(item?.location)
      || externalMatchLocation
      || ''
    );

  return (
    <TouchableOpacity
      onPress={() => onPress?.(item)}
      style={[
        Alignments.alignStart,
        Alignments.justifySpaceBetween,
        Spaces.padding[24],
        Spaces.marginVertical[12],
        Spaces.gap[24],
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius24,
      ]}
    >
      <View style={[Alignments.fullWidth]}>
        <View style={[Alignments.fullWidth, Alignments.alignEnd]}>
          {item?.type ? (
            <Tag
              text={item?.type?.name || ''}
            />
          ) : null}
        </View>
        <View style={[
          Alignments.row,
          Alignments.fullWidth,
          Alignments.alignCenter,
          Spaces.gap[8]]}
        >
          <ClubLogoMark
            logoStyle={{ borderRadius: 30 }}
            logoUrl={clubLogo}
            name={clubName}
            size={60}
          />
          <View style={[Spaces.gap[4], { maxWidth: '80%' }]}>
            <Text
              ellipsizeMode="tail"
              numberOfLines={2}
              style={[Fonts.p1Bold, Fonts.neutral00]}
            >
              {primaryTitle}
            </Text>
            {secondaryTitle && (
            <MarqueeText
              style={[Fonts.p2, Fonts.neutral200]}
              text={secondaryTitle}
            />
            )}
          </View>
        </View>
      </View>

      {/* Sponsors Section */}
      {sponsors?.length > 0 && (
      <View style={[Alignments.fullWidth, Spaces.marginTop[8]]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
            {sponsors.map((/** @type {any} */ sponsor) => (
              <SponsorLogoTile
                borderRadius={999}
                height={32}
                imageUrl={sponsor.logo?.url}
                key={sponsor.documentId || sponsor.id}
                link={sponsor.link}
                title={sponsor.title}
                titleStyle={[Fonts.p3, Fonts.neutral00]}
                width={56}
              />
            ))}
          </View>
        </ScrollView>
      </View>
      )}

      <View style={[
        Alignments.alignCenter,
        Spaces.gap[8],
        Alignments.row,
        Alignments.wrap]}
      >
        {item?.date ? (
          <View style={[
            Alignments.row, Spaces.gap[4], Spaces.marginRight[16]]}
          >
            <Image
              source={Images.calendar}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
            />
            <Text style={[Fonts.p2Bold, Fonts.neutral00, { textTransform: 'capitalize' }]}>
              {formatDateWithDayPrefix(item.date)}
            </Text>
          </View>
        ) : null}
        {item?.date ? (
          <View style={[
            Alignments.row, Spaces.gap[4], Spaces.marginRight[16]]}
          >
            <Image
              source={Images.clock}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
            />
            <Text
              numberOfLines={1}
              style={[Fonts.p2Bold, Fonts.neutral00]}
            >
              {item?.startTime && item?.endTime
                ? `${item.startTime.substring(0, 5)} - ${item.endTime.substring(0, 5)}`
                : format(item?.date, 'HH:mm')}
            </Text>
          </View>
        ) : null}
        {locationText ? (
          <View style={[Alignments.row, Spaces.gap[4], Spaces.marginRight[16]]}>
            <Image
              source={Images.pin}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
            />
            <Text style={[Fonts.p2, Fonts.primary100, { maxWidth: '95%' }]}>
              {locationText}
            </Text>
          </View>
        ) : null}
        {item?.team?.activities?.length ? (
          <View style={[Alignments.row, Spaces.gap[4], Spaces.marginRight[16]]}>
            <Image
              source={Images.running}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
            />
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {item?.team?.activities?.map(({ name }) => name)?.join(', ') || ''}
            </Text>
          </View>
        ) : null}
      </View>

      <EventAnswerButtons
        event={item}
        onAbout={() => onPress?.(item)}
        onDecline={() => onDecline?.(item)}
        onJoin={() => onJoin?.(item)}
        onLogin={onLogin}
        onParticipate={() => onParticipate?.(item)}
      />
    </TouchableOpacity>
  );
}

export default EventCard;
// Force rebuild
