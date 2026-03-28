import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

const getTypeLabel = (type, t) => {
  switch (type) {
    case 'club':
      return t('requestsHub.types.club', 'Club');
    case 'event':
      return t('requestsHub.types.event', 'Événement');
    case 'featured':
      return t('requestsHub.types.featured', 'À la une');
    case 'team':
      return t('requestsHub.types.team', 'Équipe');
    default:
      return t('requestsHub.types.unknown', 'Demande');
  }
};

const getActionLabel = (action, t) => {
  switch (action) {
    case 'accept':
      return t('common.accept', 'Accepter');
    case 'reject':
      return t('common.reject', 'Refuser');
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
 *  onPrimaryPress?: (item: import('@/domains/requests/requestMappers').RequestHubItem) => void;
 *  onRequesterPress?: (item: import('@/domains/requests/requestMappers').RequestHubItem) => void;
 *  onSecondaryPress?: (item: import('@/domains/requests/requestMappers').RequestHubItem) => void;
 * }} props
 */
function RequestFeedItem({
  isBusy = false,
  item,
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
  const sourceTeamName = item?.meta?.sourceTeamName || '';
  const isMembershipRequest = item?.type === 'team' || item?.type === 'club';
  const isEventParticipationRequest = item?.type === 'event'
    && Boolean(requesterId || requesterName || requesterAvatarUrl);
  const canOpenRequesterProfile = Boolean(requesterId && onRequesterPress);
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

  if (isMembershipRequest) {
    bodyContent = renderRequesterWrapper(
      <>
        <ProfileAvatar
          enablePreview={false}
          imageUrl={requesterAvatarUrl}
          size={40}
        />
        <Text numberOfLines={3} style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
          {item?.subtitle}
        </Text>
      </>,
    );
  } else if (isEventParticipationRequest) {
    bodyContent = (
      <View style={[Spaces.gap[10]]}>
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
  }

  return (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[12],
        {
          borderColor: `${Colors.primary500}55`,
        },
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
              ApplicationStyle.backgroundColor.primary900,
              ApplicationStyle.borderWidth1,
              Spaces.paddingHorizontal[8],
              Spaces.paddingVertical[4],
              {
                borderColor: `${Colors.primary500}66`,
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, Fonts.primary500]}>
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

      <View style={[Alignments.row, Spaces.gap[12]]}>
        {item?.actions?.secondary ? (
          <View style={{ flex: 1 }}>
            <Button
              disabled={isBusy}
              icon="close"
              isOption
              onPress={() => onSecondaryPress && onSecondaryPress(item)}
              title={getActionLabel(item?.actions?.secondary, t)}
              variant="Secondary"
            />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Button
            disabled={isBusy}
            icon={item?.actions?.primary === 'validate' ? 'check' : 'check'}
            isOption
            onPress={() => onPrimaryPress && onPrimaryPress(item)}
            title={getActionLabel(item?.actions?.primary, t)}
            variant="Primary"
          />
        </View>
      </View>
    </View>
  );
}

export default RequestFeedItem;
