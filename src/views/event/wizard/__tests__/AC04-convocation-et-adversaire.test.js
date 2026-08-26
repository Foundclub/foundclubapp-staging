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

// FILET AC04 (E6) — LES DEUX CONSTATS D'ADEL DES 2026-08-20 ET 2026-08-21.
//
// ① « Pour les evenements matchs, dans le tunnel, les participants doivent etre
//    plutot la liste pour faire les convocations, avec les joueurs de l'equipe
//    de base. » + « l'etape des participants doit etre ILLIMITEE. »
// ② « C'est bien si dans l'etape pour choisir l'adversaire on pouvait choisir
//    un club pour le trouver. »
//
// 🔒 LE GARDE-FOU DU LOT est le temoin 6 : le nom LIBRE reste possible. 7 clubs
// sur 222 294 ont une equipe (mesure du 2026-08-13) — l'adversaire est presque
// toujours hors de FoundClub, et une liste fermee condamnerait l'etape.
//
// 🧩 CE QUE CE FILET PROUVE SUR LA CONVOCATION, ET CE QU'IL NE PROUVE PAS.
// A la creation, l'evenement N'EXISTE PAS ENCORE : aucune convocation ne peut
// se poser dessus. Le tunnel garde donc le choix en memoire
// (`matchCallUpPlayerIds`) et le Recap le REJOUE apres la creation, sur
// l'identifiant rendu par le serveur, via `saveEventCompositionDraft` — la
// route que l'ecran `MatchCallUpSelection` emprunte deja.
// ⛔ Ce que ce filet ne prouve PAS : la reponse du VRAI serveur. La route
// `POST /events/:id/composition/draft` est derriere un mur d'abonnement
// (`admin/src/api/event/controllers/event.ts:519` — action `composition.manage`,
// offres Equipe/Club). Un organisateur GRATUIT recevra donc un 403, et le
// temoin 4 bis prouve que l'evenement est cree quand meme.

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
      : { data: EQUIPE_COMPLETE, isLoading: false }
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

describe('AC04 ① — sur un match, la capacite part ILLIMITEE', () => {
  test('temoin 1 — l etape Participants d un match s ouvre sur « Illimite »', () => {
    const { arbre, demonter } = monterUneEtape(EventWizardParticipants, {
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_MATCH,
    });

    const pilules = arbre.root.findAll(
      (/** @type {any} */ noeud) => typeof noeud.type === 'string'
        && typeof noeud.props?.accessibilityState?.selected === 'boolean',
      { deep: true },
    );
    const selectionnee = pilules.find(
      (/** @type {any} */ pilule) => pilule.props.accessibilityState.selected,
    );
    // ⚠️ Le libelle vient du REPLI du code (`'Illimite'`, sans accent), pas de
    // `fr.js` : la doublure de `useTranslation` rend toujours le repli.
    expect(textesDe(selectionnee)).toContain('Illimite');

    // Et le compteur de places n'est pas affiche : sans plafond, il ne veut
    // rien dire.
    expect(textesDe(arbre.root)).not.toContain('joueurs max');

    demonter();
  });

  test('temoin 1 bis — le match part au serveur SANS plafond', async () => {
    const charge = await publier({ enTraversantParticipants: true, type: TYPE_MATCH });

    expect(charge).toBeTruthy();
    expect(charge.capacity).toBeNull();
  });

  test('temoin 1 ter — une DETECTION traversee, elle, part AVEC ses 12 places', async () => {
    const charge = await publier({ enTraversantParticipants: true, type: TYPE_DETECTION });

    expect(charge.capacity).toBe(12);
  });

  test('temoin 2 — les autres types gardent « Capacite fixe » (non-regression)', () => {
    expect([
      "Détection / Séance d'essai",
      'Entraînement',
      'Stage',
      'Tournoi',
      'Match',
      'Match amical',
      'Autre',
      'Réservation',
    ].map((nom) => [nom, getDefaultCapacityModeForEventType(nom)])).toEqual([
      ["Détection / Séance d'essai", 'fixed'],
      ['Entraînement', 'fixed'],
      ['Stage', 'fixed'],
      ['Tournoi', 'fixed'],
      ['Match', 'unlimited'],
      ['Match amical', 'unlimited'],
      ['Autre', 'fixed'],
      ['Réservation', 'fixed'],
    ]);
  });

  test('temoin 2 bis — une DETECTION s ouvre toujours sur 12 places', () => {
    const { arbre, demonter } = monterUneEtape(EventWizardParticipants, {
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_DETECTION,
    });

    const textes = textesDe(arbre.root);
    expect(textes).toContain('joueurs max');
    expect(textes).toContain('12');

    demonter();
  });

  test('temoin 2 ter — un choix fait a la main survit au retour sur l etape', () => {
    const { arbre, demonter, gabarit } = monterUneEtape(EventWizardParticipants, {
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_MATCH,
    });

    presserParTexte(arbre, 'Capacité fixe');
    act(() => { gabarit().onNext(); });

    expect(PriseDeCourant.etat.capacityMode).toBe('fixed');
    expect(PriseDeCourant.etat.capacity).toBe(12);

    demonter();
  });
});

