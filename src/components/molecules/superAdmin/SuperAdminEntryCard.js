import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

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
    Spaces,
  } = useTheme();

  return (
    <View
      style={[
        ApplicationStyle.card,
        ApplicationStyle.borderRadius16,
        Spaces.padding[14],
        Spaces.marginBottom[10],
        {
          backgroundColor: Colors.neutral800,
          borderColor: isSelected ? Colors.primary500 : Colors.primary700,
          borderWidth: 1,
        },
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
        {isSelectionMode ? (
          <TouchableOpacity
            accessibilityLabel={viewModel?.title || String(entry?.documentId || '')}
            onPress={onToggleSelect}
            style={[
              ApplicationStyle.borderRadius12,
              {
                alignItems: 'center',
                backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                borderColor: isSelected ? Colors.primary500 : Colors.neutral500,
                borderWidth: 1,
                height: 24,
                justifyContent: 'center',
                width: 24,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{isSelected ? 'X' : ''}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity onPress={onPress} style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[Fonts.h4, Fonts.neutral00]}>
            {viewModel?.title}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300, Spaces.marginTop[2]]}>
            {viewModel?.shortDocumentId || viewModel?.documentId}
          </Text>
        </TouchableOpacity>

        {!isSelectionMode && onOpenActions ? (
          <TouchableOpacity
            accessibilityLabel={labels.openActions}
            onPress={onOpenActions}
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingHorizontal[10],
              Spaces.paddingVertical[6],
              {
                backgroundColor: Colors.neutral700,
                borderColor: Colors.neutral600,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.h4, Fonts.neutral100]}>...</Text>
          </TouchableOpacity>
        ) : (
          <Image
            source={rightIcon}
            style={{
              height: 14,
              tintColor: isSelectionMode ? Colors.neutral600 : Colors.neutral300,
              width: 14,
            }}
          />
        )}
      </View>

      {Array.isArray(viewModel?.fields) && viewModel.fields.length > 0 ? (
        <View style={[Spaces.marginTop[8], Spaces.gap[4]]}>
          {viewModel.fields.slice(0, 2).map((field) => (
            <View key={field.key} style={[Alignments.row, { justifyContent: 'space-between' }]}>
              <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, flex: 1 }]}>{field.label}</Text>
              <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral100, flex: 1, textAlign: 'right' }]}>
                {field.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.marginTop[8], Spaces.gap[8]]}>
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
        <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.primary200, maxWidth: '44%' }]}>
          {labels.updatedPrefix}
          {' '}
          {viewModel?.updatedAt || '-'}
        </Text>
      </View>
    </View>
  );
}

export default SuperAdminEntryCard;
