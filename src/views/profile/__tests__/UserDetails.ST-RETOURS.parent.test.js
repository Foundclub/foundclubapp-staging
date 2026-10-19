import { CommonActions, StackActions, StackRouter } from '@react-navigation/routers';
import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import UserDetails from '../UserDetails';

// Le premier rendu charge l ecran entier : sous charge (les portes admin en parallele), il
// depasse les 5 s par defaut. Meme reglage que 93 temoins du depot.
jest.setTimeout(30000);

// ST-RETOURS (02/10) — PLANCHE 22 DU DESIGN VALIDE : LA FICHE DE L ENFANT, VUE PAR SON PARENT.
//
// Le parent declare d un MINEUR (lot PARENT-RETOURS) trouve sur la fiche de son enfant le
// DERNIER retour de l entraineur (plus un lien seul qui cachait ce qu il venait chercher),
// « Nouveau » tant qu il ne l a pas vu, « Tous ses retours · n », l alerte qu il peut couper,
// et la phrase qui dit ce qu il lit et ce qu il ne lit pas. Sans retour, la fiche dit quand ils
// viendront.
//
// Le VRAI ecran de la route (`UserDetails`) est monte ; seuls les services sont doubles.

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockFetchedUser;
/** @type {any} */
let mockStatsQuery;
/** @type {any} */
let mockFollow;
const mockMarquerLu = jest.fn();
const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockRelire = jest.fn();

// PAR-L7 (13/10) — « Mon profil » porte le bloc « Mes enfants » (`useMesEnfantsEnBref`, qui lit
// trois services) : doublure commune, « aucun enfant » par defaut.
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');

jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: jest.fn() }),
  useGetMyBlockedUsers: () => ({ data: [], refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: jest.fn() }),
}));

jest.mock('@/services/coachFeedback/coachFeedbackQueries', () => ({
  useGetCoachFeedbackFollow: () => ({ data: mockFollow, isSuccess: mockFollow !== undefined }),
  useUpdateCoachFeedbackFollow: () => ({ mutate: mockMarquerLu }),
}));

// Les vrais textes de fr.js, avec les {{jetons}} et le pluriel, comme dans l app.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ cle) => String(cle || '').split('.').reduce(
    (/** @type {any} */ noeud, /** @type {string} */ part) => (
      noeud && typeof noeud === 'object' ? noeud[part] : undefined
    ),
    traductions,
  );
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ a, /** @type {any} */ b) => {
        const options = (a && typeof a === 'object') ? a : (b || {});
        const repli = typeof a === 'string' ? a : options.defaultValue;
        let valeur = typeof options.count === 'number'
          ? lire(`${cle}_${options.count === 1 ? 'one' : 'other'}`)
          : undefined;
        if (typeof valeur !== 'string') valeur = lire(cle);
        if (typeof valeur !== 'string') valeur = typeof repli === 'string' ? repli : cle;
        return valeur.replace(/{{\s*(\w+)\s*}}/g, (_m, nom) => (
          options[nom] === undefined ? '' : String(options[nom])
        ));
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuthValue }));
jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({
    getClubInitials: (/** @type {string} */ nom) => String(nom || '').slice(0, 2),
  }),
}));
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startGroupChat: jest.fn(), startWhisperChat: jest.fn() }),
}));
jest.mock('@/services/auth/authQueries', () => ({
  useGetUserById: () => ({
    data: mockFetchedUser,
    error: undefined,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));
jest.mock('@/services/license/licenseQueries', () => ({
  useUserCurrentLicense: () => ({ data: undefined, refetch: jest.fn() }),
}));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: () => mockStatsQuery,
}));
jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ refetch: jest.fn() }),
  useGetUserHistories: () => ({ refetch: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/views/profile/SelfProfileUnified', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>ECRAN PROFIL UNIFIE</TexteRN> };
});
jest.mock('@/views/profile/SelfProfilePlayerCoach', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>ECRAN PROFIL JOUEUR</TexteRN> };
});
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  const fige = {
    Alignments: jest.requireActual('@/theme/alignements').default,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: new Proxy({}, { get: () => 1 }),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => fige };
});
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});
jest.mock('@/components/organisms/userHistorySection/UserHistorySection', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>SECTION HISTORIQUE</TexteRN> };
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>BLASON</TexteRN> };
});
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <Pressable onPress={onPress}><TexteRN>{title}</TexteRN></Pressable>
    ),
  };
});

