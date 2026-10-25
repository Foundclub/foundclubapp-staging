import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteActualiteForm from '../CollectiviteActualiteForm';

// C05 (BUGHUNT P2, P12-13, 25/10/2026) — « Modifier » une actualité supprimée, introuvable ou
// illisible : une phrase et « Réessayer », jamais un chargement sans fin.

/** @type {any} */
let mockActualites = { data: [], isLoading: false };
let mockParams = /** @type {any} */ ({});
const mockOrdinateur = false;
const mockSetOptions = jest.fn();
const mockGoBack = jest.fn();
const mockUpload = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: mockGoBack, navigate: jest.fn(), replace: jest.fn(), setOptions: mockSetOptions,
  }),
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
      Images: { arrowLeft: 'image-fleche', close: 'image-croix', plus: 'image-plus' },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/collectivite/collectiviteActualiteQueries', () => ({
  useActualiteMutations: () => ({
    modifier: { isPending: false, mutateAsync: jest.fn() },
    publier: { isPending: false, mutateAsync: jest.fn() },
  }),
  useActualiteRecipients: (/** @type {any} */ _id, /** @type {any} */ cible) => ({
    data: { audience: cible.audience, clubsCount: cible.audience === 'installation' ? 1 : 3 },
  }),
  useCollectiviteActualites: () => mockActualites,
}));
jest.mock('@/services/collectivite/collectiviteActualiteService', () => ({
  uploadActualiteFile: (/** @type {any} */ fichier) => mockUpload(fichier),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({
    data: [{ documentId: 'dojo', name: 'Dojo municipal' }],
  }),
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
  }),
}));
jest.mock('@/platform/media', () => ({
  __esModule: true,
  default: { capturePhoto: jest.fn(), pickDocument: jest.fn(), pickImage: jest.fn() },
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
jest.mock('@/platform/media/depotDeFichiers', () => ({
  ecouterLeDepot: () => () => {},
}));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Champ } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      label, onChangeText, testID, value,
    }) => (
      <Champ accessibilityLabel={label} onChangeText={onChangeText} testID={testID} value={value} />
    ),
  };
});
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock({ children, isVisible }) { return isVisible ? children : null; },
);
jest.mock(
  '@/components/organisms/chatAttachmentSheet/ChatAttachmentSheet',
  () => function FeuilleMock() { return null; },
);

const VILLE = { collectiviteId: 'ville-de-recette' };

const aplatirTexte = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.type !== 'string',
)[0];

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteActualiteForm />);
  });
  return arbre;
};

const PHRASE = 'Cette actualité n’a pas pu être lue : elle a peut-être été supprimée.';

describe('P12-13 — « Modifier » une actualité qu on ne trouve pas', () => {
  it('liste lue sans l actualite : une phrase et « Réessayer », qui relit', async () => {
    const relire = jest.fn();
    mockParams = { ...VILLE, actualiteId: 'actu-supprimee' };
    mockActualites = { data: [{ documentId: 'autre' }], isLoading: false, refetch: relire };
    const arbre = await monter();
    expect(textes(arbre)).toContain(PHRASE);
    const reessayer = parTestID(arbre, 'actualite-form-introuvable-reessayer');
    await act(async () => { reessayer.props.onPress(); });
    expect(relire).toHaveBeenCalledTimes(1);
  });

  it('lecture en echec : la meme phrase', async () => {
    mockParams = { ...VILLE, actualiteId: 'actu-1' };
    mockActualites = {
      data: undefined,
      error: new Error('reseau'),
      isError: true,
      isLoading: false,
      refetch: jest.fn(),
    };
    const arbre = await monter();
    expect(textes(arbre)).toContain(PHRASE);
  });

  it('pendant la lecture : pas de phrase', async () => {
    mockParams = { ...VILLE, actualiteId: 'actu-1' };
    mockActualites = { data: undefined, isLoading: true };
    const arbre = await monter();
    expect(parTestID(arbre, 'actualite-form-introuvable-reessayer')).toBeUndefined();
  });
});
