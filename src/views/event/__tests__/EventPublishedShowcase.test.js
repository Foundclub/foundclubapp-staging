import {
  AccessibilityInfo, Image, Text, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventPublishedShowcase from '../EventPublishedShowcase';

// L16 (E6) : EventPublishedShowcase.js n'avait AUCUN test. Ce fichier caracterise
// d'abord le comportement livre — dont le fait que le bouton le plus visible
// partageait un LIEN et non l'affiche — puis verrouille la correction.
//
// On mocke la couche PLATEFORME (@/platform/visualRender, @/platform/share) et non
// le hook : le chemin ecran -> useVisualShowcase -> rendu serveur reste reel, donc
// le format demande (post / story / a4) est reellement observe.

const mockDownloadAndShareRender = jest.fn();
const mockFetchRenderBase64 = jest.fn();
const mockShare = jest.fn();
const mockClientGet = jest.fn();
const mockSkeletonProps = [];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // i18next rend le 2e argument chaine comme defaultValue et interpole {{x}} :
    // le mock fait pareil, sinon les libelles a11y porteraient « {{label}} ».
    t: (/** @type {string} */ key, /** @type {any} */ fallback, /** @type {any} */ vars) => {
      const base = typeof fallback === 'string' ? fallback : key;
      if (!vars) return base;
      return Object.keys(vars).reduce(
        (acc, name) => acc.replace(`{{${name}}}`, String(vars[name])),
        base,
      );
    },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: { hitSlop: makeRamp() },
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

jest.mock('@/platform/visualRender', () => ({
  downloadAndShareRender: (/** @type {any} */ ...args) => mockDownloadAndShareRender(...args),
  fetchRenderBase64: (/** @type {any} */ ...args) => mockFetchRenderBase64(...args),
}));

jest.mock('@/platform/share', () => ({
  __esModule: true,
  default: { share: (/** @type {any} */ ...args) => mockShare(...args) },
  share: (/** @type {any} */ ...args) => mockShare(...args),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any} */ ...args) => mockClientGet(...args) },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: () => 'https://api.test.foundclub/api',
  getPublicApiOrigin: () => 'https://test.foundclub',
}));

jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});

jest.mock(
  '@/components/organisms/shareEventModal/ShareEventModal',
  () => function ShareEventModalMock() {
    return null;
  },
);

// SkeletonLoader tire MaskedView / LinearGradient / Reanimated : hors sujet ici.
// Le mock conserve les props pour verifier le respect de « reduire les animations ».
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonLoaderMock(
  /** @type {any} */ props,
) {
  mockSkeletonProps.push(props);
  return null;
});

const CLUB_URL = 'https://test.foundclub/clubs/club-1';

// Le premier montage transpile tout le graphe d'imports de l'ecran : au-dela des
// 5 s par defaut de Jest sur un poste froid, sans que rien ne soit casse.
jest.setTimeout(20000);

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

/** @type {any} */
let mounted = null;

/**
 * Monte l'ecran avec les params de navigation donnes.
 * @param {Record<string, unknown>} [params]
 * @returns {Promise<any>}
 */
const renderScreen = async (params = {}) => {
  await act(async () => {
    mounted = renderer.create(
      <EventPublishedShowcase
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params })}
      />,
    );
  });
  return mounted;
};

/**
 * Params du gabarit affiche-club, tels que ClubDetails les passe reellement.
 * @param {Record<string, unknown>} [extra]
 * @returns {Record<string, unknown>}
 */
const clubParams = (extra = {}) => ({
  chatShareEnabled: false,
  shareUrl: CLUB_URL,
  subjectId: 'club-1',
  subjectType: 'club',
  template: 'affiche-club',
  ...extra,
});

/**
 * Premier noeud pressable portant ce libelle d'accessibilite.
 * @param {any} tree
 * @param {string} label
 * @returns {any}
 */
const findPressable = (tree, label) => tree.root.findAll(
  (/** @type {any} */ node) => node.props
    && node.props.accessibilityLabel === label
    && typeof node.props.onPress === 'function',
)[0];