/**
 * Le texte d un noeud et de ses enfants, mis bout a bout.
 * @param {any} enfants
 * @returns {string}
 */
const aplatir = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
/**
 * Tout le texte visible de l arbre rendu.
 * @param {any} arbre
 * @returns {string}
 */
const texte = (arbre) => arbre.root.findAllByType(Text)
  .map((n) => aplatir(n.props.children))
  .join(' | ');
/**
 * Le bouton dont le texte vaut exactement ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const appuyable = (arbre, libelle) => arbre.root.findAllByType(TouchableOpacity)
  .find((n) => n.findAllByType(Text).some((t) => aplatir(t.props.children).trim() === libelle));

/** @type {any[]} */
const montes = [];
/**
 * Monte l ecran de la route pour ce compte, avec ces parametres.
 * @param {any} moi
 * @param {any} parametres
 * @param {any} [navigation] La navigation donnee a l ecran (par defaut : des doublures).
 * @returns {Promise<any>}
 */
const rendre = async (
  moi,
  parametres,
  navigation = { goBack: jest.fn(), navigate: mockNavigate, push: mockPush },
) => {
  mockAuthValue = {
    refetchUserData: jest.fn(),
    USER_ROLES: {
      coach: 'Entraineur',
      new: 'Authenticated',
      player: 'Joueur',
      president: 'Dirigeant',
      superAdmin: 'SuperAdmin',
    },
    userData: moi,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <UserDetails
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: parametres })}
      />,
    );
  });
  montes.push(arbre);
  return arbre;
};

const HUGO = {
  documentId: 'hugo',
  firstname: 'Hugo',
  lastname: 'Lemaire',
  myTeams: [{ documentId: 'u15', name: 'U15' }],
  parentAccount: { documentId: 'papa' },
  role: { name: 'Joueur' },
  trainedTeams: [],
};
const PAPA = {
  documentId: 'papa',
  firstname: 'Papa',
  lastname: 'Test',
  role: { name: 'Parent' },
};

