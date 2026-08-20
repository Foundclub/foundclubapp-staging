import { AccessibilityInfo, ActivityIndicator } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { LONG_WAIT_MS } from '@/domains/visuals/renderProgress';

import EventPublishedShowcase from '../EventPublishedShowcase';

// ─────────────────────────────────────────────────────────────────────────────
// T04 (2026-08-17) — FILET (E6). CE FICHIER A ÉTÉ RETOURNÉ, et il faut savoir
// pourquoi avant de le lire.
//
// S07 (2026-08-16) y verrouillait un compte à rebours (« encore N s environ »),
// bâti sur une estimation de 3,5 à 4,5 s SUPPOSÉE, jamais mesurée. Adel, recette
// du 2026-08-17, point 11 : « le décompte n'est vraiment pas réaliste, et ça
// finit TOUJOURS avec le message [de dépassement] ».
//
// 📏 LA MESURE LUI DONNE RAISON (2026-08-17, 22 rendus par format, chaîne de
// rendu réelle rejouée sur un i7-11800H 16 cœurs, Chromium chaud) : le format
// `post` — celui de l'aperçu — met **3,7 à 5,2 s de médiane** et jusqu'à
// **13,0 s**, hors requêtes Strapi, hors logo distant, hors transport des
// 1,29 Mo, et sur une machine PLUS RAPIDE que le serveur (6 vCPU Haswell). Le
// dépassement ne pouvait donc pas ne pas se déclencher.
//
// 🎯 CE QUI A CHANGÉ ICI : on ne vérifie plus qu'un nombre est JUSTE, on vérifie
// qu'il n'y en a AUCUN. Entre 3,1 s et 22,9 s selon la charge, aucune valeur
// n'était vraie une fois sur deux — et un compteur qui se trompe toujours
// apprend à ne plus être lu. Ce que S07 protégeait vraiment (⛔ jamais « 0 s »,
// ⛔ jamais de barre pleine) est désormais vrai PAR CONSTRUCTION.
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
 * Les repères d'attente affichés (le bloc « ça travaille »). T04 : c'est LUI
 * qu'on compte désormais, la barre de progression ayant disparu.
 * @param {any} tree
 * @returns {any[]}
 */
const reperes = (tree) => tree.root.findAll(
  (/** @type {any} */ node) => node.props && node.props.testID === 'showcase-working',
);

/**
 * Les indicateurs qui TOURNENT à l'intérieur des repères d'attente. Portée
 * volontairement restreinte au repère : les boutons ont le leur, et le réglage
 * « animations réduites » ne parle que de celui-ci.
 * @param {any} tree
 * @returns {any[]}
 */
