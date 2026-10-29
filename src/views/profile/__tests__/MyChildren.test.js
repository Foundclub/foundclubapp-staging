import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { annoncer, effacerLAnnonce } from '@/views/profile/parent/annonceDeLaFiche';

import MyChildren from '../MyChildren';

/**
 * PAR-L5L6 — CHAQUE ARBRE MONTÉ EST DÉMONTÉ À LA FIN DE SON TÉMOIN. L'annonce du dernier geste
 * (« La fiche de Martin est supprimée. ») vit en mémoire et PRÉVIENT tous les écrans montés :
 * sans démontage, les arbres des témoins précédents se redessinaient tous à chaque annonce
 * (mesuré : 4 témoins au-delà de 5 s dans la suite complète, 0,3 s seuls).
 * @type {any[]}
 */
const arbresMontes = [];
const creerUnArbre = renderer.create;
renderer.create = (/** @type {any[]} */ ...args) => {
  const arbre = creerUnArbre(...args);
  arbresMontes.push(arbre);
  return arbre;
};
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

/**
 * PARENT P2 — ÉCRAN 7 : « MES ENFANTS ».
 *
 * 👁️ CES TÉMOINS LISENT L'ÉCRAN RENDU, ils ne comparent pas deux tableaux
 * écrits à la main. C'est la leçon payée le 08/09 sur ce même chantier : un
 * témoin affirmait qu'un parent n'avait pas la section « Entraînement », il
 * restait VERT, et c'était FAUX — il ne lisait pas l'écran.
 *
 * Ce que l'écran doit montrer (plan PARENT, écran 7) : une carte par enfant avec
 * son prénom, son ÂGE et son équipe ; et, sans aucun enfant, un grand bouton
 * pour en ajouter au lieu d'une page muette.
 *
 * 🔒 LES TROIS TRANCHES D'ÂGE (E17) se voient ICI, parce que c'est ici que le
 * parent choisit d'agir : « chercher un club » n'existe que sous 13 ans.
 */

/** @type {any} */
let mockEnfants;
/** @type {any} */
let mockIsLoading;
const mockNavigate = jest.fn();
const mockPush = jest.fn();
const mockGoBack = jest.fn();
const mockSupprimer = jest.fn();

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const brut = String(cle || '');
        const compte = (repli && typeof repli === 'object' ? repli : options)?.count;
        const cheminPluriel = typeof compte === 'number'
          ? `${brut}_${compte === 1 ? 'one' : 'other'}`
          : brut;
        const lire = (/** @type {string} */ chemin) => chemin.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        const valeur = lire(cheminPluriel) ?? lire(brut);
        if (typeof valeur === 'string') {
          return valeur.replace(
            /\{\{(\w+)\}\}/g,
            (/** @type {string} */ _tout, /** @type {string} */ clef) => {
              const source = (repli && typeof repli === 'object' ? repli : options) || {};
              return String(source[clef] ?? '');
            },
          );
        }
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

// PAR-L5L6 (13/10) — les demandes de place de mes enfants (une lecture pour toutes les fiches).
// Doublee comme les autres services : le client HTTP refuse de se charger sans `.env`.
/** @type {any} */
let mockDemandes = [];
/** @type {any[]} */
const mockLecturesDesDemandes = [];
// PAR-L8 (13/10) — « Annuler la demande » : la mutation, doublee ; le temoin rejoue ses issues.
const mockAnnulerLaDemande = jest.fn();
jest.mock('@/services/clubInterestRequest/clubInterestRequestQueries', () => ({
  useCancelClubInterestRequest: () => ({ isPending: false, mutate: mockAnnulerLaDemande }),
  useGetMyClubInterestRequests: (/** @type {any} */ params, /** @type {any} */ options) => {
    mockLecturesDesDemandes.push({ options, params });
    return { data: { data: mockDemandes } };
  },
}));

// 👪 PAR-L11c (14/10) — « Ses evenements » : les inscriptions de MES enfants (toutes),
// et leur annulation. La lecture et la mutation sont doublees ; le temoin rejoue les issues.
/** @type {any} */
let mockInscriptions = [];
/** @type {any} */
let mockErreurInscriptions;
const mockRelireInscriptions = jest.fn();
const mockAnnulerInscription = jest.fn();
jest.mock('@/services/eventChildRegistration/eventChildRegistrationQueries', () => ({
  useAllMyChildRegistrations: () => ({
    data: mockInscriptions,
    error: mockErreurInscriptions,
    refetch: mockRelireInscriptions,
  }),
  useCancelChildRegistration: () => ({ isPending: false, mutate: mockAnnulerInscription }),
}));

// PAR-L8 — la fiche se RELIT apres une annulation (le club a pu accepter entre-temps).
const mockRelireEnfants = jest.fn();
/** @type {any} RW-PARENT — la lecture des fiches en échec. */
let mockErreurEnfants;
jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useDeleteDeclaredChild: () => ({ isPending: false, mutate: mockSupprimer }),
  useGetMyDeclaredChildren: () => ({
    data: mockEnfants,
    error: mockErreurEnfants,
    isLoading: mockIsLoading,
    refetch: mockRelireEnfants,
  }),
}));

/** @type {Record<string, () => void>} PAR-L5L6 — les écouteurs posés par l'écran (« blur »). */
const mockEcouteurs = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: (/** @type {string} */ type, /** @type {() => void} */ ecouteur) => {
      mockEcouteurs[type] = ecouteur;
      return () => { delete mockEcouteurs[type]; };
    },
    goBack: mockGoBack,
    navigate: mockNavigate,
    push: mockPush,
  }),
}));

// PAR-L5L6 (E05) — la feuille « … » : rendue telle quelle quand elle est ouverte, avec son pied.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (isVisible ? (
      <View testID="feuille">
        {children}
        {footerComponent}
      </View>
    ) : null),
  };
});

// ST-RETOURS (02/10) — la carte d un enfant relie compte ses retours du coach pas encore lus :
// elle lit ses retours (personal-stats, la reponse REDUITE au parent) et ce que le parent a deja
// lu. Doubles ici comme les autres services (le client HTTP refuse de se charger sans .env).
/** @type {any} */
let mockSuivi;
/** @type {Record<string, any>} */
let mockStatsParEnfant = {};
jest.mock('@/services/coachFeedback/coachFeedbackQueries', () => ({
  useGetCoachFeedbackFollow: () => ({ data: mockSuivi, isSuccess: mockSuivi !== undefined }),
  useUpdateCoachFeedbackFollow: () => ({ mutate: jest.fn() }),
}));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetPersonalStats: (/** @type {string} */ id) => ({ data: mockStatsParEnfant[id] }),
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
      Images: new Proxy({}, { get: () => 1 }),
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

// RW-PARENT (29/10) — les props de chaque enveloppe sont gardées : le témoin lit le message
// d'erreur qu'elle reçoit (jamais le texte technique du service).
/** @type {any[]} */
const mockEnveloppes = [];
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockEnveloppes.push(props);
      return <View>{props.children}</View>;
    },
  };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

/**
 * Aplati les enfants React en une chaîne.
 * @param {any} enfants - Les enfants React.
 * @returns {string} Le texte.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'écran.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Le texte.
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ')
  // PAR-L5L6 — une pastille porte des espaces INSECABLES (Android 16, `texteInsecable`) :
  // a l oeil, c est un espace. Le temoin lit ce que l oeil lit.
  .replace(/\u00a0/g, ' ');

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MyChildren />);
  });
  return arbre;
};

const unEnfant = (extra = {}) => ({
  age: 9,
  club: null,
  documentId: 'enfant-1',
  firstname: 'Léa',
  lastname: 'Martin',
  number: null,
  photo: null,
  position: null,
  team: null,
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockEnfants = [];
  mockIsLoading = false;
  mockDemandes = [];
  mockLecturesDesDemandes.length = 0;
  mockInscriptions = [];
  mockErreurInscriptions = undefined;
  // L'annonce vit en mémoire (module) : chaque témoin part sans elle.
  effacerLAnnonce();
});

test('P2/7 ① aucun enfant : l\'écran le DIT et offre un grand bouton pour en ajouter', async () => {
  const arbre = await rendre();
  const texte = texteVisible(arbre);

  expect(texte).toContain('Tu n’as pas encore déclaré d’enfant.');
  expect(texte).toContain('Ajouter un enfant');
});

test('P2/7 ② chaque enfant montre son prénom, son ÂGE et son équipe', async () => {
  mockEnfants = [
    unEnfant({ team: { documentId: 'eq-1', name: 'U11 A' } }),
    unEnfant({
      age: 7, documentId: 'enfant-2', firstname: 'Tom', lastname: 'Martin',
    }),
  ];

  const arbre = await rendre();
  const texte = texteVisible(arbre);

  expect(texte).toContain('Léa Martin');
  expect(texte).toContain('9 ans');
  expect(texte).toContain('U11 A');
  expect(texte).toContain('Tom Martin');
  expect(texte).toContain('7 ans');
  // Sans équipe, l'écran ne laisse pas un trou : il le dit.
  expect(texte).toContain('Pas encore d’équipe');
});

// PAR-L5L6 (E04, planche 2) — le compte vit SOUS le titre, en capitales : « 3 ENFANTS » (il
// remplace « 1 enfant déclaré »). Le pluriel reste juste.
test('P2/7 ③ le compte se dit au PLURIEL correctement (1 enfant / 2 enfants)', async () => {
  mockEnfants = [unEnfant()];
  const un = texteVisible(await rendre());
  expect(un).toContain('1 ENFANT');
  expect(un).not.toContain('1 ENFANTS');

  mockEnfants = [unEnfant(), unEnfant({ documentId: 'enfant-2', firstname: 'Tom' })];
  expect(texteVisible(await rendre())).toContain('2 ENFANTS');
});

// PAR-L5L6 (E04) — « Chercher un club pour Léa » quitte la LISTE : il vit sur SA fiche (E07),
// que la carte ouvre. La tranche d age, elle, ne change pas.
test('P2/7 ④ MOINS DE 13 ANS : « chercher un club » est proposé, sur SA fiche', async () => {
  mockEnfants = [unEnfant({ age: 12 })];

  const liste = texteVisible(await rendre());
  expect(liste).not.toContain('Chercher un club pour Léa');
  expect(liste).not.toContain('fait ses demandes lui-même');

  /** @type {any} */
  let fiche;
  await act(async () => {
    fiche = renderer.create(<MyChildren route={{ params: { childDocumentId: 'enfant-1' } }} />);
  });
  expect(texteVisible(fiche)).toContain('Chercher un club pour Léa');
});

