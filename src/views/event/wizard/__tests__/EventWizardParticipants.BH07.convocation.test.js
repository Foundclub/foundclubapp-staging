/* eslint-disable no-unused-vars -- montage repris tel quel d un temoin voisin (BH07) */
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import { EventWizardProvider, useEventWizard } from '../EventWizardContext';
import {
  getDefaultCapacityModeForEventType,
  getEventWizardStepCount,
  getEventWizardStepRoutes,
  shouldOfferMatchCallUp,
} from '../eventWizardDetectionUtils';
import EventWizardOpponent from '../EventWizardOpponent';
import EventWizardParticipants from '../EventWizardParticipants';
import EventWizardRecap from '../EventWizardRecap';

// BH07 (24/10) — P8-04 : « Suivant » pendant le chargement de l'equipe n'efface plus la convocation.
// P8-05 : une convocation videe a la main reste vide au retour sur l'etape.
// Montage repris de AC04-convocation-et-adversaire.test.js.

/** BH07 : vrai pendant le vol du GET /teams/:id. */
const mockEquipeEnVol = { vrai: false };
/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockProprietesDuGabarit = [];
/** Les charges utiles envoyees a la creation d'evenement. */
const mockChargesEnvoyees = [];
/** Les brouillons de composition enregistres APRES la creation. */
const mockBrouillonsEnregistres = [];
/** Vrai quand le serveur doit refuser le brouillon (mur d'abonnement). */
let mockLeServeurRefuseLeBrouillon = false;

/** L'equipe organisatrice, telle que `getTeamById` la rend (joueurs complets). */
const EQUIPE_COMPLETE = {
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-1',
  name: 'U15 A',
  players: [
    { documentId: 'j1', firstname: 'Karim', lastname: 'Benali' },
    { documentId: 'j2', firstname: 'Louis', lastname: 'Marchand' },
    { documentId: 'j3', firstname: 'Theo', lastname: 'Nguyen' },
  ],
  sport: { documentId: 'sport-1', name: 'Football' },
};

/**
 * L'equipe telle que l'ETAPE 2 la depose dans le tunnel : `EventWizardTeam`
 * interroge `useGetTeams({ summary: true })`, et ce mode ne rend des joueurs
 * que leur `documentId` (`teamService.js:194`). C'est cette mesure qui oblige
 * l'etape Participants a rappeler l'equipe complete.
 */
const EQUIPE_DU_TUNNEL = {
  club: { documentId: 'club-1', name: 'FC Test' },
  documentId: 'equipe-1',
  name: 'U15 A',
  players: [{ documentId: 'j1' }, { documentId: 'j2' }, { documentId: 'j3' }],
  sport: { documentId: 'sport-1', name: 'Football' },
};

const CLUBS_TROUVES = [
  { documentId: 'club-9', name: 'US Blaisoise' },
  { documentId: 'club-10', name: 'Blaisois Athletic' },
];

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
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      let modele = cle;
      if (typeof repli === 'string') modele = repli;
      else if (repli && typeof repli.defaultValue === 'string') modele = repli.defaultValue;
      const table = (repli && typeof repli === 'object' ? repli : valeurs) || {};
      return String(modele).replace(
        /\{\{(\w+)\}\}/g,
        (_correspondance, nom) => (table[nom] === undefined ? `{{${nom}}}` : String(table[nom])),
      );
    },
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy : il
// rend les echecs Jest illisibles (constat du lot paywall, 02/08).
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

// La charge utile passe TELLE QUELLE : ce que le Recap a construit est donc
// exactement ce que le test lit.
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
  saveEventCompositionDraft: async (
    /** @type {string} */ identifiant,
    /** @type {any} */ charge,
  ) => {
    mockBrouillonsEnregistres.push({ charge, identifiant });
    if (mockLeServeurRefuseLeBrouillon) {
      throw new Error('Cette fonctionnalite necessite une offre FoundClub active.');
    }
    return { ok: true };
  },
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: (/** @type {string} */ identifiant, /** @type {any} */ options) => (
    options?.enabled === false || !identifiant
      ? { data: undefined, isLoading: false }
      : { data: mockEquipeEnVol.vrai ? undefined : EQUIPE_COMPLETE, isLoading: mockEquipeEnVol.vrai }
  ),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useSearchClubs: (/** @type {string} */ requete) => ({
    data: String(requete || '').trim().length >= 2 ? CLUBS_TROUVES : undefined,
    isLoading: false,
  }),
}));

// La carte de club rendue comme un pressable portant le nom du club — meme
// doublure que `EventWizardOpponent.rechercheClub.test.js`.
jest.mock(
  '@/components/molecules/clubSearchResultCard/ClubSearchResultCard',
  () => function CarteClubMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
    return reactActuel.createElement(
      PressableRN,
      { accessibilityRole: 'button', onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.item?.name),
    );
  },
);

