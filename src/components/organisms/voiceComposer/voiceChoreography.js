import {
  cancelAnimation,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { VOICE_MIC_HOLD_SCALE } from './VoiceActionButton';
import {
  easeIn,
  easeOut,
  snappy,
  VOICE_EASE_IN_OUT,
} from './voiceMotion';

// VOCAL — LA CHORÉGRAPHIE DE LA BARRE (maquette, section « Mouvement »).
//
// Chaque passage d'un moment à l'autre est une fonction, et chaque ligne d'une
// fonction est une ligne du tableau de la planche : élément, propriété, durée,
// courbe. Les valeurs animées vivent dans la boîte partagée de la zone ; ces
// fonctions ne font que leur donner une destination. « Réduire les
// animations » : les boucles sont coupées, les ressorts deviennent 160 ms
// easeOut — l'onde et le remplissage restent, ce sont des informations.

/**
 * Une boucle sinusoïdale 0 → cible → 0 (le balancement de l'indice, du chevron).
 * @param {number} cible - Le point le plus loin.
 * @param {number} cycle - La durée d'un aller-retour.
 * @returns {any} L'animation.
 */
const balancement = (cible, cycle) => withRepeat(withSequence(
  withTiming(cible, { duration: cycle / 2, easing: VOICE_EASE_IN_OUT }),
  withTiming(0, { duration: cycle / 2, easing: VOICE_EASE_IN_OUT }),
), -1);

/**
 * Coupe les boucles (point, indice, chevron) et les pose au repos.
 * @param {any} m - Les valeurs animées.
 * @returns {void}
 */
export const arreterBoucles = (m) => {
  const { balancier, chevron, point } = m;
  cancelAnimation(point);
  cancelAnimation(balancier);
  cancelAnimation(chevron);
  balancier.value = 0;
  chevron.value = 0;
};

/**
 * 1 → 2 · appui maintenu 200 ms : la barre devient l'enregistrement.
 * @param {any} m - Les valeurs animées.
 * @param {boolean} reduire - Le réglage « réduire les animations ».
 * @returns {void}
 */
export const allerMaintien = (m, reduire) => {
  const {
    balancier, bande, bandeDecalage, bandeGauche, cadenas, cadenasFerme, cadenasRepli,
    cadenasTy, chevron, corbeille, echelle, envoyer, halo, indice, indiceArrete,
    indiceLargeur, ondeRepli, point, repos, rouge, tx, ty,
  } = m;
  tx.value = 0;
  ty.value = 0;
  indiceArrete.value = 0;
  envoyer.value = 0;
  // Micro : scale 1 → 1,45 (ressort), fond cyan → rouge (160 ms easeOut).
  echelle.value = snappy(VOICE_MIC_HOLD_SCALE, reduire);
  rouge.value = easeOut(1, 160);
  halo.value = easeOut(1, 160);
  // + et champ : opacity → 0, translateX → −12 (140 ms easeIn).
  repos.value = easeIn(1, 140);
  // Bande : opacity 0 → 1, translateX 12 → 0 (200 ms, délai 60, easeOut).
  bandeGauche.value = 0;
  bande.value = 0;
  bandeDecalage.value = 12;
  bande.value = withDelay(60, easeOut(1, 200));
  bandeDecalage.value = withDelay(60, easeOut(0, 200));
  ondeRepli.value = 0;
  corbeille.value = 0;
  // Indice : opacity 0 → 1 (200 ms, délai 200).
  indiceLargeur.value = 1;
  indice.value = 0;
  indice.value = withDelay(200, easeOut(1, 200));
  // Cadenas : opacity 0 → 1, translateY 16 → 0 (350 ms, délai 120, easeOut).
  cadenasFerme.value = 0;
  cadenasRepli.value = 0;
  cadenas.value = 0;
  cadenasTy.value = 16;
  cadenas.value = withDelay(120, easeOut(1, 200));
  cadenasTy.value = withDelay(120, easeOut(0, 350));
  // Pendant l'appui : point 1 ↔ 0,25 (500 ms par demi-cycle), indice −6 px
  // (1 400 ms), chevron −4 px (1 200 ms) — sauf si le téléphone réduit les animations.
  point.value = 1;
  if (!reduire) {
    point.value = withRepeat(withTiming(0.25, { duration: 500, easing: VOICE_EASE_IN_OUT }), -1, true);
    balancier.value = balancement(-6, 1400);
    chevron.value = balancement(-4, 1200);
  }
};

/**
 * Le micro revient à sa place : translate → 0, scale → 1 (ressort), fond → cyan.
 * @param {any} m - Les valeurs animées.
 * @param {boolean} reduire - Le réglage « réduire les animations ».
 * @returns {void}
 */
const ramenerMicro = (m, reduire) => {
  const {
    echelle, halo, rouge, tx, ty,
  } = m;
  tx.value = snappy(0, reduire);
  ty.value = snappy(0, reduire);
  echelle.value = snappy(1, reduire);
  rouge.value = easeOut(0, 160);
  halo.value = easeOut(0, 160);
};

/**
 * Le cadenas s'en va : opacity → 0, translateY → 16 (160 ms easeIn).
 * @param {any} m - Les valeurs animées.
 * @returns {void}
 */
const cacherCadenas = (m) => {
  const { cadenas, cadenasTy } = m;
  cadenas.value = easeIn(0, 160);
  cadenasTy.value = easeIn(16, 160);
};

/**
 * Seuil −120 px · annulé, sans attendre le relâché.
 * @param {any} m - Les valeurs animées.
 * @param {boolean} reduire - Le réglage « réduire les animations ».
 * @returns {void}
 */
export const annuler = (m, reduire) => {
  const {
    bande, corbeille, corbeilleEchelle, indice, ondeRepli, point, repos,
  } = m;
  arreterBoucles(m);
  // Barres : scaleY 1 → 0,1, opacity → 0 (120 ms easeIn).
  ondeRepli.value = easeIn(1, 120);
  // Point → corbeille : TrashAlt 18, scale 0,6 → 1 (ressort), puis s'efface à 240 ms.
  point.value = withTiming(0, { duration: 100 });
  corbeilleEchelle.value = 0.6;
  corbeilleEchelle.value = snappy(1, reduire);
  corbeille.value = 1;
  corbeille.value = withDelay(240, easeIn(0, 160));
  ramenerMicro(m, reduire);
  cacherCadenas(m);
  indice.value = easeIn(0, 120);
  // Bande → + et champ : 160 ms / 200 ms, délai 240.
  bande.value = withDelay(240, easeIn(0, 160));
  repos.value = withDelay(240, easeOut(0, 200));
};

/**
 * Seuil −80 px · verrouillé (2 → 3A) : mains libres.
 * @param {any} m - Les valeurs animées.
 * @param {boolean} reduire - Le réglage « réduire les animations ».
 * @returns {void}
 */
export const verrouiller = (m, reduire) => {
  const {
    balancier, bandeGauche, cadenas, cadenasFerme, cadenasRepli, chevron, envoyer, indice,
    indiceLargeur, stop, stopEchelle, supprimer, supprimerEchelle,
  } = m;
  cancelAnimation(balancier);
  cancelAnimation(chevron);
  ramenerMicro(m, reduire);
  // Micro → Envoyer : glyphe micro → Send (fondu + rotation −30° → 0).
  envoyer.value = snappy(1, reduire);
  // Anse : Unlock → Lock (120 ms) ; cadenas replié à 44 puis effacé.
  cadenasFerme.value = easeOut(1, 120);
  cadenasRepli.value = snappy(1, reduire);
  cadenas.value = withDelay(140, easeIn(0, 160));
  // Cadenas → Stop : opacity 0 → 1, scale 0,8 → 1 (délai 160).
  stop.value = 0;
  stopEchelle.value = 0.8;
  stop.value = withDelay(160, easeOut(1, 160));
  stopEchelle.value = withDelay(160, snappy(1, reduire));
  // + → Supprimer : opacity 0 → 1, scale 0,8 → 1 (200 ms easeOut).
  supprimer.value = 0;
  supprimerEchelle.value = 0.8;
  supprimer.value = easeOut(1, 200);
  supprimerEchelle.value = easeOut(1, 200);
  // Indice : opacity → 0 (120 ms), largeur → 0 (240 ms) ; bande x 12 → 64 (240 ms).
  indice.value = easeIn(0, 120);
  indiceLargeur.value = easeOut(0, 240);
  bandeGauche.value = easeOut(52, 240);
};

/**
 * Envoi (relâché ou Envoyer) ou Supprimer : tout rentre, le + et le champ reviennent.
 * @param {any} m - Les valeurs animées.
 * @param {boolean} reduire - Le réglage « réduire les animations ».
 * @param {number} delai - Le délai avant le retour du + et du champ (80 après Supprimer).
 * @returns {void}
 */
export const revenir = (m, reduire, delai) => {
  const {
    bande, envoyer, pastille, repos, stop, stopEchelle, supprimer, supprimerEchelle,
  } = m;
  arreterBoucles(m);
  bande.value = easeIn(0, 160);
  pastille.value = easeIn(0, 160);
  supprimer.value = easeIn(0, 160);
  supprimerEchelle.value = easeIn(0.8, 160);
  stop.value = easeIn(0, 160);
  stopEchelle.value = easeIn(0.6, 160);
  cacherCadenas(m);
  ramenerMicro(m, reduire);
  // Envoyer → micro (120 ms) ; + et champ : opacity 0 → 1, translateX −12 → 0 (200 ms).
  envoyer.value = easeOut(0, 120);
  repos.value = withDelay(delai, easeOut(0, 200));
};

/**
 * Stop → réécoute (3A → 3B) : la bande laisse place à la pastille.
 * @param {any} m - Les valeurs animées.
 * @returns {void}
 */
export const versReecoute = (m) => {
  const {
    bande, pastille, stop, stopEchelle,
  } = m;
  arreterBoucles(m);
  // Stop : opacity → 0, scale → 0,6 (160 ms easeIn).
  stop.value = easeIn(0, 160);
  stopEchelle.value = easeIn(0.6, 160);
  // Bande → pastille : fondu croisé 160 / 200 ms.
  bande.value = easeIn(0, 160);
  pastille.value = easeOut(1, 200);
};
