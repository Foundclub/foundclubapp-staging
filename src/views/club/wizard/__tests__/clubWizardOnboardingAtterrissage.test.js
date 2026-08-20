import {
  createNavigatorFactory,
  NavigationContainer,
  useNavigationBuilder,
} from '@react-navigation/native';
import { StackRouter } from '@react-navigation/routers';
import { createElement } from 'react';
import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserTrainedTeams from '@/views/onboarding/UserTrainedTeams';

import ClubWizardRecap from '../ClubWizardRecap';

// FILET T10 (E6) — CREER SON CLUB PENDANT L'INSCRIPTION, PUIS L'ETAPE SUIVANTE.
//
// Constat d'Adel du 2026-08-17 : « j'ai cree mon club, j'ai eu le pop-up
// "votre club a bien ete cree", et la ca m'a propose de rejoindre une equipe DU
// PREMIER CLUB sur lequel j'avais clique en recherchant au tout debut ».
//
// 🥇 CE QUE LA MESURE A ETABLI — le mauvais club n'est PAS un souvenir de
// navigation. Le parcours entraineur n'en transporte aucun :
// `UserAffiliationGuide.handleSelectResult` (l.500-507) envoie le staff sur la
// fiche du club SANS rien memoriser. Le club fautif vit dans le PROFIL, sous
// forme de demande d'adhesion `pending` : c'est la 3e source que
// `UserTrainedTeams` (l.57-63) consulte pour deviner « mon club », et un test
// du lot D16 la verrouille (« retrouve le club meme quand l adhesion n est
// encore qu une demande en attente ») — elle est donc legitime et elle reste.
//
// Le defaut, c'est que l'etape suivante DEVINE alors que l'etape precedente
// SAIT : `ClubWizardRecap` calcule `clubDocumentId` (l.80) et, dans la branche
// `entry === 'onboarding'`, ne le transmet a personne. La devinette gagne donc
// toujours contre la verite.
//
// 🧨 POURQUOI UN VRAI ROUTEUR ET PAS UN ESPION SUR `navigation.navigate` :
// meme motif que le filet D81 voisin. `navigate` vers un ecran DEJA empile
// depile, vers un ecran ABSENT empile ; et il FUSIONNE les parametres au lieu
// de les remplacer. Un `expect(navigate).toHaveBeenCalledWith(...)` est vert
// des deux cotes du correctif : seul l'etat de la pile les separe.
//
// La pile reproduit `PrivateNavigator` : les etapes du tunnel d'inscription et
// `ClubStack` sont des SOEURS d'une meme pile (PrivateNavigator.js:260 et
// 861-897), c'est ce qui rend `navigation.getParent()` significatif.

// Le premier temoin paie le chargement des modules (l'ecran reel « equipes
// entrainees », le vrai theme) : mesure du 2026-08-17, 3,7 s contre 0,3 s pour
// les suivants. Sous 5 s par defaut, il rougit par la marge, pas par la logique.
jest.setTimeout(30000);

/** @type {any[]} */
const mockProprietesEtape = [];
const mockClubCree = { club: { documentId: 'club-neuf' } };
const mockCreerClub = jest.fn(async () => mockClubCree);
const mockActivites = { data: [] };
const mockEquipesDemandees = jest.fn();
const mockRequeteEquipes = jest.fn();

// Le rafraichissement du profil, pilote a la main : c'est le seul moyen de
// prouver qu'on l'ATTEND. `resoudre()` le laisse aboutir.
const mockRafraichissement = {
  /** @type {(() => void) | null} */ resoudre: null,
};
const rafraichirProfil = jest.fn(() => new Promise((resolve) => {
  mockRafraichissement.resoudre = () => resolve({ data: mockAuthentification.userData });
}));
// AA04 — la doublure du cache apprend `setQueriesData` : c'est par la que le
// club fraichement cree entre dans le profil de l'app (le serveur, lui, sert
// `/firebase-auth/me` depuis un cache de 60 s a 4 min qu'il n'invalide pas).
const mockClientRequete = {
  invalidateQueries: jest.fn(async () => undefined),
  setQueriesData: jest.fn(),
};

