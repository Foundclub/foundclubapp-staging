import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserAddress from '@/views/onboarding/UserAddress';
import ProfileEdit from '@/views/profile/ProfileEdit';
import ProfileEditWeb from '@/views/profile/ProfileEdit.web';
import SelfProfileUnified from '@/views/profile/SelfProfileUnified';
import SquadLocationStep from '@/views/team/createSquad/steps/SquadLocationStep';

// D32 — « la recherche de ville ne repond nulle part » (recette Adel du 07/08).
//
// Ces cinq ecrans partagent UNE piece : AutocompleteAddressInput, lui-meme
// assis sur AutocompleteSelect puis sur BottomModal. Un test sur la piece seule
// ne suffit pas : c'est exactement ce qui a laisse cinq ecrans casses en meme
// temps. Chaque appelant est donc monte POUR DE VRAI, et seule la bibliotheque
// native (@gorhom/bottom-sheet) et la couche reseau sont doublees.
//
// Ce que chaque test prouve, dans cet ordre : le champ s'OUVRE, la frappe part
// vers le service, et les propositions REVIENNENT a l'ecran.

const mockSearchPlaces = jest.fn();
const mockUpdateMe = jest.fn();

// Mesure et non supposition : le texte a l'ecran est bien celui qu'Adel a cite.
// ⚠️ AA11 (2026-08-20) a remonte `profile.fields.city.placeholder` dans `fr.js`
// — il n'y etait pas, c'etait le repli passe a t() qui s'affichait. La valeur
// est identique AU CARACTERE PRES, donc l'ecran n'a pas bouge ; ce commentaire
// est corrige plutot que supprime, pour qu'il ne mente plus.
const PLACEHOLDER_PROFIL = 'Rechercher une ville';
const PLACEHOLDER_EQUIPE = 'Rechercher une ville...';
const PLACEHOLDER_RECHERCHE = 'Rechercher...';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: (/** @type {any} */ props) => props.children,
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-native-gesture-handler', () => {
  const { ScrollView } = jest.requireActual('react-native');
  return { ScrollView };
});

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

jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));

jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));

// Seule la bibliotheque NATIVE est doublee : la feuille rend ses enfants et
// expose present/dismiss. Tout le code FoundClub de BottomModal reste reel,
// c'est lui qui portait le defaut.
jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef(
      (/** @type {any} */ props, /** @type {any} */ ref) => {
        reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
        return reactActuel.createElement(VueRN, null, props.children);
      },
    ),
    BottomSheetScrollView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      props.children,
    ),
    BottomSheetView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      props.children,
    ),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/places/placesService', () => ({
  getPlacesFromCoordinates: jest.fn(),
  searchPlaces: (/** @type {string} */ recherche, /** @type {string} */ type) => (
    mockSearchPlaces(recherche, type)
  ),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: (/** @type {any} */ charge) => {
    mockUpdateMe(charge);
    return Promise.resolve({ ...charge });
  },
}));

jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [{ documentId: 'lvl-1', name: 'Départemental' }] }),
}));

jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [{ documentId: 'sec-1', name: 'Masculin' }] }),
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

jest.mock('@/services/userHistory/userHistoryQueries', () => ({
  useGetMyHistories: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
}));

// `profileFields` decide quels champs le formulaire affiche : sans 'address',
// le champ de ville n'existerait pas et le test passerait pour de mauvaises
// raisons.
const mockChampsDuProfil = [
  'address', 'bestLevel', 'birthdate', 'category', 'firstname', 'height',
  'isLookingForClub', 'jerseyNumber', 'lastname', 'nationality', 'position',
  'preferredSport', 'section', 'weight',
];

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    formatBirthdateToDisplay: (/** @type {string} */ valeur) => String(valeur || ''),
    formatBirthdateToSend: (/** @type {string} */ valeur) => String(valeur || ''),
    getAuthTokens: () => ({ token: 'jeton' }),
    getNextOnboardingRoute: () => null,
    isCurrentClubVerified: false,
    profileFields: mockChampsDuProfil,
    refetchUserData: jest.fn(),
    userData: { documentId: 'user-1', firstname: 'Adel', lastname: 'F' },
    userDataError: null,
    userDataLoading: false,
  }),
}));

