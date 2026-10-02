/* eslint-disable max-len -- titres et attendus en francais, lus tels quels */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchStatsPromptHost from '../MatchStatsPromptHost';

// FINITIONS8 · POINT 7 (tournee 9) — LE RAPPEL D'APRES-MATCH ETAIT REPROPOSE A CHAQUE CHANGEMENT
// DE COMPTE (et a chaque demarrage) : « Plus tard » se retenait en memoire, pour la session, sous
// une cle commune a tous. Il se retient desormais PAR COMPTE, 24 h, dans le stockage du telephone
// (meme regle que l avis d entrainement : TrainingReviewPromptHost.FINITIONS8.test.js).
// Banc : les doublures de STMATCHRappels.test.js (fabrique), avec le VRAI gestionnaire de fenetres.

const mockLireRappels = jest.fn();
const mockLireFeuille = jest.fn();
const mockEnvoyerReponse = jest.fn(async () => ({}));
const mockEnvoyerReponseLigue = jest.fn(async () => ({}));
const mockEnregistrerScore = jest.fn(async () => ({}));
const mockNaviguer = jest.fn();

jest.mock('@/services/matchStats/matchStatsService', () => ({
  getEventMatchStats: (...args) => mockLireFeuille(...args),
  getPendingMatchStatsPrompts: () => mockLireRappels(),
  saveEventMatchResult: (...args) => mockEnregistrerScore(...args),
  saveEventMyMatchResponse: (...args) => mockEnvoyerReponse(...args),
  saveLeagueMyMatchResponse: (...args) => mockEnvoyerReponseLigue(...args),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ isBootstrapResolved: true }),
}));
/** Le compte connecte : change quand on « change de compte ». */
/** @type {any} */
let mockAuth;
/** Le stockage du telephone (MMKV) : il SURVIT a un redemarrage de l app. */
const mockStockage = new Map();
jest.mock('@/store/appContext', () => ({
  storage: {
    delete: (/** @type {string} */ cle) => mockStockage.delete(cle),
    getString: (/** @type {string} */ cle) => mockStockage.get(cle),
    set: (/** @type {string} */ cle, /** @type {string} */ valeur) => mockStockage.set(cle, valeur),
  },
  useAppContext: () => [{ auth: mockAuth }, () => {}],
}));
jest.mock('@/navigation/navigationService', () => ({
  getCurrentRouteName: () => 'HomeTab',
  navigate: (...args) => mockNaviguer(...args),
  navigationRef: { addListener: () => () => {}, isReady: () => true },
}));
// Le VRAI gestionnaire de fenetres : c est lui qui retient « Plus tard ».
jest.mock('@/context/StartupPhaseContext', () => ({
  useStartupPhase: () => ({
    activeStartupPromptId: null,
    canShowGlobalStartupPrompt: true,
    canShowLocalScreenPrompt: true,
    currentRouteName: 'HomeTab',
    markStartupPromptDismissed: () => {},
    markStartupPromptShown: () => {},
    phase: 'steady_state',
  }),
}));
jest.mock('@/context/BlockingOverlayContext', () => ({
  useBlockingOverlayLifecycle: () => {},
  useBlockingOverlayPrompt: () => true,
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BottomModalDouble(/** @type {any} */ props) {
    if (!props.isVisible) return null;
    return react.createElement(rn.View, { testID: `fenetre-${props.webPresentation || 'feuille'}` }, props.children);
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(
      rn.TouchableOpacity,
      { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
      react.createElement(rn.Text, null, props.title || ''),
    );
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

/**
 * Le repli de t(), interpolé, avec les pluriels de i18next.
 * @param {string} cle - La clé.
 * @param {any} a - Le repli, ou les options.
 * @param {any} b - Les options, quand un repli est donné.
 * @returns {string} Le texte rendu.
 */
const mockTraduire = (/** @type {string} */ cle, /** @type {any} */ a, /** @type {any} */ b) => {
  const options = typeof a === 'string' ? b : a;
  let modele = typeof a === 'string' ? a : cle;
  if (options && typeof options.count === 'number' && options.defaultValue_one) {
    // Règle française (CLDR) : 0 et 1 sont au singulier (« 0 passe »).
    modele = options.count <= 1 ? options.defaultValue_one : options.defaultValue_other;
  }
  return String(modele).replace(/\{\{(\w+)\}\}/g, (tout, nom) => (
    options && nom in options ? String(options[nom]) : tout
  ));
};
jest.mock('i18next', () => ({ __esModule: true, default: { t: (...args) => mockTraduire(...args) } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => mockTraduire(...args) }),
}));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

// Le premier montage transforme beaucoup de modules : à froid, sur une machine chargée,
// il dépasse les 5 s par défaut (même réglage que EventDetailsN3CarteMatch).
jest.setTimeout(30000);

// Le VRAI fournisseur, charge hors des `import` : `import/order` et `perfectionist`
// exigent deux ordres contraires entre `@/context/...` et `../...`.
const { PopupManagerProvider } = jest.requireActual('@/context/PopupManagerContext');

const FIN = '2026-09-05T18:00:00.000Z';
const EQUIPE = { documentId: 'u15', name: 'U15' };

const rappelEntraineur = (/** @type {any} */ champs = {}) => ({
  actionType: 'score_entry',
  endedAt: FIN,
  eventId: 'match-21h',
  key: 'event:match-21h:u15:score',
  label: 'AS Montrivage — adversaire à confirmer',
  reportStatus: null,
  reviewRequired: false,
  score: { available: false, scoreAgainst: null, scoreFor: null },
  sourceType: 'event',
  sport: 'football',
  state: 'score_required',
  team: EQUIPE,
  ...champs,
});
const charge = (/** @type {any[]} */ items) => ({
  items,
  nextPrompt: items.find((item) => item.solicited !== false) || null,
  totalPending: items.length,
});

const KARIM = { token: 'jeton-karim', user: { documentId: 'karim' } };
const UN_AUTRE_ENTRAINEUR = { token: 'jeton-sam', user: { documentId: 'sam' } };

// React Query publie ses resultats par `setTimeout(0)` : on laisse passer des tours d'horloge.
const vider = async () => {
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  }
};

const textes = (/** @type {any} */ racine) => racine.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).filter((c) => typeof c === 'string').join(''))
  .filter(Boolean);
