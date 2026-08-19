import { QueryClient, QueryObserver } from '@tanstack/react-query';

import {
  getReturnRefreshQueryKeys,
  isNetworkOutageError,
  isReturnToForeground,
  NETWORK_PROBE_MIN_DELAY_MS,
  refreshOnReturn,
  resetReturnRefreshCooldown,
  RETURN_REFRESH_COOLDOWN_MS,
  startQueryRefreshBridge,
} from '@/app/queryRefreshOnReturn';

/**
 * Y05 — LE FILET DE « L'APP NE SE RAFRAICHIT PAS TOUTE SEULE ».
 *
 * Constat d'Adel, 2026-08-19 : « j'ai du fermer et rouvrir l'app pour voir les
 * demandes ». Fermer l'app est le DIAGNOSTIC : la donnee etait bien au serveur,
 * c'est l'app qui n'allait pas la rechercher.
 *
 * Ces temoins mesurent des APPELS RESEAU REELS, pas des intentions : chaque
 * requete est montee avec un vrai `QueryObserver` et son `queryFn` compte les
 * appels. Un temoin qui compterait des `invalidateQueries` resterait vert le
 * jour ou la racine invalidee ne correspond a rien.
 */

/**
 * Un faux AppState pilotable : `emit('background')` puis `emit('active')`.
 * @param {string} [initialState] L'etat de depart.
 * @returns {any} Le faux AppState.
 */
