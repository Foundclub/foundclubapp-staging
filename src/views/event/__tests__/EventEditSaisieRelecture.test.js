import fs from 'fs';
import path from 'path';

import { CommonActions, StackActions, StackRouter } from '@react-navigation/routers';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { createElement } from 'react';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { AFTER_ACTION_CACHES } from '@/domains/refresh/afterAction';

import EventEdit, { getEventEditHeaderTitle } from '../EventEdit';

// EVENTEDIT-SAISIE — « MODIFIER L'EVENEMENT » NE DOIT JAMAIS EFFACER CE QUE
// L'ENTRAINEUR EST EN TRAIN DE SAISIR (tournee 6 de recette, 29/09).
//
// 🔴 D1 — LA SAISIE EFFACEE, vue 4 fois sur l'emulateur : la date choisie est
// revenue au 02/10, les heures 09:00/10:00 sont retombees a 18:00/19:00. Chaque
// fois, le relais montrait un retour au premier plan suivi d'une relecture
// `projection=edit` : ouvrir le calendrier ou l'horloge Android fait passer
// l'app en arriere-plan, puis la ramene.
//
// 🔗 LE MECANISME, DE BOUT EN BOUT, et chaque maillon se lit dans le depot :
//   1. au retour au premier plan, `app/queryRefreshOnReturn.js` invalide les
//      racines de `answerEvent` (`domains/refresh/afterAction.js`), dont
//      `['event']` — un PREFIXE, qui couvre la clef de cet ecran
//      `['event', id, 'edit']` ;
//   2. l'ecran est monte, sa requete est ACTIVE : elle repart au reseau ;
//   3. le service passe la reponse dans Joi, qui change `date` en objet `Date`
//      (`eventService.js`, `date: Joi.date().iso()`). react-query ne sait pas
//      comparer un objet `Date` : meme contenu, et pourtant un NOUVEL objet ;
//   4. le `useEffect(..., [event])` de l'ecran le voit changer, et `reset`
//      reecrit TOUT le formulaire avec la version enregistree.
// ⇒ Le risque n'est pas cosmetique : un match enregistre au mauvais jour.
//
// 🔴 D2 — LA FICHE EN RETARD : apres « Enregistrer », la fiche montre
// l'ANCIENNE version pendant pres d'une minute, alors que le serveur a deja
// renvoye la nouvelle dans sa reponse.
//
// 🔴 D3 — LES FICHES EMPILEES : « Enregistrer » REMPLACAIT l'ecran de
// modification par une NOUVELLE fiche, posee sur l'ancienne. Apres quatre
// enregistrements, cinq fiches du meme evenement : cinq retours pour sortir.
//
// 🟡 D8 — LE MAUVAIS TITRE : « Creer un evenement » pendant le chargement de
// « Modifier ». La pile declarait un titre fixe ; le bon n'arrivait qu'apres
// le premier dessin.
//
// ⚠️ CE QUE CE FICHIER NE PROUVE PAS : que le calendrier Android fait bien
// passer l'app en arriere-plan (c'est constate au relais de l'emulateur, et a
// confirmer sur un vrai telephone). Il prouve que, QUEL QUE SOIT le declencheur
// de la relecture, la saisie survit.

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

// FINITIONS11-COLL (03/10) : le juge du déplacement (aperçu au nom du club) lit le serveur ; ici,
// il ne dit jamais « mairie » (la phrase a son témoin : EventEditFIN11COLL).
jest.mock('@/services/seasonSlot/seasonSlotQueries', () => ({
  useMairieDecideDuDeplacement: () => false,
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

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function AutocompleteSelectDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      testID: `select-${props.label || 'sans-libelle'}`,
      valeurAffichee: props.value,
    });
  };
});

