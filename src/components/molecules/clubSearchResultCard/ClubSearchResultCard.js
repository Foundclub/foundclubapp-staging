import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import { getImageUrl } from '@/utils/imageUrl';
import { getShortAddress } from '@/utils/location';

const defaultClubIcon = require('@/assets/icons/shield.png');

const getSectionLabel = (count) => {
  if (!count) return '';
  return `${count} section${count > 1 ? 's' : ''}`;
};

/**
 * @param {{
 *  item: any;
 *  footer?: React.ReactNode;
 *  isSelected?: boolean;
 *  onPress?: () => void;
 *  reasonLabel?: string;
 * }} props
 */
function ClubSearchResultCard({
  footer = null,
  isMultisport: isMultisportProp = undefined,
  isSelected = false,
  item,
  onPress,
  reasonLabel = '',
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const isMultisport = typeof isMultisportProp === 'boolean'
    ? isMultisportProp
    : Reflect.get(item || {}, '_type') === 'multisport';
  const shortAddress = getShortAddress(item?.addressDetails || item?.address);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      disabled={!onPress}
      onPress={onPress}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Spaces.gap[16],
        Spaces.padding[16],
        {
          backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.primary700,
          borderColor: isSelected ? Colors.primary500 : Colors.primary200,
          borderRadius: 16,
          borderWidth: isSelected ? 2 : 1,
        },
      ]}
    >
      <View
        style={{
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderColor: isSelected ? Colors.primary500 : Colors.primary200,
          borderRadius: 18,
          borderWidth: 1,
          height: 56,
          justifyContent: 'center',
          width: 56,
        }}
      >
        <Image
          resizeMode="contain"
          source={item?.logo?.url ? { uri: getImageUrl(item.logo.url) } : defaultClubIcon}
          style={{
            height: 38,
            tintColor: item?.logo?.url ? undefined : Colors.primary500,
            width: 38,
          }}
        />
      </View>

      <View style={[Spaces.gap[4], { flex: 1 }]}>
        {reasonLabel ? (
          <Text style={[Fonts.p3, { color: Colors.primary200 }]}>
            {reasonLabel}
          </Text>
        ) : null}

        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          <Text
            ellipsizeMode="tail"
            numberOfLines={1}
            style={[Fonts.p1Bold, { color: Colors.neutral00, flex: 1 }]}
          >
            {item?.name || 'Club'}
          </Text>
          {isMultisport ? (
            <View
              style={{
                backgroundColor: Colors.primary500,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={[Fonts.p3, { color: '#FFFFFF' }]}>OMNISPORT</Text>
            </View>
          ) : null}
        </View>

        {shortAddress ? (
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {shortAddress}
          </Text>
        ) : null}

        {isMultisport && item?.sectionsCount ? (
          <Text style={[Fonts.p3, { color: Colors.primary200 }]}>
            {getSectionLabel(item.sectionsCount)}
          </Text>
        ) : null}

        {footer}
      </View>
    </TouchableOpacity>
  );
}

export default ClubSearchResultCard;
