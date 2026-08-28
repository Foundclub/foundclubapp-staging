import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit';

// EVEDIT-3 (R4, E6) — « CA CHARGE PENDANT DES HEURES » (Adel, 2026-08-28).
//
// 🧨 CE N'EST PAS UNE IMAGE, C'EST LITTERALEMENT VRAI, ET C'EST MESURE ICI.
// L'ecran lit `const { data: event } = useGetEventForEdit(eventId)` — et RIEN
// D'AUTRE. Ni `isError`, ni `error`. Quand la lecture de la fiche echoue,
// `event` reste `undefined` : exactement comme lorsqu'elle est encore en vol.
// « En train de charger » et « ca a rate » sont donc LE MEME ECRAN, pour
// toujours. Le bandeau « Chargement de l'evenement… » reste, le bouton
// « Enregistrer » reste gris, et plus rien ne bouge jamais.
//
// 🔗 LA CHAINE, MAILLON PAR MAILLON, TOUS LUS DANS LE CODE :
//   1. Le lot FCMSTORM a mesure 27 refus `429` en rafale le 28/08 — le jour
//      meme du constat.
//   2. `app/queryClient.js` EXCLUT explicitement le 429 des reprises
//      (`return status >= 500`) : refus immediat et definitif, zero tentative.
//   3. `data` reste `undefined` ⇒ bandeau eternel + bouton gris eternel.
//   4. Sur une coupure reseau (aucun code), c'est 3 tentatives de 15 s plus
//      3 s d'attente — 48 s — puis le MEME ecran eternel.
//
// ⚠️ ET C'EST UN DEFAUT NEUF, NE D'UN BON CORRECTIF. Avant EVEDIT-1 (27/08),
// il n'y avait ni bandeau ni bouton gris. La garde D5 — qui est JUSTE, et qui
// empeche d'effacer taches, equipes conviees et lieu — a transforme un echec
// silencieux en chargement sans fin. Adel a raison : « c'est pire qu'avant ».
//
// ✅ CE QUE CE FICHIER EXIGE : trois etats DISTINCTS, et une porte de sortie.
//   · en vol   → « Chargement… », Enregistrer gris   (garde D5, ne bouge pas)
//   · echoue   → on le DIT, et on propose « Reessayer », Enregistrer gris
//   · arrivee  → aucun bandeau, Enregistrer actif
//
// ⛔ CE QU'IL NE PROUVE PAS : aucune milliseconde, et rien du reseau reel.
// Il prouve que l'ecran SAIT distinguer les trois cas — c'est tout, et c'est
// precisement ce qui manquait.

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
  ])),
  updateEvent: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/team/teamService', () => ({
  getTeams: jest.fn(() => Promise.resolve({ data: [] })),
}));

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function AutocompleteSelectDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      testID: `select-${props.label || 'sans-libelle'}`,
    });
  };
});

// 🎯 LA DOUBLURE QUI FAIT LE TRAVAIL : elle garde `disabled` ET `onPress`.
// Sans `disabled`, on ne verrait pas que « Enregistrer » REFUSE ; sans
// `onPress`, on ne pourrait pas appuyer sur « Reessayer ».
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BoutonDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      disabled: Boolean(props.disabled),
      onPress: props.onPress,
      testID: `bouton-${props.title || 'sans-titre'}`,
    });
  };
});
/* eslint-disable global-require */
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
jest.mock('@/components/templates/ScreenContainer', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ScreenContainerDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, null, props.children);
  };
});
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

const TEXTE_EN_VOL = "Chargement de l'événement… Le bouton s'active dès que tout est affiché.";
const TEXTE_ECHEC = "L'événement n'a pas pu être chargé. Vérifie ta connexion, "
  + 'puis appuie sur Réessayer.';
const BOUTON_REESSAYER = 'bouton-Réessayer';
const BOUTON_ENREGISTRER = 'bouton-eventEdit.actions.save';

/** @type {any} */
let arbre = null;

/**
 * Un evenement modifiable, deja rempli.
 * @returns {any} - L'evenement rendu par le service.
 */
const evenementRempli = () => ({
  date: '2030-05-15T18:30:00.000Z',
  description: 'Seance technique',
  documentId: 'event-1',
  endTime: '20:00:00.000',
  eventTasks: [{ documentId: 'task-1', title: 'Apporter les plots' }],
  facility: { documentId: 'facility-1' },
  invitedTeams: [{ documentId: 'team-2' }],
  participantIdentityVisibility: 'VISIBLE',
  sessionStatus: 'closed',
  startTime: '18:30:00.000',
  team: { club: { documentId: 'club-1' }, documentId: 'team-1' },
  teamAudiences: [{ documentId: 'audience-1', team: { documentId: 'team-2' } }],
  type: { documentId: 'type-entrainement', name: 'Entrainement' },
  validationMode: 'manual',
});

/**
 * Le refus exact qu'Adel a pu rencontrer : la protection anti-abus du serveur.
 * @returns {any} - L'erreur portee par le client HTTP.
 */
const refus429 = () => Object.assign(
  new Error('Request failed with status code 429'),
  { response: { status: 429 }, status: 429 },
);

/**
 * Laisse react-query repondre.
 *
 * 🪤 UNE VIDANGE DE MICRO-TACHES NE SUFFIT PAS, et le piege coute une heure :
 * `await Promise.resolve()` ne franchit qu'un cran de la file des promesses,
 * alors que la chaine d'une requete en traverse plusieurs et que le
 * `notifyManager` de react-query regroupe ses notifications. Il faut une
 * MACRO-tache. C'est le motif deja pose par `EventEditEvedit1Enregistrement`.
 * @returns {Promise<void>} - Quand l'ecran a fini de reagir.
 */
