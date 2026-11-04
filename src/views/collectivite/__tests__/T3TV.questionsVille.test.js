/* eslint-disable max-len -- les témoins se lisent en entier. */
import '@/theme/strings';

import i18next from 'i18next';
import renderer, { act } from 'react-test-renderer';

import { buildWebPath } from '@/navigation/webRoutes';

import CollectiviteQuestion from '../CollectiviteQuestion';
import CollectiviteQuestions from '../CollectiviteQuestions';
import MaVille from '../MaVille';

// T3-TICKETS-VILLE (03/11/2026, fiche 20 option B) — « Ma collectivité » du dirigeant (deux onglets :
// écrire à sa Ville, signaler un problème), la boîte de la Ville, et une question avec ses statuts.
// Le serveur juge (tests/authz/T3TV-questions-ville.test.js) ; ici, ce que l'écran en fait.

/** @type {any} */
let mockParams = {};
/** @type {any} */
let mockVille = {};
/** @type {any} */
let mockQuestions = {};
/** @type {any} */
let mockBoite = {};
/** @type {any} */
let mockFiche = {};
/** @type {any} */
let mockInstallations = {};
const mockNaviguer = jest.fn();
const mockEnvoyer = jest.fn();
const mockPoser = jest.fn();

jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ current: null, isReady: () => false }),
  useNavigation: () => ({ navigate: mockNaviguer }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => ({ userData: { club: { documentId: 'club-du-compte' } } }) }));
jest.mock('@/services/collectivite/collectiviteQuestionQueries', () => ({
  useClubQuestions: (/** @type {any} */ clubId) => mockQuestions(clubId),
  useCollectiviteQuestion: () => mockFiche,
  useCollectiviteQuestions: () => mockBoite,
  useSetQuestionStatus: () => ({ isPending: false, mutate: mockPoser }),
  useSubmitClubQuestion: () => ({ isPending: false, mutate: mockEnvoyer }),
}));
jest.mock('@/services/collectivite/collectiviteRattachementQueries', () => ({ useMaCollectivite: () => mockVille }));
jest.mock('@/services/facility/facilityQueries', () => ({ useClubCollectiviteFacilities: () => mockInstallations }));
jest.mock('@/views/collectivite/components/MaCollectivite', () => function MaCollectiviteMock() {
  const { Text } = jest.requireActual('react-native');
  return <Text>RATTACHEMENT EXISTANT</Text>;
});
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock(/** @type {any} */ { children }) {
  return children;
});
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });

const charge = (/** @type {any} */ data) => ({
  data, isError: false, isLoading: false, refetch: jest.fn(),
});
const QUESTION = {
  author: { name: 'Paul Dupont' },
  club: { documentId: 'club-1', name: 'AS Montrivage' },
  collectivite: { documentId: 'ville-1', name: 'Ville de Montrivage' },
  createdAt: '2026-11-02T10:00:00.000Z',
  documentId: 'q-1',
  status: 'recue',
  text: 'Le ramassage change-t-il cet hiver ?',
  title: 'Le ramassage change-t-il cet hiver ?',
};

