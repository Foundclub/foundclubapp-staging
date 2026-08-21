import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { resolveEventDisplayName } from '@/domains/event/eventDisplayName';

import { RouteNames } from '@/navigation/routeNames';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import {
  getDefaultSessionStatusForEventType,
  getEventWizardInvitesStepIndex,
  getEventWizardStepCount,
  getEventWizardStepRoutes,
  isMatchEventType,
} from '../eventWizardDetectionUtils';
import EventWizardRecap from '../EventWizardRecap';
import EventWizardType from '../EventWizardType';

// FILET AA10 (E6) — LES TROIS CONSTATS D'ADEL DU 2026-08-20.
//
// ① « Il y a deux "Match amical", il faut garder celui des annonces. »
// ② « Pour un match, les participants doivent etre la liste des convocations,
//    et il faut ici la case invitation. »
// ③ « Acces et visibilite : ca doit etre prive de base. »
//
// 🔒 ③ est le plus important des trois : jusqu'a ce lot, TOUT evenement naissait
// `open`, c'est-a-dire DECOUVRABLE PAR TOUS. Un match d'equipe exposait donc sa
// composition et les noms de ses joueurs sans que personne ne l'ait choisi.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS, et c'est volontaire : la moitie de ② qui
// remplace la capacite chiffree par la LISTE DES JOUEURS de l'equipe de base
// n'est pas faite. Elle est bloquee cote serveur — voir le `test.todo` en bas
// de fichier, qui nomme le blocage plutot que de le taire.

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockProprietesDuGabarit = [];
/** Les charges utiles reellement envoyees a la creation d'evenement. */
const mockChargesEnvoyees = [];

/**
 * Les types tels que le SERVEUR les rend aujourd'hui : les sept du catalogue
 * (`admin/src/data/event-types.json`) plus « Match amical », que le serveur
 * fabrique tout seul a la premiere annonce d'amical acceptee
 * (`friendly-match-workflow.ts:144`). C'est ce huitieme qui faisait le doublon.
 */
const TYPES_DU_SERVEUR = [
  { documentId: 'type-detection', name: "Détection / Séance d'essai" },
  { documentId: 'type-entrainement', name: 'Entraînement' },
  { documentId: 'type-stage', name: 'Stage' },
  { documentId: 'type-tournoi', name: 'Tournoi' },
  { documentId: 'type-match', name: 'Match' },
  { documentId: 'type-match-amical', name: 'Match amical' },
  { documentId: 'type-autre', name: 'Autre' },
  { documentId: 'type-reservation', name: 'Réservation' },
];

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall, 02/08).
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

jest.mock('@/services/event/eventQueries', () => ({
  useGetEventTypes: () => ({
    data: TYPES_DU_SERVEUR, error: null, isLoading: false, refetch: () => {},
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: () => Promise.resolve(null),
    invalidateQueries: () => Promise.resolve(),
    setQueryData: () => {},
  }),
}));

// 🎯 LA PIECE QUI FAIT LE TEMOIN ③ : la charge utile passe TELLE QUELLE. Ce que
// le Recap a construit est donc exactement ce que le test lit.
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    createReccurrentEventPayload: (/** @type {any} */ formulaire) => [formulaire],
    createStageEventPayload: (/** @type {any} */ formulaire) => formulaire,
  }),
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: () => {} }));

