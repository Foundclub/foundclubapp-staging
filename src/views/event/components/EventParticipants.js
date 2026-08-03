// @ts-nocheck
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

// import statique (pas require) : require n'existe pas sur le rendu web ESM.
import SHARE_ICON from '@/assets/icons/share2.png';

/**
 * @typedef {{
 *   id?: string | number;
 *   documentId?: string;
 *   firstname?: string;
 *   lastname?: string;
 *   email?: string;
 *   phone?: string;
 *   phoneNumber?: string;
 *   position?: string;
 *   avatar?: { url?: string };
 * }} User
 */
/** @typedef {{ documentId?: string; user: User; sourceTeam?: { documentId?: string; name?: string }; participationStatus?: string; isActive?: boolean }} PendingParticipation */
/**
 * @typedef {object} ParticipationsByStatus
 * @property {User[]} participating
 * @property {User[]} missing
 * @property {User[]} notAnswered
 */
/**
 * @typedef {{
 *   arrivedAt?: string | null,
 *   attendanceStatus?: 'not_marked' | 'declared_late' | 'arrived_on_time' | 'arrived_late' | 'no_show' | null,
 *   countsInTeamStats?: {
 *     absence?: boolean,
 *     attendance?: boolean,
 *     late?: boolean,
 *     rsvpYes?: boolean,
 *   } | null,
 *   declaredAt?: string | null,
 *   declaredLateMinutes?: number | null,
 *   declarationSource?: string | null,
 *   finalOperationalStatus?: 'present' | 'late' | 'absent' | 'pending' | null,
 *   finalState?: 'declared_late' | 'arrived_on_time' | 'arrived_late' | 'no_show' | null,
 *   finalizedAt?: string | null,
 *   lateMinutes?: number | null,
 *   source?: string | null,
 *   manualOverride?: boolean,
 *   note?: string | null,
 *   rsvpStatus?: 'participating' | 'missing' | 'pending' | 'not_answered' | null,
 *   updatedBy?: { firstname?: string, lastname?: string } | null
 * }} AttendanceState
 */
/**
 * @typedef {{
 *   key: string;
 *   teamName: string;
 *   isHome?: boolean;
 *   isExternal?: boolean;
 *   allowCoachActions?: boolean;
 *   participating: User[];
 *   missing: User[];
 *   notAnswered: User[];
 *   pending?: PendingParticipation[];
 *   historical?: {
 *     participating?: User[];
 *     missing?: User[];
 *     pending?: PendingParticipation[];
 *   };
 * }} TeamParticipationSection
 */
/**
 * @typedef {object} EventParticipantsProps
 * @property {import('@/domains/event/types').FCEvent | undefined} event
 * @property {ParticipationsByStatus | undefined} participationsByStatus
 * @property {PendingParticipation[]} pendingParticipations
 * @property {TeamParticipationSection[]} [teamParticipationSections]
 * @property {TeamParticipationSection | null} [externalParticipationSection]
 * @property {{ participatingCount?: number; capacity?: number }} [participantsSummary]
 * @property {boolean} canEdit
 * @property {boolean} [canApprovePendingRequests]
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
 * @param {User | undefined} user
 * @returns {string}
 */
function getUserDisplayName(user) {
  const firstname = String(user?.firstname || '').trim();
  const lastname = String(user?.lastname || '').trim();
  const fullName = [firstname, lastname].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;

  const username = String(user?.username || '').trim();
  if (username && !/^[+()\d\s-]{8,}$/.test(username)) return username;

  const phoneNumber = String(user?.phoneNumber || user?.phone || '').trim();
  if (phoneNumber) return phoneNumber;

  return 'Utilisateur';
}

const getStaffDisplayName = (user) => {
  const firstname = String(user?.firstname || '').trim();
  const lastname = String(user?.lastname || '').trim();
  return [firstname, lastname].filter(Boolean).join(' ').trim() || 'Staff';
};

