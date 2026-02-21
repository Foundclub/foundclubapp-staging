import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import Button from '@/components/atoms/button/Button';
import useTheme from '@/theme/themeContext';

const getTypeLabel = (type, t) => {
  switch (type) {
    case 'team':
      return t('requestsHub.types.team', 'Equipe');
    case 'club':
      return t('requestsHub.types.club', 'Club');
    case 'event':
      return t('requestsHub.types.event', 'Evenement');
    case 'featured':
      return t('requestsHub.types.featured', 'A la une');
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
 *  onSecondaryPress?: (item: import('@/domains/requests/requestMappers').RequestHubItem) => void;
 * }} props
 */
function RequestFeedItem({
  item,
  isBusy = false,
  onPrimaryPress,
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
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8]]}>
        <Text style={[Fonts.h4Bold, Fonts.neutral00, { flex: 1 }]} numberOfLines={2}>
          {item?.title}
        </Text>
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
      </View>

      <Text style={[Fonts.p2, Fonts.neutral100]} numberOfLines={3}>
        {item?.subtitle}
      </Text>

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

