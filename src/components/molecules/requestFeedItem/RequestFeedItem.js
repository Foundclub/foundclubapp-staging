import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

/**
 * @param {string | number | Date | null | undefined} startValue
 * @param {string | number | Date | null | undefined} endValue
 */
const formatWindowLabel = (startValue, endValue) => {
  const startDate = startValue ? new Date(startValue) : null;
  const endDate = endValue ? new Date(endValue) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return '';

  const dateLabel = startDate.toLocaleDateString(localeDesFormats(), {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });

  const startTimeLabel = startDate.toLocaleTimeString(localeDesFormats(), {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTimeLabel = endDate && !Number.isNaN(endDate.getTime())
    ? endDate.toLocaleTimeString(localeDesFormats(), {
      hour: '2-digit',
      minute: '2-digit',
    })
    : '';

  if (endTimeLabel) {
    return `${dateLabel} - ${startTimeLabel} à ${endTimeLabel}`;
  }

  return `${dateLabel} - ${startTimeLabel}`;
};

/**
 * @param {string | undefined} type
 * @param {(key: string, fallback?: string) => string} t
 */
const getTypeLabel = (type, t) => {
  switch (type) {
    case 'club':
      return t('requestsHub.types.club', 'Club');
    case 'event':
      return t('requestsHub.types.event', 'Événement');
    case 'featured':
      return t('requestsHub.types.featured', 'À la une');
    case 'installation':
      return t('requestsHub.types.installation', 'Installation');
    case 'interest':
      return t('requestsHub.types.interest', 'Interet');
    case 'team':
      return t('requestsHub.types.team', 'Équipe');
    case 'teamInvite':
      return t('requestsHub.types.teamInvite', 'Invitation');
    default:
      return t('requestsHub.types.unknown', 'Demande');
  }
};

/**
 * @param {string | undefined} action
 * @param {Record<string, any>} item
 * @param {(key: string, fallback?: string) => string} t
 */
const getActionLabel = (action, item, t) => {
  switch (action) {
    case 'accept':
      if (item?.type === 'installation') {
        return t('requestsHub.actions.approveOverflow', 'Autoriser');
      }
      return t('common.accept', 'Accepter');
    case 'chat':
      return t('requestsHub.actions.openChat', 'Ouvrir une conversation');
    // D92 — la proposition de match se traite sur l ecran de l annonce, la ou
    // les modalites se lisent. Sans ce libelle, le bouton s appellerait « OK ».
    case 'open':
      return t('requestsHub.actions.open', 'Voir la proposition');
    case 'reject':
      return t('common.reject', 'Refuser');
    case 'respond':
      return t('requestsHub.actions.respond', 'Repondre');
    case 'validate':
      return t('common.validate', 'Valider');
    default:
      return t('common.actions.ok', 'OK');
  }
};

/**
 * @param {{
 *  item: import('@/domains/requests/requestMappers').RequestHubItem;
 *  isBusy?: boolean;
 *  onEventPress?: (item: import('@/domains/requests/requestMappers').RequestHubItem) => void;
 *  onPrimaryPress?: (item: import('@/domains/requests/requestMappers').RequestHubItem) => void;
 *  onRequesterPress?: (item: import('@/domains/requests/requestMappers').RequestHubItem) => void;
 *  onSecondaryPress?: (item: import('@/domains/requests/requestMappers').RequestHubItem) => void;
 * }} props
 */
function RequestFeedItem({
  isBusy = false,
  item,
  onEventPress,
  onPrimaryPress,
  onRequesterPress,
  onSecondaryPress,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const requesterAvatarUrl = item?.meta?.requesterAvatarUrl || '';
  const requesterId = item?.meta?.requesterId || '';
  const requesterName = item?.meta?.requesterName || t('common.user', 'Utilisateur');
  const featuredScopeLabel = item?.meta?.scopeLabel || '';
  const interestTeamName = item?.meta?.teamName || '';
  const sourceTeamName = item?.meta?.sourceTeamName || '';
  const isInstallationRequest = item?.type === 'installation';
  const isInterestRequest = item?.type === 'interest';
  // 👪 PAR-L2L3 · L3 (PAR-007) — une place demandee pour un ENFANT : la carte
  // montre l'enfant (son initiale, jamais une photo) et nomme le parent en
  // second. Meme critere que l'ecran pour Accepter / Refuser (`meta.childId`).
  const isChildPlaceRequest = isInterestRequest && Boolean(item?.meta?.childId);
  // 📚 PAR-L2L3 · L2 (PAR-008) — la carte d'interet d'un ADULTE empile ses deux
  // boutons en pleine largeur : cote a cote, chaque libelle n'avait qu'environ
  // 84 points et le retrecissement automatique d'iOS le faisait tomber a ~4
  // points.
  // 👪 PAR-L9a (13/10, E15) — et dans CET ordre : le geste principal d'abord
  // (« Ouvrir une conversation »), « Repondre » ensuite, le profil en lien dessous.
  const stackActions = isInterestRequest && !isChildPlaceRequest;
  const isMembershipRequest = item?.type === 'team' || item?.type === 'club';
  const isTeamInvitation = item?.type === 'teamInvite';
  // S10-C / D1 — la date de l evenement, avec LE formateur deja present dans ce
  // fichier plutot qu un second dans le mappeur.
  const invitationDateLabel = isTeamInvitation
    ? formatWindowLabel(item?.meta?.eventDate, null)
    : '';
  const isEventParticipationRequest = item?.type === 'event'
    && Boolean(requesterId || requesterName || requesterAvatarUrl);
  const canOpenEvent = Boolean(item?.meta?.eventId && onEventPress);
  const canOpenRequesterProfile = Boolean(requesterId && onRequesterPress);
  const hasPrimaryAction = Boolean(item?.actions?.primary);
  const hasSecondaryAction = Boolean(item?.actions?.secondary);
  const hasActions = hasPrimaryAction || hasSecondaryAction;
  const actionSlotStyle = stackActions ? null : { flex: 1 };
  const requesterProfileLabel = isChildPlaceRequest
    ? t('requestsHub.childInterest.viewParent', 'Profil du parent')
    : t('requestsHub.actions.viewProfile', 'Voir le profil');
  const installationWindowLabel = formatWindowLabel(
    item?.meta?.windowStart,
    item?.meta?.windowEnd,
  );
  // FINITIONS4 (recette du 29/09) — le mot anglais sans accent devient « places
  // occupées », accordé par `count` (zéro et un au singulier).
  const occupancyRatioLabel = t(
    'requestFeedItem.occupancy',
    '{{occupied}}/{{max}} places occupées',
    {
      count: Number(item?.meta?.overlapCount || 0),
      max: Number(item?.meta?.maxSlots || 1),
      occupied: Number(item?.meta?.overlapCount || 0),
    },
  );
  /**
   * @param {import('react').ReactNode} children
   */
  const renderRequesterWrapper = (children) => {
    const wrapperStyle = [Alignments.row, Alignments.alignCenter, Spaces.gap[12]];

    if (canOpenRequesterProfile) {
      return (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={() => onRequesterPress && onRequesterPress(item)}
          style={wrapperStyle}
        >
          {children}
        </TouchableOpacity>
      );
    }

    return (
      <View style={wrapperStyle}>
        {children}
      </View>
    );
  };

  let bodyContent = (
    <Text numberOfLines={3} style={[Fonts.p2, Fonts.neutral100]}>
      {item?.subtitle}
    </Text>
  );

  if (isChildPlaceRequest) {
    // Pas de lien vers le profil ici : l'initiale est celle de l'enfant, le
    // parent s'ouvre par son bouton nomme, « Profil du parent ».
    bodyContent = (
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
        <ProfileAvatar
          enablePreview={false}
          imageUrl=""
          name={item?.meta?.childFirstname || ''}
          size={40}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={3} style={[Fonts.p2, Fonts.neutral100]}>
            {item?.subtitle}
          </Text>
          <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral300, { marginTop: 4 }]}>
            {t('requestsHub.childInterest.parent', 'Parent : {{name}}', {
              name: requesterName,
              ...SANS_ECHAPPEMENT,
            })}
          </Text>
        </View>
      </View>
    );
  } else if (isMembershipRequest || isInterestRequest) {
    bodyContent = renderRequesterWrapper(
      <>
        <ProfileAvatar
          enablePreview={false}
          imageUrl={requesterAvatarUrl}
          name={requesterName}
          size={40}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={3} style={[Fonts.p2, Fonts.neutral100]}>
            {item?.subtitle}
          </Text>
          {isInterestRequest && interestTeamName ? (
            <Text numberOfLines={2} style={[Fonts.p3, Fonts.primary200, { marginTop: 4 }]}>
              {t('requestsHub.interest.targetTeam', 'Équipe visée : {{team}}', {
                team: interestTeamName,
                ...SANS_ECHAPPEMENT,
              })}
            </Text>
          ) : null}
        </View>
      </>,
    );
  } else if (isEventParticipationRequest) {
    bodyContent = (
      <View style={[{ gap: 10 }]}>
        {renderRequesterWrapper(
          <>
            <ProfileAvatar
              enablePreview={false}
              imageUrl={requesterAvatarUrl}
              name={requesterName}
              size={40}
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>
                {requesterName}
              </Text>
              {sourceTeamName ? (
                <MarqueeText
                  style={[Fonts.p3, Fonts.neutral200]}
                  text={sourceTeamName}
                />
              ) : null}
            </View>
          </>,
        )}
        <Text numberOfLines={3} style={[Fonts.p2, Fonts.neutral100]}>
          {item?.subtitle}
        </Text>
      </View>
    );
  } else if (isTeamInvitation) {
    bodyContent = (
      <View style={[Spaces.gap[4]]}>
        <Text numberOfLines={3} style={[Fonts.p2, Fonts.neutral100]}>
          {item?.subtitle}
        </Text>
        {invitationDateLabel ? (
          <Text numberOfLines={1} style={[Fonts.p3, Fonts.primary200]}>
            {invitationDateLabel}
          </Text>
        ) : null}
      </View>
    );
  } else if (isInstallationRequest) {
    bodyContent = (
      <View style={[Spaces.gap[12]]}>
        <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
          {[item?.meta?.facilityName, item?.meta?.teamName, installationWindowLabel]
            .filter(Boolean)
            .map((label) => (
              <View
                key={label}
                style={[
                  ApplicationStyle.borderRadius100,
                  ApplicationStyle.borderWidth1,
                  { paddingHorizontal: 10 },
                  { paddingVertical: 6 },
                  {
                    backgroundColor: 'rgba(1, 179, 244, 0.08)',
                    borderColor: `${Colors.primary500}44`,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                  {label}
                </Text>
              </View>
            ))}
        </View>

        <View
          style={[
            ApplicationStyle.borderRadius16,
            ApplicationStyle.borderWidth1,
            Spaces.padding[12],
            { gap: 6 },
            {
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              borderColor: `${Colors.warning500}66`,
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, Fonts.warning500]}>
            {occupancyRatioLabel}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral100]}>
            {t(
              'requestsHub.installation.summary',
              "Une équipe supplémentaire demande ce créneau sur l'installation.",
            )}
          </Text>
        </View>

        {item?.meta?.eventName ? (
          <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral200]}>
            {t('requestsHub.installation.eventLabel', 'Événement')}
            :
            {' '}
            {item.meta.eventName}
          </Text>
        ) : null}
      </View>
    );
  }

  const profileButton = canOpenRequesterProfile ? (
    <View>
      <Button
        accessibilityHint={isChildPlaceRequest
          ? t('requestsHub.childInterest.viewParentHint', 'Ouvre le profil du parent')
          : t('requestsHub.actions.viewProfileHint', 'Ouvre le profil du demandeur')}
        accessibilityLabel={requesterProfileLabel}
        disabled={isBusy}
        onPress={() => onRequesterPress && onRequesterPress(item)}
        title={requesterProfileLabel}
        variant={stackActions ? 'Ghost' : 'Secondary'}
      />
    </View>
  ) : null;

  const secondaryButton = hasSecondaryAction ? (
    <View style={actionSlotStyle}>
      <Button
        disabled={isBusy}
        icon={['chat', 'respond'].includes(item?.actions?.secondary || '') ? undefined : 'close'}
        isOption={!stackActions}
        onPress={() => onSecondaryPress && onSecondaryPress(item)}
        title={getActionLabel(item?.actions?.secondary, item, t)}
        variant="Secondary"
      />
    </View>
  ) : null;

  const primaryButton = hasPrimaryAction ? (
    <View style={actionSlotStyle}>
      <Button
        disabled={isBusy}
        icon={item?.actions?.primary === 'chat' ? 'envelope' : 'check'}
        isOption={!stackActions}
        onPress={() => onPrimaryPress && onPrimaryPress(item)}
        title={getActionLabel(item?.actions?.primary, item, t)}
        variant="Primary"
      />
    </View>
  ) : null;

  const cardSurfaceStyle = isInstallationRequest
    ? {
      backgroundColor: 'rgba(10, 37, 49, 0.96)',
      borderColor: `${Colors.warning500}55`,
    }
    : {
      backgroundColor: ApplicationStyle.backgroundColor.primary700.backgroundColor,
      borderColor: `${Colors.primary500}55`,
    };

  return (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[12],
        cardSurfaceStyle,
      ]}
    >
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          Spaces.gap[8],
        ]}
      >
        <Text numberOfLines={2} style={[Fonts.h4Bold, Fonts.neutral00, { flex: 1 }]}>
          {item?.title}
        </Text>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <View
            style={[
              ApplicationStyle.borderRadius12,
              ApplicationStyle.borderWidth1,
              Spaces.paddingHorizontal[8],
              Spaces.paddingVertical[4],
              isInstallationRequest
                ? {
                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                  borderColor: `${Colors.warning500}66`,
                }
                : {
                  backgroundColor: ApplicationStyle.backgroundColor.primary900.backgroundColor,
                  borderColor: `${Colors.primary500}66`,
                },
            ]}
          >
            <Text style={[Fonts.p4Bold, isInstallationRequest ? Fonts.warning500 : Fonts.primary500]}>
              {isChildPlaceRequest
                ? t('requestsHub.types.childPlace', 'Place enfant')
                : getTypeLabel(item?.type, t)}
            </Text>
          </View>
          {featuredScopeLabel ? (
            <View
              style={[
                ApplicationStyle.borderRadius12,
                ApplicationStyle.borderWidth1,
                Spaces.paddingHorizontal[8],
                Spaces.paddingVertical[4],
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.12)',
                  borderColor: `${Colors.primary500}55`,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, Fonts.neutral00]}>
                {featuredScopeLabel}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {bodyContent}

      {stackActions ? null : profileButton}

      {canOpenEvent ? (
        <View>
          <Button
            disabled={isBusy}
            onPress={() => onEventPress && onEventPress(item)}
            size="small"
            title={isTeamInvitation
              ? t('requestsHub.invitations.respond', "Répondre à l'invitation")
              : t('requestsHub.actions.viewEvent', "Voir l'événement")}
            variant="Secondary"
          />
        </View>
      ) : null}

      {hasActions ? (
        <View style={stackActions ? [Spaces.gap[12]] : [Alignments.row, Spaces.gap[12]]}>
          {stackActions ? primaryButton : secondaryButton}
          {stackActions ? secondaryButton : primaryButton}
        </View>
      ) : null}

      {stackActions ? profileButton : null}
    </View>
  );
}

export default RequestFeedItem;
