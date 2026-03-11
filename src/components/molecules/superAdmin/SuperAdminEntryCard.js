import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import superAdminLayout from '@/components/molecules/superAdmin/superAdminLayout';

const rightIcon = require('@/assets/icons/arrowRight.png');

const getBadgeColors = (tone, colors) => {
  if (tone === 'success') {
    return { backgroundColor: colors.success100, textColor: colors.success700 };
  }
  if (tone === 'warning') {
    return { backgroundColor: colors.warning100, textColor: colors.warning900 };
  }
  if (tone === 'danger') {
    return { backgroundColor: colors.error100, textColor: colors.error700 };
  }
  return { backgroundColor: colors.neutral700, textColor: colors.neutral100 };
};

/**
 * @param {{
 *  entry: any;
 *  viewModel: {
 *    title: string;
 *    shortDocumentId: string;
 *    documentId: string;
 *    fields: Array<{ key: string; label: string; value: string }>;
 *    badges: Array<{ key: string; label: string; tone: string }>;
 *    updatedAt: string;
 *  };
 *  isSelected: boolean;
 *  isSelectionMode: boolean;
 *  onPress: () => void;
 *  onToggleSelect?: () => void;
 *  onOpenActions?: () => void;
 *  labels: {
 *    updatedPrefix: string;
 *    openActions: string;
 *  };
 * }} props
 * @returns {import('react').ReactElement}
 */
function SuperAdminEntryCard({
  entry,
  isSelected,
  isSelectionMode,
  labels,
  onOpenActions,
  onPress,
  onToggleSelect,
  viewModel,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const shouldShowActions = !isSelectionMode && Boolean(onOpenActions);
  const shouldShowArrow = !isSelectionMode && !onOpenActions;

  return (
    <View
      style={[
        ApplicationStyle.card,
        ApplicationStyle.borderRadius16,
        Spaces.padding[superAdminLayout.cardPadding],
        Spaces.marginBottom[12],
        {
          backgroundColor: Colors.primary700,
          borderColor: isSelected ? Colors.primary500 : Colors.primary700,
          borderWidth: 1,
        },
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10]]}>
        {isSelectionMode ? (
          <TouchableOpacity
            accessibilityLabel={viewModel?.title || String(entry?.documentId || '')}
            onPress={onToggleSelect}
            style={[
              {
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
                minWidth: 44,
              },
            ]}
          >
            <View
              style={[
                Alignments.center,
                {
                  backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                  borderColor: isSelected ? Colors.primary500 : Colors.neutral500,
                  borderRadius: 13,
                  borderWidth: 1,
                  height: 26,
                  width: 26,
                },
              ]}
            >
              {isSelected ? (
                <Image
                  source={Images.check}
                  style={{ height: 13, tintColor: Colors.neutral00, width: 13 }}
                />
              ) : null}
            </View>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={onPress} style={{ flex: 1, minHeight: 44 }}>
          <Text numberOfLines={1} style={[Fonts.h4Bold, Fonts.neutral00]}>
            {viewModel?.title}
          </Text>
        </TouchableOpacity>

        {shouldShowActions ? (
          <TouchableOpacity
            accessibilityLabel={labels.openActions}
            onPress={onOpenActions}
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingHorizontal[10],
              Spaces.paddingVertical[8],
              {
                backgroundColor: Colors.primary700,
                borderColor: Colors.primary500,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>...</Text>
          </TouchableOpacity>
        ) : null}
        {shouldShowArrow ? (
          <Image
            source={rightIcon}
            style={{
              height: 14,
              tintColor: Colors.neutral300,
              width: 14,
            }}
          />
        ) : null}
      </View>

      {Array.isArray(viewModel?.fields) && viewModel.fields.length > 0 ? (
        <View style={[Spaces.marginTop[12], Spaces.gap[8]]}>
          {viewModel.fields.slice(0, 2).map((field) => (
            <View key={field.key} style={[Alignments.row, Alignments.alignCenter, { justifyContent: 'space-between' }]}>
              <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>
                {field.label}
              </Text>
              <Text numberOfLines={1} style={[Fonts.p3Bold, { color: Colors.neutral100, flex: 1, textAlign: 'right' }]}>
                {field.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.marginTop[12], Spaces.gap[8]]}>
        <View style={[Alignments.row, { flexWrap: 'wrap' }, Spaces.gap[8], { flex: 1 }]}>
          {(viewModel?.badges || []).map((badge) => {
            const colors = getBadgeColors(badge.tone, Colors);
            return (
              <View
                key={badge.key}
                style={[
                  ApplicationStyle.borderRadius12,
                  Spaces.paddingHorizontal[8],
                  Spaces.paddingVertical[4],
                  { backgroundColor: colors.backgroundColor },
                ]}
              >
                <Text numberOfLines={1} style={[Fonts.p3, { color: colors.textColor }]}>
                  {badge.label}
                </Text>
              </View>
            );
          })}
        </View>
        <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral200, maxWidth: '46%' }]}>
          {labels.updatedPrefix}
          {' '}
          {viewModel?.updatedAt || '-'}
        </Text>
      </View>
    </View>
  );
}

export default SuperAdminEntryCard;