const resolveAttendanceBadge = ({
  allowLiveLate = false,
  attendance,
  colors,
  eventStartAt,
  nowMs,
  statusKind = 'participating',
}) => {
  const normalizedAttendanceStatus = String(
    attendance?.attendanceStatus || attendance?.finalState || '',
  ).trim().toLowerCase();
  const normalizedRsvpStatus = String(attendance?.rsvpStatus || '').trim().toLowerCase();
  const hasArrived = Boolean(attendance?.arrivedAt);
  const lateMinutes = Math.max(0, Number(attendance?.lateMinutes || 0));
  const declaredLateMinutes = Math.max(0, Number(attendance?.declaredLateMinutes || 0));

  let runningLateMinutes = 0;
  if (!hasArrived && allowLiveLate && eventStartAt && typeof nowMs === 'number') {
    const eventStartMs = eventStartAt.getTime();
    if (!Number.isNaN(eventStartMs) && nowMs > eventStartMs) {
      runningLateMinutes = Math.max(0, Math.floor((nowMs - eventStartMs) / 60000));
    }
  }

  if (normalizedAttendanceStatus === 'no_show') {
    return {
      backgroundColor: `${colors.error500}18`,
      borderColor: `${colors.error500}36`,
      textColor: colors.error500,
      title: 'Non pointe',
      value: null,
    };
  }

  if (statusKind === 'missing' || normalizedRsvpStatus === 'missing') {
    return {
      backgroundColor: `${colors.error500}18`,
      borderColor: `${colors.error500}36`,
      textColor: colors.error500,
      title: 'Absent',
      value: null,
    };
  }

  if (statusKind === 'not_answered' || normalizedRsvpStatus === 'not_answered') {
    return {
      backgroundColor: `${colors.neutral300}12`,
      borderColor: `${colors.neutral300}24`,
      textColor: colors.neutral200,
      title: 'Sans réponse',
      value: null,
    };
  }

  if (hasArrived) {
    if (lateMinutes > 0) {
      return {
        backgroundColor: `${colors.warning500}18`,
        borderColor: `${colors.warning500}36`,
        textColor: colors.warning500,
        title: 'Arrive',
        value: `+${lateMinutes} min`,
      };
    }

    return {
      backgroundColor: `${colors.success500}18`,
      borderColor: `${colors.success500}36`,
      textColor: colors.success500,
      title: 'Arrive',
      value: null,
    };
  }

  if (normalizedAttendanceStatus === 'declared_late' || declaredLateMinutes > 0) {
    return {
      backgroundColor: `${colors.warning500}18`,
      borderColor: `${colors.warning500}36`,
      textColor: colors.warning500,
      title: 'Retard annonce',
      value: `+${declaredLateMinutes} min`,
    };
  }

  if (runningLateMinutes > 0) {
    return {
      backgroundColor: `${colors.warning500}18`,
      borderColor: `${colors.warning500}36`,
      textColor: colors.warning500,
      title: 'En attente',
      value: `+${runningLateMinutes} min`,
    };
  }

  return {
    backgroundColor: `${colors.neutral300}12`,
    borderColor: `${colors.neutral300}24`,
    textColor: colors.neutral200,
    title: 'En attente',
    value: null,
  };
};

/**
 * @param {EventParticipantsProps} props
 */