// Le vrai retour de Karim a Hugo (planche 19, etat 1) ; midi UTC : le jour ne bascule pas.
const RETOUR_KARIM = {
  authorFirstname: 'Karim',
  comment: 'Bon pressing, mais replacement trop lent sur les transitions. À revoir en vidéo.',
  feedbackKey: 'event:m1:u15:v1',
  matchDate: '2026-09-05T12:00:00.000Z',
  matchLabel: 'AS Montrivage — Test-COMPO',
  publishedAt: '2026-10-01T20:35:00.000Z',
  rating: 7,
  result: 'win',
  scoreAgainst: 1,
  scoreFor: 2,
  sourceDocumentId: 'm1',
  sourceType: 'event',
  submittedAt: '2026-10-01T20:35:00.000Z',
  teamDocumentId: 'u15',
  teamName: 'U15',
};
const RETOUR_SANS_NOTE = {
  ...RETOUR_KARIM,
  comment: 'Plus d’appels en profondeur : tu les as.',
  feedbackKey: 'event:m0:u15:v1',
  matchDate: '2026-08-29T12:00:00.000Z',
  matchLabel: 'Montrivage FC — AS Valfleuri',
  rating: null,
  result: 'draw',
  scoreAgainst: 2,
  scoreFor: 2,
  sourceDocumentId: 'm0',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchedUser = undefined;
  mockFollow = {};
  mockStatsQuery = {
    data: { recentCoachFeedback: [RETOUR_KARIM, RETOUR_SANS_NOTE] },
    error: null,
    isLoading: false,
    refetch: mockRelire,
  };
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

const FICHE_DE_HUGO = { userId: 'hugo' };
const HUGO_VU_PAR_PAPA = { ...HUGO, age: 14 };

/**
 * L interrupteur « Être prévenu·e d un nouveau retour ».
 * @param {any} arbre
 * @returns {any}
 */
const interrupteur = (arbre) => arbre.root.findAll((n) => (
  typeof n.type !== 'string' && n.props.accessibilityRole === 'switch'
  && typeof n.props.onValueChange === 'function'
))[0];

describe('ST-RETOURS · planche 22 — la fiche de l enfant, vue par son parent', () => {
  beforeEach(() => {
    mockFetchedUser = HUGO_VU_PAR_PAPA;
  });

  it('etat 2 — 🔴 le dernier retour SUR la fiche, et « Tous ses retours · 2 »', async () => {
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);
    const t = texte(arbre);

    expect(t).toContain('Dernier retour de son entraîneur');
    expect(t).toContain('AS Montrivage — Test-COMPO · sam. 5 sept. · victoire 2 - 1 · Karim');
    expect(t).toContain('7/10');
    expect(t).toContain(RETOUR_KARIM.comment);
    expect(t).toContain('Mon enfant');
    expect(t).not.toContain('Voir les retours du coach');

    await act(async () => {
      appuyable(arbre, 'Tous ses retours · 2').props.onPress();
    });
    // FINITIONS12-STATS (2) : la vue est EMPILEE (`push`) ; `navigate` remplacait la fiche.
    expect(mockPush).toHaveBeenCalledWith(RouteNames.UserDetails, {
      userId: 'hugo',
      view: 'coachFeedback',
    });
  });

  // STATS-FIX2 · point 7 : CE retour-la (le seul affiche) est marque lu — en QUITTANT la fiche.
  it('etat 2 — « Nouveau » sur le dernier retour pas lu, puis CE retour-la marque lu', async () => {
    mockFollow = {};
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);

    expect(texte(arbre)).toContain('Nouveau');
    act(() => {
      arbre.unmount();
    });
    montes.splice(montes.indexOf(arbre), 1);
    expect(mockMarquerLu).toHaveBeenCalledWith({
      playerDocumentId: 'hugo',
      seenKeys: ['event:m1:u15:v1'],
    });
  });

  it('etat 2 — deja lu : pas de pastille, rien n est reecrit', async () => {
    mockFollow = { hugo: { seen: ['event:m1:u15:v1'] } };
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);

    expect(texte(arbre)).not.toContain('Nouveau');
    act(() => {
      arbre.unmount();
    });
    montes.splice(montes.indexOf(arbre), 1);
    expect(mockMarquerLu).not.toHaveBeenCalled();
  });

  it('etat 2 — l alerte, allumee par defaut, se coupe d un geste', async () => {
    mockFollow = { hugo: { seen: ['event:m1:u15:v1'] } };
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);

    expect(texte(arbre)).toContain('Être prévenu·e d’un nouveau retour');
    expect(interrupteur(arbre).props.value).toBe(true);
    await act(async () => {
      interrupteur(arbre).props.onValueChange(false);
    });
    expect(mockMarquerLu).toHaveBeenCalledWith(
      { notify: false, playerDocumentId: 'hugo' },
      expect.anything(),
    );
    expect(interrupteur(arbre).props.value).toBe(false);
  });

  it('etat 2 — l alerte deja coupee se lit coupee', async () => {
    mockFollow = { hugo: { notify: false, seen: [] } };
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);
    expect(interrupteur(arbre).props.value).toBe(false);
  });

  it('etat 2 — la phrase : ses retours, jamais ses messages ni ses propres notes', async () => {
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);
    expect(texte(arbre))
      .toContain('Tu lis les retours de son entraîneur. Jamais ses messages, ni ses propres');
  });

  it('etat 4 — pas encore de retour : la fiche dit ce que le parent verra, et quand', async () => {
    mockStatsQuery = { ...mockStatsQuery, data: { recentCoachFeedback: [] } };
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);
    const t = texte(arbre);

    expect(t).toContain('Retours de son entraîneur');
    expect(t).toContain('Pas encore de retour. Après un match, son entraîneur peut lui écrire');
    expect(t).toContain('tu les liras ici.');
    expect(t).not.toContain('Tous ses retours');
  });

  it('PROTEGE : un AUTRE adulte ne voit ni le retour, ni l alerte', async () => {
    mockFetchedUser = { ...HUGO_VU_PAR_PAPA, parentAccount: { documentId: 'un-autre' } };
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);

    expect(texte(arbre)).not.toContain('Dernier retour de son entraîneur');
    expect(interrupteur(arbre)).toBeUndefined();
    expect(mockMarquerLu).not.toHaveBeenCalled();
  });
});