const bouton = (/** @type {any} */ racine, /** @type {string} */ titre) => racine
  .findAll((/** @type {any} */ n) => n.props?.accessibilityRole === 'button'
    && typeof n.props.onPress === 'function'
    && n.findAllByType(Text).some((/** @type {any} */ t) => [].concat(t.props.children).join('') === titre))[0];

/** @type {any[]} */
const ouverts = [];
/**
 * L application, pour un client de requetes donne.
 * @param {any} client - Le client.
 * @returns {import('react').ReactElement} L arbre.
 */
const lApp = (client) => (
  <QueryClientProvider client={client}>
    <PopupManagerProvider>
      <MatchStatsPromptHost />
    </PopupManagerProvider>
  </QueryClientProvider>
);
/**
 * Demarre l application (un gestionnaire NEUF : la memoire de session est vide).
 * @param {any} compte - Le compte connecte.
 * @returns {Promise<{ arbre: any, client: any }>} L application montee.
 */
const demarrer = async (compte) => {
  mockAuth = compte;
  mockLireRappels.mockResolvedValue(charge([rappelEntraineur()]));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(lApp(client));
  });
  ouverts.push(arbre);
  await vider();
  return { arbre, client };
};
const rappelOuvert = (/** @type {any} */ arbre) => Boolean(bouton(arbre.root, 'Plus tard'));
const plusTard = async (/** @type {any} */ arbre) => {
  await act(async () => { bouton(arbre.root, 'Plus tard').props.onPress(); });
  await vider();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockStockage.clear();
});
afterEach(() => {
  jest.restoreAllMocks();
  act(() => { ouverts.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('FINITIONS8 · point 7 — le rappel d apres-match : « Plus tard » par compte, 24 h', () => {
  it('jumeau : sans « Plus tard », le rappel s ouvre', async () => {
    const { arbre } = await demarrer(KARIM);

    expect(rappelOuvert(arbre)).toBe(true);
    expect(textes(arbre.root).join(' | ')).toContain('AS Montrivage');
  });

  it('🚨 apres un redemarrage, Karim ne le revoit pas', async () => {
    const { arbre: avant } = await demarrer(KARIM);
    await plusTard(avant);
    expect(rappelOuvert(avant)).toBe(false);
    act(() => { avant.unmount(); });

    const { arbre: apres } = await demarrer(KARIM);

    expect(rappelOuvert(apres)).toBe(false);
  });

  it('🚨 ferme chez Karim, il s ouvre chez l autre entraineur de l equipe', async () => {
    const { arbre, client } = await demarrer(KARIM);
    await plusTard(arbre);

    mockAuth = UN_AUTRE_ENTRAINEUR;
    act(() => { arbre.update(lApp(client)); });
    await vider();

    expect(rappelOuvert(arbre)).toBe(true);
  });

  it('le lendemain, le rappel revient', async () => {
    const maintenant = Date.now();
    const { arbre: avant } = await demarrer(KARIM);
    await plusTard(avant);
    act(() => { avant.unmount(); });

    jest.spyOn(Date, 'now').mockReturnValue(maintenant + (25 * 60 * 60 * 1000));
    const { arbre: lendemain } = await demarrer(KARIM);

    expect(rappelOuvert(lendemain)).toBe(true);
  });
});
