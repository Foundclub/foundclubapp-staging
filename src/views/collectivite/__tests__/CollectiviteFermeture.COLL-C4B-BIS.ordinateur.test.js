/* eslint-disable max-len -- des phrases entieres de l ecran, comparees telles quelles */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { previewFacilityClosure } from '@/services/facilityClosure/facilityClosureService';

import CollectiviteFermeture, { PanneauDeFermeture } from '../CollectiviteFermeture';

// 🖥️ COLL-C4B-BIS (03/10/2026), point 1 — planche 25 du plan, design HY521H1 page 4,
// « P4v3-fermer-ordi » : « Le panneau a droite, la semaine a gauche ». Sur ORDINATEUR, fermer ou
// bloquer ne prend plus un ecran entier : l ecran cede la place au planning de l installation,
// panneau ouvert (les parametres sont SCALAIRES : l adresse du site les porte). Le telephone ne
// change pas (P4v3-fermer-tel dessine un ecran plein).
// ROUGES avant le lot : l ecran ne connaissait pas l ordinateur, et le panneau n existait pas.

jest.setTimeout(30000);

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockParams;
let mockOrdinateur = true;
/** @type {any[]} */
const mockDateProps = [];

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
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
jest.mock('@/services/facilityClosure/facilityClosureService', () => ({
  closeFacility: jest.fn(),
  listCollectiviteClosures: jest.fn(),
  listFacilityClosures: jest.fn(),
  modifyFacilityClosure: jest.fn(),
  previewFacilityClosure: jest.fn(),
  reopenFacilityClosure: jest.fn(),
}));
jest.mock('@/services/seasonSlot/seasonSlotService', () => ({}));
jest.mock('@/services/facility/facilityService', () => ({ getFacilityPlanning: jest.fn() }));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({
    data: [
      { documentId: 'gym-tilleuls', maxSlots: 2, name: 'Gymnase des Tilleuls' },
      { documentId: 'dojo', maxSlots: 1, name: 'Dojo municipal' },
    ],
  }),
}));
jest.mock('@/components/templates/ScreenContainer', () => function ScreenContainerMock({ children }) {
  return children;
});
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: props.testID },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock(/** @type {any} */ props) {
  mockDateProps.push(props);
  return null;
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(/** @type {any} */ { children, isVisible }) {
  return isVisible ? children : null;
});

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ id) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.testID === id);
const attendre = async () => {
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 0); }); });
};
const date = (/** @type {string} */ libelle) => mockDateProps.filter((props) => props.label === libelle).pop();

/** @type {any[]} */
const montes = [];
const rendre = async (/** @type {any} */ element) => {
  const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0, retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  });
  await attendre();
  montes.push({ arbre, client });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDateProps.length = 0;
  mockOrdinateur = true;
  mockNavigation = {
    goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setOptions: jest.fn(),
  };
  /** @type {any} */ (previewFacilityClosure).mockResolvedValue({
    data: {
      clubs: [{ documentId: 'club-fc', name: 'Montrivage FC' }],
      clubsCount: 1,
      sessions: [{
        club: { documentId: 'club-fc', name: 'Montrivage FC' },
        date: '2026-10-02',
        endTime: '19:30',
        startTime: '18:00',
        team: { name: 'Senior B' },
      }],
      sessionsCount: 1,
    },
  });
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach(({ arbre, client }) => {
      arbre.unmount();
      client.clear();
    });
  });
});

test('C4B-BIS-1/1 ordinateur, installation connue : l ecran cede la place au planning, panneau « fermer » ouvert', async () => {
  mockParams = {
    collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', facilityName: 'Gymnase des Tilleuls', mode: 'fermer',
  };
  const arbre = await rendre(<CollectiviteFermeture />);
  expect(mockNavigation.replace).toHaveBeenCalledWith('PlanningWeekFullscreen', {
    contextDetailLabel: 'Gymnase des Tilleuls',
    facilityId: 'gym-tilleuls',
    fermeture: 'fermer',
    sourceType: 'facility',
  });
  // Rien du formulaire plein ecran ne s affiche en attendant.
  expect(textes(arbre)).not.toContain('Fermer une installation');
});

