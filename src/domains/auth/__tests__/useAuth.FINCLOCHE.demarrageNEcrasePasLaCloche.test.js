/* eslint-disable max-len -- les témoins se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

// FIN-CLOCHE (02/11/2026) — LE DÉMARRAGE NE RÉÉCRIT PLUS LE CHIFFRE DE LA CLOCHE.
//
// `useAuth` recopiait `unreadNotificationsCount` du bootstrap dans le compteur à chaque nouvelle
// réponse. Or le serveur garde cette réponse en cache (30 s + 4 min) et ne la purge que dans le
// processus qui a reçu l'écriture ; la prod en a plusieurs, la recette un seul. Après « Tout lire »,
// une relecture tombée sur un autre processus rendait donc l'ancien chiffre à la cloche.
// Le bootstrap sert à éviter la PREMIÈRE lecture : il remplit une cloche vide, il n'écrase plus.

const mockGetAppBootstrap = jest.fn();

jest.mock('@/store/appContext', () => {
  // eslint-disable-next-line global-require
  const { useReducer: useReducerReel } = require('react');
  // eslint-disable-next-line global-require
  const reducteurReel = require('@/store/appReducer').default;
  return {
    storage: {
      delete: jest.fn(), getAllKeys: () => [], getBoolean: () => true, getString: () => undefined, set: jest.fn(),
    },
    useAppContext: () => useReducerReel(reducteurReel, global.finClocheEtatInitial),
  };
});
jest.mock('@/context/AppModeContext', () => ({ useAppMode: () => ({ isGold: false }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle }),
}));
jest.mock('@/services/auth/authService', () => ({
  deleteDeviceToken: jest.fn(), getMe: jest.fn(), login: jest.fn(), logout: jest.fn(), signInWithPhoneNumber: jest.fn(),
}));
jest.mock('@/services/bootstrap/bootstrapService', () => ({
  getAppBootstrap: (...args) => mockGetAppBootstrap(...args),
}));
jest.mock('@/services/bootRequestGuard', () => ({ getRetryAfterSeconds: () => 0, resetBootRequestGuard: jest.fn() }));
jest.mock('@/hooks/useNotificationController', () => ({ UNREAD_COUNT_QUERY_KEY: ['unread'] }));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));
jest.mock('@/services/teamInvite/teamInviteShare', () => ({ shareTeamInviteLink: jest.fn() }));

const CLE = ['unread'];
const HUGO = {
  documentId: 'hugo', firstname: 'Hugo', id: 2, lastname: 'Lemaire', role: { name: 'Player', type: 'player' },
};

let numero = 0;
/** @type {(() => void) | null} */
let demonter = null;

const monter = async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  // eslint-disable-next-line global-require
  const useAuth = require('../useAuth').default;
  /**
   * La sonde qui porte useAuth.
   * @returns {null} Rien à afficher.
   */
  function Sonde() {
    useAuth();
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
  return client;
};

const relireLeBootstrap = async (/** @type {QueryClient} */ client) => {
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['app-bootstrap'] });
  });
  for (let tour = 0; tour < 4; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { jest.advanceTimersByTime(500); await Promise.resolve(); });
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  numero += 1;
  // Les garde-fous de useAuth sont des variables de MODULE : un jeton par témoin les isole.
  const jeton = `JETON-FINCLOCHE-${numero}`;
  global.finClocheEtatInitial = {
    activeSessionDocumentId: 'hugo',
    auth: { token: jeton, user: HUGO },
    authSessions: [{ token: jeton, user: HUGO }],
    isAddingAccount: false,
  };
  mockGetAppBootstrap.mockImplementation(async () => ({
    // Une heure de serveur NEUVE à chaque lecture : sinon l'effet ne repasse pas.
    serverTime: new Date(Date.UTC(2026, 10, 2, 12, 0, mockGetAppBootstrap.mock.calls.length)).toISOString(),
    unreadNotificationsCount: 376,
    userSummary: HUGO,
  }));
});

afterEach(() => {
  if (demonter) demonter();
  demonter = null;
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
  mockGetAppBootstrap.mockReset();
});

test('une cloche encore vide prend le chiffre du démarrage', async () => {
  const client = await monter();
  expect(client.getQueryData(CLE)).toEqual({ count: 376 });
});

test('après « Tout lire », une relecture périmée du démarrage ne remet pas l ancien chiffre', async () => {
  const client = await monter();
  act(() => { client.setQueryData(CLE, { count: 0 }); });
  const lecturesAvant = mockGetAppBootstrap.mock.calls.length;
  await relireLeBootstrap(client);
  expect(mockGetAppBootstrap.mock.calls.length).toBeGreaterThan(lecturesAvant);
  expect(client.getQueryData(CLE)).toEqual({ count: 0 });
});
