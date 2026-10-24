/* eslint-disable max-len -- les témoins se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentMatchDetails from '../TournamentMatchDetails';

// ==========================================================================
// BUGHUNT BH08 (24/10) — la fiche d un match de tournoi.
//   · P8-19 : un match non joué (scoreA = null) n affiche pas « null » ;
//   · P8-11 : le vainqueur choisi sur un nul n est plus envoyé une fois le score corrigé ;
//   · P8-20 : une fin avant le début est refusée.
// ==========================================================================

const mockReport = jest.fn(() => Promise.resolve({}));
const mockSchedule = jest.fn(() => Promise.resolve({}));
/** @type {any} */
let mockMatch = null;

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
jest.mock('@/domains/event/eventUseCases', () => ({
  formatDateTimeToSend: (/** @type {string} */ date, /** @type {string} */ heure) => (
    date && heure ? `2026-10-24T${heure}:00.000Z` : null
  ),
}));

jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonDouble(/** @type {any} */ props) {
    return react.createElement(rn.TouchableOpacity, { accessibilityLabel: props.title, onPress: props.onPress }, react.createElement(rn.Text, null, props.title || ''));
  };
});
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => () => null);
jest.mock('@/components/atoms/tag/Tag', () => () => null);
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return (/** @type {any} */ props) => react.createElement(rn.TextInput, { onChangeText: props.onChange, testID: `champ-${props.label}`, value: props.value });
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return (/** @type {any} */ props) => react.createElement(rn.TextInput, { onChangeText: props.onChange, testID: `champ-${props.label}`, value: props.value });
});
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => (/** @type {any} */ { children }) => children);
jest.mock('@/components/templates/ScreenContainer', () => (/** @type {any} */ { children }) => children);

jest.mock('@/services/event/eventQueries', () => ({ useGetEvent: () => ({ data: { documentId: 'evt-1' } }) }));
jest.mock('@/services/facility/facilityQueries', () => ({ useGetFacilities: () => ({ data: { data: [] } }) }));
jest.mock('@/services/tournamentCompetition/tournamentCompetitionQueries', () => ({
  useGetTournamentMatch: () => ({ data: mockMatch, error: null, isLoading: false, refetch: jest.fn() }),
}));
jest.mock('@/services/tournamentCompetition/tournamentCompetitionService', () => ({
  reportTournamentMatchScore: (/** @type {any} */ ...args) => mockReport(...args),
  scheduleTournamentMatch: (/** @type {any} */ ...args) => mockSchedule(...args),
  validateTournamentMatchScore: jest.fn(),
}));

const MATCH = {
  documentId: 'm-1',
  endAt: null,
  phase: { type: 'knockout' },
  scheduledAt: null,
  scoreA: null,
  scoreB: null,
  status: 'scheduled',
  teamA: { documentId: 'ta', name: 'Lyon' },
  teamB: { documentId: 'tb', name: 'Nice' },
};

/** @type {any[]} */
const montes = [];

const monter = async (/** @type {any} */ match = MATCH) => {
  mockMatch = match;
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  /** @type {any} */
  let arbre = null;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <TournamentMatchDetails navigation={{ goBack: jest.fn() }} route={{ params: { eventId: 'evt-1', matchId: 'm-1' } }} />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre.root;
};

const champsDeScore = (/** @type {any} */ root) => root.findAllByType(TextInput).filter((/** @type {any} */ champ) => champ.props.keyboardType === 'number-pad');
const bouton = (/** @type {any} */ root, /** @type {string} */ libelle) => root.findAll((/** @type {any} */ noeud) => noeud.props?.accessibilityLabel === libelle && typeof noeud.props?.onPress === 'function')[0];
const taper = async (/** @type {any} */ champ, /** @type {string} */ texte) => { await act(async () => { champ.props.onChangeText(texte); }); };
const appuyer = async (/** @type {any} */ root, /** @type {string} */ libelle) => { await act(async () => { bouton(root, libelle).props.onPress(); }); };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(async () => {
  const arbres = montes.splice(0);
  await act(async () => { arbres.forEach((arbre) => arbre?.unmount?.()); });
});

describe('BH08 — fiche d un match de tournoi', () => {
  test('P8-19 : un match non joué laisse les champs de score vides', async () => {
    const root = await monter();
    const [champA, champB] = champsDeScore(root);
    expect(champA.props.value).toBe('');
    expect(champB.props.value).toBe('');
  });

  test('P8-11 : le vainqueur choisi sur un nul n est plus envoyé après correction du score', async () => {
    const root = await monter();
    await taper(champsDeScore(root)[0], '1');
    await taper(champsDeScore(root)[1], '1');
    await appuyer(root, 'Lyon');
    await taper(champsDeScore(root)[1], '3');
    await appuyer(root, 'Enregistrer le score');

    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0][1]).toEqual(expect.objectContaining({ scoreA: 1, scoreB: 3 }));
    expect(mockReport.mock.calls[0][1].winnerTeamId).toBeUndefined();
  });

  test('P8-20 : une heure de fin avant le début est refusée', async () => {
    const root = await monter();
    await taper(root.findByProps({ testID: 'champ-Date' }), '24/10/2026');
    await taper(root.findByProps({ testID: 'champ-Heure de début' }), '18:00');
    await taper(root.findByProps({ testID: 'champ-Heure de fin' }), '17:00');
    await appuyer(root, 'Enregistrer le créneau');

    expect(mockSchedule).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
  });
});
