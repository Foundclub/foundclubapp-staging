import { Image, Text, View } from 'react-native';

import { initialesDuComplexe } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * LE LOGO CARRÉ D'UN COMPLEXE — RESA-L5A1 (13/10/2026), planche P00 bloc 1 : coins de 24 (80 px),
 * 16 (60 px) ou 12 (40 px), liseré cyan ; sans logo, les initiales en cyan pâle (« LF »).
 * @param {object} props - Les propriétés.
 * @param {string | null} [props.logo] - L'adresse de l'image du logo.
 * @param {string} props.nom - Le nom du complexe.
 * @param {number} [props.taille] - Le côté, en points.
 * @returns {import('react').ReactElement} Le logo.
 */
function LogoComplexe({ logo = null, nom, taille = 60 }) {
  const { Alignments, Colors, Fonts } = useTheme();
  let rayon = 12;
  if (taille >= 80) rayon = 24;
  else if (taille >= 60) rayon = 16;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          backgroundColor: withAlpha(Colors.primary500, 0.12),
          borderColor: withAlpha(Colors.primary500, 0.6),
          borderRadius: rayon,
          borderWidth: 1,
          height: taille,
          overflow: 'hidden',
          width: taille,
        },
      ]}
    >
      {logo ? (
        <Image
          resizeMode="cover"
          source={{ uri: logo }}
          style={{ height: taille, width: taille }}
          testID="complexe-logo-image"
        />
      ) : (
        <Text style={[taille >= 60 ? Fonts.h4Black : Fonts.p2Black, Fonts.primary200]}>
          {initialesDuComplexe(nom)}
        </Text>
      )}
    </View>
  );
}

export default LogoComplexe;
