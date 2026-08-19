import {
  AccessibilityInfo, Image, ScrollView, StyleSheet, Text, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  EVENT_SHOWCASE_FALLBACK_TEMPLATE,
  getEventShowcaseTemplate,
  isEventShowcaseOffered,
} from '@/domains/visuals/eventShowcaseTemplate';
import { SHOWCASE_TEMPLATES } from '@/domains/visuals/useEventShowcase';

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
  // 💥 D28 : ce double ne rendait QUE `useTranslation`. Des que le fichier a
  // importe le resolveur de gabarit — qui tire `is*EventType` du domaine
  // evenement, lequel tire `@/theme/strings` — le vrai i18n s'est initialise et
  // a reclame `initReactI18next` : « You are passing an undefined module ».
  // Suite MORTE, sur du code parfaitement sain. Le greffon minimal suffit.
  initReactI18next: { init: () => {}, type: '3rdParty' },
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

describe('D20 — ⑥ ce que coute une fabrication d affiche', () => {
  // INVERSE le 2026-08-07. AVANT : le montage lancait AUSSI GET /events/:id, dont
  // le seul client etait ShareEventModal — parti de cet ecran (⑦). Une requete
  // reseau de moins, au moment ou l'ecran fabrique son affiche.
  it('le montage ne declenche plus QU UN seul appel : le rendu de l affiche', async () => {
    await renderScreen(eventParams());
    expect(mockFetchRenderBase64).toHaveBeenCalledTimes(1);
    expect(mockClientGet).not.toHaveBeenCalled();
  });

  // INVERSE le 2026-08-07. AVANT : 3 rendus pour 2 affiches distinctes. Mesure du
  // jour (rejeu de visual-renderer.ts, format post 4:5, Chromium chaud) : une
  // affiche coute 1,6 a 2,3 s de Chromium et 0,5 a 1,7 Mo a rapatrier. Le 3e
  // aller-retour repayait donc ~2 s et ~1 Mo pour une image deja a l'ecran.
  it('revenir a un style DEJA VU ne refabrique rien', async () => {
    const tree = await renderScreen(clubParams());
    expect(mockFetchRenderBase64).toHaveBeenCalledTimes(1); // ecusson
    const chips = findVariantChips(tree);

    // `findAll` rend le composite ET son hote pour chaque puce : le dernier noeud
    // est la derniere variante (famille), le premier est la premiere (ecusson).
    await act(async () => { chips[chips.length - 1].props.onPress(); }); // -> famille
    expect(mockFetchRenderBase64).toHaveBeenCalledTimes(2);

    await act(async () => { chips[0].props.onPress(); }); // <- retour a ecusson
    expect(mockFetchRenderBase64).toHaveBeenCalledTimes(2);
  });

  it('le style repris depuis le cache est REMONTRE, pas efface', async () => {
    const tree = await renderScreen(clubParams());
    const chips = findVariantChips(tree);
    await act(async () => { chips[chips.length - 1].props.onPress(); });
    await act(async () => { chips[0].props.onPress(); });
    // L'image est la, tout de suite : ni squelette, ni voile d'attente.
    expect(tree.root.findAllByType(Image).length).toBe(1);
    expect(tree.root.findAllByProps({ testID: 'showcase-skeleton' }).length).toBe(0);
    expect(tree.root.findAllByProps({ testID: 'showcase-preview-veil' }).length).toBe(0);
  });

  // Le cache ne doit JAMAIS montrer la mauvaise affiche : un texte modifie change
  // l'image, donc change la cle.
  it('modifier un texte refabrique l affiche (le cache ne ment pas)', async () => {
    jest.useFakeTimers();
    try {
      const tree = await renderScreen(clubParams());
      expect(mockFetchRenderBase64).toHaveBeenCalledTimes(1);
      await press(tree, 'Personnaliser le texte'); // l'atelier de textes est replie
      const champ = tree.root.findAll(
        (/** @type {any} */ node) => node.props && typeof node.props.onChangeText === 'function',
      )[0];
      await act(async () => { champ.props.onChangeText('Ici, on gagne'); });
      // Les surcharges sont temporisees (400 ms) avant de relancer un rendu.
      await act(async () => { jest.advanceTimersByTime(500); });
      expect(mockFetchRenderBase64).toHaveBeenLastCalledWith(expect.objectContaining({
        overrides: { titre: 'Ici, on gagne' },
      }));
      expect(mockFetchRenderBase64).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  // 🔁 CE TEMOIN A ETE RETOURNE PAR T04 (2026-08-17), et c'est le point 14 de la
  // recette d'Adel. Il FIGEAIT le defaut sous le nom « CONNU : enregistrer le
  // format deja affiche repaie un aller-retour », avec pour motif : « le corriger
  // demande de changer la signature de la couche plateforme — hors du perimetre
  // de ce lot ». C'est exactement ce que T04 a fait : `downloadAndShareRender`
  // accepte desormais les octets deja a l'ecran (`cachedBase64`).
  // Ce que ca evite, mesure du 2026-08-17 : **3,7 a 5,2 s de mediane** et
  // **1,29 Mo** repayes a chaque partage, pour une image identique au pixel pres.
  it('partager le format deja affiche ne repaie PLUS d aller-retour', async () => {
    const tree = await renderScreen(clubParams());
    await press(tree, 'Partager l’affiche');
    expect(mockDownloadAndShareRender).toHaveBeenCalledWith(expect.objectContaining({
      cachedBase64: 'QUJD', format: 'post', template: 'affiche-club', variant: 'ecusson',
    }));
    // Un seul rendu serveur depuis le montage : celui de l'apercu.
    expect(mockFetchRenderBase64).toHaveBeenCalledTimes(1);
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

  // R05 : sur Android la phrase de partage voyage par le presse-papiers, faute
  // d'ACTION_SEND. Copiee sans le dire, elle serait un geste invisible : personne
  // ne pense a coller un texte dont on ne lui a pas parle.
  it('quand la phrase est copiee, l ecran le DIT', async () => {
    mockDownloadAndShareRender.mockResolvedValue({
      fileUri: 'file:///cache/affiche.png', messageCopied: true, opened: true, outcome: 'gallery',
    });
    const tree = await renderScreen(eventParams());
    await press(tree, 'Partager l’affiche');

    const text = renderedText(tree);
    expect(text).toContain('C’est enregistré dans ta galerie photo.');
    expect(text).toContain('Le texte est copié : colle-le avec l’image.');
  });

  // ⛔ Le contraire compte autant : iOS transporte deja le texte dans sa feuille.
  // Annoncer une copie qui n a pas eu lieu enverrait coller du vide.
  it('quand rien n est copie, l ecran n en parle pas', async () => {
    mockDownloadAndShareRender.mockResolvedValue({
      fileUri: 'file:///cache/affiche.png', messageCopied: false, opened: true, outcome: 'gallery',
    });
    const tree = await renderScreen(eventParams());
    await press(tree, 'Partager l’affiche');

    expect(renderedText(tree)).not.toContain('Le texte est copié');
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

// ─────────────────────────────────────────────────────────────────────────────
// D28 — LE TEMOIN D'ARRET : CHAQUE type d'evenement obtient une affiche, et on
// SAIT laquelle. C'est ce bloc qui empechera le prochain type d'arriver avec
// l'affiche d'un autre : ajouter un type au serveur sans l'ajouter ici laisse
// le trou visible, et brancher un gabarit neuf sans le declarer au catalogue
// devient rouge immediatement.
// ─────────────────────────────────────────────────────────────────────────────
describe('D28 — chaque type d evenement obtient une affiche, et on sait laquelle', () => {
  // Les 7 types servis par le serveur, mot pour mot (admin/src/data/event-types.json,
  // lu le 2026-08-07). Les accents comptent : c'est ce que l'app recoit.
  const TYPES_SERVEUR = [
    "Détection / Séance d'essai",
    'Entraînement',
    'Stage',
    'Tournoi',
    'Match',
    'Autre',
    'Réservation',
  ];

  it.each(TYPES_SERVEUR)('« %s » : une affiche est generee, et son gabarit existe', async (
    /** @type {string} */ typeName,
  ) => {
    const template = getEventShowcaseTemplate(typeName);

    // ① Le gabarit choisi est CONNU de l'ecran. Un slug invente (ou une faute de
    // frappe) retomberait en silence sur le repli dans EventPublishedShowcase :
    // ici, il echoue.
    expect(Object.keys(SHOWCASE_TEMPLATES)).toContain(template);

    // ② Une affiche est REELLEMENT demandee au serveur, avec CE gabarit — pas
    // avec celui qu'un repli aurait choisi a la place.
    await renderScreen(eventParams({ template }));
    expect(mockFetchRenderBase64).toHaveBeenCalledWith(expect.objectContaining({
      format: 'post',
      subjectId: 'evt-1',
      subjectType: 'event',
      template,
    }));
  });

  // 🎯 CE TEST A FAIT SON TRAVAIL, ET C'EST POURQUOI IL CHANGE ICI. D28 FIGEAIT
  // LE MANQUE : « un seul gabarit de sujet `event` existe, les 6 autres types
  // tombent sur le repli » — pour que le jour ou le studio livrerait l'affiche
  // du match, son absence de branchement se voie ICI plutot qu'a la recette.
  // Ce jour est le 2026-08-19 (X01) : le studio a livre les 3 gabarits, ils sont
  // branches, et le temoin dit desormais la nouvelle verite — meme role, meme
  // exhaustivite sur les 7 types du serveur.
  it('chaque type mene a SON gabarit, et la detection ne bouge pas', () => {
    // 🔒 Le seul qui marchait avant X01. Il n'a pas bouge.
    expect(getEventShowcaseTemplate("Détection / Séance d'essai")).toBe('affiche-detection');
    // Les deux types qui ont recu leur propre dessin.
    expect(getEventShowcaseTemplate('Match')).toBe('affiche-match');
    expect(getEventShowcaseTemplate('Tournoi')).toBe('affiche-tournoi');
    // Et le gabarit NEUTRE, sans vocabulaire sportif, pour tout le reste —
    // y compris l'entrainement (dont la porte est fermee par D99) et la
    // reservation (type grise). Ce n'est plus l'affiche de quelqu'un d'autre.
    ['Entraînement', 'Stage', 'Autre', 'Réservation'].forEach((typeName) => {
      expect(getEventShowcaseTemplate(typeName)).toBe(EVENT_SHOWCASE_FALLBACK_TEMPLATE);
    });
    expect(EVENT_SHOWCASE_FALLBACK_TEMPLATE).toBe('affiche-evenement');
  });

  // ⛔ NE JAMAIS CASSER LA GENERATION : un type absent, vide, ou servi demain
  // sous un nom que personne n'a prevu garde une affiche.
  it('un type inconnu, vide ou absent garde une affiche (jamais d ecran vide)', () => {
    [undefined, null, '', '   ', 'Barbecue du club'].forEach((typeName) => {
      const template = getEventShowcaseTemplate(/** @type {any} */ (typeName));
      expect(Object.keys(SHOWCASE_TEMPLATES)).toContain(template);
    });
  });

  // Le TITRE est libre : « on cherche des joueurs pour la detection » saisi comme
  // nom de match ne doit pas faire basculer de gabarit. Le type seul decide.
  it('le gabarit se decide sur le TYPE, jamais sur le titre saisi', async () => {
    const template = getEventShowcaseTemplate('Match');
    await renderScreen(eventParams({
      template,
      titleText: 'Détection ouverte — viens montrer ce que tu vaux',
    }));
    expect(mockFetchRenderBase64).toHaveBeenCalledWith(expect.objectContaining({ template }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D99 — L'ENTRAINEMENT N'A PLUS D'AFFICHE. Decision d'Adel du 2026-08-13.
//
// 🧨 CE QUE MESURAIT D88 : l'affiche d'un entrainement etait celle d'une
// detection, elle etait PARTAGEABLE PUBLIQUEMENT, et elle portait l'heure et le
// lieu RECURRENTS d'un groupe — souvent des mineurs. Les personnes concernees
// recoivent deja une notification a la publication et un rappel a H-24 : cette
// affiche ne prevenait donc personne qui ne le soit deja. Elle publiait une
// HABITUDE, et c'est tout ce qu'elle faisait.
//
// ⛔ CE BLOC NE TOUCHE PAS AU GABARIT : les tests ci-dessus restent vrais et
// verts. L'ecran, SI on l'atteint, sait toujours fabriquer une affiche pour les
// 7 types — c'est volontaire. D99 ferme les PORTES qui y menent, il ne casse
// pas le moteur. La regle vit ici, en un seul endroit, parce que deux appelants
// la posent (le menu « Gerer » et la fin du tunnel de creation) et qu'une regle
// recopiee deux fois diverge un jour.
// ─────────────────────────────────────────────────────────────────────────────
describe('D99 — a qui l affiche est-elle proposee', () => {
  it('un ENTRAINEMENT ne se voit plus proposer d affiche', () => {
    // Les trois orthographes que le serveur, l'app et la saisie produisent.
    ['Entraînement', 'Entrainement', 'ENTRAINEMENT'].forEach((typeName) => {
      expect(isEventShowcaseOffered(typeName)).toBe(false);
    });
  });

  // 🔒 LE TEMOIN QUI COMPTE — la non-regression. Un lot qui elargirait la
  // fermeture d'un cran (a « toute seance recurrente », a « tout ce qui a une
  // equipe ») retirerait l'affiche a des evenements qui en VIVENT : une
  // detection sans affiche ne recrute plus personne.
  it('🔒 match, detection, tournoi et stage la proposent TOUJOURS', () => {
    ["Détection / Séance d'essai", 'Match', 'Tournoi', 'Stage'].forEach((typeName) => {
      expect(isEventShowcaseOffered(typeName)).toBe(true);
    });
  });

  // « Autre » et « Reservation » ne sont pas des entrainements : rien ne change
  // pour eux. Et un type absent ou inconnu garde son affiche — fermer sur un
  // doute retirerait un geste a des evenements qu'on n'a pas su nommer.
  it('un type inconnu, vide ou absent garde son affiche', () => {
    [undefined, null, '', '   ', 'Autre', 'Réservation', 'Barbecue du club'].forEach((typeName) => {
      expect(isEventShowcaseOffered(/** @type {any} */ (typeName))).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// D94/C2 — LE MESSAGE DE PARTAGE DIT LA VERITE SUR LES 7 TYPES.
// D28 avait fait suivre le GABARIT au type ; le TEXTE, lui, etait reste unique :
// « Viens participer a notre detection / seance d'essai ! » partait avec
// l'affiche d'un match, d'un entrainement, d'un tournoi. Ce bloc fige les 7
// phrases ET le repli neutre — un type ajoute demain sans phrase se voit ici.
// ─────────────────────────────────────────────────────────────────────────────
describe('D94/C2 — le message de partage suit le type de l evenement', () => {
  const messageDuPartage = async (extra) => {
    const tree = await renderScreen(eventParams(extra));
    await press(tree, 'Partager l’affiche');
    return mockDownloadAndShareRender.mock.calls[0][0].message;
  };

  // Le defaut nomme, sur le type nomme : partager un MATCH ne propose plus de
  // venir essayer. C'est LE temoin d'arret du lot.
  it('partager un MATCH ne propose pas de venir essayer', async () => {
    const message = await messageDuPartage({ eventTypeName: 'Match' });

    expect(message).not.toContain('détection');
    expect(message).not.toContain('essai');
    expect(message).toContain('Viens nous encourager pour ce match !');
  });

  const PHRASES_ATTENDUES = [
    ["Détection / Séance d'essai", 'Viens participer à notre détection / séance d’essai !'],
    ['Match', 'Viens nous encourager pour ce match !'],
    ['Entraînement', 'Rendez-vous à l’entraînement !'],
    ['Tournoi', 'Viens vivre notre tournoi !'],
    ['Stage', 'Découvre notre stage !'],
    ['Réservation', 'Voici les infos de cette réservation.'],
    ['Autre', 'Voici notre prochain événement !'],
  ];

  it.each(PHRASES_ATTENDUES)('« %s » partage « %s »', async (typeName, phrase) => {
    expect(await messageDuPartage({ eventTypeName: typeName })).toContain(phrase);
  });

  // ⛔ JAMAIS de phrase vide, JAMAIS de plantage : un type que le serveur
  // ajouterait demain, ou un lien profond qui n'en porte aucun, recoit une
  // phrase qui n'affirme rien — pas celle d'une detection.
  it.each([undefined, null, '', '   ', 'Barbecue du club'])(
    'un type inconnu (%p) garde un message, neutre et jamais vide',
    async (typeName) => {
      const message = await messageDuPartage({ eventTypeName: typeName });

      expect(message).toContain('Voici notre prochain événement !');
      expect(message).not.toContain('détection');
    },
  );

  // Le club et l'annonce ne sont PAS des evenements : leur texte de gabarit ne
  // bouge pas (non-regression du chemin D28).
  it('le club garde le message de son gabarit', async () => {
    const tree = await renderScreen(clubParams());
    await press(tree, 'Partager l’affiche');

    expect(mockDownloadAndShareRender.mock.calls[0][0].message)
      .toContain('Viens nous rejoindre au club !');
  });
});
