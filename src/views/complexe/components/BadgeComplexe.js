import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * LA PASTILLE « COMPLEXE DE RÉSERVATION » — RESA-L5A1 (13/10/2026), planche P00 bloc 1 (A-G05) :
 * un club porte un écusson, un complexe porte cette pastille. Cyan teinté et icône stade, jamais
 * à la couleur d'un terrain, jamais d'or (réservé à League). Version courte « Complexe » quand la
 * place manque.
 * @param {object} props - Les propriétés.
 * @param {boolean} [props.court] - « Complexe » au lieu de « Complexe de réservation ».
 * @returns {import('react').ReactElement} La pastille.
 */
function BadgeComplexe({ court = false }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          alignSelf: 'flex-start',
          backgroundColor: withAlpha(Colors.primary500, 0.14),
          borderColor: withAlpha(Colors.primary500, 0.4),
          borderRadius: 999,
          borderWidth: 1,
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 2,
        },
      ]}
      testID="complexe-badge"
    >
      <Image
        source={Images.stadium}
        style={[{ height: 12, width: 12 }, ApplicationStyle.tintColor.primary500]}
      />
      <Text style={[Fonts.p3Bold, Fonts.primary500]}>
        {court
          ? t('complexeGerant.badge.court', 'Complexe')
          : t('complexeGerant.badge.long', 'Complexe de réservation')}
      </Text>
    </View>
  );
}

export default BadgeComplexe;
