/* eslint-disable max-len -- titres et attendus en francais, lus tels quels (ST-MATCH) */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchStatsPromptHost from '../MatchStatsPromptHost';

// ==========================================================================
// 🔔 ST-MATCH (écrans 3 et 4, design des statistiques validé le 02/10) — LA
// FENÊTRE « APRÈS LE MATCH », côté JOUEUR et côté ENTRAÎNEUR.
//
// Joueur (écran 3) : la question « As-tu joué ce match ? » tout de suite, trois
// réponses, deux envoyées d'un appui ; le brouillon montre ce qui est rempli.
// Entraîneur (écran 4) : le score en − / + dans la fenêtre, puis la feuille ;
// la vérification dit ce qui a changé.
// Retirés (le témoin les cherche) : « Source : Retour perso / Evenement »,
// « Renseigner mes stats », « Je ne sais pas mes stats », « Score officiel en
// attente » en or.
// ==========================================================================

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
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton-test' } }, () => {}],
}));
jest.mock('@/navigation/navigationService', () => ({
  getCurrentRouteName: () => 'HomeTab',
  navigate: (...args) => mockNaviguer(...args),
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

const FIN = '2026-09-05T18:00:00.000Z';
const EQUIPE = { documentId: 'u15', name: 'U15' };

const rappelJoueur = (/** @type {any} */ champs = {}) => ({
  actionType: 'player_self_report',
  endedAt: FIN,
  eventId: 'match-19h',
  key: 'event:match-19h:u15:self',
  label: 'AS Montrivage — Test-COMPO',
  personalResponse: null,
  score: {
    available: true, scoreAgainst: 1, scoreFor: 2, source: 'manual',
  },
  sourceType: 'event',
  sport: 'football',
  state: 'todo',
  team: EQUIPE,
  ...champs,
});
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

/** @type {any} */
let arbre;
// React Query publie ses résultats par `setTimeout(0)` (notifyManager) : on laisse passer
// des tours d'horloge, pas seulement des micro-tâches.
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
const parId = (/** @type {any} */ racine, /** @type {string} */ id) => racine
  .findAll((/** @type {any} */ n) => n.props?.testID === id)[0];
const bouton = (/** @type {any} */ racine, /** @type {string} */ titre) => racine
  .findAll((/** @type {any} */ n) => n.props?.accessibilityRole === 'button'
    && typeof n.props.onPress === 'function'
    && n.findAllByType(Text).some((/** @type {any} */ t) => [].concat(t.props.children).join('') === titre))[0];

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('ST-MATCH écran 3 — la fenêtre du JOUEUR', () => {
  test('🚨 état 1 — la question tout de suite, trois réponses, le résultat ; plus de « Source »', async () => {
    const racine = await monter(charge([
      rappelJoueur(),
      rappelJoueur({ eventId: 'match-21h', key: 'event:match-21h:u15:self', label: 'AS Montrivage — adversaire à confirmer' }),
    ]));
    const vus = textes(racine);

    expect(vus).toContain('As-tu joué ce match ?');
    expect(vus).toEqual(expect.arrayContaining(['J\'ai joué', 'J\'étais là sans jouer', 'Je n\'étais pas concerné·e']));
    expect(vus.join(' | ')).toContain('Victoire 2 - 1');
    expect(vus).toContain('Encore 1 match à remplir');
    expect(vus.join(' ')).not.toMatch(/Source|Retour perso|Renseigner mes stats|Je ne sais pas mes stats/);
    // Sur le site, la feuille du bas devient une fenêtre centrée de 680.
    expect(parId(racine, 'fenetre-dialog')).toBeTruthy();
  });

  test('🚨 état 4 — « J étais là sans jouer » s envoie d un appui, et la fenêtre dit merci', async () => {
    const racine = await monter(charge([
      rappelJoueur(),
      rappelJoueur({ eventId: 'match-21h', key: 'event:match-21h:u15:self', label: 'AS Montrivage — adversaire à confirmer' }),
    ]));

    await act(async () => {
      await parId(racine, 'st-match-rappel-choix-present_no_play').props.onPress();
    });
    await vider();

    expect(mockEnvoyerReponse).toHaveBeenCalledWith('match-19h', { participation: 'present_no_play', teamId: 'u15' });
    const vus = textes(racine);
    expect(vus).toContain('C\'est noté : présent sans jouer.');
    expect(vus).toContain('Il te reste 1 match');
    expect(vus).toContain('AS Montrivage — adversaire à confirmer');
  });

  test('« Je n étais pas concerné·e » s envoie aussi sans formulaire ; « J ai joué » ouvre le formulaire', async () => {
    const racine = await monter(charge([rappelJoueur()]));

    act(() => { parId(racine, 'st-match-rappel-choix-played').props.onPress(); });
    expect(mockNaviguer).toHaveBeenCalledWith('EventStack', expect.objectContaining({ screen: 'PlayerMatchResponse' }));
    expect(mockEnvoyerReponse).not.toHaveBeenCalled();
  });

  test('état 2 — score pas encore saisi : la phrase dit que ce n est pas à lui de le saisir', async () => {
    const racine = await monter(charge([rappelJoueur({ score: { available: false } })]));

    expect(textes(racine)).toContain('L\'entraîneur n\'a pas encore saisi le score.');
    expect(textes(racine).join(' ')).not.toContain('Victoire');
  });

  test('état 3 — brouillon : 90 · 1 · 0 · —, ce qui reste, et « Reprendre ma réponse »', async () => {
    const racine = await monter(charge([rappelJoueur({
      personalResponse: {
        minutesPlayed: 90, selfRating: null, sportPayload: { assists: 0, goals: 1 }, teamRating: null,
      },
      state: 'draft',
    })]));
    const vus = textes(racine);

    expect(vus).toEqual(expect.arrayContaining(['Brouillon', '90', 'minutes', '1', 'but', '0', 'passe', '—', 'ta note']));
    expect(vus).toContain('Il te reste ta note et celle de l\'équipe.');
    expect(bouton(racine, 'Reprendre ma réponse')).toBeTruthy();
  });

  test('🔒 « c oui » — un rappel non sollicité (non convoqué) n ouvre AUCUNE fenêtre', async () => {
    const racine = await monter(charge([rappelJoueur({ solicited: false })]));

    expect(parId(racine, 'st-match-rappel')).toBeUndefined();
  });
});

describe('ST-MATCH écran 4 — la fenêtre de l ENTRAÎNEUR', () => {
  test('🚨 état 1 puis 2 — le score en − / + dans la fenêtre, puis la feuille, sans quitter la fenêtre', async () => {
    mockLireFeuille.mockResolvedValue({
      playerResponses: [{ status: null }],
      report: null,
      score: { available: false },
    });
    const racine = await monter(charge([rappelEntraineur()]));

    expect(textes(racine)).toContain('Après le match · étape 1 sur 3');
    expect(textes(racine)).toContain('0 sur 1 joueur a répondu');
    const plusPourNous = racine.findAll((n) => n.props?.accessibilityLabel === 'Un but de plus pour U15')[0];
    const plusPourEux = racine.findAll((n) => n.props?.accessibilityLabel === 'Un but de plus pour l\'adversaire')[0];
    act(() => { plusPourNous.props.onPress(); });
    act(() => { plusPourNous.props.onPress(); });
    act(() => { plusPourEux.props.onPress(); });
    await act(async () => { await bouton(racine, 'Valider le score').props.onPress(); });
    await vider();

    expect(mockEnregistrerScore).toHaveBeenCalledWith('match-21h', { scoreAgainst: 1, scoreFor: 2, teamId: 'u15' });
    const vus = textes(racine);
    expect(vus).toContain('Score enregistré : 2 - 1');
    expect(vus).toContain('Après le match · étape 2 sur 3');
    expect(bouton(racine, 'Saisir la feuille')).toBeTruthy();
  });

  test('état 4 — la vérification dit CE QUI a changé (2 - 2 au lieu de 2 - 1)', async () => {
    mockLireFeuille.mockResolvedValue({
      playerResponses: [{ status: 'submitted' }],
      report: { scoreAgainst: 1, scoreFor: 2, status: 'final' },
    });
    const racine = await monter(charge([rappelEntraineur({
      actionType: 'coach_team_review',
      key: 'event:match-21h:u15:team',
      reviewRequired: true,
      score: {
        available: true, scoreAgainst: 2, scoreFor: 2, source: 'external_sync',
      },
      state: 'review_required',
    })]));

    expect(textes(racine)).toContain('Le score officiel a changé');
    expect(textes(racine)).toContain('La fédération indique 2 - 2, ta feuille dit 2 - 1. Vérifie les buts, puis republie.');
    expect(bouton(racine, 'Vérifier la feuille')).toBeTruthy();
  });

  test('état 3 — feuille en brouillon : ce qui manque, en une ligne', async () => {
    mockLireFeuille.mockResolvedValue({
      playerResponses: [{ status: 'submitted' }],
      report: { collectiveRating: null, status: 'draft' },
    });
    const racine = await monter(charge([rappelEntraineur({
      actionType: 'coach_team_review',
      key: 'event:match-21h:u15:team',
      reportStatus: 'draft',
      score: { available: true, scoreAgainst: 1, scoreFor: 2 },
      state: 'draft',
    })]));

    expect(textes(racine)).toContain('Il manque ta note d\'équipe. 1 sur 1 joueur a répondu');
    expect(bouton(racine, 'Reprendre la feuille')).toBeTruthy();
  });
});
