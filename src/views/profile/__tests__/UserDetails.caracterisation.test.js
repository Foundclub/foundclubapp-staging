import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// D06 (E6) : `UserDetails.js` fait 1 211 lignes, porte DOUZE points d'entree
// (recrutement, equipe, conversation, club, notifications, hub de demandes...)
// et n'avait AUCUN test. C'est LUI l'ecran « INFOS PROFIL / DIRIGEANT » que le
// pack design voulait fusionner avec le formulaire — pas `Profile.js`, qui est
// l'ecran « Mon compte » (abonnement, bascule de compte, deconnexion).
//
// Ce fichier a d'abord FIGE l'ecran d'origine, puis a suivi la refonte.
//
// CE QUI EN A ETE RETIRE, ET OU C'EST PARTI — rien n'a ete supprime, tout a
// suivi le comportement qu'il decrit. Les cinq tests « mon propre profil »
// (champs joueur montres a un dirigeant, « Non renseigne » repete neuf fois,
// titre « INFOS PROFIL », nom de club tronque a une ligne, equipes entrainees)
// decrivaient un ecran qui n'existe plus : depuis D06, `UserDetails` delegue
// `isSelfProfile` a `SelfProfileUnified`. Ils sont devenus leur contraire dans
// `UserDetails.profilUnifie.test.js`, qui verifie la CIBLE du pack.
//
// Ce qui reste ici est le chemin que la refonte ne traverse pas et ne doit
// jamais casser : le profil de QUELQU'UN D'AUTRE, avec son masquage « Prive ».
//
// Il n'observe que le TEXTE VISIBLE, jamais la forme de l'arbre. Theme et
// traductions sont les VRAIS modules : un mock en Proxy rend les echecs Jest
// illisibles (constat du lot paywall du 2026-08-02).

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockFetchedUser;
/** @type {any} */
let mockPersonalStats;
const mockNavigate = jest.fn();

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    // D39 — `UserDetails` tire desormais le contrat de formulaire, qui tire
    // `@/theme/strings` pour Joi, et ce module amorce i18next au chargement.
    // Sans cette doublure la suite ne se charge plus du tout.
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthValue,
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({
    getClubInitials: (/** @type {string} */ nom) => String(nom || '').slice(0, 2).toUpperCase(),
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({
    startGroupChat: jest.fn(),
    startWhisperChat: jest.fn(),
  }),
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
  useGetPersonalStats: () => ({
    data: mockPersonalStats,
    isLoading: false,
    refetch: jest.fn(),
  }),
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

// `UserDetails` importe desormais `SelfProfileUnified`, qui tire
// `AutocompleteAddressInput` -> `react-native-bouncy-checkbox`, publie en ESM
// pur et absent de `transformIgnorePatterns`. Sans cette doublure, la suite ne
// se charge pas — meme si aucun test ici ne rend l'ecran unifie.
jest.mock('@/views/profile/SelfProfileUnified', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>ECRAN PROFIL UNIFIE</TexteRN>,
  };
});

// D39 — meme raison, pour l'ecran joueur/entraineur. Ce fichier caracterise
// l'AIGUILLAGE de `UserDetails`, pas le contenu des ecrans qu'il delegue.
jest.mock('@/views/profile/SelfProfilePlayerCoach', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>ECRAN PROFIL JOUEUR OU ENTRAINEUR</TexteRN>,
  };
});

// Le VRAI theme, sans le contexte React qui le porte. `Images` est le seul
// element stub, pour ne pas faire dependre ce test de la resolution des assets.
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
      Images: {
        arrowRight: 1,
        calendar: 1,
        check: 1,
        edit: 1,
        envelope: 1,
        phone: 1,
        pin: 1,
        running: 1,
        shield: 1,
        users: 1,
      },
      Spaces: espaces,
    }),
  };
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
  return {
    __esModule: true,
    default: () => <TexteRN>SECTION HISTORIQUE SPORTIF</TexteRN>,
  };
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
  return {
    __esModule: true,
    default: (/** @type {any} */ { club }) => <TexteRN>{`BLASON:${club?.name || ''}`}</TexteRN>,
  };
});

