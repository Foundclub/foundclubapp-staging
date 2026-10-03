import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { largeurJauge, tauxLisible } from '@/domains/collectivite/collectiviteChiffres';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

/**
 * 📊 LA JAUGE D'OCCUPATION D'UNE INSTALLATION — COLL-C5 (03/10/2026), planches 2 et 3 (design
 * HY521H1 page 1, « P3v2-accueil-tel » et « -ordi », section « Cette semaine ») : une barre de 6 px
 * sous le nom de l'installation, remplie du TAUX d'occupation de la semaine (contrat
 * admin/docs/CONTRAT_CHIFFRES_VILLE.md §5), plafonnée à 100 %.
 *
 * Sans taux (installation sans horaires, ou lecture en cours / en panne) : la barre reste VIDE —
 * exactement la planche sans donnée — et son libellé dit « — ». Jamais un 0 inventé.
 * @param {{ couleur?: string | null, taux?: number | null, testID?: string }} props
 * @returns {import('react').ReactElement} La jauge.
 */
function JaugeOccupation({ couleur = null, taux = null, testID }) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const largeur = largeurJauge(taux);
  return (
    <View
      accessibilityLabel={t('collectiviteChiffres.jauge.a11y', 'Occupation : {{taux}}', {
        taux: tauxLisible(taux),
        ...SANS_ECHAPPEMENT,
      })}
      accessibilityRole="progressbar"
      accessibilityValue={{ max: 100, min: 0, now: largeur }}
      style={{
        backgroundColor: withAlpha(Colors.neutral00, 0.08),
        borderRadius: 3,
        height: 6,
        overflow: 'hidden',
      }}
      testID={testID}
    >
      <View
        style={{
          backgroundColor: couleur || Colors.primary500,
          borderRadius: 3,
          height: '100%',
          width: `${largeur}%`,
        }}
      />
    </View>
  );
}

export default JaugeOccupation;
