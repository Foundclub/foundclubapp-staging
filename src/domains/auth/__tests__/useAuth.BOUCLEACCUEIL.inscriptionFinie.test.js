import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

// BOUCLE-ACCUEIL (tournee 2.6.83, 28/10/2026, captures A-boucle-bienvenue / A-boucle-etape5) —
// « Tournee Recette », entraineur sans club, finit son inscription par « Demarrer le tour guide » :
// `Welcome` pose `hasCompletedOnboarding_<id>` (`markOnboardingComplete`), mais le parcours que
// lit le navigateur (`useAuth().onboardingViews`) ne se recalculait qu'au changement de `userData`.
// Le drapeau ecrit, le parcours restait celui d'AVANT : les ecrans du tunnel restaient montes,
// la bulle « Mission 1/4 » s'affichait sur « Bienvenue » et le retour arriere rouvrait 5/5.
// ROUGE avant : une inscription marquee finie vide le parcours tout de suite, sans attendre
// une relecture du profil.

// Le premier montage de `useAuth` charge tout le domaine : plus de 5 s a froid sur ce poste.
jest.setTimeout(30000);

const mockGetAppBootstrap = jest.fn();
const mockStockage = new Map();
const mockEcouteurs = new Set();

jest.mock('@/store/appContext', () => {
  // eslint-disable-next-line global-require
  const { useReducer: useReducerReel } = require('react');
  // eslint-disable-next-line global-require
  const reducteurReel = require('@/store/appReducer').default;
  return {
    storage: {
      addOnValueChangedListener: (/** @type {(key: string) => void} */ ecouteur) => {
        mockEcouteurs.add(ecouteur);
        return { remove: () => mockEcouteurs.delete(ecouteur) };
      },
      contains: (/** @type {string} */ cle) => mockStockage.has(cle),
      delete: (/** @type {string} */ cle) => {
        mockStockage.delete(cle);
        mockEcouteurs.forEach((ecouteur) => ecouteur(cle));
      },
      getAllKeys: () => Array.from(mockStockage.keys()),
      getBoolean: (/** @type {string} */ cle) => mockStockage.get(cle) === true,
      getNumber: () => 0,
      getString: (/** @type {string} */ cle) => {
        const valeur = mockStockage.get(cle);
        return typeof valeur === 'string' ? valeur : undefined;
      },
      set: (/** @type {string} */ cle, /** @type {any} */ valeur) => {
        mockStockage.set(cle, valeur);
        mockEcouteurs.forEach((ecouteur) => ecouteur(cle));
      },
    },
    useAppContext: () => {
      const [etat, envoyer] = useReducerReel(reducteurReel, global.boucleEtatInitial);
      return [etat, envoyer];
    },
  };
});
jest.mock('@/context/AppModeContext', () => ({ useAppMode: () => ({ isGold: false }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle,
  }),
}));
jest.mock('@/services/auth/authService', () => ({
  deleteDeviceToken: jest.fn(),
  getMe: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  signInWithPhoneNumber: jest.fn(),
}));
jest.mock('@/services/bootstrap/bootstrapService', () => ({
  getAppBootstrap: (...args) => mockGetAppBootstrap(...args),
}));
jest.mock('@/services/bootRequestGuard', () => ({
  getRetryAfterSeconds: () => 0, resetBootRequestGuard: jest.fn(),
}));
jest.mock('@/hooks/useNotificationController', () => ({ UNREAD_COUNT_QUERY_KEY: ['unread'] }));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));
jest.mock('@/services/teamInvite/teamInviteShare', () => ({
  shareTeamInviteLink: jest.fn(),
}));

// Le compte de la tournee : entraineur, date et ville connues, ni photo, ni club, ni equipe
// (sa demande d'adhesion a AS Montrivage est en attente : elle ne compte pas comme un club).
const COACH = {
  address: 'Montrivage',
  birthdate: '1990-01-01',
  documentId: 'tournee-recette',
  firstname: 'Tournee',
  id: 7,
  lastname: 'Recette',
  role: { name: 'Coach', type: 'coach' },
};

/** @type {{ current: any }} */
const vu = { current: null };
/** @type {(() => void) | null} */
let demonter = null;
let numero = 0;

const monter = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  // eslint-disable-next-line global-require
  const useAuth = require('../useAuth').default;
  /**
   * La sonde ne rend rien : elle garde le dernier `useAuth()`.
   * @returns {null} Rien a l'ecran.
   */
  function Sonde() {
    vu.current = useAuth();
    return null;
  }
  let arbre;
  await act(async () => {
    arbre = renderer.create(<QueryClientProvider client={client}><Sonde /></QueryClientProvider>);
  });
  for (let tour = 0; tour < 10; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { jest.advanceTimersByTime(500); await Promise.resolve(); });
  }
  demonter = () => { act(() => { arbre.unmount(); }); client.clear(); };
};

/**
 * Les etapes que le navigateur monterait (`canShowView` de `PrivateNavigator`).
 * @returns {string[]} Les routes affichables.
 */
const etapesMontees = () => (vu.current?.onboardingViews?.views || [])
  .filter((/** @type {any} */ vue) => vue.canShow)
  .map((/** @type {any} */ vue) => vue.route);

beforeEach(() => {
  jest.useFakeTimers();
  mockStockage.clear();
  mockEcouteurs.clear();
  numero += 1;
  // Les garde-fous de useAuth sont des variables de MODULE : un jeton par temoin les isole.
  const jeton = `JETON-BOUCLE-${numero}`;
  global.boucleEtatInitial = {
    activeSessionDocumentId: COACH.documentId,
    auth: { token: jeton, user: COACH },
    authSessions: [{ token: jeton, user: COACH }],
    isAddingAccount: false,
  };
  mockGetAppBootstrap.mockImplementation(async () => ({
    serverTime: '2026-10-28T12:00:00.000Z',
    unreadNotificationsCount: 0,
    userSummary: COACH,
  }));
});

afterEach(() => {
  if (demonter) demonter();
  demonter = null;
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('BOUCLE-1 avant la fin, le tunnel du coach sans club reste ouvert', async () => {
  await monter();
  expect(etapesMontees()).toEqual(['UserAvatar', 'UserAffiliationGuide', 'UserTrainedTeams']);
});

test('BOUCLE-2 🔴 inscription marquee finie = tunnel ferme TOUT DE SUITE, sans relire', async () => {
  await monter();
  const lectures = mockGetAppBootstrap.mock.calls.length;
  // eslint-disable-next-line global-require
  const { markOnboardingComplete } = require('../authUseCases');
  await act(async () => { markOnboardingComplete(COACH.documentId); });
  expect(mockGetAppBootstrap.mock.calls.length).toBe(lectures);
  expect(etapesMontees()).toEqual([]);
});

test('BOUCLE-3 a la relance (drapeau deja pose), le tunnel ne se rouvre pas', async () => {
  mockStockage.set(`hasCompletedOnboarding_${COACH.documentId}`, true);
  await monter();
  expect(etapesMontees()).toEqual([]);
});

test('BOUCLE-4 le drapeau d un AUTRE compte ne ferme pas ce tunnel-ci', async () => {
  await monter();
  // eslint-disable-next-line global-require
  const { markOnboardingComplete } = require('../authUseCases');
  await act(async () => { markOnboardingComplete('un-autre-compte'); });
  expect(etapesMontees()).toEqual(['UserAvatar', 'UserAffiliationGuide', 'UserTrainedTeams']);
});
