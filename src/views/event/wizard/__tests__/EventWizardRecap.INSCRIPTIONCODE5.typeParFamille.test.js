import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardRecap from '../EventWizardRecap';

// INSCRIPTION-CODE-5 (20/11, point a du chef) — le récapitulatif disait le nom du SERVEUR
// (« Match ») après que l'étape « Type » a affiché « Sortie » à un spéléologue. Il dit
// maintenant le mot de la famille du lecteur (la même règle que l'étape « Type »,
// domains/event/nomDuTypeAffiche.js) ; le type envoyé reste l'objet du serveur.
// Doublures de FINITIONS-T8 (EventWizardRecap.FINITIONST8.compteur.test.js).

/** L'activité du compte (preferredSport). */
const mockActivite = { current: 'Football' };

jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: () => ({
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  }),
}));

// La doublure lit fr.js : les mots de chaque famille (familles.<f>.evenements).
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

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
  return props.children ?? null;
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
      userData: {
        documentId: 'moi',
        preferredSport: mockActivite.current,
        role: { name: USER_ROLES.president, type: 'president' },
      },
    }),
  };
});


jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    createReccurrentEventPayload: () => [{ name: 'Un evenement' }],
    createStageEventPayload: () => ({ name: 'Un stage' }),
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

jest.mock('@/services/event/eventService', () => ({
  createEventsWithConcurrency: () => Promise.resolve({ created: [], failed: [] }),
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
// non transforme : sans cette doublure, la suite meurt au CHARGEMENT, avant le
// premier test. Le Recap l'atteint par `EventTasksEditor`.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);

const ETAT_COMPLET = {
  capacity: 12,
  date: new Date('2027-08-12T15:00:00.000Z'),
  description: 'Viens essayer le foot',
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
  type: { documentId: 'type-detection', name: 'Detection' },
  validationMode: 'auto',
};

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
 * Rend le récapitulatif et rend tous ses textes.
 * @param {string} activite L'activité du compte.
 * @param {any} surcharges Champs de l'état du tunnel.
 * @returns {string[]} Les textes de l'écran.
 */
const lireLesTextes = (activite, surcharges) => {
  mockActivite.current = activite;
  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    contenu,
  );
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: { ...ETAT_COMPLET, ...surcharges }, type: 'SET_META' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardRecap, {
      navigation: { canGoBack: () => true, goBack: () => {}, navigate: () => {} },
      route: { params: {} },
    })));
  });
  const textes = arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text')
    .map((/** @type {any} */ n) => [].concat(n.props.children).join(''));
  act(() => arbre.unmount());
  return textes;
};

const MATCH = { type: { documentId: 'type-match', name: 'Match' } };

describe('INSCRIPTION-CODE-5 — le récapitulatif dit le type avec les mots de la famille', () => {
  test('🔴 spéléologie, « Match » du serveur : « Sortie », jamais « Match »', () => {
    const textes = lireLesTextes('Spéléologie', MATCH);
    expect(textes).toContain('Sortie');
    expect(textes).not.toContain('Match');
  });

  test('🔴 judo, « Entraînement » : « Cours / Entraînement »', () => {
    expect(lireLesTextes('Judo', { type: { documentId: 't-e', name: 'Entraînement' } }))
      .toContain('Cours / Entraînement');
  });

  test('🔴 théâtre, « Tournoi » : « Festival / Gala »', () => {
    expect(lireLesTextes('Théâtre', { type: { documentId: 't-t', name: 'Tournoi' } }))
      .toContain('Festival / Gala');
  });

  test('football : « Match », comme aujourd’hui', () => {
    expect(lireLesTextes('Football', MATCH)).toContain('Match');
  });

  test('spéléologie, « Autre » : le nom du serveur (aucun mot de famille)', () => {
    expect(lireLesTextes('Spéléologie', {
      customName: 'Repas du club',
      type: { documentId: 'type-autre', name: 'Autre' },
    })).toContain('Autre');
  });
});