// S10-B — les deux etapes montees ici portent desormais les sections
// d'invitation : Participants lit `getTeams` (equipes de mon club) et
// "Contre qui ?" lit `getClubs` puis `getTeams` (equipe adverse).
// ⛔ Doublures OBLIGATOIRES, pas confortables : en copie de travail `.env` est
// absent, et tout service reellement charge TUE LA SUITE au chargement
// (0 test execute). Lire `Test Suites:`, pas seulement `Tests:`.
jest.mock('@/services/team/teamService', () => ({
  getTeams: () => Promise.resolve({ data: [] }),
}));

jest.mock('@/services/club/clubService', () => ({
  getClubs: () => Promise.resolve({ data: [] }),
}));

// S10-B — la section « inviter l'equipe adverse » ouvre une feuille de filtres
// (ville, rayon, sport). ⛔ `AutocompleteSelect` tire `react-native-bouncy-
// checkbox`, publie en ESM et NON transforme par jest : sans ces passe-plats,
// la suite entiere refuse de se charger (0 test execute). Le filet de la
// recherche vit dans `EventWizardOpponent.rechercheClub.test.js`.
jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => '' }),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: [], error: null, isLoading: false, refetch: () => {},
  }),
}));

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => () => null);
jest.mock('@/components/molecules/searchBar/SearchBar', () => () => null);
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('@react-native-community/slider', () => () => null);

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function FeuilleMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);

jest.mock('@/components/atoms/button/Button', () => function BoutonMock(/** @type {any} */ props) {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return reactActuel.createElement(
    PressableRN,
    { accessibilityRole: 'button', disabled: Boolean(props.disabled), onPress: props.onPress },
    reactActuel.createElement(TexteRN, null, props.title),
  );
});

// Le controle segmente rend une rangee de pressables portant chacun le libelle
// de son option : on pilote « Illimite » / « Capacite fixe » par le TEXTE.
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function ControleSegmenteMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
    return (props.options || []).map((/** @type {any} */ option) => reactActuel.createElement(
      PressableRN,
      {
        accessibilityRole: 'button',
        accessibilityState: { selected: props.value === option.value },
        key: option.value,
        onPress: () => props.onChange?.(option.value),
      },
      reactActuel.createElement(TexteRN, null, option.label),
    ));
  },
);

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

// ---------------------------------------------------------------------------
// LES OUTILS DU TEST
// ---------------------------------------------------------------------------

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
  mockBrouillonsEnregistres.length = 0;
  mockLeServeurRefuseLeBrouillon = false;
  PriseDeCourant.etat = null;
});

/**
 * Tous les textes rendus sous ce noeud, dans l'ordre du rendu.
 * ⚠️ On marche sur `children` de l'instance de test, PAS sur `toJSON()`.
 * @param {any} instance Instance de test (ou racine).
 * @param {string[]} [recueil] Accumulateur.
 * @returns {string[]} Les textes trouves.
 */
const textesDe = (instance, recueil = []) => {
  const enfants = instance?.children || [];
  enfants.forEach((/** @type {any} */ enfant) => {
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      recueil.push(String(enfant));
      return;
    }
    textesDe(enfant, recueil);
  });
  return recueil;
};

/**
 * Une navigation muette qui note ou elle est allee.
 * @param {any[]} destinations Accumulateur des destinations.
 * @returns {any} L'objet de navigation.
 */
const creerNavigation = (destinations) => ({
  canGoBack: () => true,
  goBack: () => {},
  navigate: (/** @type {string} */ nom, /** @type {any} */ parametres) => {
    destinations.push({ nom, parametres });
  },
  push: () => {},
  replace: () => {},
  reset: () => {},
  setParams: () => {},
});

/**
 * Monte une etape du tunnel avec un etat seme au prealable.
 * @param {any} Etape Le composant d'etape.
 * @param {any} etatSeme Les champs a semer (type, equipe, metas).
 * @returns {any} L'arbre et les outils de lecture.
 */
const monterUneEtape = (Etape, etatSeme = {}) => {
  /** @type {any[]} */
  const destinations = [];
  const navigation = creerNavigation(destinations);

  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    contenu,
  );

  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(rendre(null)); });

  if (etatSeme.type) {
    act(() => semer({ payload: etatSeme.type, type: 'SET_TYPE' }));
  }
  if (etatSeme.team) {
    act(() => semer({ payload: etatSeme.team, type: 'SET_TEAM' }));
  }
  if (etatSeme.metas) {
    act(() => semer({ payload: etatSeme.metas, type: 'SET_META' }));
  }

  act(() => {
    arbre.update(rendre(createElement(Etape, { navigation, route: { params: {} } })));
  });

  return {
    arbre,
    demonter: () => act(() => arbre.unmount()),
    destinations,
    gabarit: () => mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1],
  };
};

/**
 * Les cases a cocher rendues.
 * @param {any} arbre L'arbre de test.
 * @returns {any[]} Les noeuds natifs portant `accessibilityRole="checkbox"`.
 */
