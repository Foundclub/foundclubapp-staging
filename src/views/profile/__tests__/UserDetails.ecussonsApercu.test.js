import { differenceInYears } from 'date-fns';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// D65 (E6) — L'ECUSSON D'UNE EQUIPE, ET L'APERCU D'UN DIRIGEANT.
//
// Retour d'Adel apres avoir vu D54 sur l'emulateur : « sur le profil, les logos
// des equipes ne sont pas coherents avec l'app ». Il avait raison, et l'ecart
// tenait dans le MEME fichier, a cent lignes d'ecart :
//
//   - le CLUB de l'utilisateur passait deja par `ClubLogoMark`
//     (`UserDetails.js:797`) — vrai logo si le club en a un ;
//   - ses EQUIPES passaient par `TeamShield` nu, qui ne sait afficher que des
//     initiales. Une equipe dont le club a un ecusson montrait quand meme un
//     blason gris.
//
// La regle, la meme que partout ailleurs dans l'app (`TeamListContent.js:540`,
// `EventCard`, `RecruitmentAdCard`…) : LE LOGO DU CLUB S'IL EXISTE, SINON LES
// INITIALES SUR L'ECUSSON. Le repli est le cas NORMAL — la plupart des clubs de
// recette n'ont pas de logo — donc c'est lui qu'on fige en premier.
//
// Ce fichier n'observe PAS `ClubLogoMark` de l'exterieur : il le laisse tourner
// pour de vrai et ne double que ses deux feuilles (`ProfileAvatar` pour l'image,
// `TeamShield` pour le repli). C'est la seule facon de prouver que la donnee
// TRAVERSE reellement l'ecran au lieu de prouver qu'on la passe bien.
//
// Le troisieme temoin est un temoin de VIE PRIVEE, et il double volontairement
// ceux de D54 (`UserDetails.viePrivee.test.js`) sur le seul role qu'ils ne
// couvrent pas : le DIRIGEANT, a qui D65 ouvre l'apercu. `isSelfProfile` decide
// de la SOURCE des donnees et reste vrai en apercu ; seul `isOwnerView` decide
// de l'AFFICHAGE. Brancher l'apercu du dirigeant sur le mauvais des deux
// rouvrirait exactement la fuite que D54 vient de fermer.
//
// Meme discipline que ses voisins : on ne lit que le TEXTE VISIBLE, jamais la
// forme de l'arbre, et le theme comme les traductions sont les VRAIS modules.

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
    getClubInitials: jest.requireActual('@/domains/club/clubUseCase').getClubInitials,
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

// LES DEUX FEUILLES, et rien de plus. `ClubLogoMark` n'est PAS double : c'est
// lui qu'on veut voir choisir entre l'image et le repli.
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { imageUrl }) => <TexteRN>{`IMAGE:${imageUrl || ''}`}</TexteRN>,
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

const LOGO_DU_CLUB = 'https://cdn.foundclub.test/ecussons/racing-vernon.png';

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchedUser = undefined;
  mockPersonalStats = undefined;
});

describe('D65 · temoin 1 — une equipe dont le club a un logo AFFICHE ce logo', () => {
  beforeEach(() => {
    mockFetchedUser = {
      documentId: 'user-2',
      firstname: 'Jo',
      lastname: 'Ueur',
      myTeams: [{
        club: { documentId: 'club-1', logo: { url: LOGO_DU_CLUB }, name: 'Racing Club Vernon' },
        documentId: 'team-1',
        name: 'Seniors A',
      }],
      role: { name: 'Joueur', type: 'player' },
    };
  });

  it('rend le vrai logo du club, pas un blason a initiales', async () => {
    const arbre = await rendre(dirigeantConnecte, { userId: 'user-2' });
    const texte = texteVisible(arbre);

    expect(texte).toContain(`IMAGE:${LOGO_DU_CLUB}`);
  });

  it('garde le nom de l\'equipe a cote du logo', async () => {
    const arbre = await rendre(dirigeantConnecte, { userId: 'user-2' });

    expect(texteVisible(arbre)).toContain('Seniors A');
  });
});

