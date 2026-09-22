import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { View } from 'react-native';

import useTheme from '@/theme/themeContext';

import {
  toVoiceWaveBarHeight,
  VOICE_BAR_MIN_HEIGHT,
  VOICE_WAVEFORM_MAX_BARS,
  VOICE_WAVEFORM_VISIBLE_BARS,
} from '@/services/chat/voiceWaveform';

/** Identifiant de test d'une barre de niveau. */
export const VOICE_LEVEL_BAR_TEST_ID = 'voice-level-bar';
// Le micro rend compte toutes les 50 ms (`voiceNoteService.js`,
// `RECORDER_TICK_SECONDS`). Le frein est posé juste en dessous : il ne sert
// qu'à protéger d'un micro qui parlerait plus vite que prévu, jamais à jeter
// une mesure normale.
const TICK_MIN_MS = 45;

// MSGLIVE — LES BARRES QUI BOUGENT AVEC LA VOIX, ET CE QU'ELLES ONT COÛTÉ.
//
// 📏 LE CHIFFRE QUI A JUSTIFIÉ CE FICHIER (mesuré le 22/09 par
// `ConversationMSGLIVE.vocal.test.js`) : CINQ SECONDES de note vocale
// déclenchaient **101 rendus complets de l'écran de conversation**, qui fait
// 7 400 lignes. Le micro rend compte toutes les 100 ms
// (`voiceNoteService.js`, `setSubscriptionDuration(0.1)`), et chacun de ses
// cinquante comptes rendus redessinait l'écran DEUX FOIS :
//   · une fois pour le chronomètre, alors que le libellé n'affiche que des
//     secondes entières — neuf rendus sur dix pour réécrire « 00:03 » ;
//   · une fois pour les barres.
// C'est ça, la « mollesse » du vocal : l'animation ne peut pas dépasser dix
// images par seconde (c'est le rythme du micro), et elle se payait vingt
// redessins d'écran par seconde.
//
// 🎯 CE QUE CE COMPOSANT CHANGE : les niveaux ne remontent plus à l'écran. Ils
// sont poussés ICI, par une poignée (`pousser`), et seules ces vingt petites
// vues se redessinent. L'écran, lui, ne bouge plus que quand la seconde
// affichée change. Mesuré après : 6 rendus au lieu de 101.
//
// 🪟 LA FENÊTRE GLISSANTE reste tenue ici, et l'historique complet aussi : à
// l'arrêt, l'écran vient le chercher avec `lireHauteurs()` pour en faire la
// forme d'onde du brouillon. Sans ça, il faudrait garder une copie dehors —
// c'est-à-dire refaire exactement ce qu'on vient d'enlever.

/**
 * Les barres de niveau sonore d'une note vocale en cours d'enregistrement.
 * @param {{ dimmed?: boolean }} props - `dimmed` grise les barres pendant l'envoi.
 * @param {any} ref - Poignée : `pousser`, `lireHauteurs`, `reinitialiser`.
 * @returns {import('react').ReactElement} Les barres.
 */
const VoiceLevelBars = forwardRef(({ dimmed = false }, ref) => {
  const { Colors } = useTheme();
  const [hauteurs, setHauteurs] = useState(
    () => Array.from({ length: 14 }, (_, rang) => toVoiceWaveBarHeight(null, 0, rang)),
  );
  // L'historique complet, hors de l'état : personne ne l'affiche, et le relire
  // à l'arrêt ne doit pas dépendre d'un rendu.
  const historiqueRef = useRef(/** @type {number[]} */ ([]));
  const dernierTickRef = useRef(0);

  useImperativeHandle(ref, () => ({
    /**
     * Toutes les hauteurs retenues, pour la forme d'onde du brouillon.
     * @returns {number[]} L'historique.
     */
    lireHauteurs: () => [...historiqueRef.current],
    /**
     * Pousse un niveau sonore. Appelé par le micro, dix fois par seconde.
     * @param {unknown} niveau - Le niveau rendu par le micro, ou null.
     * @param {number} dureeMs - La durée écoulée depuis le début.
     * @returns {void}
     */
    pousser: (niveau, dureeMs) => {
      const maintenant = Date.now();
      if (maintenant - dernierTickRef.current < TICK_MIN_MS) return;
      dernierTickRef.current = maintenant;

      setHauteurs((precedentes) => {
        const hauteur = toVoiceWaveBarHeight(niveau, dureeMs, precedentes.length);
        const rognees = precedentes.length >= VOICE_WAVEFORM_MAX_BARS
          ? precedentes.slice(precedentes.length - VOICE_WAVEFORM_MAX_BARS + 1)
          : precedentes;
        const suivantes = [...rognees, hauteur];
        historiqueRef.current = suivantes;
        return suivantes;
      });
    },
    /**
     * Repart de zéro pour un nouvel enregistrement.
     * @returns {void}
     */
    reinitialiser: () => {
      historiqueRef.current = [];
      dernierTickRef.current = 0;
      setHauteurs(Array.from({ length: 14 }, (_, rang) => toVoiceWaveBarHeight(null, 0, rang)));
    },
  }), []);

  const visibles = hauteurs.slice(-VOICE_WAVEFORM_VISIBLE_BARS);

  return (
    <View
      // Les barres sont une image du son, pas une information : le lecteur
      // d'écran a déjà le libellé « Enregistrement vocal » et le chronomètre.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        alignItems: 'flex-end',
        flexDirection: 'row',
        height: 22,
        marginTop: 8,
        maxWidth: 190,
        overflow: 'hidden',
      }}
    >
      {visibles.map((hauteur, rang) => (
        <View
          // eslint-disable-next-line react/no-array-index-key
          key={`voice-level-bar-${rang}`}
          style={{
            backgroundColor: dimmed ? Colors.neutral300 : Colors.primary500,
            borderRadius: 2,
            height: Math.max(hauteur, VOICE_BAR_MIN_HEIGHT),
            marginRight: rang === visibles.length - 1 ? 0 : 2,
            opacity: (dimmed ? 0.45 : 0.35)
              + (((rang + 1) / Math.max(visibles.length, 1)) * (dimmed ? 0.35 : 0.65)),
            width: 3,
          }}
          testID={VOICE_LEVEL_BAR_TEST_ID}
        />
      ))}
    </View>
  );
});

export default VoiceLevelBars;
