import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useEvent from '@/domains/event/useEvent';
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
 * @param {() => void} props.onAbout - Callback when user wants to see details
 * @param {() => void} props.onLogin - Callback when user needs to login
 * @param {boolean} [props.hasPendingRequest]
 * @param {() => void} [props.onEdit] - Callback when user wants to edit the event
 * @param {() => void} [props.onCancel] - Callback when user wants to cancel the event
 * @returns {import('react').ReactElement} Event answer buttons component
 */
function EventAnswerButtons({
  event,
  hasPendingRequest,
  onAbout,
  onCancel,
  onDecline,
  onEdit,
  onJoin,
  onLogin,
  onParticipate,
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

  // If user is a player, show appropriate participation buttons
  if (userData?.role?.name === USER_ROLES.player) {
    if (alreadyJoined || hasPendingRequest) {
      return (
        <View style={[Alignments.fullWidth]}>
          <Tag
            text={hasPendingRequest ? t('eventList.info.pendingRequest') : t('eventList.info.alreadyJoined')}
            textStyle={Fonts.p1Bold}
          />
        </View>
      );
    }

    if (alreadyMissing) {
      return (
        <View style={[Alignments.fullWidth]}>
          <Tag
            text={t('eventList.info.alreadyMissing')}
            textStyle={Fonts.p1Bold}
          />
        </View>
      );
    }

    if (event?.sessionStatus?.toLowerCase() === 'closed') {
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
      <Button
        disabled={!canEventBeJoined({
          capacity: event?.capacity,
          participations: event?.participations,
          userId: userData?.documentId,
          userRole: userData?.role,
        })}
        onPress={onJoin}
        style={Alignments.fullWidth}
        title={t('eventList.actions.join')}
        variant="Primary"
      />
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
    return (
      <Button
        onPress={onAbout}
        style={Alignments.fullWidth}
        title={t('eventList.actions.about')}
        variant="Primary"
      />
    );
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
