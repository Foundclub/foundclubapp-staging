import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BlockedUsers from '../BlockedUsers';

// BLOQUER (E6) — LA PORTE DE SORTIE : « Personnes bloquees ».
//
// Apple 1.2 et Google Play n'exigent pas seulement de pouvoir BLOQUER : il faut
// aussi pouvoir DEBLOQUER, et retrouver la liste sans chercher. Cet ecran est le
// seul endroit de l'app ou on la voit en entier ; il est atteint depuis le
// profil (section « Compte »).
//
// ⚠️ Le serveur ne rend QUE mes blocages (`GET /user-blocks/mine`) : aucune
// route ne liste les blocages de quelqu'un d'autre.

/** @type {any} */
let mockBlockedRows;
/** @type {any} */
let mockIsLoading;
const mockUnblockMutate = jest.fn();

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

// `.env` est gitignore, donc absent de tout worktree : sans cette doublure la
// SUITE ENTIERE meurt au chargement, sans executer un seul test.
jest.mock('@/services/userBlock/userBlockQueries', () => ({
  useGetMyBlockedUsers: () => ({
    data: mockBlockedRows,
    error: undefined,
    isLoading: mockIsLoading,
  }),
  useUnblockUser: () => ({ isPending: false, mutate: mockUnblockMutate }),
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
 * Aplati les enfants React en une chaine.
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
 * Tout le texte visible.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Le texte.
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Monte l'ecran.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<BlockedUsers />);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockBlockedRows = [];
  mockIsLoading = false;
});

test('BLOQUER C1 — une liste vide le DIT, au lieu de rester muette', async () => {
  const arbre = await rendre();

  expect(texteVisible(arbre)).toContain('Tu n’as bloqué personne.');
});

test('BLOQUER C2 — chaque personne bloquee apparait avec son nom', async () => {
  mockBlockedRows = [
    { documentId: 'block-1', user: { documentId: 'u1', firstname: 'Jean', lastname: 'Dupont' } },
    { documentId: 'block-2', user: { documentId: 'u2', firstname: 'Marie', lastname: 'Curie' } },
  ];

  const arbre = await rendre();
  const texte = texteVisible(arbre);

  expect(texte).toContain('Jean Dupont');
  expect(texte).toContain('Marie Curie');
  expect(texte).not.toContain('Tu n’as bloqué personne.');
});

test('BLOQUER C3 — « Débloquer » appelle le serveur avec la BONNE personne', async () => {
  mockBlockedRows = [
    { documentId: 'block-1', user: { documentId: 'u1', firstname: 'Jean', lastname: 'Dupont' } },
    { documentId: 'block-2', user: { documentId: 'u2', firstname: 'Marie', lastname: 'Curie' } },
  ];

  const arbre = await rendre();
  const boutons = arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props?.title === 'Débloquer'
      && typeof noeud.props?.onPress === 'function',
  );

  expect(boutons).toHaveLength(2);
  await act(async () => { boutons[1].props.onPress(); });

  expect(mockUnblockMutate).toHaveBeenCalledWith('u2');
});

test('BLOQUER C4 — l\'ecran explique ce que le blocage fait, et ce qu\'il NE ferme PAS', async () => {
  const arbre = await rendre();
  const texte = texteVisible(arbre);

  // 🧒 K5 lisible par la personne : un blocage ne ferme pas les fils collectifs.
  expect(texte).toContain('ne peut plus t’écrire');
  expect(texte).toContain('groupe');
});
