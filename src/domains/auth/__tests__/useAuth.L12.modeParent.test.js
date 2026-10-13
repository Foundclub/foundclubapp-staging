import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

// PAR-L12 (13/10, design parent §2 bis / E25, décision D6 A d'Adel du 12/10) — LE MODE PARENT,
// mesuré sur le VRAI `useAuth` (même montage que `useAuth.ROLES.modeJoueur.test.js`, dont ce
// fichier reprend le socle mot pour mot). Ce qui bascule : l'accueil et le profil lisent
// « parent » ; ce qui NE BOUGE PAS : le rôle du compte, les droits, et aucun appel réseau.
// Écrit ROUGE (`isParentMode` / `setDisplayMode` n'existaient pas).

const mockStockage = new Map();
const mockAppState = { auth: /** @type {any} */ (null), authSessions: [], isAddingAccount: false };

jest.mock('@/store/appContext', () => ({
  storage: {
    delete: jest.fn((/** @type {string} */ cle) => mockStockage.delete(cle)),
    getAllKeys: () => [...mockStockage.keys()],
    getBoolean: () => false,
    getString: jest.fn((/** @type {string} */ cle) => mockStockage.get(cle)),
    set: jest.fn(
      (/** @type {string} */ cle, /** @type {any} */ valeur) => mockStockage.set(cle, valeur),
    ),
  },
  useAppContext: () => ([mockAppState, jest.fn()]),
}));

jest.mock('@/context/AppModeContext', () => ({ useAppMode: () => ({ isGold: false }) }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {string} */ repli) => repli || key,
  }),
}));

// Ces modules lisent `.env` (absent des copies de travail) : sans doublure, la
// suite ENTIÈRE meurt au chargement. Ce sont aussi les points d'observation du
// réseau : aucun ne doit être appelé par la bascule.
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
jest.mock('@/services/teamInvite/teamInviteShare', () => ({ shareTeamInviteLink: jest.fn() }));

const { storage } = require('@/store/appContext');

const authService = require('@/services/auth/authService');
const useAuth = require('@/domains/auth/useAuth').default;

const DIRIGEANT_JOUEUR = {
  club: { documentId: 'club-1' },
  documentId: 'dir-1',
  myTeams: [{ documentId: 'team-u15' }],
  role: { name: 'Dirigeant' },
  trainedTeams: [{ documentId: 'team-seniors' }],
};

/**
 * Monte le vrai hook, laisse `agir` manipuler ce qu'il expose, et rend ce qu'il
 * expose au rendu suivant.
 * @param {any} user - Le profil, tel que `auth.user` le porte.
 * @param {(vu: any) => void} [agir] - Un geste sur la valeur rendue.
 * @returns {any} La valeur de retour de `useAuth` après le geste.
 */
const lire = (user, agir) => {
  mockAppState.auth = { token: '', user };

  /** @type {any} */
  let vu = null;
  /**
   * La sonde : elle ne rend rien, elle capture ce que le hook expose.
   * @returns {null} Rien.
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
  if (agir) {
    act(() => { agir(vu); });
  }
  // ⛔ Toujours démonter : un arbre laissé vivant fait sortir Jest en erreur.
  act(() => { arbre.unmount(); });
  queryClient.clear();

  return vu;
};

beforeEach(() => {
  mockStockage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  mockAppState.auth = null;
});

const JOUEUR_PARENT = {
  club: { documentId: 'club-1' },
  documentId: 'joueur-1',
  myTeams: [{ documentId: 'team-u15' }],
  role: { name: 'Joueur' },
  trainedTeams: [],
};
const PARENT = {
  documentId: 'parent-1', myTeams: [], role: { name: 'Parent' }, trainedTeams: [],
};

describe('PAR-L12 — le mode parent d un compte sportif', () => {
  test('un joueur passe en mode parent : l app le lit, son compte reste Joueur', () => {
    const vu = lire(JOUEUR_PARENT, (valeur) => valeur.setDisplayMode('parent'));

    expect(vu.isParentMode).toBe(true);
    expect(vu.isPlayerMode).toBe(false);
    expect(vu.accountRoleKey).toBe('player');
    expect(vu.userData.role.name).toBe('Joueur');
    expect(storage.set.mock.calls).toEqual([['user.player_mode.joueur-1', 'parent']]);
    Object.values(authService).forEach((fonction) => expect(fonction).not.toHaveBeenCalled());
  });

  test('le choix est retenu d une ouverture à l autre, et se défait en UN geste', () => {
    lire(JOUEUR_PARENT, (valeur) => valeur.setDisplayMode('parent'));
    expect(lire(JOUEUR_PARENT).isParentMode).toBe(true);

    const revenu = lire(JOUEUR_PARENT, (valeur) => valeur.setDisplayMode(null));
    expect(revenu.isParentMode).toBe(false);
    expect(mockStockage.has('user.player_mode.joueur-1')).toBe(false);
  });

  test('un dirigeant qui joue a TROIS positions ; en mode parent, sa gestion se tait', () => {
    const parent = lire(DIRIGEANT_JOUEUR, (valeur) => valeur.setDisplayMode('parent'));
    expect(parent.isParentMode).toBe(true);
    expect(parent.isPlayerMode).toBe(false);
    expect(parent.canManageTeam).toBe(false);
    expect(parent.canEditClub('club-1')).toBe(true);

    const joueur = lire(DIRIGEANT_JOUEUR, (valeur) => valeur.setDisplayMode('player'));
    expect(joueur.isPlayerMode).toBe(true);
    expect(joueur.isParentMode).toBe(false);

    const dirigeant = lire(DIRIGEANT_JOUEUR, (valeur) => valeur.setDisplayMode(null));
    expect(dirigeant.isPlayerMode).toBe(false);
    expect(dirigeant.isParentMode).toBe(false);
    expect(dirigeant.canManageTeam).toBe(true);
  });

  test('« setPlayerMode » garde son sens d avant (le bandeau des versions installées)', () => {
    const vu = lire(DIRIGEANT_JOUEUR, (valeur) => valeur.setPlayerMode(true));
    expect(vu.isPlayerMode).toBe(true);
    expect(storage.set.mock.calls).toEqual([['user.player_mode.dir-1', 'on']]);
  });

  test('un compte Parent EST déjà en mode parent : rien à basculer par ce réglage', () => {
    const vu = lire(PARENT, (valeur) => valeur.setDisplayMode('parent'));
    expect(vu.canUseParentMode).toBe(false);
    expect(vu.isParentMode).toBe(false);
    expect(vu.accountRoleKey).toBe('parent');
  });

  test('le mode parent s offre aux trois rôles sportifs', () => {
    expect(lire(JOUEUR_PARENT).canUseParentMode).toBe(true);
    expect(lire(DIRIGEANT_JOUEUR).canUseParentMode).toBe(true);
  });
});
