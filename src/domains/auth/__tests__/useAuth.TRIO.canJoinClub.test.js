import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

// TRIO / POINT 1 — LE FILET D'ABORD (E6).
//
// `useAuth.js` fait 900 lignes, distribue TOUS les droits de l'application, et
// n'avait AUCUN test. Ce fichier est le premier : il ne mesure qu'une chose,
// la table « quel role obtient quel droit d'affiliation », parce que c'est elle
// que le lot deplace.
//
// LE DEFAUT, mesure le 2026-09-01 : `canJoinClub` valait `userRoleKey ===
// 'coach'`. Un DIRIGEANT recevait donc `false`, et la fiche club ne lui
// proposait que la REVENDICATION — celle qu'un SuperAdmin doit valider a la
// main. Or le serveur accepte les deux roles depuis le 2026-08-26 :
//   · `canClaimClubWithoutManager` = `isCoachRole(role) || isPresidentRole(role)`
//     (admin, api/club-membership-request/controllers/club-membership-request.ts) ;
//   · le Dirigeant declare `club-membership-request.create` depuis AB05
//     (admin, src/index.ts, « le seul verbe qui manquait au dirigeant etait
//     demander »).
// Le verrou etait donc cote app, et lui seul.
//
// ⛔ CE TEMOIN NE TESTE PAS UNE COPIE DE LA REGLE : il monte le VRAI hook et lit
// la valeur qu'il rend. `userData` entre par `auth.user` (useAuth.js : `userData
// = fullUserData || bootstrapData?.userSummary || auth?.user`), sans jeton, donc
// les deux requetes de demarrage restent eteintes.

const mockAppState = { auth: /** @type {any} */ (null), authSessions: [], isAddingAccount: false };

jest.mock('@/store/appContext', () => ({
  storage: { delete: jest.fn(), getAllKeys: () => [], set: jest.fn() },
  useAppContext: () => ([mockAppState, jest.fn()]),
}));

jest.mock('@/context/AppModeContext', () => ({ useAppMode: () => ({ isGold: false }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {string} */ repli) => repli || key,
  }),
}));

// Ces trois modules lisent `.env`, qui est gitignore donc absent de toute copie
// de travail : sans doublure, c'est la SUITE ENTIERE qui meurt au chargement.
jest.mock('@/services/auth/authService', () => ({
  deleteDeviceToken: jest.fn(),
  getMe: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  signInWithPhoneNumber: jest.fn(),
}));
jest.mock('@/services/bootstrap/bootstrapService', () => ({ getAppBootstrap: jest.fn() }));
jest.mock('@/services/bootRequestGuard', () => ({
  getRetryAfterSeconds: () => 0,
  resetBootRequestGuard: jest.fn(),
}));
jest.mock('@/hooks/useNotificationController', () => ({ UNREAD_COUNT_QUERY_KEY: ['unread'] }));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

const useAuth = require('@/domains/auth/useAuth').default;

/**
 * Monte le vrai hook avec le profil donne et rend ce qu'il expose.
 * @param {any} user - Le profil, tel que `auth.user` le porte.
 * @returns {any} La valeur de retour de `useAuth`.
 */
const lireLesDroits = (user) => {
  mockAppState.auth = { token: '', user };

  /** @type {any} */
  let vu = null;
  /**
   * La sonde : elle ne rend rien, elle capture ce que le hook expose.
   * @returns {null} Rien a afficher.
   */
  function Sonde() {
    vu = useAuth();
    return null;
  }

  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  /** @type {any} */
  let arbre = null;
  act(() => {
    arbre = renderer.create(
      React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(Sonde)),
    );
  });
  // ⛔ Toujours demonter : un arbre laisse vivant garde ses minuteries et fait
  // sortir Jest en erreur SANS aucun test rouge.
  act(() => { arbre.unmount(); });
  queryClient.clear();

  return vu;
};

describe('useAuth — qui peut dire « c\'est mon club ! »', () => {
  afterEach(() => {
    mockAppState.auth = null;
  });

  test('un DIRIGEANT obtient le bouton', () => {
    const droits = lireLesDroits({ documentId: 'u-1', role: { name: 'Dirigeant' } });
    expect(droits.canJoinClub).toBe(true);
  });

  test('un ENTRAINEUR le garde (non-regression)', () => {
    const droits = lireLesDroits({ documentId: 'u-2', role: { name: 'Entraineur' } });
    expect(droits.canJoinClub).toBe(true);
  });

  test('un JOUEUR ne l\'obtient pas', () => {
    expect(lireLesDroits({ documentId: 'u-3', role: { name: 'Joueur' } }).canJoinClub).toBe(false);
  });

  test('un compte SANS ROLE ne l\'obtient pas', () => {
    // 40 comptes sur 118 en production au 2026-08-13. Le serveur refuserait son
    // adhesion : lui ouvrir ce bouton lui promettrait un geste impossible.
    const droits = lireLesDroits({ documentId: 'u-4', role: { name: 'Authenticated' } });
    expect(droits.canJoinClub).toBe(false);
  });

  test('le vocabulaire est celui du fichier : « president » = Dirigeant', () => {
    // `canContactAdmin` est le voisin immediat de `canJoinClub` et n'est ouvert
    // qu'au dirigeant. Si les deux repondent vrai pour le meme profil, c'est
    // bien le meme mot qui a servi.
    const dirigeant = lireLesDroits({ documentId: 'u-5', role: { name: 'Dirigeant' } });
    expect(dirigeant.canContactAdmin).toBe(true);
    expect(dirigeant.canJoinClub).toBe(true);
  });
});
