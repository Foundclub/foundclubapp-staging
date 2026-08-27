import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventEdit from '../EventEdit';

// EVEDIT-1 — « MODIFIER UN EVENEMENT EST COMPLETEMENT BUGUE, ET HYPER LENT »
// (Adel, 2026-08-26). Ce fichier garde les CINQ gestes de l'ecran telephone que
// l'audit `AUDIT_MODIFIER_EVENEMENT_2026-08-26.md` a mesures, et rien d'autre :
//
//   · D5 — enregistrer AVANT que la fiche soit arrivee doit etre IMPOSSIBLE.
//          C'est le plus cher : le formulaire s'affiche pre-rempli A VIDE, et
//          cote serveur une liste vide EFFACE (taches, audiences d'equipe,
//          equipes conviees, installation).
//   · D1 — un enregistrement qui ECHOUE doit se VOIR, et laisser la personne
//          sur son formulaire avec ses saisies.
//   · D2 — l'echec d'un evenement RECURRENT partait du `onPress` d'une alerte,
//          donc HORS du `try` : rejet de promesse non traite, silence total.
//   · D8 — une erreur de saisie ouvrait une fenetre contenant le JSON brut de
//          la bibliotheque de formulaire. Elle doit rendre une phrase qui NOMME
//          le champ fautif.
//   · R1 — l'enregistrement n'attend plus le rechargement des listes.
//
// ⚠️ CE QU'IL NE PROUVE PAS : aucune milliseconde. Jest ne mesure pas une
// attente reseau ; le gain de R1 se constate en recette, sur un telephone.
// Ce qui se prouve ici, c'est que l'ecran NE S'ARRETE PLUS a les attendre.
//
// Le montage est celui, eprouve, de `EventEditR8Validation.test.js` — mocks
// compris. UN SEUL ecart : la doublure de bouton garde `disabled` et
// `isLoading`, puisque c'est exactement ce que D5 mesure.

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

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function AutocompleteSelectDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      options: props.options,
      setValue: props.setValue,
      testID: `select-${props.label || 'sans-libelle'}`,
      valeurAffichee: props.value,
    });
  };
});

/* eslint-disable global-require */
// 🎯 LA DOUBLURE QUI FAIT TOUT LE TRAVAIL DE D5 : elle garde `disabled`. Sans
// elle on ne pourrait constater que l'absence d'envoi — pas le fait que le
// bouton REFUSE, qui est la moitie visible de la garantie.
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function BoutonDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      disabled: Boolean(props.disabled),
      enChargement: Boolean(props.isLoading),
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
jest.mock('@/components/molecules/input/Input', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function InputDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      testID: `champ-${props.label || 'sans-libelle'}`,
    });
  };
});
// L'heure de debut est le SEUL champ obligatoire qu'aucune autre doublure ne
// sait remplir. D5 a besoin de la poser pour reconstituer le cas dangereux :
// une personne qui a eu le temps de saisir pendant que la fiche chargeait.
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function TimePickerInputDouble(/** @type {any} */ props) {
    return react.createElement(rn.View, {
      onChange: props.onChange,
      testID: `heure-${props.label || 'sans-libelle'}`,
    });
  };
});
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

const LIBELLE_TYPE = 'eventEdit.fields.type.label';
const LIBELLE_EQUIPE = 'eventEdit.fields.team.label';
const LIBELLE_HEURE_DEBUT = 'eventEdit.fields.startTime.label';

/** @type {any} */
let arbre = null;

/**
 * Un evenement modifiable, deja rempli : des taches, des audiences, une equipe
 * conviee et une installation. C'est exactement ce que D5 fait disparaitre.
 * @param {any} enPlus - Ce qu'on veut changer.
 * @returns {any} - L'evenement rendu par le service.
 */
