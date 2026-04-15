import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useEvent from '@/domains/event/useEvent';
import { resolveParticipationFlow } from '@/domains/participation/participationFlow';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';

/**
 * Component for rendering event participation answer buttons
 * @param {object} props
 * @param {FCEvent} props.event - The event data
 * @param {() => void} props.onJoin - Callback when user wants to join
 * @param {() => void} props.onParticipate - Callback when user participate on its team event
 * @param {() => void} props.onDecline - Callback when user declines
 * @param {() => void} [props.onAbout] - Callback when user wants to see details
 * @param {() => void} props.onLogin - Callback when user needs to login
 * @param {boolean} [props.hasAcceptedRequest]
 * @param {boolean} [props.hasPendingRequest]
 * @param {() => void} [props.onDeleteParticipation] - Callback to delete their participation
 * @param {() => void} [props.onEdit] - Callback when user wants to edit the event
 * @param {() => void} [props.onCancel] - Callback when user wants to cancel the event
 * @param {ReturnType<typeof resolveParticipationFlow>} [props.participationFlow]
 * @returns {import('react').ReactElement} Event answer buttons component
 */
function EventAnswerButtons({
  event,
  hasAcceptedRequest,
  hasPendingRequest,
  onAbout,
  onCancel,
  onDecline,
  onDeleteParticipation,
  onEdit,
  onJoin,
  onLogin,
  onParticipate,
  participationFlow,
}) {
  // hooks
  const { t } = useTranslation();
  const { Alignments, Fonts, Spaces } = useTheme();
  const { userData } = useAuth();
  const { canEventBeJoined, haveIAlreadyAnsweredNo, haveIAlreadyJoined } = useEvent();

  // Check participation status
  const alreadyJoined = haveIAlreadyJoined({
    participations: event?.participations,
    userId: userData?.documentId,
  });

  const alreadyMissing = haveIAlreadyAnsweredNo({
    missings: event?.missings,
    userId: userData?.documentId,
  });
  const resolvedParticipationFlow = participationFlow || resolveParticipationFlow(event, {
    participationState: {
      hasAcceptedRequest,
      hasPendingRequest,
      isMissing: alreadyMissing,
      isParticipating: alreadyJoined,
    },
    user: userData,
  });
  const isStageDayEvent = String(event?.eventFormat || '').trim().toLowerCase() === 'stage_day';
  let dailyRsvpStatus = null;
  if (alreadyMissing) {
    dailyRsvpStatus = 'absent';
  } else if (alreadyJoined || hasAcceptedRequest) {
    dailyRsvpStatus = 'present';
  } else if (hasPendingRequest) {
    dailyRsvpStatus = 'pending';
  }

  // If user is a player, show appropriate participation buttons
  if (userData?.role?.name === USER_ROLES.player) {
    if (isStageDayEvent && dailyRsvpStatus) {
      let statusLabel = '';
      if (dailyRsvpStatus === 'present') statusLabel = t('eventList.info.alreadyJoined');
      if (dailyRsvpStatus === 'absent') statusLabel = t('eventList.info.alreadyMissing');

      return (
        <View style={[Alignments.fullWidth, Spaces.gap[12]]}>
          {statusLabel ? (
            <Tag
              text={statusLabel}
              textStyle={Fonts.p1Bold}
            />
          ) : null}
          <View style={[Alignments.row, Alignments.fullWidth, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Button
                disabled={dailyRsvpStatus === 'present'}
                onPress={onParticipate}
                style={Alignments.fullWidth}
                title={t('eventList.actions.present')}
                variant={dailyRsvpStatus === 'present' ? 'SecondaryLight' : 'Primary'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                disabled={dailyRsvpStatus === 'absent'}
                onPress={onDecline}
                style={Alignments.fullWidth}
                title={t('eventList.actions.absent')}
                variant={dailyRsvpStatus === 'absent' ? 'SecondaryLight' : 'Secondary'}
              />
            </View>
          </View>
        </View>
      );
    }

    if (alreadyJoined || hasAcceptedRequest || hasPendingRequest) {
      return (
        <View style={[Alignments.fullWidth, Spaces.gap[16]]}>
          <Tag
            text={hasPendingRequest ? t('eventList.info.pendingRequest') : t('eventList.info.alreadyJoined')}
            textStyle={Fonts.p1Bold}
          />
          {onDeleteParticipation && (
            <Button
              onPress={onDeleteParticipation}
              style={Alignments.fullWidth}
              title={t('eventDetails.actions.cancelResponse')}
              variant="SecondaryLight"
            />
          )}
        </View>
      );
    }

    if (alreadyMissing) {
      return (
        <View style={[Alignments.fullWidth, Spaces.gap[16]]}>
          <Tag
            text={t('eventList.info.alreadyMissing')}
            textStyle={Fonts.p1Bold}
          />
          {onDeleteParticipation && (
            <Button
              onPress={onDeleteParticipation}
              style={Alignments.fullWidth}
              title={t('eventDetails.actions.editResponse')}
              variant="SecondaryLight"
            />
          )}
        </View>
      );
    }

    if (event?.sessionStatus?.toLowerCase() === 'closed') {
      if (!resolvedParticipationFlow?.canAct) {
        return (
          <View style={[Alignments.fullWidth, Spaces.gap[16]]}>
            <Tag
              text={t('eventList.info.restrictedEvent', 'Acces reserve')}
              textStyle={Fonts.p1Bold}
            />
            {onAbout ? (
              <Button
                onPress={onAbout}
                style={Alignments.fullWidth}
                title={t('common.actions.seeMore', 'Voir le detail')}
                variant="SecondaryLight"
              />
            ) : null}
          </View>
        );
      }

      return (
        <View style={[Alignments.row, Alignments.fullWidth, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <Button
              onPress={onParticipate}
              style={Alignments.fullWidth}
              title={t('eventList.actions.present')}
              variant="Primary"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              onPress={onDecline}
              style={Alignments.fullWidth}
              title={t('eventList.actions.absent')}
              variant="Secondary"
            />
          </View>
        </View>
      );
    }

    return (
      <View style={[Alignments.fullWidth, Spaces.gap[10]]}>
        <Button
          disabled={!resolvedParticipationFlow?.canAct || !canEventBeJoined({
            capacity: event?.capacity,
            participations: event?.participations,
            userId: userData?.documentId,
            userRole: userData?.role,
          })}
          onPress={onJoin}
          style={Alignments.fullWidth}
          title={resolvedParticipationFlow?.actionLabel || t('eventList.actions.join')}
          variant="Primary"
        />
        {!resolvedParticipationFlow?.canAct && resolvedParticipationFlow?.blockedReason ? (
          <Text style={[Fonts.p4, Fonts.neutral300]}>
            {resolvedParticipationFlow.blockedReason}
          </Text>
        ) : null}
      </View>
    );
  }

  // If user is a coach or president, show edit and cancel buttons if provided
  if (userData?.role?.name === USER_ROLES.coach
     || userData?.role?.name === USER_ROLES.president) {
    if (onEdit && onCancel) {
      return (
        <View style={[Alignments.fullWidth, Spaces.gap[16]]}>
          <Button
            onPress={onEdit}
            title={t('eventDetails.actions.edit')}
            variant="Primary"
          />
          <Button
            onPress={onCancel}
            title={t('eventDetails.actions.cancelEvent')}
            variant="SecondaryLight"
          />
        </View>
      );
    }
    if (onAbout) {
      return (
        <Button
          onPress={onAbout}
          style={Alignments.fullWidth}
          title={t('eventList.actions.about')}
          variant="Primary"
        />
      );
    }
    return <View />;
  }

  // For non-logged in users, show login button
  return (
    <Button
      onPress={onLogin}
      style={Alignments.fullWidth}
      title={t('eventList.actions.join')}
      variant="Primary"
    />
  );
}

export default EventAnswerButtons;
