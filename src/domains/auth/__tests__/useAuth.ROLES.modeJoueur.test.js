import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

// LOT RÔLES (demande d'Adel du 2026-09-28) — écran 3 : le MODE JOUEUR.
//
// « Je suis dirigeant et d'un coup j'ai envie de me mettre joueur dans une
// équipe : il faut que je voie la chose comme un joueur normal, à part que je
// puisse avoir l'option de revenir en arrière. »
//
// Décision 1 du lot : le mode joueur est un changement d'AFFICHAGE, pas de
// droits. Ce témoin monte le VRAI hook (même montage que le témoin TRIO) et
// mesure les deux moitiés :
//   · ce qui BASCULE : les 7 jugements d'affichage (gérer l'équipe, gérer les
//     événements…) répondent comme pour un joueur ;
//   · ce qui NE BOUGE PAS : le rôle du compte, les portes de droits
//     (`canEditClub`, `hasClubAccess`), et aucun appel réseau.
// Écrit ROUGE (le mode n'existait pas), puis vert.

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

describe('RÔLES — écran 3 : le mode joueur d\'un dirigeant qui joue', () => {
  test('hors mode joueur, rien ne change : le dirigeant voit ses gestes de dirigeant', () => {
    const vu = lire(DIRIGEANT_JOUEUR);
    expect(vu.canUsePlayerMode).toBe(true);
    expect(vu.isPlayerMode).toBe(false);
    expect(vu.canManageTeam).toBe(true);
    expect(vu.canManageEvents).toBe(true);
  });

  test('EN mode joueur, l\'app lui répond comme à un joueur de son équipe', () => {
    const vu = lire(DIRIGEANT_JOUEUR, (valeur) => valeur.setPlayerMode(true));

    expect(vu.isPlayerMode).toBe(true);
    expect(vu.canManageTeam).toBe(false);
    expect(vu.canManageEvents).toBe(false);
    expect(vu.canEditEvent('team-seniors')).toBe(false);
    expect(vu.canManageEvent({ team: { documentId: 'team-seniors' } })).toBe(false);
    expect(vu.canContactAdmin).toBe(false);
    expect(vu.canJoinClub).toBe(false);
  });

  test('🔒 ses DROITS sont intacts : rôle du compte, portes du club, aucun appel réseau', () => {
    const vu = lire(DIRIGEANT_JOUEUR, (valeur) => valeur.setPlayerMode(true));

    expect(vu.isPlayerMode).toBe(true);
    expect(vu.accountRoleKey).toBe('president');
    expect(vu.userData.role.name).toBe('Dirigeant');
    expect(vu.canEditClub('club-1')).toBe(true);
    expect(vu.hasClubAccess('club-1')).toBe(true);
    // La bascule n'écrit QU'UNE clé locale, et ne parle à aucun serveur.
    expect(storage.set.mock.calls).toEqual([['user.player_mode.dir-1', 'on']]);
    Object.values(authService).forEach((fonction) => expect(fonction).not.toHaveBeenCalled());
  });

  test('le choix est retenu d\'une ouverture à l\'autre, et se défait en UN geste', () => {
    lire(DIRIGEANT_JOUEUR, (valeur) => valeur.setPlayerMode(true));
    // Nouvelle ouverture : le choix est relu depuis le stockage.
    const rouvert = lire(DIRIGEANT_JOUEUR);
    expect(rouvert.isPlayerMode).toBe(true);

    const revenu = lire(DIRIGEANT_JOUEUR, (valeur) => valeur.setPlayerMode(false));
    expect(revenu.isPlayerMode).toBe(false);
    expect(revenu.canManageTeam).toBe(true);
    expect(mockStockage.has('user.player_mode.dir-1')).toBe(false);
  });

  test('le mode est PAR COMPTE : un autre compte du téléphone n\'en hérite pas', () => {
    lire(DIRIGEANT_JOUEUR, (valeur) => valeur.setPlayerMode(true));
    const autre = lire({ ...DIRIGEANT_JOUEUR, documentId: 'dir-2' });
    expect(autre.isPlayerMode).toBe(false);
    expect(autre.canManageTeam).toBe(true);
  });

  test('sans équipe où il joue, pas de mode joueur (il n\'aurait rien à voir)', () => {
    const sansEquipe = { ...DIRIGEANT_JOUEUR, myTeams: [] };
    const vu = lire(sansEquipe, (valeur) => valeur.setPlayerMode(true));
    expect(vu.canUsePlayerMode).toBe(false);
    expect(vu.isPlayerMode).toBe(false);
    expect(vu.canManageTeam).toBe(true);
  });

  test('un joueur n\'a pas de mode joueur à proposer', () => {
    const joueur = { ...DIRIGEANT_JOUEUR, role: { name: 'Joueur' }, trainedTeams: [] };
    expect(lire(joueur).canUsePlayerMode).toBe(false);
  });
});
