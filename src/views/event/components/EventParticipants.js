import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

const SHARE_ICON = require('@/assets/icons/share2.png');

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
 * @typedef {{ arrivedAt?: string | null, lateMinutes?: number | null, source?: string | null, manualOverride?: boolean }} AttendanceState
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
        showLateBadge={options.showLateBadge !== false}
        statusLabel={options.statusLabel}
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
          size={40}
          style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 40 }]}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { flexShrink: 1 }]}>
            {`${participation.user.firstname || ''} ${participation.user.lastname || ''}`.trim()}
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
        text: t('eventDetails.invitedTeams.externalBadge', 'Ouvert a tous'),
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
      text: t('eventDetails.invitedTeams.invitedTeamBadge', 'Équipe invitee'),
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
          },
        )}

        {renderStatusGroup(
          t('eventDetails.participationStatus.missing'),
          section.missing,
          {
            allowLiveLate: false,
            keyPrefix: `${section.key}-missing`,
            showLateBadge: false,
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
              showLateBadge: false,
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
              showLateBadge: false,
              statusLabel: t('eventDetails.participationStatus.participating'),
            }))}
            {historicalMissing.map((player) => renderParticipant(player, {
              allowLiveLate: false,
              keyPrefix: `${section.key}-hist-missing`,
              showCoachActions: false,
              showLateBadge: false,
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

  const renderParticipationsContent = () => {
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
            },
          )}
          {renderStatusGroup(
            t('eventDetails.participationStatus.missing'),
            participationsByStatus.missing || [],
            {
              allowLiveLate: false,
              keyPrefix: 'legacy-missing',
              showLateBadge: false,
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
                showLateBadge: false,
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
 * showLateBadge?: boolean,
 * statusLabel?: string,
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
  showLateBadge = true,
  statusLabel,
  styles,
}) {
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
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
  const badgeLabel = showLateBadge ? 'Retard' : (statusLabel || 'Statut');
  let badgeBackgroundColor = '#33415566';
  let badgeTextColor = '#cbd5e1';
  if (showLateBadge) {
    badgeBackgroundColor = lateMinutes > 0 ? '#F59E0B22' : '#16A34A22';
    badgeTextColor = lateMinutes > 0 ? '#fbbf24' : '#4ade80';
  }

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
            imageStyle={{ borderRadius: 40 }}
            imageUrl={player?.avatar?.url}
            size={40}
            style={[ApplicationStyle.borderWidth1, ApplicationStyle.borderColor.neutral00, { borderRadius: 40 }]}
          />
          <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00, { flex: 1 }]}>
            {`${player.firstname || ''} ${player.lastname || ''}`.trim()}
          </Text>
        </View>
        <View
          style={[
            Spaces.paddingHorizontal[10],
            Spaces.paddingVertical[4],
            ApplicationStyle.borderRadius12,
            Alignments.alignCenter,
            { backgroundColor: badgeBackgroundColor },
          ]}
        >
          <Text style={[Fonts.p4, { color: badgeTextColor }]}>
            {badgeLabel}
          </Text>
          {showLateBadge ? (
            <Text style={[Fonts.p4Bold, { color: badgeTextColor }]}>
              {lateLabel}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      {canEdit && (
        <View style={[Alignments.row, Spaces.gap[8], Alignments.justifyEnd]}>
          <Button
            onPress={() => onMarkArrival && onMarkArrival(player)}
            size="sm"
            title="Arrive"
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
}

export default EventParticipants;
