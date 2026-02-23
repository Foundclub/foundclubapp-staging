import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
  Image, Linking, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useClub from '@/domains/club/useClub';
import useTheme from '@/theme/themeContext';

import SponsorLogoTile from '@/components/atoms/sponsorLogoTile/SponsorLogoTile';
import SvgIcon from '@/components/atoms/SvgIcon/SvgIcon';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { RouteNames } from '@/navigation/routeNames';

import { formatDateWithDayPrefix } from '@/utils/date';
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
  const { getClubInitials } = useClub();

  // Helper to safely access club data
  const club = item?.team?.club || item?.club;
  const clubName = club?.name || '';
  const clubLogo = club?.logo?.url;
  const sponsors = club?.sponsor || [];

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
          {clubLogo ? (
            <ProfileAvatar
              imageStyle={{ borderRadius: 30 }}
              imageUrl={clubLogo}
              size={60}
              style={{ borderRadius: 30 }}
            />
          ) : (
            <TeamShield
              initials={clubName ? getClubInitials(clubName) : ''}
              isSmall
            />
          )}
          <View style={[Spaces.gap[4], { maxWidth: '80%' }]}>
            <Text
              ellipsizeMode="tail"
              numberOfLines={2}
              style={[Fonts.p1Bold, Fonts.neutral00]}
            >
              {clubName}
            </Text>
            {/* Display Team Name below Club Name */}
            {item?.team?.name && (
            <Text
              ellipsizeMode="tail"
              numberOfLines={1}
              style={[Fonts.p2, Fonts.neutral200]}
            >
              {item.team.name}
            </Text>
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
                borderRadius={8}
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
        {item?.locationDetails ? (
          <View style={[Alignments.row, Spaces.gap[4], Spaces.marginRight[16]]}>
            <Image
              source={Images.pin}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
            />
            <Text style={[Fonts.p2, Fonts.primary100, { maxWidth: '95%' }]}>
              {getShortAddress(item.locationDetails)}
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
