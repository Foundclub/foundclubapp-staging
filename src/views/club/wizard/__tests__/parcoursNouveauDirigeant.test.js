import { QueryClient } from '@tanstack/react-query';
import { createElement } from 'react';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { navigateToSearchHub } from '@/views/search/searchRouteHelpers';
import { TeamWizardProvider } from '@/views/team/wizard/TeamWizardContext';
import TeamWizardName from '@/views/team/wizard/TeamWizardName';

import ClubWizardRecap from '../ClubWizardRecap';

// 🥇 LE TEMOIN DU LOT AA04 (E6) — LE PARCOURS ENTIER D'UN ENTRAINEUR NEUF,
// mis bout a bout comme Adel l'a vecu le 2026-08-20 :
//
//   je m'inscris comme entraineur -> je cherche un club -> je cree mon club
//   -> ON NE M'Y RATTACHE PAS -> je clique « creer mon equipe »
//   -> ON ME RENVOIE CHERCHER UN CLUB.
//
// 🧨 CE QUE CE FILET MESURE, ET QU'AUCUNE PORTE NE VOYAIT : le serveur affilie
// bel et bien le createur (`admin/src/api/club/services/club-self-onboard.ts`,
// etape 2b, `user.club` + `ensureUserClubAffiliation`). Ce qui manquait, c'est
// que l'APP le sache : `/firebase-auth/me` est servi depuis un cache serveur
// (60 s de fraicheur, 4 min de sursis) que la creation de club N'INVALIDE PAS.
// Le profil relu juste apres la creation est donc, mot pour mot, celui d'AVANT.
//
// On monte donc les DEUX bouts du parcours dans le meme fichier, avec le VRAI
// cache de requetes : ce qui sort de l'ecran 1 est exactement ce qui entre dans
// l'ecran 2. C'est la couture entre les deux qui cassait, pas les ecrans.

/** Le VRAI cache de l'app : c'est lui qui porte le profil d'un ecran a l'autre. */
const mockCacheRequetes = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

/** La cle exacte de `useAuth` : `['get-me', <jeton>]`. */
const CLE_PROFIL = ['get-me', 'jeton-de-session'];

/**
 * Le profil que le serveur rend — perime — juste apres la creation du club.
 * @returns {any} Le profil d'un entraineur sans club.
 */
const profilPerime = () => ({
  clubAffiliations: [],
  clubMembershipRequests: [],
  clubs: [],
  documentId: 'moi',
  myTeams: [],
  role: { name: 'Entraineur', type: 'coach' },
  trainedTeams: [],
});

const clubCree = { documentId: 'club-neuf', name: 'FC de la Duchere' };

/** Proprietes recues par le gabarit d'etape, dans l'ordre du rendu. */
const mockGabarits = /** @type {any[]} */ ([]);
/** Le compte connecte, tel que `useAuth` le rend. Boite FIGEE, contenu remplace. */
const mockCompte = { profil: /** @type {any} */ (profilPerime()) };
/** Le club rendu par `useGetClub` a l'etape equipe. */
const mockClubRecu = { valeur: /** @type {any} */ (null) };

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

// Le VRAI theme, sans le contexte React qui le porte. ⛔ Jamais un Proxy.
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
      Images: { arrowLeft: 1, close: 1 },
      Spaces: espaces,
    }),
  };
});

// ⚠️ `useAuth` est double, `authUseCases` NE L'EST PAS : c'est le vrai juge
// (`resolveMyClubDocumentId`, `attachCreatedClubToProfile`) qu'on mesure.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    getNextOnboardingRoute: () => null,
    getPostOnboardingHomeRoute: () => 'HomeTab',
    // Le refetch RELIT le cache serveur : il rend le profil perime, pas le bon.
    refetchUserData: async () => mockCompte.profil,
    get userData() { return mockCompte.profil; },
  }),
}));

jest.mock('@tanstack/react-query', () => {
  const reel = jest.requireActual('@tanstack/react-query');
  return {
    ...reel,
    useMutation: (/** @type {any} */ options) => ({
      isPending: false,
      mutate: (/** @type {any} */ variables) => options?.mutationFn?.(variables),
      variables: undefined,
    }),
    useQueryClient: () => mockCacheRequetes,
  };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/club/clubService', () => ({
  createSelfOnboardClub: jest.fn(async () => ({
    club: { documentId: 'club-neuf', name: 'FC de la Duchere' },
    clubRequestDocumentId: 'demande-1',
    duplicate: false,
  })),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => ({
    data: mockClubRecu.valeur,
    error: null,
    isFetched: true,
    isLoading: false,
  }),
}));

jest.mock('@/services/team/teamService', () => ({
  claimTeamAsCoach: jest.fn(async () => ({})),
}));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
  emitGuidanceInteraction: jest.fn(),
}));

jest.mock('@/views/search/searchRouteHelpers', () => ({
  navigateToSearchHub: jest.fn(),
}));

jest.mock('@/context/AppModeContext', () => {
  const modeFige = { isGold: false };
  return { useAppMode: () => modeFige };
});

// Objet FIGE hors de la fabrique : un contexte neuf a chaque rendu relance les
// effets qui en dependent et fait tourner Jest en boucle infinie, sans message.
const mockEtatTunnelClub = Object.freeze({
  activityDocumentIds: [],
  addressOption: { label: '12 rue du Stade, Lyon', lat: 45.75, lng: 4.85 },
  email: 'contact@club.test',
  name: 'FC de la Duchere',
  phoneNumber: '0400000000',
});

jest.mock('../ClubWizardContext', () => ({
  useClubWizard: () => ({ dispatch: jest.fn(), state: mockEtatTunnelClub }),
}));

jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => function GabaritMock(
  /** @type {any} */ props,
) {
  mockGabarits.push(props);
  return props.children || null;
});

jest.mock('@/components/molecules/wizardOptionCard/WizardOptionCard', () => function CarteMock() {
  return null;
});

jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  return {
    __esModule: true,
    default: reactActuel.forwardRef((/** @type {any} */ _props, /** @type {any} */ ref) => {
      reactActuel.useImperativeHandle(ref, () => ({ focus: () => {} }));
      return null;
    }),
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function PopUpMock(
  /** @type {any} */ props,
) {
  return props.isVisible ? props.children : null;
});

jest.mock(
  '@/components/molecules/subscriptionQuotaBanner/SubscriptionQuotaBanner',
  () => () => null,
);
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

/**
 * Tous les textes rendus sous un noeud de l'arbre de test.
 * @param {any} noeud - Noeud de depart.
 * @returns {string[]} Les textes, dans l'ordre du rendu.
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

/** @type {any} */
let arbre = null;
/** @type {any} */
let alerteEspionnee = null;

/**
 * Le dernier rendu du gabarit d'etape, capture par la doublure.
 * @returns {any} Les dernieres props recues.
 */
const derniereEtape = () => mockGabarits[mockGabarits.length - 1];

/**
 * ETAPE A — l'entraineur cree son club, et le serveur lui rend un profil perime.
 * @returns {Promise<void>}
 */
const creerMonClub = async () => {
  await act(async () => {
    arbre = renderer.create(createElement(ClubWizardRecap, {
      navigation: { getParent: () => undefined, navigate: jest.fn(), reset: jest.fn() },
      route: { params: { entry: 'search' } },
    }));
  });

  await act(async () => { derniereEtape().onNext(); });

  const boutonOk = /** @type {any} */ (Alert.alert).mock.calls
    .map((/** @type {any[]} */ appel) => appel[2])
    .filter(Boolean)
    .flat()
    .find((/** @type {any} */ bouton) => typeof bouton?.onPress === 'function');
  await act(async () => { await boutonOk?.onPress(); });

  act(() => arbre.unmount());
  arbre = null;
};

/**
 * ETAPE B — il clique « creer mon equipe ». L'ecran n'a AUCUN club en
 * parametre : c'est le profil, et lui seul, qui doit repondre.
 * @returns {Promise<void>}
 */
const creerMonEquipe = async () => {
  await act(async () => {
    arbre = renderer.create(createElement(
      TeamWizardProvider,
      null,
      createElement(TeamWizardName, {
        navigation: { getParent: () => undefined, navigate: jest.fn() },
        route: { params: {} },
      }),
    ));
  });
};

describe('🥇 AA04 — un entraineur neuf va de l inscription a sa premiere equipe', () => {
  beforeEach(() => {
    mockGabarits.length = 0;
    mockCompte.profil = profilPerime();
    mockClubRecu.valeur = null;
    mockCacheRequetes.clear();
    mockCacheRequetes.setQueryData(CLE_PROFIL, profilPerime());
    /** @type {any} */ (navigateToSearchHub).mockClear();
    alerteEspionnee = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    alerteEspionnee.mockRestore();
    if (arbre) act(() => arbre.unmount());
    arbre = null;
  });

  it('le parcours entier passe : club cree -> rattache -> equipe POUR ce club', async () => {
    await creerMonClub();

    // ② Le profil de l'app connait le club, sans que personne n'ait eu a dire
    //    « je fais partie de ce club ».
    const profilApres = /** @type {any} */ (mockCacheRequetes.getQueryData(CLE_PROFIL));
    expect(profilApres.club.documentId).toBe('club-neuf');

    // ③ Et l'etape « creer mon equipe » s'ouvre POUR ce club.
    mockCompte.profil = profilApres;
    mockClubRecu.valeur = clubCree;
    await creerMonEquipe();

    // Le gabarit d'etape porte le titre : c'est LUI qui dit si on est sur
    // l'aiguillage « pas de club » ou sur la vraie premiere etape du tunnel.
    expect(derniereEtape().title).toBe("Nom de l'équipe");
    expect(derniereEtape().stepCount).toBe(8);
    // Et le club est nomme a l'ecran : l'equipe se cree POUR CE club.
    expect(textesSous(arbre.toJSON())).toContain('FC de la Duchere');
    expect(navigateToSearchHub).not.toHaveBeenCalled();
  });

  it('sans le rattachement, « creer mon equipe » renvoie chercher un club', async () => {
    // L'etat d'AVANT, reproduit tel quel : le profil ne connait pas le club.
    mockCompte.profil = profilPerime();
    await creerMonEquipe();

    expect(derniereEtape().title).toBe("Il te faut d'abord un club");
    expect(textesSous(arbre.toJSON())).toContain('Rechercher mon club');

    // Et le bouton de cet ecran renvoie bien a la recherche : c'est la boucle.
    const boutonRecherche = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'button',
    )[0];
    act(() => { boutonRecherche.props.onPress(); });
    expect(navigateToSearchHub).toHaveBeenCalled();
  });

  it('le club cree n ecrase jamais un rattachement deja en place', async () => {
    mockCacheRequetes.setQueryData(CLE_PROFIL, {
      ...profilPerime(),
      club: { documentId: 'club-a-moi', name: 'Mon club de toujours' },
    });

    await creerMonClub();

    const profilApres = /** @type {any} */ (mockCacheRequetes.getQueryData(CLE_PROFIL));
    expect(profilApres.club.documentId).toBe('club-a-moi');
  });
});
