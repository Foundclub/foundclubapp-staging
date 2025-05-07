import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import useEvent from '@/domains/event/useEvent';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent } from '@/services/event/eventQueries';
import { useGetEventParticipations } from '@/services/eventParticipation/eventParticipationQueries';

/**
 * Event details screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Event details screen component
 */
function EventDetails({ navigation, route }) {
  const { eventId } = route?.params ?? {};
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);

  // hooks
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { getClubInitials } = useClub();
  const { canEditEvent, userData } = useAuth();
  const { canEventBeJoined, haveIAlreadyJoined } = useEvent();

  const {
    data: event,
    error,
    isLoading,
    refetch,
  } = useGetEvent(eventId);
  const { data: eventParticipations } = useGetEventParticipations(
    eventId,
    userData?.documentId,
    {
      pageSize: 100,
    },
  );

  // handlers
  const handleEditEvent = useCallback(() => {
    navigation.navigate(RouteNames.EventEdit, { eventId });
  }, [navigation, eventId]);

  const handleJoinEvent = useCallback(() => {
    setIsJoinModalVisible(true);
  }, []);

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinModalVisible(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // memoized values
  const hasPendingRequest = useMemo(() => {
    const myParticipations = eventParticipations?.pages?.[0]?.data || [];
    if (myParticipations.length) {
      return myParticipations.some((participation) => (
        participation.participationStatus === 'pending'
        && participation.user.documentId === userData?.documentId
      ));
    }
    return false;
  }, [eventParticipations, userData]);

  const participationInfo = useMemo(
    () => (hasPendingRequest ? t('eventList.info.pendingRequest') : t('eventList.info.alreadyJoined')),
    [hasPendingRequest, t],
  );

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingBottom[32],
        Spaces.gap[32],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[
        Spaces.gap[8],
        Alignments.justifyCenter,
        Alignments.alignCenter]}
      >
        <Tag
          text={event?.type?.name?.toUpperCase() || ''}
          textStyle={Fonts.p2}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          Spaces.gap[32],
          Spaces.paddingBottom[40],
        ]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetch}
            refreshing={isLoading}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <WithDataWrapper
          error={error?.message}
          isLoading={isLoading}
          wrapperStyle={[Alignments.fill, Spaces.gap[24]]}
        >
          <View
            style={[
              ApplicationStyle.borderRadius24,
              ApplicationStyle.backgroundColor.primary700,
              Alignments.alignCenter,
              Alignments.relative,
              Spaces.gap[8],
              Spaces.paddingHorizontal[24],
              Spaces.paddingVertical[32],
            ]}
          >
            <View style={[
              Spaces.gap[4],
              Alignments.alignCenter,
              Alignments.fullWidth,
              Alignments.row,
            ]}
            >
              <TeamShield
                initials={event?.team?.club?.name ? getClubInitials(event?.team?.club?.name || '') : ''}
                isSmall
              />
              <Text style={[Fonts.p1Bold, Fonts.neutral00, { maxWidth: '75%' }]}>
                {event?.team?.club?.name}
              </Text>
            </View>
            <View style={[Alignments.fullWidth, Spaces.gap[8], Spaces.marginBottom[12],
            ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.primary500, Fonts.textRight, Alignments.fullWidth]}>
                {event?.team?.section?.name}
              </Text>
              <View style={[
                Alignments.fullWidth,
                ApplicationStyle.separator,
                ApplicationStyle.backgroundColor.primary500,
              ]}
              />
            </View>

            <View style={[
              Spaces.gap[24],
              Alignments.fill,
            ]}
            >
              {event?.locationDetails ? (
                <View style={[Alignments.row, Alignments.justifyCenter, Spaces.gap[8]]}>
                  <Image
                    source={Images.pin}
                    style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
                  />
                  <Text style={[Fonts.p2, Fonts.primary100]}>
                    {JSON.parse(event.locationDetails)?.address}
                  </Text>
                </View>
              ) : null}
              <View style={[
                Alignments.row,
                Alignments.fill,
                Spaces.gap[16]]}
              >
                { event?.date ? (
                  <View style={[Spaces.gap[8]]}>
                    <View style={[Alignments.row, Spaces.gap[8]]}>
                      <Image
                        source={Images.calendar}
                        style={[ApplicationStyle.icon20,
                          ApplicationStyle.tintColor.neutral00]}
                      />
                      <Text style={[Fonts.p2, Fonts.primary100]}>
                        {format(new Date(event.date), 'dd MMMM yyyy')}
                      </Text>
                    </View>

                    <View style={[Alignments.row, Spaces.gap[4]]}>
                      <Image
                        source={Images.clock}
                        style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
                      />
                      <Text style={[Fonts.p2, Fonts.primary100]}>
                        {format(new Date(event.date), 'HH:mm')}
                      </Text>
                    </View>
                  </View>
                ) : null}
                <View style={[
                  { height: 45, width: 1 },
                  ApplicationStyle.backgroundColor.neutral00,
                ]}
                />
                { event?.team ? (
                  <View style={[Spaces.gap[8]]}>

                    <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, Fonts.uppercase]}>
                      {event?.team?.category?.name}
                    </Text>

                    <Text numberOfLines={1} style={[Fonts.p2, Fonts.primary100, Fonts.uppercase]}>
                      {event?.team?.level?.name}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
          {/* Description section */}
          <View style={[Spaces.gap[16], Alignments.fill]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.fields.description')}
            </Text>
            <Text style={[Fonts.p1, Fonts.primary100]}>
              {event?.description}
            </Text>
          </View>
          {/* Participation section */}
          <View style={[Spaces.gap[16], Alignments.fill]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('eventDetails.fields.participations')}
              <Text>{` :  ${event?.participations?.length || 0} / ${event?.capacity}`}</Text>
            </Text>
            {
              event?.participations?.map((/** @type {User} */ player) => (
                <View
                  key={player.documentId}
                  style={[
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.backgroundColor.primary700,
                    Alignments.row,
                    Alignments.alignCenter,
                    Alignments.justifySpaceBetween,
                    Spaces.padding[16],
                    Spaces.gap[16]]}
                >
                  <View style={[Alignments.row, Spaces.gap[16], Alignments.alignCenter]}>
                    <Image
                      source={player.avatar ? { uri: player?.avatar?.url } : Images.roundAvatar}
                      style={[
                        ApplicationStyle.roundIcon40,
                        ApplicationStyle.borderWidth1,
                        ApplicationStyle.borderColor.neutral00,
                      ]}
                    />
                    <Text numberOfLines={1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                      {`${player.firstname} ${player.lastname}`}
                    </Text>
                  </View>
                </View>
              ))
            }
          </View>
        </WithDataWrapper>
      </ScrollView>

      <View style={[Spaces.gap[16],
        Spaces.paddingHorizontal[16],
        Spaces.marginVertical[16]]}
      >
        {haveIAlreadyJoined({
          participations: event?.participations || [],
          userId: userData?.documentId,
        }) || hasPendingRequest ? (
          <Tag
            text={participationInfo}
            textStyle={Fonts.p1Bold}
          />
          ) : (
            <Button
              disabled={!canEventBeJoined({
                capacity: event?.capacity || 0,
                participations: event?.participations || [],
                userId: userData?.documentId,
                userRole: userData?.role,
              })}
              onPress={handleJoinEvent}
              title={t('eventList.actions.join')}
              variant="Primary"
            />
          )}
        {canEditEvent(event?.team?.documentId || '') && (
          <Button
            onPress={handleEditEvent}
            title={t('eventDetails.actions.edit')}
            variant="Primary"
          />
        )}
      </View>

      <JoinEventModal
        eventId={eventId}
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
        onSuccess={refetch}
      />
    </ScreenContainer>
  );
}

export default EventDetails;
