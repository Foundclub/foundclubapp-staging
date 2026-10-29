// ONBOARDDATE (29/10/2026, decision d'Adel « 3- A ») — le serveur garde la date de fin
// d'inscription. `useAuth` (telephone ET site) l'envoie au moment ou le drapeau local est pose,
// et, si le drapeau existe sans date serveur (appel rate, version d'avant), au demarrage suivant.
// Un echec reseau ne bloque personne : le drapeau local ferme deja le tunnel.

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
  documentId: 'coach-onboarddate',
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
    useAuth();
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

/** @type {{ act: (rappel: () => Promise<void>) => Promise<void> }} */
const actuel = { act: async (rappel) => rappel() };

const CLE = `hasCompletedOnboarding_${COACH.documentId}`;

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
  const jeton = `JETON-ONBOARD-${numero}`;
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

test('ONBOARD-1 tant que l inscription n est pas finie, rien n est envoye', async () => {
  await monter();
  expect(mockMarquerFini).not.toHaveBeenCalled();
});

test('ONBOARD-2 🔴 drapeau pose = serveur prevenu, une fois, sans date venue de l app', async () => {
  await monter();
  // eslint-disable-next-line global-require
  const { markOnboardingComplete } = require('../authUseCases');
  await actuel.act(async () => { markOnboardingComplete(COACH.documentId); });
  await actuel.act(async () => { markOnboardingComplete(COACH.documentId); });
  expect(mockMarquerFini).toHaveBeenCalledTimes(1);
  expect(mockMarquerFini).toHaveBeenCalledWith();
});

test('ONBOARD-3 🔴 au demarrage, drapeau sans date serveur : on reessaie', async () => {
  mockStockage.set(CLE, true);
  await monter();
  expect(mockMarquerFini).toHaveBeenCalledTimes(1);
});

test('ONBOARD-4 la date serveur deja la : aucun appel', async () => {
  mockStockage.set(CLE, true);
  await monter({ ...COACH, onboardingCompletedAt: '2026-10-28T19:02:11.000Z' });
  expect(mockMarquerFini).not.toHaveBeenCalled();
});

test('ONBOARD-5 🔴 appel en echec : rien ne casse, et le lancement suivant reessaie', async () => {
  mockMarquerFini.mockRejectedValue(new Error('Network Error'));
  mockStockage.set(CLE, true);
  await monter();
  expect(mockMarquerFini).toHaveBeenCalledTimes(1);
  demonter();
  demonter = null;
  jest.resetModules();
  await monter();
  expect(mockMarquerFini).toHaveBeenCalledTimes(2);
});
