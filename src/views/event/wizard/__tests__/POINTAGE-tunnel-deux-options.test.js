import { createElement } from 'react';
import { TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventWizardAccess from '../EventWizardAccess';
import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardRecap from '../EventWizardRecap';

// LOT POINTAGE (decisions d Adel du 29/09) — LES DEUX OPTIONS DANS LE TUNNEL DE
// CREATION : « Les participants repondent Present / Absent » et « Suivre les
// arrivees », COCHEES PAR DEFAUT, decochables a l etape « Acces », et parties
// au serveur avec l evenement.
//
// Pas de reglage par TYPE d evenement : le type n a qu un nom cote serveur
// (`event-type` : `name` seul) ; l app a des defauts codes en dur par type
// pour la capacite et la visibilite, aucun pour les presences. Defaut
// « cochees » partout.
//
// Ecrits ROUGES contre app `8d017cd6`. Harnais repris de
// `EventWizardRecap.creation.test.js`.

const mockProprietesDuGabarit = [];
const mockChargesCreees = [];

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
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
      Images: { arrowLeft: 1, chevronDown: 1, close: 1 },
      Spaces: espaces,
    }),
  };
});

// Le gabarit rend son contenu : l etape « Acces » doit montrer ses cases.
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockProprietesDuGabarit.push(props);
  return props.children || null;
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: () => Promise.resolve(null),
    invalidateQueries: async () => {},
    setQueryData: () => {},
  }),
}));

jest.mock('@/domains/auth/useAuth', () => {
  const { USER_ROLES } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      USER_ROLES,
      userData: { documentId: 'moi', role: { name: USER_ROLES.president, type: 'president' } },
    }),
  };
});

// La charge que le Recap construit est captee ICI : c est elle qui part au serveur.
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    createReccurrentEventPayload: (/** @type {any} */ formulaire) => {
      mockChargesCreees.push(formulaire);
      return [{ name: 'Un evenement' }];
    },
    createStageEventPayload: () => ({ name: 'Un stage' }),
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

