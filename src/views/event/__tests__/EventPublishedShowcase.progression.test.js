import { AccessibilityInfo } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventPublishedShowcase from '../EventPublishedShowcase';

// ─────────────────────────────────────────────────────────────────────────────
// S07 (2026-08-16) — FILET (E6). Demande d'Adel : « pendant qu'une affiche se
// fabrique, l'écran ne dit pas combien de temps il reste ».
//
// 🧨 CE QUI REND CE LOT DÉLICAT, et pourquoi ces témoins existent : une affiche
// coûte 1,6 à 2,3 s (mesuré le 2026-08-07). Un compte à rebours sur 2 secondes
// n'a presque rien à compter — et un compteur qui reste BLOQUÉ sur « 0 s » parce
// que le réseau traîne est PIRE que pas de compteur du tout : il transforme une
// attente normale en panne apparente.
//
// ⚠️ Fichier séparé de `EventPublishedShowcase.test.js` À DESSEIN : le TEXTE du
// partage est retravaillé en parallèle dans ce même écran (session S05). Deux
// lots qui ajoutent en fin du même fichier de test se marchent dessus à la
// fusion ; deux fichiers neufs, jamais.
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

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

/** @type {any} */
let mounted = null;

/**
 * Monte l'écran avec les params de navigation donnés.
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

/** Params du gabarit club — c'est LE MÊME écran que l'affiche d'événement. */
const clubParams = () => ({
  shareUrl: 'https://test.foundclub/clubs/club-1',
  subjectId: 'club-1',
  subjectType: 'club',
  template: 'affiche-club',
});

/**
 * Sérialise l'arbre rendu pour vérifier la présence (ou l'absence) d'un texte.
 * @param {any} tree
 * @returns {string}
 */
const renderedText = (tree) => JSON.stringify(tree.toJSON());

/**
 * Les nœuds qui se déclarent barre de progression au système d'accessibilité.
 * @param {any} tree
 * @returns {any[]}
 */
const progressBars = (tree) => tree.root.findAll(
  (/** @type {any} */ node) => node.props && node.props.accessibilityRole === 'progressbar',
);

/**
 * Pourcentage annoncé par la barre — c'est CE nombre qu'un lecteur d'écran lit.
 * @param {any} tree
 * @returns {number}
 */
const announcedPercent = (tree) => progressBars(tree)[0].props.accessibilityValue.now;

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

/**
 * Presse un bouton SANS attendre la fin de son travail.
 * 🧨 Piège payé : `await onPress()` sur un téléchargement qui ne répond jamais
 * fait expirer le test à 20 s, et le `act()` resté ouvert casse TOUS les tests
 * suivants (« Can't access .root on unmounted test renderer »). Or c'est
 * justement l'attente qu'on veut observer : on lance le geste, on ne l'attend pas.
 * @param {any} tree
 * @param {string} label
 * @returns {Promise<void>}
 */
const pressSansAttendre = async (tree, label) => {
  const node = tree.root.findAll(
    (/** @type {any} */ n) => n.props
      && n.props.accessibilityLabel === label
      && typeof n.props.onPress === 'function',
  )[0];
  expect(node).toBeTruthy();
  await act(async () => { node.props.onPress(); });
};

/**
 * Avance le temps DU TÉLÉPHONE (minuteurs et `Date.now()` à la fois).
 * @param {number} ms
 * @returns {Promise<void>}
 */