const evenementRempli = (enPlus = {}) => ({
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
  team: { documentId: 'team-1' },
  teamAudiences: [{ documentId: 'audience-1', team: { documentId: 'team-2' } }],
  type: { documentId: 'type-detection', name: 'Detection' },
  validationMode: 'manual',
  ...enPlus,
});

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
 * Monte l'ecran de modification sur cet evenement.
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

  await laisserRepondre();
  return arbre.root;
};

/**
 * Monte l'ecran SANS QUE LA FICHE ARRIVE JAMAIS.
 *
 * 🎯 C'est le cas de D5, et il n'est pas theorique : sur la recette, une lecture
 * d'evenement a ete mesuree a plusieurs secondes. Pendant tout ce temps le
 * formulaire est affiche, pre-rempli A VIDE, et rien n'empeche d'appuyer.
 * @returns {Promise<any>} - La racine du rendu.
 */
const monterSansQueLaFicheArrive = async () => {
  eventService.getEventByIdForEdit.mockImplementation(
    () => new Promise(() => {}),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  // 🎯 UN SEUL DEFAUT PAR TEMOIN. La lecture de la fiche ne repond jamais dans
  // ce scenario — c'est tout son propos. Si on laissait les invalidations
  // reelles, celle de `['event', ...]` attendrait ce meme rechargement qui ne
  // vient pas, et le temoin expirerait au lieu de conclure : il mesurerait R1
  // en croyant mesurer D5.
  // @ts-ignore -- on remplace volontairement la methode pour isoler la mesure
  client.invalidateQueries = jest.fn(() => Promise.resolve());

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

  await laisserRepondre();
  return arbre.root;
};

/**
 * Le bouton « Enregistrer », releve A L'APPEL.
 * @param {any} racine - La racine du rendu.
 * @returns {any} - Le noeud du bouton.
 */
const boutonEnregistrer = (racine) => racine.findAll(
  (/** @type {any} */ noeud) => noeud.props?.testID === 'bouton-eventEdit.actions.save',
  { deep: false },
)[0];

/**
 * Le noeud du selecteur portant ce libelle, releve A L'APPEL.
 * @param {any} racine - La racine du rendu.
 * @param {string} libelle - Le libelle affiche par le selecteur.
 * @returns {any} - Le noeud, ou undefined.
 */
const selecteur = (racine, libelle) => racine.findAll(
  (/** @type {any} */ noeud) => noeud.props?.testID === `select-${libelle}`,
  { deep: false },
)[0];

/**
 * Tous les textes rendus sous ce noeud, a plat.
 * @param {any} instance - Instance de test, ou racine.
 * @param {string[]} [recueil] - Accumulateur.
 * @returns {string[]} - Les textes trouves.
 */
const textesDe = (instance, recueil = []) => {
  (instance?.children || []).forEach((/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      recueil.push(String(enfant));
      return;
    }
    textesDe(enfant, recueil);
  });
  return recueil;
};

/**
 * Remplit A LA MAIN les trois champs que Joi exige, sans que la fiche soit
 * arrivee. C'est la personne qui a eu le temps de saisir pendant que ca chargeait.
 * @param {any} racine - La racine du rendu.
 * @returns {Promise<void>} - Quand les trois champs sont poses.
 */
const remplirLeMinimumExigeParJoi = async (racine) => {
  await act(async () => {
    selecteur(racine, LIBELLE_TYPE).props.setValue({ value: 'type-detection' });
  });
  await act(async () => {
    selecteur(racine, LIBELLE_EQUIPE).props.setValue({ value: 'team-1' });
  });
  const heure = racine.findAll(
    (/** @type {any} */ noeud) => noeud.props?.testID === `heure-${LIBELLE_HEURE_DEBUT}`,
    { deep: false },
  )[0];
  await act(async () => {
    heure.props.onChange('18:30');
  });
};

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  jest.clearAllMocks();
  eventService.getEventByIdForEdit.mockReset();
  eventService.updateEvent.mockReset();
  eventService.updateEvent.mockResolvedValue({});
  eventService.getEventTypes.mockResolvedValue([
    { documentId: 'type-entrainement', name: 'Entrainement' },
    { documentId: 'type-detection', name: 'Detection' },
  ]);
});

