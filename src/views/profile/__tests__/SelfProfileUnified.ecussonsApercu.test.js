import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

// D65 (E6) — L'ECRAN DU DIRIGEANT : SES ECUSSONS, ET SON DROIT DE SE RELIRE.
//
// Deux retours d'Adel apres avoir vu D54 sur l'emulateur, et les deux tombent
// sur le meme ecran, parce que c'est celui qu'un dirigeant voit :
//
//   ① « les logos des equipes ne sont pas coherents avec l'app ». Ses equipes
//      entrainees s'affichaient dans une tuile carree a initiales, une TROISIEME
//      grammaire apres l'ecusson de `UserDetails` et le vrai logo de partout
//      ailleurs. La regle retenue est celle du reste de l'app
//      (`TeamListContent.js:540`) : LE LOGO DU CLUB S'IL EXISTE, SINON LES
//      INITIALES SUR L'ECUSSON.
//
//   ② « je ne vois pas de bouton "voir mon profil comme les autres" ». Le bouton
//      existait (`SelfProfilePlayerCoach.js:629`) mais l'aiguillage de
//      `UserDetails.js` envoie le DIRIGEANT sur `SelfProfileUnified`, qui ne
//      l'avait pas. Seuls le joueur et l'entraineur pouvaient se relire.
//      Ca compte plus qu'un bouton manquant : D54 vient de retirer le telephone
//      et la date de naissance des pages publiques, et l'apercu est le SEUL
//      moyen de verifier ce qu'on expose.
//
// Ce fichier monte `UserDetails` — le composant de la ROUTE — et non l'ecran
// directement, comme `UserDetails.profilUnifie.test.js` dont il reprend le
// harnais : c'est ce qui prouve l'AIGUILLAGE en plus du contenu.
//
// `ClubLogoMark` n'est PAS double ici : on le laisse arbitrer pour de vrai et on
// ne double que ses deux feuilles (`ProfileAvatar` pour l'image, `TeamShield`
// pour le repli). Doubler l'arbitre prouverait qu'on lui passe la donnee, pas
// qu'elle arrive a l'ecran.

/** @type {any} */
let mockAuthValue;
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

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: async (/** @type {any} */ entree) => {
      const resultat = await options.mutationFn(entree);
      await options.onSuccess?.(resultat);
    },
  }),
  useQuery: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

// Le service porte le client HTTP, qui exige `API_URL` au chargement : le tirer
// pour de vrai tue la suite entiere.
jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ charge) => Promise.resolve({ ...charge }),
}));

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
  default: () => ({ startGroupChat: jest.fn(), startWhisperChat: jest.fn() }),
}));

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => 'geohash-test' }),
}));

jest.mock('@/services/auth/authQueries', () => ({
  useGetUserById: () => ({
    data: undefined, error: undefined, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useUserCurrentLicense: () => ({ data: undefined, refetch: jest.fn() }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
}));

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ data: [], refetch: jest.fn() }),
  useGetUserHistories: () => ({ data: [], refetch: jest.fn() }),
}));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [] }),
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [] }),
}));

// AC03 — le sport et la categorie viennent desormais des listes du SERVEUR.
// Sans ces doublures, l'ecran tire le vrai client HTTP et la suite ne se charge
// meme pas (« API_URL is missing »), comme pour les niveaux et les sections.
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'act-1', name: 'Football' }] }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [{ documentId: 'cat-1', name: 'U13 (13 ans)' }] }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

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
        bell: 1,
        calendar: 1,
        camera: 1,
        check: 1,
        edit: 1,
        envelope: 1,
        phone: 1,
        pin: 1,
        plus: 1,
        running: 1,
        shield: 1,
        trash: 1,
        trophy: 1,
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

// LES DEUX FEUILLES DE `ClubLogoMark`, et rien de plus.
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

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, isVisible }) => (
      isVisible ? <View>{children}</View> : null
    ),
  };
});

// Tire `react-native-bouncy-checkbox`, publie en ESM pur et absent de
// `transformIgnorePatterns` : sans doublure, la suite ne se charge pas.
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <TexteRN>{`CHAMP:${proprietes.label ?? ''}`}</TexteRN>
    ),
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <TexteRN>{`CHAMP:${proprietes.label ?? ''}`}</TexteRN>
    ),
  };
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <TexteRN>{`CHAMP:${proprietes.label ?? ''}`}</TexteRN>
    ),
  };
});

