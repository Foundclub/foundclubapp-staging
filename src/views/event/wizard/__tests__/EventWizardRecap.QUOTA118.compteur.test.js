import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardRecap from '../EventWizardRecap';

// QUOTA-118 (31/10, point 118 de la recette, décision d'Adel « 4- B ») — le récapitulatif
// doit lire LE compteur que le serveur va décompter. La policy de création
// (admin is-event-trainer-create.ts) décompte MATCH_PUBLISH quand le nom du type contient
// « match », EVENT_PUBLISH sinon. Le récapitulatif lisait toujours EVENT_PUBLISH : pour un
// match, il annonçait le reste du quota événement et le transmettait à la fiche créée.
// Montage repris de EventWizardRecap.BH07.echecPartiel.test.js.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockProprietesDuGabarit = [];

jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: () => ({
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  }),
}));
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

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockProprietesDuGabarit.push(props);
  return null;
});

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: () => Promise.resolve(null),
    invalidateQueries: () => Promise.resolve(),
    setQueryData: () => {},
  }),
}));

// Un dirigeant gratuit : son événement gratuit est INTACT, son match gratuit est UTILISÉ.
// Les deux compteurs diffèrent exprès : lire le mauvais se voit.
jest.mock('@/domains/auth/useAuth', () => {
  const { USER_ROLES } = jest.requireActual('@/domains/auth/authUseCases');
  return {
    __esModule: true,
    default: () => ({
      freeUsageSummary: [
        {
          limit: 1, quotaType: 'EVENT_PUBLISH', remaining: 1, teamDocumentId: 'equipe-1', used: 0,
        },
        {
          limit: 1, quotaType: 'MATCH_PUBLISH', remaining: 0, teamDocumentId: 'equipe-1', used: 1,
        },
      ],
      subscriptionAccessLevel: 'FREE',
      USER_ROLES,
      userData: { documentId: 'moi', role: { name: USER_ROLES.president, type: 'president' } },
    }),
  };
});

jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    createReccurrentEventPayload: () => [{ name: 'A', recurrenceGroupId: 'g' }],
    createStageEventPayload: () => ({ name: 'Un stage' }),
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`.
// Une date seule part par `createEventsWithConcurrency` : le serveur la crée.
jest.mock('@/services/event/eventService', () => ({
  createEventSeries: async () => ({ created: [], failed: [] }),
  createEventsWithConcurrency: async (/** @type {any[]} */ payloads) => ({
    created: payloads.map((p) => ({
      documentId: 'ev-A', payload: p, response: { data: { documentId: 'ev-A' } },
    })),
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

// `SegmentedControl` tire `react-native-gesture-handler`, publie en TypeScript
// non transforme : sans cette doublure, la suite meurt au CHARGEMENT.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);

const ETAT_DE_BASE = {
  capacity: 12,
  date: new Date('2027-08-12T15:00:00.000Z'),
  description: 'Viens jouer',
  endTime: new Date('2027-08-12T16:00:00.000Z'),
  facility: { documentId: 'inst-1', name: 'Gymnase' },
  location: 'Gymnase · 21 rue Fortia',
  startTime: new Date('2027-08-12T15:00:00.000Z'),
  team: {
    activities: [{ documentId: 'act-1', name: 'Football' }],
    club: { documentId: 'club-1', name: 'FC Test' },
    documentId: 'equipe-1',
    name: 'U15 A',
    sport: { documentId: 'sport-1', name: 'Football' },
  },
  validationMode: 'auto',
};

/** Le dispatch du tunnel, capte pour semer l'etat de depart. */
let semer = () => {};

/**
 * Sonde sans rendu : elle expose le `dispatch` du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  semer = useEventWizard().dispatch;
  return null;
}

/**
 * Cree l'evenement du type donne et rend le compteur que l'ecran transmet a la fiche creee.
 * @param {{ documentId: string, name: string }} type Le type d'evenement choisi.
 * @returns {Promise<any>} `subscriptionFollowUp` de la fiche ouverte apres creation.
 */
const compteurTransmis = async (type) => {
  /** @type {any[]} */
  const reinitialisations = [];
  const navigation = {
    canGoBack: () => true,
    goBack: () => {},
    navigate: () => {},
    push: () => {},
    replace: () => {},
    reset: (/** @type {any} */ etat) => { reinitialisations.push(etat); },
  };
  const prise = createElement(PriseDeCourant);
  const rendre = (/** @type {any} */ c) => createElement(EventWizardProvider, null, prise, c);
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: { ...ETAT_DE_BASE, type }, type: 'SET_META' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardRecap, { navigation, route: { params: {} } })));
  });
  const gabarit = mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];
  await act(async () => { await gabarit.onNext(); });
  act(() => arbre.unmount());
  return reinitialisations[0]?.routes?.[0]?.params?.subscriptionFollowUp;
};

test('QUOTA-118 — un match lit MATCH_PUBLISH, le compteur que le serveur decompte', async () => {
  expect(await compteurTransmis({ documentId: 'type-match', name: 'Match amical' })).toEqual({
    beforeRemaining: 0,
    consumedCount: 1,
    quotaType: 'MATCH_PUBLISH',
    total: 1,
  });
});

test('QUOTA-118 — un evenement hors match garde le compteur EVENT_PUBLISH', async () => {
  expect(await compteurTransmis({ documentId: 'type-detection', name: 'Detection' })).toEqual({
    beforeRemaining: 1,
    consumedCount: 1,
    quotaType: 'EVENT_PUBLISH',
    total: 1,
  });
});
