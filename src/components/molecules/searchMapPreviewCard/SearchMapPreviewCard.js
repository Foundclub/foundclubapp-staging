import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * @param {string} value
 * @returns {string}
 */
const getInitial = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
};

/**
 * @param {string[]} entries
 * @returns {string[]}
 */
const compactEntries = (entries = []) => entries.filter(Boolean).slice(0, 2);

/**
 * @param {object} props
 * @param {import('@/utils/searchMap').SearchMapItem | null | undefined} props.item
 * @param {number} [props.bottomOffset]
 * @param {() => void} [props.onDismiss]
 * @param {(item: import('@/utils/searchMap').SearchMapItem) => void} props.onOpen
 * @param {() => void} [props.onShowList]
 * @param {'events' | 'clubs' | 'reservations'} props.scope
 * @returns {import('react').ReactElement | null}
 */
function SearchMapPreviewCard({
  bottomOffset = 12,
  item,
  onDismiss,
  onOpen,
  onShowList,
  scope,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  if (!item) return null;

  const metaEntries = compactEntries([
    item.dateLabel,
    item.timeLabel,
    scope === 'reservations' ? item.priceLabel : '',
    item.distanceLabel,
  ]);
  const secondaryActionLabel = onDismiss ? 'Masquer' : 'Voir la liste';
  const handleSecondaryAction = onDismiss || onShowList;

  return (
    <View
      pointerEvents="box-none"
      style={{
        bottom: bottomOffset,
        left: 16,
        position: 'absolute',
        right: 16,
      }}
    >
      <View
        style={[
          ApplicationStyle.shadow200,
          ApplicationStyle.borderRadius24,
          {
            backgroundColor: 'rgba(5, 28, 42, 0.94)',
            borderColor: `${Colors.primary500}30`,
            borderWidth: 1,
            overflow: 'hidden',
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => onOpen(item)}
          style={[Spaces.paddingHorizontal[12], Spaces.paddingBottom[10], Spaces.paddingTop[12], Spaces.gap[10]]}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[10]]}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={{
                  backgroundColor: `${Colors.primary500}18`,
                  borderColor: `${Colors.primary500}40`,
                  borderRadius: 28,
                  borderWidth: 1,
                  height: 56,
                  width: 56,
                }}
              />
            ) : (
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: `${Colors.primary500}18`,
                  borderColor: `${Colors.primary500}40`,
                  borderRadius: 28,
                  borderWidth: 1,
                  height: 56,
                  justifyContent: 'center',
                  width: 56,
                }}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  {getInitial(item.title)}
                </Text>
              </View>
            )}

            <View style={[Alignments.grow1, Spaces.gap[4]]}>
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                <Text numberOfLines={1} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                  {item.title}
                </Text>
                {item.badge ? (
                  <View
                    style={{
                      backgroundColor: `${Colors.primary500}16`,
                      borderColor: `${Colors.primary500}44`,
                      borderRadius: 999,
                      borderWidth: 1,
                      maxWidth: '42%',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                    }}
                  >
                    <Text numberOfLines={1} style={[Fonts.p4Bold, Fonts.primary500]}>
                      {item.badge}
                    </Text>
                  </View>
                ) : null}
              </View>

              {item.subtitle ? (
                <Text numberOfLines={1} style={[Fonts.p4, Fonts.neutral200]}>
                  {item.subtitle}
                </Text>
              ) : null}

              {metaEntries.length > 0 ? (
                <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
                  {metaEntries.map((entry) => (
                    <View
                      key={entry}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderRadius: 999,
                        borderWidth: 1,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={[Fonts.p4, Fonts.neutral200]}>
                        {entry}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>

        <View
          style={[
            Alignments.row,
            Spaces.gap[10],
            Spaces.paddingHorizontal[12],
            Spaces.paddingBottom[12],
            { paddingTop: 0 },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleSecondaryAction}
            style={[
              ApplicationStyle.borderRadius16,
              {
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.12)',
                borderWidth: 1,
                flex: 1,
                justifyContent: 'center',
                minHeight: 44,
                paddingHorizontal: 12,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
              {secondaryActionLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onOpen(item)}
            style={[
              ApplicationStyle.shadow200,
              ApplicationStyle.borderRadius16,
              {
                alignItems: 'center',
                backgroundColor: Colors.primary500,
                borderColor: Colors.primary500,
                borderWidth: 1,
                flex: 1.08,
                justifyContent: 'center',
                minHeight: 44,
                paddingHorizontal: 12,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary900 }]}>
              Ouvrir
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default SearchMapPreviewCard;
