import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit';

// R5 (b) — CE FICHIER EST LE PREMIER TEST D'EventEdit.js (1 369 lignes, E6).
//
// Constat de recette de la 2.6.26 : « tous les boutons de modifier un evenement
// sont lents a s'ouvrir ». L'ecran ne calcule rien de lourd : il ATTEND. Il tire
// ses donnees AU MONTAGE, c'est-a-dire une fois qu'il est deja a l'ecran.
//
// Ce fichier CARACTERISE D'ABORD ce qu'il demande en arrivant — c'est le seul
// filet qui existe sur ce fichier — PUIS verrouille les deux gestes de R5 :
//   · les lectures qui ne changent pas d'une ouverture a l'autre ne repartent
//     plus au reseau a chaque montage ;
//   · un cache deja rempli (par le prechargement de la fiche, `EventDetails.js`)
//     dispense l'ecran de toute lecture reseau.
//
// 🔑 POURQUOI LE VRAI `react-query` ICI, ET PAS UNE DOUBLURE : ce qui est mesure
// EST le comportement de cache. Une doublure de `useQuery` rendrait ces temoins
// verts sans rien prouver — ils compteraient des appels a un mensonge. Ce sont
// donc les SERVICES qui sont doubles, une couche plus bas, et le client de
// requetes est le vrai. C'est aussi ce qui rend le temoin du prechargement
// honnete : il verifie que la clef ecrite par la fiche est bien celle que cet
// ecran-ci relit.
//
// ⚠️ CE QU'IL NE PROUVE PAS : aucun temps en millisecondes. Il compte des appels
// reseau evites. Le gain ressenti se constate en recette, sur un telephone.

// `initReactI18next` doit rester le VRAI : le graphe d'imports de l'ecran
// initialise i18next au chargement, et un module indefini le fait exploser.
jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// `ScrollView` vient de react-native-gesture-handler, publie en TypeScript non
// transforme : sans doublure, la SUITE ENTIERE meurt au chargement et aucun test
// ne s'execute (piege connu du depot).
jest.mock('react-native-gesture-handler', () => {
  const { ScrollView: DefilementRN } = jest.requireActual('react-native');
  return { ScrollView: DefilementRN };
});

// Le theme est monte avec les VRAIS modules : un Proxy rend les echecs Jest
// illisibles (piege paye au lot paywall).
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    userData: {
      club: { documentId: 'club-1' },
      documentId: 'user-1',
      role: { name: 'Entraineur' },
      trainedTeams: [{ club: { documentId: 'club-1' }, documentId: 'team-1', name: 'U15' }],
    },
  }),
}));

// LES SEULES PORTES SUR LE RESEAU. Tout ce qui est compte dans ce fichier passe
// par elles, et par elles seules.
jest.mock('@/services/event/eventService', () => ({
  createEvent: jest.fn(() => Promise.resolve({})),
  getEventByIdForEdit: jest.fn(() => Promise.resolve(null)),
  getEventTypes: jest.fn(() => Promise.resolve([
    { documentId: 'type-entrainement', name: 'Entrainement' },
    { documentId: 'type-match', name: 'Match' },
  ])),
  updateEvent: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [] })),
}));

// Les feuilles d'interface sont doublees : ce fichier ne juge pas leur dessin,
// il juge ce que l'ecran DEMANDE en arrivant. `AutocompleteSelect` garde ses
// options : c'est par lui qu'on relit ce que l'ecran a recu.
jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function AutocompleteSelectDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      options: props.options,
      testID: `select-${props.label || 'sans-libelle'}`,
    });
  };
});

/* eslint-disable global-require */
jest.mock(
  '@/components/atoms/button/Button',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_Button'),
);
jest.mock(
  '@/components/molecules/datePickerInput/DatePickerInput',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_DatePickerInput'),
);
jest.mock(
  '@/components/molecules/dayPicker/DayPicker',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_DayPicker'),
);
jest.mock(
  '@/components/molecules/input/Input',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_Input'),
);
jest.mock(
  '@/components/molecules/timePickerInput/TimePickerInput',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_TimePickerInput'),
);
jest.mock(
  '@/components/organisms/facilitySelector/FacilitySelector',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_FacilitySelector'),
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function ScreenContainerDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '../components/EventTasksEditor',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTasksEditor'),
);
jest.mock(
  '../components/EventTeamAudiencesEditor',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EventTeamAudiencesEditor'),
);
/* eslint-enable global-require */

jest.setTimeout(30000);

const eventService = jest.requireMock('@/services/event/eventService');
const teamService = jest.requireMock('@/services/team/teamService');

/** @type {any} */
let arbre = null;
/** @type {any} */
let client = null;

/**
 * Un client de requetes NEUF, sans reessai : un echec doit se voir tout de
 * suite, pas se rejouer trois fois avant de faire expirer le test.
 * @returns {any} - Le client.
 */
const clientNeuf = () => new QueryClient({
  defaultOptions: { queries: { gcTime: Infinity, retry: false } },
});

/**
 * Monte l'ecran de modification d'un evenement existant.
 * @param {any} [clientFourni] - Client a reutiliser, pour prouver le cache.
 * @returns {any} - La racine du rendu.
 */
