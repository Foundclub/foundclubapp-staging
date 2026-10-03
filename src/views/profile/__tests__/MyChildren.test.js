import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MyChildren from '../MyChildren';

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

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useDeleteDeclaredChild: () => ({ isPending: false, mutate: mockSupprimer }),
  useGetMyDeclaredChildren: () => ({
    data: mockEnfants,
    error: undefined,
    isLoading: mockIsLoading,
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

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
  .join(' | ');

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

test('P2/7 ③ le compte se dit au PLURIEL correctement (1 enfant / 2 enfants)', async () => {
  mockEnfants = [unEnfant()];
  expect(texteVisible(await rendre())).toContain('1 enfant déclaré');

  mockEnfants = [unEnfant(), unEnfant({ documentId: 'enfant-2', firstname: 'Tom' })];
  expect(texteVisible(await rendre())).toContain('2 enfants déclarés');
});

test('P2/7 ④ MOINS DE 13 ANS : « chercher un club » est proposé', async () => {
  mockEnfants = [unEnfant({ age: 12 })];

  const texte = texteVisible(await rendre());

  expect(texte).toContain('Chercher un club pour Léa');
  expect(texte).not.toContain('fait ses demandes lui-même');
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
  const arbre = await rendre();

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
  expect(mockNavigate).toHaveBeenCalledWith(
    'HomeTab',
    {
      params: {
        params: { childDocumentId: 'enfant-1', childFirstname: 'Léa' },
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
const mockAnnuler = jest.fn();

jest.mock('@/services/parentLink/parentLinkQueries', () => ({
  useCancelParentLink: () => ({ isPending: false, mutate: mockAnnuler }),
  useParentLinksAsParent: () => ({ data: mockLiens, error: undefined, isLoading: false }),
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

  // ① — avec la porte « Relier le compte de mon enfant ».
  test('LIEN ① la section existe même sans aucune fiche', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Les comptes de mes enfants');
    expect(texte).toContain('Relier le compte de mon enfant');

    await act(async () => { pressable(arbre, 'Relier le compte de mon enfant').props.onPress(); });
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
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Demande envoyée au numéro finissant par 78 (pour Léa).');
    await act(async () => { pressable(arbre, 'Annuler').props.onPress(); });
    expect(mockAnnuler).toHaveBeenCalledWith('dem-1');
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

  test('etat 6 — 🔴 moins de 13 ans : « Stats et retours de match », et quand', async () => {
    mockLiens = { children: [], requests: [] };
    mockEnfants = [unEnfant({ age: 7, firstname: 'Lea', lastname: 'Test' })];
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Stats et retours de match');
    expect(texte).toContain('Ils arrivent quand Lea a 13 ans et son propre compte, relié au tien.');
    expect(texte).toContain('Chercher un club pour Lea');
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

  test('🔴 point 2 — « Mes enfants de moins de 13 ans », après les comptes', async () => {
    mockEnfants = [unEnfant({ age: 7, firstname: 'Lea', lastname: 'Test' })];
    const texte = texteVisible(await rendre());

    const titre = texte.indexOf('Mes enfants de moins de 13 ans');
    expect(titre).toBeGreaterThan(texte.indexOf('Hugo Lemaire'));
    expect(titre).toBeLessThan(texte.indexOf('Lea Test'));
  });

  test('🔴 point 2 — sans fiche, la section garde son titre et dit qu il n y en a pas', async () => {
    mockEnfants = [];
    const texte = texteVisible(await rendre());

    const titre = texte.indexOf('Mes enfants de moins de 13 ans');
    expect(titre).toBeGreaterThan(-1);
    expect(titre).toBeLessThan(texte.indexOf('Tu n’as pas encore déclaré d’enfant.'));
  });
});
