import { useSyncExternalStore } from 'react';

import { storage } from '@/store/appContext';

/**
 * LE MODE COMPLEXE — RESA-L5A1 (13/10/2026), planche RB, AT-01 (« bascule ok », Adel 13/10
 * ~13h20) : UN compte, UN numéro, une bascule « mode complexe / mode joueur ».
 *
 * 🧭 C'EST UN CHOIX D'AFFICHAGE, JAMAIS UN DROIT (comme le mode joueur,
 * `domains/auth/playerMode.js`, dont ce module reprend la forme) :
 *   · il vit dans le stockage LOCAL du téléphone, une clé par compte — il ne part jamais au
 *     serveur ; le droit de gérer, c'est la relation `gestionnaires` du complexe, que le serveur
 *     vérifie à chaque appel ;
 *   · allumé, l'app s'ouvre sur l'espace du complexe (`PrivateNavigator`, écran d'arrivée) ;
 *     éteint, sur l'accueil habituel du compte.
 *
 * Un magasin de module (et non un contexte) : tous les écrans qui le lisent basculent ensemble.
 */

const PREFIXE = 'user.complexe_mode.';
const ALLUME = 'on';

/** @type {Set<() => void>} */
const abonnes = new Set();

/**
 * La clé de stockage d'un compte.
 * @param {unknown} compteId - Le documentId du compte.
 * @returns {string} La clé, ou '' sans compte.
 */
const cleDu = (compteId) => {
  const id = String(compteId || '').trim();
  return id ? `${PREFIXE}${id}` : '';
};

/**
 * Le compte a-t-il choisi le mode complexe sur ce téléphone ?
 * @param {unknown} compteId - Le documentId du compte.
 * @returns {boolean} Vrai si le mode complexe est choisi.
 */
export const lireModeComplexe = (compteId) => {
  const cle = cleDu(compteId);
  if (!cle) return false;
  try {
    return storage.getString(cle) === ALLUME;
  } catch {
    // Stockage indisponible : l'app reste sur l'accueil habituel, rien ne casse.
    return false;
  }
};

/**
 * Choisir (ou quitter) le mode complexe pour ce compte, et prévenir les écrans.
 * @param {unknown} compteId - Le documentId du compte.
 * @param {boolean} allume - Vrai pour le mode complexe.
 * @returns {void}
 */
export const ecrireModeComplexe = (compteId, allume) => {
  const cle = cleDu(compteId);
  if (!cle) return;
  try {
    if (allume) storage.set(cle, ALLUME);
    else storage.delete(cle);
  } catch {
    // Stockage indisponible : le choix ne survivra pas au redémarrage, c'est tout.
  }
  abonnes.forEach((abonne) => abonne());
};

/**
 * S'abonner aux changements (pour `useSyncExternalStore`).
 * @param {() => void} abonne - Rappel de changement.
 * @returns {() => void} Désabonnement.
 */
const sAbonner = (abonne) => {
  abonnes.add(abonne);
  return () => {
    abonnes.delete(abonne);
  };
};

/**
 * Le mode choisi par ce compte, et le re-rendu quand il change.
 * @param {unknown} compteId - Le documentId du compte.
 * @returns {boolean} Vrai si le mode complexe est choisi.
 */
export const useModeComplexe = (compteId) => useSyncExternalStore(
  sAbonner,
  () => lireModeComplexe(compteId),
  () => false,
);