// AA11 — cette doublure ne rendait que trois exports, et `ProfileEdit` tire
// desormais la banniere de confirmation d'enregistrement. La chaine
// `celebrationRuntime` -> `celebrationCatalog` -> `notificationTypes` lit
// `NOTIFICATION_TYPES` A LA CHARGE DU MODULE (`notificationTypes.js:7`) : un
// export manquant ne rate pas un test, il empeche la suite entiere de se
// charger. On rend donc le VRAI catalogue de types, et rien d'autre ne change.
jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => ({ token: 'jeton' }),
  getClubRoleKey: () => 'player',
  // AFFIL (2026-08-28) — `SelfProfileUnified` liste desormais les demandes de
  // club EN ATTENTE sous ses clubs. Cette doublure enumere les exports du
  // module : sans cette ligne, l'ecran monte sur `undefined` et les 5 appelants
  // de ce temoin tombent d'un coup. Ici, aucune demande en attente : ce filet-ci
  // parle de la recherche de ville, pas de l'affiliation.
  getPendingClubRequests: () => [],
  getProfileClubs: (/** @type {any} */ utilisateur) => (
    utilisateur?.club ? [utilisateur.club] : []
  ),
  getUserRoleKey: () => 'player',
  NOTIFICATION_TYPES: jest.requireActual('@/domains/auth/authUseCases').NOTIFICATION_TYPES,
  profileFieldToDisplay: () => [],
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ club: null, getClubInitials: () => 'FC', isLoading: false }),
}));

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: () => 'geohash-test' }),
}));

jest.mock('@react-native-community/slider', () => 'Slider');

/**
 * Fabrique une doublure de conteneur qui rend simplement ses enfants.
 * @returns {any} Le module double.
 */
const conteneurTransparent = () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
  };
};

jest.mock('@/components/templates/ScreenContainer', () => conteneurTransparent());
jest.mock('@/components/templates/FormScreenContainer', () => conteneurTransparent());
jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => conteneurTransparent(),
);
jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => conteneurTransparent());

jest.mock('@/components/molecules/selectAvatar/SelectAvatar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/views/onboarding/components/OnboardingSkipLink', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/views/onboarding/components/OnboardingStateView', () => ({
  __esModule: true,
  default: () => null,
}));

// La saisie s'enregistre sous son placeholder : le test la retrouve par ce
// libelle, jamais par sa position dans l'arbre.
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: SaisieRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <SaisieRN
        editable={proprietes.editable}
        onChangeText={proprietes.onChangeText}
        placeholder={proprietes.placeholder}
        testID={`saisie:${proprietes.placeholder || proprietes.label || ''}`}
        value={proprietes.value}
      />
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

jest.mock('@/components/atoms/checkable/Checkable', () => {
  const { Text: TexteRN, TouchableOpacity: Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { setIsChecked, text }) => (
      <Pressable onPress={setIsChecked}>
        <TexteRN>{text}</TexteRN>
      </Pressable>
    ),
  };
});

/**
 * Deux lieux credibles, a la forme exacte que rend la BAN.
 * @returns {any[]} La reponse.
 */
const reponseBan = () => ([
  {
    geometry: { coordinates: [4.8357, 45.764] },
    properties: {
      city: 'Lyon',
      context: '69, Rhône',
      id: 'ban-1',
      label: 'Lyon',
      postcode: '69000',
      type: 'municipality',
    },
  },
  {
    geometry: { coordinates: [4.85, 45.75] },
    properties: {
      city: 'Lyon',
      context: '69, Rhône',
      id: 'ban-2',
      label: 'Lyon 3e Arrondissement',
      postcode: '69003',
      type: 'municipality',
    },
  },
]);

/**
 * Aplati les enfants d'un element React en une chaine.
 * @param {any} enfants Les enfants.
 * @returns {string} Le texte.
 */
const aplatirEnfants = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirEnfants).join(' ');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirEnfants(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte porte par un noeud de l'arbre de test.
 * @param {any} noeud Le noeud.
 * @returns {string} Le texte.
 */
const texteDe = (noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ t) => aplatirEnfants(t.props.children))
  .join(' ');

/**
 * La zone pressable qui porte un libelle donne.
 * @param {any} arbre L'arbre rendu.
 * @param {string} libelle Le texte visible cherche.
 * @returns {any} La zone pressable.
 */
const pressablePortant = (arbre, libelle) => arbre.root.findAllByType(TouchableOpacity)
  .filter((/** @type {any} */ noeud) => typeof noeud.props.onPress === 'function')
  .find((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));

/**
 * Laisse passer les minuteries et les micro-taches.
 * @param {number} tours Nombre de tours de boucle.
 * @returns {Promise<void>} Rien.
 */
