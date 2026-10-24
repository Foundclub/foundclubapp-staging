import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { getEventShowcaseTemplate } from '@/domains/visuals/eventShowcaseTemplate';

import { RouteNames } from '@/navigation/routeNames';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardRecap from '../EventWizardRecap';

// BH07 / P7-01 (24/10) — fermer la feuille d'echec partiel puis re-appuyer sur « Creer »
// ne doit pas recreer les dates deja creees.
// Montage repris de EventWizardRecap.creation.test.js.
// Filet D19 — CE QUE COUTE « CREER », EN MILLISECONDES.
//
// Motif : a la recette du 2026-08-07, Adel constate qu'appuyer sur « Creer »
// « met un peu de temps ». « Lent » n'est pas un diagnostic — ce fichier mesure.
//
// METHODE : chaque aller-retour reseau du chemin est double par une attente de
// duree CONNUE (`LATENCE_RESEAU`). Le temps total mesure entre l'appui et le
// changement d'ecran ne depend donc plus du reseau reel, mais UNIQUEMENT du
// nombre d'attentes que l'ecran met BOUT A BOUT. C'est cet enchainement-la qui
// est du ressort de l'app ; le temps passe cote serveur ne l'est pas.
//
// 🧨 CE QUE LA MESURE A TROUVE, le 2026-08-07 : la creation elle-meme est deja
// parallele (3 de front, `CREATE_EVENT_BATCH_CONCURRENCY`) et montre sa
// progression. Le temps mort etait APRES : six invalidations de cache attendues
// UNE PAR UNE, chacune declenchant ses refetch, avant de changer d'ecran. Six
// allers-retours en file indienne pendant lesquels l'ecran est fige sur
// « N/N cree ».

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockProprietesDuGabarit = [];
/** Le journal des invalidations de cache : quand chacune part, quand elle finit. */
const mockJournalDesCaches = [];
/** L'origine des temps, posee juste avant l'appui sur « Creer ». */
const mockChrono = { depart: 0 };

/**
 * La latence donnee a CHAQUE aller-retour reseau double. Volontairement courte
 * (le test doit rester rapide) mais tres au-dessus du bruit de Jest.
 */
const LATENCE_RESEAU = 30;

/** Le nombre de caches que l'ecran rafraichit apres une creation reussie. */
const NOMBRE_DE_CACHES = 7;

const maintenant = () => Date.now() - mockChrono.depart;

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

// Le cache est double par une attente de duree CONNUE, et il se JOURNALISE :
// c'est ce journal qui dit si les six invalidations partent ensemble ou en file
// indienne.
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: () => Promise.resolve(null),
    invalidateQueries: async (/** @type {any} */ filtres) => {
      const cle = String(filtres?.queryKey?.[0] || '?');
      const depart = Date.now() - mockChrono.depart;
      await new Promise((resoudre) => {
        setTimeout(resoudre, 30);
      });
      mockJournalDesCaches.push({ arrivee: Date.now() - mockChrono.depart, cle, depart });
    },
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
    createReccurrentEventPayload: () => [{ name: 'A', recurrenceGroupId: 'g' }, { name: 'B', recurrenceGroupId: 'g' }],
    createStageEventPayload: () => ({ name: 'Un stage' }),
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`.
// La creation est doublee par UNE attente : c'est la part serveur, elle n'est
// pas du ressort de ce lot — on la mesure, on ne la corrige pas.
// RETOUR-ONGLET-2 — une creation dont le serveur ne rend AUCUN identifiant : c'est le
// repli `EventWizardRecap:920`. Faux par defaut : les temoins ecrits avant ce lot
// mesurent exactement ce qu'ils mesuraient.
const mockEnvois = [];
jest.mock('@/services/event/eventService', () => ({
  createEventSeries: async (/** @type {any[]} */ payloads) => {
    mockEnvois.push(...payloads.map((p) => p.name));
    return {
      created: payloads.filter((p) => p.name === 'A')
        .map((p) => ({ documentId: 'ev-A', payload: p, response: { data: { documentId: 'ev-A' } } })),
      failed: payloads.filter((p) => p.name !== 'A').map((p) => ({ error: new Error('x'), payload: p })),
    };
  },
  createEventsWithConcurrency: async () => ({ created: [], failed: [] }),
  getEventById: () => Promise.resolve(null),
  requestFeatured: () => Promise.resolve(null),
  rollbackEventsByCancel: () => Promise.resolve([]),
}));

const mockFeuilles = [];
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  mockFeuilles.push(props);
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


test('P7-01 — fermer la feuille d echec partiel puis recreer ne duplique pas les dates creees', async () => {
  const navigation = {
    canGoBack: () => true, goBack: () => {}, navigate: () => {}, push: () => {}, replace: () => {}, reset: () => {},
  };
  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider, null, createElement(PriseDeCourant), contenu,
  );
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: ETAT_COMPLET, type: 'SET_META' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardRecap, { navigation, route: { params: {} } })));
  });
  const appuyerSurCreer = async () => {
    const gabarit = mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];
    await act(async () => { await gabarit.onNext(); });
  };
  await appuyerSurCreer();
  expect(mockEnvois).toEqual(['A', 'B']);
  const feuille = mockFeuilles.filter((p) => p.isVisible).pop();
  act(() => { feuille.close(); });
  await appuyerSurCreer();
  expect(mockEnvois.filter((nom) => nom === 'A')).toHaveLength(1);
  act(() => arbre.unmount());
});