// ---------------------------------------------------------------------------
// D5 — ENREGISTRER AVANT QUE LA FICHE SOIT ARRIVEE EST IMPOSSIBLE
// ---------------------------------------------------------------------------
//
// 🧨 POURQUOI C'EST LE PLUS CHER DU LOT. Le formulaire naît avec ses valeurs par
// defaut : `eventTasks: []`, `teamAudiences: []`, `invitedTeams: []`,
// `facility: null`. Cote serveur, ces quatre-la ne sont pas ignores quand ils
// sont vides — ils sont SYNCHRONISES VERS LE VIDE :
//   · `event-task.ts`           supprime toutes les taches ET leurs affectations ;
//   · `event-team-audience.ts`  annule les audiences et deconnecte les equipes ;
//   · `event.ts`                efface les equipes conviees, puis archive les reponses.
// Une seconde d'avance sur le reseau, et le travail d'organisation disparait.
describe('D5 — la fiche pas arrivee, on ne peut PAS enregistrer', () => {
  test('le bouton REFUSE tant que la fiche n est pas la', async () => {
    const racine = await monterSansQueLaFicheArrive();

    expect(boutonEnregistrer(racine).props.disabled).toBe(true);
  });

  test('et l ecran DIT qu il charge — un bouton gris muet serait un 2e defaut', async () => {
    const racine = await monterSansQueLaFicheArrive();

    expect(textesDe(racine).join(' | ')).toMatch(/charge/i);
  });

  // 🎯 LE TEMOIN QUI PROTEGE LA DONNEE, et le seul qui la protege vraiment.
  //
  // Le `disabled` ci-dessus est la moitie VISIBLE de la garantie. L'autre
  // moitie est que la soumission elle-meme refuse : sans elle, il suffirait
  // qu'un jour le bouton soit rendu autrement (une autre doublure, un autre
  // composant, un raccourci clavier sur le site) pour que la perte revienne.
  //
  // Le cas est reconstitue au plus pres du reel : quelqu'un qui a EU LE TEMPS
  // de choisir un type, une equipe et une heure pendant que la fiche chargeait.
  // Sans ce remplissage, c'est Joi qui refuse — et le temoin serait vert sans
  // rien prouver du tout.
  test('appuyer quand meme n envoie RIEN au serveur', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const racine = await monterSansQueLaFicheArrive();
    await remplirLeMinimumExigeParJoi(racine);

    await act(async () => {
      await boutonEnregistrer(racine).props.onPress();
    });

    // ⛔ AUCUN appel. Pas « un appel avec des listes vides » : aucun.
    expect(eventService.updateEvent).not.toHaveBeenCalled();
    alerte.mockRestore();
  });

  test('une fois la fiche arrivee, le bouton reprend son travail', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const racine = await monterSur(evenementRempli());

    expect(boutonEnregistrer(racine).props.disabled).toBe(false);

    await act(async () => {
      await boutonEnregistrer(racine).props.onPress();
    });

    expect(eventService.updateEvent).toHaveBeenCalledTimes(1);
    // Et le travail d'organisation est bien reparti AVEC l'evenement.
    const [charge] = eventService.updateEvent.mock.calls[0];
    expect(charge.eventData.eventTasks).toHaveLength(1);
    expect(charge.eventData.teamAudiences).toHaveLength(1);
    expect(charge.eventData.invitedTeams).toEqual(['team-2']);
    expect(charge.eventData.facility).toBe('facility-1');
    alerte.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// D1 — UN ECHEC D'ENREGISTREMENT SE VOIT
// ---------------------------------------------------------------------------
describe('D1 — quand ca rate, ca se dit', () => {
  test('un echec reseau ouvre un message lisible', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    eventService.updateEvent.mockRejectedValue(new Error('Network Error'));
    const racine = await monterSur(evenementRempli());

    await act(async () => {
      await boutonEnregistrer(racine).props.onPress();
    });

    expect(alerte).toHaveBeenCalled();
    const dits = alerte.mock.calls.map((appel) => appel.join(' ')).join(' | ');
    // ⛔ Jamais de JSON, jamais d'accolade : c'est une phrase.
    expect(dits).not.toMatch(/[{}]/);
    // 🎯 Et elle dit ce qui compte : le travail n'est pas perdu.
    expect(dits).toMatch(/saisies|modifications/i);

    alerte.mockRestore();
  });

  test('et la personne RESTE sur son formulaire', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    eventService.updateEvent.mockRejectedValue(new Error('Network Error'));
    const remplacer = jest.fn();
    eventService.getEventByIdForEdit.mockResolvedValue(evenementRempli());
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
            replace: remplacer,
            setOptions: jest.fn(),
          },
          route: { params: { eventId: 'event-1' } },
        }),
      ));
    });
    await laisserRepondre();

    await act(async () => {
      await boutonEnregistrer(arbre.root).props.onPress();
    });

    // 🎯 Aucune navigation : le formulaire et ses saisies sont toujours la.
    expect(remplacer).not.toHaveBeenCalled();
    alerte.mockRestore();
  });

  test('et un succes emmene bien a la fiche', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const remplacer = jest.fn();
    eventService.getEventByIdForEdit.mockResolvedValue(evenementRempli());
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
            replace: remplacer,
            setOptions: jest.fn(),
          },
          route: { params: { eventId: 'event-1' } },
        }),
      ));
    });
    await laisserRepondre();

    await act(async () => {
      await boutonEnregistrer(arbre.root).props.onPress();
    });

    expect(alerte).not.toHaveBeenCalled();
    expect(remplacer).toHaveBeenCalledWith('EventDetails', { eventId: 'event-1' });
    alerte.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// D2 — L'ECHEC D'UN RECURRENT N'EST MEME PAS CAPTE
