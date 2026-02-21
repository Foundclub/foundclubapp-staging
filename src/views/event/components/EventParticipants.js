import React from 'react';
import {
  View, Text, TouchableOpacity, Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import useTheme from '@/theme/themeContext';

const SHARE_ICON = require('@/assets/icons/share2.png');

/** @typedef {import('@/domains/auth/types').User} User */
/** @typedef {{ documentId?: string; user: User }} PendingParticipation */
/**
 * @typedef {object} ParticipationsByStatus
 * @property {User[]} participating
 * @property {User[]} missing
 * @property {User[]} notAnswered
 */
/**
 * @typedef {{ arrivedAt?: string | null, lateMinutes?: number | null, source?: string | null, manualOverride?: boolean }} AttendanceState
 */
/**
 * @typedef {object} EventParticipantsProps
 * @property {import('@/domains/event/types').FCEvent | undefined} event
 * @property {ParticipationsByStatus | undefined} participationsByStatus
 * @property {PendingParticipation[]} pendingParticipations
 * @property {boolean} canEdit
 * @property {(user?: User) => void} handleUserPress
 * @property {() => void} handleRemindPlayers
 * @property {() => void} handleShare
 * @property {() => void} handleExportParticipants
 * @property {(participationId?: string, status?: 'accepted' | 'declined') => void} [handleUpdateParticipation]
 * @property {Record<string, AttendanceState>} [attendanceByUserId]
 * @property {Date | null | undefined} [eventStartAt]
 * @property {number | undefined} [nowMs]
 * @property {(user?: User) => void} [onCoachMarkArrival]
 * @property {(user?: User) => void} [onCoachEditLate]
 */

/**
 * @param {EventParticipantsProps} props
 */
const EventParticipants = ({
  event,
  participationsByStatus,
  pendingParticipations,
  canEdit,
  handleUserPress,
  handleRemindPlayers,
  handleShare,
  handleExportParticipants,
  handleUpdateParticipation,
  attendanceByUserId = {},
  eventStartAt,
  nowMs,
  onCoachMarkArrival,
  onCoachEditLate,
}) => {
  const {
    ApplicationStyle, Fonts, Spaces, Alignments, Colors,
  } = useTheme();
  const { t } = useTranslation();

  const renderParticipant = (player, options = {}) => {
    const userId = player?.documentId || '';
    const attendance = userId ? attendanceByUserId[userId] : null;
    return (
      <ParticipantItem
        key={player.documentId}
        attendance={attendance}
        allowLiveLate={Boolean(options.allowLiveLate)}
        canEdit={Boolean(options.showCoachActions)}
        eventStartAt={eventStartAt}
        nowMs={nowMs}
        onEditLate={onCoachEditLate}
        onMarkArrival={onCoachMarkArrival}
        onPress={handleUserPress}
        player={player}
        styles={{
          ApplicationStyle, Alignments, Spaces, Fonts, Colors,
        }}
      />
    );
  };

  return (
    <View style={[Spaces.gap[16], Alignments.fill]}>
      {canEdit && pendingParticipations?.length > 0 && (
        <View style={[Spaces.gap[16], Alignments.fill]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('eventDetails.fields.participationRequests')}
          </Text>
          {pendingParticipations.map((participation) => (
            <TouchableOpacity
              key={participation.documentId}
              onPress={() => handleUserPress(participation.user)}
              style={[
                ApplicationStyle.borderRadius24,
                Alignments.row,
                Alignments.fill,
                ApplicationStyle.backgroundColor.primary700,
                Spaces.padding[24],
                Spaces.gap[24],
              ]}
            >
              <View style={[Alignments.row, Spaces.gap[16], Alignments.alignCenter, Alignments.fill]}>
                <ProfileAvatar
                  imageUrl={participation.user.avatar?.url}
                  size={40}
                  style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 40 }]}
                  imageStyle={{ borderRadius: 40 }}
                />
                <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { flexShrink: 1 }]}>
                  {`${participation.user.firstname} ${participation.user.lastname}`}
                </Text>
              </View>
              <View style={[Alignments.row, Spaces.gap[8], Alignments.justifyCenter]}>
                <Button
                  icon="check"
                  isOption
                  onPress={() => handleUpdateParticipation && handleUpdateParticipation(participation.documentId, 'accepted')}
                  variant="Primary"
                />
                <Button
                  icon="close"
                  isOption
                  onPress={() => handleUpdateParticipation && handleUpdateParticipation(participation.documentId, 'declined')}
                  variant="Secondary"
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('eventDetails.fields.participations')}
          <Text>
            {` :  ${event?.participations?.length || 0} ${event?.capacity ? ' / ' : ''} ${event?.capacity || ''}`}
          </Text>
        </Text>
        <TouchableOpacity onPress={handleShare}>
          <Image source={SHARE_ICON} style={{ height: 48, width: 48 }} resizeMode="contain" />
        </TouchableOpacity>
      </View>

      {canEdit && (
        <TouchableOpacity onPress={handleExportParticipants} style={[{ alignSelf: 'flex-start' }, Spaces.marginTop[4]]}>
          <Text style={[Fonts.p2, Fonts.primary500, { textDecorationLine: 'underline' }]}>
            Exporter la liste (Excel/CSV)
          </Text>
        </TouchableOpacity>
      )}

      {participationsByStatus ? (
        <>
          {participationsByStatus.participating.length > 0 && (
            <>
              <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                {t('eventDetails.participationStatus.participating')}
              </Text>
              {participationsByStatus.participating.map((player) => renderParticipant(player, {
                showCoachActions: canEdit,
                allowLiveLate: true,
              }))}
            </>
          )}

          {participationsByStatus.missing.length > 0 && (
            <>
              <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                {t('eventDetails.participationStatus.missing')}
              </Text>
              {participationsByStatus.missing.map((player) => renderParticipant(player, {
                allowLiveLate: false,
              }))}
            </>
          )}

          {participationsByStatus.notAnswered.length > 0 && (
            <>
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.spaceBetween, Spaces.gap[16]]}>
                <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                  {t('eventDetails.participationStatus.notAnswered')}
                </Text>
                <Button isOption onPress={handleRemindPlayers} title={t('eventDetails.actions.remind')} variant="Primary" />
              </View>
              {participationsByStatus.notAnswered.map((player) => renderParticipant(player, {
                allowLiveLate: false,
              }))}
            </>
          )}
        </>
      ) : (
        event?.participations?.map((player) => renderParticipant(player, {
          showCoachActions: canEdit,
          allowLiveLate: true,
        }))
      )}
    </View>
  );
};

