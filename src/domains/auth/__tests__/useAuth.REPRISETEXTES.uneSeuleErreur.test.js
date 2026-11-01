import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

// REPRISE-TEXTES, points 23 et D-GERANT-2 (contre-recette du 01/11) — un mauvais code de connexion
// affichait son message DEUX fois : dans une fenêtre grise du navigateur (`displayErrorAlert` de
// `useAuth`) et sous le champ (`authErrorMessage` de Login / Register, posé par CORR-TEXTES).
// ROUGE avant : la fenêtre s'ouvrait. Après : seul le message sous le champ reste, et l'erreur
// est toujours exposée par la mutation pour que l'écran l'affiche.

// Le premier montage de `useAuth` charge tout le domaine : plus de 5 s a froid sur ce poste.
jest.setTimeout(30000);

const mockAlerte = jest.fn();
const mockLogin = jest.fn();
const mockEnvoiCode = jest.fn();
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
  login: (...args) => mockLogin(...args),
  logout: jest.fn(),
  markOnboardingCompletedOnServer: jest.fn(() => Promise.resolve({})),
  signInWithPhoneNumber: (...args) => mockEnvoiCode(...args),
}));
jest.mock('@/utils/errors/displayError', () => ({
  ...jest.requireActual('@/utils/errors/displayError'),
  displayErrorAlert: (...args) => mockAlerte(...args),
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

beforeEach(() => {
  jest.useFakeTimers();
  mockStockage.clear();
  mockEcouteurs.clear();
  mockAlerte.mockClear();
  numero += 1;
  const jeton = `JETON-REPRISE-${numero}`;
  global.boucleEtatInitial = {
    activeSessionDocumentId: COACH.documentId,
    auth: { token: jeton, user: COACH },
    authSessions: [{ token: jeton, user: COACH }],
    isAddingAccount: false,
  };
  mockGetAppBootstrap.mockImplementation(async () => ({
    serverTime: '2026-11-01T12:00:00.000Z',
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

test('REPRISE-23 🔴 un code faux ne passe plus par une fenêtre du navigateur', async () => {
  const codeFaux = Object.assign(new Error('Firebase: Error (auth/invalid-verification-code).'), {
    code: 'auth/invalid-verification-code',
  });
  mockLogin.mockRejectedValue(codeFaux);
  await monter();
  await act(async () => {
    vu.current.loginMutation.mutate({ code: '000000' });
    await Promise.resolve();
  });
  for (let tour = 0; tour < 5; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { jest.advanceTimersByTime(100); await Promise.resolve(); });
  }
  expect(mockAlerte).not.toHaveBeenCalled();
  expect(vu.current.loginMutation.error).toBe(codeFaux);
});

test('REPRISE-23 🔴 un envoi de code impossible ne passe plus par une fenêtre', async () => {
  const envoiImpossible = Object.assign(new Error('Firebase: Error (auth/billing-not-enabled).'), {
    code: 'auth/billing-not-enabled',
  });
  mockEnvoiCode.mockRejectedValue(envoiImpossible);
  await monter();
  await act(async () => {
    vu.current.otpMutation.mutate('+33600000099');
    await Promise.resolve();
  });
  for (let tour = 0; tour < 5; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { jest.advanceTimersByTime(100); await Promise.resolve(); });
  }
  expect(mockAlerte).not.toHaveBeenCalled();
  expect(vu.current.otpMutation.error).toBe(envoiImpossible);
});