jest.mock('@/components/atoms/teamShield/TeamShield', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { initials }) => <TexteRN>{`ECUSSON:${initials}`}</TexteRN>,
  };
});

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Monte l'ecran pour l'utilisateur courant donne.
 * @param {any} utilisateurCourant
 * @param {any} [parametresRoute]
 * @returns {Promise<any>}
 */
const rendre = async (utilisateurCourant, parametresRoute = {}) => {
  mockAuthValue = {
    refetchUserData: jest.fn(),
    USER_ROLES: {
      coach: 'Entraineur',
      new: 'Authenticated',
      player: 'Joueur',
      president: 'Dirigeant',
      superAdmin: 'SuperAdmin',
    },
    userData: utilisateurCourant,
  };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <UserDetails
        navigation={/** @type {any} */ ({ navigate: mockNavigate })}
        route={/** @type {any} */ ({ params: parametresRoute })}
      />,
    );
  });
  return arbre;
};

/** L'utilisateur qui REGARDE : un dirigeant, connecte. */
const dirigeantConnecte = { documentId: 'user-1', role: { name: 'Dirigeant', type: 'president' } };

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchedUser = undefined;
  mockPersonalStats = undefined;
});

describe('UserDetails — profil d\'AUTRUI : le garde-fou que D06 ne doit pas casser', () => {
  it('masque telephone, email et adresse derriere « Prive »', async () => {
    mockFetchedUser = {
      documentId: 'autre-1',
      email: 'secret@example.com',
      firstname: 'Autre',
      lastname: 'Joueur',
      phoneNumber: '+33699999999',
      role: { name: 'Joueur' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Privé');
    expect(texte).not.toContain('secret@example.com');
    expect(texte).not.toContain('+33699999999');
  });

  it("n'affiche pas « Retours du coach » sur le profil de quelqu'un d'autre", async () => {
    mockFetchedUser = {
      documentId: 'autre-1', firstname: 'Autre', lastname: 'Joueur', role: { name: 'Joueur' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });

    expect(texteVisible(arbre)).not.toContain('Retours du coach');
  });

  it('garde la fiche detaillee : stats de match, profil sportif, infos personnelles', async () => {
    mockFetchedUser = {
      documentId: 'autre-1',
      firstname: 'Autre',
      height: '1.80',
      lastname: 'Joueur',
      position: 'Ailier',
      role: { name: 'Joueur' },
      weight: '75',
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Stats de match');
    expect(texte).toContain('Profil sportif');
    expect(texte).toContain('Taille');
    expect(texte).toContain('Poids');
    expect(texte).toContain('Poste');
  });

  it('conserve « Non renseigne » sur la fiche de quelqu\'un d\'autre', async () => {
    mockFetchedUser = {
      documentId: 'autre-1', firstname: 'Autre', lastname: 'Joueur', role: { name: 'Joueur' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });

    expect(texteVisible(arbre)).toContain('Non renseigné');
  });

  it('rend chaque equipe comme un bouton qui ouvre sa fiche', async () => {
    mockFetchedUser = {
      documentId: 'autre-1',
      firstname: 'Autre',
      lastname: 'Joueur',
      myTeams: [{ documentId: 'team-1', name: 'Seniors A' }],
      role: { name: 'Joueur' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });

    const boutonEquipe = arbre.root
      .findAllByType(TouchableOpacity)
      .find((/** @type {any} */ noeud) => noeud
        .findAllByType(Text)
        .some((/** @type {any} */ texte) => (
          aplatirTexte(texte.props.children).trim() === 'Seniors A'
        )));

    expect(boutonEquipe).toBeDefined();
    await act(async () => {
      boutonEquipe.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalled();
  });
});

describe('UserDetails — mon propre profil part vers l\'ecran unifie', () => {
  it('delegue a `SelfProfileUnified` quand la route ne vise personne', async () => {
    const arbre = await rendre(dirigeantConnecte);

    expect(texteVisible(arbre)).toContain('ECRAN PROFIL UNIFIE');
  });

  it('y delegue aussi quand la route vise MON propre identifiant', async () => {
    const arbre = await rendre(dirigeantConnecte, { userId: 'user-1' });

    expect(texteVisible(arbre)).toContain('ECRAN PROFIL UNIFIE');
  });
});