// ⛔ Jamais `requireActual` sur un service : le client HTTP exige `API_URL` et
// la suite entiere meurt au chargement.
jest.mock('@/services/event/eventService', () => ({
  createEventsWithConcurrency: async (/** @type {any[]} */ charges) => {
    mockChargesEnvoyees.push(...charges);
    return {
      created: charges.map((charge, rang) => ({
        documentId: `ev-${rang}`,
        payload: charge,
        response: { data: { documentId: `ev-${rang}` } },
      })),
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
// non transforme : sans cette doublure, la suite meurt au CHARGEMENT.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);

jest.mock('../../components/EventTasksEditor', () => () => null);

jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => function BorneMock(
  /** @type {any} */ props,
) {
  return props.children;
});

jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => function EnveloppeMock(/** @type {any} */ props) {
    return props.children;
  },
);

jest.mock(
  '@/components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner',
  () => function BandeauMock() {
    return null;
  },
);

/** Le dispatch du tunnel, capte pour semer un etat de depart. */
let semer = () => {};

/**
 * Sonde sans rendu : elle expose le `dispatch` et l'`state` du tunnel.
 * @returns {null} Rien.
 */
function PriseDeCourant() {
  const tunnel = useEventWizard();
  semer = tunnel.dispatch;
  PriseDeCourant.etat = tunnel.state;
  return null;
}

beforeEach(() => {
  mockProprietesDuGabarit.length = 0;
  mockChargesEnvoyees.length = 0;
  PriseDeCourant.etat = null;
});

/**
 * Tous les textes rendus sous un noeud de l'arbre de test.
 * @param {any} noeud Noeud de depart.
 * @returns {string[]} Les textes trouves.
 */
const textesSous = (noeud) => {
  /** @type {string[]} */
  const sortie = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      sortie.push(String(enfant));
      return;
    }
    if (Array.isArray(enfant)) {
      enfant.forEach(parcourir);
      return;
    }
    if (enfant?.children) enfant.children.forEach(parcourir);
  };
  parcourir(noeud.children);
  return sortie;
};

/**
 * Rend l'etape 1 et rend les rangees affichees.
 * @returns {{ demonter: () => void, destinations: any[], rangees: any[] }} La mesure.
 */
const rendreLEtapeDesTypes = () => {
  /** @type {any[]} */
  const destinations = [];
  const navigation = {
    goBack: () => {},
    navigate: (/** @type {string} */ nom, /** @type {any} */ parametres) => {
      destinations.push({ nom, parametres });
    },
    setParams: () => {},
  };

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      EventWizardProvider,
      null,
      createElement(EventWizardType, { navigation, route: { params: {} } }),
    ));
  });

  // ⚠️ PIEGE DE MESURE : `findAll` rend le composite ET l'element natif qu'il
  // produit — une rangee y apparait donc DEUX fois, et « combien de Match
  // amical ? » repondait 2 sur une liste qui n'en montrait qu'un. On ne retient
  // que les elements natifs (`typeof type === 'string'`), et on les reconnait a
  // `accessibilityState`, que seules les rangees portent. Ce filtre garde aussi
  // la rangee grisee « Réservation », qui n'a pas de `onPress`.
  const rangees = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.type === 'string'
      && noeud.props?.accessibilityRole === 'button'
      && Boolean(noeud.props?.accessibilityState),
    { deep: true },
  );

  /**
   * Presse la rangee qui porte ce titre.
   *
   * ⚠️ L'element natif ne porte PAS `onPress` — le pressable de React Native le
   * traduit en gestionnaires de « responder ». Le geste se declenche donc sur le
   * composite, pas sur la rangee relevee ci-dessus.
   * @param {string} titre Titre visible de la rangee.
   */
  const presser = (titre) => {
    const cible = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.type !== 'string'
        && typeof noeud.props?.onPress === 'function',
      { deep: true },
    ).find((/** @type {any} */ noeud) => textesSous(noeud)[0] === titre);

    if (!cible) throw new Error(`aucune rangee pressable ne porte le titre « ${titre} »`);
    act(() => cible.props.onPress());
  };

  return {
    demonter: () => act(() => arbre.unmount()), destinations, presser, rangees,
  };
};

/**
 * Sème un etat de tunnel en passant par le VRAI choix de type, puis publie.
 * @param {object} options Options.
 * @param {any} options.type Le type d'evenement choisi a l'etape 1.
 * @param {any} [options.puis] Champs supplementaires semes apres le choix du type.
 * @returns {Promise<any>} La premiere charge utile envoyee au serveur.
 */
