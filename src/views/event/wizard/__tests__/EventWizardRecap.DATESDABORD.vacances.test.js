/* eslint-disable max-len -- des phrases entières, comparées telles quelles */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardRecap from '../EventWizardRecap';

// 🗓️ DATESDABORD (26/10/2026, décision du chef « Q2 B ») — LE RÉCAPITULATIF D'UNE SÉRIE « SAUF
// VACANCES SCOLAIRES » : la case et les périodes de la zone arrivent jusqu'à la série qui part
// (`createReccurrentEventPayload`, qui retire les séances des vacances), et le récapitulatif dit
// « Sauf vacances scolaires : 4 séances retirées ». ROUGE avant : `buildWizardFormData` ne
// transmettait ni la case ni les périodes (les séances des vacances partaient quand même), et le
// récapitulatif ne disait rien. Les doublures sont celles de SERIE-ANNONCE.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockProprietesDuGabarit = [];
/** Ce que l'assistant passe à la série, à chaque calcul. */
const mockDonneesDeLaSerie = /** @type {any[]} */ ([]);
const mockCreerEnLot = jest.fn();
const mockAnnoncerLaSerie = jest.fn();
const mockAlerte = jest.fn();

// COLL-R-APP-CREATION (13/10) — « la mairie décidera ? » a son propre témoin
// (useMairieDecideALaCreation.CRA4.test.js) : ici, la mairie ne décide pas.
jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: () => ({
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  }),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      const valeurs = repli && typeof repli === 'object' ? repli : (options || {});
      let modele = typeof repli === 'string' ? repli : cle;
      if (valeurs.count !== undefined && valeurs[`defaultValue_${valeurs.count === 1 ? 'one' : 'other'}`]) {
        modele = valeurs[`defaultValue_${valeurs.count === 1 ? 'one' : 'other'}`];
      }
      return String(modele).replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ tout, /** @type {string} */ nom) => (
        valeurs[nom] !== undefined ? String(valeurs[nom]) : tout
      ));
    },
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
    createReccurrentEventPayload: (/** @type {any} */ donnees) => {
      mockDonneesDeLaSerie.push(donnees);
      return Array.from({ length: donnees?.exceptHolidays ? 8 : 12 }, () => ({
        name: '', recurrenceGroupId: 'serie-1', team: 'equipe-1',
      }));
    },
    createStageEventPayload: () => ({ name: 'Un stage' }),
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`.
jest.mock('@/services/event/eventService', () => ({
  announceEventSeries: (/** @type {any[]} */ ...args) => mockAnnoncerLaSerie(...args),
  createEventsWithConcurrency: (/** @type {any[]} */ ...args) => mockCreerEnLot(...args),
  // SERIES (08/10) — une serie part par `createEventSeries` (une requete) : le meme lot, vu d ici.
  createEventSeries: (/** @type {any[]} */ ...args) => mockCreerEnLot(...args),
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

jest.mock('react-native/Libraries/Alert/Alert', () => {
  const mockModule = {
    alert: (/** @type {any[]} */ ...args) => mockAlerte(...args),
  };
  // RN 0.79 lit `require(module).default` : le mock sert les DEUX formes
  // (motif de GuideOffersRecap.test.js).
  return { ...mockModule, default: mockModule };
});

const ETAT = {
  date: new Date('2027-10-13T15:30:00.000Z'),
  endTime: new Date('2027-10-13T17:00:00.000Z'),
  facility: { documentId: 'inst-1', name: 'Gymnase' },
  location: 'Gymnase · 21 rue Fortia',
  sessionStatus: 'closed',
  startTime: new Date('2027-10-13T15:30:00.000Z'),
  team: {
    activities: [{ documentId: 'act-1', name: 'Football' }],
    club: { documentId: 'club-1', name: 'FC Test' },
    documentId: 'equipe-1',
    name: 'U15',
    sport: { documentId: 'sport-1', name: 'Football' },
  },
  type: { documentId: 'type-entrainement', name: 'Entrainement' },
  validationMode: 'auto',
  // DATESDABORD : chaque semaine, sauf vacances scolaires (la Toussaint de la zone B).
  exceptHolidays: true,
  holidayPeriods: [{
    end: '2027-11-01', key: '2027-2028:toussaint', name: 'Toussaint', start: '2027-10-23',
  }],
  isRecurrent: true,
  recurrenceDays: [3],
  recurrenceEndDate: new Date('2027-12-22T12:00:00.000Z'),
  recurrenceFrequency: 'week',
  recurrenceInterval: 1,
  recurrenceStartDate: new Date('2027-10-13T12:00:00.000Z'),
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
 * Pose les dates rendues par le serveur double : une par payload, la 1re a l'identifiant `ev-1`.
 * @param {any[]} payloads Les dates envoyees.
 * @returns {Promise<{ created: any[], failed: any[] }>} Le resultat du lot.
 */
const toutesPosees = async (payloads) => ({
  created: payloads.map((payload, index) => ({
    documentId: `ev-${index + 1}`,
    payload,
    response: { data: { documentId: `ev-${index + 1}` } },
  })),
  failed: [],
});

beforeEach(() => {
  mockProprietesDuGabarit.length = 0;
  mockCreerEnLot.mockReset();
  mockAnnoncerLaSerie.mockReset();
  mockAlerte.mockReset();
  mockCreerEnLot.mockImplementation(toutesPosees);
  mockAnnoncerLaSerie.mockResolvedValue({ data: { announced: true, count: 3 } });
});

// Le premier rendu de l'assistant, a froid, depasse les 5 s par defaut de jest sur ce poste.
jest.setTimeout(30000);

const textesSous = (/** @type {any} */ noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

/**
 * Monte le récapitulatif sur l'état semé, et rend ses textes.
 * @param {any} etat - L'état du tunnel.
 * @returns {string[]} Les textes rendus.
 */
const afficherLeRecap = (/** @type {any} */ etat) => {
  mockDonneesDeLaSerie.length = 0;
  const navigation = {
    canGoBack: () => true, goBack: () => {}, navigate: () => {}, push: () => {}, replace: () => {}, reset: () => {},
  };
  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    contenu,
  );
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: etat, type: 'SET_META' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardRecap, { navigation, route: { params: {} } })));
  });
  const textes = textesSous(arbre.root);
  act(() => arbre.unmount());
  return textes;
};

describe('DATESDABORD — le récapitulatif d une série « sauf vacances scolaires »', () => {
  test('la case et les périodes arrivent jusqu à la série qui part', () => {
    afficherLeRecap(ETAT);
    // Le premier calcul est la série qui part ; le second, sans la case, compte ce qu'elle retire.
    const laSerie = mockDonneesDeLaSerie[0];
    expect(laSerie.exceptHolidays).toBe(true);
    expect(laSerie.holidayPeriods).toHaveLength(1);
  });

  test('le récapitulatif dit les séances prévues et celles retirées pendant les vacances', () => {
    const textes = afficherLeRecap(ETAT);
    expect(textes).toContain('Sauf vacances scolaires : 4 séances retirées');
  });

  test('sans la case : pas de ligne « sauf vacances »', () => {
    const textes = afficherLeRecap({ ...ETAT, exceptHolidays: false, holidayPeriods: [] });
    expect(textes.join(' ')).not.toContain('Sauf vacances scolaires');
  });
});
