/* eslint-disable max-len -- des phrases entieres */
// TUNNELREPRISE (29/10/2026, decision d'Adel « 1- A ») — la moitie `useAuth` de la regle : a la
// REOUVERTURE d'une inscription a qui il ne manque que des etapes qui se passent, l'app pose la fin
// (drapeau local, puis date serveur ONBOARDDATE) ; avancer dans le tunnel le note commence, y
// compris pour un compte cree par un club (ni « Quel est ton statut ? », ni marqueur avant).
// Harnais repris de useAuth.ONBOARDDATE.appelServeur.test.js : un « lancement » = resetModules.

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
      const [etat, envoyer] = useReducerReel(reducteurReel, global.onboardEtatInitial);
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
const mockMarquerFini = jest.fn();
jest.mock('@/services/auth/authService', () => ({
  deleteDeviceToken: jest.fn(),
  getMe: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  markOnboardingCompletedOnServer: (...args) => mockMarquerFini(...args),
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

const COACH = {
  address: 'Montrivage',
  birthdate: '1990-01-01',
  documentId: 'coach-reprise',
  firstname: 'Julien',
  id: 8,
  lastname: 'Marchal',
  role: { name: 'Coach', type: 'coach' },
};

/** @type {(() => void) | null} */
let demonter = null;
let numero = 0;

const monter = async (/** @type {any} */ profil = COACH) => {
  global.onboardEtatInitial.auth.user = profil;
  mockGetAppBootstrap.mockImplementation(async () => ({
    serverTime: '2026-10-29T02:00:00.000Z', unreadNotificationsCount: 0, userSummary: profil,
  }));
  // Un « lancement » = des modules neufs (jest.resetModules) : React, le rendu et useAuth sont
  // relus ENSEMBLE, sinon deux copies de React se croisent.
  /* eslint-disable global-require */
  const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
  const { createElement } = require('react');
  const { act } = require('react-test-renderer');
  const renderer = require('react-test-renderer');
  /* eslint-enable global-require */
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  // eslint-disable-next-line global-require
  const useAuth = require('../useAuth').default;
  /**
   * La sonde ne rend rien.
   * @returns {null} Rien a l'ecran.
   */
  function Sonde() {
    actuel.valeur = useAuth();
    return null;
  }
  let arbre;
  await act(async () => {
    arbre = renderer.create(createElement(QueryClientProvider, { client }, createElement(Sonde)));
  });
  for (let tour = 0; tour < 10; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { jest.advanceTimersByTime(500); await Promise.resolve(); });
  }
  demonter = () => { act(() => { arbre.unmount(); }); client.clear(); };
  actuel.act = act;
};

/** @type {{ act: (rappel: () => Promise<void>) => Promise<void>, valeur?: any }} */
const actuel = { act: async (rappel) => rappel() };

const FINIE = `hasCompletedOnboarding_${COACH.documentId}`;
const COMMENCEE = `onboardingStarted_${COACH.documentId}`;

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetModules();
  mockStockage.clear();
  mockEcouteurs.clear();
  mockMarquerFini.mockReset();
  mockMarquerFini.mockResolvedValue({
    data: { onboardingCompletedAt: '2026-10-29T02:00:00.000Z' },
  });
  numero += 1;
  const jeton = `JETON-REPRISE-${numero}`;
  global.onboardEtatInitial = {
    activeSessionDocumentId: COACH.documentId,
    auth: { token: jeton, user: COACH },
    authSessions: [{ token: jeton, user: COACH }],
    isAddingAccount: false,
  };
});

afterEach(() => {
  if (demonter) demonter();
  demonter = null;
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('REPRISE-1 🔴 reouverture (commencee ici, ni photo ni equipe) : fin posee, serveur prevenu', async () => {
  mockStockage.set(COMMENCEE, true);
  await monter();
  expect(mockStockage.get(FINIE)).toBe(true);
  expect(mockMarquerFini).toHaveBeenCalledTimes(1);
});

test('REPRISE-2 🔴 compte cree par un club : avancer le note commence, la reouverture le finit', async () => {
  await monter();
  expect(mockStockage.get(FINIE)).toBeUndefined();
  // eslint-disable-next-line global-require
  const { RouteNames } = require('@/navigation/routeNames');
  await actuel.act(async () => { actuel.valeur.getNextOnboardingRoute(RouteNames.UserAvatar); });
  expect(mockStockage.get(COMMENCEE)).toBe(true);
  // Meme lancement : le tunnel continue, rien n'est fini.
  expect(mockStockage.get(FINIE)).toBeUndefined();
  expect(actuel.valeur.onboardingViews.views.some((vue) => vue.canShow)).toBe(true);
  demonter();
  demonter = null;
  jest.resetModules();
  await monter();
  expect(mockStockage.get(FINIE)).toBe(true);
  expect(mockMarquerFini).toHaveBeenCalledTimes(1);
});

test('REPRISE-3 premier lancement, rien de commence : ni fin, ni appel', async () => {
  await monter();
  expect(mockStockage.get(FINIE)).toBeUndefined();
  expect(mockMarquerFini).not.toHaveBeenCalled();
});