// ---------------------------------------------------------------------------
//
// 🧨 LE MECANISME, parce qu'il est invisible a la relecture : sur un evenement
// recurrent, l'ecran ouvre une alerte a quatre boutons, et l'envoi part du
// `onPress` de l'un d'eux. Ce `onPress` est appele PLUS TARD, par le systeme —
// donc HORS du `try` qui entoure la soumission. Une promesse rejetee la n'a
// aucun `catch` : elle devient un « unhandled rejection », et il ne se passe
// STRICTEMENT RIEN a l'ecran.
describe('D2 — l echec d un evenement RECURRENT se dit aussi', () => {
  /**
   * Choisit une portee dans l'alerte de recurrence, et attend l'envoi.
   * @param {any} alerte - L'espion pose sur `Alert.alert`.
   * @param {string} texteDuBouton - Le libelle du bouton a toucher.
   * @returns {Promise<void>} - Quand l'envoi est termine.
   */
  const choisirLaPortee = async (alerte, texteDuBouton) => {
    const appelRecurrence = alerte.mock.calls.find(
      (/** @type {any} */ appel) => Array.isArray(appel[2]),
    );
    expect(appelRecurrence).toBeDefined();
    const bouton = appelRecurrence[2].find(
      (/** @type {any} */ choix) => String(choix.text).includes(texteDuBouton),
    );
    expect(bouton).toBeDefined();
    await act(async () => {
      await bouton.onPress();
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  };

  test('« Tous les evenements » qui rate ouvre un message, au lieu de se taire', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    eventService.updateEvent.mockRejectedValue(new Error('Network Error'));
    const racine = await monterSur(evenementRempli({ recurrenceGroupId: 'serie-1' }));

    await act(async () => {
      await boutonEnregistrer(racine).props.onPress();
    });

    // L'alerte de portee s'est bien ouverte, et rien n'est encore parti.
    expect(eventService.updateEvent).not.toHaveBeenCalled();

    await choisirLaPortee(alerte, 'Tous les');

    expect(eventService.updateEvent).toHaveBeenCalledTimes(1);
    // 🎯 LE POINT : une SECONDE alerte, celle de l'echec. Avant ce lot, il n'y
    // en avait aucune — le rejet mourait sans personne pour l'attraper.
    const dits = alerte.mock.calls.map((appel) => appel.join(' ')).join(' | ');
    expect(dits).toMatch(/saisies|modifications/i);
    expect(dits).not.toMatch(/[{}]/);

    alerte.mockRestore();
  });

  test('« Cet evenement » qui rate se dit de la meme facon', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    eventService.updateEvent.mockRejectedValue(new Error('Network Error'));
    const racine = await monterSur(evenementRempli({ recurrenceGroupId: 'serie-1' }));

    await act(async () => {
      await boutonEnregistrer(racine).props.onPress();
    });
    await choisirLaPortee(alerte, 'Cet');

    const dits = alerte.mock.calls.map((appel) => appel.join(' ')).join(' | ');
    expect(dits).toMatch(/saisies|modifications/i);

    alerte.mockRestore();
  });

  test('et un recurrent qui REUSSIT emmene bien a la fiche', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const remplacer = jest.fn();
    eventService.getEventByIdForEdit.mockResolvedValue(
      evenementRempli({ recurrenceGroupId: 'serie-1' }),
    );
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
            replace: remplacer,
            setOptions: jest.fn(),
          },
          route: { params: { eventId: 'event-1' } },
        }),
      ));
    });
    await laisserRepondre();

    await act(async () => {
      await boutonEnregistrer(arbre.root).props.onPress();
    });
    await choisirLaPortee(alerte, 'Tous les');

    expect(remplacer).toHaveBeenCalledWith('EventDetails', { eventId: 'event-1' });
    const [charge] = eventService.updateEvent.mock.calls[0];
    expect(charge.recurrenceMode).toBe('all');
    alerte.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// D8 — PLUS JAMAIS DE JSON BRUT A L'ECRAN