const casesACocher = (arbre) => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.type === 'string'
    && noeud.props?.accessibilityRole === 'checkbox',
  { deep: true },
);

/**
 * Presse le pressable qui rend ce texte.
 * ⚠️ L'element natif ne porte PAS `onPress` — le pressable de React Native le
 * traduit en gestionnaires de « responder ». Le geste se declenche donc sur le
 * composite.
 * @param {any} arbre L'arbre de test.
 * @param {string} titre Le texte visible.
 */
const presserParTexte = (arbre, titre) => {
  const cible = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.type !== 'string'
      && typeof noeud.props?.onPress === 'function',
    { deep: true },
  ).find((/** @type {any} */ noeud) => textesDe(noeud).includes(titre));
  if (!cible) throw new Error(`aucun pressable ne porte le texte « ${titre} »`);
  act(() => cible.props.onPress());
};

/**
 * Le champ de saisie libre de l'etape adversaire.
 * @param {any} arbre L'arbre de test.
 * @returns {any} Le premier noeud natif portant `onChangeText`.
 */
const champDeSaisie = (arbre) => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.type === 'string'
    && typeof noeud.props?.onChangeText === 'function',
  { deep: true },
)[0];

/**
 * Seme un tunnel complet puis publie depuis le Recap.
 * @param {any} options Options de la publication.
 * @returns {Promise<any>} La premiere charge utile envoyee.
 */
const publier = async ({
  enTraversantParticipants = false,
  metas = {},
  team = EQUIPE_DU_TUNNEL,
  type,
}) => {
  const navigation = creerNavigation([]);
  const rendre = (/** @type {any} */ contenu) => createElement(
    EventWizardProvider,
    null,
    createElement(PriseDeCourant),
    contenu,
  );

  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(rendre(null)); });
  act(() => semer({ payload: type, type: 'SET_TYPE' }));
  act(() => semer({ payload: team, type: 'SET_TEAM' }));
  act(() => semer({
    payload: {
      date: new Date('2027-08-12T15:00:00.000Z'),
      description: 'Un evenement',
      endTime: new Date('2027-08-12T16:00:00.000Z'),
      startTime: new Date('2027-08-12T15:00:00.000Z'),
      ...metas,
    },
    type: 'SET_META',
  }));

  // 🚨 SANS CETTE TRAVERSEE, LE TEMOIN NE PROUVE RIEN : `capacity` vaut deja
  // `null` dans l'etat initial du tunnel, donc un match publie sans passer par
  // l'etape partirait « sans plafond » meme sur le code d'AVANT le lot. C'est
  // le VRAI ecran, avec son VRAI « Suivant », qui fait foi.
  if (enTraversantParticipants) {
    act(() => {
      arbre.update(rendre(createElement(EventWizardParticipants, {
        navigation,
        route: { params: {} },
      })));
    });
    const etape = mockProprietesDuGabarit[mockProprietesDuGabarit.length - 1];
    act(() => { etape.onNext(); });
  }

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

const TYPE_MATCH = { documentId: 'type-match', name: 'Match' };
const TYPE_DETECTION = { documentId: 'type-detection', name: "Détection / Séance d'essai" };

// ---------------------------------------------------------------------------
// ETAPE 2 — LA CAPACITE ILLIMITEE
// ---------------------------------------------------------------------------

afterEach(() => { mockEquipeEnVol.vrai = false; });

test('P8-04 — Suivant pendant le chargement de l equipe garde la convocation', () => {
  mockEquipeEnVol.vrai = true;
  const { demonter, gabarit } = monterUneEtape(EventWizardParticipants, {
    metas: { matchCallUpPlayerIds: ['j1'] },
    team: EQUIPE_DU_TUNNEL,
    type: TYPE_MATCH,
  });
  act(() => { gabarit().onNext(); });
  expect(PriseDeCourant.etat.matchCallUpPlayerIds).toEqual(['j1']);
  demonter();
});

test('P8-05 — une convocation videe a la main reste vide au retour', () => {
  const { arbre, demonter, gabarit } = monterUneEtape(EventWizardParticipants, {
    team: EQUIPE_DU_TUNNEL,
    type: TYPE_MATCH,
  });
  ['Karim Benali', 'Louis Marchand', 'Theo Nguyen'].forEach((nom) => presserParTexte(arbre, nom));
  act(() => { gabarit().onNext(); });
  expect(PriseDeCourant.etat.matchCallUpPlayerIds).toEqual([]);
  const rendre = (/** @type {any} */ contenu) => createElement(EventWizardProvider, null, createElement(PriseDeCourant), contenu);
  act(() => { arbre.update(rendre(null)); });
  act(() => {
    arbre.update(rendre(createElement(EventWizardParticipants, {
      navigation: { navigate: () => {}, push: () => {} }, route: { params: {} },
    })));
  });
  expect(casesACocher(arbre).map((/** @type {any} */ item) => item.props.accessibilityState.checked))
    .toEqual([false, false, false]);
  demonter();
});