// 🎯 LES TROIS DOUBLURES QUI FONT LE TRAVAIL : elles gardent `value` (ce que
// l'ecran AFFICHE) et le rappel de saisie (ce que le doigt ENVOIE). Le temoin
// saisit par le meme chemin que le calendrier, l'horloge et le clavier.
/* eslint-disable global-require */
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function DatePickerInputDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      onChange: props.onChange,
      testID: `date-${props.label || 'sans-libelle'}`,
      value: props.value,
    });
  };
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function TimePickerInputDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      onChange: props.onChange,
      testID: `heure-${props.label || 'sans-libelle'}`,
      value: props.value,
    });
  };
});
jest.mock('@/components/molecules/input/Input', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function InputDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      onChangeText: props.onChangeText,
      testID: `champ-${props.label || 'sans-libelle'}`,
      value: props.value,
    });
  };
});
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
jest.mock(
  '@/components/molecules/dayPicker/DayPicker',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_DayPicker'),
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

const LIBELLE_DATE = 'eventEdit.fields.date.label';
const LIBELLE_DEBUT = 'eventEdit.fields.startTime.label';
const LIBELLE_FIN = 'eventEdit.fields.endTime.label';
const LIBELLE_DESCRIPTION = 'eventEdit.fields.description.label';

/** @type {any} */
let arbre = null;
/** @type {any} */
let client = null;

/**
 * L'evenement TEL QUE LE SERVICE LE REND : `date` est un objet `Date`, comme
 * apres le passage dans Joi. C'est ce detail qui fait de chaque relecture un
 * NOUVEL objet, meme quand rien n'a change — le coeur de D1.
 * @param {any} enPlus - Ce qu'on veut changer.
 * @returns {any} - Un objet NEUF a chaque appel.
 */
const evenementLu = (enPlus = {}) => ({
  date: new Date('2030-05-15T18:30:00.000Z'),
  description: 'Seance technique',
  documentId: 'event-1',
  endTime: '20:00:00.000',
  eventTasks: [{ documentId: 'task-1', title: 'Apporter les plots' }],
  facility: { documentId: 'facility-1' },
  invitedTeams: [{ documentId: 'team-2' }],
  participantIdentityVisibility: 'VISIBLE',
  sessionStatus: 'closed',
  startTime: '18:30:00.000',
  team: { documentId: 'team-1' },
  teamAudiences: [{ documentId: 'audience-1', team: { documentId: 'team-2' } }],
  type: { documentId: 'type-detection', name: 'Detection' },
  validationMode: 'manual',
  ...enPlus,
});

/**
 * La date de l'evenement, ecrite comme l'ecran l'ecrit (jour local).
 * @param {Date} date - Une date.
 * @returns {string} - `jj/mm/aaaa`.
 */
const commeALEcran = (date) => [
  String(date.getDate()).padStart(2, '0'),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getFullYear()),
].join('/');

/**
 * Laisse les lectures repondre, en cascade.
 * @returns {Promise<void>} - Quand les microtaches sont epuisees.
 */
const laisserRepondre = async () => {
  for (let tour = 0; tour < 20; tour += 1) {
    // eslint-disable-next-line no-await-in-loop -- les tours sont sequentiels par nature
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

/**
 * Monte l'ecran de modification de `event-1`.
 * @param {any} [navigation] - La navigation a donner a l'ecran.
 * @returns {Promise<any>} - La racine du rendu.
 */
const monter = async (navigation) => {
  client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });

  act(() => {
    arbre = renderer.create(createElement(
      QueryClientProvider,
      { client },
      createElement(EventEdit, {
        navigation: navigation || {
          canGoBack: () => false,
          goBack: jest.fn(),
          navigate: jest.fn(),
          popTo: jest.fn(),
          replace: jest.fn(),
          setOptions: jest.fn(),
        },
        route: { params: { eventId: 'event-1' } },
      }),
    ));
  });

  await laisserRepondre();
  return arbre.root;
};