// STATS-FIX2 · POINT 7 (tournee T10, « Autres ») — LA FICHE DE L ENFANT N ECRIT PLUS RIEN A
// L OUVERTURE : `PUT …/coach-feedback-follow` partait seul (18:49 chez Papa Test). Le dernier
// retour, affiche sur la fiche, est marque lu en QUITTANT l ecran. Et « Nouveau » se fige a la
// premiere lecture pour toute la visite : la fiche PUIS « Tous ses retours » (le MEME ecran,
// d autres parametres) — la T10 n y voyait plus « Nouveau » (ecran 22).
describe('STATS-FIX2 · point 7 — la fiche de l enfant ne marque « lu » qu en la quittant', () => {
  beforeEach(() => {
    mockFetchedUser = HUGO_VU_PAR_PAPA;
    mockFollow = {};
    // La vraie mutation range la reponse dans le cache (`setQueryData`) : la lecture suivante
    // la voit. La doublure fait pareil.
    mockMarquerLu.mockImplementation((/** @type {any} */ envoi) => {
      if (!envoi?.seenKeys) return;
      const avant = mockFollow?.[envoi.playerDocumentId]?.seen || [];
      mockFollow = {
        ...mockFollow,
        [envoi.playerDocumentId]: { seen: [...avant, ...envoi.seenKeys] },
      };
    });
  });

  afterEach(() => {
    mockMarquerLu.mockImplementation(() => {});
  });

  it('🔴 ouvrir la fiche de l enfant n ecrit RIEN', async () => {
    await rendre(PAPA, FICHE_DE_HUGO);

    expect(mockMarquerLu).not.toHaveBeenCalled();
  });

  it('🔴 la fiche, puis « Tous ses retours » : le dernier retour y garde « Nouveau »', async () => {
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);
    await act(async () => {
      arbre.update(
        <UserDetails
          navigation={arbre.root.props.navigation}
          route={/** @type {any} */ ({ params: { userId: 'hugo', view: 'coachFeedback' } })}
        />,
      );
    });

    const carteDuDernier = arbre.root.findAll((/** @type {any} */ n) => (
      n.props.testID === 'coach-feedback-card' && typeof n.type !== 'string'
    )).find((/** @type {any} */ carte) => carte.findAllByType(Text).some((/** @type {any} */ x) => (
      aplatir(x.props.children) === RETOUR_KARIM.matchLabel
    )));
    expect(carteDuDernier).toBeDefined();
    expect(carteDuDernier.findAllByType(Text).some((/** @type {any} */ x) => (
      aplatir(x.props.children) === 'Nouveau'
    ))).toBe(true);
  });
});

