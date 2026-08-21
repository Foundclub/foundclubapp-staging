import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventPublishedShowcase from '../EventPublishedShowcase';

// ─────────────────────────────────────────────────────────────────────────────
// AA08 (2026-08-20) — LE CONSTAT D'ADEL, MOT POUR MOT :
//   « apres la creation d un evenement, l affiche propose "enregistrer l image",
//     qui ne sert pas — et on ne peut pas quitter la page. En prime, le format
//     PDF bugue a l enregistrement. »
//
// ⚠️ CE FICHIER RENVERSE UNE DECISION D20 (2026-08-07), qui etait elle aussi
// d'Adel : « trois gestes, enregistrer / partager / plus tard », les formats
// ranges dans une feuille. Cette feuille n'avait qu'UNE porte — le bouton
// « Enregistrer l image » — et c'est justement celle qu'Adel retire.
// ⇒ Story et affiche A4 remontent a l'ecran, sinon le PDF qu'il demande de
//   reparer deviendrait INATTEIGNABLE.
//
// 🚪 « On ne peut pas quitter la page » se constate dans le code : l'ecran est
// enregistre `headerShown: false` (EventStack.js:91, PrivateNavigator.js:616),
// donc AUCUNE fleche de retour au-dessus de lui ; la seule sortie, « Plus tard »,
// vit tout en bas d'un ScrollView, sous l'apercu, l'editeur et les boutons.
// ⇒ une croix, en haut a droite, TOUJOURS pressable — meme pendant que
//   l'affiche se fabrique, meme quand elle a echoue.
// ─────────────────────────────────────────────────────────────────────────────

const mockDownloadAndShareRender = jest.fn();
const mockFetchRenderBase64 = jest.fn();
const mockShare = jest.fn();
const mockClientGet = jest.fn();

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
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

// Le double rend ses enfants QUAND la feuille est ouverte. Il reste ici EXPRES :
// si une feuille de format revenait un jour, ses entrees seraient visibles — et
// les temoins ⛔ ci-dessous la verraient.
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ props) {
    return props.isVisible ? props.children : null;
  },
);

jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonLoaderMock() {
  return null;
});

jest.setTimeout(20000);

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

/** @type {any} */
let mounted = null;

/**
 * Monte l ecran avec les params de navigation donnes.
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
 * Params du flux reel d apres publication (EventWizardRecap).
 * @param {Record<string, unknown>} [extra]
 * @returns {Record<string, unknown>}
 */
const eventParams = (extra = {}) => ({ eventId: 'evt-1', ...extra });

/**
 * Tous les noeuds pressables portant ce libelle d accessibilite.
 * @param {any} tree
 * @param {string} label
 * @returns {any[]}
 */
const findAllPressable = (tree, label) => tree.root.findAll(
  (/** @type {any} */ node) => node.props
    && node.props.accessibilityLabel === label
    && typeof node.props.onPress === 'function',
);

/**
 * Premier noeud pressable portant ce libelle d accessibilite.
 * @param {any} tree
 * @param {string} label
 * @returns {any}
 */
const findPressable = (tree, label) => findAllPressable(tree, label)[0];

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

/** AC02 — le libelle du depliant qui range story et A4 derriere le partage. */
const DEPLIANT_FORMATS = 'Autres formats : story, A4 à imprimer';

/**
 * AC02 (2026-08-21) — OUVRE LE DEPLIANT « Autres formats ».
 * Story et A4 ne sont PLUS a l'ecran : decision d'Adel du 21/08, « je ne veux
 * que le bouton partager ». Ils ne sont pas supprimes, ils sont a DEUX gestes.
 * Tout temoin qui les presse ouvre donc d'abord — et c'est CE helper qui mesure
 * les deux gestes.
 * 🧨 IDEMPOTENT : le depliant est une BASCULE. Appele deux fois, il refermerait
 * le panneau et l'inventaire reviendrait vide — ca se lirait comme une
 * regression du code alors que c'est le helper qui l'aurait fabriquee.
 * @param {any} tree
 * @returns {Promise<void>}
 */