/**
 * 🔁 LA RELECTURE DU RETOUR AU PREMIER PLAN, rejouee avec le VRAI registre :
 * `queryRefreshOnReturn.js` invalide exactement ces racines-la.
 * @returns {Promise<void>} - Quand la relecture a repondu.
 */
const relireCommeAuRetourAuPremierPlan = async () => {
  await act(async () => {
    AFTER_ACTION_CACHES.answerEvent.forEach((queryKey) => {
      client.invalidateQueries({ queryKey });
    });
  });
  await laisserRepondre();
};

/**
 * Le noeud portant ce `testID`, releve A L'APPEL.
 * @param {string} testID - L'identifiant pose par la doublure.
 * @returns {any} - Le noeud.
 */
const noeud = (testID) => arbre.root.findAll(
  (/** @type {any} */ candidat) => candidat.props?.testID === testID,
  { deep: false },
)[0];

/**
 * Saisit dans un champ, par le rappel que le vrai composant appelle.
 * @param {string} testID - Le champ.
 * @param {string} rappel - Le nom du rappel (`onChange`, `onChangeText`).
 * @param {string} valeur - Ce que la personne choisit ou tape.
 * @returns {Promise<void>} - Quand le formulaire a pris la valeur.
 */
const saisir = async (testID, rappel, valeur) => {
  await act(async () => {
    noeud(testID).props[rappel](valeur);
  });
};

/**
 * Appuie sur « Enregistrer » et laisse l'envoi aboutir.
 * @returns {Promise<void>} - Quand l'envoi est termine.
 */
const enregistrer = async () => {
  await act(async () => {
    await noeud('bouton-eventEdit.actions.save').props.onPress();
  });
};

beforeEach(() => {
  eventService.getEventByIdForEdit.mockReset();
  eventService.getEventByIdForEdit.mockImplementation(() => Promise.resolve(evenementLu()));
  eventService.updateEvent.mockReset();
  eventService.updateEvent.mockResolvedValue({});
});

afterEach(() => {
  if (arbre) {
    act(() => { arbre.unmount(); });
    arbre = null;
  }
});