/**
 * Presse le bouton portant ce libelle et laisse les promesses se vider.
 * @param {any} tree
 * @param {string} label
 * @returns {Promise<void>}
 */
const press = async (tree, label) => {
  const node = findPressable(tree, label);
  expect(node).toBeTruthy();
  await act(async () => {
    await node.props.onPress();
  });
};

/**
 * Puces de style (accessibilityRole radio) reellement pressables.
 * @param {any} tree
 * @returns {any[]}
 */
const findVariantChips = (tree) => tree.root.findAll(
  (/** @type {any} */ node) => node.props
    && node.props.accessibilityRole === 'radio'
    && typeof node.props.onPress === 'function',
);

/**
 * Serialise l'arbre rendu pour verifier la presence (ou l'absence) d'un texte.
 * @param {any} tree
 * @returns {string}
 */
const renderedText = (tree) => JSON.stringify(tree.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockSkeletonProps.length = 0;
  mockFetchRenderBase64.mockResolvedValue({ base64: 'QUJD', contentType: 'image/png' });
  mockDownloadAndShareRender.mockResolvedValue('file:///cache/affiche.png');
  mockClientGet.mockResolvedValue({ data: { data: null } });
});

// Le hook temporise les surcharges texte (400 ms). Sans demontage, ce minuteur
// retombe PENDANT le test suivant et le pollue d'avertissements act().
afterEach(() => {
  if (mounted) {
    act(() => { mounted.unmount(); });
    mounted = null;
  }
});