test("P2/7 ⑤ 13 À 17 ANS : plus de bouton, et l'écran EXPLIQUE pourquoi", async () => {
  mockEnfants = [unEnfant({ age: 15 })];

  const texte = texteVisible(await rendre());

  expect(texte).not.toContain('Chercher un club pour Léa');
  expect(texte).toContain('fait ses demandes lui-même');
});

test('P2/7 ⑥ 18 ANS ET PLUS : le lien s\'éteint, et l\'écran le dit', async () => {
  mockEnfants = [unEnfant({ age: 18 })];

  const texte = texteVisible(await rendre());

  expect(texte).not.toContain('Chercher un club pour Léa');
  expect(texte).toContain('est majeur');
});

test('P2/7 ⑦ « chercher un club » emmène la recherche AVEC l\'enfant visé', async () => {
  mockEnfants = [unEnfant({ age: 9 })];
  // PAR-L5L6 (E04) — le bouton vit sur SA fiche, plus sur la liste.
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MyChildren route={{ params: { childDocumentId: 'enfant-1' } }} />);
  });

  const bouton = arbre.root.findAll((/** @type {any} */ noeud) => (
    typeof noeud.props?.onPress === 'function'
    && aplatirTexte(noeud.props?.children).includes('Chercher un club pour Léa')
  ))[0];
  expect(bouton).toBeTruthy();

  await act(async () => { bouton.props.onPress(); });

  // La recherche vit dans `SearchStack`, deux niveaux plus bas : c'est
  // `allerDansLOnglet` qui écrit ce chemin, et le témoin exige la forme
  // COMPLÈTE — un nom nu ne descend jamais chez un voisin (défaut du 08/09).
  // RETOUR-ONGLET (30/09) : et avec `pop`, sinon React Navigation 7 EMPILE un second
  // onglet d'accueil au lieu de revenir au premier (A22 de l'audit V1).
  // 🔒 PARENT-FINITIONS 1 (14/10) — l'enfant voyage par son identifiant SEUL : sur le site, les
  // paramètres de la route passent dans l'adresse (`…/search/clubs?childFirstname=Léa`), et le
  // prénom d'un mineur finissait dans les journaux et l'historique. La recherche ne lit que
  // `childDocumentId` (PAR-L4).
  expect(mockNavigate).toHaveBeenCalledWith(
    'HomeTab',
    {
      params: {
        params: { childDocumentId: 'enfant-1' },
        pop: true,
        screen: 'SearchClubs',
      },
      screen: 'Search',
    },
    { pop: true },
  );
});

// ===========================================================================
// PARENT-LIEN (30/09, « lien B » d'Adel) — « LES COMPTES DE MES ENFANTS »
//
// Une rangée par ado RELIÉ (il a accepté depuis son compte) : elle ouvre SON profil, où vit
// « Retours du coach ». Et les deux portes vers le lien : « Relier le compte de mon enfant »
// (13-17 ans qui a déjà son compte) et F20 « Donner un compte à Léa » sur la fiche d'un enfant
// qui a 13 ans.
// ===========================================================================

/** @type {any} */
let mockLiens;
/** @type {any} */
let mockErreurLiens;
const mockAnnuler = jest.fn();
const mockRelireLesLiens = jest.fn();

jest.mock('@/services/parentLink/parentLinkQueries', () => ({
  useCancelParentLink: () => ({ isPending: false, mutate: mockAnnuler }),
  useParentLinksAsParent: () => ({
    data: mockLiens, error: mockErreurLiens, isLoading: false, refetch: mockRelireLesLiens,
  }),
}));

/**
 * Le premier élément pressable dont le texte contient `libelle`.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le texte cherché.
 * @returns {any} Le nœud, ou undefined.
 */
const pressable = (arbre, libelle) => arbre.root.findAll((/** @type {any} */ noeud) => (
  typeof noeud.props?.onPress === 'function'
  && aplatirTexte(noeud.props?.children).includes(libelle)
))[0];

