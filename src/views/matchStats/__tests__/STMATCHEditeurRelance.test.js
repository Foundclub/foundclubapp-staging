/* eslint-disable max-len -- les libellés se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// ==========================================================================
// 🧭 MatchStatsEditor — TÉMOIN CARACTÉRISANT (E6 : le fichier n'en avait aucun).
//
// Ce qu'il décrit : la relance des retours (le bouton « Relancer les N manquant·e·s »,
// ce qu'il envoie, ce que l'écran dit après) et le bouton de publication d'une feuille
// déjà publiée. C'est le filet des points T9 (« Rapport finalise ») et ST-VUES2 (« Déjà
// relancés aujourd'hui »), et de l'écran 10 à venir.
// ==========================================================================

const mockRemind = jest.fn();
const mockStatsQuery = {
  data: /** @type {any} */ (null), isFetching: false, isLoading: false, refetch: jest.fn(),
};

// La doublure INTERPOLE les {{…}} et sait les pluriels de i18next (0 et 1 au singulier).
jest.mock('react-i18next', () => {
  const remplir = (/** @type {string} */ modele, /** @type {any} */ valeurs) => modele.replace(
    /\{\{(\w+)\}\}/g,
    (/** @type {string} */ tout, /** @type {string} */ nom) => (
      valeurs && nom in valeurs ? String(valeurs[nom]) : tout
    ),
  );
  return {
    initReactI18next: { init: jest.fn(), type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        if (typeof repli === 'string') return remplir(repli, options);
        if (repli && repli.defaultValue_one) {
          return remplir(Number(repli.count) <= 1 ? repli.defaultValue_one : repli.defaultValue_other, repli);
        }
        return cle;
      },
    }),
  };
});
jest.mock('i18next', () => ({
  __esModule: true,
  default: { language: 'fr', t: (/** @type {string} */ _cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : _cle) },
}));
jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetEventMatchStats: () => mockStatsQuery,
  useGetLeagueMatchStats: () => ({
    data: null, isFetching: false, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/matchStats/matchStatsService', () => ({
  remindEventMatchResponses: (/** @type {any[]} */ ...args) => mockRemind(...args),
  saveEventMatchStatsDraft: jest.fn(),
  saveLeagueMatchStatsDraft: jest.fn(),
  submitEventMatchStats: jest.fn(),
  submitLeagueMatchStats: jest.fn(),
}));
jest.mock('@/domains/refresh/afterAction', () => ({ invalidateAfterAction: jest.fn() }));
jest.mock('@/navigation/useBottomDockLayout', () => ({ __esModule: true, default: () => ({ sceneBottomInset: 0 }) }));
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: (/** @type {any} */ { children }) => jest.requireActual('react').createElement(View, null, children) };
});
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return { __esModule: true, default: () => jest.requireActual('react').createElement(Texte, null, 'RETOUR') };
});
jest.mock('@/components/molecules/memberAvatar/MemberAvatar', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: () => jest.requireActual('react').createElement(View) };
});
jest.mock('@/components/atoms/button/Button', () => {
  const rn = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => jest.requireActual('react').createElement(
      rn.TouchableOpacity,
      { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
      jest.requireActual('react').createElement(rn.Text, null, props.title || ''),
    ),
  };
});

// eslint-disable-next-line import/first
import MatchStatsEditor from '../MatchStatsEditor';

/** @type {any} */
let arbre = null;

const feuille = (/** @type {any} */ rapport = {}) => ({
  availablePlayers: [],
  permissions: { canManage: true, canView: true },
  playerResponses: [
    { label: 'Hugo Lemaire', status: 'submitted', userDocumentId: 'u1' },
    { label: 'Léo Durand', status: 'pending', userDocumentId: 'u2' },
    { label: 'Nina Roux', status: 'pending', userDocumentId: 'u3' },
  ],
  report: {
    needsReview: false, playerLines: [], status: 'draft', ...rapport,
  },
  score: {
    available: true, locked: false, scoreAgainst: 1, scoreFor: 2, source: 'manual', waitingOfficial: false,
  },
  sport: 'football',
  team: { documentId: 'team-1', name: 'U15' },
});

const monter = async (/** @type {any} */ donnees) => {
  mockStatsQuery.data = donnees;
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  await act(async () => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(MatchStatsEditor, {
        navigation: { goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() },
        route: { params: { eventId: 'event-1', sourceType: 'event', teamId: 'team-1' } },
      }),
    ));
  });
  return arbre.root;
};

const textes = (/** @type {any} */ racine) => racine.findAllByType(Text)
  .map((/** @type {any} */ n) => [].concat(n.props.children).filter((c) => typeof c === 'string' || typeof c === 'number').join(''))
  .filter(Boolean);

const appuyerSur = async (/** @type {any} */ racine, /** @type {string} */ libelle) => {
  const [cible] = racine.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && n.findAllByType(Text).some((/** @type {any} */ x) => [].concat(x.props.children).join('') === libelle));
  if (!cible) throw new Error(`Aucun bouton « ${libelle} ». Vu : ${textes(racine).join(' | ')}`);
  await act(async () => { cible.props.onPress(); });
  await act(async () => { await new Promise((fin) => { setTimeout(fin, 0); }); });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

jest.setTimeout(30000);

describe('MatchStatsEditor — la relance des retours (caractérisation)', () => {
  test('le bouton nomme combien manquent, et relance CETTE équipe de CET événement', async () => {
    mockRemind.mockResolvedValue({ missingCount: 2, remindedCount: 2 });
    const racine = await monter(feuille());

    await appuyerSur(racine, 'Relancer les 2 manquant·e·s');

    expect(mockRemind).toHaveBeenCalledWith('event-1', 'team-1');
    expect(Alert.alert).toHaveBeenCalledWith(
      'Relance envoyée',
      '2 joueur·se·s relancé·e·s pour leur retour post-match.',
    );
  });

  test('personne à relancer : l écran le dit', async () => {
    mockRemind.mockResolvedValue({ alreadyRemindedCount: 0, missingCount: 0, remindedCount: 0 });
    const racine = await monter(feuille());

    await appuyerSur(racine, 'Relancer les 2 manquant·e·s');

    expect(Alert.alert).toHaveBeenCalledWith('Relance envoyée', 'Aucune relance nécessaire pour ce match.');
  });
});

describe('MatchStatsEditor — une feuille déjà publiée (caractérisation)', () => {
  test('le bouton de publication est éteint, et il porte l état de la feuille', async () => {
    const racine = await monter(feuille({ finalizedAt: '2026-10-01T20:39:00.000Z', status: 'final' }));
    const [bouton] = racine.findAll((/** @type {any} */ n) => n.props?.accessibilityRole === 'button'
      && typeof n.props?.onPress === 'function'
      && n.findAllByType(Text).some((/** @type {any} */ x) => x.props.children === 'Rapport finalise'));

    expect(bouton).toBeTruthy();
    expect(bouton.props.disabled).toBe(true);
    // Une feuille publiée ne se relance plus d ici.
    expect(textes(racine).some((texte) => texte.startsWith('Relancer les'))).toBe(false);
  });
});