jest.mock('@/services/event/eventService', () => ({
  createEventsWithConcurrency: async () => ({
    created: [{
      documentId: 'ev-1',
      payload: { name: 'Un evenement' },
      response: { data: { documentId: 'ev-1' } },
    }],
    failed: [],
  }),
  getEventById: () => Promise.resolve(null),
  requestFeatured: () => Promise.resolve(null),
  rollbackEventsByCancel: () => Promise.resolve([]),
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);

jest.mock('@/components/atoms/button/Button', () => function BoutonMock() {
  return null;
});

jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);

const ETAT_COMPLET = {
  date: new Date('2027-08-12T15:00:00.000Z'),
  description: 'Match de reprise',
  endTime: new Date('2027-08-12T16:00:00.000Z'),
  facility: { documentId: 'inst-1', name: 'Stade' },
  location: 'Stade · 1 rue du Stade',
  startTime: new Date('2027-08-12T15:00:00.000Z'),
  team: {
    activities: [{ documentId: 'act-1', name: 'Football' }],
    club: { documentId: 'club-1', name: 'FC Test' },
    documentId: 'equipe-1',
    name: 'Seniors',
    sport: { documentId: 'sport-1', name: 'Football' },
  },
  type: { documentId: 'type-match', name: 'Match' },
  validationMode: 'auto',
};

let mockSonde = { dispatch: () => {}, state: {} };

/**
 * Sonde sans rendu : elle expose l etat et le `dispatch` du tunnel.
 * @returns {null} Rien.
 */
function Sonde() {
  mockSonde = useEventWizard();
  return null;
}

const monter = (contenu) => createElement(EventWizardProvider, null, createElement(Sonde), contenu);

const navigation = {
  canGoBack: () => true,
  goBack: () => {},
  navigate: () => {},
  push: () => {},
  replace: () => {},
  reset: () => {},
};

/**
 * Les cases de l ecran, par leur libelle accessible.
 * @param {any} arbre - L arbre rendu.
 * @returns {Record<string, { checked: boolean, press: Function }>} Les cases.
 */
const cases = (arbre) => Object.fromEntries(arbre.root.findAllByType(TouchableOpacity)
  .filter((noeud) => noeud.props.accessibilityRole === 'checkbox')
  .map((noeud) => [noeud.props.accessibilityLabel, {
    checked: Boolean(noeud.props.accessibilityState?.checked),
    press: noeud.props.onPress,
  }]));

const monterLAcces = () => monter(
  createElement(EventWizardAccess, { navigation, route: { params: {} } }),
);

const REPONSES = 'Les participants répondent Présent / Absent';
const ARRIVEES = 'Suivre les arrivées';

beforeEach(() => {
  mockProprietesDuGabarit.length = 0;
  mockChargesCreees.length = 0;
});

test('POINTAGE-T1 — 🚨 un tunnel neuf a les deux options COCHEES', () => {
  act(() => { renderer.create(monter(null)); });

  expect(mockSonde.state.rsvpEnabled).toBe(true);
  expect(mockSonde.state.arrivalTrackingEnabled).toBe(true);
});

test('POINTAGE-T2 — 🚨 l etape « Acces » montre les deux cases, cochees', () => {
  let arbre = null;
  act(() => { arbre = renderer.create(monterLAcces()); });
  act(() => mockSonde.dispatch({ payload: ETAT_COMPLET, type: 'SET_META' }));

  const lues = cases(arbre);
  expect(lues[REPONSES]?.checked).toBe(true);
  expect(lues[ARRIVEES]?.checked).toBe(true);
});

test('POINTAGE-T3 — 🚨 decocher les arrivees puis « Suivant » : le tunnel le retient', () => {
  let arbre = null;
  act(() => { arbre = renderer.create(monterLAcces()); });
  act(() => mockSonde.dispatch({ payload: ETAT_COMPLET, type: 'SET_META' }));

  act(() => { cases(arbre)[ARRIVEES].press(); });
  expect(cases(arbre)[ARRIVEES].checked).toBe(false);
  const gabarit = mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];
  act(() => { gabarit.onNext(); });

  expect(mockSonde.state.arrivalTrackingEnabled).toBe(false);
  expect(mockSonde.state.rsvpEnabled).toBe(true);
});

/**
 * Appuie sur « Creer » depuis le Recap et rend la charge construite.
 * @param {object} surcharges - Ce qui change dans l etat du tunnel.
 * @returns {Promise<any>} Le formulaire passe a la fabrique de charges.
 */
const creer = async (surcharges) => {
  let arbre = null;
  act(() => { arbre = renderer.create(monter(null)); });
  act(() => mockSonde.dispatch({ payload: { ...ETAT_COMPLET, ...surcharges }, type: 'SET_META' }));
  act(() => {
    arbre.update(monter(createElement(EventWizardRecap, { navigation, route: { params: {} } })));
  });
  const gabarit = mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];
  // La charge que « Creer » envoie est la derniere construite AVANT l appui :
  // une creation reussie remet le tunnel a zero, et le Recap en reconstruit une.
  const chargeEnvoyee = mockChargesCreees[mockChargesCreees.length - 1];
  await act(async () => { await gabarit.onNext(); });
  act(() => arbre.unmount());
  return chargeEnvoyee;
};

test('POINTAGE-T4 — 🚨 la creation ENVOIE les deux options (cochees par defaut)', async () => {
  const formulaire = await creer({});

  expect(formulaire.rsvpEnabled).toBe(true);
  expect(formulaire.arrivalTrackingEnabled).toBe(true);
});

test('POINTAGE-T5 — 🚨 une option decochee part DECOCHEE', async () => {
  const formulaire = await creer({ arrivalTrackingEnabled: false, rsvpEnabled: false });

  expect(formulaire.rsvpEnabled).toBe(false);
  expect(formulaire.arrivalTrackingEnabled).toBe(false);
});