// Objet FIGE : un contexte neuf a chaque rendu relance les effets qui en
// dependent et fait tourner Jest en boucle infinie, sans message.
const mockEtatTunnel = Object.freeze({
  activityDocumentIds: [],
  addressOption: {
    label: '12 rue du Stade, Lyon', lat: 45.75, lng: 4.85,
  },
  email: 'contact@club.test',
  name: 'Club de la Duchere',
  phoneNumber: '0400000000',
});

// L'ENTRAINEUR D'ADEL, AU MOMENT DU POP-UP : aucun club a lui, et une demande
// d'adhesion `pending` sur le club qu'il a consulte en cherchant.
const mockAuthentification = {
  getNextOnboardingRoute: () => 'UserTrainedTeams',
  getPostOnboardingHomeRoute: () => 'HomeTab',
  refetchUserData: rafraichirProfil,
  userData: /** @type {any} */ (null),
  userDataError: null,
  userDataLoading: false,
};

const profilAvantCreation = () => ({
  clubMembershipRequests: [
    { club: { documentId: 'club-consulte' }, state: 'pending' },
  ],
  documentId: 'coach-1',
  teamMembershipRequests: [],
});

jest.mock('@tanstack/react-query', () => ({
  // `mutate` appelle vraiment `mutationFn` puis `onSuccess` : sans ca, rien ne
  // prouverait l'envoi des demandes d'equipe.
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options.mutationFn(variables))
      .then((data) => options.onSuccess?.(data))
      .catch((error) => options.onError?.(error)),
  }),
  useQueryClient: () => mockClientRequete,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthentification,
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  // Le rattachement est mesure ailleurs (`parcoursNouveauDirigeant`) : ici on
  // garde la VRAIE fonction, pour ne pas rendre ce filet aveugle a une
  // regression de sa signature.
  attachCreatedClubToProfile: jest.requireActual('@/domains/auth/authUseCases')
    .attachCreatedClubToProfile,
  markOnboardingComplete: jest.fn(),
}));

// Le VRAI theme, sans le contexte React qui le porte. Un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/club/clubService', () => ({
  createSelfOnboardClub: (/** @type {any} */ ...arguments_) => mockCreerClub(...arguments_),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => mockActivites,
}));

jest.mock('../ClubWizardContext', () => ({
  useClubWizard: () => ({ dispatch: jest.fn(), state: mockEtatTunnel }),
}));

// Les equipes rendues DEPENDENT du club demande : c'est ce qui rend le mauvais
// club visible a l'ecran plutot que cache dans un appel.
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: (/** @type {any} */ parametres, /** @type {any} */ options) => (
    mockRequeteEquipes(parametres, options)
  ),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  createTeamMembershipRequest: (/** @type {any} */ charge) => (
    mockEquipesDemandees(charge)
  ),
}));

jest.mock('@/components/molecules/wizardOptionCard/WizardOptionCard', () => function CarteMock() {
  return null;
});

// La doublure capture les props et rend `null` : on pilote le tunnel par ses
// boutons (`onNext`, `onBack`), pas par la forme de son arbre.
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function EtapeMock(/** @type {any} */ props) {
    mockProprietesEtape.push(props);
    return null;
  },
);

// Doublures d'affichage de l'etape « equipes entrainees » : un pressable qui
// PORTE son titre, et des conteneurs qui rendent leurs enfants.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => creer(
      PressableRN,
      { accessibilityRole: 'button', disabled, onPress },
      creer(TexteRN, null, title),
    ),
  };
});

jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => creer(VueRN, null, children),
  };
});

jest.mock('@/views/onboarding/components/OnboardingStickyFooter', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => creer(VueRN, null, children),
  };
});

jest.mock('@/views/onboarding/components/OnboardingStateView', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { title }) => creer(TexteRN, null, title),
  };
});

