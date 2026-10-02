import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';
import { buildWebPath, readWebQueryParams } from '@/navigation/webRoutes';

import UserDetails from '../UserDetails';

// PROFIL-JOUEUR (audit V1, A18 + A19) — DEUX PORTES DU PROFIL QUI MENTAIENT.
//
// A18 — « Voir mon profil comme les autres » laissait supprimer. L'apercu
// emprunte la page publique, mais le bloc « Historique sportif » y etait
// branche sur `isSelfProfile` (VRAI en apercu : on lit son propre compte) au
// lieu d'`isOwnerView` (FAUX en apercu : on montre ce que voient les autres).
// Corbeilles, « + Ajouter » et appui pour modifier restaient donc actifs dans
// une vitrine. Les autres blocs de la page avaient ete corriges par D54.
//
// A19 — « Suivi › Retours du coach » ouvrait l'APERCU, c'est-a-dire la seule
// page d'ou les retours sont volontairement retires (ils sont prives). Et le
// bloc qui les montrait a leur proprietaire n'etait plus atteint par un joueur
// depuis D39 : un joueur ne pouvait lire ses retours nulle part.
//
// Ce fichier monte `UserDetails` (le composant de la ROUTE), avec le VRAI
// `SelfProfilePlayerCoach` et le VRAI `UserHistorySection` : ce sont eux qui
// portaient les deux defauts. Seuls les services sont doubles. On n'observe
// que le texte visible, les libelles d'accessibilite et ce qui part vers la
// navigation — jamais la forme de l'arbre.

/** @type {any} */
let mockAuthValue;
/** @type {any} */
let mockPersonalStats;
/** Le profil d'un AUTRE compte, tel que `GET /firebase-auth/:id` le rend. */
/** @type {any} */
let mockFetchedUser;
/** @type {any[]} */
let mockMyHistories = [];
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockDeleteHistory = jest.fn();

jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useBlockUser: () => ({ isPending: false, mutate: jest.fn() }),
  useGetMyBlockedUsers: () => ({ data: [], refetch: jest.fn() }),
  useUnblockUser: () => ({ isPending: false, mutate: jest.fn() }),
}));

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
        if (repli && typeof repli === 'object' && typeof repli.defaultValue === 'string') {
          return repli.defaultValue;
        }
        if (repli && typeof repli === 'object' && typeof repli.count === 'number') {
          return String(repli.count);
        }
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQuery: () => ({ data: undefined, isLoading: false, refetch: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: jest.fn(),
  // ST-VUES2 — la marque « lu » des retours du coach, posee quand la rangee s ouvre.
  updateMyGuidance: jest.fn(() => Promise.resolve(null)),
}));

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
  default: () => ({ startGroupChat: jest.fn(), startWhisperChat: jest.fn() }),
}));

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => 'geohash-test' }),
}));

jest.mock('@/services/auth/authQueries', () => ({
  useGetUserById: () => ({
    data: mockFetchedUser, error: undefined, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock('@/services/license/licenseQueries', () => ({
  useUserCurrentLicense: () => ({ data: undefined, refetch: jest.fn() }),
}));

jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: () => ({ data: mockPersonalStats, isLoading: false, refetch: jest.fn() }),
}));

// Le VRAI `UserHistorySection` lit ces trois-la : l'historique de MON compte
// (c'est lui qu'on voit en apercu) et la suppression, qu'on espionne.
jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useDeleteHistory: () => ({ mutate: mockDeleteHistory }),
  useGetMyHistories: () => ({ data: mockMyHistories, isLoading: false, refetch: jest.fn() }),
  useGetUserHistories: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
}));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [] }),
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [] }),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));

jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [] }),
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
  // Fige HORS de la fabrique : un theme neuf a chaque rendu relance les effets.
  const themeFige = {
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
  };

  return {
    __esModule: true,
    default: () => themeFige,
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

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/molecules/selectAvatar/SelectAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>SELECTEUR AVATAR</TexteRN>,
  };
});

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { club, name }) => (
      <TexteRN>{`BLASON:${club?.name || name || ''}`}</TexteRN>
    ),
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

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
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
 * Le pressable dont le texte vaut exactement ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const pressablePortant = (arbre, libelle) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud
    .findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children).trim() === libelle));

/**
 * Appuie sur TOUT ce qu'un doigt peut atteindre (les pressables non grises).
 * @param {any} arbre
 * @returns {Promise<void>}
 */
