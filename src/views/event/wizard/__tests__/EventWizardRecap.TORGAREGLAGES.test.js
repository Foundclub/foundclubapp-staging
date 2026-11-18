/* eslint-disable max-len -- des phrases entières, comparées telles quelles */
import { buildWizardFormData } from '../EventWizardRecap';

// T-ORGA-REGLAGES (18/11, nuit D231) — le récapitulatif envoie au serveur les règles payantes
// saisies à l étape des réglages (EventWizardTournamentSettings). Doublures de DATESDABORD.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockProprietesDuGabarit = [];
/** Ce que l'assistant passe à la série, à chaque calcul. */
const mockDonneesDeLaSerie = /** @type {any[]} */ ([]);
const mockCreerEnLot = jest.fn();
const mockAnnoncerLaSerie = jest.fn();
const mockAlerte = jest.fn();
/** VACANCES-REPETE : la vraie série dépliée, au lieu de la doublure. */
const mockVraieSerie = false;

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
      if (mockVraieSerie) {
        return jest.requireActual('@/domains/event/eventUseCases')
          .createReccurrentEventPayload(donnees);
      }
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

describe('T-ORGA-REGLAGES — le récapitulatif envoie les règles payantes', () => {
  const tournoi = (/** @type {any} */ extra) => buildWizardFormData({
    date: new Date('2026-12-19T18:00:00.000Z'),
    endTime: new Date('2026-12-19T22:00:00.000Z'),
    startTime: new Date('2026-12-19T18:00:00.000Z'),
    type: { documentId: 't', name: 'Tournoi' },
    ...extra,
  }).tournamentConfig;

  test('🔴 les quatre réglages saisis partent dans tournamentConfig', () => {
    expect(tournoi({
      tournamentEntryFeeCents: 2000, tournamentJerseySizeRequired: true, tournamentMinAge: 16, tournamentPaidMembersToValidate: 5,
    })).toEqual(expect.objectContaining({
      entryFeeCents: 2000, jerseySizeRequired: true, minAge: 16, paidMembersToValidate: 5,
    }));
  });

  test('sans saisie : gratuit, sans âge, sans maillot, seuil laissé au serveur (5)', () => {
    expect(tournoi({})).toEqual(expect.objectContaining({
      entryFeeCents: 0, jerseySizeRequired: false, minAge: null, paidMembersToValidate: null,
    }));
  });
});