function EventParticipants({
  attendanceByUserId = {},
  canEdit,
  canApprovePendingRequests = canEdit,
  event,
  eventStartAt,
  externalParticipationSection = null,
  handleExportParticipants,
  handleRemindPlayers,
  handleShare,
  handleUpdateParticipation,
  handleUserPress,
  nowMs,
  onCoachEditLate,
  onCoachMarkArrival,
  participantsSummary,
  participationsByStatus,
  pendingParticipations,
  teamParticipationSections = [],
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const areParticipantIdentitiesHidden = event?.participantIdentitiesHidden === true;

  const renderParticipant = (player, options = {}) => {
    const userId = player?.documentId || '';
    const attendance = userId ? attendanceByUserId[userId] : null;
    return (
      <ParticipantItem
        allowLiveLate={Boolean(options.allowLiveLate)}
        attendance={attendance}
        canEdit={Boolean(options.showCoachActions)}
        eventStartAt={eventStartAt}
        key={`${options.keyPrefix || 'participant'}-${player.documentId || userId}`}
        nowMs={nowMs}
        onEditLate={onCoachEditLate}
        onMarkArrival={onCoachMarkArrival}
        onPress={handleUserPress}
        player={player}
        statusKind={options.statusKind || 'participating'}
        styles={{
          Alignments, ApplicationStyle, Colors, Fonts, Spaces,
        }}
      />
    );
  };

  const renderPendingCard = (participation, indexKey) => (
    <TouchableOpacity
      key={participation.documentId || `pending-${indexKey}`}
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
          imageStyle={{ borderRadius: 40 }}
          imageUrl={participation.user.avatar?.url}
          name={getUserDisplayName(participation.user)}
          size={40}
          style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 40 }]}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { flexShrink: 1 }]}>
            {getUserDisplayName(participation.user)}
          </Text>
          {participation?.sourceTeam?.name ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {participation.sourceTeam.name}
            </Text>
          ) : null}
        </View>
      </View>
      {canApprovePendingRequests ? (
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
      ) : null}
    </TouchableOpacity>
  );

  const renderStatusGroup = (title, players, options = {}) => {
    if (!players?.length) return null;
    return (
      <>
        <Text style={[Fonts.h4Bold, Fonts.primary500]}>
          {title}
        </Text>
        {players.map((player) => renderParticipant(player, options))}
      </>
    );
  };

  const getSectionBadgeMeta = (section) => {
    if (section.isExternal) {
      return {
        text: t('eventDetails.invitedTeams.externalBadge', 'Ouvert à tous'),
        textStyle: [Fonts.p4, Fonts.primary100],
      };
    }
    if (section.isHome) {
      return {
        text: t('eventDetails.invitedTeams.homeTeamBadge', 'Équipe organisatrice'),
        textStyle: [Fonts.p4, Fonts.primary500],
      };
    }
    return {
      text: t('eventDetails.invitedTeams.invitedTeamBadge', 'Équipe invitée'),
      textStyle: [Fonts.p4, Fonts.primary100],
    };
  };

  const renderTeamSection = (section) => {
    const pending = section.pending || [];
    const historical = section.historical || {};
    const historicalPending = historical.pending || [];
    const historicalParticipating = historical.participating || [];
    const historicalMissing = historical.missing || [];
    const hasHistorical = historicalPending.length
      || historicalParticipating.length
      || historicalMissing.length;

    const sectionBadge = getSectionBadgeMeta(section);

    return (
      <View
        key={section.key}
        style={[
          Spaces.gap[12],
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          Spaces.padding[16],
        ]}
      >
        <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[8]]}>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {section.teamName}
          </Text>
          <Text style={sectionBadge.textStyle}>
            {sectionBadge.text}
          </Text>
        </View>

        {canApprovePendingRequests && pending.length > 0 ? (
          <View style={[Spaces.gap[12]]}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              {t('eventDetails.fields.participationRequests')}
            </Text>
            {pending.map(renderPendingCard)}
          </View>
        ) : null}

        {renderStatusGroup(
          t('eventDetails.participationStatus.participating'),
          section.participating,
          {
            allowLiveLate: true,
            keyPrefix: `${section.key}-present`,
            showCoachActions: section.allowCoachActions ?? canEdit,
            statusKind: 'participating',
          },
        )}

        {renderStatusGroup(
          t('eventDetails.participationStatus.missing'),
          section.missing,
          {
            allowLiveLate: false,
            keyPrefix: `${section.key}-missing`,
            statusKind: 'missing',
            statusLabel: t('eventDetails.participationStatus.missing'),
          },
        )}

        {section.notAnswered?.length ? (
          <>
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.spaceBetween, Spaces.gap[16]]}>
              <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                {t('eventDetails.participationStatus.notAnswered')}
              </Text>
              {canEdit ? (
                <Button isOption onPress={handleRemindPlayers} title={t('eventDetails.actions.remind')} variant="Primary" />
              ) : null}
            </View>
            {section.notAnswered.map((player) => renderParticipant(player, {
              allowLiveLate: false,
              keyPrefix: `${section.key}-not-answered`,
              statusKind: 'not_answered',
              statusLabel: t('eventDetails.participationStatus.notAnswered'),
            }))}
          </>
        ) : null}

        {hasHistorical ? (
          <View style={[Spaces.gap[8], Spaces.marginTop[8]]}>
            <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
              {section.isExternal
                ? t('eventDetails.invitedTeams.externalHistoricalTitle', 'Historique participants externes')
                : t('eventDetails.invitedTeams.historicalTitle', 'Historique équipe retirée')}
            </Text>
            {historicalPending.length > 0 ? (
              <Text style={[Fonts.p4, Fonts.neutral300]}>
                {t('eventDetails.invitedTeams.historicalPending', '{{count}} réponse(s) en attente').replace('{{count}}', String(historicalPending.length))}
              </Text>
            ) : null}
            {historicalParticipating.map((player) => renderParticipant(player, {
              allowLiveLate: false,
              keyPrefix: `${section.key}-hist-present`,
              showCoachActions: false,
              statusKind: 'participating',
              statusLabel: t('eventDetails.participationStatus.participating'),
            }))}
            {historicalMissing.map((player) => renderParticipant(player, {
              allowLiveLate: false,
              keyPrefix: `${section.key}-hist-missing`,
              showCoachActions: false,
              statusKind: 'missing',
              statusLabel: t('eventDetails.participationStatus.missing'),
            }))}
          </View>
        ) : null}
      </View>
    );
  };

  const sectionsToRender = [
    ...(teamParticipationSections || []),
    ...(externalParticipationSection ? [externalParticipationSection] : []),
  ];
  const hasTeamSections = sectionsToRender.length > 0;
  const participatingCount = Number(
    participantsSummary?.participatingCount ?? event?.participations?.length ?? 0,
  );
  const capacity = Number(participantsSummary?.capacity ?? event?.capacity ?? 0);
  const anonymizedPreviewCount = Math.min(participatingCount, 5);

  const renderParticipationsContent = () => {
    if (areParticipantIdentitiesHidden) {
      return (
        <View
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius24,
            Spaces.padding[16],
            Spaces.gap[16],
          ]}
        >
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            {participatingCount > 0
              ? `${participatingCount} participant${participatingCount > 1 ? 's' : ''}`
              : 'Aucun participant confirme pour le moment.'}
          </Text>

          {anonymizedPreviewCount > 0 ? (
            <View style={[Alignments.row, Spaces.gap[12]]}>
              {Array.from({ length: anonymizedPreviewCount }).map((_, index) => (
                <View
                  key={`participant-placeholder-${index + 1}`}
                  style={[
                    Alignments.alignCenter,
                    Alignments.justifyCenter,
                    {
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderColor: 'rgba(255,255,255,0.16)',
                      borderRadius: 999,
                      borderWidth: 1,
                      height: 40,
                      width: 40,
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, Fonts.neutral200]}>?</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {t(
              'eventDetails.participantsHiddenMessage',
              'Les identités des participants sont masquees par l organisateur.',
            )}
          </Text>
        </View>
      );
    }

    if (hasTeamSections) {
      return (
        <View style={[Spaces.gap[12]]}>
          {sectionsToRender.map(renderTeamSection)}
        </View>
      );
    }

    if (participationsByStatus) {
      return (
        <>
          {renderStatusGroup(
            t('eventDetails.participationStatus.participating'),
            participationsByStatus.participating || [],
            {
              allowLiveLate: true,
              keyPrefix: 'legacy-present',
              showCoachActions: canEdit,
              statusKind: 'participating',
            },
          )}
          {renderStatusGroup(
            t('eventDetails.participationStatus.missing'),
            participationsByStatus.missing || [],
            {
              allowLiveLate: false,
              keyPrefix: 'legacy-missing',
              statusKind: 'missing',
              statusLabel: t('eventDetails.participationStatus.missing'),
            },
          )}
          {(participationsByStatus.notAnswered || []).length > 0 && (
            <>
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.spaceBetween, Spaces.gap[16]]}>
                <Text style={[Fonts.h4Bold, Fonts.primary500]}>
                  {t('eventDetails.participationStatus.notAnswered')}
                </Text>
                {canEdit ? (
                  <Button isOption onPress={handleRemindPlayers} title={t('eventDetails.actions.remind')} variant="Primary" />
                ) : null}
              </View>
              {(participationsByStatus.notAnswered || []).map((player) => renderParticipant(player, {
                allowLiveLate: false,
                keyPrefix: 'legacy-not-answered',
                statusKind: 'not_answered',
                statusLabel: t('eventDetails.participationStatus.notAnswered'),
              }))}
            </>
          )}
        </>
      );
    }

    return (event?.participations || []).map((player) => renderParticipant(player, {
      allowLiveLate: true,
      keyPrefix: 'fallback',
      showCoachActions: canEdit,
      statusKind: 'participating',
    }));
  };

  return (
    <View style={[Spaces.gap[16], Alignments.fill]}>
      {!hasTeamSections && canApprovePendingRequests && pendingParticipations?.length > 0 && (
        <View style={[Spaces.gap[16], Alignments.fill]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('eventDetails.fields.participationRequests')}
          </Text>
          {pendingParticipations.map(renderPendingCard)}
        </View>
      )}

      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('eventDetails.fields.participations')}
          <Text>
            {` :  ${participatingCount} ${capacity ? ' / ' : ''} ${capacity || ''}`}
          </Text>
        </Text>
        <TouchableOpacity onPress={handleShare}>
          <Image resizeMode="contain" source={SHARE_ICON} style={{ height: 48, width: 48 }} />
        </TouchableOpacity>
      </View>

      {canEdit && (
        <TouchableOpacity onPress={handleExportParticipants} style={[{ alignSelf: 'flex-start' }, Spaces.marginTop[4]]}>
          <Text style={[Fonts.p2, Fonts.primary500, { textDecorationLine: 'underline' }]}>
            Exporter la liste (Excel/CSV)
          </Text>
        </TouchableOpacity>
      )}

      {renderParticipationsContent()}
    </View>
  );
}

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
 * statusKind?: 'participating' | 'missing' | 'not_answered',
 * styles: any
 * }} props
 */
