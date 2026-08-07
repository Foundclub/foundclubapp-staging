import {
  AccessibilityInfo, Image, ScrollView, StyleSheet, Text, TouchableOpacity,
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

// L20 : la capacite est une ENTREE de l'ecran (elle est decidee et testee dans
// la couche plateforme). Platform.OS de React Native est un getter non mutable
// sous Jest : on pilote donc la capacite, pas la plateforme.
let mockCapability = 'share-sheet';
jest.mock('@/platform/share/fileShareContract', () => ({
  ...jest.requireActual('@/platform/share/fileShareContract'),
  getFileShareCapability: () => mockCapability,
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any} */ ...args) => mockClientGet(...args) },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

// D20 (⑦) : l'ecran est enregistre en `headerShown: false` (EventStack.js:76 et
// PrivateNavigator.js:649) — il dessine donc SOUS la barre d'etat. Les retraits
// systeme sont figes ici a des valeurs d'iPhone a encoche : c'est le seul moyen
// de constater par test que l'ecran les prend, ou non, en compte.
const mockInsetsEncoche = {
  bottom: 34, left: 0, right: 0, top: 47,
};
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsEncoche,
}));

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

// La vraie feuille tire @gorhom/bottom-sheet, BlurView et le contexte de demarrage :
// hors sujet ici. Le double rend ses enfants QUAND ELLE EST OUVERTE — c'est
// justement ce qu'on veut observer (le choix de format et son ordre).
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ props) {
    return props.isVisible ? props.children : null;
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
 * Params du gabarit evenement — le flux reel d'apres publication (EventWizardRecap).
 * C'est le SEUL sujet qui active « Envoyer dans une conversation » (chatShareEnabled).
 * @param {Record<string, unknown>} [extra]
 * @returns {Record<string, unknown>}
 */
const eventParams = (extra = {}) => ({ eventId: 'evt-1', ...extra });

/**
 * Style APLATI du conteneur de contenu du ScrollView (la ou vivent les marges).
 * @param {any} tree
 * @returns {Record<string, any>}
 */
const contentStyle = (tree) => StyleSheet.flatten(
  tree.root.findByType(ScrollView).props.contentContainerStyle,
) || {};

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
 * Ouvre le choix de format (D20) : c'est le bouton principal de l'ecran.
 * @param {any} tree
 * @returns {Promise<void>}
 */
const openFormatSheet = (tree) => press(tree, 'Enregistrer l’image');

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
  mockCapability = 'share-sheet';
  // Un test met les retraits a zero (temoin negatif) : on les remet a l'encoche.
  mockInsetsEncoche.bottom = 34;
  mockInsetsEncoche.top = 47;
  mockFetchRenderBase64.mockResolvedValue({ base64: 'QUJD', contentType: 'image/png' });
  mockDownloadAndShareRender.mockResolvedValue({
    fileUri: 'file:///cache/affiche.png',
    opened: true,
    outcome: 'shareSheet',
  });
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

// ─────────────────────────────────────────────────────────────────────────────
// D20 — FILET. Ce bloc fige l'etat LIVRE des deux defauts d'Adel du 2026-08-07
// AVANT correction. Chacun de ces tests doit devenir ROUGE quand le defaut est
// corrige : il est alors INVERSE sur place, avec le motif ecrit a cote.
// ─────────────────────────────────────────────────────────────────────────────
describe('D20 — ⑦ l ecran reserve la barre d etat et la barre gestuelle', () => {
  // INVERSE le 2026-08-07. Motif : l'ecran est enregistre `headerShown: false`,
  // rien au-dessus de lui ne reserve la barre d'etat — le titre chevauchait
  // l'heure du telephone (capture d'Adel). Il applique desormais les retraits
  // systeme, comme le gabarit maison ScreenContainer (`insets.top`).
  it('la marge haute vaut la marge d ecran PLUS le retrait systeme', async () => {
    const tree = await renderScreen(eventParams());
    expect(contentStyle(tree).paddingTop).toBe(20 + 47);
  });

  it('la marge basse vaut la marge d ecran PLUS la barre gestuelle', async () => {
    const tree = await renderScreen(eventParams());
    expect(contentStyle(tree).paddingBottom).toBe(20 + 34);
  });

  // TEMOIN NEGATIF : sans retrait systeme (Android sans encoche, web), l'ecran
  // ne doit pas fabriquer d'espace vide — la marge reste celle du gabarit.
  it('sans retrait systeme, la marge reste celle de l ecran (aucun trou)', async () => {
    mockInsetsEncoche.bottom = 0;
    mockInsetsEncoche.top = 0;
    const tree = await renderScreen(eventParams());
    expect(contentStyle(tree).paddingTop).toBe(20);
    expect(contentStyle(tree).paddingBottom).toBe(20);
  });
});

describe('D20 — ⑦ l ecran propose TROIS gestes, dans l ordre voulu par Adel', () => {
  // INVERSE le 2026-08-07 (decision d'Adel). AVANT : 5 gestes au meme niveau.
  it('exactement 3 gestes a l ecran : enregistrer, partager, plus tard', async () => {
    const tree = await renderScreen(eventParams());
    const labels = tree.root
      .findAllByType(TouchableOpacity)
      .map((/** @type {any} */ node) => node.props.accessibilityLabel)
      .filter((/** @type {any} */ label) => label && label !== 'Personnaliser le texte'
        && !String(label).startsWith('Choisir le style'));
    expect(labels).toEqual(['Enregistrer l’image', 'Partager l’affiche', 'Plus tard']);
  });

  // SUPPRIME avec son sujet, motif ecrit ici : « Envoyer dans une conversation »
  // etait deja une IMPASSE sur cet ecran (l'ecran passait un onSelectChat qui ne
  // faisait que refermer la fenetre, alors que ShareEventModal.js:220 delegue
  // l'envoi au parent). Le geste QUI MARCHE survit sur EventDetails :
  // EventParticipants.js:615 (icone de partage) -> EventDetails.js:5413
  // <ShareEventModal onSelectChat={handleShareEventInChat}>, et « Plus tard »
  // depose justement l'utilisateur sur cet ecran (pile posee par EventWizardRecap).
  it('« Envoyer dans une conversation » a quitte cet ecran', async () => {
    const tree = await renderScreen(eventParams());
    expect(renderedText(tree)).not.toContain('Envoyer dans une conversation');
    expect(tree.root.findAll(
      (/** @type {any} */ node) => node.props && typeof node.props.onSelectChat === 'function',
    )).toHaveLength(0);
  });

  it('les formats ne sont plus a l ecran : ils vivent dans le choix de format', async () => {
    const tree = await renderScreen(eventParams());
    expect(renderedText(tree)).not.toContain('9:16');
    expect(renderedText(tree)).not.toContain('A4');

    await openFormatSheet(tree);
    const text = renderedText(tree);
    expect(text).toContain('Dans mes photos');
    expect(text).toContain('9:16');
    expect(text).toContain('A4');
  });

  // La demande d'Adel, mot pour mot : « le premier propose est l'enregistrement
  // dans les photos du telephone ».
  it('le PREMIER format propose est l enregistrement dans les photos', async () => {
    const FORMATS = ['Affiche A4 à imprimer', 'Dans mes photos', 'Version story 9:16'];
    const tree = await renderScreen(eventParams());
    await openFormatSheet(tree);
    const labels = tree.root
      .findAllByType(TouchableOpacity)
      .map((/** @type {any} */ node) => node.props.accessibilityLabel)
      .filter((/** @type {any} */ label) => FORMATS.includes(label));
    // L'ORDRE compte : c'est la demande d'Adel, mot pour mot.
    expect(labels).toEqual(['Dans mes photos', 'Version story 9:16', 'Affiche A4 à imprimer']);
  });

  it('« Dans mes photos » enregistre l image TELLE QU AFFICHEE (post 4:5)', async () => {
    const tree = await renderScreen(clubParams());
    await openFormatSheet(tree);
    await press(tree, 'Dans mes photos');
    expect(mockDownloadAndShareRender).toHaveBeenCalledWith(expect.objectContaining({
      format: 'post', subjectId: 'club-1', template: 'affiche-club', variant: 'ecusson',
    }));
    // Enregistrer, ce n'est pas partager : aucun texte de partage n'accompagne
    // le fichier (le lien voyage avec « Partager l'affiche », pas ici).
    expect(mockDownloadAndShareRender.mock.calls[0][0].message).toBeUndefined();
  });

  // Le choix de format masquerait l'indicateur d'attente et le message de
  // resultat : il se referme des que le travail demarre.
  it('choisir un format referme la feuille pour laisser voir l attente', async () => {
    const tree = await renderScreen(clubParams());
    await openFormatSheet(tree);
    expect(renderedText(tree)).toContain('Dans mes photos');
    await press(tree, 'Version story 9:16');
    expect(renderedText(tree)).not.toContain('Dans mes photos');
  });
});

describe('D20 filet — ⑥ ce que coute une fabrication d affiche', () => {
  it('AVANT : le montage declenche 1 rendu serveur ET 1 requete evenement', async () => {
    await renderScreen(eventParams());
    expect(mockFetchRenderBase64).toHaveBeenCalledTimes(1);
    // La 2e requete n'alimente QUE ShareEventModal (le geste impasse ci-dessus).
    expect(mockClientGet).toHaveBeenCalledWith('/events/evt-1');
  });

  it('AVANT : revenir a un style DEJA VU le refabrique — aucun cache', async () => {
    const tree = await renderScreen(clubParams());
    expect(mockFetchRenderBase64).toHaveBeenCalledTimes(1); // ecusson
    const chips = findVariantChips(tree);

    // `findAll` rend le composite ET son hote pour chaque puce : le dernier noeud
    // est la derniere variante (famille), le premier est la premiere (ecusson).
    await act(async () => { chips[chips.length - 1].props.onPress(); }); // -> famille
    await act(async () => { chips[0].props.onPress(); }); // <- retour a ecusson

    // 3 rendus pour 2 affiches distinctes : le retour au style deja affiche
    // repaie un aller-retour serveur complet.
    expect(mockFetchRenderBase64).toHaveBeenCalledTimes(3);
  });

  it('AVANT : enregistrer le format DEJA affiche relance un rendu complet', async () => {
    const tree = await renderScreen(clubParams());
    expect(mockFetchRenderBase64).toHaveBeenCalledTimes(1);
    await press(tree, 'Partager l’affiche');
    // `downloadAndShareRender` refait `fetchRenderBase64` avec les MEMES
    // parametres que l'apercu deja affiche (visualRender.native.js l.86).
    expect(mockDownloadAndShareRender).toHaveBeenCalledWith(expect.objectContaining({
      format: 'post', template: 'affiche-club', variant: 'ecusson',
    }));
  });
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

  // D20 : les deux formats ont demenage dans le choix de format. Ce qu'ils
  // ENVOIENT n'a pas change d'un octet — c'est le temoin de non-regression.
  it('« Version story 9:16 » envoie le PNG 9:16 (temoin de non-regression)', async () => {
    const tree = await renderScreen(clubParams());
    await openFormatSheet(tree);
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
    await openFormatSheet(tree);
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
    await press(tree, 'Partager l’affiche');
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
    await press(tree, 'Partager l’affiche');
    const { message } = mockDownloadAndShareRender.mock.calls[0][0];
    expect(message).toContain(CLUB_URL);
    expect(message).toContain('Viens nous rejoindre au club !');
  });

  // Ancien defaut : `if (!shareUrl) return;` rendait le bouton MUET, sans message.
  it('sans lien a joindre, il envoie quand meme l affiche (jamais un bouton muet)', async () => {
    const tree = await renderScreen(clubParams({ shareUrl: undefined }));
    await press(tree, 'Partager l’affiche');
    expect(mockDownloadAndShareRender).toHaveBeenCalledWith(expect.objectContaining({
      format: 'post',
      subjectId: 'club-1',
    }));
  });

  it('tant qu aucune affiche n existe, les DEUX boutons sont GRISES et non muets', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());
    ['Enregistrer l’image', 'Partager l’affiche'].forEach((label) => {
      const node = findPressable(tree, label);
      expect(node.props.disabled).toBe(true);
      expect(node.props.accessibilityState.disabled).toBe(true);
    });
  });

  it('chaque bouton dit ce qu on obtient, et que l image est enregistrable', async () => {
    const tree = await renderScreen(clubParams());
    expect(renderedText(tree)).toContain('enregistrer');
    await openFormatSheet(tree);
    const text = renderedText(tree);
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
  // INVERSE le 2026-08-07 (D20). AVANT : les 2 formats etaient a l'ecran, sous le
  // bouton principal. Ils sont maintenant DANS le choix de format — la hierarchie
  // n'a pas disparu, elle a change de niveau.
  it('un seul bouton principal, et les deux formats sont dans son choix', async () => {
    const tree = await renderScreen(clubParams());
    const labels = tree.root
      .findAllByType(TouchableOpacity)
      .map((/** @type {any} */ node) => node.props.accessibilityLabel);
    expect(labels).toContain('Enregistrer l’image');
    expect(labels).toContain('Partager l’affiche');
    expect(labels).toContain('Plus tard');
    expect(labels).not.toContain('Version story 9:16');

    await openFormatSheet(tree);
    const dansLaFeuille = tree.root
      .findAllByType(TouchableOpacity)
      .map((/** @type {any} */ node) => node.props.accessibilityLabel);
    expect(dansLaFeuille).toContain('Version story 9:16');
    expect(dansLaFeuille).toContain('Affiche A4 à imprimer');
  });

  it('un echec de partage se dit a l ecran', async () => {
    mockDownloadAndShareRender.mockRejectedValue(new Error('reseau'));
    const tree = await renderScreen(clubParams());
    await openFormatSheet(tree);
    await press(tree, 'Version story 9:16');
    expect(renderedText(tree)).toContain('Le téléchargement a échoué');
    expect(tree.root.findAllByType(Text).length).toBeGreaterThan(0);
  });
});

describe('EventPublishedShowcase — L20, Android enregistre et le dit', () => {
  beforeEach(() => {
    mockCapability = 'save-then-open';
  });

  // INVERSE le 2026-08-07 (D20). AVANT : le LIBELLE du bouton principal changeait
  // (« Enregistrer l'affiche » sur Android). Les libelles sont maintenant fixes —
  // Adel les a decides. L'honnetete L20 n'a pas disparu : elle est passee dans la
  // LIGNE D'EXPLICATION, qui dit toujours ce que la plateforme fait vraiment.
  it('l explication annonce l ENREGISTREMENT, pas un envoi qui n arrive pas', async () => {
    const tree = await renderScreen(clubParams());
    const labels = tree.root
      .findAllByType(TouchableOpacity)
      .map((/** @type {any} */ node) => node.props.accessibilityLabel);
    expect(labels).toContain('Partager l’affiche');
    expect(renderedText(tree)).toContain('galerie photo');
    expect(renderedText(tree)).not.toContain('Dans la fenêtre de partage');
  });

  it('les formats story et A4 disent OU le fichier atterrit', async () => {
    const tree = await renderScreen(clubParams());
    await openFormatSheet(tree);
    const text = renderedText(tree);
    expect(text).toContain('enregistrée dans ta galerie');
    expect(text).toContain('enregistré dans tes téléchargements');
  });

  // Sans titre de selecteur, Android ouvre l application par defaut : plus de choix.
  it('le selecteur d application est titre', async () => {
    const tree = await renderScreen(clubParams());
    await openFormatSheet(tree);
    await press(tree, 'Dans mes photos');
    expect(mockDownloadAndShareRender).toHaveBeenCalledWith(expect.objectContaining({
      dialogTitle: 'Ouvrir l’affiche avec…',
      format: 'post',
    }));
  });

  // Un fichier range en silence, hors de l ecran, est percu comme un echec.
  it('un enregistrement reussi se dit a l ecran', async () => {
    mockDownloadAndShareRender.mockResolvedValue({
      fileUri: 'file:///cache/affiche.png', opened: true, outcome: 'gallery',
    });
    const tree = await renderScreen(clubParams());
    await openFormatSheet(tree);
    await press(tree, 'Dans mes photos');
    expect(renderedText(tree)).toContain('C’est enregistré dans ta galerie photo.');
  });

  it('un PDF range dans les telechargements le dit aussi', async () => {
    mockDownloadAndShareRender.mockResolvedValue({
      fileUri: 'file:///cache/affiche.pdf', opened: false, outcome: 'downloads',
    });
    const tree = await renderScreen(clubParams());
    await openFormatSheet(tree);
    await press(tree, 'Affiche A4 à imprimer');
    expect(renderedText(tree)).toContain('C’est enregistré dans tes téléchargements.');
  });
});

describe('EventPublishedShowcase — L20, un refus parle et nomme sa cause', () => {
  beforeEach(() => {
    mockCapability = 'save-then-open';
  });

  it('permission refusee : le message envoie aux REGLAGES, pas a la connexion', async () => {
    const refus = Object.assign(new Error('permission_denied'), { reason: 'permission_denied' });
    mockDownloadAndShareRender.mockRejectedValue(refus);
    const tree = await renderScreen(clubParams());
    await press(tree, 'Partager l’affiche');
    const text = renderedText(tree);
    expect(text).toContain('n’a pas le droit d’enregistrer');
    expect(text).not.toContain('Vérifie ta connexion');
  });

  it('ecriture impossible : le message parle de PLACE, pas de connexion', async () => {
    const echec = Object.assign(new Error('save_failed'), { reason: 'save_failed' });
    mockDownloadAndShareRender.mockRejectedValue(echec);
    const tree = await renderScreen(clubParams());
    await press(tree, 'Partager l’affiche');
    const text = renderedText(tree);
    expect(text).toContain('trop peu de place');
    expect(text).not.toContain('Vérifie ta connexion');
  });

  it('cause inconnue : le message generique reste (jamais de silence)', async () => {
    mockDownloadAndShareRender.mockRejectedValue(new Error('reseau'));
    const tree = await renderScreen(clubParams());
    await press(tree, 'Partager l’affiche');
    expect(renderedText(tree)).toContain('Le téléchargement a échoué');
  });

  it('apres un echec, un succes efface le message d erreur', async () => {
    mockDownloadAndShareRender.mockRejectedValueOnce(new Error('reseau'));
    const tree = await renderScreen(clubParams());
    await press(tree, 'Partager l’affiche');
    expect(renderedText(tree)).toContain('Le téléchargement a échoué');

    mockDownloadAndShareRender.mockResolvedValue({
      fileUri: 'file:///cache/affiche.png', opened: true, outcome: 'gallery',
    });
    await press(tree, 'Partager l’affiche');
    const text = renderedText(tree);
    expect(text).not.toContain('Le téléchargement a échoué');
    expect(text).toContain('C’est enregistré dans ta galerie photo.');
  });
});

describe('EventPublishedShowcase — L20, TEMOIN POSITIF : iOS et web ne changent pas', () => {
  // INVERSE le 2026-08-07 (D20) : le libelle ne depend plus de la plateforme,
  // c'est l'EXPLICATION qui distingue iOS/web (fenetre de partage) d'Android
  // (galerie). Le contrat L20 tient toujours : rien ne promet un envoi ailleurs.
  it('sur iOS et web, l explication parle de la fenetre de partage', async () => {
    const tree = await renderScreen(clubParams());
    const labels = tree.root
      .findAllByType(TouchableOpacity)
      .map((/** @type {any} */ node) => node.props.accessibilityLabel);
    expect(labels).toContain('Partager l’affiche');
    expect(renderedText(tree)).toContain('Dans la fenêtre de partage');
    expect(renderedText(tree)).not.toContain('galerie photo');
  });

  it('la feuille de partage etant son propre retour, aucun message ne s ajoute', async () => {
    const tree = await renderScreen(clubParams());
    await press(tree, 'Partager l’affiche');
    const text = renderedText(tree);
    expect(text).not.toContain('C’est enregistré');
    expect(text).not.toContain('Le téléchargement a échoué');
  });

  // Le web resout l'URL objet du telechargement navigateur : une CHAINE, sans
  // `outcome`. L'ecran doit la traverser sans message et sans planter.
  it('web : une chaine en retour ne produit ni message ni erreur', async () => {
    mockDownloadAndShareRender.mockResolvedValue('blob:https://test.foundclub/abc');
    const tree = await renderScreen(clubParams());
    await press(tree, 'Partager l’affiche');
    const text = renderedText(tree);
    expect(text).not.toContain('C’est enregistré');
    expect(text).not.toContain('Le téléchargement a échoué');
  });
});
