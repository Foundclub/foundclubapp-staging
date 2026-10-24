import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventTasksSection from '../EventTasksSection';

// BH07 (24/10) — P8-09 : un benevole qui a annule, ou a ete refuse, peut se reproposer.
// P8-10 : affectation de plusieurs membres, echec partiel : la fiche se relit et un nouvel
// essai ne renvoie que les membres en echec.

jest.setTimeout(30000);

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: espaces,
    }),
  };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`.
jest.mock('@/services/event/eventService', () => ({
  approveEventTaskAssignment: jest.fn(),
  assignEventTask: jest.fn(),
  cancelEventTaskAssignment: jest.fn(),
  rejectEventTaskAssignment: jest.fn(),
}));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);
jest.mock('@/components/atoms/checkbox/Checkbox', () => () => null);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(/** @type {any} */ props) {
  return props.isVisible ? props.children : null;
});
jest.mock('@/components/atoms/button/Button', () => {
  const { Text } = jest.requireActual('react-native');
  const react = jest.requireActual('react');
  return function BoutonMock(/** @type {any} */ props) {
    return react.createElement(Text, { onPress: props.onPress, testID: `bouton-${props.title}` }, props.title);
  };
});

const eventService = jest.requireMock('@/services/event/eventService');

const MOI = { documentId: 'moi', firstname: 'Ines', lastname: 'Roy' };
const MEMBRES = [
  { documentId: 'm1', firstname: 'Ali', lastname: 'Ba' },
  { documentId: 'm2', firstname: 'Bea', lastname: 'Ca' },
];

/** @type {any} */
let arbre = null;
/** @type {any} */
let client = null;

const monter = async (/** @type {any} */ event, /** @type {any} */ props = {}) => {
  client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  jest.spyOn(client, 'invalidateQueries');
  await act(async () => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(EventTasksSection, { event, userData: MOI, ...props }),
    ));
  });
};

const bouton = (/** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === `bouton-${titre}` && typeof n.props.onPress === 'function',
)[0];
const presser = async (/** @type {any} */ noeud) => {
  await act(async () => { noeud.props.onPress(); });
  await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

test.each([['CANCELLED'], ['REJECTED']])('P8-09 — apres %s, le bouton pour se proposer revient', async (statut) => {
  await monter({
    documentId: 'ev-1',
    eventTasks: [{
      assignments: [{ documentId: 'a-1', status: statut, user: MOI }],
      documentId: 't-1',
      requiredCount: 2,
      title: 'Buvette',
      validationMode: 'MANUAL',
    }],
    team: { players: [MOI] },
  });
  expect(bouton('Je me porte volontaire')).toBeTruthy();
});

test('P8-10 — echec partiel : la fiche se relit, le nouvel essai ne renvoie que l echec', async () => {
  eventService.assignEventTask.mockImplementation(async (_tache, { userId }) => {
    if (userId === 'm2') throw new Error('refus');
    return { data: { status: 'APPROVED' } };
  });
  await monter({
    documentId: 'ev-1',
    eventTasks: [{
      assignments: [], documentId: 't-1', requiredCount: 3, title: 'Buvette',
    }],
    team: { players: MEMBRES, trainers: [MOI] },
  }, { canManageEvent: true });
  await presser(bouton('Assigner des membres'));
  const textes = (/** @type {any} */ n) => n.findAll((/** @type {any} */ e) => typeof e.props?.children === 'string')
    .map((/** @type {any} */ e) => e.props.children).join(' ');
  const ligneDe = (/** @type {string} */ nom) => arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.props?.onPress === 'function' && typeof n.type !== 'string' && !n.props.testID
    && textes(n).includes(nom)))[0];
  await presser(ligneDe('Ali Ba'));
  await presser(ligneDe('Bea Ca'));
  await presser(bouton('Assigner'));
  expect(eventService.assignEventTask).toHaveBeenCalledTimes(2);
  expect(client.invalidateQueries).toHaveBeenCalled();
  eventService.assignEventTask.mockClear();
  await presser(bouton('Assigner'));
  expect(eventService.assignEventTask.mock.calls.map((appel) => appel[1].userId)).toEqual(['m2']);
});