jest.mock('@/views/onboarding/components/OnboardingSkipLink', () => {
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress }) => creer(
      PressableRN,
      { accessibilityRole: 'button', onPress },
      creer(TexteRN, null, 'Passer'),
    ),
  };
});

const EQUIPES_PAR_CLUB = {
  'club-consulte': [{ documentId: 'equipe-A', name: 'Seniors A du club consulte' }],
  'club-neuf': [{ documentId: 'equipe-B', name: 'U15 de mon nouveau club' }],
};

/**
 * Une pile minimale batie sur le routeur reel. Elle rend TOUS ses ecrans, comme
 * une vraie pile : c'est ce qui garde une sous-pile montee quand elle passe au
 * second plan. Motif repris du filet D81.
 * @param {any} props - Les props du navigateur.
 * @returns {any} Le contenu de navigation.
 */
function PileMinimale(props) {
  const { descriptors, NavigationContent, state } = useNavigationBuilder(StackRouter, props);
  return createElement(
    NavigationContent,
    null,
    state.routes.map((/** @type {any} */ route) => descriptors[route.key].render()),
  );
}

const creerPile = createNavigatorFactory(PileMinimale);
const Racine = creerPile();
const Pile = creerPile();

/**
 * Un ecran temoin : il affiche son nom, rien d'autre.
 * @param {string} nom - Le nom de la route.
 * @returns {any} Le composant d'ecran.
 */
const Ecran = (nom) => function EcranTemoin() {
  return createElement(Text, null, nom);
};

/**
 * `ClubStack` : la fiche de club que l'entraineur consulte, puis les 5 etapes
 * du tunnel de creation.
 * @returns {any} La pile de navigation du club.
 */
function PileClub() {
  return createElement(
    Pile.Navigator,
    { id: undefined, initialRouteName: 'ClubList' },
    createElement(Pile.Screen, { component: Ecran('ClubList'), key: 'liste', name: 'ClubList' }),
    createElement(Pile.Screen, { component: Ecran('Club'), key: 'fiche', name: 'Club' }),
    createElement(Pile.Screen, {
      component: Ecran('ClubWizardName'), key: 'e1', name: 'ClubWizardName',
    }),
    createElement(Pile.Screen, {
      component: Ecran('ClubWizardAddress'), key: 'e2', name: 'ClubWizardAddress',
    }),
    createElement(Pile.Screen, {
      component: Ecran('ClubWizardActivities'), key: 'e3', name: 'ClubWizardActivities',
    }),
    createElement(Pile.Screen, {
      component: Ecran('ClubWizardContact'), key: 'e4', name: 'ClubWizardContact',
    }),
    createElement(Pile.Screen, { component: ClubWizardRecap, key: 'e5', name: 'ClubWizardRecap' }),
  );
}

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

/**
 * Le tunnel d'inscription reduit a ce qui compte : l'etape club, l'etape
 * « equipes entrainees », et `ClubStack` — trois SOEURS, comme dans
 * `PrivateNavigator`.
 * @returns {void}
 */
const monterLeTunnelDInscription = () => {
  mockProprietesEtape.length = 0;
  act(() => {
    arbre = renderer.create(createElement(
      NavigationContainer,
      { ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; } },
      createElement(
        Racine.Navigator,
        { id: undefined, initialRouteName: 'UserAffiliationGuide' },
        createElement(Racine.Screen, {
          component: Ecran('UserAffiliationGuide'),
          key: 'club',
          name: 'UserAffiliationGuide',
        }),
        createElement(Racine.Screen, {
          component: UserTrainedTeams, key: 'equipes', name: 'UserTrainedTeams',
        }),
        createElement(Racine.Screen, { component: PileClub, key: 'pile-club', name: 'ClubStack' }),
        createElement(Racine.Screen, {
          component: Ecran('HomeTab'), key: 'accueil', name: 'HomeTab',
        }),
      ),
    ));
  });
};

/**
 * Ce qu'Adel a fait AVANT de creer son club : il a touche la carte d'un club
 * trouve en cherchant, puis il est revenu. C'est le trajet exact de
 * `UserAffiliationGuide.handleSelectResult` pour un entraineur (l.500-507).
 * @returns {void}
 */