const toutAppuyer = async (arbre) => {
  const atteignables = arbre.root
    .findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ noeud) => !noeud.props.disabled && noeud.props.onPress);
  await act(async () => {
    atteignables.forEach((/** @type {any} */ noeud) => noeud.props.onPress());
  });
};

/** Les arbres montes, demontes apres chaque temoin (sinon Jest ne s'eteint pas). */
/** @type {any[]} */
const arbresMontes = [];

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
    isCurrentClubVerified: true,
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
        navigation={/** @type {any} */ ({ goBack: mockGoBack, navigate: mockNavigate })}
        route={/** @type {any} */ ({ params: parametresRoute })}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};

/** Le joueur de l'audit : deux experiences, des retours de son entraineur. */
const joueur = {
  club: { clubVerified: true, documentId: 'club-1', name: 'Montrivage FC' },
  documentId: 'user-joueur',
  firstname: 'Hugo',
  lastname: 'Lemaire',
  myTeams: [{ documentId: 'team-9', name: 'U15' }],
  preferredSport: 'football',
  role: { name: 'Joueur' },
  trainedTeams: [],
};

/** Un compte PARENT : son propre profil passe par la page publique, en proprietaire. */
const parent = {
  documentId: 'user-parent',
  firstname: 'Nadia',
  lastname: 'Lemaire',
  role: { name: 'Parent' },
};

const experiences = [
  {
    category: { name: 'U15' },
    club: { name: 'Montrivage FC' },
    documentId: 'hist-1',
    endYear: 2026,
    startYear: 2025,
  },
  {
    customClubName: 'ES Val',
    documentId: 'hist-2',
    endYear: 2025,
    startYear: 2023,
  },
];

/** Trois retours d'exemple, comme la maquette de l'audit. Midi UTC : la date ne bascule pas. */
const retours = [
  {
    comment: 'Bon placement, pense a parler davantage a ta defense.',
    matchLabel: 'Match U15 contre ES Val',
    rating: 7,
    sourceDocumentId: 'evt-1',
    sourceType: 'event',
    submittedAt: '2026-09-27T12:00:00.000Z',
    teamName: 'U15',
  },
  {
    comment: 'Tres bonne seance de vitesse.',
    matchLabel: 'Entrainement U15',
    rating: null,
    sourceDocumentId: 'evt-2',
    sourceType: 'event',
    submittedAt: '2026-09-24T12:00:00.000Z',
    teamName: 'U15',
  },
  {
    comment: 'Relances trop longues en premiere mi-temps.',
    matchLabel: 'Match U15 contre Olympique',
    rating: 6,
    sourceDocumentId: 'evt-3',
    sourceType: 'event',
    submittedAt: '2026-09-20T12:00:00.000Z',
    teamName: 'U15',
  },
];

/** La vue « Retours du coach » de MON profil : le parametre que porte la ligne. */
const VUE_RETOURS = { userId: 'user-joueur', view: 'coachFeedback' };

beforeEach(() => {
  jest.clearAllMocks();
  mockPersonalStats = undefined;
  mockFetchedUser = undefined;
  mockMyHistories = [];
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  jest.restoreAllMocks();
});