describe('PARENT-LIEN — les comptes de mes enfants', () => {
  beforeEach(() => {
    mockLiens = { children: [], requests: [] };
  });

  // RW-PARENT (29/10, site) — Adel a lu « Parent links (parent) failed: Network Error » sur
  // « Mes enfants » : l'écran passait `erreurLiens.message`, le préfixe de journal du service.
  test('🔴 RW-PARENT la fiche d un enfant, en panne de lecture, parle français aussi', async () => {
    mockErreurEnfants = new Error('Request failed with status code 502');
    mockEnveloppes.length = 0;
    try {
      await act(async () => {
        renderer.create(<MyChildren route={{ params: { childDocumentId: 'enfant-1' } }} />);
      });
      const recues = mockEnveloppes.filter((props) => props.error === mockErreurEnfants);
      expect(recues.length).toBeGreaterThan(0);
      recues.forEach((props) => {
        expect(props.errorMessage).toBe('Impossible de charger tes enfants.');
      });
      expect(mockEnveloppes.some((props) => props.error === mockErreurEnfants.message)).toBe(false);
    } finally {
      mockErreurEnfants = undefined;
    }
  });

  test('🔴 RW-PARENT les comptes reliés en panne : un message français, et on relit', async () => {
    mockErreurLiens = new Error('Parent links (parent) failed: Network Error');
    mockEnveloppes.length = 0;
    try {
      await rendre();
      const recues = mockEnveloppes.filter((props) => props.error === mockErreurLiens);
      expect(recues.length).toBeGreaterThan(0);
      recues.forEach((props) => {
        expect(props.errorMessage).toBe('Impossible de charger tes enfants.');
        props.onRetry();
      });
      expect(mockRelireLesLiens).toHaveBeenCalled();
      expect(mockEnveloppes.some((props) => props.error === mockErreurLiens.message)).toBe(false);
    } finally {
      mockErreurLiens = undefined;
    }
  });

  // ① — avec la porte « Relier le compte de mon enfant ».
  // PAR-L5L6 (E04, planche 2) — plus de titre de section : une seule liste. La porte vers le
  // lien reste là, sans aucune fiche : l'écran vide la porte en lien, la liste en bouton.
  test('LIEN ① la porte vers le lien existe même sans aucune fiche', async () => {
    const vide = await rendre();
    expect(texteVisible(vide)).toContain('Ton enfant a 13 ans ou plus ? Relier son compte');
    await act(async () => { pressable(vide, 'Relier son compte').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ParentLinkInvite', undefined);

    mockNavigate.mockClear();
    mockEnfants = [unEnfant()];
    const liste = await rendre();
    expect(texteVisible(liste)).toContain('Relier le compte de mon enfant');
    await act(async () => { pressable(liste, 'Relier le compte de mon enfant').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ParentLinkInvite', undefined);
  });

  // ② — c'est sur SON profil que vit « Retours du coach ».
  test('LIEN ② une rangée par ado RELIÉ, qui ouvre SON profil', async () => {
    mockLiens = {
      children: [{
        age: 15,
        avatar: null,
        documentId: 'ado-1',
        firstname: 'Inès',
        lastname: 'Martin',
      }],
      requests: [],
    };
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Inès Martin');
    expect(texte).toContain('15 ans');

    await act(async () => { pressable(arbre, 'Inès Martin').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('UserDetails', { userId: 'ado-1' });
  });

  // ③ — sur la fiche d un enfant de 13 ans SANS compte.
  test('LIEN ③ F20 : « Donner un compte à Léa »', async () => {
    mockEnfants = [unEnfant({ age: 13 })];
    const arbre = await rendre();

    const bouton = pressable(arbre, 'Donner un compte à Léa');
    expect(bouton).toBeTruthy();
    await act(async () => { bouton.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ParentLinkInvite', {
      childDocumentId: 'enfant-1',
      childFirstname: 'Léa',
    });
  });

  // ④ — ni avant 13 ans, ni quand la fiche a déjà son compte.
  test('LIEN ④ la porte F20 n existe pas partout', async () => {
    mockEnfants = [
      unEnfant({ age: 9 }),
      unEnfant({
        account: { documentId: 'ado-2' },
        age: 14,
        documentId: 'enfant-2',
        firstname: 'Tom',
      }),
    ];
    const texte = texteVisible(await rendre());

    expect(texte).not.toContain('Donner un compte à Léa');
    expect(texte).not.toContain('Donner un compte à Tom');
    expect(texte).toContain('Tom a son propre compte.');
  });

  test('LIEN ⑤ une demande envoyée se voit (sans rien dire du numéro), et s annule', async () => {
    mockLiens = {
      children: [],
      requests: [{
        declaredChild: { documentId: 'enfant-1', firstname: 'Léa' },
        documentId: 'dem-1',
        phoneHint: '78',
        state: 'pending',
      }],
    };
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Demande envoyée au numéro finissant par 78 (pour Léa).');
    // PAR-L5L6 (C4 du design) — l'appui DEMANDE d'abord : rien ne part sans confirmation.
    await act(async () => { pressable(arbre, 'Annuler la demande de lien').props.onPress(); });
    expect(mockAnnuler).not.toHaveBeenCalled();
    const [titre, message, boutons] = alerte.mock.calls[0];
    expect(titre).toBe('Annuler la demande de lien ?');
    expect(message).toContain('78');
    expect(boutons.map((/** @type {any} */ b) => b.text)).toEqual(['Garder', 'Annuler la demande']);

    await act(async () => { boutons[1].onPress(); });
    expect(mockAnnuler).toHaveBeenCalledWith('dem-1', expect.any(Object));

    // Et un échec se DIT (avant : aucun message).
    await act(async () => { mockAnnuler.mock.calls[0][1].onError(); });
    expect(alerte).toHaveBeenLastCalledWith(
      expect.any(String),
      'Impossible d’annuler cette demande pour le moment.',
    );
    alerte.mockRestore();
  });
});

// ===========================================================================
// ST-RETOURS (02/10) — PLANCHE 22 DU DESIGN VALIDE, ETATS 1 ET 6.
//
// Etat 1 : sur la carte de l enfant RELIE, le nombre de retours de son entraineur que le parent
// n a pas encore lus — il sait s il y a du neuf sans ouvrir.
// Etat 6 : un enfant de moins de 13 ans n a pas de compte, donc ni questionnaire, ni stats, ni
// retours de match : sa carte le dit simplement, au lieu de laisser chercher.
// ===========================================================================

describe('ST-RETOURS — Mes enfants : le neuf, et le moins de 13 ans', () => {
  const HUGO = {
    age: 14, documentId: 'hugo', firstname: 'Hugo', lastname: 'Lemaire',
  };
  const retour = (/** @type {string} */ cle) => ({ comment: 'Bien.', feedbackKey: cle, rating: 7 });

  beforeEach(() => {
    mockLiens = { children: [HUGO], requests: [] };
    mockSuivi = {};
    mockStatsParEnfant = { hugo: { recentCoachFeedback: [retour('event:m1:u15:v1')] } };
  });

  afterEach(() => {
    mockSuivi = undefined;
    mockStatsParEnfant = {};
  });

  test('etat 1 — 🔴 la carte de l enfant relie dit « 1 nouveau · retour de son… »', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('1 nouveau');
    expect(texte).toContain('retour de son entraîneur');
  });

  test('etat 1 — deux retours pas encore lus : « 2 nouveaux »', async () => {
    mockStatsParEnfant = {
      hugo: { recentCoachFeedback: [retour('event:m1:u15:v1'), retour('event:m0:u15:v1')] },
    };
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain('2 nouveaux');
    expect(texteVisible(arbre)).toContain('retours de son entraîneur');
  });

  test('etat 1 — tout est lu : la carte ne dit rien de plus', async () => {
    mockSuivi = { hugo: { seen: ['event:m1:u15:v1'] } };
    const arbre = await rendre();

    expect(texteVisible(arbre)).not.toContain('nouveau');
  });

  test('etat 1 — ce que le parent a lu n est pas encore arrive : rien n est invente', async () => {
    mockSuivi = undefined;
    const arbre = await rendre();

    expect(texteVisible(arbre)).not.toContain('nouveau');
  });

  // PAR-L5L6 (E04) — l'explication quitte la carte de la LISTE : elle est sur SA fiche (E07,
  // témoin « point 4 — la page ») et dans « Comment ça marche ? » (E06).
  test('etat 6 — 🔴 moins de 13 ans : « Stats et retours de match » vit sur SA fiche', async () => {
    mockLiens = { children: [], requests: [] };
    mockEnfants = [unEnfant({ age: 7, firstname: 'Lea', lastname: 'Test' })];
    const liste = texteVisible(await rendre());

    expect(liste).toContain('Lea Test');
    expect(liste).not.toContain('Ils arrivent quand Lea a 13 ans');
    expect(liste).not.toContain('Chercher un club pour Lea');

    /** @type {any} */
    let fiche;
    await act(async () => {
      fiche = renderer.create(<MyChildren route={{ params: { childDocumentId: 'enfant-1' } }} />);
    });
    const texte = texteVisible(fiche);
    expect(texte).toContain('Stats et retours de match');
    expect(texte).toContain('Ils arrivent quand Lea a 13 ans et son propre compte, relié au tien.');
  });

  test('etat 6 — une fiche de 13 ans ou plus ne porte pas cette phrase', async () => {
    mockLiens = { children: [], requests: [] };
    mockEnfants = [unEnfant({ age: 15 })];
    const arbre = await rendre();

    expect(texteVisible(arbre)).not.toContain('Stats et retours de match');
  });

  // STATS-FIX2 · 8-22 (tournee T10, ecran 22) — Lea (7 ans, une fiche) passait AVANT Hugo (son
  // compte relie, celui qui a des retours). La planche 22, etat 1 : « Les comptes de mes
  // enfants » d abord, puis les enfants declares.
  test('🔴 STATS-FIX2 — les comptes relies passent AVANT les fiches declarees', async () => {
    mockEnfants = [unEnfant({ age: 7 })];
    const texte = texteVisible(await rendre());

    expect(texte.indexOf('Hugo Lemaire')).toBeGreaterThan(-1);
    expect(texte.indexOf('Léa Martin')).toBeGreaterThan(-1);
    expect(texte.indexOf('Hugo Lemaire')).toBeLessThan(texte.indexOf('Léa Martin'));
    expect(texte.indexOf('Les comptes de mes enfants'))
      .toBeLessThan(texte.indexOf('Léa Martin'));
  });
});

// ===========================================================================
// ST-RETOURS2 (03/10) — PLANCHE 22 DU DESIGN VALIDE, ETAT 1 : « MES ENFANTS ».
//
// Point 2 : deux sections, chacune avec son titre — « Les comptes de mes enfants », puis
// « Mes enfants de moins de 13 ans ». Le titre de la seconde manquait : les fiches suivaient
// la phrase d aide sans rien qui dise de quoi il s agissait.
// ===========================================================================

/** Les couleurs du theme, les memes que celles de la doublure de `useTheme`. */
const COULEURS = jest.requireActual('@/theme/colors').default();

/**
 * Le style a plat d un noeud (les tableaux de styles fusionnes).
 * @param {any} style - Le style.
 * @returns {any} - Le style a plat.
 */
const styleAPlat = (style) => Object.assign({}, ...[style].flat(Infinity).filter(Boolean));

/**
 * Le noeud HOTE qui porte ce `testID` (celui qui recoit le style).
 * @param {any} arbre - L arbre rendu.
 * @param {string} testID - L etiquette.
 * @returns {any} - Le noeud, ou undefined.
 */
const hote = (arbre, testID) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.type === 'string' && n.props.testID === testID)[0];

/**
 * L element APPUYABLE qui porte ce `testID`.
 * @param {any} arbre - L arbre rendu.
 * @param {string} testID - L etiquette.
 * @returns {any} - L element, ou undefined.
 */
const porteDe = (arbre, testID) => arbre.root.findAll((/** @type {any} */ n) => (
  typeof n.props?.onPress === 'function' && n.props.testID === testID
))[0];

describe('ST-RETOURS2 — Mes enfants (planche 22, etat 1)', () => {
  const HUGO = {
    age: 14, documentId: 'hugo', firstname: 'Hugo', lastname: 'Lemaire',
  };

  beforeEach(() => {
    mockLiens = { children: [HUGO], requests: [] };
  });

  afterEach(() => {
    mockLiens = undefined;
  });

  // PAR-L5L6 (E04, planche 2) — UNE liste, une forme de carte : plus de titres de section. Ce
  // qui distingue un compte relié d'une fiche : sa pastille « A son compte » et sa destination.
  test('🔴 point 2 — une seule liste, le compte relié d abord, sans titres de section', async () => {
    mockEnfants = [unEnfant({ age: 7, firstname: 'Lea', lastname: 'Test' })];
    const texte = texteVisible(await rendre());

    expect(texte).not.toContain('Mes enfants de moins de 13 ans');
    expect(texte).not.toContain('Les comptes de mes enfants');
    expect(texte.indexOf('Hugo Lemaire')).toBeGreaterThan(-1);
    expect(texte.indexOf('Hugo Lemaire')).toBeLessThan(texte.indexOf('Lea Test'));
    expect(texte).toContain('Hugo Lemaire | 14 ans | A son compte');
  });

  // Point 2 bis — la carte de Hugo dit, comme la planche, « 14 ans · U15 · AS Montrivage » : son
  // age (le lien), son equipe et son club (son profil public, la lecture que fait deja SA fiche).
  // PAR-L5L6 (13/10) — remarque d'Adel : « on voit bien que les enfants sont dans aucun club ».
  // La carte de Hugo dit son âge, puis son club SUR SA LIGNE (« Club AS Montrivage »), puis son
  // équipe (« Équipe U15 ») — plus « 14 ans · U15 · AS Montrivage », où le club se perdait.
  test('🔴 point 2 bis — la carte de Hugo : « Club AS Montrivage », « Équipe U15 »', async () => {
    mockProfils = {
      hugo: { club: { name: 'AS Montrivage' }, myTeams: [{ documentId: 'u15', name: 'U15' }] },
    };
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Hugo Lemaire | 14 ans | A son compte | Club  AS Montrivage');
    expect(texte).toContain('Équipe  U15');
    expect(texte).not.toContain('14 ans · U15 · AS Montrivage');
  });

  // FINITIONS13-STATS · point 3 (T13, tranche par le chef « A ») — Hugo joue en U13 ET en U15 :
  // la carte ne prend plus sa PREMIERE equipe, elle les dit toutes, dans l ordre de son profil.
  test('🔴 FIN13-STATS 3 — 2 equipes : « Club AS Montrivage », « Équipes U13 · U15 »', async () => {
    mockProfils = {
      hugo: {
        club: { name: 'AS Montrivage' },
        myTeams: [{ documentId: 'u13', name: 'U13' }, { documentId: 'u15', name: 'U15' }],
      },
    };
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Club  AS Montrivage');
    expect(texte).toContain('Équipes  U13 · U15');
  });

  // 🎨 FINITIONS15 point 9d (tournée T14, S03d) — « 14 ans · U13 · Seniors A · U15 ·
  // AS Montrivage » : « Seniors A » est une équipe de Recette Stripe FC, la ligne la rangeait
  // sous AS Montrivage (le club du profil, posé en bout de ligne). Chaque équipe va sous SON
  // club (`myTeams.club`) ; le club de l'enfant d'abord. Planche 22 : « équipe · club ».
  test('🔴 FIN15 9d — une équipe d un autre club se range sous SON club', async () => {
    mockProfils = {
      hugo: {
        club: { name: 'AS Montrivage' },
        myTeams: [
          { club: { name: 'AS Montrivage' }, documentId: 'u13', name: 'U13' },
          { club: { name: 'Recette Stripe FC' }, documentId: 'seniors-a', name: 'Seniors A' },
          { club: { name: 'AS Montrivage' }, documentId: 'u15', name: 'U15' },
        ],
      },
    };
    const texte = texteVisible(await rendre());

    // PAR-L5L6 — chaque club a SA ligne, ses équipes dessous ; le club de l'enfant d'abord.
    const premier = texte.indexOf(
      'Club  AS Montrivage | Club | AS Montrivage | Équipes  U13 · U15',
    );
    const second = texte.indexOf(
      'Club  Recette Stripe FC | Club | Recette Stripe FC | Équipe  Seniors A',
    );
    expect(premier).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(premier);
  });

  test('point 2 bis — profil pas encore lu : la carte dit l age seul, sans trou', async () => {
    mockProfils = {};
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Hugo Lemaire | 14 ans |');
  });

  // Point 2 ter — la planche : la carte de Hugo porte une fleche (plus le texte « Voir son
  // profil », qui reste dit au lecteur d ecran) et son bord est VIF quand il y a du neuf.
  test('🔴 point 2 ter — la carte de Hugo : une fleche, le bord VIF s il y a du neuf', async () => {
    mockSuivi = {};
    mockStatsParEnfant = {
      hugo: {
        recentCoachFeedback: [{ comment: 'Bien.', feedbackKey: 'event:m1:u15:v1', rating: 7 }],
      },
    };
    const arbre = await rendre();
    const carte = hote(arbre, 'linked-child-hugo');

    expect(texteVisible(arbre)).not.toContain('Voir son profil');
    expect(carte.findAll((/** @type {any} */ n) => n.props?.name === 'arrow-right').length)
      .toBeGreaterThan(0);
    expect(styleAPlat(carte.props.style).borderColor).toBe(COULEURS.primary500);
    expect(porteDe(arbre, 'linked-child-hugo').props.accessibilityLabel)
      .toBe('Hugo Lemaire, Voir son profil');
    mockSuivi = undefined;
    mockStatsParEnfant = {};
  });

  test('point 2 ter — tout est lu : le bord de la carte de Hugo redevient discret', async () => {
    mockSuivi = { hugo: { seen: ['event:m1:u15:v1'] } };
    mockStatsParEnfant = {
      hugo: {
        recentCoachFeedback: [{ comment: 'Bien.', feedbackKey: 'event:m1:u15:v1', rating: 7 }],
      },
    };
    const carte = hote(await rendre(), 'linked-child-hugo');

    expect(styleAPlat(carte.props.style).borderColor).not.toBe(COULEURS.primary500);
    mockSuivi = undefined;
    mockStatsParEnfant = {};
  });

  // PAR-L5L6 (E04) — Hugo est relié, aucune fiche : ce n'est PAS l'écran vide (il y a un
  // enfant). La liste le montre, et « Ajouter un enfant » reste là.
  test('🔴 point 2 — compte relié, 0 fiche : pas d écran vide, « Ajouter un enfant »', async () => {
    mockEnfants = [];
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Hugo Lemaire');
    expect(texte).not.toContain('Tu n’as pas encore déclaré d’enfant.');
    expect(texte).toContain('Ajouter un enfant');
    expect(texte).toContain('1 ENFANT');
  });
});

// ===========================================================================
// ST-RETOURS2 (03/10) — PLANCHE 22, ETAT 6 : LA PAGE D UN ENFANT DE MOINS DE 13 ANS.
//
// Point 4 : Lea n a pas de compte (une fiche declaree par son parent). La planche lui donne SA
// page : le titre « Lea », la carte centree (« Lea Test », « 7 ans · pas encore d equipe »,
// « Mon enfant »), « Stats et retours de match — Ils arrivent quand Lea a 13 ans et son propre
// compte, relie au tien. », et « Chercher un club pour Lea ». Rien ne menait a une page : la
// fiche n etait qu une carte de la liste.
//
// 🧭 La page est une VUE de la route « Mes enfants » (`childDocumentId`), comme « Retours du
// coach » et « Mes stats » sur la route du profil : aucune route neuve, le site la sert deja
// (`/profile/children?childDocumentId=…`). Les donnees : la liste deja lue, rien de plus.
// ===========================================================================

describe('ST-RETOURS2 — la page d un enfant de moins de 13 ans (planche 22, etat 6)', () => {
  const LEA = unEnfant({
    age: 7, documentId: 'lea', firstname: 'Lea', lastname: 'Test',
  });

  /**
   * Monte la VUE « fiche de l enfant » de l ecran.
   * @param {string} childDocumentId - La fiche ouverte.
   * @returns {Promise<any>} L arbre rendu.
   */
  const rendreLaFiche = async (childDocumentId) => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<MyChildren route={{ params: { childDocumentId } }} />);
    });
    return arbre;
  };

  beforeEach(() => {
    mockLiens = { children: [], requests: [] };
    mockEnfants = [LEA];
  });

  afterEach(() => {
    mockLiens = undefined;
  });

  test('🔴 point 4 — la carte de Lea, dans « Mes enfants », ouvre SA page', async () => {
    const arbre = await rendre();

    const porte = porteDe(arbre, 'declared-child-lea');
    expect(porte).toBeTruthy();
    expect(porte.props.accessibilityLabel).toBe('Lea Test, Voir sa fiche');
    expect(porte.findAll((/** @type {any} */ n) => n.props?.name === 'arrow-right').length)
      .toBeGreaterThan(0);
    await act(async () => { porte.props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('MyChildren', { childDocumentId: 'lea' });
  });

  test('🔴 point 4 — la page : « LEA », la carte, ce qui viendra a 13 ans, le club', async () => {
    const texte = texteVisible(await rendreLaFiche('lea'));

    expect(texte).toContain('LEA');
    // PAR-L5L6 (E07) — la ligne sous le nom dit l'âge seul : l'équipe a SON bloc.
    expect(texte).toContain('AVATAR:Lea Test | Lea Test | 7 ans | Mon enfant');
    expect(texte).toContain('Son équipe | Pas encore d’équipe | Chercher un club pour Lea');
    expect(texte).toContain('Stats et retours de match');
    expect(texte).toContain('Ils arrivent quand Lea a 13 ans et son propre compte, relié au tien.');
    expect(texte).toContain('Chercher un club pour Lea');
    // C est SA page, pas la liste.
    expect(texte).not.toContain('Les comptes de mes enfants');
    expect(texte).not.toContain('MES ENFANTS');
  });

  test('🔴 point 4 — « Chercher un club pour Lea » emmene la recherche AVEC Lea', async () => {
    const arbre = await rendreLaFiche('lea');

    await act(async () => { pressable(arbre, 'Chercher un club pour Lea').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(
      'HomeTab',
      {
        params: {
          params: { childDocumentId: 'lea' },
          pop: true,
          screen: 'SearchClubs',
        },
        screen: 'Search',
      },
      { pop: true },
    );
  });

  test('🔴 point 4 — une fiche qui n existe plus : la page le dit', async () => {
    const texte = texteVisible(await rendreLaFiche('effacee'));

    expect(texte).toContain('Cette fiche n’existe plus.');
    expect(texte).not.toContain('Chercher un club');
  });

  test('🔒 point 4 — la fiche d un enfant de 13 ans ou plus n a pas cette porte', async () => {
    mockEnfants = [unEnfant({ age: 15 })];
    const arbre = await rendre();

    expect(porteDe(arbre, 'declared-child-enfant-1')).toBeUndefined();
  });
});

// ST-RETOURS2 · point 2 bis — le profil public d un enfant relie (son equipe, son club), lu par
// la carte de « Mes enfants ». Double comme les autres services (pas de client HTTP sans `.env`).
/** @type {Record<string, any>} */
let mockProfils = {};
jest.mock('@/services/auth/authQueries', () => ({
  useGetUserById: (/** @type {string} */ id) => ({ data: mockProfils[id] }),
}));

// ===========================================================================
// PAR-L5L6 (13/10) — E04 « MES ENFANTS » (design parent, planche 2) ET LA REMARQUE D'ADEL.
//
// Adel, 13/10 vers 01h33, après la recette de PAR-006 sur son iPhone : « on voit bien que les
// enfants sont dans aucun club ». En base, Anissa EST dans l'équipe Senior du club FoundClub :
// le club n'était écrit qu'en petit au bout de la ligne, sans le mot « club ».
// Une carte courte par enfant : son nom, son âge, une pastille d'état, et le club sur SA ligne.
// Les demandes de place se lisent UNE fois pour toutes les fiches.
// ===========================================================================

describe('PAR-L5L6 E04 — la carte courte d un enfant déclaré', () => {
  const FOUNDCLUB = { documentId: 'club-fc', name: 'FoundClub' };
  const SMUC = { documentId: 'club-smuc', name: 'SMUC' };
  const ANISSA = unEnfant({
    age: 11,
    club: FOUNDCLUB,
    documentId: 'anissa',
    firstname: 'Anissa',
    lastname: 'Test',
    team: { documentId: 'senior', name: 'Senior' },
  });
  const MARTIN = unEnfant({
    age: 9, documentId: 'martin', firstname: 'Martin', lastname: 'Test',
  });
  const demandeDeMartin = (extra = {}) => ({
    club: SMUC,
    createdAt: '2026-10-11T09:00:00.000Z',
    declaredChild: { documentId: 'martin', firstname: 'Martin' },
    documentId: 'dem-m1',
    status: 'pending',
    team: { club: SMUC, documentId: 'basket', name: 'Basket' },
    ...extra,
  });

  beforeEach(() => {
    mockLiens = { children: [], requests: [] };
  });

  afterEach(() => {
    mockLiens = undefined;
  });

  test('🔴 Adel 13/10 — Anissa : « En équipe », « Club FoundClub », « Équipe Senior »', async () => {
    mockEnfants = [ANISSA];
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Anissa Test | 11 ans | En équipe | Club  FoundClub');
    expect(texte).toContain('Équipe  Senior');
    expect(texte).not.toContain('11 ans · Senior · FoundClub');
    // Elle a une équipe : « Chercher un club pour Anissa » n'est pas l'action de sa carte.
    expect(texte).not.toContain('Chercher un club pour Anissa');
  });

  test('🔴 une demande en attente : la pastille, le club, puis l équipe DEMANDÉE', async () => {
    mockEnfants = [MARTIN];
    mockDemandes = [demandeDeMartin()];
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Martin Test | 9 ans | Demande en attente | Club  SMUC');
    expect(texte).toContain('Équipe demandée  Basket');
  });

  test('deux demandes en attente : le nombre ; la fiche les détaille', async () => {
    mockEnfants = [MARTIN];
    mockDemandes = [
      demandeDeMartin(),
      demandeDeMartin({ documentId: 'dem-m2', team: { documentId: 'u11', name: 'U11' } }),
    ];
    const texte = texteVisible(await rendre());

    expect(texte).toContain('2 demandes en attente');
    expect(texte).not.toContain('Équipe demandée');
  });

  test('ni équipe ni demande : « Pas encore d’équipe », et aucune ligne de club', async () => {
    mockEnfants = [MARTIN];
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain('Martin Test | 9 ans | Pas encore d’équipe');
    expect(hote(arbre, 'declared-child-club-martin')).toBeUndefined();
  });

  test('la demande d un frère ne colore pas la carte de l autre', async () => {
    mockEnfants = [unEnfant(), MARTIN];
    mockDemandes = [demandeDeMartin()];
    const arbre = await rendre();
    const pastille = (/** @type {string} */ id) => aplatirTexte(
      hote(arbre, `declared-child-state-${id}`).props.children,
    ).replace(/\u00a0/g, ' ');

    expect(pastille('martin')).toBe('Demande en attente');
    expect(pastille('enfant-1')).toBe('Pas encore d’équipe');
  });

  test('l état en mots ET en couleur : orange pour l attente, vert pour l équipe', async () => {
    mockEnfants = [ANISSA, MARTIN];
    mockDemandes = [demandeDeMartin()];
    const arbre = await rendre();
    const encre = (/** @type {string} */ id) => styleAPlat(
      hote(arbre, `declared-child-state-${id}`).findAllByType(Text)[0].props.style,
    ).color;

    expect(encre('martin')).toBe(COULEURS.warning400);
    expect(encre('anissa')).toBe(COULEURS.success200);
  });

  test('🔴 une lecture des demandes : sans club, avec les enfants et l historique', async () => {
    mockEnfants = [MARTIN];
    await rendre();
    expect(mockLecturesDesDemandes[mockLecturesDesDemandes.length - 1]).toEqual({
      options: { enabled: true },
      params: { includeChildRequests: true, includeHistory: true },
    });

    // Sans fiche, rien à lire.
    mockEnfants = [];
    mockLecturesDesDemandes.length = 0;
    await rendre();
    expect(mockLecturesDesDemandes[mockLecturesDesDemandes.length - 1].options.enabled).toBe(false);
  });

  test('« 3 ENFANTS » sous le titre : les comptes reliés ET les fiches', async () => {
    mockLiens = {
      children: [{
        age: 14, documentId: 'lina', firstname: 'Lina', lastname: 'Test',
      }],
      requests: [],
    };
    mockEnfants = [ANISSA, MARTIN];

    expect(texteVisible(await rendre())).toContain('MES ENFANTS | 3 ENFANTS');
  });

  test('un compte relié dit « A son compte », une fiche jamais', async () => {
    mockLiens = {
      children: [{
        age: 14, documentId: 'lina', firstname: 'Lina', lastname: 'Test',
      }],
      requests: [],
    };
    mockEnfants = [ANISSA];
    const texte = texteVisible(await rendre());

    expect(texte).toContain('Lina Test | 14 ans | A son compte');
    expect(texte).not.toContain('Anissa Test | 11 ans | A son compte');
  });
});

// ===========================================================================
// PAR-L5L6 (13/10) — E05 : LE MENU « … » D'UN ENFANT, ET LE BANDEAU APRÈS SUPPRESSION.
//
// « Modifier » et « Supprimer » quittent la carte pour un menu « … » (une feuille, pas une
// alerte : sur le site, Alert n'a que deux choix). Après une suppression, la liste le DIT :
// « La fiche d'Anissa est supprimée. » (aujourd'hui : aucun message).
// ===========================================================================

describe('PAR-L5L6 E05 — le menu « … » et le bandeau après suppression', () => {
  const MARTIN = unEnfant({
    age: 9, documentId: 'martin', firstname: 'Martin', lastname: 'Test',
  });
  const ANISSA = unEnfant({
    age: 11, documentId: 'anissa', firstname: 'Anissa', lastname: 'Test',
  });

  beforeEach(() => {
    mockLiens = { children: [], requests: [] };
  });

  afterEach(() => {
    mockLiens = undefined;
  });

  /**
   * Ouvre le menu « … » d'un enfant.
   * @param {any} arbre - L'arbre rendu.
   * @param {string} id - Le documentId de la fiche.
   * @returns {Promise<void>} Rien.
   */
  const ouvrirLeMenu = async (arbre, id) => {
    await act(async () => { porteDe(arbre, `declared-child-menu-${id}`).props.onPress(); });
  };

  test('🔴 « … » : 44 × 44, nommé pour le lecteur d écran, ouvre SA feuille', async () => {
    mockEnfants = [MARTIN];
    const arbre = await rendre();
    const bouton = porteDe(arbre, 'declared-child-menu-martin');

    expect(bouton).toBeTruthy();
    expect(bouton.props.accessibilityLabel).toBe('Actions pour Martin');
    expect(styleAPlat(bouton.props.style)).toEqual(expect.objectContaining({
      height: 44, width: 44,
    }));
    expect(hote(arbre, 'feuille')).toBeUndefined();

    await ouvrirLeMenu(arbre, 'martin');
    const feuille = texteVisible(arbre);
    expect(feuille).toContain('Martin Test | 9 ans');
    expect(feuille).toContain('Voir sa fiche');
    expect(feuille).toContain('Modifier sa fiche');
    expect(feuille).toContain('Supprimer la fiche');
    expect(feuille).toContain('Fermer');
  });

  test('🔴 la carte ne porte plus « Modifier » / « Supprimer » en texte', async () => {
    mockEnfants = [MARTIN];
    const arbre = await rendre();

    expect(pressable(arbre, 'Modifier')).toBeUndefined();
    expect(pressable(arbre, 'Supprimer')).toBeUndefined();
  });

  test('« Voir sa fiche » ouvre SA page ; « Modifier sa fiche », le formulaire', async () => {
    mockEnfants = [MARTIN];
    const arbre = await rendre();

    await ouvrirLeMenu(arbre, 'martin');
    await act(async () => { porteDe(arbre, 'child-menu-open').props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('MyChildren', { childDocumentId: 'martin' });
    // La feuille se ferme avant le geste.
    expect(hote(arbre, 'feuille')).toBeUndefined();

    await ouvrirLeMenu(arbre, 'martin');
    await act(async () => { porteDe(arbre, 'child-menu-edit').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ChildEdit', { childDocumentId: 'martin' });
  });

  test('🔴 « Supprimer la fiche » : la confirmation existante, puis le bandeau', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockEnfants = [MARTIN];
    const arbre = await rendre();

    await ouvrirLeMenu(arbre, 'martin');
    await act(async () => { porteDe(arbre, 'child-menu-delete').props.onPress(); });
    const [titre, , boutons] = alerte.mock.calls[0];
    expect(titre).toBe('Supprimer la fiche de Martin ?');
    expect(mockSupprimer).not.toHaveBeenCalled();

    await act(async () => { boutons[1].onPress(); });
    expect(mockSupprimer).toHaveBeenCalledWith('martin', expect.any(Object));
    expect(texteVisible(arbre)).not.toContain('est supprimée');

    await act(async () => { mockSupprimer.mock.calls[0][1].onSuccess(); });
    expect(hote(arbre, 'my-children-banner')).toBeTruthy();
    expect(texteVisible(arbre)).toContain('La fiche de Martin est supprimée.');
    alerte.mockRestore();
  });

  test('l élision : « La fiche d’Anissa est supprimée. »', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockEnfants = [ANISSA];
    const arbre = await rendre();

    await ouvrirLeMenu(arbre, 'anissa');
    await act(async () => { porteDe(arbre, 'child-menu-delete').props.onPress(); });
    await act(async () => { alerte.mock.calls[0][2][1].onPress(); });
    await act(async () => { mockSupprimer.mock.calls[0][1].onSuccess(); });

    expect(texteVisible(arbre)).toContain('La fiche d’Anissa est supprimée.');
    alerte.mockRestore();
  });

  test('un échec de suppression se dit, et aucun bandeau ne ment', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockEnfants = [MARTIN];
    const arbre = await rendre();

    await ouvrirLeMenu(arbre, 'martin');
    await act(async () => { porteDe(arbre, 'child-menu-delete').props.onPress(); });
    await act(async () => { alerte.mock.calls[0][2][1].onPress(); });
    await act(async () => { mockSupprimer.mock.calls[0][1].onError(); });

    expect(alerte).toHaveBeenLastCalledWith(
      expect.any(String),
      'Impossible de supprimer cette fiche pour le moment.',
    );
    expect(hote(arbre, 'my-children-banner')).toBeUndefined();
    alerte.mockRestore();
  });

  test('quitter la liste efface le bandeau', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockEnfants = [MARTIN];
    const arbre = await rendre();
    await ouvrirLeMenu(arbre, 'martin');
    await act(async () => { porteDe(arbre, 'child-menu-delete').props.onPress(); });
    await act(async () => { alerte.mock.calls[0][2][1].onPress(); });
    await act(async () => { mockSupprimer.mock.calls[0][1].onSuccess(); });
    expect(hote(arbre, 'my-children-banner')).toBeTruthy();

    await act(async () => { mockEcouteurs.blur(); });
    expect(hote(arbre, 'my-children-banner')).toBeUndefined();
    alerte.mockRestore();
  });

  test('13 ans et plus : pas de « Voir sa fiche » (cette tranche n a pas de page)', async () => {
    mockEnfants = [unEnfant({ age: 15 })];
    const arbre = await rendre();

    await ouvrirLeMenu(arbre, 'enfant-1');
    expect(porteDe(arbre, 'child-menu-open')).toBeUndefined();
    expect(porteDe(arbre, 'child-menu-edit')).toBeTruthy();
    expect(porteDe(arbre, 'child-menu-delete')).toBeTruthy();
  });

  test('un compte relié n a pas de « … » (on ne modifie pas le compte d un ado)', async () => {
    mockLiens = {
      children: [{
        age: 14, documentId: 'lina', firstname: 'Lina', lastname: 'Test',
      }],
      requests: [],
    };
    const arbre = await rendre();

    expect(porteDe(arbre, 'declared-child-menu-lina')).toBeUndefined();
    expect(texteVisible(arbre)).not.toContain('Actions pour Lina');
  });
});

// ===========================================================================
// PAR-L5L6 (13/10) — E06 : « COMMENT ÇA MARCHE ? ».
//
// Les trois paragraphes qui chargeaient la liste (capture S03) partent dans une feuille, mot
// pour mot. Seul « ton enfant » remplace le prénom.
// ===========================================================================

describe('PAR-L5L6 E06 — « Comment ça marche ? »', () => {
  const FR = jest.requireActual('@/theme/strings/translations/fr').default;

  beforeEach(() => {
    mockLiens = { children: [], requests: [] };
    mockEnfants = [unEnfant()];
  });

  afterEach(() => {
    mockLiens = undefined;
  });

  test('🔴 les trois explications quittent la liste', async () => {
    const texte = texteVisible(await rendre());

    expect(texte).not.toContain(FR.myChildren.screen.hint);
    expect(texte).not.toContain(FR.myChildren.accounts.empty);
    expect(texte).not.toContain('Stats et retours de match');
  });

  test('🔴 le lien « Comment ça marche ? » (44 px) ouvre la feuille, MOT POUR MOT', async () => {
    const arbre = await rendre();
    const lien = porteDe(arbre, 'my-children-help-link');

    expect(styleAPlat(lien.props.style).minHeight).toBe(44);
    expect(hote(arbre, 'my-children-help')).toBeUndefined();
    await act(async () => { lien.props.onPress(); });

    const texte = texteVisible(arbre);
    expect(texte).toContain('Comment ça marche ?');
    expect(texte).toContain(FR.myChildren.screen.hint);
    expect(texte).toContain(FR.myChildren.accounts.empty);
    expect(texte).toContain(FR.stRetours.parent.under13Title);
    expect(texte).toContain(
      'Ils arrivent quand ton enfant a 13 ans et son propre compte, relié au tien.',
    );
  });

  test('« Fermer » ferme la feuille', async () => {
    const arbre = await rendre();
    await act(async () => { porteDe(arbre, 'my-children-help-link').props.onPress(); });
    await act(async () => { pressable(arbre, 'Fermer').props.onPress(); });

    expect(hote(arbre, 'my-children-help')).toBeUndefined();
  });
});

// ===========================================================================
// PAR-L5L6 (13/10) — E07 BRANCHÉE : LA FICHE DE L'ENFANT DANS LA ROUTE « MES ENFANTS ».
// La fiche lit SES demandes dans la lecture commune ; « Modifier sa fiche » ouvre le
// formulaire ; « Supprimer la fiche » confirme, ramène à la liste et l'annonce.
// ===========================================================================

describe('PAR-L5L6 E07 — la fiche, branchée sur la route', () => {
  const MARTIN = unEnfant({
    age: 9, documentId: 'martin', firstname: 'Martin', lastname: 'Test',
  });

  /**
   * Monte la fiche d'un enfant (la route « Mes enfants » avec \`childDocumentId\`).
   * @param {string} childDocumentId - La fiche ouverte.
   * @returns {Promise<any>} L arbre rendu.
   */
  const rendreSaFiche = async (childDocumentId) => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<MyChildren route={{ params: { childDocumentId } }} />);
    });
    return arbre;
  };

  beforeEach(() => {
    mockLiens = { children: [], requests: [] };
    mockEnfants = [unEnfant(), MARTIN];
    mockDemandes = [{
      club: { documentId: 'club-smuc', name: 'SMUC' },
      createdAt: '2026-10-11T09:00:00.000Z',
      declaredChild: { documentId: 'martin', firstname: 'Martin' },
      documentId: 'dem-m1',
      status: 'pending',
      team: { documentId: 'basket', name: 'Basket' },
    }];
  });

  afterEach(() => {
    mockLiens = undefined;
  });

  test('🔴 la fiche de Martin montre SA demande ; celle de Léa, aucune', async () => {
    expect(texteVisible(await rendreSaFiche('martin')))
      .toContain('Ses demandes | En attente | Club  SMUC');
    expect(texteVisible(await rendreSaFiche('enfant-1'))).not.toContain('Ses demandes');
  });

  test('« Modifier sa fiche » ouvre le formulaire de CETTE fiche', async () => {
    const arbre = await rendreSaFiche('martin');

    await act(async () => { pressable(arbre, 'Modifier sa fiche').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ChildEdit', { childDocumentId: 'martin' });
  });

  test('🔴 « Supprimer la fiche » : confirmation, retour à la liste, et l annonce', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const fiche = await rendreSaFiche('martin');

    await act(async () => { porteDe(fiche, 'declared-child-delete').props.onPress(); });
    expect(alerte.mock.calls[0][0]).toBe('Supprimer la fiche de Martin ?');
    await act(async () => { alerte.mock.calls[0][2][1].onPress(); });
    expect(mockSupprimer).toHaveBeenCalledWith('martin', expect.any(Object));
    expect(mockGoBack).not.toHaveBeenCalled();

    await act(async () => { mockSupprimer.mock.calls[0][1].onSuccess(); });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    // La liste, quand on y revient, le dit.
    expect(texteVisible(await rendre())).toContain('La fiche de Martin est supprimée.');
    alerte.mockRestore();
  });

  test('depuis le menu de la LISTE, une suppression ne fait pas « retour »', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const liste = await rendre();

    await act(async () => { porteDe(liste, 'declared-child-menu-martin').props.onPress(); });
    await act(async () => { porteDe(liste, 'child-menu-delete').props.onPress(); });
    await act(async () => { alerte.mock.calls[0][2][1].onPress(); });
    await act(async () => { mockSupprimer.mock.calls[0][1].onSuccess(); });

    expect(mockGoBack).not.toHaveBeenCalled();
    alerte.mockRestore();
  });
});