const consulterUnClubPuisRevenir = () => {
  act(() => conteneur.navigate('ClubStack', {
    params: { clubId: 'club-consulte', fromOnboardingAffiliation: true },
    screen: 'Club',
  }));
  act(() => conteneur.goBack());
};

/**
 * Entre dans le tunnel de creation par « Je ne trouve pas mon club », comme le
 * fait `UserAffiliationGuide.handleOpenClubWizard` (l.565-570) : les 5 etapes
 * s'empilent, et le recapitulatif recoit `entry: 'onboarding'`.
 * @returns {void}
 */
const entrerDansLeTunnelDeCreation = () => {
  [
    'ClubWizardName', 'ClubWizardAddress', 'ClubWizardActivities',
    'ClubWizardContact', 'ClubWizardRecap',
  ]
    .forEach((etape) => {
      act(() => conteneur.navigate('ClubStack', { screen: etape }));
    });
  // `entry` voyage d'etape en etape (`ClubWizardContact.js:42`) : le
  // recapitulatif le recoit de l'etape precedente, pas de la racine.
  act(() => conteneur.navigate('ClubStack', {
    params: { entry: 'onboarding' },
    screen: 'ClubWizardRecap',
  }));
};

/**
 * Lit la pile racine : c'est elle qui dit ce qui reste sous les pieds.
 * @returns {string[]} Les routes de la pile racine, dans l'ordre.
 */
const pileRacine = () => conteneur.getRootState().routes
  .map((/** @type {any} */ route) => route.name);

/**
 * Lit la sous-pile du club telle que le routeur la connait.
 * @returns {string[]} Les routes de `ClubStack`, ou un tableau vide.
 */
const pileClub = () => {
  const racine = conteneur.getRootState().routes
    .find((/** @type {any} */ route) => route.name === 'ClubStack');
  return racine?.state
    ? racine.state.routes.map((/** @type {any} */ route) => route.name)
    : [];
};

/**
 * Le nom de l'ecran affiche au sommet de la pile racine.
 * @returns {string} Le nom de la route courante.
 */
const ecranCourant = () => {
  const routes = pileRacine();
  return routes[routes.length - 1];
};

/**
 * Relit le dernier rendu de l'etape courante, capture par la doublure.
 * @returns {any} Les dernieres props recues par la mise en page du tunnel.
 */
const dernieresProps = () => mockProprietesEtape[mockProprietesEtape.length - 1];

/**
 * Tous les textes rendus, a plat — le test lit ce que l'utilisateur lit.
 * @returns {string[]} Les chaines affichees.
 */
const textesAffiches = () => /** @type {any} */ (arbre).root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => noeud.props.children)
  .flat()
  .filter((/** @type {any} */ valeur) => typeof valeur === 'string');

/**
 * Appuie sur « Creer mon club », puis sur le « OK » du pop-up de succes — c'est
 * CE bouton qui decide de l'atterrissage.
 * @returns {Promise<void>}
 */
const creerLeClub = async () => {
  await act(async () => { dernieresProps().onNext(); });

  const boutonOk = /** @type {any} */ (Alert.alert).mock.calls
    .map((/** @type {any[]} */ appel) => appel[2])
    .filter(Boolean)
    .flat()
    .find((/** @type {any} */ bouton) => typeof bouton?.onPress === 'function');

  await act(async () => { boutonOk?.onPress(); });
};

/**
 * Laisse le rafraichissement du profil aboutir, et fait rendre le club neuf
 * par le serveur — ce que fait `/clubs/self-onboard` avec `alsoDirector`.
 * @returns {Promise<void>}
 */
const laisserLeProfilSeRafraichir = async () => {
  mockAuthentification.userData = {
    ...profilAvantCreation(),
    clubs: [{ documentId: 'club-neuf' }],
  };
  await act(async () => {
    mockRafraichissement.resoudre?.();
    await Promise.resolve();
  });
};

/** @type {any} */
let alerteEspionnee;

