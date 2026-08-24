import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit';

// R8 — L'ECRAN DE MODIFICATION DIT-IL LA VERITE SUR LA VALIDATION ?
//
// Retour de recette de la 2.6.26 : « le reglage validation manuelle sur un
// evenement prive ne fait rien ». C'est exact — et c'est VOULU cote serveur
// (AA01, GO Adel du 2026-08-20) : un membre convie REPOND a une convocation,
// il ne demande pas a entrer. Le serveur l'ecrit lui-meme :
//
//   · `event-rsvp.ts`          — un membre convie est accepte d'office ;
//   · `event-participation.ts` — sur un prive, qui n'appartient a aucune equipe
//                                conviee est REFUSE avant la validation ;
//   · et son propre commentaire : « `validationMode` filtre les gens du DEHORS
//     qui DEMANDENT a venir ».
//
// Sur un prive, tout le monde est convie : le reglage ne commande personne.
// La decision A (Adel, 24/08) gele le serveur — c'est donc l'APP qui doit
// cesser de proposer un reglage qui ne commande rien, et nommer QUI il filtre
// quand il en filtre un.
//
// ⚠️ CE QU'IL NE PROUVE PAS : le comportement du serveur. Il mesure ce que
// l'ecran PROPOSE, pas ce que la base fait de la valeur.

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// Publie en TypeScript non transforme : sans doublure, la SUITE ENTIERE meurt
// au chargement et aucun test ne s'execute (piege connu du depot).
jest.mock('react-native-gesture-handler', () => {
  const { ScrollView: DefilementRN } = jest.requireActual('react-native');
  return { ScrollView: DefilementRN };
});

