import { Platform, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { updateMe } from '@/services/auth/authService';

import UserParentalDeclaration from '../UserParentalDeclaration';

// CONSENTEMENT-PHRASE (2026-10-01) — E6 : l'ecran de la case n'avait AUCUN test.
//
// C'est pourtant lui que voient les 8 parcours d'un 13-14 ans (les 4 branches du
// tunnel `authUseCases.js`, le refus serveur et la date saisie dans `UserName.js`,
// la carte de collection `PlayerCardScreen.js`). Ce fichier le monte AVEC la vraie
// carte et la vraie case a cocher : ce qui est lu, c'est ce que l'ado VOIT, et ce
// qui part, c'est ce que le serveur ENREGISTRE comme preuve.

let mockUserData;
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();

jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{}, jest.fn()],
}));

// Doublure de `t` branchee sur la VRAIE fr.js : l'ecran prend fr.js des que la
// clef existe, et c'est fr.js qui dit ce que l'ado lit.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    refetchUserData: jest.fn(),
    userData: mockUserData,
    userDataError: null,
    userDataLoading: false,
  }),
}));

// Doublure fidele de react-query : la mutation appelle vraiment sa mutationFn
// puis onSuccess, sinon rien ne partirait sur le reseau.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve()
      .then(() => options.mutationFn(variables))
      .then((/** @type {any} */ data) => options.onSuccess?.(data, variables))
      .catch((/** @type {any} */ error) => options.onError?.(error, variables)),
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueriesData: jest.fn() }),
}));

jest.mock('@/services/auth/authService', () => ({
  updateMe: jest.fn(),
}));

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { accessibilityLabel: props.title, disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('@/components/templates/FormScreenContainer', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return function FormScreenContainerMock(/** @type {any} */ { children }) {
    return reactActuel.createElement(VueRN, null, children);
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
 * Tout le texte visible, une entree par composant `Text`.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Le texte.
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * La case a cocher de la carte (le seul pressable `checkbox`).
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud.
 */
const laCase = (arbre) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityRole === 'checkbox');

/**
 * Le bouton « Continuer ».
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud.
 */
const continuer = (arbre) => arbre.root
  .findAllByType(TouchableOpacity)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === 'Continuer');

/**
 * Monte l'ecran.
 * @param {any} [params] - Les parametres de route.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async (params = {}) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <UserParentalDeclaration
        navigation={{ goBack: mockGoBack, navigate: mockNavigate }}
        route={{ params }}
      />,
    );
  });
  return arbre;
};

/**
 * Coche la case puis appuie sur « Continuer ».
 * @param {any} arbre - L'arbre rendu.
 * @returns {Promise<any>} Ce qui est parti vers le serveur.
 */
const cocherEtContinuer = async (arbre) => {
  await act(async () => { laCase(arbre).props.onPress(); });
  await act(async () => { continuer(arbre).props.onPress(); });
  return updateMe.mock.calls[0]?.[0];
};

const OS_D_ORIGINE = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = OS_D_ORIGINE;
  mockUserData = { birthdate: '2012-03-01', documentId: 'ado-14' };
  updateMe.mockResolvedValue({ documentId: 'ado-14', parentalDeclarationAccepted: true });
});

afterAll(() => {
  Platform.OS = OS_D_ORIGINE;
});

test('E6 ① sans la case, « Continuer » ne part pas', async () => {
  const arbre = await rendre();

  expect(continuer(arbre).props.disabled).toBe(true);
  expect(texteVisible(arbre)).toContain('Continuer');
  await act(async () => { continuer(arbre).props.onPress(); });
  expect(updateMe).not.toHaveBeenCalled();
});

test('E6 ② la case cochee envoie la preuve legale et la declaration', async () => {
  const arbre = await rendre();
  const envoi = await cocherEtContinuer(arbre);

  expect(envoi.parentalDeclarationAccepted).toBe(true);
  expect(envoi.legalAcceptance).toEqual(expect.objectContaining({
    accepted: true,
    locale: 'fr-FR',
    scope: 'minor_parental_declaration',
    sourceScreen: 'onboarding_parental_declaration',
    targetDocumentId: 'ado-14',
    targetType: 'user_profile',
  }));
  expect(typeof envoi.legalAcceptance.legalTextHash).toBe('string');
  expect(typeof envoi.legalAcceptance.legalVersion).toBe('string');
});

test('E6 ③ en inscription, on continue vers l adresse ; depuis la carte, on revient a la carte', async () => {
  const inscription = await rendre();
  await cocherEtContinuer(inscription);
  expect(mockNavigate).toHaveBeenCalledWith('UserAddress');
  expect(mockGoBack).not.toHaveBeenCalled();

  jest.clearAllMocks();
  updateMe.mockResolvedValue({ documentId: 'ado-14' });
  const carte = await rendre({ returnRoute: 'PlayerCard', source: 'player_card' });
  await cocherEtContinuer(carte);
  expect(mockGoBack).toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});

// ---------------------------------------------------------------------------
// LE DEFAUT, FIGE TEL QU IL EST AUJOURD HUI (base app 718b1421)
// ---------------------------------------------------------------------------
// Ce temoin decrit l'ecran AVANT le lot : il sera retourne par le lot, pas efface.
test('E6 ④ CONSTAT : l ado de 14 ans doit affirmer qu il est son propre parent', async () => {
  const arbre = await rendre();
  const texte = texteVisible(arbre);

  expect(texte).toContain('tu dois confirmer que tu es son parent ou représentant légal');
  expect(texte).toContain('Je déclare être le parent ou le représentant legal de cet enfant');
  // Le titre emprunte la clef d'un AUTRE ecran : l'ado lit la question de la date.
  expect(texte).toContain('Quelle est ta date de naissance ?');

  const envoi = await cocherEtContinuer(arbre);
  expect(envoi.legalAcceptance.legalVersion).toBe('minor-parental-declaration-v1-2026-05-14');
  expect(envoi.legalAcceptance.consentFlags).toEqual({ parentalAuthorityConfirmation: true });
});
