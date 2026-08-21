import renderer, { act } from 'react-test-renderer';

import EventPublishedShowcase from '../EventPublishedShowcase';

// ─────────────────────────────────────────────────────────────────────────────
// T04 (2026-08-17) — FILET (E6). Constat d'Adel, point 14 de la recette du 17/08 :
// « Pourquoi, quand on appuie sur PARTAGER, ça refait un décompte et ça
// régénère ? »
//
// 🎯 CE QUE CE FICHIER VERROUILLE, et pourquoi ça vaut plus que le décompte :
// l'affiche EST DÉJÀ À L'ÉCRAN. La refabriquer coûte un aller-retour serveur
// complet — mesuré le 2026-08-17 en rejouant la chaîne de rendu réelle
// (admin/src/api/visual-asset/services/visual-renderer.ts, 22 rendus par format
// sur un i7-11800H 16 cœurs, Chromium déjà chaud) : **médiane 3,7 à 5,2 s, pire
// cas 13,0 s** pour le format `post`, celui de l'aperçu ET du partage — et
// **1,29 Mo** à rapatrier une deuxième fois. Le VPS est un 6 vCPU Haswell : ces
// chiffres en sont une BORNE BASSE.
//
// ⚠️ LA DISTINCTION QUI DÉCIDE DE TOUT :
//   · « Partager l'affiche » et « Dans mes photos » demandent le format
//     `preview` (post 4:5) — LE MÊME que l'aperçu affiché ⇒ les octets existent
//     déjà, redemander est du gaspillage pur ;
//   · « Version story 9:16 » et « Affiche A4 » demandent un AUTRE format ⇒ le
//     serveur DOIT travailler, et l'attente y est légitime (l'écran le dit).
//
// ⚠️ Fichier séparé de `EventPublishedShowcase.test.js` et de
// `.progression.test.js`, pour la raison écrite par S07 : deux lots qui ajoutent
// en fin du même fichier de test se marchent dessus à la fusion.
// ─────────────────────────────────────────────────────────────────────────────

const mockDownloadAndShareRender = jest.fn();
const mockFetchRenderBase64 = jest.fn();

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
  default: { share: jest.fn() },
  share: jest.fn(),
}));

jest.mock('@/platform/share/fileShareContract', () => ({
  ...jest.requireActual('@/platform/share/fileShareContract'),
  getFileShareCapability: () => 'share-sheet',
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: { data: null } }) },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({ celebrate: jest.fn() }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
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

/** Les octets que le serveur renvoie pour l'aperçu — et donc ceux DÉJÀ à l'écran. */
const APERCU_BASE64 = 'QUJDREVGR0hJSg==';

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

/** @type {any} */
let mounted = null;

/**
 * Monte l'écran et laisse l'aperçu arriver — l'affiche est alors À L'ÉCRAN.
 * @param {Record<string, unknown>} [params]
 * @returns {Promise<any>}
 */
const ecranAvecAfficheAffichee = async (params = {}) => {
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

/** Params du gabarit club — c'est LE MÊME écran que l'affiche d'événement. */
const clubParams = () => ({
  shareUrl: 'https://test.foundclub/clubs/club-1',
  subjectId: 'club-1',
  subjectType: 'club',
  template: 'affiche-club',
});

/**
 * Presse le bouton portant ce libellé d'accessibilité.
 * @param {any} tree
 * @param {string} label
 * @returns {Promise<void>}
 */
const press = async (tree, label) => {
  const node = tree.root.findAll(
    (/** @type {any} */ n) => n.props
      && n.props.accessibilityLabel === label
      && typeof n.props.onPress === 'function',
  )[0];
  expect(node).toBeTruthy();
  await act(async () => { await node.props.onPress(); });
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

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchRenderBase64.mockResolvedValue({ base64: APERCU_BASE64, contentType: 'image/png' });
  mockDownloadAndShareRender.mockResolvedValue({
    fileUri: 'file:///cache/affiche.png',
    opened: true,
    outcome: 'shareSheet',
  });
});

afterEach(() => {
  if (mounted) {
    act(() => { mounted.unmount(); });
    mounted = null;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN ③ — LE TÉMOIN PRINCIPAL DU LOT.
// ─────────────────────────────────────────────────────────────────────────────
describe('T04 — ③ 🔒 partager une affiche DÉJÀ à l écran ne la refabrique pas', () => {
  it('🔒 « Partager l affiche » réutilise les octets affichés, sans redemander le serveur', async () => {
    const tree = await ecranAvecAfficheAffichee(clubParams());
    // L'aperçu est arrivé : UN aller-retour, celui qu'on ne peut pas éviter.
    expect(mockFetchRenderBase64).toHaveBeenCalledTimes(1);

    await press(tree, 'Partager l’affiche');

    // Le geste part avec les octets qu'on regarde — la couche plateforme n'a
    // donc RIEN à retélécharger : c'est ce que dit `cachedBase64`.
    expect(mockDownloadAndShareRender).toHaveBeenCalledTimes(1);
    expect(mockDownloadAndShareRender.mock.calls[0][0]).toMatchObject({
      cachedBase64: APERCU_BASE64,
      cachedContentType: 'image/png',
      format: 'post',
    });
  });

  // SUPPRIME le 2026-08-20 (AA08) AVEC SON SUJET : « Dans mes photos » a
  // quitte l'ecran (constat d'Adel : « ça ne sert pas »). Ce qu'il mesurait
  // — le format de l'apercu reutilise sans aller-retour — est deja verrouille
  // par le temoin juste au-dessus, sur « Partager l'affiche » : c'etait le
  // MEME appel de toute facon.

  // ⚠️ LE PENDANT INDISPENSABLE : story et A4 sont d'AUTRES images. Les servir
  // depuis l'aperçu serait un bug bien pire — on partagerait le mauvais fichier.
  it('story et A4 demandent bien le serveur : ce sont d autres formats', async () => {
    const tree = await ecranAvecAfficheAffichee(clubParams());
    await ouvrirAutresFormats(tree);
    await press(tree, 'Version story 9:16');

    const envoye = mockDownloadAndShareRender.mock.calls[0][0];
    expect(envoye.format).toBe('story');
    expect(envoye.cachedBase64).toBeUndefined();
  });

  // Un style changé APRÈS l'affichage : l'aperçu du nouveau style est celui qui
  // part. Sans cette garde, on partagerait l'ancienne affiche — silencieusement.
  it('🔒 après un changement de style, c est la NOUVELLE affiche qui part', async () => {
    const tree = await ecranAvecAfficheAffichee(clubParams());
    mockFetchRenderBase64.mockResolvedValue({ base64: 'RkFNSUxMRQ==', contentType: 'image/png' });
    await press(tree, 'Choisir le style Famille');
    await press(tree, 'Partager l’affiche');

    expect(mockDownloadAndShareRender.mock.calls[0][0]).toMatchObject({
      cachedBase64: 'RkFNSUxMRQ==',
      variant: 'famille',
    });
  });
});