beforeEach(() => {
  jest.clearAllMocks();
  mockCreerClub.mockImplementation(async () => mockClubCree);
  mockRafraichissement.resoudre = null;
  mockAuthentification.userData = profilAvantCreation();
  mockRequeteEquipes.mockImplementation((/** @type {any} */ parametres) => ({
    data: {
      pages: [{
        data: EQUIPES_PAR_CLUB[/** @type {keyof typeof EQUIPES_PAR_CLUB} */ (parametres?.clubId)]
          || [],
      }],
    },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }));
  mockEquipesDemandees.mockResolvedValue({ documentId: 'demande' });
  alerteEspionnee = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  alerteEspionnee.mockRestore();
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('T10 — creer son club pendant l inscription mene a SON club', () => {
  it('apres avoir cree son club, l etape suivante parle DE CE club', async () => {
    monterLeTunnelDInscription();
    consulterUnClubPuisRevenir();
    entrerDansLeTunnelDeCreation();

    await creerLeClub();
    await laisserLeProfilSeRafraichir();

    expect(ecranCourant()).toBe('UserTrainedTeams');
    const clubsInterroges = mockRequeteEquipes.mock.calls
      .map((/** @type {any[]} */ appel) => appel[0]?.clubId);
    expect(clubsInterroges).toContain('club-neuf');
  });

  it('un club seulement CONSULTE ne devient jamais le club courant', async () => {
    monterLeTunnelDInscription();
    consulterUnClubPuisRevenir();
    entrerDansLeTunnelDeCreation();

    await creerLeClub();
    await laisserLeProfilSeRafraichir();

    // L'ecran ne doit JAMAIS proposer les equipes du club consulte.
    expect(textesAffiches()).toContain('U15 de mon nouveau club');
    expect(textesAffiches()).not.toContain('Seniors A du club consulte');
    const clubsInterroges = mockRequeteEquipes.mock.calls
      .map((/** @type {any[]} */ appel) => appel[0]?.clubId);
    expect(clubsInterroges).not.toContain('club-consulte');
  });

  it('l etape suivante sait quel est le club, elle ne reste pas muette', async () => {
    monterLeTunnelDInscription();
    entrerDansLeTunnelDeCreation();

    await creerLeClub();
    await laisserLeProfilSeRafraichir();

    // `useGetTeams` est branche sur `enabled: !!clubId` : un club inconnu
    // n'interroge RIEN et l'ecran annonce « aucune equipe » a tort.
    const derniereRequete = mockRequeteEquipes.mock.calls[
      mockRequeteEquipes.mock.calls.length - 1
    ];
    expect(derniereRequete?.[0]?.clubId).toBe('club-neuf');
    expect(derniereRequete?.[1]?.enabled).toBe(true);
  });

  it('le retour depuis l etape suivante ne ramene pas dans le tunnel de creation', async () => {
    monterLeTunnelDInscription();
    entrerDansLeTunnelDeCreation();
    expect(pileClub()).toContain('ClubWizardRecap');

    await creerLeClub();
    await laisserLeProfilSeRafraichir();

    // Les 5 etapes ne doivent plus etre sous les pieds : sinon un seul
    // « Retour » repose le doigt sur « Creer mon club » (motif D81).
    expect(pileClub().some((nom) => nom.startsWith('ClubWizard'))).toBe(false);

    act(() => conteneur.goBack());
    expect(ecranCourant()).not.toBe('UserTrainedTeams');
    expect(pileClub().some((nom) => nom.startsWith('ClubWizard'))).toBe(false);
  });

  it('la navigation ATTEND le rafraichissement du profil, elle ne part pas avant', async () => {
    monterLeTunnelDInscription();
    entrerDansLeTunnelDeCreation();

    await creerLeClub();

    // Le profil n'a pas encore repondu : on est toujours dans le tunnel.
    expect(ecranCourant()).toBe('ClubStack');

    await laisserLeProfilSeRafraichir();

    expect(ecranCourant()).toBe('UserTrainedTeams');
  });
});
