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
 *
 * PAR-L12 (13/10, design parent §2 bis / E25, décision D6 A d'Adel du 12/10) — LE MODE PARENT.
 * Le choix d'affichage a désormais TROIS positions : le rôle du compte (rien de demandé),
 * « joueur », « parent ». Même clé, même règle : un affichage, jamais un droit. « on » garde
 * son sens (le mode joueur des versions installées) ; « parent » s'y ajoute, sans migration.
 * 🧪 Témoins : `__tests__/playerMode.caracterisation.test.js` (l'existant, écrit avant),
 * `__tests__/playerMode.L12.modeParent.test.js` (le mode parent).
 */

const KEY_PREFIX = 'user.player_mode.';
const ENABLED_VALUE = 'on';
const PARENT_VALUE = 'parent';

/** @typedef {'player' | 'parent' | null} DisplayModeRequest */

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
 * PAR-L12 — Le mode d'affichage demandé par ce compte.
 * @param {unknown} documentId - Le compte.
 * @returns {DisplayModeRequest} « player », « parent », ou rien (le rôle du compte).
 */
export const readDisplayModeRequest = (documentId) => {
  const key = keyFor(documentId);
  if (!key) return null;
  try {
    const valeur = storage.getString(key);
    if (valeur === ENABLED_VALUE) return 'player';
    if (valeur === PARENT_VALUE) return 'parent';
    return null;
  } catch {
    // Stockage indisponible : l'app reste sur le rôle du compte, rien ne casse.
    return null;
  }
};

/**
 * Le compte a-t-il demandé à voir l'app en joueur ?
 * @param {unknown} documentId - Le compte.
 * @returns {boolean} Vrai si le mode est demandé.
 */
export const readPlayerModeRequest = (documentId) => (
  readDisplayModeRequest(documentId) === 'player'
);

/**
 * PAR-L12 — Demander un mode d'affichage (ou revenir au rôle du compte), et prévenir les écrans.
 * @param {unknown} documentId - Le compte.
 * @param {DisplayModeRequest} mode - « player », « parent », ou rien pour revenir.
 * @returns {void}
 */
export const writeDisplayModeRequest = (documentId, mode) => {
  const key = keyFor(documentId);
  if (!key) return;
  try {
    if (mode === 'player') {
      storage.set(key, ENABLED_VALUE);
    } else if (mode === 'parent') {
      storage.set(key, PARENT_VALUE);
    } else {
      storage.delete(key);
    }
  } catch {
    // Stockage indisponible : le choix ne survivra pas au redémarrage, c'est tout.
  }
  listeners.forEach((listener) => listener());
};

/**
 * Demander (ou quitter) le mode joueur pour ce compte, et prévenir les écrans.
 * @param {unknown} documentId - Le compte.
 * @param {boolean} enabled - Vrai pour voir l'app en joueur.
 * @returns {void}
 */
export const writePlayerModeRequest = (documentId, enabled) => writeDisplayModeRequest(
  documentId,
  enabled ? 'player' : null,
);

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

/**
 * PAR-L12 — Le mode d'affichage demandé par ce compte, et le re-rendu quand il change.
 * @param {unknown} documentId - Le compte.
 * @returns {DisplayModeRequest} « player », « parent », ou rien.
 */
export const useDisplayModeRequest = (documentId) => useSyncExternalStore(
  subscribe,
  () => readDisplayModeRequest(documentId),
  () => null,
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
 * PAR-L12 — Les rôles qui ont un rôle SPORTIF à quitter pour voir l'app en parent. Le compte
 * Parent y est déjà ; le super admin et un compte neuf n'ont pas d'enfant dans l'app (le serveur
 * ne leur ouvre pas les fiches). Avoir des enfants se vérifie à l'écran qui les lit (l'accueil
 * ne propose le mode qu'à un compte qui en a) : ici, seul le rôle compte.
 */
export const PARENT_MODE_ACCOUNT_ROLES = Object.freeze(['player', 'coach', 'president']);

/**
 * Le mode parent a-t-il un sens pour ce rôle de compte ?
 * @param {unknown} accountRoleKey - Le rôle du COMPTE (`getUserRoleKey`).
 * @returns {boolean} Vrai pour un joueur, un entraîneur ou un dirigeant.
 */
export const canUseParentMode = (accountRoleKey) => PARENT_MODE_ACCOUNT_ROLES
  .includes(/** @type {any} */ (accountRoleKey));

/**
 * Le rôle d'AFFICHAGE : `player` ou `parent` quand ce mode est demandé ET possible, sinon le
 * rôle du compte. `isPlayerModeRequested` reste lu (l'appel d'avant L12) quand
 * `displayModeRequest` n'est pas donné.
 * @param {{
 *   accountRoleKey: string,
 *   displayModeRequest?: DisplayModeRequest,
 *   isPlayerModeRequested?: boolean,
 *   userData: { myTeams?: unknown[] } | null | undefined,
 * }} input - Le rôle du compte, la demande, le profil.
 * @returns {string} Le rôle d'affichage.
 */
export const resolveDisplayRoleKey = ({
  accountRoleKey, displayModeRequest, isPlayerModeRequested, userData,
}) => {
  let demande = displayModeRequest;
  if (demande === undefined) demande = isPlayerModeRequested ? 'player' : null;
  if (demande === 'player' && canUsePlayerMode(accountRoleKey, userData)) return 'player';
  if (demande === 'parent' && canUseParentMode(accountRoleKey)) return 'parent';
  return accountRoleKey;
};
