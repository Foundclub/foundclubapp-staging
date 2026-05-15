import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';
import closeIcon from '@/assets/icons/close.png';
import searchIcon from '@/assets/icons/search.png';

import Button from '@/components/atoms/button/Button';
import superAdminLayout from '@/components/molecules/superAdmin/superAdminLayout';

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
 *  horizontalPadding?: number;
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
 *    selected: string;
 *  };
 * }} props
 * @returns {import('react').ReactElement}
 */
function SuperAdminListToolbar({
  feedbackMessage = '',
  horizontalPadding = superAdminLayout.pageHorizontal,
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
  const { width: screenWidth } = useWindowDimensions();
  const isCompactScreen = screenWidth <= superAdminLayout.compactBreakpoint;

  return (
    <View
      style={[
        { paddingHorizontal: horizontalPadding },
        Spaces.marginTop[16],
        Spaces.marginBottom[16],
        Spaces.gap[superAdminLayout.toolbarGap],
      ]}
    >
      <View
        style={[
          ApplicationStyle.card,
          Alignments.row,
          Alignments.alignCenter,
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[10],
          {
            backgroundColor: Colors.primary700,
            borderColor: Colors.primary500,
            borderWidth: 1,
          },
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

      <View style={[Alignments.row, Alignments.alignCenter, { flexWrap: isCompactScreen ? 'wrap' : 'nowrap' }]}>
        <Button
          icon="plus"
          iconPosition="after"
          onPress={onCreateEntry}
          size="md"
          style={isCompactScreen ? { marginBottom: 10, width: '100%' } : { flex: 1, marginRight: 10 }}
          title={texts.create}
          variant="Primary"
        />
        <TouchableOpacity
          onPress={selectionState.onToggleMode}
          style={[
            ApplicationStyle.borderRadius12,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[10],
            {
              alignItems: 'center',
              backgroundColor: selectionState.isSelectionMode ? Colors.primary700 : Colors.primary900,
              borderColor: selectionState.isSelectionMode ? Colors.primary500 : Colors.primary700,
              borderWidth: 1,
              justifyContent: 'center',
              marginBottom: isCompactScreen ? 10 : 0,
              minHeight: 44,
              width: isCompactScreen ? '100%' : undefined,
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
            {selectionState.isSelectionMode ? texts.selectionModeOn : texts.selectionModeOff}
          </Text>
        </TouchableOpacity>
      </View>

      {selectionState.isSelectionMode ? (
        <TouchableOpacity
          onPress={selectionState.onToggleSelectAll}
          style={[
            ApplicationStyle.borderRadius12,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[10],
            {
              alignSelf: 'flex-start',
              backgroundColor: Colors.primary900,
              borderColor: Colors.primary700,
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

      <View style={[Alignments.row, { flexWrap: 'wrap' }]}>
        {sortOptions.map((option) => (
          <TouchableOpacity
            key={option.key}
            onPress={() => onSortChange(option.key)}
            style={[
              {
                borderRadius: 14,
              },
              Spaces.paddingHorizontal[12],
              Spaces.paddingVertical[8],
              {
                backgroundColor: sortMode === option.key ? Colors.primary700 : Colors.primary900,
                borderColor: sortMode === option.key ? Colors.primary500 : Colors.primary700,
                borderWidth: 1,
                marginBottom: 8,
                marginRight: 8,
                minHeight: 38,
              },
            ]}
          >
            <Text style={[Fonts.p3, { color: sortMode === option.key ? Colors.primary200 : Colors.neutral100 }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {texts.total}
          {': '}
          {pagination?.total || 0}
        </Text>
        {selectionState.isSelectionMode ? (
          <Text style={[Fonts.p2, Fonts.primary200]}>
            {selectionState.selectedCount}
            {' '}
            {texts.selected}
          </Text>
        ) : null}
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