const publierUnEvenementDeType = async ({ puis, type }) => {
  const navigation = {
    canGoBack: () => true,
    goBack: () => {},
    navigate: () => {},
    push: () => {},
    replace: () => {},
    reset: () => {},
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
  // ⚠️ Le VRAI `SET_TYPE`, pas un `SET_META` : c'est lui qui porte le defaut de
  // visibilite. Le semer autrement testerait le test, pas l'application.
  act(() => semer({ payload: type, type: 'SET_TYPE' }));
  act(() => semer({
    payload: {
      date: new Date('2027-08-12T15:00:00.000Z'),
      description: 'Un evenement',
      endTime: new Date('2027-08-12T16:00:00.000Z'),
      startTime: new Date('2027-08-12T15:00:00.000Z'),
      ...(puis || {}),
    },
    type: 'SET_META',
  }));
  act(() => semer({
    payload: {
      club: { documentId: 'club-1', name: 'FC Test' },
      documentId: 'equipe-1',
      name: 'U15 A',
      sport: { documentId: 'sport-1', name: 'Football' },
    },
    type: 'SET_TEAM',
  }));

  act(() => {
    arbre.update(rendre(createElement(EventWizardRecap, {
      navigation,
      route: { params: {} },
    })));
  });

  const gabarit = mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];
  await act(async () => { await gabarit.onNext(); });
  act(() => arbre.unmount());

  return mockChargesEnvoyees[0];
};

describe('AA10 ③ — un evenement naît PRIVE, sauf quand le priver le casse', () => {
  test('temoin 1 — un MATCH publie part au serveur en « closed »', async () => {
    const charge = await publierUnEvenementDeType({
      type: { documentId: 'type-match', name: 'Match' },
    });

    expect(charge).toBeTruthy();
    expect(charge.sessionStatus).toBe('closed');
  });

  test('temoin 2 — une DETECTION reste ouverte : privee, elle ne trouve personne', async () => {
    const charge = await publierUnEvenementDeType({
      type: { documentId: 'type-detection', name: "Détection / Séance d'essai" },
    });

    expect(charge.sessionStatus).toBe('open');
  });

  // 🚨 Ce n'est pas une preference d'affichage : cote serveur,
  // `assertCompetitionMutable` (`tournament-competition.js:307`) traite un
  // tournoi `closed` comme CLOTURE et refuse toute modification de la
  // competition. Un tournoi prive des sa creation naitrait fige.
  test('temoin 2 bis — un TOURNOI reste ouvert, sinon il naît cloture', async () => {
    const charge = await publierUnEvenementDeType({
      type: { documentId: 'type-tournoi', name: 'Tournoi' },
    });

    expect(charge.sessionStatus).toBe('open');
  });

  test('le defaut, type par type, en une seule table', () => {
    expect(TYPES_DU_SERVEUR.map((type) => [
      type.name,
      getDefaultSessionStatusForEventType(type.name),
    ])).toEqual([
      ["Détection / Séance d'essai", 'open'],
      ['Entraînement', 'closed'],
      ['Stage', 'closed'],
      ['Tournoi', 'open'],
      ['Match', 'closed'],
      ['Match amical', 'closed'],
      ['Autre', 'closed'],
      ['Réservation', 'closed'],
    ]);
  });

  // 🪤 Le piege que ce temoin garde : le Recap rouvre l'etape 1 avec son lien
  // « modifier ». Si le defaut se recalculait a CHAQUE `SET_TYPE`, ce
  // aller-retour a blanc effacerait un « Public » choisi a la main.
  test('un « Public » choisi a la main survit a un retour sur l etape 1', () => {
    const type = { documentId: 'type-match', name: 'Match' };

    act(() => {
      renderer.create(createElement(
        EventWizardProvider,
        null,
        createElement(PriseDeCourant),
      ));
    });

    act(() => semer({ payload: type, type: 'SET_TYPE' }));
    expect(PriseDeCourant.etat.sessionStatus).toBe('closed');

    act(() => semer({ payload: { sessionStatus: 'open' }, type: 'SET_META' }));
    act(() => semer({ payload: { ...type }, type: 'SET_TYPE' }));
    expect(PriseDeCourant.etat.sessionStatus).toBe('open');

    // Changer VRAIMENT de type, en revanche, reprend le defaut du nouveau type.
    act(() => semer({ payload: { documentId: 'type-autre', name: 'Autre' }, type: 'SET_TYPE' }));
    expect(PriseDeCourant.etat.sessionStatus).toBe('closed');
  });
});

