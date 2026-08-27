import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

import {
  getClubCertificationLabel,
  getClubCertificationPalette,
} from '@/utils/clubCertification';
import { getShortAddress } from '@/utils/location';

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
  const certificationPalette = getClubCertificationPalette(item, Colors);
  const certificationLabel = getClubCertificationLabel(item);

  return (
    <TouchableOpacity
      accessibilityLabel={[item?.name || 'Club', certificationLabel, shortAddress]
        .filter(Boolean)
        .join(', ')}
      accessibilityRole="button"
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
      <ClubLogoMark
        club={item}
        logoStyle={{
          borderColor: isSelected ? Colors.primary500 : Colors.primary200,
          borderRadius: 14,
          borderWidth: 1,
        }}
        size={56}
      />

      <View style={[Spaces.gap[4], { flex: 1 }]}>
        {reasonLabel ? (
          <Text style={[Fonts.p3, { color: Colors.primary200 }]}>
            {reasonLabel}
          </Text>
        ) : null}

        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
          {/* MARQUEE — un nom de club trop long se lit en entier, sans ouvrir la fiche. */}
          <MarqueeText
            containerStyle={{ flex: 1 }}
            style={[Fonts.p1Bold, { color: Colors.neutral00 }]}
            text={item?.name || 'Club'}
          />
          {isMultisport ? (
            <View
              style={{
                backgroundColor: Colors.primary500,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={[Fonts.p3, { color: Colors.primary900 }]}>OMNISPORT</Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: certificationPalette.backgroundColor,
                borderColor: certificationPalette.borderColor,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={[Fonts.p4Bold, { color: certificationPalette.textColor }]}>
                {certificationLabel}
              </Text>
            </View>
          )}
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
