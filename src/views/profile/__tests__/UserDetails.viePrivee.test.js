import { differenceInYears } from 'date-fns';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// D54 (E6) — LE FILET DE VIE PRIVEE SUR LA PAGE « CE QUE VOIENT LES AUTRES ».
//
// `UserDetails` est l'UNIQUE page publique de profil : le meme composant sert
// `PJPublic` (joueur) et `PEPublic` (entraineur) du pack, et il est aussi
// publie sur le WEB a `/users/:userId` (`navigation/webRoutes.js`). Ce qu'il
// laisse passer est donc lisible par n'importe qui, y compris sur un compte
// MINEUR.
//
// Ce fichier fige DEUX regles que le pack pose comme non negociables
// (« Regles transverses », README du handoff) :
//
//   1. telephone / email / DATE EXACTE de naissance : jamais sur une vue
//      publique. Le pack precise le remplacant : « date de naissance exacte
//      -> age seul » (PROMPT_PROFIL_JOUEUR §2.3 et PROMPT_PROFIL_ENTRAINEUR
//      §2.2). L'age existe DEJA sur cette page : seule la ligne « Date de
//      naissance » est en trop.
//   2. separation stricte des roles : aucun bloc joueur (stats, poste,
//      section, categorie, taille, poids) sur le profil d'un ENTRAINEUR.
//      Le pack range ces blocs en « heritage joueur » et en fait un contrat de
//      recette (PROMPT_PROFIL_ENTRAINEUR §3).
//
// L'APERCU compte comme une vue publique. C'est meme sa raison d'etre : le
// bouton s'appelle « Voir mon profil comme les autres ». S'il montre plus que
// ce que voient les autres, il ne repond pas a la question qu'il pose.
//
// Meme discipline que `UserDetails.caracterisation.test.js`, dont ce fichier
// reprend le harnais : on n'observe que le TEXTE VISIBLE, jamais la forme de
// l'arbre, et le theme et les traductions sont les VRAIS modules (un mock en
// Proxy rend les echecs Jest illisibles — constat du lot paywall du 02/08).

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

jest.mock('@/views/profile/SelfProfileUnified', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>ECRAN PROFIL UNIFIE</TexteRN>,
  };
});

jest.mock('@/views/profile/SelfProfilePlayerCoach', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>ECRAN PROFIL JOUEUR OU ENTRAINEUR</TexteRN>,
  };
});

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

/** La date de naissance des fixtures, et l'age qu'on doit lire A LA PLACE. */
const DATE_NAISSANCE_ISO = '2000-04-10';
const DATE_NAISSANCE_AFFICHEE = '10/04/2000';
const ageAttendu = differenceInYears(new Date(), new Date(DATE_NAISSANCE_ISO));

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchedUser = undefined;
  mockPersonalStats = undefined;
});

describe('D54 · temoin 1 — la page publique d\'un JOUEUR ne porte NI date de naissance exacte NI telephone', () => {
  /** Un joueur mineur : le cas qui rend la fuite grave, pas seulement genante. */
  const joueurRegarde = {
    birthdate: DATE_NAISSANCE_ISO,
    documentId: 'autre-1',
    email: 'secret@example.com',
    firstname: 'Autre',
    lastname: 'Joueur',
    phoneNumber: '+33699999999',
    role: { name: 'Joueur', type: 'player' },
  };

  it('ne montre JAMAIS la date de naissance exacte', async () => {
    mockFetchedUser = joueurRegarde;

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const texte = texteVisible(arbre);

    expect(texte).not.toContain(DATE_NAISSANCE_AFFICHEE);
    expect(texte).not.toContain('Date de naissance');
  });

  it('garde l\'AGE, qui est ce que le pack met a la place', async () => {
    mockFetchedUser = joueurRegarde;

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const texte = texteVisible(arbre);

    expect(texte).toContain(`${ageAttendu} ans`);
  });

  it('ne montre ni le telephone ni l\'email', async () => {
    mockFetchedUser = joueurRegarde;

    const arbre = await rendre(dirigeantConnecte, { userId: 'autre-1' });
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('+33699999999');
    expect(texte).not.toContain('secret@example.com');
  });
});

