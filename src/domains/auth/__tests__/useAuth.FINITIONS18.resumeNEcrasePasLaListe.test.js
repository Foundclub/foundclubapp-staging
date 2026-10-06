import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

// FINITIONS18 · POINT 6 (tournee T16, photos F16-9f et F16-9i) — TELEPHONE : retour de « Mon
// retour de match » vers « Matchs en attente » ⇒ « Chargement des matchs en attente » SANS FIN,
// aucune requete (3 fois, ancien et nouveau code).
//
// La cle `['pendingMatchStatsPrompts']` porte deux formes : la LISTE (ce que l'ecran lit,
// `items` rempli) et le RESUME du demarrage (`items: []`, `totalPending`). `useAuth` recopiait le
// resume du bootstrap dans cette cle a CHAQUE passage de son effet — nouveau bootstrap, mais aussi
// toute nouvelle identite de `auth` (profil synchronise). L'ecran « Matchs en attente », reste
// monte SOUS « Mon retour de match », recevait alors un resume : « des matchs, pas de liste » =
// le squelette (`isSummaryOnly`), et rien ne relit la liste au retour (l'ecran ne se remonte pas,
// la donnee ecrite est fraiche). ROUGE avant : un resume ne remplace plus jamais une liste.

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
    useAppContext: () => {
      const [etat, envoyer] = useReducerReel(reducteurReel, global.fin18EtatInitial);
      global.fin18Envoyer = envoyer;
      return [etat, envoyer];
    },
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

const CLE = ['pendingMatchStatsPrompts'];
const HUGO = {
  documentId: 'hugo', firstname: 'Hugo', id: 2, lastname: 'Lemaire', role: { name: 'Player', type: 'player' },
};
const PROCHAIN = { eventId: 'grqs5', key: 'event:grqs5:u15:self' };
const RESUME = { items: [], nextPrompt: PROCHAIN, totalPending: 3 };
const LISTE = {
  items: [{ key: 'event:grqs5:u15:self' }, { key: 'event:mwdw2:u15:self' }, { key: 'event:wwna6:u15:self' }],
  nextPrompt: PROCHAIN,
  totalPending: 3,
};

let jeton = 'JETON-FIN18-0';
let serveur = 0;
/** @type {(() => void) | null} */
let demonter = null;

const monter = async () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  // eslint-disable-next-line global-require
  const useAuth = require('../useAuth').default;
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

beforeEach(() => {
  jest.useFakeTimers();
  serveur += 1;
  // Les garde-fous de useAuth sont des variables de MODULE : un jeton par temoin les isole.
  jeton = `JETON-FIN18-${serveur}`;
  global.fin18EtatInitial = {
    activeSessionDocumentId: 'hugo',
    auth: { token: jeton, user: HUGO },
    authSessions: [{ token: jeton, user: HUGO }],
    isAddingAccount: false,
  };
  mockGetAppBootstrap.mockImplementation(async () => ({
    pendingMatchStatsSummary: { ...RESUME },
    // Une heure de serveur NEUVE a chaque lecture : sinon le partage structurel de react-query
    // rend le MEME objet, et l effet ne repasse pas.
    serverTime: new Date(Date.UTC(2026, 9, 6, 12, 0, mockGetAppBootstrap.mock.calls.length)).toISOString(),
    unreadNotificationsCount: 0,
    userSummary: HUGO,
  }));
});

afterEach(() => {
  if (demonter) demonter();
  demonter = null;
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

test('FIN18-6/1 au demarrage, sans liste, le resume du bootstrap amorce la cle (comme avant)', async () => {
  const client = await monter();
  expect(client.getQueryData(CLE)).toEqual(RESUME);
});

test('FIN18-6/2 🔴 un NOUVEAU bootstrap n ecrase pas la liste deja lue par « Matchs en attente »', async () => {
  const client = await monter();
  act(() => { client.setQueryData(CLE, LISTE); });
  const lectures = mockGetAppBootstrap.mock.calls.length;
  await act(async () => { await client.refetchQueries({ queryKey: ['app-bootstrap'] }); });
  // react-query previent ses observateurs par une minuterie (fausse ici) : on la laisse passer.
  await act(async () => { jest.advanceTimersByTime(50); await Promise.resolve(); });
  expect(mockGetAppBootstrap.mock.calls.length).toBe(lectures + 1);
  expect(client.getQueryData(CLE)?.items).toHaveLength(3);
});

test('FIN18-6/3 🔴 une nouvelle identite de `auth` (profil synchronise) n ecrase pas non plus la liste', async () => {
  const client = await monter();
  act(() => { client.setQueryData(CLE, LISTE); });
  await act(async () => {
    global.fin18Envoyer({ payload: { ...HUGO, lastname: 'Lemaire-Martin' }, type: 'UPDATE_USER_DATA' });
  });
  expect(client.getQueryData(CLE)?.items).toHaveLength(3);
});

test('FIN18-6/4 une liste qui ne compte plus comme le serveur est marquee a relire (sans etre videe)', async () => {
  const client = await monter();
  act(() => { client.setQueryData(CLE, { ...LISTE, items: LISTE.items.slice(0, 2), totalPending: 2 }); });
  await act(async () => { await client.refetchQueries({ queryKey: ['app-bootstrap'] }); });
  // react-query previent ses observateurs par une minuterie (fausse ici) : on la laisse passer.
  await act(async () => { jest.advanceTimersByTime(50); await Promise.resolve(); });
  expect(client.getQueryData(CLE)?.items).toHaveLength(2);
  expect(client.getQueryState(CLE)?.isInvalidated).toBe(true);
});
