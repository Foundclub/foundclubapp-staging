import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

import UserDetails from '../UserDetails';

// Le premier rendu charge l ecran entier : sous charge (les portes admin en parallele), il
// depasse les 5 s par defaut. Meme reglage que 93 temoins du depot.
jest.setTimeout(30000);

// ST-RETOURS (02/10) — PLANCHE 19 DU DESIGN VALIDE : « RETOURS DU COACH ».
//
// Ce que la planche demande, et que ce fichier tient : chaque retour dit QUI l a ecrit
// (« de Karim »), le jour DU MATCH (plus celui de la publication, defaut 26), le resultat
// et le score ; la note sans « 0/10 » quand il n y en a pas ; « Nouveau » sur ce qui n a pas
// ete lu — puis c est marque lu ; « Ouvrir le match » ; qui peut lire la liste ; et les etats
// vide, chargement, erreur. Le parent lit la meme vue, « pour Hugo Lemaire ».
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
const VUE = { userId: 'hugo', view: 'coachFeedback' };

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

describe('ST-RETOURS · planche 19 — un retour dit qui, quand, quel score', () => {
  it('etat 1 — « de Karim », le jour du match, le score, la note, le mot', async () => {
    const arbre = await rendre(HUGO, VUE);
    const t = texte(arbre);

    expect(t).toContain('AS Montrivage — Test-COMPO');
    expect(t).toContain('U15 · sam. 5 sept. · victoire 2 - 1 · de Karim');
    expect(t).toContain('7/10');
    expect(t).toContain(RETOUR_KARIM.comment);
    expect(t).not.toContain('01/10/2026');
  });

  it('etat 2 — un retour sans note garde son mot, sans « 0/10 » ni « Commentaire »', async () => {
    const arbre = await rendre(HUGO, VUE);
    const t = texte(arbre);

    expect(t).toContain('U15 · sam. 29 août · nul 2 - 2 · de Karim');
    expect(t).toContain('Plus d’appels en profondeur : tu les as.');
    expect(t).not.toContain('0/10');
    expect(t).not.toContain('Commentaire');
  });

  it('« Ouvrir le match » mene a la fiche du match, sur le retour du coach', async () => {
    const arbre = await rendre(HUGO, VUE);
    const liens = arbre.root.findAllByType(TouchableOpacity)
      .filter((n) => n.findAllByType(Text)
        .some((x) => aplatir(x.props.children) === 'Ouvrir le match'));
    expect(liens).toHaveLength(2);

    await act(async () => {
      liens[0].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.EventStack, {
      params: { eventId: 'm1', focusSection: 'coachFeedback' },
      screen: RouteNames.EventDetails,
    });
  });

  it('« Nouveau » sur ce qui n a pas ete lu, et seulement la — puis c est marque lu', async () => {
    mockFollow = { hugo: { seen: ['event:m0:u15:v1'] } };
    const arbre = await rendre(HUGO, VUE);

    const cartes = arbre.root.findAll((n) => (
      n.props.testID === 'coach-feedback-card' && typeof n.type !== 'string'
    ));
    const nouvelles = cartes.filter((carte) => carte.findAllByType(Text)
      .some((x) => aplatir(x.props.children) === 'Nouveau'));
    expect(nouvelles).toHaveLength(1);
    expect(texte(arbre).split('Nouveau').length - 1).toBe(1);
    expect(mockMarquerLu).toHaveBeenCalledTimes(1);
    expect(mockMarquerLu).toHaveBeenCalledWith({
      playerDocumentId: 'hugo',
      seenKeys: ['event:m1:u15:v1'],
    });
  });

  it('tout est deja lu : aucune pastille, et rien n est reecrit', async () => {
    mockFollow = { hugo: { seen: ['event:m0:u15:v1', 'event:m1:u15:v1'] } };
    const arbre = await rendre(HUGO, VUE);

    expect(texte(arbre)).not.toContain('Nouveau');
    expect(mockMarquerLu).not.toHaveBeenCalled();
  });

  it('qui peut lire : « Visible par toi et tes parents. » quand un parent est relie', async () => {
    const arbre = await rendre(HUGO, VUE);
    expect(texte(arbre)).toContain('Visible par toi et tes parents.');
  });

  it('sans parent relie : « Visible par toi seulement. »', async () => {
    const arbre = await rendre({ ...HUGO, parentAccount: null }, VUE);
    expect(texte(arbre)).toContain('Visible par toi seulement.');
  });
});

describe('ST-RETOURS · planche 19 — les etats', () => {
  it('etat 3 — vide : il dit d ou viennent les retours, et qu on est prevenu', async () => {
    mockStatsQuery = { ...mockStatsQuery, data: { recentCoachFeedback: [] } };
    const arbre = await rendre(HUGO, VUE);
    const t = texte(arbre);

    expect(t).toContain('Pas encore de retour');
    expect(t).toContain('Après un match, ton entraîneur peut t’écrire une note et un mot.');
    expect(t).toContain('Ils arrivent ici, et tu es prévenu·e.');
  });

  it('etat 4 — chargement : des cartes en squelette, pas une liste vide', async () => {
    mockStatsQuery = { ...mockStatsQuery, data: undefined, isLoading: true };
    const arbre = await rendre(HUGO, VUE);

    const squelettes = arbre.root.findAll((n) => n.props.testID === 'coach-feedback-loading');
    expect(squelettes.length).toBeGreaterThan(0);
    expect(texte(arbre)).not.toContain('Pas encore de retour');
  });

  it('etat 5 — erreur : la panne se dit, et « Réessayer » relit', async () => {
    mockStatsQuery = { ...mockStatsQuery, data: undefined, error: new Error('reseau') };
    const arbre = await rendre(HUGO, VUE);

    expect(texte(arbre)).toContain('Les retours n’ont pas pu être lus.');
    expect(texte(arbre)).toContain('Vérifie ta connexion, puis réessaie.');
    await act(async () => {
      appuyable(arbre, 'Réessayer').props.onPress();
    });
    expect(mockRelire).toHaveBeenCalled();
  });
});

describe('ST-RETOURS · planche 22 etat 3 — le parent lit la meme vue', () => {
  // STATS-FIX2 · point 1 : la planche 22 (dessinee AVANT « parents encart B ») n avait pas de
  // lien vers le match. Le parent lit maintenant l encart du score : la porte s ouvre pour lui.
  it('« pour Hugo Lemaire », « Visible par Hugo et toi. », et la porte du match', async () => {
    mockFetchedUser = { ...HUGO, age: 14 };
    const arbre = await rendre(PAPA, VUE);
    const t = texte(arbre);

    expect(t).toContain('pour Hugo Lemaire');
    expect(t).toContain('Visible par Hugo et toi.');
    expect(t).toContain('7/10');
    expect(t).toContain('Ouvrir le match');
  });
});

// STATS-FIX2 · POINT 3 (tournee T10, ecran 17) — « Ses retours de match dans la feuille »
// « ne fait rien » chez l entraineur. NON REPRODUIT dans le code : ce temoin fige le chemin de
// bout en bout sur le VRAI ecran (UserDetails -> ProfileStatsForViewer -> l appui), et
// l action rendue est celle que la pile des evenements sait servir (EventStack >
// MatchStatsEditor, route.params lus par l editeur : eventId, sourceType, teamId).
// Journal du relais de la tournee : le profil s ouvre a 20:21:04 UTC, puis le relais est
// RELANCE (relay-t10e s arrete, relay-t10f repart a 20:22:11) : « aucune requete » ne se
// mesurait pas dans cette fenetre. A rephotographier a la T11 (capture avant ET apres l appui).
describe('STATS-FIX2 · point 3 — « Ses retours de match dans la feuille » (entraineur)', () => {
  const KARIM = {
    documentId: 'karim',
    firstname: 'Karim',
    role: { name: 'Entraineur' },
    trainedTeams: [{ documentId: 'u13', name: 'U13' }, { documentId: 'u15', name: 'U15' }],
  };
  const STATS_VUES_PAR_KARIM = {
    overall: { goals: 2, matches: 2, minutes: 180 },
    recentMatches: [
      {
        documentId: 'kf57', sourceType: 'event', sport: 'football', teamName: 'U15',
      },
      {
        documentId: 'm-ancien', sourceType: 'event', sport: 'football', teamName: 'U13',
      },
    ],
    scope: {
      teams: [{ documentId: 'u13', name: 'U13' }, { documentId: 'u15', name: 'U15' }],
      viewer: 'coach',
    },
  };

  it('l appui ouvre la feuille du DERNIER match, pour l equipe que Karim entraine', async () => {
    mockFetchedUser = {
      ...HUGO,
      myTeams: [{ documentId: 'u13', name: 'U13' }, { documentId: 'u15', name: 'U15' }],
    };
    mockStatsQuery = { ...mockStatsQuery, data: STATS_VUES_PAR_KARIM };
    const arbre = await rendre(KARIM, { userId: 'hugo' });
    const lien = arbre.root.findAll((/** @type {any} */ n) => (
      n.props.testID === 'profile-stats-match-sheet-link' && typeof n.props.onPress === 'function'
    ))[0];

    expect(lien).toBeDefined();
    await act(async () => {
      lien.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.EventStack, {
      params: {
        eventId: 'kf57',
        sourceType: 'event',
        sport: 'football',
        teamId: 'u15',
        teamName: 'U15',
      },
      screen: RouteNames.MatchStatsEditor,
    });
  });
});
