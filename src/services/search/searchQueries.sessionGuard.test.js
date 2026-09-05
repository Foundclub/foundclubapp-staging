import { useInfiniteQuery } from '@tanstack/react-query';

import { getAuthTokens } from '@/domains/auth/authUseCases';

import {
  useSearchClubs,
  useSearchClubsMap,
  useSearchEvents,
  useSearchEventsMap,
  useSearchProfiles,
  useSearchRecruitment,
  useSearchReservations,
} from './searchQueries';

// ---------------------------------------------------------------------------
// Lot SENTRY1, probleme B — mesure du 2026-09-05 (journaux de production) :
// 8 refus 403 sur GET /api/search/events et 4 sur GET /api/multisport-clubs.
//
// Ce n'est PAS une regression de permissions : verifie le meme jour, sans jeton,
//   curl https://api.foundclubpro.com/api/search/events?q=foot   -> 403
//   curl https://api.foundclubpro.com/api/multisport-clubs       -> 403
// Le serveur a raison : `api::search.search.events` est accorde a Authenticated
// et aux 5 roles metier, jamais a Public. Un 403 veut donc dire « l'appelant
// n'etait pas connecte ». Le journal serveur le confirme a la meme periode :
// `[EventFilter] APPLY MyTeams: false, User: undefined`.
//
// ⛔ Ce defaut ne se FILTRE pas, il se CORRIGE : aucun de ces 7 crochets ne
// regardait la session. On ne part plus tant qu'elle n'est pas la.
// ---------------------------------------------------------------------------

jest.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: jest.fn(() => ({})),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: jest.fn(),
}));

// `.env` est dans .gitignore : il n'existe dans AUCUN worktree. Or `searchService`
// importe `@/services/client`, qui appelle `assertRuntimeEndpointsReady()` AU
// CHARGEMENT (runtimeUrls.native.js:50) et fait echouer la suite ENTIERE.
// On double donc le service : ce fichier ne mesure que le `enabled` transmis a
// react-query, il n'appelle jamais le reseau. Doublure ecrite en entier, sans
// `jest.requireActual` — qui chargerait le vrai module, donc le vrai client.
jest.mock('./searchService', () => ({
  searchClubs: jest.fn(),
  searchClubsMap: jest.fn(),
  searchEvents: jest.fn(),
  searchEventsMap: jest.fn(),
  searchProfiles: jest.fn(),
  searchRecruitment: jest.fn(),
  searchReservations: jest.fn(),
}));

const lastEnabled = () => {
  const { calls } = /** @type {any} */ (useInfiniteQuery).mock;
  return calls[calls.length - 1][0].enabled;
};

const sansSession = () => /** @type {any} */ (getAuthTokens).mockReturnValue(null);
const avecSession = () => /** @type {any} */ (getAuthTokens)
  .mockReturnValue({ token: 'jeton-valide' });

// Chaque crochet avec des parametres qui, AVANT ce lot, suffisaient a le lancer.
const CROCHETS = [
  ['useSearchEvents', () => useSearchEvents({ q: 'foot' })],
  ['useSearchClubs', () => useSearchClubs({ q: 'foot' })],
  ['useSearchReservations', () => useSearchReservations({ q: 'foot' })],
  ['useSearchRecruitment', () => useSearchRecruitment({ activity: 'football' })],
  ['useSearchProfiles', () => useSearchProfiles({ q: 'foot' })],
  ['useSearchEventsMap', () => useSearchEventsMap({
    east: 6, north: 44, south: 43, west: 5, zoom: 12,
  })],
  ['useSearchClubsMap', () => useSearchClubsMap({
    east: 6, north: 44, south: 43, west: 5, zoom: 12,
  })],
];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('T4 — aucune recherche ne part sans session', () => {
  test.each(CROCHETS)('%s reste eteint', (_nom, appeler) => {
    sansSession();
    appeler();
    expect(lastEnabled()).toBe(false);
  });

  test('un appelant ne peut PAS rouvrir la vanne avec son propre enabled', () => {
    // ConversationPublicEventPicker.js:71 passe `enabled: isSmartSearchEnabled`.
    // Comme `...options` est etale APRES, cet `enabled` ecrasait celui du
    // crochet : la garde de session doit donc etre posee EN DERNIER.
    sansSession();
    useSearchEvents({ q: 'foot' }, { enabled: true });
    expect(lastEnabled()).toBe(false);
  });
});

describe('T5 — une fois la session la, la recherche part bien', () => {
  test.each(CROCHETS)('%s se rallume', (_nom, appeler) => {
    avecSession();
    appeler();
    expect(lastEnabled()).toBe(true);
  });

  test('la session ne suffit pas : les conditions metier tiennent toujours', () => {
    avecSession();
    useSearchEvents({ q: 'f' }); // moins de 2 caracteres
    expect(lastEnabled()).toBe(false);

    useSearchEventsMap({ north: 44 }); // bornes de carte incompletes
    expect(lastEnabled()).toBe(false);
  });

  test('et l appelant garde le droit d ETEINDRE sa requete', () => {
    avecSession();
    useSearchEvents({ q: 'foot' }, { enabled: false });
    expect(lastEnabled()).toBe(false);
  });
});
