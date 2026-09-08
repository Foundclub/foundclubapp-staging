import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * LE RUBAN D'ÉTAPES — « Prépa · Éch. · 1 · 2 · 3 · 4 · Fin ».
 *
 * 🔎 CE QU'IL RÉPOND, ET RIEN D'AUTRE : « il m'en reste combien ? ». Sur un test de
 * quatre essais entrecoupés de récupérations, on traverse neuf pages. Sans ruban, la
 * huitième ressemble à la deuxième et on ne sait plus si on a fait trois essais ou
 * cinq — donc on en refait un par sécurité, et la série est faussée.
 *
 * 🪤 IL EST CLIQUABLE VERS L'ARRIÈRE SEULEMENT. Revenir sur un essai déjà fait pour
 * relire une valeur est légitime ; sauter vers un essai qu'on n'a pas encore fait ne
 * l'est pas — ça laisserait un trou dans la série sans que rien ne le signale.
 */

/** Les couleurs du ruban, par état. Trois, pas cinq : il se lit d'un coup d'œil. */
const TEINTES = { current: 'primary500', done: 'success500', todo: 'neutral600' };

/**
 * Le ruban lui-même.
 * @param {object} props Les propriétés du ruban.
 * @param {Record<string, any>[]} props.arrets Les arrêts du parcours, dans l'ordre.
 * @param {('done'|'current'|'todo')[]} props.etats Un état par arrêt.
 * @param {(arret: Record<string, any>) => void} [props.onPress] Ouvre un arrêt déjà passé.
 * @returns {React.ReactElement} le ruban d'étapes
 */
function TrainingStepRail({ arrets, etats, onPress }) {
  const { Colors, Fonts } = useTheme();

  return (
    <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
      {(Array.isArray(arrets) ? arrets : []).map((arret, rang) => {
        const etat = etats[rang] || 'todo';
        const teinte = Colors[/** @type {keyof Colors} */ (TEINTES[etat])];
        const passe = etat === 'done';

        return (
          <TouchableOpacity
            accessibilityLabel={arret.court}
            accessibilityRole="button"
            accessibilityState={{ disabled: !passe, selected: etat === 'current' }}
            disabled={!passe || typeof onPress !== 'function'}
            key={arret.cle}
            onPress={() => onPress(arret)}
            style={{
              alignItems: 'center',
              backgroundColor: etat === 'todo' ? 'transparent' : withAlpha(teinte, 0.2),
              borderColor: teinte,
              borderRadius: 8,
              borderWidth: 1,
              flexGrow: 1,
              justifyContent: 'center',
              minHeight: 32,
              paddingHorizontal: 4,
            }}
          >
            <Text
              numberOfLines={1}
              style={[Fonts.caption, {
                color: etat === 'todo' ? Colors.neutral400 : teinte,
              }]}
            >
              {passe ? '✓' : arret.court}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default TrainingStepRail;