const indicateursQuiTournent = (tree) => reperes(tree)
  .flatMap((/** @type {any} */ repere) => repere.findAllByType(ActivityIndicator));

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
// TÉMOIN ① — l'attente dit qu'elle travaille, elle n'annonce AUCUNE durée.
// ─────────────────────────────────────────────────────────────────────────────
describe('T04 — ① l attente dit qu elle travaille, sans promettre de durée', () => {
  it('la première fabrication montre un repère qui tourne ET une phrase', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    expect(reperes(tree).length).toBeGreaterThan(0);
    expect(indicateursQuiTournent(tree).length).toBeGreaterThan(0);
    expect(renderedText(tree)).toContain('Ton affiche se fabrique');
  });

  // 🔒 LE TÉMOIN D'ARRÊT DU LOT (①). Le chiffre annoncé par S07 était faux : la
  // mesure du 2026-08-17 donne 3,1 s à 22,9 s selon la charge, alors que l'écran
  // promettait 3,5 s. Ici, on ne vérifie plus qu'un nombre est JUSTE — on vérifie
  // qu'il n'y en a AUCUN, ce qui est la seule chose qu'on puisse tenir.
  it('🔒 aucune seconde n est annoncée, à aucun moment des 60 premières', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    for (let i = 0; i < 240; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- l'ordre des ticks EST le sujet
      await avancerDe(250);
      const text = renderedText(tree);
      expect(text).not.toContain('environ');
      expect(text).not.toContain('NaN');
      // Aucune durée, sous aucune forme : « 4 s », « 0 s », « 12 secondes »…
      expect(text).not.toMatch(/\d+\s*(s\b|secondes?)/);
    }
  });

  // Changer de style refabrique VRAIMENT l'affiche : la même attente, le même repère.
  it('changer de style annonce aussi son attente', async () => {
    const tree = await renderScreen(clubParams());
    expect(reperes(tree).length).toBe(0); // l'affiche est là : rien à attendre

    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const chips = tree.root.findAll(
      (/** @type {any} */ node) => node.props
        && node.props.accessibilityRole === 'radio'
        && typeof node.props.onPress === 'function',
    );
    await act(async () => { chips[chips.length - 1].props.onPress(); });

    expect(reperes(tree).length).toBeGreaterThan(0);
    expect(renderedText(tree)).toContain('Ton affiche se fabrique');
  });

  // 🔒 CE TÉMOIN CONTREDIT S07 (« enregistrer un format annonce aussi son
  // attente »), et c'est le point 14 de la recette du 17/08. L'affiche partagée
  // est celle qu'on regarde : il n'y a plus de fabrication, donc plus rien à
  // annoncer. Le bouton, lui, garde son indicateur — le geste reste visible.
  it('🔒 « Partager » n annonce PLUS de fabrication : il n y en a plus', async () => {
    mockDownloadAndShareRender.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());
    await pressSansAttendre(tree, 'Partager l’affiche');

    expect(reperes(tree).length).toBe(0);
    expect(renderedText(tree)).not.toContain('se fabrique');
  });

  // Le pendant : story et A4 sont d'AUTRES images. Là, le serveur travaille
  // vraiment — et l'écran le DIT, au lieu de laisser croire à une régénération.
  it('story et A4 annoncent leur attente, et disent que c est une autre image', async () => {
    mockDownloadAndShareRender.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());
    // AA08 : plus de feuille a ouvrir, le format est a l'ecran.
    await pressSansAttendre(tree, 'Version story 9:16');

    expect(reperes(tree).length).toBeGreaterThan(0);
    expect(renderedText(tree)).toContain('une autre image que celle à l’écran');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN ② — 🔒 au-delà du PIRE CAS MESURÉ, le message change. C'est un constat
// sur le temps déjà écoulé, jamais une prédiction.
// ─────────────────────────────────────────────────────────────────────────────
describe('T04 — ② 🔒 l attente anormale se dit, sans jamais annoncer de durée', () => {
  it('🔒 pendant tout ce que la mesure a observé, la phrase reste ordinaire', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    // 13,0 s = le pire rendu mesuré le 2026-08-17 pour le format `post`.
    await avancerDe(13000);
    expect(renderedText(tree)).not.toContain('plus long que d’habitude');
  });

  it('🔒 au-delà du pire cas mesuré, la phrase bascule', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    await avancerDe(LONG_WAIT_MS);
    const text = renderedText(tree);

    expect(text).toContain('plus long que d’habitude');
    expect(text).toContain('se fabrique toujours');
  });

  it('🔒 le message d attente anormale reste vrai à la 60e seconde', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    await avancerDe(60000);
    expect(renderedText(tree)).toContain('plus long que d’habitude');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN ③ — 🔒 aucune barre ne se remplit. C'était le témoin « la barre
// n'atteint jamais le bout » de S07 ; il est désormais tenu PAR CONSTRUCTION,
// et ce qui est vérifié ici est plus fort : il n'y a pas de barre du tout.
// ─────────────────────────────────────────────────────────────────────────────
describe('T04 — ③ 🔒 aucune fausse progression : l écran n annonce aucun pourcentage', () => {
  it('🔒 même après une minute, aucun nœud ne se déclare barre de progression', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(clubParams());

    expect(progressBars(tree).length).toBe(0);
    await avancerDe(60000);
    expect(progressBars(tree).length).toBe(0);
  });

  // L'arrivée de l'image fait DISPARAÎTRE le repère au lieu de le faire courir
  // jusqu'au bout : rien ne clignote quand c'est plus rapide que d'habitude.
  it('quand l affiche arrive, le repère s en va sans sauter', async () => {
    const tree = await renderScreen(clubParams());

    expect(reperes(tree).length).toBe(0);
    expect(renderedText(tree)).not.toContain('se fabrique');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN ④ — « animations réduites » : le texte reste, l'animation non.
// NON-RÉGRESSION : ce témoin de S07 survit tel quel, seul son objet change
// (l'indicateur qui tourne a remplacé la barre).
// ─────────────────────────────────────────────────────────────────────────────
describe('T04 — ④ réglage « animations réduites » : l information ne se perd pas', () => {
  it('rien ne tourne, mais la phrase reste écrite', async () => {
    /** @type {any} */ (AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));

    const tree = await renderScreen(clubParams());

    expect(indicateursQuiTournent(tree).length).toBe(0);
    expect(renderedText(tree)).toContain('Ton affiche se fabrique');
  });

  it('l attente anormale se dit aussi, sans rien faire tourner', async () => {
    /** @type {any} */ (AccessibilityInfo.isReduceMotionEnabled).mockResolvedValueOnce(true);
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));

    const tree = await renderScreen(clubParams());
    await avancerDe(LONG_WAIT_MS);

    expect(indicateursQuiTournent(tree).length).toBe(0);
    expect(renderedText(tree)).toContain('plus long que d’habitude');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TÉMOIN ⑤ — 🔒 une génération qui ÉCHOUE efface le repère et dit pourquoi.
// ⛔ Un indicateur qui tourne sur un échec est un mensonge qui dure pour toujours.
// ─────────────────────────────────────────────────────────────────────────────
describe('T04 — ⑤ 🔒 un échec efface le repère et nomme sa cause', () => {
  it('🔒 la première fabrication échoue : plus de repère, et l écran dit pourquoi', async () => {
    mockFetchRenderBase64.mockRejectedValue(new Error('reseau'));
    const tree = await renderScreen(clubParams());

    expect(reperes(tree).length).toBe(0);
    const text = renderedText(tree);
    expect(text).not.toContain('se fabrique');
    expect(text).toContain('Le visuel n’a pas pu être généré.');
    expect(text).toContain('Réessayer');
  });

  it('🔒 le temps qui passe après l échec ne ressuscite pas le repère', async () => {
    mockFetchRenderBase64.mockRejectedValue(new Error('reseau'));
    const tree = await renderScreen(clubParams());

    await avancerDe(60000);
    expect(reperes(tree).length).toBe(0);
    expect(renderedText(tree)).not.toContain('plus long que d’habitude');
  });

  it('🔒 un partage qui échoue le dit, et ne laisse rien tourner', async () => {
    mockDownloadAndShareRender.mockRejectedValue(new Error('reseau'));
    const tree = await renderScreen(clubParams());
    await press(tree, 'Partager l’affiche');

    expect(reperes(tree).length).toBe(0);
    expect(renderedText(tree)).toContain('Le téléchargement a échoué');
  });
});
