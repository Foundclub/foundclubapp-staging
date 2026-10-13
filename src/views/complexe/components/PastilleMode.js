import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';

import { libelleMode } from '@/domains/complexe/complexeTerrain';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

/**
 * LE MODE D'UN TERRAIN — RESA-L5A1 (13/10/2026), planche P00 bloc 5 : « le mode est une
 * configuration, pas un état » ⇒ toujours la pastille cyan, avec son icône (coche, sablier,
 * téléphone). Côté gérant : Automatique · Validation manuelle · Téléphone seulement.
 * @param {object} props - Les propriétés.
 * @param {string | null | undefined} props.mode - `automatique | manuel | telephone`.
 * @returns {import('react').ReactElement | null} La pastille, ou rien pour un mode inconnu.
 */
function PastilleMode({ mode }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const libelle = libelleMode(t, mode);
  if (!libelle) return null;
  const icone = mode === 'manuel'
    ? <GlyphIcon color={Colors.primary500} name="hourglass" size={12} />
    : (
      <Image
        source={mode === 'telephone' ? Images.phone : Images.check}
        style={[{ height: 12, width: 12 }, ApplicationStyle.tintColor.primary500]}
      />
    );
  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          alignSelf: 'flex-start',
          backgroundColor: withAlpha(Colors.primary500, 0.14),
          borderRadius: 999,
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 2,
        },
      ]}
      testID={`pastille-mode-${mode}`}
    >
      {icone}
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>{libelle}</Text>
    </View>
  );
}

export default PastilleMode;