// STATS-FIX2 · 8-22 (tournee T10, ecran 22) — LA FICHE DE SON ENFANT, VUE PAR LE PARENT :
// l en-tete disait « INFOS PROFIL · JOUEUR » (planche 22 : le prenom de l enfant, et « Mon
// enfant ») ; « Bloquer cette personne » s offrait sur la fiche de son propre enfant.
describe('STATS-FIX2 · 8-22 — l en-tete et le pied de la fiche de son enfant', () => {
  beforeEach(() => {
    mockFetchedUser = HUGO_VU_PAR_PAPA;
    mockFollow = { hugo: { seen: ['event:m1:u15:v1', 'event:m0:u15:v1'] } };
  });

  it('🔴 l en-tete : le prenom de l enfant, plus « INFOS PROFIL · JOUEUR »', async () => {
    const t = texte(await rendre(PAPA, FICHE_DE_HUGO));

    expect(t).toContain('HUGO');
    expect(t).not.toContain('INFOS PROFIL');
    expect(t).not.toContain('JOUEUR');
    expect(t).toContain('Mon enfant');
  });

  it('🔴 pas de « Bloquer cette personne » sur la fiche de son propre enfant', async () => {
    const t = texte(await rendre(PAPA, FICHE_DE_HUGO));

    expect(t).not.toContain('Bloquer cette personne');
  });

  it('🔒 un AUTRE adulte garde l en-tete et « Bloquer »', async () => {
    mockFetchedUser = { ...HUGO_VU_PAR_PAPA, parentAccount: { documentId: 'un-autre' } };
    const t = texte(await rendre(PAPA, FICHE_DE_HUGO));

    expect(t).toContain('INFOS PROFIL');
    expect(t).toContain('Bloquer cette personne');
  });
});