// ===========================================================================
// PAR-L5L6 (13/10) — E08 CÔTÉ LISTE : « La fiche d'Anissa est créée. » et l'étape suivante.
// ===========================================================================

describe('PAR-L5L6 E08 — le bandeau après une création', () => {
  beforeEach(() => {
    mockLiens = { children: [], requests: [] };
    mockEnfants = [unEnfant({
      age: 11, documentId: 'anissa', firstname: 'Anissa', lastname: 'Test',
    })];
  });

  afterEach(() => {
    mockLiens = undefined;
  });

  test('🔴 « La fiche d’Anissa est créée. » + « Chercher un club pour Anissa »', async () => {
    annoncer({ documentId: 'anissa', firstname: 'Anissa', type: 'creee' });
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain(
      'La fiche d’Anissa est créée. | Chercher un club pour Anissa',
    );
    await act(async () => { porteDe(arbre, 'my-children-banner-search').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith(
      'HomeTab',
      {
        params: {
          params: { childDocumentId: 'anissa' },
          pop: true,
          screen: 'SearchClubs',
        },
        screen: 'Search',
      },
      { pop: true },
    );
  });

  test('« La fiche de Martin est créée. » (sans élision)', async () => {
    annoncer({ documentId: 'martin', firstname: 'Martin', type: 'creee' });

    expect(texteVisible(await rendre())).toContain('La fiche de Martin est créée.');
  });

  test('une suppression ne propose pas de chercher un club', async () => {
    annoncer({ firstname: 'Martin', type: 'supprimee' });
    const arbre = await rendre();

    expect(texteVisible(arbre)).toContain('La fiche de Martin est supprimée.');
    expect(porteDe(arbre, 'my-children-banner-search')).toBeUndefined();
  });
});

// ===========================================================================
// PAR-L5L6 (13/10) — E04, ÉTAT « CHARGEMENT » : deux cartes en squelette, jamais l'écran vide
// avant d'avoir lu (design parent E04 : « chargement (squelette de 2 cartes) »).
// ===========================================================================

describe('PAR-L5L6 E04 — le chargement', () => {
  beforeEach(() => {
    mockLiens = { children: [], requests: [] };
  });

  afterEach(() => {
    mockLiens = undefined;
  });

  test('🔴 pendant la lecture : deux cartes en squelette, ni écran vide ni liste', async () => {
    mockIsLoading = true;
    const arbre = await rendre();

    expect(hote(arbre, 'my-children-loading').children).toHaveLength(2);
    expect(texteVisible(arbre)).not.toContain('Tu n’as pas encore déclaré d’enfant.');
    expect(hote(arbre, 'my-children-list')).toBeUndefined();
  });

  test('lu : plus de squelette', async () => {
    mockEnfants = [unEnfant()];
    const arbre = await rendre();

    expect(hote(arbre, 'my-children-loading')).toBeUndefined();
    expect(hote(arbre, 'my-children-list')).toBeTruthy();
  });
});

// ===========================================================================
// PAR-L8 (13/10, design parent E19, planche 8) — ANNULER UNE DEMANDE EN ATTENTE, depuis la fiche
// de l'enfant. La confirmation est une FEUILLE (sur le site, `Alert` devient `window.confirm` :
// deux choix, aucune mise en forme) ; puis un bandeau dit ce qui s'est passé — y compris quand le
// club a répondu entre-temps (décision d'Adel : l'acceptation gagne), et quand le serveur ne sait
// pas encore annuler (l'app doit marcher contre le serveur d'avant).
// ===========================================================================

describe('PAR-L8 E19 — annuler une demande depuis la fiche', () => {
  const FOUNDCLUB = { documentId: 'club-fc', name: 'FoundClub' };
  const DEMANDE = {
    club: FOUNDCLUB,
    createdAt: '2026-10-11T09:00:00.000Z',
    declaredChild: { documentId: 'enfant-1', firstname: 'Léa' },
    documentId: 'dem-1',
    status: 'pending',
    team: { club: FOUNDCLUB, documentId: 'u11', name: 'U11 Garçons' },
  };

  beforeEach(() => {
    mockLiens = { children: [], requests: [] };
    mockEnfants = [unEnfant()];
    mockDemandes = [DEMANDE];
  });

  afterEach(() => {
    mockLiens = undefined;
  });

  /**
   * Monte la fiche de Léa (la route « Mes enfants » avec `childDocumentId`).
   * @returns {Promise<any>} L'arbre rendu.
   */
  const rendreLaFiche = async () => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<MyChildren route={{ params: { childDocumentId: 'enfant-1' } }} />);
    });
    return arbre;
  };

  /**
   * Le bouton (atome `Button`, qui ne transmet pas `testID`) qui porte ce titre.
   * @param {any} arbre - L'arbre rendu.
   * @param {string} titre - Son libellé.
   * @returns {any} Le bouton, ou undefined.
   */
  const bouton = (arbre, titre) => arbre.root.findAll((/** @type {any} */ n) => (
    n.props?.title === titre && typeof n.props?.onPress === 'function'
  ))[0];

  /**
   * « Annuler la demande » sur la fiche, puis la confirmation dans la feuille.
   * @param {any} arbre - L'arbre rendu.
   * @returns {Promise<any[]>} Les arguments de l'envoi : l'identifiant et les rappels.
   */
  const confirmer = async (arbre) => {
    await act(async () => { porteDe(arbre, 'declared-child-cancel-dem-1').props.onPress(); });
    await act(async () => { bouton(arbre, 'Annuler la demande').props.onPress(); });
    return mockAnnulerLaDemande.mock.calls[mockAnnulerLaDemande.mock.calls.length - 1];
  };

  test('🔴 « Annuler la demande » ouvre une FEUILLE qui nomme l enfant et l équipe', async () => {
    const arbre = await rendreLaFiche();
    expect(hote(arbre, 'feuille')).toBeUndefined();

    await act(async () => { porteDe(arbre, 'declared-child-cancel-dem-1').props.onPress(); });

    const texte = texteVisible(arbre);
    expect(texte).toContain('Annuler la demande pour Léa ?');
    expect(texte).toContain(
      'Les responsables de U11 Garçons ne la verront plus. Léa pourra faire une nouvelle demande.',
    );
    expect(bouton(arbre, 'Annuler la demande').props.variant).toBe('Danger');
    expect(bouton(arbre, 'Garder la demande').props.variant).toBe('Ghost');
    expect(mockAnnulerLaDemande).not.toHaveBeenCalled();
  });

  test('« Garder la demande » referme la feuille, et rien ne part', async () => {
    const arbre = await rendreLaFiche();
    await act(async () => { porteDe(arbre, 'declared-child-cancel-dem-1').props.onPress(); });

    await act(async () => { bouton(arbre, 'Garder la demande').props.onPress(); });

    expect(hote(arbre, 'feuille')).toBeUndefined();
    expect(mockAnnulerLaDemande).not.toHaveBeenCalled();
  });

  test('🔴 confirmer : CETTE demande part, puis « Demande annulée. »', async () => {
    const arbre = await rendreLaFiche();
    const [id, rappels] = await confirmer(arbre);

    expect(id).toBe('dem-1');
    expect(hote(arbre, 'feuille')).toBeUndefined();
    await act(async () => { rappels.onSuccess(); });
    expect(texteVisible(arbre))
      .toContain('Demande annulée. | Léa peut faire une nouvelle demande.');
    expect(mockRelireEnfants).toHaveBeenCalled();
  });

  test('🔴 COURSE — acceptée entre-temps : on le dit, rien n est annulé', async () => {
    const arbre = await rendreLaFiche();
    const [, rappels] = await confirmer(arbre);

    await act(async () => {
      rappels.onError({
        details: { accepted: true, code: 'CLUB_INTEREST_REQUEST_ALREADY_RESPONDED' },
        message: 'Club interest request already responded',
        status: 400,
      });
    });

    expect(texteVisible(arbre)).toContain(
      'Le club a déjà répondu. | Léa est dans U11 Garçons. Rien n’a été annulé.',
    );
    expect(texteVisible(arbre)).not.toContain('Demande annulée.');
    expect(mockRelireEnfants).toHaveBeenCalled();
  });

  test('🔴 refusée ou disparue : « Le club a déjà répondu à cette demande »', async () => {
    const arbre = await rendreLaFiche();
    const [, rappels] = await confirmer(arbre);

    await act(async () => {
      rappels.onError({ details: { code: 'CLUB_INTEREST_REQUEST_GONE' }, status: 404 });
    });

    expect(texteVisible(arbre)).toContain(
      'Le club a déjà répondu à cette demande. | Il n’y a plus rien à annuler.',
    );
  });

  test('🔴 serveur d AVANT (sans la route) : un message clair, pas de plantage', async () => {
    const arbre = await rendreLaFiche();
    const [, rappels] = await confirmer(arbre);

    await act(async () => {
      rappels.onError({
        details: {}, message: 'Not Found', name: 'NotFoundError', status: 404,
      });
    });

    expect(texteVisible(arbre)).toContain(
      'L’annulation n’est pas encore disponible. | '
      + 'La demande est toujours en attente. Réessaie plus tard.',
    );
    expect(porteDe(arbre, 'cancel-request-retry')).toBeUndefined();
  });

  test('🔴 pas de réseau : on le dit, et « Réessayer » renvoie la MÊME demande', async () => {
    const arbre = await rendreLaFiche();
    const [, rappels] = await confirmer(arbre);

    await act(async () => { rappels.onError('Network Error'); });

    expect(texteVisible(arbre)).toContain(
      'La demande n’a pas pu être annulée. | Vérifie ta connexion, puis réessaie. | Réessayer',
    );
    await act(async () => { porteDe(arbre, 'cancel-request-retry').props.onPress(); });
    expect(mockAnnulerLaDemande).toHaveBeenCalledTimes(2);
    expect(mockAnnulerLaDemande.mock.calls[1][0]).toBe('dem-1');
  });
});

