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
const mockRelire = jest.fn();

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
 * @returns {Promise<any>}
 */
const rendre = async (moi, parametres) => {
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
        navigation={/** @type {any} */ ({ goBack: jest.fn(), navigate: mockNavigate })}
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
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.UserDetails, {
      userId: 'hugo',
      view: 'coachFeedback',
    });
  });

  it('etat 2 — « Nouveau » sur le dernier retour pas lu, puis CE retour-la marque lu', async () => {
    mockFollow = {};
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);

    expect(texte(arbre)).toContain('Nouveau');
    expect(mockMarquerLu).toHaveBeenCalledWith({
      playerDocumentId: 'hugo',
      seenKeys: ['event:m1:u15:v1'],
    });
  });

  it('etat 2 — deja lu : pas de pastille, rien n est reecrit', async () => {
    mockFollow = { hugo: { seen: ['event:m1:u15:v1'] } };
    const arbre = await rendre(PAPA, FICHE_DE_HUGO);

    expect(texte(arbre)).not.toContain('Nouveau');
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
