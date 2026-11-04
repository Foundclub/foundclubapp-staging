import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

/**
 * T3-STADE (03/11/2026) — une case à cocher, avec son titre et sa petite phrase : celle de « Sauf
 * vacances scolaires » (`DateEtHoraire`), pour « Toute l'installation ».
 * @param {object} props - Les réglages.
 * @param {boolean} props.actif - Cochée ou non.
 * @param {string} [props.dit] - La petite phrase.
 * @param {() => void} props.onBasculer - Le geste.
 * @param {string} [props.testID] - Le témoin.
 * @param {string} props.titre - Le titre.
 * @returns {import('react').ReactElement} La case.
 */
function CaseACocher({
  actif, dit = '', onBasculer, testID, titre,
}) {
  const { Alignments, Colors, Fonts } = useTheme();
  return (
    <TouchableOpacity
      accessibilityLabel={titre}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: actif }}
      onPress={onBasculer}
      style={[Alignments.row, Alignments.alignCenter, { gap: 12, minHeight: 44 }]}
      testID={testID}
    >
      <View
        style={[Alignments.center, {
          backgroundColor: actif ? Colors.primary500 : 'transparent',
          borderColor: actif ? Colors.primary500 : Colors.primary200,
          borderRadius: 6,
          borderWidth: 2,
          height: 24,
          width: 24,
        }]}
      >
        {actif ? <SvgIcon color={Colors.primary900} height={14} name="check" width={14} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
        {dit ? <Text style={[Fonts.p3, Fonts.neutral200]}>{dit}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export default CaseACocher;
