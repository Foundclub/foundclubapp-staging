import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardRecap from '../EventWizardRecap';

// FINITIONS-T8 point 1 (10/11, recette du 08/11) — le récapitulatif d'un « Autre » NOMMÉ
// affichait « 6/5 infos clés complétées » : la rangée « Nom » (EVT-AUTRE-NOM) compte, mais
// le total restait écrit en dur à 5. Le compteur dit maintenant « faites / rangées ».

jest.mock('../useMairieDecideALaCreation', () => ({
  __esModule: true,
  default: () => ({
    complet: false, deLaVille: false, mairie: false, tuAcceptes: false, ville: null,
  }),
}));

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const gabarit = typeof repli === 'string' ? repli : (repli?.defaultValue ?? cle);
      const v = typeof repli === 'object' && repli ? repli : (valeurs || {});
      return String(gabarit).replace(/\{\{(\w+)\}\}/g, (_, k) => String(v[k] ?? `{{${k}}}`));
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
      userData: { documentId: 'moi', role: { name: USER_ROLES.president, type: 'president' } },
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
 * Rend le récapitulatif et rend le texte du compteur.
 * @param {any} surcharges Champs de l'état du tunnel.
 * @returns {string} Le texte « x/y ... ».
 */
const lireLeCompteur = (surcharges) => {
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
    .map((/** @type {any} */ n) => [].concat(n.props.children).join(''))
    .filter((/** @type {string} */ s) => /infos cles completees/.test(s));
  act(() => arbre.unmount());
  return textes[0];
};

describe('FINITIONS-T8 — le compteur du récapitulatif ne dépasse jamais son total', () => {
  test('un « Autre » nommé et complet : 6/6, pas 6/5', () => {
    expect(lireLeCompteur({
      customName: 'Repas du club',
      type: { documentId: 'type-autre', name: 'Autre' },
    })).toBe('6/6 infos cles completees');
  });

  test('un « Autre » sans nom : 5/6', () => {
    expect(lireLeCompteur({
      customName: '',
      type: { documentId: 'type-autre', name: 'Autre' },
    })).toBe('5/6 infos cles completees');
  });

  test('un autre type, complet : 5/5 (rien ne change)', () => {
    expect(lireLeCompteur({})).toBe('5/5 infos cles completees');
  });
});
