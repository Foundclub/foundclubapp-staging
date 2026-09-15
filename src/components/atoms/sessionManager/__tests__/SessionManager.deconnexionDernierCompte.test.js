import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import SessionManager from '../SessionManager';

// DECO (2026-09-15) — « Deconnexion » du DERNIER compte : la session revient toute seule.
//
// Sur le site, la cause est prouvee (web : tests/components/deconnexion-dernier-compte.spec.ts).
// Sur l'app mobile, Adel signale le meme symptome mais le fournisseur web n'existe pas.
// Le seul composant mobile qui REOUVRE une session sans geste de l'utilisateur est
// `SessionManager` : il ecoute Firebase et appelle `login({})` quand il voit un
// utilisateur Firebase alors que le store n'a pas de session.
//
// Ce fichier mesure les pistes de ce composant, avec le VRAI reducteur du store :
//   1. meme montage : Firebase reemet l'utilisateur apres la deconnexion ;
//   2. nouveau montage (demarrage a froid) : le store est vide mais Firebase a garde
//      l'utilisateur — ce qui n'arrive que si la deconnexion n'a PAS fait `signOut`.

const mockFirebase = {
  currentUser: null,
  listeners: new Set(),
};

const mockEmitFirebaseUser = (user) => {
  mockFirebase.currentUser = user;
  mockFirebase.listeners.forEach((listener) => listener(user));
};

const mockLogin = jest.fn();

jest.mock('@/services/auth/authService', () => ({
  login: (...args) => mockLogin(...args),
  subscribeToAuthState: (listener) => {
    mockFirebase.listeners.add(listener);
    // Comme Firebase : l'abonne recoit tout de suite l'etat courant.
    listener(mockFirebase.currentUser);
    return () => mockFirebase.listeners.delete(listener);
  },
}));

jest.mock('@/services/auth/bypassPolicy', () => ({
  isFirebaseBypassEnabled: () => false,
}));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({ debug: jest.fn(), warn: jest.fn() }),
}));

// Store de test : le VRAI reducteur de l'app, sans la persistance MMKV.
jest.mock('@/store/appContext', () => {
  // Une fabrique jest.mock ne peut pas fermer sur un import de haut niveau.
  /* eslint-disable global-require */
  const React = require('react');
  const appReducer = require('@/store/appReducer').default;
  /* eslint-enable global-require */
  const StoreContext = React.createContext(null);

  return {
    TestStoreProvider: ({ children, initialState }) => {
      const value = React.useReducer(appReducer, initialState);
      global.decoStore = value;
      return React.createElement(StoreContext.Provider, { value }, children);
    },
    useAppContext: () => React.useContext(StoreContext),
  };
});

const { TestStoreProvider } = jest.requireMock('@/store/appContext');

const SESSION_A = {
  idToken: 'firebase-id-token-A',
  token: 'jeton-compte-A',
  user: { documentId: 'compte-A', firstname: 'Alice' },
};

const FIREBASE_USER_A = { uid: 'firebase-uid-A' };

const oneSessionState = () => ({
  activeSessionDocumentId: SESSION_A.user.documentId,
  auth: SESSION_A,
  authSessions: [SESSION_A],
  isAddingAccount: false,
});

const emptyState = () => ({
  activeSessionDocumentId: undefined,
  auth: undefined,
  authSessions: [],
  isAddingAccount: false,
});

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const mountSessionManager = (initialState) => {
  let tree;
  act(() => {
    tree = renderer.create(createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      createElement(TestStoreProvider, { initialState }, createElement(SessionManager)),
    ));
  });
  return tree;
};

const readStore = () => global.decoStore[0];
const dispatch = (action) => act(() => {
  global.decoStore[1](action);
});

describe('DECO — SessionManager et la deconnexion du dernier compte', () => {
  beforeEach(() => {
    mockFirebase.currentUser = null;
    mockFirebase.listeners.clear();
    mockLogin.mockReset();
    mockLogin.mockResolvedValue(SESSION_A);
  });

  test('meme montage : Firebase reemet l utilisateur apres logout, pas de session', async () => {
    mockFirebase.currentUser = FIREBASE_USER_A;
    const tree = mountSessionManager(oneSessionState());
    await flush();

    // Ce que fait `logoutMutation` : signOut Firebase, puis LOGOUT_CURRENT_SESSION.
    act(() => mockEmitFirebaseUser(null));
    dispatch({ type: 'LOGOUT_CURRENT_SESSION' });
    expect(readStore().auth).toBeUndefined();

    // Firebase reemet un utilisateur (restauration de persistance, token rafraichi…).
    act(() => mockEmitFirebaseUser(FIREBASE_USER_A));
    await flush();

    expect(mockLogin).not.toHaveBeenCalled();
    expect(readStore().auth).toBeUndefined();
    expect(readStore().authSessions).toEqual([]);

    act(() => tree.unmount());
  });

  test('demarrage a froid, store vide, Firebase deconnecte : pas de session', async () => {
    mockFirebase.currentUser = null;
    const tree = mountSessionManager(emptyState());
    await flush();

    expect(mockLogin).not.toHaveBeenCalled();
    expect(readStore().auth).toBeUndefined();

    act(() => tree.unmount());
  });

  // Caracterisation (comportement VOULU de restauration) : c'est la SEULE porte mobile
  // par laquelle une session revient seule. Elle exige que Firebase ait GARDE
  // l'utilisateur ; la deconnexion doit donc toujours faire `signOut` (voir le test
  // `authService.logout.deconnexion.test.js`).
  test('demarrage a froid, store vide, Firebase garde l utilisateur : session rendue', async () => {
    mockFirebase.currentUser = FIREBASE_USER_A;
    const tree = mountSessionManager(emptyState());
    await flush();
    await flush();

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(readStore().auth?.token).toBe(SESSION_A.token);

    act(() => tree.unmount());
  });
});