// ---------------------------------------------------------------------------
// D1 — UNE RELECTURE N'ECRASE JAMAIS CE QUE LA PERSONNE A SAISI
// ---------------------------------------------------------------------------
describe('D1 — une relecture de l evenement n efface pas la saisie en cours', () => {
  test('🧪 le harnais rejoue bien le mecanisme : la relecture rend un NOUVEL objet, au meme contenu', async () => {
    await monter();
    const avant = client.getQueryData(['event', 'event-1', 'edit']);

    await relireCommeAuRetourAuPremierPlan();

    // Si ce controle rougit, c'est le harnais qui ment : la relecture ne
    // passerait pas, et tous les temoins ci-dessous seraient verts pour rien.
    expect(eventService.getEventByIdForEdit).toHaveBeenCalledTimes(2);
    expect(client.getQueryData(['event', 'event-1', 'edit'])).not.toBe(avant);
  });

  test('la premiere ouverture reste pre-remplie avec l evenement enregistre', async () => {
    await monter();

    expect(noeud(`date-${LIBELLE_DATE}`).props.value)
      .toBe(commeALEcran(new Date('2030-05-15T18:30:00.000Z')));
    expect(noeud(`heure-${LIBELLE_DEBUT}`).props.value).toBe('18:30');
    expect(noeud(`heure-${LIBELLE_FIN}`).props.value).toBe('20:00');
    expect(noeud(`champ-${LIBELLE_DESCRIPTION}`).props.value).toBe('Seance technique');
  });

  test('🎯 la DATE choisie au calendrier reste apres la relecture', async () => {
    await monter();
    await saisir(`date-${LIBELLE_DATE}`, 'onChange', '20/05/2030');

    await relireCommeAuRetourAuPremierPlan();

    expect(noeud(`date-${LIBELLE_DATE}`).props.value).toBe('20/05/2030');
  });

  test('🎯 les HEURES choisies a l horloge restent apres la relecture', async () => {
    await monter();
    await saisir(`heure-${LIBELLE_DEBUT}`, 'onChange', '09:00');
    await saisir(`heure-${LIBELLE_FIN}`, 'onChange', '10:00');

    await relireCommeAuRetourAuPremierPlan();

    expect(noeud(`heure-${LIBELLE_DEBUT}`).props.value).toBe('09:00');
    expect(noeud(`heure-${LIBELLE_FIN}`).props.value).toBe('10:00');
  });

  test('🎯 le TEXTE tape reste apres la relecture', async () => {
    await monter();
    await saisir(`champ-${LIBELLE_DESCRIPTION}`, 'onChangeText', 'Seance decalee au matin');

    await relireCommeAuRetourAuPremierPlan();

    expect(noeud(`champ-${LIBELLE_DESCRIPTION}`).props.value).toBe('Seance decalee au matin');
  });

  test('🎯 et c est bien la date SAISIE qui part au serveur, pas l ancienne', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await monter();
    await saisir(`date-${LIBELLE_DATE}`, 'onChange', '20/05/2030');
    await saisir(`heure-${LIBELLE_DEBUT}`, 'onChange', '09:00');
    await saisir(`heure-${LIBELLE_FIN}`, 'onChange', '10:00');

    await relireCommeAuRetourAuPremierPlan();
    await enregistrer();

    expect(alerte).not.toHaveBeenCalled();
    expect(eventService.updateEvent).toHaveBeenCalledTimes(1);
    const [{ eventData }] = eventService.updateEvent.mock.calls[0];
    const dateEnvoyee = new Date(eventData.date);
    // Lue en heure locale, comme la personne l'a choisie : robuste au fuseau.
    expect(commeALEcran(dateEnvoyee)).toBe('20/05/2030');
    expect(eventData.startTime.startsWith('09:00')).toBe(true);
    expect(eventData.endTime.startsWith('10:00')).toBe(true);
    alerte.mockRestore();
  });

  test('🎯 un champ NON touche suit la relecture, meme quand un AUTRE champ a ete modifie', async () => {
    // Le cas de la copie PERIMEE : ecran rouvert juste apres un enregistrement,
    // avant que la relecture ne revienne. La personne tape d'abord la
    // description ; la date fraiche doit arriver quand meme, sinon l'ANCIENNE
    // repartirait a l'enregistrement.
    await monter();
    await saisir(`champ-${LIBELLE_DESCRIPTION}`, 'onChangeText', 'Seance decalee au matin');
    eventService.getEventByIdForEdit.mockImplementation(() => Promise.resolve(
      evenementLu({ date: new Date('2030-05-22T18:30:00.000Z') }),
    ));

    await relireCommeAuRetourAuPremierPlan();

    expect(noeud(`champ-${LIBELLE_DESCRIPTION}`).props.value).toBe('Seance decalee au matin');
    expect(noeud(`date-${LIBELLE_DATE}`).props.value)
      .toBe(commeALEcran(new Date('2030-05-22T18:30:00.000Z')));
  });

  test('un formulaire INTACT suit la relecture : une date changee ailleurs s affiche', async () => {
    await monter();
    eventService.getEventByIdForEdit.mockImplementation(() => Promise.resolve(
      evenementLu({ date: new Date('2030-05-22T18:30:00.000Z') }),
    ));

    await relireCommeAuRetourAuPremierPlan();

    // Personne n'a touche au formulaire : la version fraiche doit gagner, sinon
    // on enregistrerait par-dessus la modification de quelqu'un d'autre.
    expect(noeud(`date-${LIBELLE_DATE}`).props.value)
      .toBe(commeALEcran(new Date('2030-05-22T18:30:00.000Z')));
  });
});

