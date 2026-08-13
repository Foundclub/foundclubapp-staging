import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { getEventShowcaseTemplate } from '@/domains/visuals/eventShowcaseTemplate';

import { RouteNames } from '@/navigation/routeNames';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import EventWizardRecap from '../EventWizardRecap';

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
const NOMBRE_DE_CACHES = 6;

const maintenant = () => Date.now() - mockChrono.depart;

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
    createReccurrentEventPayload: () => [{ name: 'Un evenement' }],
    createStageEventPayload: () => ({ name: 'Un stage' }),
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`.
// La creation est doublee par UNE attente : c'est la part serveur, elle n'est
// pas du ressort de ce lot — on la mesure, on ne la corrige pas.
jest.mock('@/services/event/eventService', () => ({
  createEventsWithConcurrency: async () => {
    await new Promise((resoudre) => {
      setTimeout(resoudre, 30);
    });
    return {
      created: [{
        documentId: 'ev-1',
        payload: { name: 'Un evenement' },
        response: { data: { documentId: 'ev-1' } },
      }],
      failed: [],
    };
  },
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

beforeEach(() => {
  mockProprietesDuGabarit.length = 0;
  mockJournalDesCaches.length = 0;
});

/**
 * Appuie sur « Creer » et chronometre jusqu'au changement d'ecran.
 *
 * D99 : `surcharges` permet de publier un autre TYPE que la detection de
 * `ETAT_COMPLET` — c'est lui, et lui seul, qui decide si l'ecran d'affiche est
 * empile derriere le detail. Le defaut ne bouge pas : les temoins ecrits avant
 * ce lot mesurent exactement ce qu'ils mesuraient.
 * @param {any} [surcharges] Champs de l'etat du tunnel a remplacer.
 * @returns {Promise<{ msJusquALEcranSuivant: number, reset: any[] }>} La mesure.
 */
const chronometrerLaCreation = async (surcharges = {}) => {
  /** @type {any[]} */
  const reset = [];
  const navigation = {
    canGoBack: () => true,
    goBack: () => {},
    navigate: () => {},
    push: () => {},
    replace: () => {},
    reset: (/** @type {any} */ config) => {
      reset.push({ ...config, msEcoulees: maintenant() });
    },
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
  act(() => semer({ payload: { ...ETAT_COMPLET, ...surcharges }, type: 'SET_META' }));
  act(() => {
    arbre.update(rendre(createElement(EventWizardRecap, {
      navigation,
      route: { params: {} },
    })));
  });

  const gabarit = mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];
  mockChrono.depart = Date.now();
  await act(async () => {
    await gabarit.onNext();
  });
  const msJusquALEcranSuivant = reset[0]?.msEcoulees ?? maintenant();

  act(() => arbre.unmount());
  return { msJusquALEcranSuivant, reset };
};

describe('D19 — le cout de « Creer », mesure en millisecondes', () => {
  test('l ecran suivant s affiche, et l evenement cree est celui qu il montre', async () => {
    const { reset } = await chronometrerLaCreation();

    expect(reset).toHaveLength(1);
    expect(reset[0].routes.map((/** @type {any} */ route) => route.name)).toEqual([
      RouteNames.EventDetails,
      RouteNames.EventPublishedShowcase,
    ]);
  });

  // D28 — l'ecran d'affiche ne recoit plus SEULEMENT un identifiant. Avant ce
  // lot, aucun appelant du monde evenement ne passait `template` : l'ecran
  // retombait sur `params.template || 'affiche-detection'` et TOUS les types —
  // match, entrainement, tournoi, stage — heritaient de l'affiche de detection
  // sans que personne ne l'ait decide. Le gabarit voyage desormais avec
  // l'evenement publie, decide par son TYPE (ici « Detection »).
  test('D28 — le gabarit d affiche voyage, decide par le type publie', async () => {
    const { reset } = await chronometrerLaCreation();

    const ecranAffiche = reset[0].routes
      .find((/** @type {any} */ route) => route.name === RouteNames.EventPublishedShowcase);
    expect(ecranAffiche.params.template).toBe(getEventShowcaseTemplate('Detection'));
    expect(ecranAffiche.params.eventId).toBeTruthy();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // D99 — LE DEUXIEME POINT D'ENTREE VERS L'AFFICHE, et le plus discret : ici,
  // personne ne demande a la voir, elle S'OUVRE TOUTE SEULE apres la creation.
  // Fermer la chip du menu « Gerer » sans fermer celle-ci n'aurait rien protege
  // — c'est exactement le defaut que le prompt du lot nomme : « retirer un seul
  // bouton et en laisser trois ne protege rien ».
  // ───────────────────────────────────────────────────────────────────────────
  test('D99 — un ENTRAINEMENT publie n ouvre plus l ecran d affiche', async () => {
    const { reset } = await chronometrerLaCreation({
      type: { documentId: 'type-entrainement', name: 'Entrainement' },
    });

    expect(reset).toHaveLength(1);
    expect(reset[0].routes.map((/** @type {any} */ route) => route.name)).toEqual([
      RouteNames.EventDetails,
    ]);
    // ⛔ L'index doit suivre la pile : laisse a 1 sur une pile d'une seule
    // route, React Navigation viserait un ecran qui n'existe pas.
    expect(reset[0].index).toBe(0);
  });

  // Ce que l'organisateur voit a la place n'est PAS un ecran vide : il atterrit
  // sur le detail de son entrainement, avec sa celebration de creation. Rien ne
  // se perd, seule l'affiche disparait.
  test('D99 — et il atterrit bien sur son evenement, celebration comprise', async () => {
    const { reset } = await chronometrerLaCreation({
      type: { documentId: 'type-entrainement', name: 'Entrainement' },
    });

    const [detail] = reset[0].routes;
    expect(detail.name).toBe(RouteNames.EventDetails);
    expect(detail.params.eventId).toBeTruthy();
    expect(detail.params.creationCelebration).toBeTruthy();
  });

  // 🔒 LA NON-REGRESSION, au meme endroit. Les autres types gardent l'ecran
  // d'affiche juste apres publication — c'est la ou une detection recrute.
  test.each([
    ['Match'],
    ['Tournoi'],
    ['Stage'],
  ])('🔒 D99 — un « %s » publie ouvre TOUJOURS son affiche', async (nomDuType) => {
    const { reset } = await chronometrerLaCreation({
      type: { documentId: `type-${nomDuType}`, name: nomDuType },
    });

    expect(reset[0].routes.map((/** @type {any} */ route) => route.name)).toEqual([
      RouteNames.EventDetails,
      RouteNames.EventPublishedShowcase,
    ]);
    expect(reset[0].index).toBe(1);
  });

  test('les six caches sont rafraichis, aucun n est perdu en route', async () => {
    await chronometrerLaCreation();

    expect(mockJournalDesCaches.map((ligne) => ligne.cle).sort()).toEqual([
      'app-bootstrap',
      'club-planning',
      'events',
      'get-me',
      'pending-featured-requests',
      'planning',
    ]);
  });

  // 🧨 LE TEMOIN DU LOT. Avant D19, les six invalidations etaient attendues
  // UNE PAR UNE : la sixieme ne partait qu'apres l'arrivee de la cinquieme.
  // Avec une latence de 30 ms, l'ecart entre le premier depart et le dernier
  // valait donc 5 x 30 = 150 ms de file indienne — un temps mort pendant lequel
  // l'ecran reste fige sur « c'est cree », sans rien montrer.
  test('les six caches partent ENSEMBLE, pas en file indienne', async () => {
    await chronometrerLaCreation();

    const departs = mockJournalDesCaches.map((ligne) => ligne.depart);
    const etalement = Math.max(...departs) - Math.min(...departs);

    expect(mockJournalDesCaches).toHaveLength(NOMBRE_DE_CACHES);
    expect(etalement).toBeLessThan(LATENCE_RESEAU);
  });

  // Le temoin cote UTILISATEUR : l'ecran change sans attendre le menage.
  // `invalidateQueries` marque les requetes perimees de facon SYNCHRONE ; seule
  // la refetch est asynchrone, et le `queryClient` est un singleton qui lui
  // survit. Attendre ne servait donc qu'a faire patienter.
  //
  // Budget : une seule attente reseau sur le chemin critique — la creation
  // elle-meme, qui est du ressort du serveur. On tolere deux latences pour
  // absorber le bruit de la machine.
  test('l ecran change sans attendre le menage du cache', async () => {
    const { msJusquALEcranSuivant } = await chronometrerLaCreation();

    expect(`${msJusquALEcranSuivant < LATENCE_RESEAU * 2} (${msJusquALEcranSuivant} ms)`)
      .toBe(`true (${msJusquALEcranSuivant} ms)`);
  });
});
