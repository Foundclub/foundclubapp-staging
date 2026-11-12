import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { libelleDuBonus } from '@/domains/complexe/fideliteDuComplexe';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

/**
 * « TON BONUS FIDÉLITÉ » — FIDELITE (12/11/2026, D63, maquette « 237- ok », précision 2) : au
 * récapitulatif, le joueur choisit d'utiliser son bonus sur CETTE réservation, ou de le garder
 * pour plus tard. « Si cette réservation est annulée, ton bonus te revient. » Le serveur calcule
 * et fige la remise ; rien n'est encaissé dans l'app.
 * @param {object} props - Les propriétés.
 * @param {{ percent?: number | null, rewardType: string, scope: string }} props.bonus - Le bonus
 *   (`fidelite.bonus` du récapitulatif du serveur).
 * @param {string} props.complexe - Le nom du complexe.
 * @param {boolean} props.utiliser - Le choix.
 * @param {(utiliser: boolean) => void} props.onUtiliser - Change le choix.
 * @returns {import('react').ReactElement} Le bloc.
 */
function BlocBonusFidelite({
  bonus, complexe, onUtiliser, utiliser,
}) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const choix = (
    /** @type {boolean} */ valeur,
    /** @type {string} */ libelle,
    /** @type {string} */ testID,
  ) => {
    const choisi = utiliser === valeur;
    return (
      <TouchableOpacity
        accessibilityLabel={libelle}
        accessibilityRole="radio"
        accessibilityState={{ checked: choisi }}
        onPress={() => onUtiliser(valeur)}
        style={{
          alignItems: 'center',
          backgroundColor: choisi ? Colors.primary500 : 'transparent',
          borderRadius: 12,
          flexBasis: 140,
          flexGrow: 1,
          justifyContent: 'center',
          minHeight: 44,
          paddingHorizontal: 12,
        }}
        testID={testID}
      >
        <Text
          style={[Fonts.p2Bold, choisi ? Fonts.primary900 : Fonts.primary200, Fonts.textCenter]}
        >
          {libelle}
        </Text>
      </TouchableOpacity>
    );
  };
  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.success500, 0.08),
        borderColor: withAlpha(Colors.success500, 0.4),
        borderRadius: 20,
        borderWidth: 1,
        gap: 10,
        padding: 16,
      }}
      testID="bloc-bonus-fidelite"
    >
      <Text
        accessibilityRole="header"
        style={[Fonts.p3Bold, Fonts.success500, { letterSpacing: 0.5 }]}
      >
        {t('fidelite.recap.titre', 'Ton bonus fidélité').toUpperCase()}
      </Text>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('fidelite.recap.bonus', '{{bonus}} à {{complexe}}', {
          bonus: libelleDuBonus(t, bonus), complexe, ...SANS_ECHAPPEMENT,
        })}
      </Text>
      <View
        accessibilityRole="radiogroup"
        style={[Alignments.row, Alignments.wrap, {
          borderColor: withAlpha(Colors.primary500, 0.4),
          borderRadius: 14,
          borderWidth: 1,
          gap: 4,
          padding: 4,
        }]}
      >
        {choix(
          true,
          t('fidelite.recap.utiliser', 'L’utiliser sur cette réservation'),
          'bonus-utiliser',
        )}
        {choix(false, t('fidelite.recap.garder', 'Le garder pour plus tard'), 'bonus-garder')}
      </View>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t('fidelite.recap.revient', 'Si cette réservation est annulée, ton bonus te revient.')}
      </Text>
    </View>
  );
}

export default BlocBonusFidelite;