/** @type {any} */
let arbre = null;
const monter = (/** @type {any} */ Ecran) => {
  act(() => { arbre = renderer.create(<Ecran />); });
  return JSON.stringify(arbre.toJSON());
};
const parTestId = (/** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0];
const parTitre = (/** @type {string} */ titre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function')[0];
const parTexteDe = (/** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id && typeof n.props?.onChangeText === 'function')[0];

beforeEach(() => {
  mockParams = { clubId: 'club-1' };
  mockVille = charge({ attached: { name: 'Ville de Montrivage', type: 'commune' } });
  mockQuestions = jest.fn(() => charge({ data: [QUESTION], meta: { openCount: 1 } }));
  mockBoite = charge({ data: [QUESTION], meta: { toHandleCount: 1 } });
  mockFiche = charge({ data: QUESTION, meta: { canManage: true } });
  mockInstallations = charge([{ collectivite: { name: 'Ville de Montrivage' }, documentId: 'f-1', name: 'Gymnase des Tilleuls' }]);
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.clearAllMocks();
});

describe('T3TV — « Ma collectivité » du dirigeant', () => {
  test('les deux onglets, avec le nom de la Ville ; Écrire est ouvert, avec les questions du club et leur statut', () => {
    const texte = monter(MaVille);
    expect(texte).toContain('Ville de Montrivage');
    expect(texte).toContain('Ouvrir un ticket');
    expect(texte).toContain('Signaler un problème');
    expect(texte).toContain('Le ramassage change-t-il cet hiver ?');
    expect(texte).toContain('Reçu');
    expect(mockQuestions).toHaveBeenCalledWith('club-1');
  });

  test('sans club en paramètre, le club du compte', () => {
    mockParams = {};
    monter(MaVille);
    expect(mockQuestions).toHaveBeenCalledWith('club-du-compte');
  });

  test('envoyer : le texte tapé part, et ne se vide qu après l accord du serveur', () => {
    monter(MaVille);
    expect(parTitre('Envoyer le ticket').props.disabled).toBe(true);
    act(() => parTexteDe('ma-ville-texte').props.onChangeText('  Une question  '));
    act(() => parTitre('Envoyer le ticket').props.onPress());
    expect(mockEnvoyer.mock.calls[0][0]).toBe('Une question');
    expect(parTexteDe('ma-ville-texte').props.value).toBe('  Une question  ');
    act(() => mockEnvoyer.mock.calls[0][1].onSuccess());
    expect(parTexteDe('ma-ville-texte').props.value).toBe('');
    expect(JSON.stringify(arbre.toJSON())).toContain('Ticket envoyé');
  });

  test('un refus du serveur se dit, et le texte reste', () => {
    monter(MaVille);
    act(() => parTexteDe('ma-ville-texte').props.onChangeText('Une question'));
    act(() => parTitre('Envoyer le ticket').props.onPress());
    act(() => mockEnvoyer.mock.calls[0][1].onError({ response: { data: { error: { details: { code: 'COLLECTIVITE_QUESTION_TOO_MANY_OPEN' } } }, status: 409 } }));
    expect(parTexteDe('ma-ville-texte').props.value).toBe('Une question');
    expect(JSON.stringify(arbre.toJSON())).not.toContain('Ticket envoyé');
  });

  test('un refus sans code connu : la phrase générique, jamais une clé de traduction', () => {
    monter(MaVille);
    act(() => parTexteDe('ma-ville-texte').props.onChangeText('Une question'));
    act(() => parTitre('Envoyer le ticket').props.onPress());
    act(() => mockEnvoyer.mock.calls[0][1].onError({}));
    const ecran = JSON.stringify(arbre.toJSON());
    expect(ecran).not.toContain('APIerrors');
    expect(ecran).toContain(i18next.t('APIerrors.generic'));
  });

  test('Signaler : on choisit l installation, et le signalement existant s ouvre avec elle', () => {
    mockParams = { clubId: 'club-1', onglet: 'signaler' };
    const texte = monter(MaVille);
    expect(texte).toContain('Gymnase des Tilleuls');
    act(() => parTestId('ma-ville-installation-f-1').props.onPress());
    expect(mockNaviguer).toHaveBeenCalledWith('FacilityReportNew', {
      collectiviteName: 'Ville de Montrivage',
      facilityId: 'f-1',
      facilityName: 'Gymnase des Tilleuls',
    });
  });

  test('un club sans Ville retrouve le rattachement existant, sans onglet', () => {
    mockVille = charge({ attached: null });
    const texte = monter(MaVille);
    expect(texte).toContain('RATTACHEMENT EXISTANT');
    expect(texte).not.toContain('Envoyer le ticket');
  });

  test('une panne n est pas « aucune question » ni « pas de Ville »', () => {
    mockQuestions = jest.fn(() => ({
      data: undefined, isError: true, isLoading: false, refetch: jest.fn(),
    }));
    const panne = monter(MaVille);
    expect(panne).toContain('n’ont pas pu être chargés');
    expect(panne).not.toContain('Aucun ticket');
    act(() => arbre.unmount());
    mockVille = {
      data: undefined, isError: true, isLoading: false, refetch: jest.fn(),
    };
    const villePanne = monter(MaVille);
    expect(villePanne).toContain('n’a pas pu être chargée');
    expect(villePanne).not.toContain('RATTACHEMENT EXISTANT');
  });
});

describe('T3TV — la boîte de la Ville', () => {
  test('la liste dit le club et le statut, et une question s ouvre', () => {
    mockParams = { collectiviteId: 'ville-1' };
    const texte = monter(CollectiviteQuestions);
    expect(texte).toContain('Tickets des clubs');
    expect(texte).toContain('AS Montrivage');
    act(() => parTestId('question-q-1').props.onPress());
    expect(mockNaviguer).toHaveBeenCalledWith('CollectiviteQuestion', { questionId: 'q-1' });
  });

  test('vide : la phrase, pas une erreur', () => {
    mockBoite = charge({ data: [], meta: { toHandleCount: 0 } });
    expect(monter(CollectiviteQuestions)).toContain('Aucun club ne vous a encore écrit.');
  });
});

describe('T3TV — une question', () => {
  test('la Ville : passer en cours ou traiter, avec son mot', () => {
    mockParams = { questionId: 'q-1' };
    monter(CollectiviteQuestion);
    act(() => parTexteDe('question-votre-mot').props.onChangeText(' Lundi. '));
    act(() => parTitre('Marquer comme traité').props.onPress());
    expect(mockPoser.mock.calls[0][0]).toEqual({ note: 'Lundi.', status: 'traitee' });
    expect(parTitre('Passer en cours')).toBeTruthy();
  });

  test('le club lit, sans bouton, et lit le mot de la Ville', () => {
    mockFiche = charge({ data: { ...QUESTION, cityNote: 'Lundi.', status: 'traitee' }, meta: { canManage: false } });
    const texte = monter(CollectiviteQuestion);
    expect(texte).toContain('Traité');
    expect(texte).toContain('Lundi.');
    expect(parTitre('Marquer comme traité')).toBeUndefined();
  });

  test('traitée, la Ville n a plus de geste ; en cours, plus « Passer en cours »', () => {
    mockFiche = charge({ data: { ...QUESTION, status: 'traitee' }, meta: { canManage: true } });
    monter(CollectiviteQuestion);
    expect(parTitre('Marquer comme traité')).toBeUndefined();
    act(() => arbre.unmount());
    mockFiche = charge({ data: { ...QUESTION, status: 'en_cours' }, meta: { canManage: true } });
    monter(CollectiviteQuestion);
    expect(parTitre('Passer en cours')).toBeUndefined();
    expect(parTitre('Marquer comme traité')).toBeTruthy();
  });

  test('refusée : introuvable', () => {
    mockFiche = { data: undefined, isError: true, isLoading: false };
    expect(monter(CollectiviteQuestion)).toContain('introuvable');
  });
});

test('T3TV — les adresses du site', () => {
  expect(buildWebPath('MaVille', { onglet: 'signaler' })).toContain('/ma-ville/signaler');
  expect(buildWebPath('CollectiviteQuestions', { collectiviteId: 'v' })).toBe('/collectivite/v/tickets');
  expect(buildWebPath('CollectiviteQuestion', { questionId: 'q' })).toBe('/tickets-ville/q');
});
