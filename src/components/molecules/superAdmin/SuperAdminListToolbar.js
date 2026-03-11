import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

const closeIcon = require('@/assets/icons/close.png');
const searchIcon = require('@/assets/icons/search.png');

/**
 * @typedef {{
 *  isSelectionMode: boolean;
 *  selectedCount: number;
 *  areAllPageEntriesSelected: boolean;
 *  onToggleMode: () => void;
 *  onToggleSelectAll: () => void;
 * }} SelectionState
 */

/**
 * @param {{
 *  query: string;
 *  onQueryChange: (value: string) => void;
 *  onClearQuery: () => void;
 *  sortMode: string;
 *  sortOptions: Array<{ key: string; label: string }>;
 *  onSortChange: (nextSortMode: string) => void;
 *  onCreateEntry: () => void;
 *  selectionState: SelectionState;
 *  pagination: { page?: number; pageCount?: number; total?: number };
 *  feedbackMessage?: string;
 *  texts: {
 *    searchPlaceholder: string;
 *    create: string;
 *    selectionModeOn: string;
 *    selectionModeOff: string;
 *    selectAll: string;
 *    unselectAll: string;
 *    total: string;
 *    page: string;
 *  };
 * }} props
 * @returns {import('react').ReactElement}
 */
function SuperAdminListToolbar({
  feedbackMessage = '',
  onClearQuery,
  onCreateEntry,
  onQueryChange,
  onSortChange,
  pagination,
  query,
  selectionState,
  sortMode,
  sortOptions,
  texts,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <View style={[Spaces.paddingHorizontal[16], Spaces.marginTop[12], Spaces.marginBottom[12], Spaces.gap[10]]}>
      <View
        style={[
          ApplicationStyle.card,
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[8],
          { backgroundColor: Colors.neutral800 },
        ]}
      >
        <Image
          source={searchIcon}
          style={{
            height: 18,
            marginRight: 8,
            tintColor: Colors.neutral300,
            width: 18,
          }}
        />
        <TextInput
          onChangeText={onQueryChange}
          placeholder={texts.searchPlaceholder}
          placeholderTextColor={Colors.neutral300}
          style={[Fonts.p1, { color: Colors.neutral00, flex: 1 }]}
          value={query}
        />
        {query.length > 0 ? (
          <TouchableOpacity
            hitSlop={{
              bottom: 8, left: 8, right: 8, top: 8,
            }}
            onPress={onClearQuery}
          >
            <Image
              source={closeIcon}
              style={{ height: 14, tintColor: Colors.neutral300, width: 14 }}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
        {sortOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            onPress={() => onSortChange(option.key)}
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingHorizontal[10],
              Spaces.paddingVertical[8],
              {
                backgroundColor: sortMode === option.key ? Colors.primary700 : Colors.neutral700,
                borderColor: sortMode === option.key ? Colors.primary500 : Colors.neutral600,
                borderWidth: 1,
              },
            ]}
          >
            <Text style={[Fonts.p3, { color: sortMode === option.key ? Colors.primary200 : Colors.neutral100 }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[Alignments.row, Spaces.gap[8], Alignments.alignCenter]}>
        <Button
          icon="plus"
          iconPosition="after"
          onPress={onCreateEntry}
          size="md"
          style={{ flex: 1 }}
          title={texts.create}
          variant="Primary"
        />
        <TouchableOpacity
          onPress={selectionState.onToggleMode}
          style={[
            ApplicationStyle.borderRadius12,
            Spaces.paddingHorizontal[10],
            Spaces.paddingVertical[10],
            {
              backgroundColor: selectionState.isSelectionMode ? Colors.primary700 : Colors.neutral700,
              borderColor: selectionState.isSelectionMode ? Colors.primary500 : Colors.neutral600,
              borderWidth: 1,
              minHeight: 44,
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
            {selectionState.isSelectionMode ? texts.selectionModeOn : texts.selectionModeOff}
          </Text>
        </TouchableOpacity>
        {selectionState.isSelectionMode ? (
          <TouchableOpacity
            onPress={selectionState.onToggleSelectAll}
            style={[
              ApplicationStyle.borderRadius12,
              Spaces.paddingHorizontal[10],
              Spaces.paddingVertical[10],
              {
                backgroundColor: Colors.neutral700,
                borderColor: Colors.neutral600,
                borderWidth: 1,
                minHeight: 44,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>
              {selectionState.areAllPageEntriesSelected ? texts.unselectAll : texts.selectAll}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {texts.total}
          {': '}
          {pagination?.total || 0}
        </Text>
        <Text style={[Fonts.p2, Fonts.neutral300]}>
          {texts.page}
          {' '}
          {pagination?.page || 1}
          {' / '}
          {pagination?.pageCount || 1}
        </Text>
      </View>

      {feedbackMessage ? (
        <View
          style={[
            ApplicationStyle.borderRadius12,
            Spaces.paddingHorizontal[10],
            Spaces.paddingVertical[8],
            {
              alignSelf: 'flex-start',
              backgroundColor: 'rgba(39, 214, 163, 0.18)',
              borderColor: Colors.success500,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p3, { color: Colors.success500 }]}>{feedbackMessage}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default SuperAdminListToolbar;
