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
          return valeur.replace(/\{\{(\w+)\}\}/g, (/** @type {string} */ _tout, /** @type {string} */ clef) => {
            const source = (repli && typeof repli === 'object' ? repli : options) || {};
            return String(source[clef] ?? '');
          });
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

test('P2/7 ⑤ 13 À 17 ANS : plus de bouton « chercher un club », et l\'écran EXPLIQUE pourquoi', async () => {
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
  expect(mockNavigate).toHaveBeenCalledWith(
    'HomeTab',
    {
      params: {
        params: { childDocumentId: 'enfant-1', childFirstname: 'Léa' },
        screen: 'SearchClubs',
      },
      screen: 'Search',
    },
  );
});