const monter = (clientFourni) => {
  client = clientFourni || clientNeuf();

  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(EventEdit, {
        navigation: {
          canGoBack: () => false,
          goBack: jest.fn(),
          navigate: jest.fn(),
          replace: jest.fn(),
          setOptions: jest.fn(),
        },
        route: { params: { eventId: 'event-1' } },
      }),
    ));
  });

  return arbre.root;
};

/**
 * Demonte l'arbre courant s'il y en a un.
 * @returns {void}
 */
const demonter = () => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
};

/**
 * Laisse repondre les lectures en vol. Un seul tour de microtaches ne suffit
 * plus des lors que l ecran porte plusieurs requetes : elles se resolvent en
 * cascade, et le rendu qui porte les donnees arrive au tour suivant.
 * @returns {Promise<void>} - Quand tout est retombe.
 */
const laisserRepondreLeReseau = async () => {
  await act(async () => {
    await new Promise((resoudre) => { setTimeout(resoudre, 0); });
  });
};

/**
 * Attend, par tours bornes, qu une condition devienne vraie.
 *
 * 🪤 POURQUOI PAS UN SIMPLE DELAI : un tour d attente fixe suffit sur une
 * machine au repos et PLUS sous la charge de la suite complete — le temoin
 * devient alors rouge une fois sur deux, sans que rien ne soit casse. Ici la
 * borne ne rend RIEN de plus vrai : si la condition n arrive jamais, on sort
 * au bout des 20 tours et l assertion qui suit echoue quand meme.
 * @param {() => boolean} condition - Ce qu on attend.
 * @returns {Promise<void>} - Quand la condition tient, ou au bout des tours.
 */
const attendreQue = async (condition) => {
  for (let tour = 0; tour < 20 && !condition(); tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await laisserRepondreLeReseau();
  }
};

beforeEach(() => {
  eventService.getEventByIdForEdit.mockClear();
  eventService.getEventTypes.mockClear();
  teamService.getTeams.mockClear();
});

afterEach(() => {
  demonter();
  if (client) client.clear();
  client = null;
});

describe('EventEdit — ce que l ecran demande en arrivant (caracterisation)', () => {
  test('il tire l evenement, les types, et les equipes du club', async () => {
    monter();
    await attendreQue(() => teamService.getTeams.mock.calls.length > 0);

    expect(eventService.getEventByIdForEdit).toHaveBeenCalledWith('event-1');
    expect(eventService.getEventTypes).toHaveBeenCalled();
    expect(teamService.getTeams).toHaveBeenCalledWith({ clubId: 'club-1', pageSize: 100 });
  });

  test('et les types recus deviennent les choix du selecteur « type »', async () => {
    const root = monter();

    // 🪤 LA LECTURE SE FAIT ICI, PAS AVANT L ATTENTE. Un noeud releve par
    // `findAll` est un INSTANTANE : garde en variable avant que les donnees
    // arrivent, il rend encore les proprietes du rendu d avant. Le temoin
    // tombait alors sur une liste vide alors que l ecran affichait bien les
    // deux types (mesure : 0 tour d attente supplementaire necessaire).
    const optionsDuSelecteur = () => root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.testID === 'select-eventEdit.fields.type.label',
      { deep: false },
    )[0]?.props?.options;

    await attendreQue(() => (optionsDuSelecteur() || []).length > 0);

    expect(optionsDuSelecteur()).toEqual([
      { label: 'Entrainement', value: 'type-entrainement' },
      { label: 'Match', value: 'type-match' },
    ]);
  });
});

describe('R5 (b) — l ecran ne redemande plus ce qu il a deja', () => {
  // LE TEMOIN DU PRECHARGEMENT, VU DE L'AUTRE BOUT. La fiche d'evenement remplit
  // ces deux clefs au moment ou l'on touche « Modifier » (`EventDetails.js`).
  // Si cet ecran repart quand meme au reseau, le prechargement n'aura rien
  // avance — et c'est exactement ce que faisait la liste des types, qui n'avait
  // aucune duree de fraicheur et se rechargeait a CHAQUE ouverture.
  test('un cache deja rempli sous ses clefs lui evite toute lecture reseau', async () => {
    const clientPreRempli = clientNeuf();
    clientPreRempli.setQueryData(['event', 'event-1', 'edit'], { documentId: 'event-1' });
    clientPreRempli.setQueryData(['event-types'], [
      { documentId: 'type-match', name: 'Match' },
    ]);

    monter(clientPreRempli);
    // ⛔ ICI, PAS D ATTENTE PAR CONDITION : ce qui est mesure est une ABSENCE.
    // On laisse donc plusieurs tours a un appel tardif pour se montrer.
    await attendreQue(() => false);

    expect(eventService.getEventByIdForEdit).not.toHaveBeenCalled();
    expect(eventService.getEventTypes).not.toHaveBeenCalled();
  });

  // Les equipes d'un club ne changent pas entre deux ouvertures de l'ecran.
  // Elles etaient relues par un appel imperatif a chaque montage, hors du cache
  // — donc invisibles pour tout prechargement, et refaites a chaque aller-retour.
  test('les equipes du club ne sont relues qu une fois pour deux ouvertures', async () => {
    const clientPartage = clientNeuf();

    monter(clientPartage);
    await attendreQue(() => clientPartage.getQueryData([
      'club-teams', 'club-1',
    ]) !== undefined);
    demonter();

    monter(clientPartage);
    await attendreQue(() => false);

    expect(teamService.getTeams).toHaveBeenCalledTimes(1);
  });
});
