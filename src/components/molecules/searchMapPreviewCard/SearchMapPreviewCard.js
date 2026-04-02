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
const compactEntries = (entries = []) => entries.filter(Boolean).slice(0, 3);

/**
 * @param {object} props
 * @param {import('@/utils/searchMap').SearchMapItem | null | undefined} props.item
 * @param {(item: import('@/utils/searchMap').SearchMapItem) => void} props.onOpen
 * @param {() => void} props.onShowList
 * @param {'events' | 'clubs' | 'reservations'} props.scope
 * @returns {import('react').ReactElement | null}
 */
function SearchMapPreviewCard({
  item,
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

  return (
    <View
      pointerEvents="box-none"
      style={{
        bottom: 12,
        left: 12,
        position: 'absolute',
        right: 12,
      }}
    >
      <View
        style={[
          ApplicationStyle.shadow200,
          {
            backgroundColor: 'rgba(5, 28, 42, 0.96)',
            borderColor: `${Colors.primary500}44`,
            borderRadius: 22,
            borderWidth: 1,
            overflow: 'hidden',
          },
        ]}
      >
        <View style={[Spaces.padding[16], Spaces.gap[14]]}>
          <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
                style={{
                  backgroundColor: `${Colors.primary500}18`,
                  borderColor: `${Colors.primary500}4A`,
                  borderRadius: 22,
                  borderWidth: 1,
                  height: 44,
                  width: 44,
                }}
              />
            ) : (
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: `${Colors.primary500}18`,
                  borderColor: `${Colors.primary500}4A`,
                  borderRadius: 22,
                  borderWidth: 1,
                  height: 44,
                  justifyContent: 'center',
                  width: 44,
                }}
              >
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  {getInitial(item.title)}
                </Text>
              </View>
            )}

            <View style={[Alignments.grow1, Spaces.gap[4]]}>
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
                  {item.title}
                </Text>
                {item.badge ? (
                  <View
                    style={{
                      backgroundColor: `${Colors.primary500}16`,
                      borderColor: `${Colors.primary500}55`,
                      borderRadius: 999,
                      borderWidth: 1,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={[Fonts.p4Bold, Fonts.primary500]}>
                      {item.badge}
                    </Text>
                  </View>
                ) : null}
              </View>

              {item.subtitle ? (
                <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral200]}>
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
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 5,
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
        </View>

        <View
          style={[
            Alignments.row,
            Spaces.gap[10],
            Spaces.paddingHorizontal[16],
            Spaces.paddingBottom[16],
            { paddingTop: 2 },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onShowList()}
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.05)',
              borderColor: 'rgba(255,255,255,0.12)',
              borderRadius: 16,
              borderWidth: 1,
              flex: 1,
              justifyContent: 'center',
              minHeight: 44,
              paddingHorizontal: 14,
            }}
          >
            <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
              Voir la liste
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onOpen(item)}
            style={{
              alignItems: 'center',
              backgroundColor: Colors.primary500,
              borderRadius: 16,
              flex: 1.1,
              justifyContent: 'center',
              minHeight: 44,
              paddingHorizontal: 14,
            }}
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