describe('EventPublishedShowcase — comportement livre (caracterisation E6)', () => {
  it('affiche le titre, le sous-titre et les styles du gabarit club', async () => {
    const tree = await renderScreen(clubParams());
    const text = renderedText(tree);
    expect(text).toContain('Ton affiche club est prête');
    expect(text).toContain('Fais-la voir. Plus elle est vue, plus on te rejoint.');
    expect(text).toContain('Écusson');
    expect(text).toContain('Famille');
  });

  it("genere l'apercu au format post (4:5) du style par defaut", async () => {
    await renderScreen(clubParams());
    expect(mockFetchRenderBase64).toHaveBeenCalledWith(expect.objectContaining({
      format: 'post',
      subjectId: 'club-1',
      subjectType: 'club',
      template: 'affiche-club',
      variant: 'ecusson',
    }));
  });

  it('« Version story 9:16 » envoie le PNG 9:16 (temoin de non-regression)', async () => {
    const tree = await renderScreen(clubParams());
    await press(tree, 'Version story 9:16');
    expect(mockDownloadAndShareRender).toHaveBeenCalledWith(expect.objectContaining({
      format: 'story',
      subjectId: 'club-1',
      template: 'affiche-club',
      variant: 'ecusson',
    }));
  });

  it('« Affiche A4 a imprimer » envoie le PDF A4 (temoin de non-regression)', async () => {
    const tree = await renderScreen(clubParams());
    await press(tree, 'Affiche A4 à imprimer');
    expect(mockDownloadAndShareRender).toHaveBeenCalledWith(expect.objectContaining({
      format: 'a4',
      subjectId: 'club-1',
      template: 'affiche-club',
      variant: 'ecusson',
    }));
  });

  it('« Plus tard » revient en arriere', async () => {
    const tree = await renderScreen(clubParams());
    await press(tree, 'Plus tard');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('changer de style regenere l apercu dans le nouveau style', async () => {
    const tree = await renderScreen(clubParams());
    const chips = findVariantChips(tree);
    expect(chips.length).toBeGreaterThan(0);
    await act(async () => {
      chips[chips.length - 1].props.onPress();
    });
    expect(mockFetchRenderBase64).toHaveBeenLastCalledWith(expect.objectContaining({
      format: 'post',
      variant: 'famille',
    }));
  });
});

describe('EventPublishedShowcase — L16, le bouton principal envoie l affiche', () => {
  // Le defaut central corrige : le bouton le plus visible envoyait un LIEN vers la
  // page du club (SharePlatform.share), jamais l'affiche. Il envoie le FICHIER.
  it("envoie le FICHIER de l'affiche au format affiche (post 4:5), pas un lien", async () => {
    const tree = await renderScreen(clubParams());
    await press(tree, 'Envoyer l’affiche');
    expect(mockDownloadAndShareRender).toHaveBeenCalledWith(expect.objectContaining({
      format: 'post',
      subjectId: 'club-1',
      subjectType: 'club',
      template: 'affiche-club',
      variant: 'ecusson',
    }));
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('joint le lien du club dans le message du meme partage', async () => {
    const tree = await renderScreen(clubParams());
    await press(tree, 'Envoyer l’affiche');
    const { message } = mockDownloadAndShareRender.mock.calls[0][0];
    expect(message).toContain(CLUB_URL);
    expect(message).toContain('Viens nous rejoindre au club !');
  });

  // Ancien defaut : `if (!shareUrl) return;` rendait le bouton MUET, sans message.
  it('sans lien a joindre, il envoie quand meme l affiche (jamais un bouton muet)', async () => {
    const tree = await renderScreen(clubParams({ shareUrl: undefined }));
    await press(tree, 'Envoyer l’affiche');
    expect(mockDownloadAndShareRender).toHaveBeenCalledWith(expect.objectContaining({
      format: 'post',
      subjectId: 'club-1',
    }));
  });

  it('tant qu aucune affiche n existe, le bouton est GRISE et non muet', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());
    const node = findPressable(tree, 'Envoyer l’affiche');
    expect(node.props.disabled).toBe(true);
    expect(node.props.accessibilityState.disabled).toBe(true);
  });

  it('chaque bouton dit ce qu on obtient, et que l image est enregistrable', async () => {
    const tree = await renderScreen(clubParams());
    const text = renderedText(tree);
    expect(text).toContain('enregistrer');
    expect(text).toContain('9:16');
    expect(text).toContain('A4');
  });
});

describe('EventPublishedShowcase — L16, le chargement montre la forme de l affiche', () => {
  it('premiere generation : le squelette au format de l affiche est rendu', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());
    expect(tree.root.findAllByProps({ testID: 'showcase-skeleton' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByType(Image).length).toBe(0);
  });

  it('regeneration : l apercu precedent reste visible sous un voile (pas de clignotement)', async () => {
    const tree = await renderScreen(clubParams());
    expect(tree.root.findAllByType(Image).length).toBe(1);

    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const chips = findVariantChips(tree);
    await act(async () => {
      chips[chips.length - 1].props.onPress();
    });

    expect(tree.root.findAllByType(Image).length).toBe(1);
    expect(tree.root.findAllByProps({ testID: 'showcase-preview-veil' }).length)
      .toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'showcase-skeleton' }).length).toBe(0);
  });

  it('« reduire les animations » : le squelette est rendu, mais fige', async () => {
    // Mocke par le preset react-native (jest/setup.js) : jest.fn -> Promise false.
    /** @type {any} */ (AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));

    const tree = await renderScreen(clubParams());

    expect(tree.root.findAllByProps({ testID: 'showcase-skeleton' }).length).toBeGreaterThan(0);
    expect(mockSkeletonProps.length).toBeGreaterThan(0);
    expect(mockSkeletonProps[mockSkeletonProps.length - 1].isActive).toBe(false);
  });
});

describe('EventPublishedShowcase — hierarchie et etats', () => {
  it('un seul bouton principal, et les deux formats lui sont subordonnes', async () => {
    const tree = await renderScreen(clubParams());
    const labels = tree.root
      .findAllByType(TouchableOpacity)
      .map((/** @type {any} */ node) => node.props.accessibilityLabel);
    expect(labels).toContain('Envoyer l’affiche');
    expect(labels).toContain('Version story 9:16');
    expect(labels).toContain('Affiche A4 à imprimer');
    expect(labels).toContain('Plus tard');
  });

  it('un echec de partage se dit a l ecran', async () => {
    mockDownloadAndShareRender.mockRejectedValue(new Error('reseau'));
    const tree = await renderScreen(clubParams());
    await press(tree, 'Version story 9:16');
    expect(renderedText(tree)).toContain('Le téléchargement a échoué');
    expect(tree.root.findAllByType(Text).length).toBeGreaterThan(0);
  });
});
