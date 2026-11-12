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
 * ACCUEIL-JOUEUR (09/11/2026, retour d'un vrai joueur relayé par Adel) — L'ORIGINE PARENT.
 * La bascule parent de l'accueil ne s'offre qu'à un compte né Parent ; or un Parent qui
 * « pratique aussi » devient Joueur sur le serveur (`FeuillePratiqueAussi`), qui n'en garde aucune
 * trace. L'origine se garde donc ici, sur le téléphone, à côté du mode d'affichage.
 * ponytail: stockage local, comme le mode lui-même. Limite : un téléphone neuf l'oublie ; le
 * compte garde alors « Basculer en mode parent » dans « Mon compte » (rien n'est perdu). Sortie :
 * un champ du profil côté serveur, si Adel le veut.
 * 🧪 Témoin : `__tests__/playerMode.ACCUEILJOUEUR.origineParent.test.js`.
 * ponytail: depuis T9-RETOURS-B (12/11, Adel « 284 »), l'origine ne décide plus la bascule
 * (`offersParentSwitch`) ; elle reste écrite, sans effet, pour ne pas toucher
 * `FeuillePratiqueAussi` dans ce lot. Sortie : la retirer avec ses écritures.
 */
const ORIGIN_PREFIX = 'user.parent_origin.';

/** @typedef {'parent' | 'player'} ParentOrigin */

/**
 * La clé de l'origine d'un compte.
 * @param {unknown} documentId - Le compte.
 * @returns {string} La clé, ou '' sans compte.
 */
const originKeyFor = (documentId) => {
  const id = String(documentId || '').trim();
  return id ? `${ORIGIN_PREFIX}${id}` : '';
};

/**
 * L'origine écrite de ce compte, sinon celle qu'on en déduit : un ancien compte en mode parent
 * en ce moment (le seul signe qui reste d'un Parent devenu Joueur) est né Parent.
 * @param {unknown} documentId - Le compte.
 * @returns {ParentOrigin} « parent » ou « player ».
 */
export const readParentOrigin = (documentId) => {
  const key = originKeyFor(documentId);
  try {
    const ecrite = key ? storage.getString(key) : undefined;
    if (ecrite === 'parent' || ecrite === 'player') return ecrite;
  } catch {
    // Stockage indisponible : la déduction ci-dessous.
  }
  return readDisplayModeRequest(documentId) === 'parent' ? 'parent' : 'player';
};

/**
 * Écrire l'origine de ce compte, et prévenir les écrans.
 * @param {unknown} documentId - Le compte.
 * @param {ParentOrigin} origin - « parent » ou « player ».
 * @returns {void}
 */
export const writeParentOrigin = (documentId, origin) => {
  const key = originKeyFor(documentId);
  if (!key) return;
  try {
    storage.set(key, origin);
  } catch {
    // Stockage indisponible : la déduction de `readParentOrigin` reste.
  }
  listeners.forEach((listener) => listener());
};

/**
 * Figer l'origine d'un compte Joueur avant qu'un changement de mode n'efface le seul signe qui
 * la dit. Les autres rôles n'en ont pas besoin : rien n'est écrit pour eux.
 * @param {unknown} documentId - Le compte.
 * @param {unknown} accountRoleKey - Le rôle du COMPTE.
 * @returns {void}
 */
const figerOrigine = (documentId, accountRoleKey) => {
  const key = originKeyFor(documentId);
  if (!key || accountRoleKey !== 'player') return;
  try {
    if (!storage.getString(key)) storage.set(key, readParentOrigin(documentId));
  } catch {
    // Stockage indisponible : le mode ne s'écrira pas non plus.
  }
};

/**
 * PAR-L12 — Demander un mode d'affichage (ou revenir au rôle du compte), et prévenir les écrans.
 * ACCUEIL-JOUEUR — `accountRoleKey` : pour un compte Joueur, l'origine se FIGE avant le premier
 * changement de mode (après, le mode ne dit plus d'où il vient).
 * @param {unknown} documentId - Le compte.
 * @param {DisplayModeRequest} mode - « player », « parent », ou rien pour revenir.
 * @param {unknown} [accountRoleKey] - Le rôle du COMPTE.
 * @returns {void}
 */
export const writeDisplayModeRequest = (documentId, mode, accountRoleKey) => {
  const key = keyFor(documentId);
  if (!key) return;
  figerOrigine(documentId, accountRoleKey);
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
 * ACCUEIL-JOUEUR — L'origine de ce compte, et le re-rendu quand elle change.
 * @param {unknown} documentId - Le compte.
 * @returns {ParentOrigin} « parent » ou « player ».
 */
export const useParentOrigin = (documentId) => useSyncExternalStore(
  subscribe,
  () => readParentOrigin(documentId),
  () => 'player',
);

/**
 * La bascule parent de l'accueil s'offre-t-elle à ce rôle ? Les appelants y ajoutent « au moins
 * un enfant » (`useMesEnfantsEnBref` : fiches déclarées + liens parent, déjà lus par l'accueil).
 * T9-RETOURS-B (12/11/2026, M1207, règle d'Adel « 284 ») : un compte Joueur qui a au moins un
 * enfant voit « Ton mode : Parent | Joueur » dans les deux modes, d'où qu'il vienne. Avant
 * (ACCUEIL-JOUEUR, 09/11) : seulement s'il était né Parent ou en mode parent, et toucher
 * « Joueur » effaçait la bascule. L'origine (`readParentOrigin`) ne décide plus rien ici.
 * 🧪 `__tests__/playerMode.T9RETOURSB.test.js`.
 * @param {{ accountRoleKey: unknown }} input - Le rôle du compte.
 * @returns {boolean} Vrai si le rôle a droit à la bascule.
 */
export const offersParentSwitch = ({ accountRoleKey }) => canUseParentMode(accountRoleKey);

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
