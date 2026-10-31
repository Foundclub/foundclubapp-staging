import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * Compteur - / valeur / +.
 *
 * 🎨 D58 — `tone` choisit le registre visuel, et le defaut ne bouge pas.
 * `'surface'` est l'historique : fond clair, boutons blancs, chiffre sombre.
 * `'tunnel'` est celui du pack « Tunnel Evenement » (§2.8, « fini le stepper
 * blanc ») : le meme compteur que l'etape Participants, sur fond sombre.
 * ⚠️ Ce composant est partage par 4 ecrans — la fiche Tache, les licences et
 * deux ecrans de recrutement. Changer le defaut les repeindrait tous les
 * quatre ; seul l'appelant concerne demande l'autre registre.
 * ST-MATCH (02/10) — `decrementLabel` / `incrementLabel` : un nom pour CHAQUE bouton
 * quand « Précédent / Suivant » ne dit pas ce qu'il fait (« Un but de plus pour
 * AS Montrivage », la saisie du score). Absents, rien ne change pour les 4 écrans.
 * FINITIONS11 (03/10, écran 9 des stats, état 3) — `locked` : le compteur VERROUILLÉ de la
 * planche (score officiel) — bordure pointillée orange, fond orange léger, les deux boutons
 * éteints. Sur demande seulement, comme `keepTitleWhileLoading` sur Button.
 * @param {object} root0 Proprietes.
 * @param {string} [root0.decrementLabel] Nom du bouton « - » pour les lecteurs d'écran.
 * @param {string} [root0.incrementLabel] Nom du bouton « + » pour les lecteurs d'écran.
 * @param {string} [root0.label] Intitule affiche au-dessus du compteur.
 * @param {boolean} [root0.locked] Verrouille : bordure pointillee orange, boutons eteints.
 * @param {number} [root0.max] Valeur maximale atteignable.
 * @param {number} [root0.min] Valeur minimale atteignable.
 * @param {() => void} root0.onDecrement Appele au « - ».
 * @param {() => void} root0.onIncrement Appele au « + ».
 * @param {'surface' | 'tunnel'} [root0.tone] Registre visuel.
 * @param {number} root0.value Valeur courante.
 * @returns {import('react').ReactElement} Le compteur rendu.
 */
function InputStepper({
  decrementLabel, incrementLabel, label, locked = false, max = 100, min = 0, onDecrement,
  onIncrement, tone = 'surface', value,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  // CORR-ROBUSTESSE point 55 — sans nom fourni, « − / + » s'annonçaient « Précédent / Suivant ».
  const suffixeDuNom = label ? ` : ${label}` : '';
  const isTunnelTone = tone === 'tunnel';
  const containerStyle = isTunnelTone
    ? {
      backgroundColor: 'rgba(4, 31, 44, 0.82)',
      borderColor: 'rgba(1, 179, 244, 0.24)',
      borderRadius: 16,
      borderWidth: 1,
      padding: 8,
    }
    : { backgroundColor: Colors.neutral100, borderRadius: 8, padding: 4 };
  // 🔒 FINITIONS11 — la planche : `border-style: dashed`, warning500 à 55 %, fond à 6 %.
  const lockedStyle = locked
    ? {
      backgroundColor: withAlpha(Colors.warning500, 0.06),
      borderColor: withAlpha(Colors.warning500, 0.55),
      borderStyle: /** @type {'dashed'} */ ('dashed'),
      borderWidth: 1,
    }
    : null;
  const decrementDisabled = locked || value <= min;
  const incrementDisabled = locked || value >= max;
  const buttonStyle = isTunnelTone
    ? {
      backgroundColor: 'rgba(1, 179, 244, 0.12)',
      borderColor: 'rgba(1, 179, 244, 0.28)',
      borderRadius: 16,
      borderWidth: 1,
    }
    : { backgroundColor: Colors.neutral00, borderRadius: 6 };
  const signStyle = isTunnelTone ? Fonts.primary500 : Fonts.primary700;
  const valueStyle = isTunnelTone ? Fonts.neutral00 : Fonts.neutral900;
  const labelStyle = isTunnelTone ? Fonts.neutral200 : Fonts.neutral300;

  return (
    <View>
      {label && <Text style={[Fonts.p2, labelStyle, Spaces.marginBottom[8]]}>{label}</Text>}
      <View style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        containerStyle,
        lockedStyle,
      ]}
      >
        <TouchableOpacity
          accessibilityLabel={decrementLabel
            || `${t('inputStepper.decrement', 'Un de moins')}${suffixeDuNom}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: decrementDisabled }}
          disabled={decrementDisabled}
          hitSlop={ApplicationStyle.hitSlop.min44From40}
          onPress={onDecrement}
          style={[
            Spaces.padding[12],
            buttonStyle,
            decrementDisabled && { opacity: 0.5 },
          ]}
        >
          <Text style={[Fonts.h3, signStyle]}>-</Text>
        </TouchableOpacity>

        <Text style={[Fonts.h3, valueStyle]}>{value}</Text>

        <TouchableOpacity
          accessibilityLabel={incrementLabel
            || `${t('inputStepper.increment', 'Un de plus')}${suffixeDuNom}`}
          accessibilityRole="button"
          accessibilityState={{ disabled: incrementDisabled }}
          disabled={incrementDisabled}
          hitSlop={ApplicationStyle.hitSlop.min44From40}
          onPress={onIncrement}
          style={[
            Spaces.padding[12],
            buttonStyle,
            incrementDisabled && { opacity: 0.5 },
          ]}
        >
          <Text style={[Fonts.h3, signStyle]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default InputStepper;
