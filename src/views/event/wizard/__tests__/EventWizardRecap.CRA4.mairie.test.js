/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardRecap from '../EventWizardRecap';

// 🏛️ COLL-R-APP-CREATION (13/10/2026, COL-003, décision d'Adel « D2- A ») — LE RÉCAPITULATIF DIT,
// SOUS LE LIEU, QUE LA MAIRIE DÉCIDERA (constaté en recette le 11/10 : rien ne le disait avant
// « Créer »). Même question que l'étape 4 (crochet `useMairieDecideALaCreation`, doublé ici : son
// propre témoin), mêmes phrases que « Modifier » et « Demander un créneau ». ROUGE avant le lot.

const mockGabarits = [];
/** @type {any[][]} */
const mockQuestions = [];
let mockDecision = {
  complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
};

jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: (/** @type {any[]} */ ...question) => {
    mockQuestions.push(question);
    return mockDecision;
  },
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
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
      Images: { arrowLeft: 1, chevronDown: 1, close: 1 },
      Spaces: espaces,
    }),
  };
});
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockGabarits.push(props);
  return props.children;
});
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: () => Promise.resolve(null),
    invalidateQueries: () => Promise.resolve(),
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
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    createReccurrentEventPayload: () => [{ name: 'Entraînement U13', team: 'u13' }],
    createStageEventPayload: () => ({ name: 'Un stage' }),
  }),
}));
jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));
jest.mock('@/services/event/eventService', () => ({
  createEventsWithConcurrency: async () => ({ created: [], failed: [] }),
  getEventById: () => Promise.resolve(null),
  requestFeatured: () => Promise.resolve(null),
  rollbackEventsByCancel: () => Promise.resolve([]),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});
jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => () => null);
jest.mock('@/components/atoms/button/Button', () => function BoutonMock() {
  return null;
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);

const ETAT = {
  date: new Date(2030, 4, 18),
  endTime: new Date(2030, 4, 18, 19, 30),
  facility: 'gym',
  location: { label: '12 rue des Tilleuls', value: '' },
  startTime: new Date(2030, 4, 18, 18, 0),
  team: {
    activities: [{ documentId: 'act-1', name: 'Basket' }],
    club: { documentId: 'club-A', name: 'AS Montrivage' },
    documentId: 'u13',
    name: 'U13',
    sport: { documentId: 'sport-1', name: 'Basket' },
  },
  type: { documentId: 'type-entrainement', name: 'Entraînement' },
  validationMode: 'auto',
};

let semer = (/** @type {any} */ action) => action;
/**
 * Sonde sans rendu : elle expose le `dispatch` du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  semer = useEventWizard().dispatch;
  return null;
}
const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
/** @type {any[]} */
const arbresMontes = [];
const monterLeRecap = () => {
  mockGabarits.length = 0;
  mockQuestions.length = 0;
  const navigation = {
    canGoBack: () => true, goBack: () => {}, navigate: () => {}, push: () => {}, replace: () => {}, reset: () => {},
  };
  const rendre = (/** @type {any} */ contenu) => createElement(EventWizardProvider, null, createElement(PriseDeCourant), contenu);
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: ETAT, type: 'SET_META' }));
  act(() => { arbre.update(rendre(createElement(EventWizardRecap, { navigation, route: { params: {} } }))); });
  arbresMontes.push(arbre);
  return arbre;
};
const ligneDeLaMairie = (/** @type {any} */ arbre) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'recap-mairie-decide' && typeof n.type === 'string');
const texteDe = (/** @type {any} */ noeud) => aplatir(noeud.props.children).trim();

afterEach(() => {
  mockDecision = {
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  };
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('COLL-R-APP-CREATION — le récapitulatif dit, sous le lieu, que la mairie décidera', () => {
  test('la question est celle de l étape 4 : la séance du tunnel et son installation', () => {
    monterLeRecap();
    const [etat, installation] = mockQuestions[mockQuestions.length - 1];
    expect(installation).toBe('gym');
    expect(etat.team.documentId).toBe('u13');
  });

  test('la mairie décide : une ligne sous le lieu, la phrase de « Modifier »', () => {
    mockDecision = {
      complet: false, deLaVille: true, mairie: true, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    const lignes = ligneDeLaMairie(monterLeRecap());
    expect(lignes).toHaveLength(1);
    expect(texteDe(lignes[0])).toBe('Hors des créneaux de ton club : la mairie décidera, même s’il reste de la place. Si la mairie refuse, la séance sera annulée.');
  });

  test('au complet, ou pour un compte qui gère la Ville : la phrase de « Demander un créneau »', () => {
    mockDecision = {
      complet: true, deLaVille: true, mairie: true, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    expect(texteDe(ligneDeLaMairie(monterLeRecap())[0])).toBe('Tu peux demander quand même : la mairie décidera. Si la mairie refuse, la séance sera annulée.');
    mockDecision = { ...mockDecision, complet: false, tuAcceptes: true };
    expect(texteDe(ligneDeLaMairie(monterLeRecap())[0])).toBe('Ta demande partira à la Ville ; tu pourras l’accepter toi-même dans Demandes. Si la mairie refuse, la séance sera annulée.');
  });

  test('la mairie ne décide pas (créneau du club, installation du club, pas de réponse) : aucune ligne', () => {
    mockDecision = {
      complet: false, deLaVille: true, mairie: false, tuAcceptes: false, ville: 'Ville de Montrivage',
    };
    expect(ligneDeLaMairie(monterLeRecap())).toHaveLength(0);
  });
});