const ouvrirAutresFormats = async (tree) => {
  const dejaOuvert = tree.root.findAll(
    (/** @type {any} */ n) => n.props && n.props.accessibilityLabel === 'Version story 9:16',
  ).length > 0;
  if (dejaOuvert) return;
  const depliant = tree.root.findAll(
    (/** @type {any} */ n) => n.props
      && n.props.accessibilityLabel === DEPLIANT_FORMATS
      && typeof n.props.onPress === 'function',
  )[0];
  expect(depliant).toBeTruthy();
  await act(async () => { await depliant.props.onPress(); });
};

/**
 * Serialise l arbre rendu pour verifier la presence (ou l absence) d un texte.
 * @param {any} tree
 * @returns {string}
 */
const renderedText = (tree) => JSON.stringify(tree.toJSON());

/**
 * Le format reellement demande au serveur lors du dernier telechargement.
 * @returns {string}
 */
const dernierFormatDemande = () => mockDownloadAndShareRender.mock.calls.at(-1)[0].format;

beforeEach(() => {
  jest.clearAllMocks();
  mockCapability = 'share-sheet';
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

afterEach(() => {
  if (mounted) {
    act(() => { mounted.unmount(); });
    mounted = null;
  }
});

describe('AA08 — ① le geste qui ne servait a rien a quitte l ecran', () => {
  it('⛔ « Enregistrer l image » n est plus propose nulle part', async () => {
    const tree = await renderScreen(eventParams());
    expect(findPressable(tree, 'Enregistrer l’image')).toBeUndefined();
    expect(renderedText(tree)).not.toContain('Enregistrer l’image');
  });

  it('⛔ « Dans mes photos » non plus — c etait le MEME geste que Partager', async () => {
    const tree = await renderScreen(eventParams());
    expect(findPressable(tree, 'Dans mes photos')).toBeUndefined();
    expect(renderedText(tree)).not.toContain('Dans mes photos');
  });

  it('⛔ plus aucune feuille de format ne peut s ouvrir', async () => {
    const tree = await renderScreen(eventParams());
    expect(renderedText(tree)).not.toContain('Sous quel format ?');
  });
});

describe('AA08 — ② « Partager » reste, et envoie toujours l affiche affichee', () => {
  it('✅ le bouton est la, et demande le format de l apercu (post 4:5)', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, 'Partager l’affiche');
    expect(mockDownloadAndShareRender).toHaveBeenCalledTimes(1);
    expect(dernierFormatDemande()).toBe('post');
  });
});

