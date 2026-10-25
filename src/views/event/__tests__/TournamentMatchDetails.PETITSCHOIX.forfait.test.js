/* eslint-disable max-len -- les témoins se lisent en entier. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Alert, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentMatchDetails from '../TournamentMatchDetails';

// ==========================================================================
// PETITSCHOIX/13 (décision d Adel du 25/10 « 13- B ») — le forfait d un match de tournoi.
//   · « Forfait <équipe> » pré-remplit 3-0 pour l autre équipe, sans rien envoyer ;
//   · le score reste modifiable, et ce que le coach a déjà tapé est gardé ;
//   · un score qui fait gagner l équipe forfait, ou un nul, est refusé avec un message.
// Le serveur refuse les mêmes scores (admin tests/authz/PETITSCHOIX-13-forfait-tournoi.test.js).
// ==========================================================================

const mockReport = jest.fn(() => Promise.resolve({}));
const mockSchedule = jest.fn(() => Promise.resolve({}));
/** @type {any} */
let mockMatch = null;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      const valeurs = typeof repli === 'object' && repli ? repli : (options || {});
      const gabarit = typeof repli === 'string' ? repli : (valeurs.defaultValue || cle);
      return gabarit.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ tout, /** @type {string} */ nom) => (
        valeurs[nom] === undefined ? tout : String(valeurs[nom])
      ));
    },
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
  useGetTournamentMatch: () => ({
    data: mockMatch, error: null, isLoading: false, refetch: jest.fn(),
  }),
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

const valeurs = (/** @type {any} */ root) => champsDeScore(root).map((/** @type {any} */ champ) => champ.props.value);

describe('PETITSCHOIX/13 — forfait d un match de tournoi', () => {
  test('« Forfait Nice » pré-remplit 3-0 pour Lyon et n envoie rien', async () => {
    const root = await monter();
    await appuyer(root, 'Forfait Nice');

    expect(valeurs(root)).toEqual(['3', '0']);
    expect(mockReport).not.toHaveBeenCalled();
  });

  test('« Forfait Lyon » pré-remplit 0-3 ; le score modifié est envoyé en forfait, Nice vainqueur', async () => {
    const root = await monter();
    await appuyer(root, 'Forfait Lyon');
    expect(valeurs(root)).toEqual(['0', '3']);

    await taper(champsDeScore(root)[1], '5');
    await appuyer(root, 'Enregistrer le forfait');

    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0][1]).toEqual(expect.objectContaining({
      resultMeta: { forfeitTeamId: 'ta' }, scoreA: 0, scoreB: 5, status: 'forfeit', winnerTeamId: 'tb',
    }));
  });

  test('le score déjà tapé par le coach est gardé', async () => {
    const root = await monter();
    await taper(champsDeScore(root)[0], '2');
    await taper(champsDeScore(root)[1], '1');
    await appuyer(root, 'Forfait Nice');

    expect(valeurs(root)).toEqual(['2', '1']);
  });

  test('un score qui fait gagner l équipe forfait est refusé, avec un message', async () => {
    const root = await monter();
    await appuyer(root, 'Forfait Nice');
    await taper(champsDeScore(root)[1], '4');
    await appuyer(root, 'Enregistrer le forfait');

    expect(mockReport).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Score refusé', expect.stringContaining('forfait'));
  });

  test('un match nul en forfait est refusé', async () => {
    const root = await monter();
    await appuyer(root, 'Forfait Nice');
    await taper(champsDeScore(root)[0], '0');
    await appuyer(root, 'Enregistrer le forfait');

    expect(mockReport).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Score refusé', expect.stringContaining('forfait'));
  });

  test('« Annuler le forfait » rend le score normal', async () => {
    const root = await monter();
    await appuyer(root, 'Forfait Nice');
    await appuyer(root, 'Annuler le forfait');
    await appuyer(root, 'Enregistrer le score');

    expect(mockReport).toHaveBeenCalledTimes(1);
    expect(mockReport.mock.calls[0][1].status).toBeUndefined();
  });
});