describe('PROFIL-JOUEUR · A18 — l\'apercu « comme les autres » est en LECTURE SEULE', () => {
  const APERCU = { preview: true, userId: 'user-joueur' };

  it('montre toujours mes experiences : l\'apercu lit, il ne cache pas', async () => {
    mockMyHistories = experiences;
    const arbre = await rendre(joueur, APERCU);
    const texte = texteVisible(arbre);

    expect(texte).toContain('Historique sportif');
    expect(texte).toContain('Montrivage FC');
    expect(texte).toContain('ES Val');
  });

  it('n\'offre ni « Ajouter une experience » ni « Touche la carte pour modifier »', async () => {
    mockMyHistories = experiences;
    const arbre = await rendre(joueur, APERCU);
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('Ajouter une expérience');
    expect(texte).not.toContain('Touche la carte pour modifier');
  });

  it('aucun appui, nulle part sur la page, ne mene a modifier ni a supprimer', async () => {
    mockMyHistories = experiences;
    const arbre = await rendre(joueur, APERCU);

    await toutAppuyer(arbre);

    // Ni l'assistant d'historique (ajout ou modification)...
    expect(mockNavigate).not.toHaveBeenCalledWith(
      RouteNames.HistoryWizardCategory,
      expect.anything(),
    );
    // ...ni la confirmation de suppression, ni une suppression.
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockDeleteHistory).not.toHaveBeenCalled();
  });

  it('meme liste vide : pas de carte d\'ajout, et le texte que lisent les autres', async () => {
    mockMyHistories = [];
    const arbre = await rendre(joueur, APERCU);
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('Ajouter une expérience');
    expect(texte).not.toContain('Ajoute ton parcours sportif');
  });

  it('un bandeau dit qu\'on est en apercu, et « Quitter » ramene en arriere', async () => {
    const arbre = await rendre(joueur, APERCU);

    expect(texteVisible(arbre)).toContain('Aperçu : c\'est ce que voient les autres.');
    const quitter = pressablePortant(arbre, 'Quitter');
    expect(quitter).toBeDefined();
    await act(async () => {
      quitter.props.onPress();
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('le bandeau reste dans la CHARTE : cyan primary500, aucun jaune (Adel, 30/09)', async () => {
    // Adel a juge « moche » le jaune de la maquette de l'audit : le bandeau
    // n'emploie que des jetons de `theme/colors.js`, teintes par `withAlpha`.
    const genererCouleurs = jest.requireActual('@/theme/colors').default;
    const { withAlpha } = jest.requireActual('@/theme/colors');
    const couleurs = genererCouleurs();
    const jaunes = Object.entries(couleurs)
      .filter(([nom, valeur]) => /^(gold|warning|yellow)/i.test(nom) && typeof valeur === 'string')
      .map(([, valeur]) => String(valeur).toLowerCase());
    expect(jaunes.length).toBeGreaterThan(0);

    const arbre = await rendre(joueur, APERCU);
    const bandeau = arbre.root
      .findAll((/** @type {any} */ noeud) => noeud.props.testID === 'apercu-bandeau')[0];
    expect(bandeau).toBeDefined();
    const styleDuBandeau = StyleSheet.flatten(bandeau.props.style);
    expect(styleDuBandeau.backgroundColor).toBe(withAlpha(couleurs.primary500, 0.12));
    expect(styleDuBandeau.borderColor).toBe(withAlpha(couleurs.primary500, 0.4));

    const toutesLesCouleurs = [bandeau, ...bandeau.findAll(() => true)]
      .flatMap((/** @type {any} */ noeud) => {
        const style = StyleSheet.flatten(noeud.props.style) || {};
        return [style.backgroundColor, style.borderColor, style.color];
      })
      .filter(Boolean)
      .map((couleur) => String(couleur).toLowerCase());
    expect(toutesLesCouleurs.length).toBeGreaterThan(2);
    toutesLesCouleurs.forEach((couleur) => {
      expect(jaunes).not.toContain(couleur);
    });
  });

  it('temoin : hors apercu, sur SON profil public (compte parent), l\'ajout reste', async () => {
    // Le garde-fou ne doit rien retirer a un proprietaire : un compte parent
    // n'a pas d'ecran « voir = modifier », il edite depuis cette page-ci.
    mockMyHistories = experiences;
    const arbre = await rendre(parent, { userId: 'user-parent' });
    const texte = texteVisible(arbre);

    expect(texte).toContain('Ajouter une expérience');
    expect(texte).not.toContain('Aperçu : c\'est ce que voient les autres.');
  });
});

describe('PROFIL-JOUEUR · A19 — « Retours du coach » s\'ouvre sur les retours', () => {
  it('la ligne « Suivi › Retours du coach » ouvre la vue des retours, PAS l\'apercu', async () => {
    mockPersonalStats = { recentCoachFeedback: retours };
    const arbre = await rendre(joueur);

    const ligne = arbre.root
      .findAllByType(TouchableOpacity)
      .find((/** @type {any} */ noeud) => String(noeud.props.accessibilityLabel || '')
        .startsWith('Retours du coach'));
    expect(ligne).toBeDefined();
    // Le nombre annonce par la ligne : celui que la vue devra tenir.
    expect(ligne.props.accessibilityLabel).toBe('Retours du coach : 3');
    await act(async () => {
      ligne.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.UserDetails, VUE_RETOURS);
    expect(mockNavigate).not.toHaveBeenCalledWith(
      RouteNames.UserDetails,
      expect.objectContaining({ preview: true }),
    );
  });

  it('la vue liste chaque retour : le match, la date, la note sur 10, le commentaire', async () => {
    mockPersonalStats = { recentCoachFeedback: retours };
    const arbre = await rendre(joueur, VUE_RETOURS);
    const texte = texteVisible(arbre);

    expect(texte).toContain('RETOURS DU COACH');
    expect(texte).toContain('Match U15 contre ES Val');
    expect(texte).toContain('27/09/2026');
    expect(texte).toContain('7/10');
    expect(texte).toContain('Bon placement, pense a parler davantage a ta defense.');
    // Un retour sans note garde son commentaire, et le dit.
    expect(texte).toContain('Entrainement U15');
    expect(texte).toContain('Commentaire');
    expect(texte).toContain('Tres bonne seance de vitesse.');
    expect(texte).toContain('6/10');
  });

  it('c\'est une vue de lecture : ni le formulaire du profil, ni ses boutons', async () => {
    mockPersonalStats = { recentCoachFeedback: retours };
    const arbre = await rendre(joueur, VUE_RETOURS);
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('Mon profil');
    expect(texte).not.toContain('Enregistrer');
  });

  it('elle les liste TOUS : le nombre annonce par la ligne est tenu (7, pas 5)', async () => {
    const septRetours = Array.from({ length: 7 }, (_, index) => ({
      comment: `Commentaire numero ${index + 1}`,
      matchLabel: `Match ${index + 1}`,
      rating: 5,
      sourceDocumentId: `evt-${index + 1}`,
      sourceType: 'event',
      submittedAt: `2026-09-0${index + 1}T12:00:00.000Z`,
    }));
    mockPersonalStats = { recentCoachFeedback: septRetours };
    const arbre = await rendre(joueur, VUE_RETOURS);
    const texte = texteVisible(arbre);

    septRetours.forEach((retour) => {
      expect(texte).toContain(retour.comment);
    });
  });

  it('dans SA vue, un commentaire se lit EN ENTIER : aucune coupe a 3 lignes', async () => {
    // Le bloc resume (5 retours) coupe a 3 lignes ; la vue dont c'est la seule
    // raison d'etre ne doit pas cacher la fin d'un long retour, sans moyen de
    // l'ouvrir. Temoin STRUCTUREL : Jest ne calcule aucune mise en page.
    mockPersonalStats = { recentCoachFeedback: retours };
    const arbre = await rendre(joueur, VUE_RETOURS);

    const commentaire = arbre.root
      .findAllByType(Text)
      .find((/** @type {any} */ noeud) => (
        aplatirTexte(noeud.props.children) === retours[0].comment
      ));
    expect(commentaire).toBeDefined();
    expect(commentaire.props.numberOfLines).toBeUndefined();
  });

  it('sans aucun retour, la vue le dit au lieu de rester blanche', async () => {
    mockPersonalStats = { recentCoachFeedback: [] };
    const arbre = await rendre(joueur, VUE_RETOURS);

    expect(texteVisible(arbre)).toContain('Aucun retour individuel du coach pour le moment.');
  });

  it('vie privee : sur le profil de QUELQU\'UN D\'AUTRE, le parametre est ignore', async () => {
    // Le serveur refuse deja ces donnees a un tiers
    // (admin `firebase-auth.ts` getPersonalStats : ni soi, ni superadmin => 403).
    // L'ecran, lui, ne doit meme pas proposer la vue.
    mockPersonalStats = { recentCoachFeedback: retours };
    const arbre = await rendre(joueur, { userId: 'autre-1', view: 'coachFeedback' });

    expect(texteVisible(arbre)).not.toContain('Retours du coach');
    expect(texteVisible(arbre)).not.toContain('Bon placement');
  });

  it('vie privee : en APERCU, le parametre est ignore aussi', async () => {
    mockPersonalStats = { recentCoachFeedback: retours };
    const arbre = await rendre(joueur, { ...VUE_RETOURS, preview: true });

    expect(texteVisible(arbre)).not.toContain('Bon placement');
  });

  it('sur le SITE, le parametre de la vue voyage dans l\'adresse et revient tel quel', () => {
    const adresse = new URL(buildWebPath(RouteNames.UserDetails, VUE_RETOURS), 'https://foundclub.app');

    expect(adresse.pathname).toBe('/users/user-joueur');
    expect(readWebQueryParams(adresse.searchParams).view).toBe('coachFeedback');
  });
});

// PARENT-RETOURS (Adel, 30/09, « parent B ») — le parent DECLARE d'un joueur MINEUR lit
// les retours du coach de son enfant. Une entree sur le profil de l'enfant ouvre CETTE
// vue, sur l'enfant : meme ecran, meme bloc `CoachFeedbackList`.
// Le serveur (admin `firebase-auth.ts` getPersonalStats) ne rend au parent QUE les
// retours : l'ecran ne doit donc pas afficher des zeros a la place des statistiques.
// Le lien et l'age viennent du profil public (`parentAccount`, `age`) ; le serveur
// reste le seul juge — l'ecran ne fait que ne pas proposer ce qui serait refuse.
describe('PARENT-RETOURS — le parent d\'un mineur lit les retours du coach de son enfant', () => {
  /**
   * Le compte de l'enfant, tel que le profil public le rend.
   * @param {object} [surcharge]
   * @returns {any}
   */
  const enfant = (surcharge = {}) => ({
    age: 15,
    documentId: 'user-enfant',
    firstname: 'Léa',
    lastname: 'Lemaire',
    parentAccount: { documentId: 'user-parent' },
    role: { name: 'Joueur' },
    ...surcharge,
  });
  const VUE_RETOURS_ENFANT = { userId: 'user-enfant', view: 'coachFeedback' };
  /** La reponse REDUITE que le serveur rend au parent. */
  const statsDuParent = { recentCoachFeedback: retours, userDocumentId: 'user-enfant' };

  /**
   * L'entree « Retours du coach » de la fiche de l'enfant.
   * @param {any} arbre
   * @returns {any}
   */
  const entreeRetours = (arbre) => arbre.root
    .findAllByType(TouchableOpacity)
    .find((/** @type {any} */ noeud) => String(noeud.props.accessibilityLabel || '')
      .startsWith('Voir les retours du coach'));

  it('sur la fiche de son enfant mineur, l\'entrée ouvre la vue des retours SUR L\'ENFANT', async () => {
    mockFetchedUser = enfant();
    mockPersonalStats = statsDuParent;
    const arbre = await rendre(parent, { userId: 'user-enfant' });

    const entree = entreeRetours(arbre);
    expect(entree).toBeDefined();
    await act(async () => {
      entree.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.UserDetails, VUE_RETOURS_ENFANT);
  });

  it('la vue liste les retours de l\'enfant, et dit de qui il s\'agit', async () => {
    mockFetchedUser = enfant();
    mockPersonalStats = statsDuParent;
    const arbre = await rendre(parent, VUE_RETOURS_ENFANT);
    const texte = texteVisible(arbre);

    expect(texte).toContain('RETOURS DU COACH');
    expect(texte).toContain('Léa Lemaire');
    expect(texte).toContain('Match U15 contre ES Val');
    expect(texte).toContain('7/10');
    expect(texte).toContain('Bon placement, pense a parler davantage a ta defense.');
    // Une lecture : ni le formulaire, ni ses boutons.
    expect(texte).not.toContain('Enregistrer');
  });

  it('sur la fiche, les statistiques ne s\'affichent pas en zéros : elles restent à l\'enfant', async () => {
    mockFetchedUser = enfant();
    mockPersonalStats = statsDuParent;
    const arbre = await rendre(parent, { userId: 'user-enfant' });

    // ST-VUES (02/10, planche 17, « profil A ») : la carte « Ces statistiques ne sont
    // visibles que par la personne elle-même » DISPARAIT (note « retiré »). Ce que ce
    // temoin protegeait tient toujours : aucun chiffre, aucun zero, sur la fiche.
    const texte = texteVisible(arbre);
    expect(texte).not.toContain('Ces statistiques ne sont visibles que par la personne elle-même.');
    expect(texte).not.toContain('Stats de match');
    expect(texte).not.toContain('Minutes');
  });

  it('enfant MAJEUR : ni entrée, ni vue — le lien parental s\'éteint à 18 ans', async () => {
    mockFetchedUser = enfant({ age: 19 });
    mockPersonalStats = statsDuParent;
    const arbre = await rendre(parent, VUE_RETOURS_ENFANT);

    expect(entreeRetours(arbre)).toBeUndefined();
    expect(texteVisible(arbre)).not.toContain('Bon placement');
  });

  it('un autre adulte : ni entrée, ni vue, même avec le paramètre dans l\'adresse', async () => {
    mockFetchedUser = enfant({ parentAccount: { documentId: 'un-autre-parent' } });
    mockPersonalStats = statsDuParent;
    const arbre = await rendre(parent, VUE_RETOURS_ENFANT);

    expect(entreeRetours(arbre)).toBeUndefined();
    expect(texteVisible(arbre)).not.toContain('Bon placement');
  });

  it('âge inconnu : ni entrée, ni vue — la minorité ne se prouve pas', async () => {
    mockFetchedUser = enfant({ age: null });
    mockPersonalStats = statsDuParent;
    const arbre = await rendre(parent, VUE_RETOURS_ENFANT);

    expect(entreeRetours(arbre)).toBeUndefined();
    expect(texteVisible(arbre)).not.toContain('Bon placement');
  });
});