// ⛔ Jamais un Proxy pour le theme : il rend les echecs Jest illisibles.
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

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL`,
// absent de toute copie de travail, et la suite entiere meurt au chargement.
jest.mock('@/services/event/eventService', () => ({
  createEvent: jest.fn(() => Promise.resolve({})),
  getEventByIdForEdit: jest.fn(() => Promise.resolve(null)),
  getEventTypes: jest.fn(() => Promise.resolve([
    { documentId: 'type-entrainement', name: 'Entrainement' },
    { documentId: 'type-detection', name: 'Detection' },
  ])),
  updateEvent: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [] })),
}));

// La doublure garde le LIBELLE : c'est par lui qu'on relit ce que l'ecran
// propose reellement, en mots visibles plutot qu'en position dans l'arbre.
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
// ⚠️ PAS la doublure texte commune ici : elle jette les proprietes, donc le
// geste « Enregistrer ». Ce fichier doit pouvoir appuyer dessus.
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BoutonDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      onPress: props.onPress,
      testID: `bouton-${props.title || 'sans-titre'}`,
    });
  };
});
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

const LIBELLE_EXTERNE = 'Validation des demandes extérieures';
const LIBELLE_INTERNE = 'Validation des membres internes';
const LIBELLE_JOUEURS_EXTERNES = 'Validation des joueurs externes';

/** @type {any} */
let arbre = null;

/**
 * Un evenement modifiable, de la visibilite et du type demandes.
 * @param {string} sessionStatus - 'open' (public) ou 'closed' (prive).
 * @param {string} typeId - Le type, tel que `getEventTypes` le rend.
 * @param {string} typeName - Son nom, celui qui decide « entrainement » ou non.
 * @returns {any} - L'evenement rendu par le service.
 */
const evenement = (sessionStatus, typeId, typeName) => ({
  date: '2030-05-15T18:30:00.000Z',
  documentId: 'event-1',
  endTime: '20:00:00.000',
  sessionStatus,
  startTime: '18:30:00.000',
  team: { documentId: 'team-1' },
  type: { documentId: typeId, name: typeName },
  // Le pire cas pour ce lot : une valeur « manuelle » deja en base. C'est
  // exactement l'evenement dont Adel dit que le reglage ne fait rien.
  validationMode: 'manual',
});

/**
 * Monte l'ecran sur cet evenement et laisse les lectures repondre.
 * @param {any} evenementRendu - Ce que le service rend.
 * @returns {Promise<any>} - La racine du rendu.
 */
const monterSur = async (evenementRendu) => {
  eventService.getEventByIdForEdit.mockResolvedValue(evenementRendu);
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });

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

  // 🪤 Les lectures se resolvent EN CASCADE : un seul tour de microtaches
  // suffit sur une machine au repos et plus sous la charge de la suite
  // complete. On attend donc que le formulaire porte bien l'evenement.
  for (let tour = 0; tour < 20; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }

  return arbre.root;
};

/**
 * Tous les libelles de selecteurs actuellement proposes par l'ecran.
 *
 * ⚠️ La lecture se fait A L'APPEL, jamais gardee en variable : un noeud releve
 * par `findAll` est un INSTANTANE du rendu de son moment.
 * @param {any} racine - La racine du rendu.
 * @returns {string[]} - Les libelles, dans l'ordre du rendu.
 */
const libellesDesSelecteurs = (racine) => racine
  .findAll(
    (/** @type {any} */ noeud) => String(noeud.props?.testID || '').startsWith('select-'),
    { deep: false },
  )
  .map((/** @type {any} */ noeud) => String(noeud.props.testID).replace(/^select-/, ''));

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.clearAllMocks();
});

describe('R8 (D1) — un reglage qui ne commande personne ne se propose pas', () => {
  test('evenement PRIVE : aucune pilule de validation, meme avec « manual » en base', async () => {
    const racine = await monterSur(evenement('closed', 'type-detection', 'Detection'));
    const libelles = libellesDesSelecteurs(racine);

    // 🎯 AUCUN selecteur de validation, sous AUCUNE forme — libelle en clair
    // comme clef de traduction non resolue. Nommer seulement les libelles connus
    // rendrait ce temoin vert le jour ou un quatrieme apparait, et vert AUSSI
    // aujourd'hui, ou le libelle cherche n'existe pas encore.
    expect(libelles.filter((libelle) => /alidation/.test(libelle))).toEqual([]);
    // Le contre-controle : l'ecran est bien monte et propose ses autres choix.
    expect(libelles).toContain('eventEdit.fields.sessionStatus.label');
  });

  test('entrainement PRIVE : aucune pilule non plus', async () => {
    const racine = await monterSur(evenement('closed', 'type-entrainement', 'Entrainement'));
    const libelles = libellesDesSelecteurs(racine);

    expect(libelles.filter((libelle) => /alidation/.test(libelle))).toEqual([]);
    expect(libelles).toContain('eventEdit.fields.sessionStatus.label');
  });
});

describe('R8 (D2) — quand elle commande quelqu un, elle dit QUI', () => {
  test('evenement PUBLIC : la pilule revient, et nomme les demandes du dehors', async () => {
    const racine = await monterSur(evenement('open', 'type-detection', 'Detection'));
    const libelles = libellesDesSelecteurs(racine);

    expect(libelles).toContain(LIBELLE_EXTERNE);
    expect(libelles).not.toContain('Validation des présences');
  });

  test('entrainement PUBLIC : les deux pilules, chacune nommant qui elle filtre', async () => {
    const racine = await monterSur(evenement('open', 'type-entrainement', 'Entrainement'));
    const libelles = libellesDesSelecteurs(racine);

    expect(libelles).toContain(LIBELLE_INTERNE);
    expect(libelles).toContain(LIBELLE_JOUEURS_EXTERNES);
  });
});

// 🛡️ LE RISQUE REEL DE D1, ET SON GARDE-FOU.
//
// `validationMode` est `required()` au schema Joi de l'ecran. Cacher son champ
// pourrait donc, si react-hook-form oubliait la valeur d'un champ demonte,
// rendre TOUT evenement prive impossible a enregistrer — une panne bien pire
// que le mensonge qu'on corrige. La bibliotheque conserve les valeurs demontees
// (`shouldUnregister` vaut false par defaut, et n'est pose nulle part dans le
// depot), mais une garantie de documentation n'est pas une preuve : celle-ci
// appuie sur le bouton.
describe('R8 — cacher le reglage ne casse pas l enregistrement', () => {
  test('un evenement PRIVE s enregistre toujours, et garde sa valeur en base', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const racine = await monterSur(evenement('closed', 'type-detection', 'Detection'));

    const bouton = racine.findAll(
      (/** @type {any} */ noeud) => noeud.props?.testID === 'bouton-eventEdit.actions.save',
      { deep: false },
    )[0];
    expect(bouton).toBeDefined();

    await act(async () => {
      await bouton.props.onPress();
    });

    // Joi n'a rien refuse : l'ecran n'a pas ouvert sa fenetre d'erreur.
    expect(alerte).not.toHaveBeenCalled();
    expect(eventService.updateEvent).toHaveBeenCalledTimes(1);

    // Et la valeur du champ cache est bien partie avec le reste.
    const [charge] = eventService.updateEvent.mock.calls[0];
    expect(charge.eventData).toEqual(expect.objectContaining({ validationMode: 'manual' }));

    alerte.mockRestore();
  });
});