// ---------------------------------------------------------------------------
describe('D8 — une erreur de saisie NOMME le champ', () => {
  /**
   * Monte l'ecran sur un evenement dont il MANQUE un champ obligatoire.
   * @param {any} manque - Ce qu'on retire de l'evenement.
   * @returns {Promise<any>} - La racine du rendu.
   */
  const monterAvecUnTrou = async (manque) => monterSur(evenementRempli(manque));

  test('sans heure de debut, le message dit « Heure de debut » — et pas du JSON', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const racine = await monterAvecUnTrou({ startTime: null });

    await act(async () => {
      await boutonEnregistrer(racine).props.onPress();
    });

    expect(alerte).toHaveBeenCalled();
    const dits = alerte.mock.calls.map((appel) => appel.join(' ')).join(' | ');

    // ⛔ CE QUI DISPARAIT : les accolades, les guillemets de JSON, le mot `type`
    // de la bibliotheque de formulaire.
    expect(dits).not.toMatch(/[{}]/);
    expect(dits).not.toMatch(/"message"|"type"|"ref"/);
    // ✅ CE QUI APPARAIT : le nom du champ, tel qu'il est ecrit a l'ecran.
    expect(dits).toContain(LIBELLE_HEURE_DEBUT);
    // Et rien n'est parti au serveur.
    expect(eventService.updateEvent).not.toHaveBeenCalled();

    alerte.mockRestore();
  });

  test('deux champs manquants sont nommes tous les deux', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const racine = await monterAvecUnTrou({ startTime: null, type: null });

    await act(async () => {
      await boutonEnregistrer(racine).props.onPress();
    });

    const dits = alerte.mock.calls.map((appel) => appel.join(' ')).join(' | ');
    expect(dits).toContain(LIBELLE_HEURE_DEBUT);
    expect(dits).toContain(LIBELLE_TYPE);
    expect(dits).not.toMatch(/[{}]/);

    alerte.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// R1 — L'ENREGISTREMENT N'ATTEND PLUS LE RECHARGEMENT DES LISTES
// ---------------------------------------------------------------------------
//
// 🥇 LE PLUS GROS GAIN DE TOUT L'AUDIT, POUR TROIS LIGNES. Apres l'ecriture,
// l'ecran attendait que 5 a 9 autres listes soient RECHARGEES avant de rendre
// la main — le rond tournait pendant tout ce temps. Il n'attendait pas pour
// rien : il attendait pour rien D'UTILE. `invalidateQueries` marque les listes
// perimees de facon SYNCHRONE ; seul le rechargement est asynchrone, et le
// `queryClient` est un singleton qui survit au demontage de l'ecran.
//
// ⚠️ CE QUI NE CHANGE PAS, et le temoin le verrouille : les invalidations
// PARTENT TOUJOURS, toutes les trois. Ce lot enleve l'attente, pas le
// rafraichissement.
describe('R1 — on ne fait plus la queue derriere le rafraichissement', () => {
  /**
   * Monte l'ecran avec un client dont les invalidations ne finissent JAMAIS.
   *
   * 🎯 C'est la mesure elle-meme : si l'ecran attend, il ne navigue pas. S'il
   * navigue quand meme, c'est qu'il n'attend plus. Aucune milliseconde n'est
   * mesuree — c'est un fait binaire, donc lisible.
   * @returns {Promise<{ navigations: any, invalidations: any }>} - Les espions.
   */
  const monterAvecInvalidationsQuiNeFinissentJamais = async () => {
    eventService.getEventByIdForEdit.mockResolvedValue(evenementRempli());
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: Infinity, retry: false } },
    });
    const invalidations = jest.fn(() => new Promise(() => {}));
    // @ts-ignore -- on remplace volontairement la methode pour l'observer
    client.invalidateQueries = invalidations;
    const navigations = jest.fn();

    act(() => {
      arbre = renderer.create(createElement(
        QueryClientProvider,
        { client },
        createElement(EventEdit, {
          navigation: {
            canGoBack: () => false,
            goBack: jest.fn(),
            navigate: jest.fn(),
            replace: navigations,
            setOptions: jest.fn(),
          },
          route: { params: { eventId: 'event-1' } },
        }),
      ));
    });
    await laisserRepondre();

    await act(async () => {
      await boutonEnregistrer(arbre.root).props.onPress();
    });

    return { invalidations, navigations };
  };

  test('l ecran rend la main SANS attendre que les listes se rechargent', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { navigations } = await monterAvecInvalidationsQuiNeFinissentJamais();

    // 🎯 Le rechargement n'est jamais revenu, et pourtant on est deja sur la fiche.
    expect(navigations).toHaveBeenCalledWith('EventDetails', { eventId: 'event-1' });
    alerte.mockRestore();
  });

  test('⛔ et les trois invalidations partent quand meme, toutes les trois', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { invalidations } = await monterAvecInvalidationsQuiNeFinissentJamais();

    const clefs = invalidations.mock.calls.map(
      (/** @type {any} */ appel) => appel[0].queryKey,
    );
    expect(clefs).toHaveLength(3);
    // ⛔ `['events']` est la SEULE qui rafraichit l'onglet Planning, la
    // recherche, la fiche equipe et le selecteur en conversation. La retirer
    // casserait la fraicheur pour de vrai.
    expect(clefs).toContainEqual(['events']);
    // ⛔ `['planning']` LARGE est exigee par le planning plein ecran (4 clefs).
    expect(clefs).toContainEqual(['planning']);
    // R2 — LA SEULE QUI SE RESSERRE : la fiche de CET evenement, pas toutes.
    expect(clefs).toContainEqual(['event', 'event-1']);
    expect(clefs).not.toContainEqual(['event']);

    alerte.mockRestore();
  });
});