// ===========================================================================
// PAR-L13 (13/10, design parent E28 et E29) — LA CARTE DE L ENFANT, UNE VUE DE « MES ENFANTS ».
// Comme sa fiche (ST-RETOURS2), sa carte est une VUE de la route : `carte` = « nouvelle »
// (juste après sa déclaration) ou « voir » (depuis sa fiche). Aucune route neuve : le site la
// sert déjà (`/profile/children?childDocumentId=…&carte=…`).
// ===========================================================================

/** @type {any[]} */
const mockCartesOuvertes = [];
jest.mock('@/views/profile/parent/ChildCardPage', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockCartesOuvertes.push(props);
      const vue = props.nouvelle ? 'nouvelle' : 'voir';
      return <TexteRN>{`CARTE:${props.enfant?.firstname}:${vue}`}</TexteRN>;
    },
  };
});

describe('PAR-L13 — sa carte, vue de la route « Mes enfants »', () => {
  const MARTIN = unEnfant({
    age: 9, documentId: 'martin', firstname: 'Martin', lastname: 'Test',
  });

  /**
   * Monte la route avec ces paramètres.
   * @param {any} params - Les paramètres.
   * @returns {Promise<any>} L arbre rendu.
   */
  const monter = async (params) => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<MyChildren route={{ params }} />);
    });
    return arbre;
  };

  beforeEach(() => {
    mockCartesOuvertes.length = 0;
    mockEnfants = [unEnfant(), MARTIN];
    mockDemandes = [];
  });

  test('🔴 « Voir » sur sa fiche ouvre SA carte (une vue de la même route)', async () => {
    const fiche = await monter({ childDocumentId: 'martin' });

    await act(async () => { porteDe(fiche, 'declared-child-card-open').props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('MyChildren', {
      carte: 'voir', childDocumentId: 'martin',
    });
  });

  test('🔴 `carte: nouvelle` monte la carte de CET enfant en mode « juste déclarée »', async () => {
    const arbre = await monter({ carte: 'nouvelle', childDocumentId: 'martin' });

    expect(texteVisible(arbre)).toContain('CARTE:Martin:nouvelle');
    expect(texteVisible(arbre)).not.toContain('Ses demandes');
  });

  test('`carte: voir` monte la carte complète ; « fini » revient en arrière', async () => {
    const arbre = await monter({ carte: 'voir', childDocumentId: 'martin' });

    expect(texteVisible(arbre)).toContain('CARTE:Martin:voir');
    await act(async () => { mockCartesOuvertes[mockCartesOuvertes.length - 1].onFini(); });
    expect(mockGoBack).toHaveBeenCalled();
  });

  test('une carte dont la fiche n existe plus le DIT', async () => {
    const arbre = await monter({ carte: 'voir', childDocumentId: 'disparue' });

    expect(texteVisible(arbre)).toContain('Cette fiche n’existe plus.');
    expect(mockCartesOuvertes).toHaveLength(0);
  });
});

