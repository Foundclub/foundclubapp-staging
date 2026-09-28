import { useSyncExternalStore } from 'react';

import { storage } from '@/store/appContext';

/**
 * LOT RÔLES (demande d'Adel du 2026-09-28) — le MODE JOUEUR d'un dirigeant (ou
 * d'un entraîneur) qui joue aussi dans une équipe.
 *
 * 🧭 C'EST UN CHOIX D'AFFICHAGE, JAMAIS UN DROIT (décision 1 du lot) :
 *   · il vit dans le stockage LOCAL du téléphone, une clé par compte — il ne
 *     part jamais au serveur et ne touche pas `userData.role` ;
 *   · `useAuth` s'en sert pour ses jugements d'AFFICHAGE (gérer l'équipe, gérer
 *     les événements…) ; les portes de droits (`canEditClub`, `hasClubAccess`)
 *     et le serveur ne le voient pas.
 *
 * Un magasin de module (et non un contexte) : tous les écrans qui lisent
 * `useAuth` basculent ensemble, sans fournisseur à poser dans l'arbre.
 */

const KEY_PREFIX = 'user.player_mode.';
const ENABLED_VALUE = 'on';

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * La clé de stockage d'un compte.
 * @param {unknown} documentId - Le compte.
 * @returns {string} La clé de stockage de ce compte, ou '' sans compte.
 */
const keyFor = (documentId) => {
  const id = String(documentId || '').trim();
  return id ? `${KEY_PREFIX}${id}` : '';
};

/**
 * Le compte a-t-il demandé à voir l'app en joueur ?
 * @param {unknown} documentId - Le compte.
 * @returns {boolean} Vrai si le mode est demandé.
 */
export const readPlayerModeRequest = (documentId) => {
  const key = keyFor(documentId);
  if (!key) return false;
  try {
    return storage.getString(key) === ENABLED_VALUE;
  } catch {
    // Stockage indisponible : l'app reste en mode normal, rien ne casse.
    return false;
  }
};

/**
 * Demander (ou quitter) le mode joueur pour ce compte, et prévenir les écrans.
 * @param {unknown} documentId - Le compte.
 * @param {boolean} enabled - Vrai pour voir l'app en joueur.
 * @returns {void}
 */
export const writePlayerModeRequest = (documentId, enabled) => {
  const key = keyFor(documentId);
  if (!key) return;
  try {
    if (enabled) {
      storage.set(key, ENABLED_VALUE);
    } else {
      storage.delete(key);
    }
  } catch {
    // Stockage indisponible : le choix ne survivra pas au redémarrage, c'est tout.
  }
  listeners.forEach((listener) => listener());
};

/**
 * S'abonner aux changements de mode (pour `useSyncExternalStore`).
 * @param {() => void} listener - Rappel de changement.
 * @returns {() => void} Désabonnement.
 */
const subscribe = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Le mode demandé par ce compte, et le re-rendu quand il change.
 * @param {unknown} documentId - Le compte.
 * @returns {boolean} Vrai si le mode est demandé.
 */
export const usePlayerModeRequest = (documentId) => useSyncExternalStore(
  subscribe,
  () => readPlayerModeRequest(documentId),
  () => false,
);

/** Les rôles de compte qui ont quelque chose à « quitter » pour voir l'app en joueur. */
export const PLAYER_MODE_ACCOUNT_ROLES = Object.freeze(['president', 'coach']);

/**
 * Le mode joueur a-t-il un sens pour ce compte ? Il faut encadrer (dirigeant ou
 * entraîneur) ET jouer dans au moins une équipe — sinon il n'y aurait rien à voir.
 * @param {string} accountRoleKey - Le rôle du COMPTE (`getUserRoleKey`).
 * @param {{ myTeams?: unknown[] } | null | undefined} userData - Le profil.
 * @returns {boolean} Vrai si le mode peut être proposé.
 */
export const canUsePlayerMode = (accountRoleKey, userData) => {
  const myTeams = userData?.myTeams;
  return PLAYER_MODE_ACCOUNT_ROLES.includes(accountRoleKey)
    && Array.isArray(myTeams)
    && myTeams.length > 0;
};

/**
 * Le rôle d'AFFICHAGE : `player` quand le mode est demandé ET possible, sinon
 * le rôle du compte.
 * @param {{
 *   accountRoleKey: string,
 *   isPlayerModeRequested: boolean,
 *   userData: { myTeams?: unknown[] } | null | undefined,
 * }} input - Le rôle du compte, la demande, le profil.
 * @returns {string} Le rôle d'affichage.
 */
export const resolveDisplayRoleKey = ({ accountRoleKey, isPlayerModeRequested, userData }) => (
  isPlayerModeRequested && canUsePlayerMode(accountRoleKey, userData) ? 'player' : accountRoleKey
);
