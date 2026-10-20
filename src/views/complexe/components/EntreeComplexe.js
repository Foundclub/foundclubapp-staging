import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

import { ecrireModeComplexe } from '@/domains/complexe/modeComplexe';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

import { useMesComplexes } from '@/services/complexe/complexeQueries';

/**
 * « JE GÈRE UN COMPLEXE » DANS « MON COMPTE » — RESA-L5A1 (13/10/2026), planche E-G01 état 1
 * (AT-01) : un joueur, un coach ou un parent ouvre son complexe depuis son compte, sans nouveau
 * numéro ni nouveau compte. Qui en gère déjà un lit « Mon complexe » : il passe en mode complexe.
 * Rien pendant la lecture (jamais « Je gère un complexe » à qui en gère déjà un). La carte bleue
 * des écrans du profil (`feedbackCardStyle`, CoachFeedbackList.js, recopiée en jetons : l'importer
 * chargerait l'écran des retours dans « Mon compte »).
 * Monté seulement quand `COMPLEXES_GERANT` est allumé (`Profile.js`).
 * @param {object} props - Les propriétés.
 * @param {string | null} props.compteId - Le documentId du compte (le mode se garde par compte).
 * @returns {import('react').ReactElement | null} L'entrée, ou rien.
 */
function EntreeComplexe({ compteId }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const mes = useMesComplexes({ enabled: Boolean(compteId) });
  if (mes.isLoading) return null;
  const complexe = Array.isArray(mes.data) && mes.data.length ? mes.data[0] : null;

  const titre = complexe
    ? t('complexeGerant.entree.monComplexe', 'Mon complexe')
    : t('complexeGerant.entree.jeGere', 'Je gère un complexe');
  const sousTitre = complexe
    ? String(complexe.name || '')
    : t('complexeGerant.entree.sousTitre', 'Foot à 5, padel, tennis… Sur ce même compte.');
  const ouvrir = () => {
    if (!complexe) {
      navigation.navigate(RouteNames.ComplexeDevenirGerant);
      return;
    }
    ecrireModeComplexe(compteId, true);
    navigation.navigate(RouteNames.ComplexeEspace, { complexeId: complexe.documentId });
  };

  return (
    <TouchableOpacity
      accessibilityLabel={titre}
      accessibilityRole="button"
      onPress={ouvrir}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor: withAlpha(Colors.primary700, 0.55),
          borderColor: withAlpha(Colors.primary500, 0.24),
          borderRadius: 24,
          borderWidth: 1,
          gap: 12,
          minHeight: 56,
          padding: 16,
        },
      ]}
      testID="complexe-entree"
    >
      <View
        style={[
          Alignments.alignCenter,
          Alignments.justifyCenter,
          {
            backgroundColor: withAlpha(Colors.primary500, 0.18),
            borderRadius: 10,
            height: 30,
            width: 30,
          },
        ]}
      >
        <Image
          source={Images.stadium}
          style={[{ height: 16, width: 16 }, ApplicationStyle.tintColor.primary200]}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{sousTitre}</Text>
      </View>
      <Image
        source={Images.arrowRight}
        style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
      />
    </TouchableOpacity>
  );
}

export default EntreeComplexe;