// 👪 PAR-L11c (14/10) point 2 — « SES ÉVÉNEMENTS » SUR LA FICHE DE L ENFANT (PAR-012, design
// parent §3 E21 : « bloc Ses événements, lecture serveur »). La lecture existe au serveur :
// `GET /event-child-registrations/mine` SANS filtre rend toutes les lignes du parent ; la fiche
// garde celles de SON enfant. Une ligne : son événement, sa date, son état ; le motif d un
// refus ; « Annuler l'inscription » (point 1) ; « Voir l'événement ».
// ⏳ Dates relatives a aujourd hui (garde-fou `temoins:horloge`).
describe('PAR-L11c point 2 — « Ses événements » sur la fiche', () => {
  const DANS_UNE_SEMAINE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const inscription = (/** @type {string} */ id, /** @type {any} */ extra = {}) => ({
    admission: 'request',
    child: { documentId: 'enfant-1', firstname: 'Léa' },
    documentId: id,
    event: { date: DANS_UNE_SEMAINE, documentId: `evt-${id}`, name: `Détection ${id}` },
    reason: null,
    status: 'pending',
    ...extra,
  });

  beforeEach(() => {
    mockLiens = { children: [], requests: [] };
    mockEnfants = [unEnfant()];
  });

  afterEach(() => {
    mockLiens = undefined;
  });

  /**
   * Monte la fiche de Léa (la route « Mes enfants » avec `childDocumentId`).
   * @returns {Promise<any>} L'arbre rendu.
   */
  const rendreLaFiche = async () => {
    /** @type {any} */
    let arbre;
    await act(async () => {
      arbre = renderer.create(<MyChildren route={{ params: { childDocumentId: 'enfant-1' } }} />);
    });
    return arbre;
  };

  /**
   * Le bouton (atome `Button`) qui porte ce titre.
   * @param {any} arbre - L'arbre rendu.
   * @param {string} titre - Son libellé.
   * @returns {any} Le bouton, ou undefined.
   */
  const bouton = (arbre, titre) => arbre.root.findAll((/** @type {any} */ n) => (
    n.props?.title === titre && typeof n.props?.onPress === 'function'
  ))[0];

  test('🔴 une ligne par événement : état, date, motif ; rien d un autre enfant', async () => {
    mockInscriptions = [
      inscription('r-1'),
      inscription('r-2', { status: 'accepted' }),
      inscription('r-3', { reason: 'Groupe complet', status: 'declined' }),
      inscription('r-4', {
        child: { documentId: 'enfant-2', firstname: 'Sami' },
        event: { date: DANS_UNE_SEMAINE, documentId: 'evt-x', name: 'Stage de Sami' },
      }),
    ];
    const arbre = await rendreLaFiche();
    const texte = texteVisible(arbre);

    expect(hote(arbre, 'declared-child-events')).toBeDefined();
    expect(texte).toContain('Ses événements');
    expect(texte).toContain('Détection r-1');
    expect(texte).toContain('Détection r-2');
    expect(texte).toContain('Détection r-3');
    expect(texte).not.toContain('Stage de Sami');
    expect(texte).toContain('En attente');
    expect(texte).toContain('Inscription confirmée');
    expect(texte).toContain('Refusée');
    expect(texte).toContain('Motif : Groupe complet');
    // La date, au jour près (« Le 21/10 »).
    expect(texte).toMatch(/Le \d{2}\/\d{2}/);
  });

  test('aucune inscription : le bloc ne se montre pas', async () => {
    const arbre = await rendreLaFiche();

    expect(hote(arbre, 'declared-child-events')).toBeUndefined();
    expect(texteVisible(arbre)).not.toContain('Ses événements');
  });

  test('lecture en échec : le bloc le dit, « Réessayer » relit', async () => {
    mockErreurInscriptions = new Error('Network Error');
    const arbre = await rendreLaFiche();

    expect(texteVisible(arbre)).toContain('Impossible de charger ses événements.');
    await act(async () => { porteDe(arbre, 'declared-child-events-retry').props.onPress(); });
    expect(mockRelireInscriptions).toHaveBeenCalledTimes(1);
  });

  test('🔴 « Annuler l inscription » : feuille (Léa + l événement), puis bandeau', async () => {
    mockInscriptions = [inscription('r-1'), inscription('r-3', { status: 'declined' })];
    mockAnnulerInscription.mockImplementation((_ligne, { onSuccess }) => onSuccess());
    const arbre = await rendreLaFiche();

    expect(porteDe(arbre, 'declared-child-event-cancel-r-3')).toBeUndefined();
    await act(async () => { porteDe(arbre, 'declared-child-event-cancel-r-1').props.onPress(); });
    const texte = texteVisible(arbre);
    expect(texte).toContain("Annuler l'inscription pour Léa ?");
    expect(texte).toContain('« Détection r-1 »');

    await act(async () => { bouton(arbre, "Annuler l'inscription").props.onPress(); });
    expect(mockAnnulerInscription.mock.calls[0][0]).toEqual(
      expect.objectContaining({ documentId: 'r-1' }),
    );
    expect(texteVisible(arbre)).toContain('Inscription annulée.');
  });

  test('« Voir l événement » ouvre l événement', async () => {
    mockInscriptions = [inscription('r-1')];
    const arbre = await rendreLaFiche();

    await act(async () => { porteDe(arbre, 'declared-child-event-open-r-1').props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('EventDetails', { eventId: 'evt-r-1' });
  });
});
