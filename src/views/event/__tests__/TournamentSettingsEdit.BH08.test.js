/* eslint-disable max-len -- les témoins se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import TournamentSettingsEdit from '../TournamentSettingsEdit';

// ==========================================================================
// BUGHUNT BH08 (24/10) — P8-13 : 0 point pour une victoire ou un nul est un
// choix d organisateur ; `|| 3` et `|| 1` le remplaçaient en silence.
// ==========================================================================

const mockUpdateEvent = jest.fn(() => Promise.resolve({}));
/** @type {any} */
let mockEvent = null;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({ canManageEvent: () => true }) }));
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(rn.TouchableOpacity, { accessibilityLabel: props.title, onPress: props.onPress }, react.createElement(rn.Text, null, props.title || ''));
  };
});
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => (/** @type {any} */ { children }) => children);
jest.mock('@/components/templates/ScreenContainer', () => (/** @type {any} */ { children }) => children);
jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({
    data: mockEvent, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/event/eventService', () => ({
  updateEvent: (/** @type {any} */ ...args) => mockUpdateEvent(...args),
}));

/** @type {any[]} */
const montes = [];

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
});

describe('BH08 · P8-13 — barème de points du tournoi', () => {
  test('0 point pour la victoire et le nul part tel quel au serveur', async () => {
    mockEvent = {
      documentId: 'evt-1',
      tournamentConfig: {
        formatMode: 'round_robin', pointsDraw: 0, pointsLoss: 0, pointsWin: 0,
      },
    };
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
    /** @type {any} */
    let arbre = null;
    await act(async () => {
      arbre = renderer.create(
        <QueryClientProvider client={client}>
          <TournamentSettingsEdit navigation={{ goBack: jest.fn() }} route={{ params: { eventId: 'evt-1' } }} />
        </QueryClientProvider>,
      );
    });
    montes.push(arbre);

    const enregistrer = arbre.root.findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityLabel === 'Enregistrer' && typeof noeud.props?.onPress === 'function')[0];
    await act(async () => { enregistrer.props.onPress(); });

    expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
    const config = mockUpdateEvent.mock.calls[0][0].eventData.tournamentConfig;
    expect(config.pointsWin).toBe(0);
    expect(config.pointsDraw).toBe(0);
  });
});

// CORR-EVENEMENTS point 129 (recette du site, 30/10) — un effectif minimum de 0 était accepté, et
// 2 poules pour 2 équipes donnaient 0 match. Décision B : borner les réglages (effectif ≥ 1,
// poules ≤ équipes ÷ 2).
describe('CORR-EVENEMENTS 129 — des réglages de tournoi qui peuvent marcher', () => {
  const monter = async (/** @type {any} */ evenement) => {
    mockEvent = evenement;
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
    /** @type {any} */
    let arbre = null;
    await act(async () => {
      arbre = renderer.create(
        <QueryClientProvider client={client}>
          <TournamentSettingsEdit navigation={{ goBack: jest.fn() }} route={{ params: { eventId: 'evt-1' } }} />
        </QueryClientProvider>,
      );
    });
    montes.push(arbre);
    return arbre;
  };
  const texte = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());
  const enregistrer = async (/** @type {any} */ arbre) => {
    const bouton = arbre.root.findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityLabel === 'Enregistrer' && typeof noeud.props?.onPress === 'function')[0];
    await act(async () => { bouton.props.onPress(); });
  };
  const equipesAcceptees = (/** @type {number} */ nombre) => Array.from({ length: nombre }, (_v, index) => ({
    documentId: `eq-${index}`, name: `Équipe ${index + 1}`, status: 'accepted',
  }));

  test('🐞 un effectif minimum de 0 est refusé, avec un message sous le champ', async () => {
    mockUpdateEvent.mockClear();
    const arbre = await monter({
      documentId: 'evt-1',
      tournamentConfig: { formatMode: 'round_robin', minRosterSize: 0 },
    });
    const champ = arbre.root.findAll((/** @type {any} */ n) => n.props?.placeholder === 'Ex. 5' && typeof n.props?.onChangeText === 'function')[0];
    await act(async () => { champ.props.onChangeText('0'); });

    expect(texte(arbre)).toContain('L’effectif minimum est d’au moins 1 joueur.');
    await enregistrer(arbre);
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  test('🐞 2 poules pour 2 équipes acceptées sont refusées', async () => {
    mockUpdateEvent.mockClear();
    const arbre = await monter({
      documentId: 'evt-1',
      tournamentConfig: { formatMode: 'groups_only', groupCount: 2 },
      tournamentTeams: equipesAcceptees(2),
    });

    // La doublure de traduction rend la clé ; la phrase est gardée par textesCORREVENEMENTS.
    expect(texte(arbre)).toContain('tournamentSettingsEdit.tooManyGroups');
    await enregistrer(arbre);
    expect(mockUpdateEvent).not.toHaveBeenCalled();
  });

  test('2 poules pour 4 équipes passent', async () => {
    mockUpdateEvent.mockClear();
    const arbre = await monter({
      documentId: 'evt-1',
      tournamentConfig: { formatMode: 'groups_only', groupCount: 2 },
      tournamentTeams: equipesAcceptees(4),
    });

    expect(texte(arbre)).not.toContain('tournamentSettingsEdit.tooManyGroups');
    await enregistrer(arbre);
    expect(mockUpdateEvent).toHaveBeenCalledTimes(1);
  });
});
