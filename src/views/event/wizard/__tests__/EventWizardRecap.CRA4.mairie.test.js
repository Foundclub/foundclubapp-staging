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
// Ce que le serveur rend à « Créer » (POST /events) : statut et raison d'attente de la séance.
/** @type {any[]} */
let mockCreees = [];
jest.mock('@/services/event/eventService', () => ({
  createEventsWithConcurrency: async () => ({ created: mockCreees, failed: [] }),
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
const creee = (/** @type {string} */ documentId, /** @type {any} */ donnees) => ({
  documentId,
  payload: { name: 'Entraînement U13', team: 'u13' },
  response: { data: { documentId, ...donnees } },
});
const EN_ATTENTE_DE_LA_VILLE = { pendingReason: 'facility_overbooking', status: 'pending_validation' };

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
/** @type {any[]} */
const mockResets = [];
const monterLeRecap = () => {
  mockGabarits.length = 0;
  mockQuestions.length = 0;
  mockResets.length = 0;
  const navigation = {
    canGoBack: () => true,
    goBack: () => {},
    navigate: () => {},
    push: () => {},
    replace: () => {},
    reset: (/** @type {any} */ config) => { mockResets.push(config); },
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

/**
 * Appuie sur « Créer » et rend la célébration que l'écran suivant rejouera.
 * @returns {Promise<any>} `creationCelebration` du premier écran de la pile.
 */
const creer = async () => {
  monterLeRecap();
  const gabarit = mockGabarits[mockGabarits.length - 1];
  await act(async () => { await gabarit.onNext(); });
  return mockResets[0]?.routes?.[0]?.params?.creationCelebration;
};

afterEach(() => {
  mockDecision = {
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  };
  mockCreees = [];
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

// COLL-R-APP-CREATION, point 2 (« D2- A ») — APRÈS « CRÉER », la séance qui attend la mairie
// n'annonce plus « Événement créé » : le bandeau « Demande envoyée à la Ville » (son catalogue :
// celebrationCatalog.CRA4.demandeVille.test.js). C'est le SERVEUR qui le dit (statut rendu par
// POST /events) ; l'installation de la Ville dit QUI décide (sinon : le gestionnaire du lieu).
describe('COLL-R-APP-CREATION — après « Créer », « Demande envoyée à la Ville »', () => {
  const VILLE = {
    complet: false, deLaVille: true, mairie: true, tuAcceptes: false, ville: 'Ville de Montrivage',
  };

  test('la séance revient en attente, sur un gymnase de la Ville : le bandeau de la demande, avec la Ville et le club', async () => {
    mockDecision = VILLE;
    mockCreees = [creee('ev-1', EN_ATTENTE_DE_LA_VILLE)];
    expect(await creer()).toEqual({
      actionKey: 'event_city_request_sent',
      payload: expect.objectContaining({ clubId: 'club-A', eventId: 'ev-1', ville: 'Ville de Montrivage' }),
    });
  });

  test('une série dont une date attend la mairie : le même bandeau', async () => {
    mockDecision = VILLE;
    mockCreees = [creee('ev-1', { pendingReason: 'none', status: 'confirmed' }), creee('ev-2', EN_ATTENTE_DE_LA_VILLE)];
    expect((await creer())?.actionKey).toBe('event_city_request_sent');
  });

  test('confirmée (dans le créneau du club) : « Événement créé », comme avant', async () => {
    mockDecision = VILLE;
    mockCreees = [creee('ev-1', { pendingReason: 'none', status: 'confirmed' })];
    expect((await creer())?.actionKey).toBe('event_created');
  });

  test('en attente du dirigeant (créneau du club au complet) ou d un lieu de club : pas de bandeau de la Ville', async () => {
    mockDecision = VILLE;
    mockCreees = [creee('ev-1', { pendingReason: 'club_slot_overflow', status: 'pending_validation' })];
    expect((await creer())?.actionKey).toBe('event_created');
    mockDecision = {
      ...VILLE, deLaVille: false, mairie: false, ville: null,
    };
    mockCreees = [creee('ev-1', EN_ATTENTE_DE_LA_VILLE)];
    expect((await creer())?.actionKey).toBe('event_created');
  });
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