// STATS-FIX2 · POINT 1 (tournee T10, « Protections » P4) — LA PORTE DU MATCH, POUR LE PARENT.
//
// Adel a decide « parents encart B » (registre des mineurs, ligne 15) : le parent lit l encart du
// score du match de son enfant. DECISIONS-SOIR l a construit DANS la fiche du match, mais aucun
// chemin n y menait : le parent ne lisait « victoire 2 - 1 » que dans la carte du retour.
// La porte la plus courte : « Ouvrir le match » sur le retour du coach, la ou le parent le lit deja
// (fiche de l enfant, « Tous ses retours »). Elle ouvre la fiche du match, et RIEN de plus : ce que
// cette fiche montre a un parent, le serveur le decide (EventDetailsN3CarteMatch, DECISIONS-SOIR).
describe('STATS-FIX2 · point 1 — le parent ouvre le match depuis le retour du coach', () => {
  beforeEach(() => {
    mockFetchedUser = HUGO_VU_PAR_PAPA;
    mockFollow = { hugo: { seen: ['event:m1:u15:v1', 'event:m0:u15:v1'] } };
  });

  /**
   * Les « Ouvrir le match » de l ecran.
   * @param {any} arbre
   * @returns {any[]}
   */
  const portesDuMatch = (arbre) => arbre.root.findAllByType(TouchableOpacity)
    .filter((n) => n.findAllByType(Text)
      .some((t) => aplatir(t.props.children).trim() === 'Ouvrir le match'));
  /**
   * La fiche du match, sans « focusSection » : le bloc « Mon retour coach » est celui du joueur.
   * @param {string} eventId
   * @returns {any[]}
   */
  const versLaFicheDuMatch = (eventId) => [RouteNames.EventStack, {
    params: { eventId },
    screen: RouteNames.EventDetails,
  }];

  it('🔴 la fiche de l enfant : « Ouvrir le match » sous le dernier retour', async () => {
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);

    expect(portesDuMatch(arbre)).toHaveLength(1);
    await act(async () => {
      portesDuMatch(arbre)[0].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(...versLaFicheDuMatch('m1'));
  });

  it('🔴 « Tous ses retours » : chaque retour d un match porte « Ouvrir le match »', async () => {
    const arbre = await rendre(PAPA, { userId: 'hugo', view: 'coachFeedback' });

    expect(portesDuMatch(arbre)).toHaveLength(2);
    await act(async () => {
      portesDuMatch(arbre)[1].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(...versLaFicheDuMatch('m0'));
  });

  it('🔒 un retour d un match de League : pas de porte pour le parent', async () => {
    mockStatsQuery = {
      ...mockStatsQuery,
      data: { recentCoachFeedback: [{ ...RETOUR_KARIM, sourceType: 'league_match' }] },
    };

    expect(portesDuMatch(await rendre(PAPA, FICHE_DE_HUGO))).toHaveLength(0);
    const vue = await rendre(PAPA, { userId: 'hugo', view: 'coachFeedback' });
    expect(portesDuMatch(vue)).toHaveLength(0);
  });

  it('🔒 un AUTRE adulte : aucune porte', async () => {
    mockFetchedUser = { ...HUGO_VU_PAR_PAPA, parentAccount: { documentId: 'un-autre' } };

    expect(portesDuMatch(await rendre(PAPA, FICHE_DE_HUGO))).toHaveLength(0);
  });
});

// ST-RETOURS2 · POINT 3 (planche 22, etat 2) — L EN-TETE DE LA FICHE DE SON ENFANT, CENTRE.
//
// La planche : sous le titre « Hugo », une carte CENTREE — l avatar, « Hugo Lemaire », la ligne
// « 14 ans · U15 · AS Montrivage », et « Mon enfant ». L ecran gardait la carte de tout profil
// (avatar a gauche, blason et nom du club a droite), avec « Mon enfant » colle a gauche dessous.
// Tout autre lecteur garde la carte d origine.
describe('ST-RETOURS2 · point 3 — l en-tete centre de la fiche de son enfant', () => {
  const HUGO_ET_SON_CLUB = {
    ...HUGO_VU_PAR_PAPA,
    club: { documentId: 'asm', name: 'AS Montrivage' },
  };

  /**
   * Le style a plat d un noeud (les tableaux de styles du theme fusionnes).
   * @param {any} style
   * @returns {any}
   */
  const styleAPlat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

  /**
   * La carte d identite de l enfant, ou rien.
   * @param {any} arbre
   * @returns {any}
   */
  const carteDIdentite = (arbre) => arbre.root
    .findAll((n) => typeof n.type === 'string' && n.props.testID === 'parent-child-identity')[0];

  /**
   * Le haut de la fiche : tout ce qui precede l historique (la section « Equipes », plus bas,
   * porte aussi un blason par equipe).
   * @param {string} t
   * @returns {string}
   */
  const enTete = (t) => t.slice(0, t.indexOf('SECTION HISTORIQUE'));

  beforeEach(() => {
    mockFetchedUser = HUGO_ET_SON_CLUB;
    mockFollow = { hugo: { seen: ['event:m1:u15:v1', 'event:m0:u15:v1'] } };
  });

  it('🔴 une carte CENTREE : avatar, nom, « 14 ans · U15 · AS Montrivage », tag', async () => {
    const carte = carteDIdentite(await rendre(PAPA, FICHE_DE_HUGO));

    expect(carte).toBeDefined();
    expect(styleAPlat(carte.props.style).alignItems).toBe('center');
    const lignes = carte.findAllByType(Text).map((n) => aplatir(n.props.children));
    expect(lignes).toEqual([
      'AVATAR:Hugo Lemaire',
      'Hugo Lemaire',
      '14 ans · U15 · AS Montrivage',
      'Mon enfant',
    ]);
  });

  // FINITIONS13-STATS · point 3 (T13, tranche par le chef « A ») — la fiche de Hugo disait
  // « 14 ans · U13 » (sa PREMIERE equipe) alors qu il joue aussi en U15 : elle les dit toutes.
  it('🔴 FIN13-STATS 3 — deux equipes : « 14 ans · U13 · U15 · AS Montrivage »', async () => {
    mockFetchedUser = {
      ...HUGO_ET_SON_CLUB,
      myTeams: [{ documentId: 'u13', name: 'U13' }, { documentId: 'u15', name: 'U15' }],
    };
    const carte = carteDIdentite(await rendre(PAPA, FICHE_DE_HUGO));

    const lignes = carte.findAllByType(Text).map((n) => aplatir(n.props.children));
    expect(lignes).toContain('14 ans · U13 · U15 · AS Montrivage');
  });

  it('🔴 « Mon enfant » ne vit plus qu une fois, DANS la carte centree', async () => {
    const t = texte(await rendre(PAPA, FICHE_DE_HUGO));

    expect(t.split('Mon enfant').length - 1).toBe(1);
    expect(enTete(t)).not.toContain('BLASON');
  });

  it('🔒 un AUTRE adulte garde la carte d origine (blason, pas de « Mon enfant »)', async () => {
    mockFetchedUser = { ...HUGO_ET_SON_CLUB, parentAccount: { documentId: 'un-autre' } };
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);

    expect(carteDIdentite(arbre)).toBeUndefined();
    expect(enTete(texte(arbre))).toContain('BLASON');
    expect(texte(arbre)).not.toContain('Mon enfant');
  });
});

// FINITIONS12-STATS · POINT 2 (tournee T11) — chez Papa Test : Mes enfants › Hugo › Tous ses
// retours, puis Retour ⇒ on arrivait a « Mes enfants » au lieu de la fiche de Hugo. La cause,
// lue dans le VRAI routeur (`@react-navigation/routers` 7.5, StackRouter, cas 'NAVIGATE') :
// `navigate` vers l ecran deja affiche (« If the route matches the current one, then navigate
// to it ») REMPLACE ses parametres au lieu d empiler une page. La fiche devenait la vue des
// retours ; Retour depilait donc la seule page qui restait.
/**
 * Une pile de navigation sur le VRAI routeur de React Navigation : chaque geste de l ecran
 * passe par lui, comme dans l app ; le temoin lit la pile qui en sort.
 * @param {Array<{ name: string, params?: any }>} routes La pile de depart.
 * @returns {any} La navigation de l ecran, et `etat` : la pile courante.
 */
const pileReelle = (routes) => {
  const routeur = StackRouter({});
  const options = {
    routeGetIdList: {},
    routeNames: [RouteNames.MyChildren, RouteNames.UserDetails],
    routeParamList: {},
  };
  /** @type {any} */
  let etat = routeur.getRehydratedState(/** @type {any} */ ({ routes }), options);
  const jouer = (/** @type {any} */ action) => {
    etat = routeur.getStateForAction(etat, action, options) || etat;
  };
  return {
    get etat() { return etat; },
    goBack: () => jouer(CommonActions.goBack()),
    navigate: (/** @type {string} */ nom, /** @type {any} */ p) => (
      jouer(CommonActions.navigate(nom, p))
    ),
    push: (/** @type {string} */ nom, /** @type {any} */ p) => jouer(StackActions.push(nom, p)),
  };
};

describe('FINITIONS12-STATS · point 2 — Retour depuis les retours du coach', () => {
  beforeEach(() => {
    mockFetchedUser = HUGO_VU_PAR_PAPA;
  });

  it('🔴 la vue s EMPILE : Retour ramene a la fiche de Hugo, pas a « Mes enfants »', async () => {
    const pile = pileReelle([
      { name: RouteNames.MyChildren },
      { name: RouteNames.UserDetails, params: FICHE_DE_HUGO },
    ]);
    const arbre = await rendre(PAPA, FICHE_DE_HUGO, pile);

    await act(async () => {
      appuyable(arbre, 'Tous ses retours · 2').props.onPress();
    });
    expect(pile.etat.routes.map((/** @type {any} */ r) => [r.name, r.params])).toEqual([
      [RouteNames.MyChildren, undefined],
      [RouteNames.UserDetails, FICHE_DE_HUGO],
      [RouteNames.UserDetails, { userId: 'hugo', view: 'coachFeedback' }],
    ]);

    pile.goBack();
    const page = pile.etat.routes[pile.etat.index];
    expect([page.name, page.params]).toEqual([RouteNames.UserDetails, FICHE_DE_HUGO]);
  });
});
