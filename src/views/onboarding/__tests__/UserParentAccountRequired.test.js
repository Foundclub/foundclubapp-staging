import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import UserParentAccountRequired from '../UserParentAccountRequired';

// PARENT (2026-09-02, palier 13) — L ECRAN OU ATTERRIT UN MOINS DE 13 ANS.
//
// « Inscris un compte de 10 ans : il doit demander un compte parent, et
// refuser de continuer sans » (Adel). Il n y a PAS de compte sous 13 ans
// (version A) : l ecran explique que le parent declare son enfant depuis SON
// compte, et n offre que deux sorties — corriger sa date (une faute de frappe
// est la seule raison legitime de revenir), et se deconnecter.
//
// ⛔ Il n y a PAS de bouton « passer » : c est tout le sens du palier 13.

const mockLogout = jest.fn();
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
  default: () => ({
    logoutMutation: { mutate: mockLogout },
    userData: { documentId: 'enfant-1' },
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

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
 * Les pressables qui portent ce titre.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} titre - Le titre du bouton.
 * @returns {any[]} Les noeuds.
 */
const boutons = (arbre, titre) => arbre.root.findAll(
  (/** @type {any} */ noeud) => (
    noeud.props?.title === titre && typeof noeud.props?.onPress === 'function'
  ),
);

/**
 * Monte l'ecran.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <UserParentAccountRequired
        navigation={{ navigate: mockNavigate }}
        route={{ params: {} }}
      />,
    );
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('PARENT R1 — l ecran dit pourquoi et quoi faire : le parent declare', async () => {
  const arbre = await rendre();
  const texte = texteVisible(arbre);

  expect(texte).toContain('Un compte parent est nécessaire');
  expect(texte).toContain('moins de 13 ans');
  expect(texte).toContain('pas besoin de compte');
  expect(texte).toContain('sous ton prénom');
  expect(boutons(arbre, 'Corriger ma date de naissance')).toHaveLength(1);
  expect(boutons(arbre, 'Se déconnecter')).toHaveLength(1);
  // ⛔ Aucune echappatoire.
  expect(boutons(arbre, 'Passer cette étape')).toHaveLength(0);
  expect(boutons(arbre, 'Continuer')).toHaveLength(0);
});

test('PARENT R2 — « corriger ma date » ramene a « Qui es-tu ? »', async () => {
  const arbre = await rendre();

  await act(async () => { boutons(arbre, 'Corriger ma date de naissance')[0].props.onPress(); });

  expect(mockNavigate).toHaveBeenCalledWith('UserName');
});

test('PARENT R3 — « se deconnecter » deconnecte', async () => {
  const arbre = await rendre();

  await act(async () => { boutons(arbre, 'Se déconnecter')[0].props.onPress(); });

  expect(mockLogout).toHaveBeenCalled();
});