// ⚠️ RE-INTITULE le 2026-08-21 (AC02, decision d'Adel). AA08 mesurait ici
// « EN UN SEUL geste », parce qu'il venait de retirer la feuille qui cachait les
// formats. Adel a tranche le 21/08 : « je ne veux que le bouton partager », et
// « les deux autres formats passent DERRIERE ».
// ⛔ CE QUE CE BLOC PROTEGE N'A PAS BOUGE D'UN POUCE : le PDF et la story
//   restent ATTEIGNABLES, et rien ne les cache derriere une feuille. Seul le
//   COMPTE de gestes change : 1 -> 2, et le temoin le mesure explicitement.
describe('AA08/AC02 — ③ le PDF reste atteignable, en DEUX gestes au plus', () => {
  it('🐛 « Affiche A4 a imprimer » s atteint en 2 gestes, sans aucune feuille', async () => {
    const tree = await renderScreen(eventParams());
    // Geste 1 : le depliant. Geste 2 : le format. Jamais un troisieme.
    await ouvrirAutresFormats(tree);
    const bouton = findPressable(tree, 'Affiche A4 à imprimer');
    expect(bouton).toBeTruthy();
    await act(async () => { await bouton.props.onPress(); });
    expect(dernierFormatDemande()).toBe('a4');
    expect(renderedText(tree)).not.toContain('Sous quel format ?');
  });

  it('la version story aussi, derriere le meme depliant', async () => {
    const tree = await renderScreen(eventParams());
    await ouvrirAutresFormats(tree);
    const bouton = findPressable(tree, 'Version story 9:16');
    expect(bouton).toBeTruthy();
    await act(async () => { await bouton.props.onPress(); });
    expect(dernierFormatDemande()).toBe('story');
  });

  it('🔒 un PDF qui ne se fabrique pas ne renvoie plus vers la CONNEXION', async () => {
    // Le defaut : l apercu (meme reseau, meme jeton) venait d arriver, et
    // l ecran repondait « Verifie ta connexion » a un serveur de rendu en panne.
    const panne = new Error('render affiche-detection/a4 -> HTTP 500');
    panne.reason = 'render_failed';
    mockDownloadAndShareRender.mockRejectedValueOnce(panne);
    const tree = await renderScreen(eventParams());
    await ouvrirAutresFormats(tree);
    await press(tree, 'Affiche A4 à imprimer');
    const texte = renderedText(tree);
    expect(texte).not.toContain('Vérifie ta connexion');
    expect(texte).toContain('n’a pas pu être fabriquée');
  });
});

describe('AA08 — ④ on peut TOUJOURS quitter la page', () => {
  it('➕ une croix en haut a droite ferme l ecran', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, 'Fermer');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('🔒 la croix est POSEE AU-DESSUS du defilement, pas dedans', async () => {
    // Dans le ScrollView, elle remonterait avec le contenu et disparaitrait :
    // c'est exactement le motif du defaut d Adel (la seule sortie etait en bas).
    const tree = await renderScreen(eventParams());
    const croix = findPressable(tree, 'Fermer');
    expect(croix).toBeTruthy();
    const dansLeDefilement = tree.root.findByType(ScrollView).findAll(
      (/** @type {any} */ node) => node === croix,
    );
    expect(dansLeDefilement).toHaveLength(0);
  });

  it('🔒 elle se pose SOUS la barre d etat, jamais dessous elle', async () => {
    const tree = await renderScreen(eventParams());
    const croix = findPressable(tree, 'Fermer');
    const style = StyleSheet.flatten(croix.props.style) || {};
    expect(style.top).toBeGreaterThanOrEqual(mockInsetsEncoche.top);
  });

  it('🔒 elle reste pressable PENDANT la fabrication de l affiche', async () => {
    // Ici l apercu n arrive jamais : les gestes d envoi sont grises (rien a
    // envoyer). ⛔ La sortie, elle, ne se grise JAMAIS.
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(eventParams());
    const croix = findPressable(tree, 'Fermer');
    expect(croix.props.disabled).toBeFalsy();
    expect(findPressable(tree, 'Partager l’affiche').props.disabled).toBe(true);
    await act(async () => { await croix.props.onPress(); });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('🔒 elle reste pressable APRES un echec de fabrication', async () => {
    mockFetchRenderBase64.mockRejectedValue(new Error('HTTP 500'));
    const tree = await renderScreen(eventParams());
    const croix = findPressable(tree, 'Fermer');
    expect(croix.props.disabled).toBeFalsy();
    await act(async () => { await croix.props.onPress(); });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('🔒 une seule sortie porte le libelle « Fermer » (pas deux croix)', async () => {
    // ⚠️ On compte les TouchableOpacity, pas les noeuds pressables : le rendu de
    // test expose le composite ET son noeud hote, tous deux porteurs du libelle
    // et du onPress. `findAllPressable` en rendrait donc 2 pour UNE croix.
    const tree = await renderScreen(eventParams());
    const croix = tree.root.findAllByType(TouchableOpacity).filter(
      (/** @type {any} */ node) => node.props.accessibilityLabel === 'Fermer',
    );
    expect(croix).toHaveLength(1);
  });
});
