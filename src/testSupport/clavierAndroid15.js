import {
  DeviceEventEmitter, Platform, StyleSheet,
} from 'react-native';
import { act } from 'react-test-renderer';

// 🤖 ANDROIDBAR-3BIS — LE CLAVIER D'UN VRAI ANDROID 15 / 16, pour les écrans dont l'évitement
// du clavier n'est pas déjà prouvé par le témoin de `ScreenContainer`.
//
// La géométrie est celle que le lot ANDROIDBAR-3 a MESURÉE à l'émulateur le 13/10/2026
// (Pixel 9, Android 16, navigation à 3 boutons, Gboard ancré) : écran 2424 px à 2,625, barre
// d'état 142 px, haut du clavier à 1657 px. Les charges des événements sont celles qu'Android
// envoie réellement (ReactRootView.java) : à l'ouverture, la hauteur du clavier SANS la barre
// de navigation ; à la fermeture, la hauteur VISIBLE comme haut du clavier. Même table que
// `components/templates/__tests__/ScreenContainerANDROIDBAR3.clavier.test.js`.

export const DENSITE = 2.625;
export const ECRAN = 2424 / DENSITE;
export const BARRE_NAV = 48;
export const BARRE_ETAT = 142 / DENSITE;
export const HAUT_DU_CLAVIER = 1657 / DENSITE;

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

/**
 * Joue un téléphone : son système et sa version.
 * @param {'ios' | 'android'} systeme Le système.
 * @param {number | string} version `Platform.Version` (35 = Android 15).
 */
export const telephone = (systeme, version) => {
  Platform.OS = /** @type {any} */ (systeme);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
};

/** Rend le téléphone d'origine (à appeler après chaque témoin). */
export const telephoneDOrigine = () => {
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
};

/**
 * Clavier ouvert : la charge d'Android 11+ (clavier SANS la barre système).
 * @returns {Promise<void>}
 */
export const ouvrirLeClavier = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidShow', {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: (ECRAN - HAUT_DU_CLAVIER) - BARRE_NAV,
      screenX: 0,
      screenY: HAUT_DU_CLAVIER,
      width: 411,
    },
  });
});

/**
 * Clavier refermé : Android envoie la hauteur VISIBLE comme haut du clavier.
 * @returns {Promise<void>}
 */
export const refermerLeClavier = async () => act(async () => {
  DeviceEventEmitter.emit('keyboardDidHide', {
    duration: 0,
    easing: 'keyboard',
    endCoordinates: {
      height: 0, screenX: 0, screenY: ECRAN - BARRE_NAV - BARRE_ETAT, width: 411,
    },
  });
});

/**
 * Le BAS de la zone qui défile, à l'écran : l'écran moins les marges basses que posent tous
 * ses parents. C'est là qu'Android amène le champ qui prend la main quand la zone rétrécit :
 * s'il reste plus bas que le haut du clavier, le champ est dessous.
 * Hypothèse, celle des écrans visés : les parents partent du haut de l'écran et descendent
 * jusqu'en bas (en-tête transparent, bord à bord).
 * @param {any} defilement Le nœud de test de la ScrollView.
 * @returns {number} La position, en dp depuis le haut de l'écran.
 */
export const basDuDefilement = (defilement) => {
  let retire = 0;
  let noeud = defilement.parent;
  while (noeud) {
    if (typeof noeud.type === 'string') {
      const style = StyleSheet.flatten(noeud.props.style) || {};
      retire += Number(style.paddingBottom ?? style.paddingVertical ?? style.padding ?? 0);
    }
    noeud = noeud.parent;
  }
  return ECRAN - retire;
};
