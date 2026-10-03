/* eslint-disable max-len -- titres et attendus en francais, lus tels quels */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchStatsPromptHost from '../MatchStatsPromptHost';

// ==========================================================================
// FINITIONS11-STATS · point 2 (écran 1, planche « Rappel d'après-match de l'entraîneur ») —
// LA FENÊTRE DE L'ENTRAÎNEUR NOMME L'ADVERSAIRE.
//
// La planche : « AS Montrivage — Test-COMPO » en titre, et « AS Montrivage — adversaire à
// confirmer » tant qu'il n'est pas connu. Le serveur envoie désormais `opponentName` dans le
// rappel d'entraîneur (`null` s'il est inconnu) ; le club vient des équipes que l'entraîneur
// entraîne. Un serveur d'AVANT ne rend pas le champ : la fenêtre garde son titre d'avant
// (`label`) — c'est le témoin « serveur d'avant » exigé (SERVEUR AVANT L'APP).
// ==========================================================================

const mockLireRappels = jest.fn();
const mockLireFeuille = jest.fn();

jest.mock('@/services/matchStats/matchStatsService', () => ({
  getEventMatchStats: (...args) => mockLireFeuille(...args),
  getPendingMatchStatsPrompts: () => mockLireRappels(),
  saveEventMatchResult: jest.fn(async () => ({})),
  saveEventMyMatchResponse: jest.fn(async () => ({})),
  saveLeagueMyMatchResponse: jest.fn(async () => ({})),
}));
/** @type {any} */
let mockUtilisateur = null;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ isBootstrapResolved: true, userData: mockUtilisateur }),
}));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton-test' } }, () => {}],
}));
jest.mock('@/navigation/navigationService', () => ({
  getCurrentRouteName: () => 'HomeTab',
  navigate: jest.fn(),
  navigationRef: { addListener: () => () => {}, isReady: () => true },
}));
jest.mock('@/context/PopupManagerContext', () => ({
  usePopupEligibility: () => ({
    canShow: true,
    descriptor: { id: 'rappel', priority: 1 },
    dismiss: () => {},
    markShown: () => {},
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
    return react.createElement(rn.View, null, props.children);
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

jest.setTimeout(30000);

const KARIM = {
  documentId: 'karim',
  trainedTeams: [{ club: { name: 'AS Montrivage' }, documentId: 'u15', name: 'U15' }],
};

const rappelEntraineur = (/** @type {any} */ champs = {}) => ({
  actionType: 'score_entry',
  endedAt: '2026-09-05T18:00:00.000Z',
  eventId: 'match-21h',
  key: 'event:match-21h:u15:score',
  label: 'Match du 05/09',
  reportStatus: null,
  reviewRequired: false,
  score: { available: false, scoreAgainst: null, scoreFor: null },
  sourceType: 'event',
  sport: 'football',
  state: 'score_required',
  team: { documentId: 'u15', name: 'U15' },
  ...champs,
});
const charge = (/** @type {any[]} */ items) => ({ items, nextPrompt: items[0] || null, totalPending: items.length });

/** @type {any} */
let arbre;
const vider = async () => {
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  }
};
const monter = async (/** @type {any} */ payload) => {
  mockLireRappels.mockResolvedValue(payload);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <MatchStatsPromptHost />
      </QueryClientProvider>,
    );
  });
  await vider();
  return arbre.root;
};
const textes = (/** @type {any} */ racine) => racine.findAllByType(Text)
  .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).filter((c) => typeof c === 'string').join(''))
  .filter(Boolean);
const parEtiquette = (/** @type {any} */ racine, /** @type {string} */ etiquette) => racine
  .findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === etiquette);

beforeEach(() => {
  jest.clearAllMocks();
  mockUtilisateur = KARIM;
  mockLireFeuille.mockResolvedValue({ playerResponses: [{ status: null }], report: null, score: { available: false } });
});
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('FINITIONS11 · point 2 — la fenêtre de l entraîneur nomme l adversaire', () => {
  test('1 · 🔴 l adversaire connu : « AS Montrivage — Test-COMPO », et le compteur de droite le nomme', async () => {
    const racine = await monter(charge([rappelEntraineur({ opponentName: 'Test-COMPO' })]));
    const vus = textes(racine);

    expect(vus).toContain('AS Montrivage — Test-COMPO');
    expect(vus).not.toContain('Match du 05/09');
    expect(vus).toContain('Test-COMPO');
    expect(vus).not.toContain('Adversaire');
    expect(parEtiquette(racine, 'Un but de plus pour Test-COMPO')).not.toHaveLength(0);
  });

  test('2 · 🔴 adversaire inconnu (`null`) : « AS Montrivage — adversaire à confirmer »', async () => {
    const racine = await monter(charge([rappelEntraineur({ opponentName: null })]));
    const vus = textes(racine);

    expect(vus).toContain('AS Montrivage — adversaire à confirmer');
    expect(vus).toContain('Adversaire');
    expect(parEtiquette(racine, 'Un but de plus pour l\'adversaire')).not.toHaveLength(0);
  });

  test('3 · 🔒 serveur d AVANT (pas de champ `opponentName`) : le titre d avant, rien ne casse', async () => {
    const racine = await monter(charge([rappelEntraineur({ label: 'Match VS FC Voisin' })]));
    const vus = textes(racine);

    expect(vus).toContain('Match VS FC Voisin');
    expect(vus.join(' ')).not.toContain('adversaire à confirmer');
    expect(vus).toContain('Adversaire');
  });

  test('4 · 🔴 club inconnu : l équipe tient le camp de gauche, « U15 — Test-COMPO » (comme la feuille de match)', async () => {
    mockUtilisateur = { documentId: 'karim', trainedTeams: [] };
    const racine = await monter(charge([rappelEntraineur({ opponentName: 'Test-COMPO' })]));

    expect(textes(racine)).toContain('U15 — Test-COMPO');
  });

  test('5 · 🔒 un rappel de LIGUE garde son titre', async () => {
    const racine = await monter(charge([rappelEntraineur({
      eventId: undefined, label: 'Les Lions VS Les Aigles', matchId: 'ligue-1', opponentName: 'Les Aigles', sourceType: 'league',
    })]));

    expect(textes(racine)).toContain('Les Lions VS Les Aigles');
  });
});