// ---------------------------------------------------------------------------
// D2 — APRES « ENREGISTRER », LA FICHE MONTRE CE QUE LE SERVEUR A RENVOYE
// ---------------------------------------------------------------------------
describe('D2 — la fiche est a jour des le retour de l enregistrement', () => {
  test('🎯 la fiche (`[event, id]`) porte la reponse du serveur SANS attendre sa relecture', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    eventService.updateEvent.mockResolvedValue({
      data: {
        arrivalTrackingEnabled: false,
        date: '2030-05-20T07:00:00.000Z',
        documentId: 'event-1',
        endTime: '10:00:00.000',
        startTime: '09:00:00.000',
      },
    });
    await monter();

    // 🧱 LA FICHE RESTEE EN DESSOUS : elle lit `['event', id]`, et sa relecture
    // est LENTE (1 minute sur l'emulateur de la tournee 6). Ici elle ne revient
    // jamais — c'est tout le propos : ce qui s'affiche doit venir d'ailleurs.
    client.setQueryData(['event', 'event-1'], {
      arrivalTrackingEnabled: true,
      date: new Date('2030-05-15T18:30:00.000Z'),
      documentId: 'event-1',
      endTime: '20:00:00.000',
      startTime: '18:30:00.000',
      team: { documentId: 'team-1', players: [{ documentId: 'joueur-1' }] },
    });
    const fiche = new QueryObserver(client, {
      queryFn: () => new Promise(() => {}),
      queryKey: ['event', 'event-1'],
      staleTime: 30_000,
    });
    const desabonner = fiche.subscribe(() => {});

    await enregistrer();

    const affiche = fiche.getCurrentResult().data;
    expect(alerte).not.toHaveBeenCalled();
    expect(affiche.date).toBe('2030-05-20T07:00:00.000Z');
    expect(affiche.startTime).toBe('09:00:00.000');
    expect(affiche.arrivalTrackingEnabled).toBe(false);
    // ⛔ Ce que la reponse ne porte pas n'est PAS efface : l'equipe et ses
    // joueurs restent affiches en attendant la relecture complete.
    expect(affiche.team.players).toEqual([{ documentId: 'joueur-1' }]);
    desabonner();
    alerte.mockRestore();
  });

  test('et la fiche est quand meme relue en entier ensuite (l invalidation reste)', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    eventService.updateEvent.mockResolvedValue({
      data: { date: '2030-05-20T07:00:00.000Z', documentId: 'event-1' },
    });
    await monter();
    client.setQueryData(['event', 'event-1'], { date: new Date(), documentId: 'event-1' });

    await enregistrer();

    expect(client.getQueryState(['event', 'event-1']).isInvalidated).toBe(true);
    alerte.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// D3 — « ENREGISTRER » RAMENE A LA FICHE, IL N'EN EMPILE PAS UNE DE PLUS
// ---------------------------------------------------------------------------
describe('D3 — une seule fiche apres Enregistrer, avec le VRAI routeur de pile', () => {
  const NOMS_DE_ROUTES = ['EventDetails', 'EventEdit'];
  const OPTIONS_DU_ROUTEUR = { routeGetIdList: {}, routeNames: NOMS_DE_ROUTES, routeParamList: {} };

  /**
   * Une navigation qui TRADUIT chaque appel en action de routeur, pour les
   * rejouer ensuite sur un vrai `StackRouter` : un espion sur `replace` serait
   * vert des deux cotes du correctif, c'est la PILE qui dit la verite.
   * @returns {{ actions: any[], navigation: any }} - La navigation et son journal.
   */
  const navigationJournalisee = () => {
    /** @type {any[]} */
    const actions = [];
    return {
      actions,
      navigation: {
        canGoBack: () => true,
        goBack: () => actions.push(CommonActions.goBack()),
        navigate: (/** @type {any[]} */ ...args) => actions.push(CommonActions.navigate(...args)),
        popTo: (/** @type {any[]} */ ...args) => actions.push(StackActions.popTo(...args)),
        replace: (/** @type {any[]} */ ...args) => actions.push(StackActions.replace(...args)),
        setOptions: jest.fn(),
      },
    };
  };

  /**
   * Rejoue les actions sur une pile de depart.
   * @param {{ name: string, params?: any }[]} routes - La pile, du bas vers le haut.
   * @param {any[]} actions - Ce que l'ecran a demande.
   * @returns {any} - La pile d'arrivee.
   */
  const rejouer = (routes, actions) => {
    const routeur = StackRouter({});
    const depart = routeur.getRehydratedState(
      { index: routes.length - 1, routes },
      OPTIONS_DU_ROUTEUR,
    );
    return actions.reduce(
      (etat, action) => routeur.getStateForAction(etat, action, OPTIONS_DU_ROUTEUR) || etat,
      depart,
    );
  };

  test('🎯 fiche → Modifier → Enregistrer : il reste UNE fiche, a jour de ses parametres', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { actions, navigation } = navigationJournalisee();
    await monter(navigation);

    await enregistrer();

    const arrivee = rejouer([
      { name: 'EventDetails', params: { eventId: 'event-1', focusSection: 'infos' } },
      { name: 'EventEdit', params: { eventId: 'event-1' } },
    ], actions);
    expect(alerte).not.toHaveBeenCalled();
    expect(arrivee.routes.map((/** @type {any} */ route) => route.name)).toEqual(['EventDetails']);
    // La fiche retrouvee garde ce qu'elle avait (ici la section mise en avant).
    expect(arrivee.routes[0].params).toEqual({ eventId: 'event-1', focusSection: 'infos' });
    alerte.mockRestore();
  });

  test('ouvert SANS fiche en dessous (lien direct) : Enregistrer mene quand meme a la fiche', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { actions, navigation } = navigationJournalisee();
    await monter(navigation);

    await enregistrer();

    const arrivee = rejouer([{ name: 'EventEdit', params: { eventId: 'event-1' } }], actions);
    expect(arrivee.routes.map((/** @type {any} */ route) => route.name)).toEqual(['EventDetails']);
    expect(arrivee.routes[0].params).toEqual({ eventId: 'event-1' });
    alerte.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// D8 — LE TITRE EST JUSTE DES LA PREMIERE IMAGE
// ---------------------------------------------------------------------------
describe('D8 — « Modifier l evenement » des la premiere image, pas « Creer »', () => {
  const traduire = (/** @type {string} */ cle) => cle;

  test('🎯 ouvert pour MODIFIER (la route porte un evenement) : « Modifier l evenement »', () => {
    expect(getEventEditHeaderTitle({ params: { eventId: 'event-1' } }, traduire))
      .toBe('eventEdit.titleEdit');
  });

  test('ouvert pour CREER (aucun evenement) : « Creer un evenement », comme avant', () => {
    expect(getEventEditHeaderTitle({ params: {} }, traduire)).toBe('eventEdit.title');
    expect(getEventEditHeaderTitle(undefined, traduire)).toBe('eventEdit.title');
  });

  test('🎯 et c est la PILE qui le lit dans ses options, avant que l ecran ne se dessine', () => {
    // ⚠️ Temoin LU dans le fichier de navigation, comme
    // `ReservationDetails.gestesMorts.test.js` : monter la vraie pile tirerait
    // ses 38 ecrans et leurs modules natifs. Il ne regarde QUE le bloc de
    // l'ecran `EventEdit` — un titre fixe y reviendrait, il rougirait.
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'navigation', 'private', 'stacks', 'EventStack.js'),
      'utf8',
    );
    const debut = source.indexOf('component={EventEdit}');
    const blocDeLEcran = source.slice(debut, source.indexOf('/>', debut));

    expect(debut).toBeGreaterThan(-1);
    expect(blocDeLEcran).toContain('getEventEditHeaderTitle(route, t)');
    expect(blocDeLEcran).not.toContain("headerTitle: t('eventEdit.title')");
  });
});