jest.mock('@/components/molecules/selectAvatar/SelectAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>SELECTEUR AVATAR</TexteRN>,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => (
      <Pressable disabled={disabled} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </Pressable>
    ),
  };
});

/**
 * Aplati les enfants React en une chaine.
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
 * Tout le texte visible de l'arbre rendu.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Le pressable portant ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const pressablePortant = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud
    .findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));

const LIBELLE_APERCU = 'Voir mon profil comme les autres';
const LOGO_DU_CLUB = 'https://cdn.foundclub.test/ecussons/om.png';

/** Le dirigeant du pack, dont le club n'a PAS de logo : le cas normal. */
const dirigeantSansLogo = {
  club: { clubVerified: true, documentId: 'club-1', name: 'Olympique de Marseille' },
  documentId: 'user-1',
  firstname: 'Philippe',
  lastname: 'Courtoi',
  myTeams: [],
  phoneNumber: '+33612345678',
  role: { name: 'Dirigeant', type: 'president' },
  trainedTeams: [
    {
      club: { documentId: 'club-1', name: 'Union Sportive Anzin' },
      documentId: 'team-1',
      name: 'Seniors A',
    },
  ],
};

/** Le meme dirigeant, mais son club a un ecusson. */
const dirigeantAvecLogo = {
  ...dirigeantSansLogo,
  trainedTeams: [
    {
      club: { documentId: 'club-1', logo: { url: LOGO_DU_CLUB }, name: 'Olympique de Marseille' },
      documentId: 'team-1',
      name: 'Seniors A',
    },
  ],
};

/**
 * Monte l'ecran pour l'utilisateur donne.
 * @param {any} utilisateurCourant
 * @param {any} [parametresRoute]
 * @returns {Promise<any>}
 */
const rendre = async (utilisateurCourant, parametresRoute = {}) => {
  mockAuthValue = {
    formatBirthdateToDisplay: (/** @type {string} */ valeur) => String(valeur || ''),
    formatBirthdateToSend: (/** @type {string} */ valeur) => String(valeur || ''),
    getAuthTokens: () => ({ token: 'jeton-test' }),
    isCurrentClubVerified: utilisateurCourant?.club?.clubVerified === true,
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('D65 · temoin 4 — un DIRIGEANT peut se relire comme les autres le voient', () => {
  it('porte le bouton « Voir mon profil comme les autres »', async () => {
    const arbre = await rendre(dirigeantSansLogo);

    expect(texteVisible(arbre)).toContain(LIBELLE_APERCU);
  });

  it('ouvre l\'APERCU de son propre profil, et pas un autre ecran', async () => {
    const arbre = await rendre(dirigeantSansLogo);
    const bouton = pressablePortant(arbre, LIBELLE_APERCU);
    expect(bouton).toBeDefined();

    await act(async () => {
      bouton.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('UserDetails', {
      preview: true,
      userId: 'user-1',
    });
  });

  it('emprunte le mecanisme d\'apercu EXISTANT, jamais un second', async () => {
    // `preview: true` est le seul interrupteur : c'est lui que `UserDetails`
    // lit pour basculer `isOwnerView` a faux (l. 328). Un dirigeant qui
    // passerait par autre chose contournerait le masquage pose par D54.
    const arbre = await rendre(dirigeantSansLogo);
    await act(async () => {
      pressablePortant(arbre, LIBELLE_APERCU).props.onPress();
    });

    const [, parametres] = mockNavigate.mock.calls[0];
    expect(parametres.preview).toBe(true);
    expect(Object.keys(parametres).sort()).toEqual(['preview', 'userId']);
  });
});

describe('D65 · temoin 5 — les equipes du dirigeant portent le blason du club', () => {
  it('affiche le VRAI logo quand le club en a un', async () => {
    const arbre = await rendre(dirigeantAvecLogo);

    expect(texteVisible(arbre)).toContain(`IMAGE:${LOGO_DU_CLUB}`);
  });

  it('retombe sur les initiales du club quand il n\'a pas de logo', async () => {
    const arbre = await rendre(dirigeantSansLogo);
    const texte = texteVisible(arbre);

    expect(texte).toContain('ECUSSON:USA');
    expect(texte).not.toContain(`IMAGE:${LOGO_DU_CLUB}`);
  });

  it('garde la rangee d\'equipe cliquable, comme D06 l\'a posee', async () => {
    const arbre = await rendre(dirigeantSansLogo);

    expect(pressablePortant(arbre, 'Seniors A')).toBeDefined();
  });
});
