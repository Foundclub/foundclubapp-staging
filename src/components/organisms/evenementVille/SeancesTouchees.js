import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import {
  seancesToucheesTitre,
  seanceToucheeLabel,
} from '@/domains/collectivite/evenementDeLaVille';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * 🏛️ R17-EVT-1-BIS (h) (20/10/2026) — L'ENCART DES SÉANCES TOUCHÉES par un événement de la Ville
 * qui prend toute l'installation : combien, les 5 premières (un club, une équipe, des heures —
 * jamais une personne : le serveur ne rend rien d'autre), et ce que leur club en voit. Partagé
 * par le formulaire (avant de publier) et la fiche de la Ville (après : celles que leur club a
 * déplacées en sortent). Rien s'il n'y en a aucune.
 * @param {object} props
 * @param {string} props.explication - Ce que voit leur club (futur dans le formulaire, présent
 *   sur la fiche).
 * @param {any} props.touchees - `{ sessions, sessionsCount }` (l'aperçu du serveur), ou rien.
 * @returns {import('react').ReactElement | null} L'encart, ou rien.
 */
function SeancesTouchees({ explication, touchees }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  if (!touchees || !(Number(touchees.sessionsCount) > 0)) return null;
  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: withAlpha(Colors.warning500, 0.12),
        borderColor: withAlpha(Colors.warning500, 0.5),
        borderRadius: 12,
        borderWidth: 1,
        gap: 4,
        padding: 12,
      }}
      testID="evenement-seances-touchees"
    >
      <Text style={[Fonts.p2Bold, { color: Colors.warning400 }]}>
        {seancesToucheesTitre(t, touchees.sessionsCount)}
      </Text>
      {(Array.isArray(touchees.sessions) ? touchees.sessions : [])
        .slice(0, 5)
        .map((/** @type {any} */ seance) => {
          const cle = [seance?.club?.documentId, seance?.team?.name, seance?.date]
            .concat(seance?.startTime).join('-');
          return (
            <Text key={cle} style={[Fonts.p3, Fonts.neutral100]}>
              {seanceToucheeLabel(t, seance)}
            </Text>
          );
        })}
      <Text style={[Fonts.p3, Fonts.neutral200]}>{explication}</Text>
    </View>
  );
}

export default SeancesTouchees;