const laisserRespirer = async (tours = 5) => {
  for (let index = 0; index < tours; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
  }
};

/**
 * Monte un ecran dans un vrai fournisseur react-query.
 * @param {any} noeud L'element a monter.
 * @returns {any} L'arbre rendu.
 */
const monter = (noeud) => {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false, staleTime: 0 } },
  });
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>{noeud}</QueryClientProvider>,
    );
  });
  return arbre;
};

/**
 * Ouvre le champ de ville, tape une recherche, et rend le texte affiche.
 * @param {any} arbre L'arbre rendu.
 * @param {string} placeholder Le placeholder du champ ferme.
 * @returns {Promise<string>} Le texte visible apres la recherche.
 */
const chercherUneVille = async (arbre, placeholder) => {
  const champ = pressablePortant(arbre, placeholder);
  expect(champ).toBeDefined();

  act(() => {
    champ.props.onPress();
  });
  await laisserRespirer(2);

  const saisie = arbre.root.findAllByType(TextInput)
    .find((/** @type {any} */ noeud) => noeud.props.testID === `saisie:${PLACEHOLDER_RECHERCHE}`);
  expect(saisie).toBeDefined();

  await act(async () => {
    saisie.props.onChangeText('lyon');
  });
  await laisserRespirer();

  return arbre.root.findAllByType(Text)
    .map((/** @type {any} */ t) => aplatirEnfants(t.props.children))
    .join(' | ');
};

describe('D32 — taper une ville rend des propositions, sur les CINQ appelants', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSearchPlaces.mockResolvedValue(reponseBan());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('1/5 — inscription, ecran « Ou habites-tu ? »', async () => {
    const arbre = monter(<UserAddress navigation={{ navigate: jest.fn() }} />);
    const affiche = await chercherUneVille(arbre, PLACEHOLDER_PROFIL);

    expect(mockSearchPlaces).toHaveBeenCalledWith('lyon', undefined);
    expect(affiche).toContain('Lyon (69000)');
    expect(affiche).toContain('Lyon 3e Arrondissement (69003)');
  });

  it('2/5 — creation d\'equipe, etape « Ou joues-tu ? »', async () => {
    const arbre = monter(
      <SquadLocationStep
        data={{}}
        onNext={jest.fn()}
        onPrev={jest.fn()}
        updateData={jest.fn()}
      />,
    );
    const affiche = await chercherUneVille(arbre, PLACEHOLDER_EQUIPE);

    expect(mockSearchPlaces).toHaveBeenCalledWith('lyon', undefined);
    expect(affiche).toContain('Lyon (69000)');
  });

  it('3/5 — ancien formulaire de profil', async () => {
    const arbre = monter(<ProfileEdit navigation={{ goBack: jest.fn(), navigate: jest.fn() }} />);
    const affiche = await chercherUneVille(arbre, PLACEHOLDER_PROFIL);

    expect(mockSearchPlaces).toHaveBeenCalledWith('lyon', undefined);
    expect(affiche).toContain('Lyon (69000)');
  });

  it('4/5 — variante SITE du formulaire de profil', async () => {
    const arbre = monter(
      <ProfileEditWeb navigation={{ goBack: jest.fn(), navigate: jest.fn() }} />,
    );
    const affiche = await chercherUneVille(arbre, PLACEHOLDER_PROFIL);

    expect(mockSearchPlaces).toHaveBeenCalledWith('lyon', undefined);
    expect(affiche).toContain('Lyon (69000)');
  });

  it('5/5 — profil dirigeant unifie, champ « Ville » ouvert dans une feuille', async () => {
    const arbre = monter(
      <SelfProfileUnified navigation={{ goBack: jest.fn(), navigate: jest.fn() }} />,
    );

    // Ici le champ vit DANS une premiere feuille : il faut d'abord ouvrir la
    // ligne « Ville » du profil. Une feuille dans une feuille — c'est ce qui
    // rend cet appelant different des quatre autres.
    const ligneVille = pressablePortant(arbre, 'Ville');
    expect(ligneVille).toBeDefined();
    act(() => {
      ligneVille.props.onPress();
    });
    await laisserRespirer(2);

    const affiche = await chercherUneVille(arbre, PLACEHOLDER_PROFIL);

    expect(mockSearchPlaces).toHaveBeenCalledWith('lyon', undefined);
    expect(affiche).toContain('Lyon (69000)');
  });
});