describe('AA10 ① — une seule rangee « Match amical », celle des annonces', () => {
  test('temoin 3 — la liste ne montre qu UN seul « Match amical »', () => {
    const { demonter, rangees } = rendreLEtapeDesTypes();

    const titres = rangees.map((rangee) => textesSous(rangee)[0]);
    expect(titres.filter((titre) => titre === 'Match amical')).toHaveLength(1);

    // Et le reste du catalogue est toujours la, dans son ordre.
    expect(titres).toEqual([
      "Détection / Séance d'essai",
      'Entraînement',
      'Stage',
      'Tournoi',
      'Match',
      'Match amical',
      'Autre',
      'Réservation',
    ]);

    demonter();
  });

  test('temoin 4 — celle qui reste ouvre bien le tunnel des annonces', () => {
    const { demonter, destinations, presser } = rendreLEtapeDesTypes();

    presser('Match amical');

    expect(destinations).toEqual([{
      nom: RouteNames.FriendlyMatchWizardStack,
      parametres: {
        params: { entryOrigin: RouteNames.EventStack },
        screen: RouteNames.FriendlyMatchWizardTeam,
      },
    }]);

    demonter();
  });

  // 🔒 L'INTERDIT DU LOT : rien ne devient MOINS visible pour ce qui existe
  // deja. Le type n'est ni supprime ni renomme — seule la porte de CREATION se
  // ferme. Un evenement deja cree avec lui garde donc son nom et son parcours.
  test('temoin 5 — un evenement deja cree avec ce type garde son nom', () => {
    const evenementExistant = {
      invitedTeams: [{ documentId: 'equipe-2', name: 'US Voisine' }],
      name: 'Match amical - 12/08/2027 - U15 A vs US Voisine',
      team: { documentId: 'equipe-1', name: 'U15 A' },
      type: { documentId: 'type-match-amical', name: 'Match amical' },
    };

    // 🔒 Le nom du type est RECOPIE tel quel dans le nom affiche : c'est la
    // preuve la plus directe qu'il n'a ete ni supprime ni renomme.
    expect(resolveEventDisplayName(evenementExistant)).toBe('Match amical vs US Voisine');
    // Et le tunnel le reconnait toujours comme un match : masquer une rangee
    // n'a change AUCUNE regle metier.
    expect(isMatchEventType('Match amical')).toBe(true);
  });
});

