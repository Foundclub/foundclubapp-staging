import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

/**
 * @param {string | number | Date | null | undefined} startValue
 * @param {string | number | Date | null | undefined} endValue
 */
const formatWindowLabel = (startValue, endValue) => {
  const startDate = startValue ? new Date(startValue) : null;
  const endDate = endValue ? new Date(endValue) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) return '';

  const dateLabel = startDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    weekday: 'short',
  });

  const startTimeLabel = startDate.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTimeLabel = endDate && !Number.isNaN(endDate.getTime())
    ? endDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    : '';

  if (endTimeLabel) {
    return `${dateLabel} - ${startTimeLabel} a ${endTimeLabel}`;
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
      return t('requestsHub.actions.openChat', 'Ouvrir chat');
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
  const isMembershipRequest = item?.type === 'team' || item?.type === 'club';
  const isEventParticipationRequest = item?.type === 'event'
    && Boolean(requesterId || requesterName || requesterAvatarUrl);
  const canOpenEvent = Boolean(item?.meta?.eventId && onEventPress);
  const canOpenRequesterProfile = Boolean(requesterId && onRequesterPress);
  const hasPrimaryAction = Boolean(item?.actions?.primary);
  const hasSecondaryAction = Boolean(item?.actions?.secondary);
  const hasActions = hasPrimaryAction || hasSecondaryAction;
  const installationWindowLabel = formatWindowLabel(
    item?.meta?.windowStart,
    item?.meta?.windowEnd,
  );
  const occupancyRatioLabel = `${Number(item?.meta?.overlapCount || 0)}/${Number(item?.meta?.maxSlots || 1)} slots occupes`;
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

  if (isMembershipRequest || isInterestRequest) {
    bodyContent = renderRequesterWrapper(
      <>
        <ProfileAvatar
          enablePreview={false}
          imageUrl={requesterAvatarUrl}
          size={40}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={3} style={[Fonts.p2, Fonts.neutral100]}>
            {item?.subtitle}
          </Text>
          {isInterestRequest && interestTeamName ? (
            <Text numberOfLines={1} style={[Fonts.p3, Fonts.primary200, { marginTop: 4 }]}>
              {t('requestsHub.interest.targetTeam', 'Équipe visee')}
              :
              {' '}
              {interestTeamName}
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
              size={40}
            />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>
                {requesterName}
              </Text>
              {sourceTeamName ? (
                <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral200]}>
                  {sourceTeamName}
                </Text>
              ) : null}
            </View>
          </>,
        )}
        <Text numberOfLines={3} style={[Fonts.p2, Fonts.neutral100]}>
          {item?.subtitle}
        </Text>
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
            {t('requestsHub.installation.eventLabel', 'Evenement')}
            :
            {' '}
            {item.meta.eventName}
          </Text>
        ) : null}
      </View>
    );
  }

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
              {getTypeLabel(item?.type, t)}
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

      {canOpenRequesterProfile ? (
        <View>
          <Button
            accessibilityHint={t(
              'requestsHub.actions.viewProfileHint',
              'Ouvre le profil du demandeur',
            )}
            accessibilityLabel={t(
              'requestsHub.actions.viewProfile',
              'Voir le profil',
            )}
            disabled={isBusy}
            onPress={() => onRequesterPress && onRequesterPress(item)}
            title={t('requestsHub.actions.viewProfile', 'Voir le profil')}
            variant="Secondary"
          />
        </View>
      ) : null}

      {canOpenEvent ? (
        <View>
          <Button
            disabled={isBusy}
            onPress={() => onEventPress && onEventPress(item)}
            size="small"
            title={t('requestsHub.actions.viewEvent', "Voir l'événement")}
            variant="Secondary"
          />
        </View>
      ) : null}

      {hasActions ? (
        <View style={[Alignments.row, Spaces.gap[12]]}>
          {hasSecondaryAction ? (
            <View style={{ flex: 1 }}>
              <Button
                disabled={isBusy}
                icon={item?.actions?.secondary === 'chat' ? undefined : 'close'}
                isOption
                onPress={() => onSecondaryPress && onSecondaryPress(item)}
                title={getActionLabel(item?.actions?.secondary, item, t)}
                variant="Secondary"
              />
            </View>
          ) : null}
          {hasPrimaryAction ? (
            <View style={{ flex: 1 }}>
              <Button
                disabled={isBusy}
                icon={item?.actions?.primary === 'validate' ? 'check' : 'check'}
                isOption
                onPress={() => onPrimaryPress && onPrimaryPress(item)}
                title={getActionLabel(item?.actions?.primary, item, t)}
                variant="Primary"
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default RequestFeedItem;