/**
 * @param {{
 * player: User,
 * attendance?: AttendanceState | null,
 * allowLiveLate?: boolean,
 * canEdit?: boolean,
 * eventStartAt?: Date | null,
 * nowMs?: number,
 * onPress: (user?: User) => void,
 * onMarkArrival?: (user?: User) => void,
 * onEditLate?: (user?: User) => void,
 * styles: any
 * }} props
 */
const ParticipantItem = ({
  player,
  attendance,
  allowLiveLate = false,
  canEdit = false,
  eventStartAt,
  nowMs,
  onPress,
  onMarkArrival,
  onEditLate,
  styles,
}) => {
  const {
    ApplicationStyle, Alignments, Spaces, Fonts,
  } = styles;

  const hasArrived = Boolean(attendance?.arrivedAt);
  const storedLateMinutes = Math.max(0, Number(attendance?.lateMinutes || 0));
  let lateMinutes = storedLateMinutes;

  if (allowLiveLate && !hasArrived && eventStartAt && typeof nowMs === 'number') {
    const eventStartMs = eventStartAt.getTime();
    if (!Number.isNaN(eventStartMs) && nowMs > eventStartMs) {
      const runningLateMinutes = Math.max(1, Math.ceil((nowMs - eventStartMs) / 60000));
      lateMinutes = Math.max(storedLateMinutes, runningLateMinutes);
    }
  }

  const lateLabel = lateMinutes > 0 ? `+${lateMinutes} min` : '0 min';

  return (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.backgroundColor.primary700,
        Alignments.fill,
        Spaces.padding[16],
        Spaces.gap[10],
      ]}
    >
      <TouchableOpacity
        onPress={() => onPress(player)}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          Spaces.gap[16],
        ]}
      >
        <View style={[Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 1 }]}>
          <ProfileAvatar
            imageUrl={player?.avatar?.url}
            size={40}
            style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 40 }]}
            imageStyle={{ borderRadius: 40 }}
          />
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>
            {`${player.firstname} ${player.lastname}`}
          </Text>
        </View>
        <View
          style={[
            Spaces.paddingHorizontal[10],
            Spaces.paddingVertical[4],
            ApplicationStyle.borderRadius12,
            Alignments.alignCenter,
            { backgroundColor: lateMinutes > 0 ? '#F59E0B22' : '#16A34A22' },
          ]}
        >
          <Text style={[Fonts.p4, lateMinutes > 0 ? { color: '#fbbf24' } : { color: '#4ade80' }]}>
            Retard
          </Text>
          <Text style={[Fonts.p4Bold, lateMinutes > 0 ? { color: '#fbbf24' } : { color: '#4ade80' }]}>
            {lateLabel}
          </Text>
        </View>
      </TouchableOpacity>

      {canEdit && (
        <View style={[Alignments.row, Spaces.gap[8], Alignments.justifyEnd]}>
          <Button
            onPress={() => onMarkArrival && onMarkArrival(player)}
            size="sm"
            title="Arrivé"
            variant="Primary"
          />
          <Button
            icon="edit"
            onPress={() => onEditLate && onEditLate(player)}
            size="sm"
            variant="SecondaryLight"
          />
        </View>
      )}
    </View>
  );
};

export default EventParticipants;