function ParticipantItem({
  allowLiveLate = false,
  attendance,
  canEdit = false,
  eventStartAt,
  nowMs,
  onEditLate,
  onMarkArrival,
  onPress,
  player,
  statusKind = 'participating',
  styles,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = styles;
  const badge = resolveAttendanceBadge({
    allowLiveLate,
    attendance,
    colors: Colors,
    eventStartAt,
    nowMs,
    statusKind,
  });
  const hasStaffMeta = canEdit && (attendance?.note || attendance?.manualOverride || attendance?.updatedBy);
  const primaryCoachActionTitle = attendance?.arrivedAt ? 'Corriger' : 'Pointer l\'arrivée';

  return (
    <View
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.backgroundColor.primary700,
        Alignments.fill,
        Spaces.padding[16],
        Spaces.gap[12],
      ]}
    >
      <TouchableOpacity
        disabled={player?.isAnonymous === true}
        onPress={() => {
          if (player?.isAnonymous === true) return;
          onPress(player);
        }}
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          Spaces.gap[16],
        ]}
      >
        <View style={[Alignments.row, Spaces.gap[16], Alignments.alignCenter, { flex: 1 }]}>
          <ProfileAvatar
            imageStyle={{ borderRadius: 40 }}
            imageUrl={player?.avatar?.url}
            name={getUserDisplayName(player)}
            size={40}
            style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 40 }]}
          />
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>
            {getUserDisplayName(player)}
          </Text>
        </View>
        <View
          style={[
            ApplicationStyle.borderRadius16,
            Alignments.alignCenter,
            {
              backgroundColor: badge.backgroundColor,
              borderColor: badge.borderColor,
              borderWidth: 1,
              minWidth: badge.value ? 132 : 96,
              paddingHorizontal: badge.value ? 14 : 12,
              paddingVertical: badge.value ? 8 : 6,
            },
          ]}
        >
          <Text style={[Fonts.p4, { color: badge.textColor, textAlign: 'center' }]}>
            {badge.title}
          </Text>
          {badge.value ? (
            <Text style={[Fonts.p4Bold, { color: badge.textColor, marginTop: 2, textAlign: 'center' }]}>
              {badge.value}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {canEdit && (
        <View style={[Alignments.row, Spaces.gap[8], Alignments.justifyEnd]}>
          <Button
            onPress={() => onMarkArrival && onMarkArrival(player)}
            size="sm"
            title={primaryCoachActionTitle}
            variant="Primary"
          />
          <Button
            onPress={() => onEditLate && onEditLate(player)}
            size="sm"
            title="Modifier"
            variant="SecondaryLight"
          />
        </View>
      )}

      {hasStaffMeta ? (
        <View style={[Spaces.gap[4]]}>
          {attendance?.manualOverride ? (
            <Text style={[Fonts.p4, Fonts.warning500]}>
              Correction manuelle staff
            </Text>
          ) : null}
          {attendance?.updatedBy ? (
            <Text style={[Fonts.p4, Fonts.neutral300]}>
              Corrige par
              {' '}
              {getStaffDisplayName(attendance.updatedBy)}
            </Text>
          ) : null}
          {attendance?.note ? (
            <Text style={[Fonts.p4, Fonts.neutral200]}>
              {attendance.note}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default EventParticipants;
