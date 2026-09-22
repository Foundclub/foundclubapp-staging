import { createElement, createRef } from 'react';
import renderer, { act } from 'react-test-renderer';

import {
  VOICE_WAVEFORM_MAX_BARS,
  VOICE_WAVEFORM_VISIBLE_BARS,
} from '@/services/chat/voiceWaveform';

// MSGLIVE — LES BARRES DE NIVEAU, MESURÉES CHEZ ELLES.
//
// Ce fichier tient la moitié « fluidité » du lot. L'autre moitié est mesurée
// sur l'écran (`ConversationMSGLIVE.vocal.test.js`, qui compte les rendus).
//
// 📏 CE QUI A ÉTÉ MESURÉ AVANT LE LOT : cinq secondes de note vocale
// déclenchaient 101 rendus complets de l'écran de conversation — 7 400 lignes.
// Le micro rend compte dix fois par seconde et chacun de ses comptes rendus
// redessinait l'écran deux fois : une pour le chronomètre, alors que le libellé
// n'affiche que des secondes entières, une pour les barres.
//
// 🎯 CE QUE CES TÉMOINS VERROUILLENT ICI :
//   · le son fait vraiment bouger les hauteurs — fort et faible ne donnent pas
//     la même barre ;
//   · AUCUNE mesure n'est jetée au rythme réel du micro (50 ms). C'est le point
//     délicat : le frein interne doit rester SOUS ce rythme. S'il repassait
//     au-dessus, l'animation retomberait à dix images par seconde sans qu'un
//     seul autre témoin ne rougisse ;
//   · la fenêtre affichée reste bornée, et l'historique complet reste lisible
//     pour la forme d'onde du brouillon.

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const Colors = generateColors();
  return { __esModule: true, default: () => ({ Colors }) };
});

/**
 * Monte les barres et rend leur poignée.
 * @returns {{ arbre: any, poignee: any }} L'arbre monté et la poignée.
 */
const monterBarres = () => {
  // eslint-disable-next-line global-require
  const VoiceLevelBars = require('../VoiceLevelBars').default;
  const poignee = createRef();
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(VoiceLevelBars, { ref: poignee }));
  });
  return { arbre, poignee };
};

/**
 * Les hauteurs réellement affichées.
 * @param {any} arbre - L'arbre monté.
 * @returns {number[]} Les hauteurs, en pixels.
 */
const hauteurs = (arbre) => arbre.root
  .findAll(
    (/** @type {any} */ noeud) => noeud.props?.testID === 'voice-level-bar'
      && typeof noeud.type === 'string',
    { deep: true },
  )
  .map((/** @type {any} */ noeud) => Number(noeud.props.style?.height));

/**
 * Pousse des niveaux au rythme réel du micro.
 *
 * ⚠️ L'horloge avance POUR DE BON entre deux mesures : le composant freine en
 * lisant `Date.now()`. Sans ça, le témoin mesurerait le frein du test, pas
 * celui du code.
 * @param {any} poignee - La poignée des barres.
 * @param {number[]} niveaux - Les niveaux, en décibels.
 * @param {number} [pasMs] - L'écart entre deux mesures.
 * @returns {void}
 */
const pousserAuRythmeDuMicro = (poignee, niveaux, pasMs = 50) => {
  niveaux.forEach((niveau, rang) => {
    act(() => { jest.advanceTimersByTime(pasMs); });
    act(() => { poignee.current.pousser(niveau, (rang + 1) * pasMs); });
  });
};

describe('MSGLIVE — les barres de niveau du vocal', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  it('1. LE SON LES FAIT BOUGER : du silence et du bruit ne donnent pas la même barre', () => {
    const { arbre, poignee } = monterBarres();

    pousserAuRythmeDuMicro(poignee, [-120, -120, -120]);
    const dansLeSilence = hauteurs(arbre).slice(-1)[0];

    pousserAuRythmeDuMicro(poignee, [-5, -5, -5]);
    const dansLeBruit = hauteurs(arbre).slice(-1)[0];

    expect(dansLeBruit).toBeGreaterThan(dansLeSilence);
  });

  it('2. AU RYTHME RÉEL DU MICRO (50 ms), AUCUNE MESURE N\'EST JETÉE', () => {
    // Le cœur de la fluidité. Le micro parle toutes les 50 ms depuis ce lot
    // (`RECORDER_TICK_SECONDS`). Si le frein interne repassait au-dessus de
    // cette valeur, une mesure sur deux serait perdue et l'animation
    // retomberait à dix images par seconde — sans aucun témoin rouge ailleurs.
    const { arbre, poignee } = monterBarres();

    // Une rampe : chaque mesure a une hauteur différente de la précédente.
    const rampe = Array.from(
      { length: VOICE_WAVEFORM_VISIBLE_BARS },
      (_, rang) => -110 + (rang * 5),
    );
    pousserAuRythmeDuMicro(poignee, rampe);

    const affichees = hauteurs(arbre);
    expect(affichees).toHaveLength(VOICE_WAVEFORM_VISIBLE_BARS);
    // Une rampe montante reste montante si rien n'a été jeté.
    expect(affichees[affichees.length - 1]).toBeGreaterThan(affichees[0]);
    expect(new Set(affichees).size).toBeGreaterThan(VOICE_WAVEFORM_VISIBLE_BARS / 2);
  });

  it('3. LA FENÊTRE RESTE BORNÉE : un long vocal n\'empile pas les barres', () => {
    const { arbre, poignee } = monterBarres();

    pousserAuRythmeDuMicro(poignee, Array.from({ length: 200 }, (_, rang) => -100 + (rang % 40)));

    expect(hauteurs(arbre)).toHaveLength(VOICE_WAVEFORM_VISIBLE_BARS);
  });

  it('4. L\'HISTORIQUE RESTE LISIBLE, c\'est lui qui devient la forme d\'onde du brouillon', () => {
    const { poignee } = monterBarres();

    pousserAuRythmeDuMicro(poignee, Array.from({ length: 200 }, (_, rang) => -100 + (rang % 40)));

    const historique = poignee.current.lireHauteurs();
    expect(historique.length).toBeGreaterThan(VOICE_WAVEFORM_VISIBLE_BARS);
    expect(historique.length).toBeLessThanOrEqual(VOICE_WAVEFORM_MAX_BARS);
  });

  it('5. REPARTIR DE ZÉRO EFFACE VRAIMENT LE VOCAL PRÉCÉDENT', () => {
    const { poignee } = monterBarres();

    pousserAuRythmeDuMicro(poignee, Array.from({ length: 30 }, () => -20));
    expect(poignee.current.lireHauteurs().length).toBeGreaterThan(0);

    act(() => { poignee.current.reinitialiser(); });

    expect(poignee.current.lireHauteurs()).toHaveLength(0);
  });
});