describe('AA10 ② — les invitations, a leur place, pour un match', () => {
  test('temoin 7 — l ecran des invitations est une etape du match', () => {
    const chaineDuMatch = getEventWizardStepRoutes({
      sessionStatus: 'closed',
      type: { documentId: 'type-match', name: 'Match' },
    });

    expect(chaineDuMatch).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLogistics,
      RouteNames.EventWizardOpponent,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardParticipants,
      RouteNames.EventWizardInvites,
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ]);
    // Elle arrive JUSTE APRES les participants : c'est la qu'on pense « qui
    // vient », et non une fois tout regle depuis le recapitulatif.
    expect(getEventWizardInvitesStepIndex({
      sessionStatus: 'closed',
      type: { name: 'Match' },
    })).toBe(7);
  });

  test('hors match, l ecran reste hors chaine et n affiche aucun numero', () => {
    ['Entraînement', 'Stage', 'Tournoi', "Détection / Séance d'essai", 'Autre']
      .forEach((nomDuType) => {
        const etat = {
          sessionStatus: getDefaultSessionStatusForEventType(nomDuType),
          type: { name: nomDuType },
        };
        expect(getEventWizardStepRoutes(etat)).not.toContain(RouteNames.EventWizardInvites);
        // 0 = hors chaine. C'est ce zero que l'ecran traduit en « pas de
        // compteur » plutot qu'en « Étape 0/8 ».
        expect(getEventWizardInvitesStepIndex(etat)).toBe(0);
      });
  });

  // ✅ FAIT PAR AC04 (2026-08-21) — ET LE PIEGE DECRIT ICI RESTE VRAI.
  //
  // AA10 avait laisse ce temoin en attente parce qu'il n'imaginait qu'un seul
  // chemin : ecrire une AUDIENCE sur l'equipe organisatrice. Ce chemin est bien
  // toujours condamne — `syncEventTeamAudiencesForEvent`
  // (`admin/src/api/event-team-audience/services/event-team-audience.ts:343`)
  // appelle `connectInvitedTeam` pour toute audience ACCEPTED, l'equipe
  // organisatrice atterrirait dans `invitedTeams`, et la carte d'evenement
  // (`EventCardNew.js:504`) afficherait « U15 A vs U15 A ».
  //
  // 🎯 AC04 passe A COTE du piege plutot que de le desamorcer : convoquer, dans
  // ce depot, c'est un BROUILLON DE COMPOSITION (`selectedPlayerIds`), pas une
  // audience. Aucune ligne d'invitation n'est ecrite, donc `invitedTeams` ne
  // bouge pas. Les temoins vivent dans `AC04-convocation-et-adversaire.test.js`.
  test('temoin 6 — la convocation d un match ne touche PAS aux invitations', () => {
    const chargeAttendue = { invitedTeams: [], teamAudiences: [] };

    // Le garde-fou en une ligne : l'etat du tunnel apres un choix de convocation
    // laisse les deux listes d'invitation intactes.
    act(() => {
      renderer.create(createElement(
        EventWizardProvider,
        null,
        createElement(PriseDeCourant),
      ));
    });
    act(() => semer({ payload: { documentId: 'type-match', name: 'Match' }, type: 'SET_TYPE' }));
    act(() => semer({ payload: ['j1', 'j3'], type: 'SET_MATCH_CALL_UP' }));

    expect(PriseDeCourant.etat.matchCallUpPlayerIds).toEqual(['j1', 'j3']);
    expect({
      invitedTeams: PriseDeCourant.etat.invitedTeams,
      teamAudiences: PriseDeCourant.etat.teamAudiences,
    }).toEqual(chargeAttendue);
  });
});

describe('AA10 — le compteur d etapes, avant et apres', () => {
  test('temoin 8 — le nombre d etapes de chaque type, defaut de visibilite compris', () => {
    const compter = (/** @type {string} */ nomDuType) => getEventWizardStepCount({
      sessionStatus: getDefaultSessionStatusForEventType(nomDuType),
      type: { name: nomDuType },
    });

    expect(TYPES_DU_SERVEUR.map((type) => [type.name, compter(type.name)])).toEqual([
      // Ouverte par defaut : elle garde son etape Participants.
      ["Détection / Séance d'essai", 8],
      // 8 → 7 : privee par defaut, elle saute l'etape Participants (regle D08,
      // `shouldSkipEventWizardParticipantsStep`).
      ['Entraînement', 7],
      ['Stage', 8],
      ['Tournoi', 10],
      // 9 → 10 : l'etape « Invitations » entre dans la chaine.
      ['Match', 10],
      ['Match amical', 10],
      ['Autre', 8],
      ['Réservation', 8],
    ]);
  });

  test('un entrainement repasse en PUBLIC retrouve son etape Participants', () => {
    expect(getEventWizardStepCount({
      sessionStatus: 'open',
      type: { name: 'Entraînement' },
    })).toBe(8);
    expect(getEventWizardStepRoutes({
      sessionStatus: 'open',
      type: { name: 'Entraînement' },
    })).toContain(RouteNames.EventWizardParticipants);
  });
});