// ---------------------------------------------------------------------------
// ETAPE 3 — LES CONVOCATIONS DANS L'ETAPE
// ---------------------------------------------------------------------------

describe('AC04 ① — l etape Participants d un match porte la CONVOCATION', () => {
  test('temoin 3 — elle montre les joueurs de l equipe de base', () => {
    const { arbre, demonter } = monterUneEtape(EventWizardParticipants, {
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_MATCH,
    });

    const textes = textesDe(arbre.root);
    expect(textes).toContain('Karim Benali');
    expect(textes).toContain('Louis Marchand');
    expect(textes).toContain('Theo Nguyen');

    // Une case par joueur, toutes cochees au depart : l'effectif de base EST la
    // convocation de depart, on decoche les absents.
    const cases = casesACocher(arbre);
    expect(cases).toHaveLength(3);
    expect(cases.map((/** @type {any} */ item) => item.props.accessibilityState.checked))
      .toEqual([true, true, true]);

    demonter();
  });

  test('temoin 3 bis — hors match, aucune case a cocher', () => {
    const { arbre, demonter } = monterUneEtape(EventWizardParticipants, {
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_DETECTION,
    });

    expect(casesACocher(arbre)).toHaveLength(0);
    expect(textesDe(arbre.root)).not.toContain('Karim Benali');

    demonter();
  });

  test('temoin 4 — on decoche, et le choix survit jusqu a la creation', async () => {
    const { arbre, demonter, gabarit } = monterUneEtape(EventWizardParticipants, {
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_MATCH,
    });

    // ⚠️ PIEGE DE MESURE, deja paye dans ce depot : l'element natif ne porte
    // PAS `onPress` — le pressable de React Native le traduit en gestionnaires
    // de « responder ». On presse donc la RANGEE (composite), pas la case.
    presserParTexte(arbre, 'Louis Marchand');

    expect(casesACocher(arbre)
      .map((/** @type {any} */ item) => item.props.accessibilityState.checked))
      .toEqual([true, false, true]);

    act(() => { gabarit().onNext(); });
    expect(PriseDeCourant.etat.matchCallUpPlayerIds).toEqual(['j1', 'j3']);

    demonter();

    // …et le Recap le rejoue APRES la creation, sur l'identifiant rendu par le
    // serveur : une convocation se pose SUR un evenement, qui n'existait pas
    // encore au moment du choix.
    await publier({
      metas: { matchCallUpPlayerIds: ['j1', 'j3'] },
      type: TYPE_MATCH,
    });

    expect(mockBrouillonsEnregistres).toHaveLength(1);
    expect(mockBrouillonsEnregistres[0].identifiant).toBe('ev-0');
    expect(mockBrouillonsEnregistres[0].charge.teamId).toBe('equipe-1');
    expect(mockBrouillonsEnregistres[0].charge.draft.selectedPlayerIds).toEqual(['j1', 'j3']);
  });

  test('temoin 4 bis — un serveur qui REFUSE le brouillon ne casse pas la creation', async () => {
    mockLeServeurRefuseLeBrouillon = true;

    const charge = await publier({
      metas: { matchCallUpPlayerIds: ['j1'] },
      type: TYPE_MATCH,
    });

    // Le 403 du mur d'abonnement (`composition.manage`) est absorbe :
    // l'evenement est cree, la convocation se reprend depuis la fiche.
    expect(charge).toBeTruthy();
    expect(mockBrouillonsEnregistres).toHaveLength(1);
  });

  test('temoin 4 ter — sans convocation choisie, aucun appel serveur en plus', async () => {
    await publier({ metas: { matchCallUpPlayerIds: [] }, type: TYPE_MATCH });
    expect(mockBrouillonsEnregistres).toHaveLength(0);

    // Et jamais pour un autre type.
    await publier({ metas: { matchCallUpPlayerIds: ['j1'] }, type: TYPE_DETECTION });
    expect(mockBrouillonsEnregistres).toHaveLength(0);
  });

  test('l offre de convocation suit le match ET l equipe', () => {
    expect(shouldOfferMatchCallUp({
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_MATCH,
    })).toBe(true);
    // Sans equipe organisatrice, il n'y a pas d'effectif a cocher.
    expect(shouldOfferMatchCallUp({ type: TYPE_MATCH })).toBe(false);
    expect(shouldOfferMatchCallUp({
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_DETECTION,
    })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ETAPE 4 — CHERCHER UN CLUB POUR L'ADVERSAIRE
// ---------------------------------------------------------------------------

describe('AC04 ② — chercher un club pour trouver l adversaire', () => {
  test('temoin 5 — on tape, on voit des clubs, on en choisit un', () => {
    const { arbre, demonter, gabarit } = monterUneEtape(EventWizardOpponent, {
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_MATCH,
    });

    act(() => { champDeSaisie(arbre).props.onChangeText('Blais'); });

    const textes = textesDe(arbre.root);
    expect(textes).toContain('US Blaisoise');
    expect(textes).toContain('Blaisois Athletic');

    presserParTexte(arbre, 'US Blaisoise');
    act(() => { gabarit().onNext(); });

    expect(PriseDeCourant.etat.opponentName).toBe('US Blaisoise');
    // L'identifiant est retenu en plus du nom — l'ecusson plus tard.
    expect(PriseDeCourant.etat.opponentClubId).toBe('club-9');

    demonter();
  });

  // 🔒 LE GARDE-FOU DU LOT. 7 clubs sur 222 294 ont une equipe : l'adversaire
  // est presque toujours hors de FoundClub.
  test('temoin 6 — on peut TOUJOURS taper un nom libre', () => {
    const { arbre, demonter, gabarit } = monterUneEtape(EventWizardOpponent, {
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_MATCH,
    });

    act(() => { champDeSaisie(arbre).props.onChangeText('Les Copains du Dimanche U15'); });
    act(() => { gabarit().onNext(); });

    expect(PriseDeCourant.etat.opponentName).toBe('Les Copains du Dimanche U15');
    expect(PriseDeCourant.etat.opponentClubId).toBeNull();

    demonter();
  });

  test('temoin 6 bis — retoucher le nom apres un choix de club LACHE le club', () => {
    const { arbre, demonter, gabarit } = monterUneEtape(EventWizardOpponent, {
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_MATCH,
    });

    act(() => { champDeSaisie(arbre).props.onChangeText('Blais'); });
    presserParTexte(arbre, 'US Blaisoise');
    act(() => { champDeSaisie(arbre).props.onChangeText('US Blaisoise U15'); });
    act(() => { gabarit().onNext(); });

    expect(PriseDeCourant.etat.opponentName).toBe('US Blaisoise U15');
    // Le nom ne designe plus le club trouve : garder son identifiant serait un
    // mensonge silencieux.
    expect(PriseDeCourant.etat.opponentClubId).toBeNull();

    demonter();
  });

  test('temoin 6 ter — « Passer » reste possible et n efface rien', () => {
    const { arbre, demonter, gabarit } = monterUneEtape(EventWizardOpponent, {
      team: EQUIPE_DU_TUNNEL,
      type: TYPE_MATCH,
    });

    expect(gabarit().showSkip).toBe(true);
    act(() => { champDeSaisie(arbre).props.onChangeText('US Blaisoise U15'); });
    act(() => { gabarit().onSkip(); });

    expect(PriseDeCourant.etat.opponentName).toBe('US Blaisoise U15');

    demonter();
  });

  test('l adversaire part au serveur, l identifiant du club NON', async () => {
    const charge = await publier({
      metas: { opponentClubId: 'club-9', opponentName: 'US Blaisoise' },
      type: TYPE_MATCH,
    });

    expect(charge.opponentName).toBe('US Blaisoise');
    // ⛔ `event.opponentClub` N'EXISTE PAS dans le schema Strapi
    // (`admin/src/api/event/content-types/event/schema.json:425` ne porte que
    // `opponentName`). Envoyer une clef inconnue exposerait la creation
    // entiere au refus de validation.
    expect(Object.prototype.hasOwnProperty.call(charge, 'opponentClubId')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// LE COMPTEUR D'ETAPES
// ---------------------------------------------------------------------------

describe('AC04 — le compteur d etapes ne bouge pas', () => {
  // 🚚 S10-B (2026-08-26) — AC04 avait fige « la chaine du match est
  // INCHANGEE » parce que son lot ne devait pas y toucher. S10-B, lui, a
  // precisement pour mission d'y toucher : « Invitations » fond dans
  // « Participants », 10 → 9. Ce que le temoin garde reste le meme — la FORME
  // exacte de la chaine, et le fait qu'AC04 (convocation + adversaire) n'a rien
  // ajoute ni retire de son cote.
  test('temoin 7 — la chaine du match, 9 etapes depuis S10-B', () => {
    const etat = { sessionStatus: 'closed', type: TYPE_MATCH };

    expect(getEventWizardStepRoutes(etat)).toEqual([
      RouteNames.EventWizardType,
      RouteNames.EventWizardTeam,
      RouteNames.EventWizardLogistics,
      RouteNames.EventWizardOpponent,
      RouteNames.EventWizardLocation,
      RouteNames.EventWizardParticipants,
      RouteNames.EventWizardAccess,
      RouteNames.EventWizardDescription,
      RouteNames.EventWizardRecap,
    ]);
    expect(getEventWizardStepCount(etat)).toBe(9);
  });

  test('temoin 7 bis — aucun autre type ne change de longueur', () => {
    const compter = (/** @type {string} */ nom, /** @type {string} */ visibilite) => (
      getEventWizardStepCount({ sessionStatus: visibilite, type: { name: nom } })
    );

    expect([
      ["Détection / Séance d'essai", compter("Détection / Séance d'essai", 'open')],
      ['Entraînement', compter('Entraînement', 'closed')],
      ['Stage', compter('Stage', 'closed')],
      ['Tournoi', compter('Tournoi', 'open')],
      ['Match', compter('Match', 'closed')],
      ['Match amical', compter('Match amical', 'closed')],
      ['Autre', compter('Autre', 'closed')],
      ['Réservation', compter('Réservation', 'closed')],
    ]).toEqual([
      ["Détection / Séance d'essai", 8],
      ['Entraînement', 7],
      ['Stage', 8],
      ['Tournoi', 10],
      // S10-B : 10 → 9 pour les deux formes de match, et pour elles seules.
      ['Match', 9],
      ['Match amical', 9],
      ['Autre', 8],
      ['Réservation', 8],
    ]);
  });
});