const createFakeAppState = (initialState = 'active') => {
  const listeners = new Set();
  return {
    addEventListener: (_type, listener) => {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    currentState: initialState,
    emit: (nextState) => listeners.forEach((listener) => listener(nextState)),
  };
};

/**
 * Un faux focusManager, pour verifier qu'on lui dit bien quand l'app dort.
 * @returns {any} Le faux focusManager, avec l'historique de ses etats.
 */
const createFakeFocus = () => {
  const states = [];
  return { setFocused: (value) => states.push(value), states };
};

/**
 * Un faux onlineManager, avec les 3 methodes que le pont utilise.
 * @param {boolean} [initialOnline] L'etat reseau de depart.
 * @returns {any} Le faux onlineManager.
 */
const createFakeOnline = (initialOnline = true) => {
  let isOnline = initialOnline;
  const listeners = new Set();
  return {
    isOnline: () => isOnline,
    setOnline: (value) => {
      if (value === isOnline) return;
      isOnline = value;
      listeners.forEach((listener) => listener(value));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

/**
 * Monte une requete ACTIVE (comme le ferait un ecran affiche) et rend son
 * compteur d'appels reseau.
 * @param {any} queryClient Le cache de l'app.
 * @param {any} queryKey La cle de la requete a monter.
 * @returns {any} Le compteur d'appels et la fonction qui demonte.
 */
const mountQuery = (queryClient, queryKey) => {
  const queryFn = jest.fn().mockResolvedValue({ ok: true });
  const observer = new QueryObserver(queryClient, {
    gcTime: Infinity,
    queryFn,
    queryKey,
    retry: false,
    staleTime: 0,
  });
  const unsubscribe = observer.subscribe(() => {});
  return { queryFn, unsubscribe };
};

describe('Y05 — le retour au premier plan relit ce qui bouge, et rien d\'autre', () => {
  /** @type {QueryClient} */
  let queryClient;
  let stopBridge;
  let appState;
  let focus;
  let online;

  beforeEach(() => {
    resetReturnRefreshCooldown();
    jest.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
    });
    appState = createFakeAppState('active');
    focus = createFakeFocus();
    online = createFakeOnline(true);
    stopBridge = startQueryRefreshBridge(queryClient, { appState, focus, online });
  });

  afterEach(() => {
    stopBridge();
    queryClient.clear();
    jest.useRealTimers();
  });

  test('TEMOIN 1 — le retour au premier plan relit LES DEMANDES', async () => {
    const requests = mountQuery(queryClient, ['requestsHub']);
    const teamRequests = mountQuery(queryClient, ['teamMembershipRequests', 'team-1']);
    await jest.runOnlyPendingTimersAsync();

    expect(requests.queryFn).toHaveBeenCalledTimes(1);
    expect(teamRequests.queryFn).toHaveBeenCalledTimes(1);

    appState.emit('background');
    appState.emit('active');
    await jest.runOnlyPendingTimersAsync();

    expect(requests.queryFn).toHaveBeenCalledTimes(2);
    expect(teamRequests.queryFn).toHaveBeenCalledTimes(2);

    requests.unsubscribe();
    teamRequests.unsubscribe();
  });

  test('TEMOIN 2 — le retour au premier plan relit MES EQUIPES', async () => {
    const teams = mountQuery(queryClient, ['teams', { club: 'club-1' }]);
    const team = mountQuery(queryClient, ['team', 'team-1']);
    await jest.runOnlyPendingTimersAsync();

    appState.emit('background');
    appState.emit('active');
    await jest.runOnlyPendingTimersAsync();

    expect(teams.queryFn).toHaveBeenCalledTimes(2);
    expect(team.queryFn).toHaveBeenCalledTimes(2);

    teams.unsubscribe();
    team.unsubscribe();
  });

  test('TEMOIN 3 — le retour ne relit PAS les catalogues (garde-fou anti-rafale)', async () => {
    const catalogues = [
      ['levels'],
      ['categories'],
      ['sections'],
      ['activities'],
      ['event-types'],
      ['get-roles'],
      ['subscription-catalog'],
      ['clubs', { page: 1 }],
      ['search', 'paris'],
    ].map((queryKey) => mountQuery(queryClient, queryKey));
    await jest.runOnlyPendingTimersAsync();

    appState.emit('background');
    appState.emit('active');
    await jest.runOnlyPendingTimersAsync();

    catalogues.forEach(({ queryFn }) => expect(queryFn).toHaveBeenCalledTimes(1));
    catalogues.forEach(({ unsubscribe }) => unsubscribe());
  });

  test('TEMOIN 4 — un aller-retour d\'une seconde ne relance pas tout deux fois', async () => {
    const requests = mountQuery(queryClient, ['requestsHub']);
    await jest.runOnlyPendingTimersAsync();

    appState.emit('background');
    appState.emit('active');
    await jest.runOnlyPendingTimersAsync();
    expect(requests.queryFn).toHaveBeenCalledTimes(2);

    appState.emit('background');
    appState.emit('active');
    await jest.runOnlyPendingTimersAsync();

    expect(requests.queryFn).toHaveBeenCalledTimes(2);
    requests.unsubscribe();
  });

  test('TEMOIN 5 — le retour du reseau relit LES MEMES familles', async () => {
    const requests = mountQuery(queryClient, ['requestsHub']);
    const catalogue = mountQuery(queryClient, ['levels']);
    await jest.runOnlyPendingTimersAsync();

    online.setOnline(false);
    online.setOnline(true);
    await jest.runOnlyPendingTimersAsync();

    expect(requests.queryFn).toHaveBeenCalledTimes(2);
    expect(catalogue.queryFn).toHaveBeenCalledTimes(1);

    requests.unsubscribe();
    catalogue.unsubscribe();
  });

  test('MESURE — combien d\'appels partent vraiment au retour', async () => {
    // L'accueil, tel qu'il est monte aujourd'hui : `home-summary` (HomeHub.js:1543),
    // `app-bootstrap` et `get-me` (useAuth), la reponse a l'evenement du jour.
    // A cote, deux catalogues et une liste de reference, montes eux aussi.
    const accueil = [
      ['home-summary'],
      ['app-bootstrap', 'jeton'],
      ['get-me'],
      ['events', { scope: 'home' }],
    ].map((queryKey) => mountQuery(queryClient, queryKey));
    const horsListe = [['levels'], ['clubs', { page: 1 }], ['chats']]
      .map((queryKey) => mountQuery(queryClient, queryKey));
    await jest.runOnlyPendingTimersAsync();

    const appelsAvant = [...accueil, ...horsListe]
      .reduce((total, { queryFn }) => total + queryFn.mock.calls.length, 0);

    appState.emit('background');
    appState.emit('active');
    await jest.runOnlyPendingTimersAsync();

    const appelsApres = [...accueil, ...horsListe]
      .reduce((total, { queryFn }) => total + queryFn.mock.calls.length, 0);

    // 4 appels : un par requete de l'accueil. Zero pour les trois autres.
    expect(appelsApres - appelsAvant).toBe(4);
    horsListe.forEach(({ queryFn }) => expect(queryFn).toHaveBeenCalledTimes(1));

    [...accueil, ...horsListe].forEach(({ unsubscribe }) => unsubscribe());
  });

  test('MESURE — le pire cas est borne par les familles, pas par la taille du cache', async () => {
    // Les 17 familles montees EN MEME TEMPS — ce qu'aucun ecran reel ne fait.
    const montees = getReturnRefreshQueryKeys()
      .map((queryKey) => mountQuery(queryClient, queryKey));
    // 30 requetes hors liste dorment dans le cache, sans observateur.
    const endormies = Array.from({ length: 30 }, (_, index) => {
      queryClient.setQueryData(['catalogue-endormi', index], { ok: true });
      return index;
    });
    await jest.runOnlyPendingTimersAsync();

    appState.emit('background');
    appState.emit('active');
    await jest.runOnlyPendingTimersAsync();

    const appels = montees.reduce((total, { queryFn }) => total + queryFn.mock.calls.length, 0);

    expect(endormies).toHaveLength(30);
    expect(montees).toHaveLength(17);
    // 17 montages + 17 relectures : jamais les 30 endormies.
    expect(appels).toBe(34);

    montees.forEach(({ unsubscribe }) => unsubscribe());
  });

  test('iOS — `inactive` (centre de controle) n\'est PAS un retour', async () => {
    const requests = mountQuery(queryClient, ['requestsHub']);
    await jest.runOnlyPendingTimersAsync();

    appState.emit('inactive');
    appState.emit('active');
    await jest.runOnlyPendingTimersAsync();

    expect(requests.queryFn).toHaveBeenCalledTimes(1);
    requests.unsubscribe();
  });

  test('le pont dit a react-query quand l\'app dort, et quand elle se reveille', () => {
    focus.states.length = 0;
    appState.emit('background');
    appState.emit('active');
    expect(focus.states).toEqual([false, true]);
  });

  test('RESEAU — une coupure bascule hors ligne, un refus 403 ne bascule PAS', async () => {
    const coupure = new QueryObserver(queryClient, {
      queryFn: jest.fn().mockRejectedValue({ message: 'Network Error' }),
      queryKey: ['events', 'coupure'],
      retry: false,
    });
    const refus = new QueryObserver(queryClient, {
      queryFn: jest.fn().mockRejectedValue({ status: 403 }),
      queryKey: ['events', 'refus'],
      retry: false,
    });

    const arreterRefus = refus.subscribe(() => {});
    await jest.advanceTimersByTimeAsync(50);
    expect(online.isOnline()).toBe(true);
    arreterRefus();

    const arreterCoupure = coupure.subscribe(() => {});
    await jest.advanceTimersByTimeAsync(50);
    expect(online.isOnline()).toBe(false);
    arreterCoupure();
  });

  test('RESEAU — la sonde nous redeclare joignable toute seule, sans point de sante', async () => {
    const observer = new QueryObserver(queryClient, {
      queryFn: jest.fn().mockRejectedValue({ message: 'Network Error' }),
      queryKey: ['events', 'coupure'],
      retry: false,
    });
    const bascules = [];
    online.subscribe((valeur) => bascules.push(valeur));

    const arreter = observer.subscribe(() => {});
    await jest.advanceTimersByTimeAsync(50);
    expect(bascules).toEqual([false]);

    // Personne n'a rien fait : c'est la sonde qui relance la machine. Le reseau
    // etant toujours coupe, la requete relancee echoue et on repart hors ligne
    // — avec un pas deux fois plus long. C'est exactement le comportement voulu.
    await jest.advanceTimersByTimeAsync(NETWORK_PROBE_MIN_DELAY_MS);
    expect(bascules.slice(0, 2)).toEqual([false, true]);

    arreter();
  });

  test('debrancher le pont arrete tout', async () => {
    const requests = mountQuery(queryClient, ['requestsHub']);
    await jest.runOnlyPendingTimersAsync();

    stopBridge();
    stopBridge = () => {};
    appState.emit('background');
    appState.emit('active');
    await jest.runOnlyPendingTimersAsync();

    expect(requests.queryFn).toHaveBeenCalledTimes(1);
    requests.unsubscribe();
  });
});

describe('Y05 — la liste blanche vient du registre du lot U05, pas d\'un deuxieme registre', () => {
  beforeEach(() => resetReturnRefreshCooldown());

  test('elle nomme les familles qui bougent sans moi, chacune une seule fois', () => {
    const roots = getReturnRefreshQueryKeys().map(([root]) => root);

    [
      'app-bootstrap',
      'clubInterestRequests',
      'clubMembershipRequests',
      'event',
      'eventAttendance',
      'eventParticipations',
      'events',
      'facility-override-requests',
      'get-me',
      'home-summary',
      'pending-featured-requests',
      'pendingEvents',
      'planning',
      'requestsHub',
      'team',
      'teamMembershipRequests',
      'teams',
    ].forEach((root) => expect(roots).toContain(root));

    expect(roots).toHaveLength(new Set(roots).size);
  });

  test('elle ne contient AUCUN catalogue ni aucune liste de reference', () => {
    const roots = getReturnRefreshQueryKeys().map(([root]) => root);

    [
      'activities',
      'categories',
      'chat-messages',
      'chats',
      'clubs',
      'event-types',
      'get-roles',
      'levels',
      'places',
      'search',
      'sections',
      'subscription-catalog',
      'subscription-store-prices',
    ].forEach((root) => expect(roots).not.toContain(root));
  });
});

describe('Y05 — les regles de base', () => {
  beforeEach(() => resetReturnRefreshCooldown());

  test('un retour vient de `background`, `unknown` ou `extension` — jamais `inactive`', () => {
    expect(isReturnToForeground('background', 'active')).toBe(true);
    expect(isReturnToForeground('unknown', 'active')).toBe(true);
    expect(isReturnToForeground('extension', 'active')).toBe(true);
    expect(isReturnToForeground('inactive', 'active')).toBe(false);
    expect(isReturnToForeground('active', 'active')).toBe(false);
    expect(isReturnToForeground('background', 'inactive')).toBe(false);
    expect(isReturnToForeground(null, 'active')).toBe(false);
  });

  test('le verrou anti-rafale se relache une fois le delai passe', () => {
    const queryClient = { invalidateQueries: jest.fn() };

    expect(refreshOnReturn(queryClient, 'fg', 1000)).toBe(true);
    expect(refreshOnReturn(queryClient, 'fg', 1000 + RETURN_REFRESH_COOLDOWN_MS - 1)).toBe(false);
    expect(refreshOnReturn(queryClient, 'fg', 1000 + RETURN_REFRESH_COOLDOWN_MS)).toBe(true);

    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(
      getReturnRefreshQueryKeys().length * 2,
    );
  });

  test('seule une erreur SANS reponse HTTP compte comme une coupure reseau', () => {
    expect(isNetworkOutageError({ message: 'Network Error' })).toBe(true);
    expect(isNetworkOutageError({ status: 0 })).toBe(true);
    expect(isNetworkOutageError({ status: 403 })).toBe(false);
    expect(isNetworkOutageError({ response: { status: 500 } })).toBe(false);
    expect(isNetworkOutageError(null)).toBe(false);
  });
});
