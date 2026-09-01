import { QueryClient } from '@tanstack/react-query';

import { reviveSharedSocket } from '@/services/socket/socketManager';

import { resetReturnRefreshCooldown, startQueryRefreshBridge } from '@/app/queryRefreshOnReturn';

/**
 * PERF1 - LE REVEIL DE LA SOCKET AU RETOUR DANS L'APP.
 *
 * Apres un deploiement, socket.io abandonne (5 tentatives, ~34 s a ~134 s) alors
 * que le serveur met 60 a 150 s a redemarrer : la socket reste morte pour
 * toujours. Le seul moment utile pour la ranimer est le retour au premier plan -
 * iOS suspend les minuteurs en arriere-plan de toute facon - et le seul ecouteur
 * AppState de portee application entiere est celui de `queryRefreshOnReturn`.
 *
 * Le piege que ces temoins verrouillent : le gestionnaire porte un retour
 * anticipe hors-ligne (`if (!online.isOnline()) { setOnline(true); return; }`),
 * et un redemarrage serveur fait JUSTEMENT passer online a false. Un reveil
 * greffe APRES ce retour anticipe serait saute precisement dans le cas qui
 * motive le lot. Le temoin « hors-ligne deduit » reste rouge sur cette erreur.
 *
 * `socketManager` est remplace en bloc : ici on prouve le CABLAGE du pont, pas
 * la mecanique de la socket (couverte par socketManagerPERF1.test.js).
 */

jest.mock('@/services/socket/socketManager', () => ({
  reviveSharedSocket: jest.fn(),
}));

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
 * Un faux focusManager, pour que le pont ait a qui parler.
 * @returns {any} Le faux focusManager.
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

describe('PERF1 - le retour au premier plan ranime la socket abandonnee', () => {
  /** @type {QueryClient} */
  let queryClient;
  let stopBridge;
  let appState;
  let focus;
  let online;

  /**
   * Monte le pont avec les fausses dependances, online a l'etat demande.
   * @param {boolean} [initialOnline] L'etat reseau de depart.
   * @returns {void}
   */
  const mountBridge = (initialOnline = true) => {
    appState = createFakeAppState('active');
    focus = createFakeFocus();
    online = createFakeOnline(initialOnline);
    stopBridge = startQueryRefreshBridge(queryClient, { appState, focus, online });
    reviveSharedSocket.mockClear();
  };

  beforeEach(() => {
    resetReturnRefreshCooldown();
    jest.useFakeTimers();
    queryClient = new QueryClient({
      defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
    });
  });

  afterEach(() => {
    stopBridge();
    queryClient.clear();
    jest.useRealTimers();
  });

  it('reveille la socket au vrai retour au premier plan', () => {
    mountBridge();

    appState.emit('background');
    appState.emit('active');

    expect(reviveSharedSocket).toHaveBeenCalledTimes(1);
  });

  it('reveille la socket MEME en hors-ligne deduit - le cas du deploiement', () => {
    // Un serveur qui redemarre fait passer online a false (3 echecs reseau).
    // Le reveil doit etre AVANT le retour anticipe du gestionnaire, sinon il
    // est saute exactement quand on en a besoin.
    mountBridge(false);

    appState.emit('background');
    appState.emit('active');

    expect(reviveSharedSocket).toHaveBeenCalledTimes(1);
  });

  it('ne reveille rien sur inactive -> active (centre de controle iOS)', () => {
    mountBridge();

    appState.emit('inactive');
    appState.emit('active');

    expect(reviveSharedSocket).not.toHaveBeenCalled();
  });

  it('n\'est pas bloque par le verrou anti-rafale - et ne le contourne pas', () => {
    mountBridge();
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    appState.emit('background');
    appState.emit('active');
    expect(invalidateSpy).toHaveBeenCalled();

    invalidateSpy.mockClear();
    appState.emit('background');
    appState.emit('active');

    // Le reveil rejoue (il est deja un no-op quand la socket va bien) ; la
    // relecture, elle, reste tenue par le verrou de 15 s.
    expect(reviveSharedSocket).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
