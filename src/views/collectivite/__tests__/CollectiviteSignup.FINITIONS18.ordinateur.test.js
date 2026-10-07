/* eslint-disable no-unused-vars, max-len -- harnais recopie du temoin voisin (FINITIONS18 11) */
import {
  ScrollView, Text, TextInput, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { updateMe } from '@/services/auth/authService';

import CollectiviteSignup from '../CollectiviteSignup';
import CollectiviteSignupStatus from '../CollectiviteSignupStatus';

// 🏛️ COLL-ACCUEIL (01/10/2026) — PLANCHE 5 : l'inscription « Je représente une collectivité »
// (`P1-inscription-tel` / `-ordi`, états 2 à 6) et ce que voit la personne ensuite
// (`P2-gestion`, état 7). ROUGE avant le lot : aucun de ces écrans n'existait.
//   - étape 1 « Votre collectivité » : un type, un nom ; une collectivité déjà sur FoundClub
//     se choisit, une autre devient une demande d'ouverture ;
//   - étape 2 « Vous » : prénom, nom, fonction, e-mail professionnel, l'erreur sous son champ ;
//   - l'envoi crée une DEMANDE (aucun accès), et mène à « Demande envoyée » ;
//   - au VOUS, et AUCUNE question de sport.

/** @type {any} */
let mockTrouvees;
/** @type {any} */
let mockDemandes;
/** @type {any} */
let mockVilles;
/** @type {any} */
let mockParams;
const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockGoBack = jest.fn();
const mockEnvoi = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, reset: mockReset }),
  useRoute: () => ({ params: mockParams }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
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
    refetchUserData: jest.fn(async () => {}),
    userData: { documentId: 'agent', firstname: '', lastname: '' },
  }),
}));

jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn(async () => ({})) }));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  // VILLE-INSCRIPTION (07/10) — les listes du référentiel, muettes ici : la saisie libre reste.
  useCollectiviteReferentiel: () => ({ data: [], isLoading: false }),
  useCollectiviteSignupSearch: () => mockTrouvees,
  // COLL-CONSOLE-BIS (03/10) — le référentiel des communes, muet ici : la saisie libre reste.
  useCommuneSearch: () => ({ data: [], isLoading: false }),
  useCreateManagerRequest: () => ({ isPending: false, mutateAsync: mockEnvoi }),
  useMyCollectivites: () => mockVilles,
  useMyManagerRequests: () => mockDemandes,
}));

jest.mock(
  '@/components/templates/FormScreenContainer',
  () => function FormScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/profileButton/ProfileButton',
  () => function ProfileButtonMock() { return null; },
);
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TextInput: Saisie, View: Vue } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      Vue,
      null,
      reactActuel.createElement(TexteRN, null, props.label),
      reactActuel.createElement(Saisie, {
        onBlur: props.onBlur,
        onChangeText: props.onChangeText,
        testID: props.testID,
        value: props.value,
      }),
      props.error ? reactActuel.createElement(TexteRN, null, props.error) : null,
    );
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
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
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const monter = async (/** @type {any} */ Ecran) => {
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<Ecran />); });
  return arbre;
};
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const [cible] = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onPress === 'function');
  expect(cible).toBeDefined();
  await act(async () => { await cible.props.onPress(); });
};
const saisir = async (
  /** @type {any} */ arbre,
  /** @type {string} */ testID,
  /** @type {string} */ valeur,
) => {
  const champ = arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput
    && n.props.testID === testID)[0];
  await act(async () => { champ.props.onChangeText(valeur); });
  await act(async () => { champ.props.onBlur?.(); });
};

const MONTRIVAGE = { documentId: 'ville-montrivage', name: 'Ville de Montrivage', type: 'commune' };

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockTrouvees = { data: [], isLoading: false };
  mockDemandes = { data: [], isLoading: false, refetch: jest.fn() };
  mockVilles = { data: [], isLoading: false, refetch: jest.fn() };
  mockEnvoi.mockResolvedValue({ data: { status: 'pending' } });
});

// FINITIONS18 · POINT 11 — l'ordinateur, a la demande.
let mockOrdinateur = false;
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));

// FINITIONS18 · POINT 11 (tournee T16, planche 8 etat A, P1-inscription-ordi) — sur ordinateur,
// « Votre collectivite » : pas d'« Annuler », « Continuer » pleine largeur. La planche : « Annuler »
// puis « Continuer » a droite, 200 px au moins. Le telephone garde son bouton plein. ROUGE avant.
describe('FINITIONS18 11 — inscription d une collectivite sur ordinateur (etat A)', () => {
  const { Platform, StyleSheet } = jest.requireActual('react-native');
  const osAvant = Platform.OS;
  afterEach(() => {
    Platform.OS = osAvant;
    mockOrdinateur = false;
  });
  const leBouton = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
    (/** @type {any} */ n) => typeof n.type === 'function' && n.props.title === titre,
  )[0];

  it('🔴 « Continuer » a droite, 200 px au moins, et « Annuler » a cote, qui revient en arriere', async () => {
    Platform.OS = 'web';
    mockOrdinateur = true;
    const arbre = await monter(CollectiviteSignup);
    const style = StyleSheet.flatten(leBouton(arbre, 'Continuer').props.style) || {};
    expect(style.alignSelf).toBe('flex-end');
    expect(style.minWidth).toBe(200);
    const annuler = leBouton(arbre, 'Annuler');
    expect(annuler).toBeDefined();
    await act(async () => { annuler.props.onPress(); });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('🔒 au telephone : « Continuer » plein, pas d « Annuler » (la fleche de l en-tete suffit)', async () => {
    mockOrdinateur = true;
    const arbre = await monter(CollectiviteSignup);
    const style = StyleSheet.flatten(leBouton(arbre, 'Continuer').props.style) || {};
    expect(style.alignSelf).toBeUndefined();
    expect(leBouton(arbre, 'Annuler')).toBeUndefined();
  });
});