describe('D54 · temoin 2 — la page publique d\'un ENTRAINEUR ne porte AUCUN bloc de joueur', () => {
  // Le pack les nomme un par un et en fait un contrat de recette : un
  // entraineur n'a ni poste ni taille de jeu. Les afficher, c'est publier des
  // donnees qui ne le concernent pas — et remplir la fiche de « Non renseigne ».
  const entraineurRegarde = {
    birthdate: DATE_NAISSANCE_ISO,
    documentId: 'coach-1',
    firstname: 'Autre',
    height: '1.80',
    lastname: 'Entraineur',
    position: 'Ailier',
    role: { name: 'Entraineur', type: 'coach' },
    weight: '75',
  };

  it('ne porte AUCUN bloc « Stats de match »', async () => {
    mockFetchedUser = entraineurRegarde;
    mockPersonalStats = { assists: 3, goals: 5, matches: 12 };

    const arbre = await rendre(dirigeantConnecte, { userId: 'coach-1' });

    expect(texteVisible(arbre)).not.toContain('Stats de match');
  });

  it('GARDE la grille sport, que le pack lui accorde : sport et meilleur niveau', async () => {
    // Le pack ne vide pas la grille du coach, il la RESTREINT : sa vue publique
    // porte « Âge, Ville, Sport, Meilleur niveau » (PROMPT_PROFIL_ENTRAINEUR
    // §2.2). Seuls poste / section / categorie en sortent.
    mockFetchedUser = entraineurRegarde;

    const arbre = await rendre(dirigeantConnecte, { userId: 'coach-1' });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Profil sportif');
    expect(texte).toContain('Sport');
    expect(texte).toContain('Niveau');
  });

  it('ne porte ni poste, ni section, ni categorie', async () => {
    mockFetchedUser = entraineurRegarde;

    const arbre = await rendre(dirigeantConnecte, { userId: 'coach-1' });
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('Poste');
    expect(texte).not.toContain('Section');
    expect(texte).not.toContain('Catégorie');
  });

  it('ne porte ni taille ni poids', async () => {
    mockFetchedUser = entraineurRegarde;

    const arbre = await rendre(dirigeantConnecte, { userId: 'coach-1' });
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('Taille');
    expect(texte).not.toContain('Poids');
  });

  it('garde ce que le pack lui accorde : identite, age, historique', async () => {
    mockFetchedUser = entraineurRegarde;

    const arbre = await rendre(dirigeantConnecte, { userId: 'coach-1' });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Entraîneur');
    expect(texte).toContain(`${ageAttendu} ans`);
    expect(texte).toContain('SECTION HISTORIQUE SPORTIF');
  });

  it('n\'expose pas davantage la date exacte que sur un profil joueur', async () => {
    mockFetchedUser = entraineurRegarde;

    const arbre = await rendre(dirigeantConnecte, { userId: 'coach-1' });

    expect(texteVisible(arbre)).not.toContain(DATE_NAISSANCE_AFFICHEE);
  });
});

describe('D54 · temoin 3 — l\'APERCU dit la verite : il montre ce que voient les autres, pas plus', () => {
  // `isSelfProfile` decide de la SOURCE des donnees (mon compte en cache) ;
  // `isOwnerView` decide de l'AFFICHAGE. Le telephone et l'email etaient
  // branches sur le PREMIER : en apercu, ou l'on regarde son propre profil,
  // ils reapparaissaient. L'apercu affirmait donc que les autres voient un
  // numero qu'ils ne voient pas — un bouton qui ment sur la vie privee est
  // pire que pas de bouton.
  const moiJoueur = {
    birthdate: DATE_NAISSANCE_ISO,
    documentId: 'user-1',
    email: 'moi@example.com',
    firstname: 'Moi',
    lastname: 'Joueur',
    phoneNumber: '+33611111111',
    role: { name: 'Joueur', type: 'player' },
  };

  it('masque mon telephone et mon email quand je regarde mon profil comme les autres', async () => {
    const arbre = await rendre(moiJoueur, { preview: true, userId: 'user-1' });
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('+33611111111');
    expect(texte).not.toContain('moi@example.com');
  });

  it('masque aussi ma date de naissance exacte en apercu', async () => {
    const arbre = await rendre(moiJoueur, { preview: true, userId: 'user-1' });

    expect(texteVisible(arbre)).not.toContain(DATE_NAISSANCE_AFFICHEE);
  });
});