const avancerDe = async (ms) => {
  await act(async () => { jest.advanceTimersByTime(ms); });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockFetchRenderBase64.mockResolvedValue({ base64: 'QUJD', contentType: 'image/png' });
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
  jest.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN 1 — pendant la génération, un temps estimé est affiché.
// ─────────────────────────────────────────────────────────────────────────────
describe('S07 — ① l attente annonce un temps, et elle dit que c est une estimation', () => {
  it('la première fabrication montre une barre ET un temps estimé', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    expect(progressBars(tree).length).toBeGreaterThan(0);
    // Le mot « environ » n'est pas décoratif : l'écran ne promet pas une durée,
    // il annonce une estimation. C'est ce qui le garde honnête à la 10e seconde.
    expect(renderedText(tree)).toContain('environ');
    expect(renderedText(tree)).toContain('encore 4 s environ');
  });

  it('le temps annoncé décroît pendant que ça travaille', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());
    expect(renderedText(tree)).toContain('encore 4 s environ');

    await avancerDe(1000);
    expect(renderedText(tree)).toContain('encore 3 s environ');

    await avancerDe(1000);
    expect(renderedText(tree)).toContain('encore 2 s environ');
  });

  it('la barre avance tant que ça travaille (elle ne reste pas à zéro)', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());
    expect(announcedPercent(tree)).toBe(0);

    await avancerDe(1750);
    expect(announcedPercent(tree)).toBeGreaterThan(30);
  });

  // Changer de style refabrique l'affiche : la MÊME attente, donc le MÊME repère.
  it('changer de style annonce aussi son attente', async () => {
    const tree = await renderScreen(clubParams());
    expect(progressBars(tree).length).toBe(0); // l'affiche est là : rien à attendre

    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const chips = tree.root.findAll(
      (/** @type {any} */ node) => node.props
        && node.props.accessibilityRole === 'radio'
        && typeof node.props.onPress === 'function',
    );
    await act(async () => { chips[chips.length - 1].props.onPress(); });

    expect(progressBars(tree).length).toBeGreaterThan(0);
    expect(renderedText(tree)).toContain('environ');
  });

  // Enregistrer / partager repaie un aller-retour serveur complet (constat figé
  // dans EventPublishedShowcase.test.js) : c'était la MÊME attente muette.
  it('enregistrer un format annonce aussi son attente', async () => {
    mockDownloadAndShareRender.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());
    await pressSansAttendre(tree, 'Partager l’affiche');

    expect(progressBars(tree).length).toBeGreaterThan(0);
    expect(renderedText(tree)).toContain('environ');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN 2 — 🔒 quand l'estimation est dépassée, le message CHANGE.
// C'est le point le plus important du lot.
// ─────────────────────────────────────────────────────────────────────────────
describe('S07 — ② 🔒 au dépassement, le message change et ne dit jamais 0 s', () => {
  it('🔒 passé le temps annoncé, la phrase devient « c’est plus long que prévu »', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    await avancerDe(4000); // post = 3 500 ms annoncées
    const text = renderedText(tree);

    expect(text).toContain('plus long que prévu');
    expect(text).toContain('se fabrique toujours');
    // L'ancienne phrase a bien LAISSÉ LA PLACE : elle ne coexiste pas.
    expect(text).not.toContain('encore 1 s environ');
  });

  it('🔒 aucun « 0 s » n apparaît, à aucun moment de l attente', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    // 20 secondes de réseau qui traîne, échantillonnées toutes les 250 ms.
    for (let i = 0; i < 80; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- l'ordre des ticks EST le sujet
      await avancerDe(250);
      const text = renderedText(tree);
      expect(text).not.toContain('encore 0 s');
      expect(text).not.toContain('0 seconde');
      expect(text).not.toContain('NaN');
    }
  });

  it('🔒 le message de dépassement reste vrai à la 60e seconde', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    await avancerDe(60000);
    expect(renderedText(tree)).toContain('plus long que prévu');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN 3 — la barre n'atteint jamais le bout avant que l'affiche existe.
// ─────────────────────────────────────────────────────────────────────────────
describe('S07 — ③ la barre ne mente pas en atteignant le bout', () => {
  it('même après une minute d attente, elle reste sous 100 %', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    await avancerDe(60000);
    expect(announcedPercent(tree)).toBeLessThan(100);
    expect(announcedPercent(tree)).toBeGreaterThan(80);
  });

  // « Si c'est plus rapide que prévu, rien ne clignote » : la barre ne court pas
  // jusqu'au bout à l'arrivée de l'image — elle DISPARAÎT, remplacée par l'affiche.
  it('quand l affiche arrive plus vite que prévu, la barre s en va sans sauter', async () => {
    const tree = await renderScreen(clubParams());

    expect(progressBars(tree).length).toBe(0);
    expect(renderedText(tree)).not.toContain('environ');
    expect(renderedText(tree)).not.toContain('plus long que prévu');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN 4 — « animations réduites » : le texte reste, l'animation non.
// ─────────────────────────────────────────────────────────────────────────────
describe('S07 — ④ réglage « animations réduites » : l information ne se perd pas', () => {
  it('la barre ne s affiche pas, mais le temps estimé reste écrit', async () => {
    /** @type {any} */ (AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));

    const tree = await renderScreen(clubParams());

    expect(progressBars(tree).length).toBe(0);
    expect(renderedText(tree)).toContain('encore 4 s environ');
  });

  it('le dépassement se dit aussi, sans barre', async () => {
    /** @type {any} */ (AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));

    const tree = await renderScreen(clubParams());
    await avancerDe(4000);

    expect(progressBars(tree).length).toBe(0);
    expect(renderedText(tree)).toContain('plus long que prévu');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN 5 — 🔒 une génération qui ÉCHOUE efface la barre et dit pourquoi.
// ⛔ Une barre qui tourne sur un échec est un mensonge qui dure pour toujours.
// ─────────────────────────────────────────────────────────────────────────────
describe('S07 — ⑤ 🔒 un échec efface la barre et nomme sa cause', () => {
  it('🔒 la première fabrication échoue : plus de barre, et l écran dit pourquoi', async () => {
    mockFetchRenderBase64.mockRejectedValue(new Error('reseau'));
    const tree = await renderScreen(clubParams());

    expect(progressBars(tree).length).toBe(0);
    const text = renderedText(tree);
    expect(text).not.toContain('environ');
    expect(text).not.toContain('plus long que prévu');
    expect(text).toContain('Le visuel n’a pas pu être généré.');
    expect(text).toContain('Réessayer');
  });

  it('🔒 le temps qui passe après l échec ne ressuscite pas la barre', async () => {
    mockFetchRenderBase64.mockRejectedValue(new Error('reseau'));
    const tree = await renderScreen(clubParams());

    await avancerDe(10000);
    expect(progressBars(tree).length).toBe(0);
    expect(renderedText(tree)).not.toContain('plus long que prévu');
  });

  it('🔒 un enregistrement qui échoue efface la barre et nomme sa cause', async () => {
    mockDownloadAndShareRender.mockRejectedValue(new Error('reseau'));
    const tree = await renderScreen(clubParams());
    await press(tree, 'Partager l’affiche');

    expect(progressBars(tree).length).toBe(0);
    const text = renderedText(tree);
    expect(text).not.toContain('environ');
    expect(text).toContain('Le téléchargement a échoué');
  });
});
