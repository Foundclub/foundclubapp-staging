import { useCallback, useSyncExternalStore } from 'react';

import { getItem, setItem } from '@/platform/storage';

// VOCAL — LE POINT « NON ÉCOUTÉ » D'UN VOCAL REÇU, tenu SUR CE TÉLÉPHONE.
//
// 🧭 POURQUOI LOCAL (question 1 de la maquette, posée à Adel le 23/09) : le
// point sur MES vocaux exigerait un accusé d'écoute côté serveur. En
// attendant sa réponse, le chemin le plus sûr est celui que la maquette
// prévoit sans serveur : un point seulement sur les vocaux des AUTRES, qui
// s'éteint quand je lance la lecture, et dont on se souvient ici.
//
// 🪤 LE PIÈGE DU PREMIER LANCEMENT : sans précaution, tous les vocaux reçus
// AVANT cette version s'allumeraient d'un coup, y compris ceux écoutés depuis
// des semaines. On retient donc le jour où ce magasin a servi pour la
// première fois : un vocal plus ancien est réputé écouté.

const CLE_ECOUTES = 'fc:voice:listened';
const CLE_DEPUIS = 'fc:voice:listenedSince';
/** On ne garde que les derniers vocaux écoutés : assez pour tous les fils ouverts. */
const PLAFOND = 500;

/** @type {string[] | null} */
let ecoutes = null;
/** @type {number | null} */
let depuis = null;
const abonnes = new Set();
let version = 0;

/**
 * Charge le magasin depuis le stockage du téléphone, une seule fois.
 * @returns {void}
 */
const charger = () => {
  if (ecoutes !== null) return;
  try {
    const brut = JSON.parse(getItem(CLE_ECOUTES) || '[]');
    ecoutes = Array.isArray(brut) ? brut.map(String) : [];
  } catch (_erreur) {
    ecoutes = [];
  }
  const memorise = Number(getItem(CLE_DEPUIS));
  if (Number.isFinite(memorise) && memorise > 0) {
    depuis = memorise;
  } else {
    depuis = Date.now();
    try { setItem(CLE_DEPUIS, String(depuis)); } catch (_erreur) { /* mémoire seule */ }
  }
};

/**
 * Ce vocal reçu attend-il encore d'être écouté ?
 * @param {string} idMessage - L'identifiant du message.
 * @param {unknown} creeLe - La date du message.
 * @returns {boolean} true si le point doit s'afficher.
 */
export const isVoiceUnlistened = (idMessage, creeLe) => {
  if (!idMessage) return false;
  charger();
  const date = new Date(/** @type {any} */ (creeLe)).getTime();
  if (!Number.isFinite(date) || date < /** @type {number} */ (depuis)) return false;
  const liste = ecoutes || [];
  return !liste.includes(String(idMessage));
};

/**
 * Retient qu'un vocal a été écouté (sa lecture a démarré).
 * @param {string} idMessage - L'identifiant du message.
 * @returns {void}
 */
export const markVoiceListened = (idMessage) => {
  if (!idMessage) return;
  charger();
  const liste = /** @type {string[]} */ (ecoutes);
  if (liste.includes(String(idMessage))) return;
  ecoutes = [...liste, String(idMessage)].slice(-PLAFOND);
  try { setItem(CLE_ECOUTES, JSON.stringify(ecoutes)); } catch (_erreur) { /* mémoire seule */ }
  version += 1;
  abonnes.forEach((abonne) => abonne());
};

/**
 * @param {() => void} abonne - Prévenu à chaque vocal écouté.
 * @returns {() => void} Le désabonnement.
 */
const sAbonner = (abonne) => {
  abonnes.add(abonne);
  return () => { abonnes.delete(abonne); };
};

/**
 * Le point « non écouté » d'un vocal, et de quoi l'éteindre.
 * @param {string} idMessage - L'identifiant du message.
 * @param {unknown} creeLe - La date du message.
 * @returns {[boolean, () => void]} Le point, et « c'est écouté ».
 */
export const useVoiceListened = (idMessage, creeLe) => {
  useSyncExternalStore(sAbonner, () => version);
  const marquer = useCallback(() => markVoiceListened(idMessage), [idMessage]);
  return [isVoiceUnlistened(idMessage, creeLe), marquer];
};

/**
 * Pour les témoins : repart d'un téléphone neuf.
 * @returns {void}
 */
export const resetVoiceListenedStoreForTests = () => {
  ecoutes = null;
  depuis = null;
  version = 0;
};