const laisserRepondre = async () => {
  for (let tour = 0; tour < 6; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

/**
 * Monte l'ecran de modification.
 * @param {string | undefined} eventId - L'evenement a modifier, ou rien.
 * @returns {Promise<void>} - Quand l'ecran est monte.
 */
const monterEcran = async (eventId = 'event-1') => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  await act(async () => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(EventEdit, {
        navigation: { navigate: jest.fn(), replace: jest.fn(), setOptions: jest.fn() },
        route: { params: eventId ? { eventId } : {} },
      }),
    ));
  });

  await laisserRepondre();
};

/**
 * Releve tout ce qui est ecrit a l'ecran.
 * @returns {string[]} - Tous les textes affiches a l'ecran.
 */
const textesAffiches = () => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.props?.children === 'string',
  { deep: true },
).map((/** @type {any} */ noeud) => noeud.props.children);

/**
 * Retrouve un bouton par son identifiant.
 * @param {string} testID - L'identifiant du bouton cherche.
 * @returns {any} - Le premier bouton trouve, ou `undefined`.
 */
const bouton = (testID) => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.testID === testID,
)[0];

beforeEach(() => {
  jest.clearAllMocks();
  eventService.getEventTypes.mockResolvedValue([
    { documentId: 'type-entrainement', name: 'Entrainement' },
  ]);
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('EVEDIT-3 · la fiche N ARRIVE JAMAIS — l ecran doit le DIRE', () => {
  test('temoin 1 — apres un refus, l ecran ne pretend plus etre en train de charger', async () => {
    eventService.getEventByIdForEdit.mockRejectedValue(refus429());

    await monterEcran();

    // 🔴 ROUGE AVANT : ce bandeau restait affiche pour toujours. C'est
    // exactement « ca charge pendant des heures ».
    expect(textesAffiches()).not.toContain(TEXTE_EN_VOL);
  });

  test('temoin 2 — apres un refus, l ecran dit que ca a rate', async () => {
    eventService.getEventByIdForEdit.mockRejectedValue(refus429());

    await monterEcran();

    expect(textesAffiches()).toContain(TEXTE_ECHEC);
  });

  test('temoin 3 — apres un refus, une porte de sortie est proposee', async () => {
    eventService.getEventByIdForEdit.mockRejectedValue(refus429());

    await monterEcran();

    // ⛔ Sans ce bouton, la seule issue est de quitter l'ecran et d'y revenir.
    // Personne ne devine ca.
    expect(bouton(BOUTON_REESSAYER)).toBeTruthy();
  });

  test('temoin 4 — « Reessayer » relit VRAIMENT la fiche, et l ecran se remplit', async () => {
    eventService.getEventByIdForEdit.mockRejectedValueOnce(refus429());

    await monterEcran();
    const lecturesAvant = eventService.getEventByIdForEdit.mock.calls.length;

    eventService.getEventByIdForEdit.mockResolvedValue(evenementRempli());
    await act(async () => {
      bouton(BOUTON_REESSAYER).props.onPress();
    });
    await laisserRepondre();

    expect(eventService.getEventByIdForEdit.mock.calls.length).toBe(lecturesAvant + 1);
    // Et l'ecran revient a la normale : plus de bandeau, bouton actif.
    expect(textesAffiches()).not.toContain(TEXTE_ECHEC);
    expect(bouton(BOUTON_ENREGISTRER).props.disabled).toBe(false);
  });

  test('temoin 5 — 🛡️ D5 TIENT TOUJOURS : sur un echec, « Enregistrer » reste REFUSE', async () => {
    // ⚠️ LE PIEGE DE CE LOT. Dire « ca a rate » sans garder le verrou
    // reouvrirait le defaut le plus cher de l'audit : enregistrer sur un
    // formulaire vide EFFACE les taches, les equipes conviees et le lieu.
    eventService.getEventByIdForEdit.mockRejectedValue(refus429());

    await monterEcran();

    expect(bouton(BOUTON_ENREGISTRER).props.disabled).toBe(true);
  });
});

describe('EVEDIT-3 · les deux autres etats ne bougent pas', () => {
  test('temoin 6 — 🛡️ D5 : tant que la fiche est EN VOL, on le dit et on refuse', async () => {
    // La lecture ne se resout jamais : c'est l'etat « en cours », le vrai.
    eventService.getEventByIdForEdit.mockImplementation(
      () => new Promise(() => {}),
    );

    await monterEcran();

    expect(textesAffiches()).toContain(TEXTE_EN_VOL);
    expect(textesAffiches()).not.toContain(TEXTE_ECHEC);
    expect(bouton(BOUTON_ENREGISTRER).props.disabled).toBe(true);
  });

  test('temoin 7 — fiche arrivee : aucun bandeau, et « Enregistrer » accepte', async () => {
    eventService.getEventByIdForEdit.mockResolvedValue(evenementRempli());

    await monterEcran();

    expect(textesAffiches()).not.toContain(TEXTE_EN_VOL);
    expect(textesAffiches()).not.toContain(TEXTE_ECHEC);
    expect(bouton(BOUTON_ENREGISTRER).props.disabled).toBe(false);
  });

  test('temoin 8 — a la CREATION il n y a aucune fiche a attendre', async () => {
    // ⛔ La condition porte sur `eventId`. Sans lui, rien a charger, rien a
    // rater : ni bandeau, ni bouton gris, ni « Reessayer ».
    await monterEcran(undefined);

    expect(textesAffiches()).not.toContain(TEXTE_EN_VOL);
    expect(textesAffiches()).not.toContain(TEXTE_ECHEC);
    expect(bouton(BOUTON_REESSAYER)).toBeFalsy();
    expect(bouton(BOUTON_ENREGISTRER).props.disabled).toBe(false);
  });
});
