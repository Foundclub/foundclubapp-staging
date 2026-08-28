import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserDetails from '../UserDetails';

/**
 * AFFIL (E6) — LA DEMANDE EN ATTENTE, SUR LE PROFIL DU DIRIGEANT.
 *
 * Recette d Adel, le 2026-08-28 : « sur mon profil je ne suis toujours pas
 * affilie [...] il a fallu que je change de compte, que j aille dans le
 * superadmin sur les revendications, puis que je revienne pour voir la demande
 * en attente sur mon profil. »
 *
 * 🎯 CE QUE LA CARTE DU 28/08 A MESURE : le profil du dirigeant
 * (`SelfProfileUnified`, l aiguillage de `UserDetails.js:698`) liste ses clubs
 * via `getProfileClubs`, qui ne lit QUE des rattachements REELS — `club`,
 * `clubs`, `clubAffiliations`, et les clubs des equipes. Une demande en attente
 * n y a, par construction, aucune place : ni pendant qu elle attend, ni apres.
 * Le seul endroit de l app qui l affichait etait « Mes equipes »
 * (`TeamListContent.js:349`), un autre onglet.
 *
 * ⇒ Le profil ne pouvait PAS montrer ce qu Adel y cherchait. Ce n etait pas un
 *   defaut de rafraichissement : l affichage n existait pas.
 *
 * ⛔ CE TEMOIN NE PARLE PAS DE CERTIFICATION. La pastille « Certifie » du profil
 *    dit que le CLUB est verifie ; la rangee ci-dessous dit ou en est MA
 *    demande. Adel a nomme ces deux choses comme differentes le 28/08 — elles
 *    doivent le rester a l ecran.
 */

/** @type {any} */
let mockAuthValue;
const mockNavigate = jest.fn();

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        const gabarit = (() => {
          if (typeof valeur === 'string') return valeur;
          if (typeof repli === 'string') return repli;
          return cle;
        })();
        const parametres = (() => {
          if (valeurs && typeof valeurs === 'object') return valeurs;
          if (repli && typeof repli === 'object') return repli;
          return null;
        })();
        if (!parametres) return gabarit;
        return gabarit.replace(
          /\{\{(\w+)\}\}/g,
          (/** @type {string} */ entier, /** @type {string} */ nom) => (
            parametres[nom] === undefined ? entier : String(parametres[nom])
          ),
        );
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
 * @param {any} enfants - Les enfants du noeud.
 * @returns {string} Le texte aplati.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l arbre rendu.
 * @param {any} arbre - L arbre monte.
 * @returns {string} Le texte visible.
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

const CLUB_DEMANDE = 'BASKET CLUB DE LETOILE';

/**
 * Le dirigeant de la recette : inscription finie, AUCUN club, une revendication
 * partie il y a quelques secondes.
 */
const dirigeantAvecDemandeEnAttente = {
  clubMembershipRequests: [
    {
      club: { documentId: 'club-1', name: CLUB_DEMANDE },
      documentId: 'req-1',
      state: 'pending',
      type: 'claim',
    },
  ],
  documentId: 'user-1',
  firstname: 'Adel',
  lastname: 'Ferchichi',
  myTeams: [],
  phoneNumber: '+33612345678',
  role: { name: 'Dirigeant', type: 'president' },
  trainedTeams: [],
};

/** Le meme, une fois la demande traitee : il EST dans le club. */
const dirigeantAffilie = {
  ...dirigeantAvecDemandeEnAttente,
  club: { clubVerified: false, documentId: 'club-1', name: CLUB_DEMANDE },
  clubMembershipRequests: [
    {
      club: { documentId: 'club-1', name: CLUB_DEMANDE },
      documentId: 'req-1',
      state: 'processed',
      type: 'claim',
    },
  ],
};

/**
 * Monte l ecran pour l utilisateur donne.
 * @param {any} utilisateurCourant - Le profil courant.
 * @returns {Promise<any>} L arbre monte.
 */
const rendre = async (utilisateurCourant) => {
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
        route={/** @type {any} */ ({ params: {} })}
      />,
    );
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('AFFIL · A3 — le profil du dirigeant montre sa demande en attente', () => {
  it('LE TEMOIN : le club demande apparait, avec « Demande en attente »', async () => {
    const arbre = await rendre(dirigeantAvecDemandeEnAttente);

    // 🔴 AVANT le lot : ces deux lignes etaient FAUSSES. `getProfileClubs` ne
    //    connait que les rattachements reels ; le profil restait vide, et Adel
    //    concluait — a juste titre — que rien n etait parti.
    expect(texteVisible(arbre)).toContain(CLUB_DEMANDE);
    expect(texteVisible(arbre)).toContain('Demande en attente');
  });

  it('⛔ une demande DEJA TRAITEE ne laisse pas de rangee fantome', async () => {
    const arbre = await rendre(dirigeantAffilie);

    // Le club est la parce qu il est SON club, pas parce qu une demande traine.
    expect(texteVisible(arbre)).toContain(CLUB_DEMANDE);
    expect(texteVisible(arbre)).not.toContain('Demande en attente');
  });
});