test('C4B-BIS-1/2 ordinateur : « Bloquer pour la Ville » garde son jour et ses heures ; « Modifier » garde sa fermeture', async () => {
  mockParams = {
    collectiviteId: 'ville-montrivage', date: '2026-10-03', endTime: '13:00', facilityId: 'gym-tilleuls', mode: 'bloquer', startTime: '09:00',
  };
  await rendre(<CollectiviteFermeture />);
  expect(mockNavigation.replace).toHaveBeenLastCalledWith('PlanningWeekFullscreen', {
    date: '2026-10-03',
    endTime: '13:00',
    facilityId: 'gym-tilleuls',
    fermeture: 'bloquer',
    sourceType: 'facility',
    startTime: '09:00',
  });
  mockParams = { closureId: 'fermeture-1', collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls' };
  await rendre(<CollectiviteFermeture />);
  expect(mockNavigation.replace).toHaveBeenLastCalledWith('PlanningWeekFullscreen', {
    closureId: 'fermeture-1',
    facilityId: 'gym-tilleuls',
    fermeture: 'modifier',
    sourceType: 'facility',
  });
});

test('C4B-BIS-1/3 ordinateur, depuis l accueil (sans installation) : on la choisit, puis le planning s ouvre', async () => {
  mockParams = { collectiviteId: 'ville-montrivage', mode: 'fermer' };
  const arbre = await rendre(<CollectiviteFermeture />);
  expect(mockNavigation.replace).not.toHaveBeenCalled();
  expect(textes(arbre)).toContain('Choisissez l’installation');
  await act(async () => { parTestID(arbre, 'fermeture-installation-dojo').props.onPress(); });
  expect(mockNavigation.replace).toHaveBeenCalledWith('PlanningWeekFullscreen', {
    contextDetailLabel: 'Dojo municipal',
    facilityId: 'dojo',
    fermeture: 'fermer',
    sourceType: 'facility',
  });
});

test('C4B-BIS-1/4 telephone : rien ne change, l ecran plein reste', async () => {
  mockOrdinateur = false;
  mockParams = { collectiviteId: 'ville-montrivage', facilityId: 'gym-tilleuls', mode: 'fermer' };
  const arbre = await rendre(<CollectiviteFermeture />);
  expect(mockNavigation.replace).not.toHaveBeenCalled();
  expect(textes(arbre)).toContain('Fermer une installation');
});

test('C4B-BIS-1/5 le PANNEAU : titre de la planche, sans choix d installation ; la saisie se dit au planning ; la croix le ferme', async () => {
  /** @type {any[]} */
  const brouillons = [];
  const onCancel = jest.fn();
  const arbre = await rendre(
    <PanneauDeFermeture
      collectiviteId="ville-montrivage"
      facilityId="gym-tilleuls"
      facilityName="Gymnase des Tilleuls"
      mode="fermer"
      onCancel={onCancel}
      onDone={jest.fn()}
      onDraftChange={(/** @type {any} */ brouillon) => brouillons.push(brouillon)}
    />,
  );
  expect(textes(arbre)).toContain('Fermer l’installation');
  expect(textes(arbre)).not.toContain('Fermer une installation');
  expect(textes(arbre)).not.toContain('Gymnase des Tilleuls');
  expect(mockNavigation.setOptions).not.toHaveBeenCalled();
  await act(async () => { date('Du').onChange('02/10/2026'); });
  await attendre();
  expect(brouillons[brouillons.length - 1]).toEqual({
    documentId: null,
    endDate: '2026-10-02',
    endTime: null,
    kind: 'closure',
    label: null,
    reason: 'travaux',
    startDate: '2026-10-02',
    startTime: null,
  });
  expect(textes(arbre)).toContain('Montrivage FC · Senior B, 18:00 – 19:30');
  const croix = parTestID(arbre, 'fermeture-panneau-fermer');
  expect(croix.props.accessibilityLabel).toBe('Fermer le panneau');
  await act(async () => { croix.props.onPress(); });
  expect(onCancel).toHaveBeenCalled();
});