describe('D65 · temoin 2 — sans logo, les initiales, et c\'est le cas NORMAL', () => {
  it('retombe sur l\'ecusson a initiales quand le club n\'a pas de logo', async () => {
    mockFetchedUser = {
      documentId: 'user-2',
      firstname: 'Jo',
      lastname: 'Ueur',
      myTeams: [{
        club: { documentId: 'club-2', name: 'Union Sportive Anzin' },
        documentId: 'team-2',
        name: 'Seniors B',
      }],
      role: { name: 'Joueur', type: 'player' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'user-2' });
    const texte = texteVisible(arbre);

    expect(texte).toContain('ECUSSON:USA');
    expect(texte).not.toContain(`IMAGE:${LOGO_DU_CLUB}`);
  });

  it('retombe AUSSI sur des initiales quand l\'equipe n\'a aucun club', async () => {
    mockFetchedUser = {
      documentId: 'user-2',
      firstname: 'Jo',
      lastname: 'Ueur',
      myTeams: [{ documentId: 'team-3', name: 'Loisirs Mixte' }],
      role: { name: 'Joueur', type: 'player' },
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'user-2' });

    expect(texteVisible(arbre)).toContain('ECUSSON:LM');
  });

  it('vaut aussi pour une equipe ENTRAINEE, pas seulement une equipe joueur', async () => {
    mockFetchedUser = {
      documentId: 'user-2',
      firstname: 'En',
      lastname: 'Traineur',
      role: { name: 'Entraineur', type: 'coach' },
      trainedTeams: [{
        club: { documentId: 'club-1', logo: { url: LOGO_DU_CLUB }, name: 'Racing Club Vernon' },
        documentId: 'team-4',
        name: 'U15',
      }],
    };

    const arbre = await rendre(dirigeantConnecte, { userId: 'user-2' });

    expect(texteVisible(arbre)).toContain(`IMAGE:${LOGO_DU_CLUB}`);
  });
});

describe('D65 · temoin 3 — l\'APERCU d\'un DIRIGEANT n\'en dit pas plus que sa page', () => {
  // D54 a ferme cette fuite pour le joueur et l'entraineur. D65 ouvre l'apercu
  // au dirigeant : sans ce temoin, on rouvrirait la meme porte sur le seul role
  // qui ne la franchissait pas encore.
  const DATE_NAISSANCE_ISO = '1984-02-29';
  const DATE_NAISSANCE_AFFICHEE = '29/02/1984';

  const moiDirigeant = {
    birthdate: DATE_NAISSANCE_ISO,
    documentId: 'user-1',
    email: 'dirigeant@example.com',
    firstname: 'Chef',
    lastname: 'Declub',
    phoneNumber: '+33622222222',
    role: { name: 'Dirigeant', type: 'president' },
  };

  it('ne montre ni mon telephone ni mon email', async () => {
    const arbre = await rendre(moiDirigeant, { preview: true, userId: 'user-1' });
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('+33622222222');
    expect(texte).not.toContain('dirigeant@example.com');
  });

  it('ne montre pas ma date de naissance exacte, mais garde mon age', async () => {
    const arbre = await rendre(moiDirigeant, { preview: true, userId: 'user-1' });
    const texte = texteVisible(arbre);
    const ageAttendu = differenceInYears(new Date(), new Date(DATE_NAISSANCE_ISO));

    expect(texte).not.toContain(DATE_NAISSANCE_AFFICHEE);
    expect(texte).toContain(String(ageAttendu));
  });

  it('rend bien la page publique, et non l\'ecran unifie du dirigeant', async () => {
    const arbre = await rendre(moiDirigeant, { preview: true, userId: 'user-1' });

    expect(texteVisible(arbre)).not.toContain('ECRAN PROFIL UNIFIE');
  });

  it('hors apercu, le meme dirigeant part toujours vers son ecran unifie', async () => {
    const arbre = await rendre(moiDirigeant, { userId: 'user-1' });

    expect(texteVisible(arbre)).toContain('ECRAN PROFIL UNIFIE');
  });
});
