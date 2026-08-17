/**
 * app/src/views/event/__tests__/EventShowcaseShareIntroPortes.test.js
 *
 * S05 (2026-08-16) — LE TEXTE QUI ACCOMPAGNE L'AFFICHE, MESURE DEPUIS CHAQUE PORTE.
 *
 * 🧨 CE QUE CE FICHIER COMBLE, ET POURQUOI AUCUNE PORTE EXISTANTE NE LE VOYAIT.
 * Deux filets existaient deja, et ils etaient verts tous les deux :
 *   - `EventPublishedShowcase.test.js` (D94/C2) prouve que l'ECRAN, quand on lui
 *     donne `eventTypeName: 'Match'`, calcule la bonne phrase ;
 *   - `EventDetailsBottomActions.test.js` (D28/D94) prouve que la PORTE du menu
 *     « Gerer » emet bien `eventTypeName: 'Match'`.
 * Aucun des deux ne prouve que c'est LE MEME NOM DE PARAMETRE des deux cotes.
 * Le jour ou une porte emettrait `typeName` et l'ecran lirait `eventTypeName`,
 * les deux suites resteraient VERTES et le match repartirait avec la phrase
 * neutre — ou pire, avec celle d'une detection. C'est exactement la classe de
 * defaut que la recette du 2026-08-16 a fait remonter (point 7, sur iPhone).
 *
 * ⇒ Ce fichier monte l'ecran AVEC LA FORME DE PARAMETRES REELLE de chacune des
 * QUATRE portes, et lit la phrase qui sort. Il ne teste pas un calcul : il teste
 * une CONTINUITE.
 *
 * 🚪 LES QUATRE PORTES, mesurees le 2026-08-16 (aucune autre n'existe) :
 *   1. `EventDetails.js:2079`        -> RouteNames.EventPublishedShowcase (evenement)
 *   2. `EventWizardRecap.js:769`     -> RouteNames.EventPublishedShowcase (evenement)
 *   3. `ClubDetails.js:737`          -> RouteNames.VisualShowcase        (club)
 *   4. `RecruitmentAdDetails.js:630` -> RouteNames.VisualShowcase        (annonce)
 * Les deux routes sont servies par LE MEME composant
 * (`PrivateNavigator.js:614`, `EventStack.js:86`).
 *
 * ⛔ CE QUE CE FICHIER NE MESURE PAS, ET C'EST LE VRAI SUJET DU LOT : le TEXTE
 * IMPRIME DANS L'IMAGE. Un match recoit le gabarit `affiche-detection`
 * (`eventShowcaseTemplate.js:49`, repli assume depuis D28), et ce gabarit
 * imprime « Viens montrer / ce que tu vaux. » et « Scannez pour participer »
 * (`admin/src/api/visual-asset/services/visualModel.ts:497`). La phrase du
 * partage est juste ; l'affiche, elle, promet toujours une detection. C'est un
 * travail de STUDIO et de SERVEUR, hors du perimetre de ce lot.
 */

import renderer, { act } from 'react-test-renderer';

import EventPublishedShowcase from '../EventPublishedShowcase';

const mockDownloadAndShareRender = jest.fn();
const mockFetchRenderBase64 = jest.fn();
const mockShare = jest.fn();
const mockClientGet = jest.fn();

jest.mock('react-i18next', () => ({
  // Meme greffon minimal que EventPublishedShowcase.test.js : l'ecran tire le
  // domaine evenement, qui tire le vrai i18n si on ne fournit pas ce module.
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
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

// La capacite est une ENTREE de l'ecran (L20) : `Platform.OS` est un getter non
// mutable sous Jest, on pilote donc la capacite. `share-sheet` EST le chemin
// iPhone — c'est celui sur lequel Adel a fait sa recette.
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

jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonMock() {
  return null;
});

// Le premier montage transpile tout le graphe d'imports de l'ecran.
jest.setTimeout(20000);

const navigation = { goBack: jest.fn(), navigate: jest.fn() };

/** @type {any} */
let mounted = null;

/**
 * Monte l'ecran avec des parametres de navigation, presse « Partager l'affiche »
 * et rend le TEXTE reellement confie a la couche plateforme.
 * @param {Record<string, unknown>} params Les parametres emis par une porte.
 * @returns {Promise<string>} Le message joint au fichier.
 */
const phraseDuPartage = async (params) => {
  await act(async () => {
    mounted = renderer.create(
      <EventPublishedShowcase
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params })}
      />,
    );
  });
  const bouton = mounted.root.findAll(
    (/** @type {any} */ node) => node.props
      && node.props.accessibilityLabel === 'Partager l’affiche'
      && typeof node.props.onPress === 'function',
  )[0];
  expect(bouton).toBeTruthy();
  await act(async () => { await bouton.props.onPress(); });
  return mockDownloadAndShareRender.mock.calls[0][0].message;
};

// ─────────────────────────────────────────────────────────────────────────────
// LES QUATRE PORTES, avec la forme de parametres qu'elles emettent REELLEMENT.
// Recopiees a l'identique du code appelant (chemins et lignes ci-dessus) : le
// jour ou une porte renomme un parametre, ce tableau ment et les temoins
// tombent — c'est le but.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `EventDetails.js:2079` — menu « Gerer » -> « Voir l'affiche ».
 * @param {string} [typeName] Nom du type, tel que le serveur le sert.
 * @returns {Record<string, unknown>}
 */
const porteMenuGerer = (typeName) => ({
  eventId: 'evt-1',
  eventTypeName: typeName,
  template: 'affiche-detection',
});

/**
 * `EventWizardRecap.js:769` — juste apres publication, l'ecran s'ouvre seul.
 * @param {string} [typeName] Nom du type, tel que le serveur le sert.
 * @returns {Record<string, unknown>}
 */
const porteFinDeTunnel = (typeName) => ({
  creationCelebration: { actionKey: 'event-created', payload: {} },
  eventId: 'evt-1',
  eventTypeName: typeName,
  template: 'affiche-detection',
});

/**
 * `ClubDetails.js:737` — l'affiche du club, par la route `VisualShowcase`.
 * @returns {Record<string, unknown>}
 */
const porteClub = () => ({
  chatShareEnabled: false,
  shareUrl: 'https://test.foundclub/clubs/club-1',
  subjectId: 'club-1',
  subjectType: 'club',
  template: 'affiche-club',
});

/**
 * `RecruitmentAdDetails.js:630` — l'avis de recherche, meme route.
 * @returns {Record<string, unknown>}
 */
const porteAnnonce = () => ({
  chatShareEnabled: false,
  shareUrl: 'https://test.foundclub/recruitment/ad-1',
  subjectId: 'ad-1',
  subjectType: 'recruitment-ad',
  template: 'avis-de-recherche',
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCapability = 'share-sheet';
  mockFetchRenderBase64.mockResolvedValue({ base64: 'QUJD', contentType: 'image/png' });
  mockDownloadAndShareRender.mockResolvedValue({
    fileUri: 'file:///cache/affiche.png',
    messageCopied: false,
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

// ─────────────────────────────────────────────────────────────────────────────
// TEMOIN 1 — DEPUIS CHAQUE PORTE, UN MATCH DONNE LA PHRASE DU MATCH.
// Une assertion par porte d'evenement : c'est le temoin d'arret du lot.
// ─────────────────────────────────────────────────────────────────────────────
describe('S05 ① depuis chaque porte, un MATCH donne la phrase du match', () => {
  const PORTES_EVENEMENT = [
    ['le menu « Gerer » du detail', porteMenuGerer],
    ['la fin du tunnel de creation', porteFinDeTunnel],
  ];

  it.each(PORTES_EVENEMENT)('%s : « Match » emporte SA phrase', async (_nom, porte) => {
    const phrase = await phraseDuPartage(/** @type {any} */ (porte)('Match'));

    expect(phrase).toContain('Viens nous encourager pour ce match !');
    expect(phrase).not.toContain('détection');
    expect(phrase).not.toContain('essai');
  });

  // Le serveur sert « Match » (admin/src/data/event-types.json), mais un club
  // peut renommer son type : la reconnaissance est indifferente aux accents et
  // a la casse (`normalizeEventTypeLabel`). On le mesure plutot que de le croire.
  it.each(['Match', 'match', 'MATCH', 'Match de championnat', 'Match amical'])(
    'le type « %s » est reconnu comme un match',
    async (typeName) => {
      const phrase = await phraseDuPartage(porteMenuGerer(typeName));

      expect(phrase).toContain('Viens nous encourager pour ce match !');
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMOIN 2 — UN TYPE ABSENT DONNE LA PHRASE NEUTRE, JAMAIS CELLE DE LA DETECTION.
// C'est la difference qui permet de TRANCHER a la recette : si Adel voit
// « Voici notre prochain evenement ! », le type ne voyage pas ; s'il voit
// « Viens participer a notre detection », c'est autre chose.
// ─────────────────────────────────────────────────────────────────────────────
describe('S05 ② un type absent donne la phrase neutre, jamais celle de la detection', () => {
  it.each([undefined, null, '', '   '])('type %p : phrase neutre', async (typeName) => {
    const phrase = await phraseDuPartage(porteMenuGerer(/** @type {any} */ (typeName)));

    expect(phrase).toContain('Voici notre prochain événement !');
    expect(phrase).not.toContain('détection');
  });

  // Le lien profond web (`webRoutes.js:88`, `/events/:eventId/published`) ouvre
  // l'ecran SANS aucun parametre de type : il tombe ici, et il ne doit pas
  // inventer une detection.
  it('un lien profond sans aucun parametre de type reste neutre', async () => {
    const phrase = await phraseDuPartage({ eventId: 'evt-1' });

    expect(phrase).toContain('Voici notre prochain événement !');
    expect(phrase).not.toContain('détection');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMOIN 3 🔒 — LA NON-REGRESSION. Une detection garde SA phrase, et les deux
// portes qui ne sont pas des evenements gardent celle de leur gabarit.
// ─────────────────────────────────────────────────────────────────────────────
describe('S05 ③ 🔒 la detection, le club et l annonce gardent leur phrase', () => {
  it('🔒 une DETECTION garde sa phrase', async () => {
    const phrase = await phraseDuPartage(porteMenuGerer("Détection / Séance d'essai"));

    expect(phrase).toContain('Viens participer à notre détection / séance d’essai !');
  });

  it('🔒 le club garde la phrase de son gabarit', async () => {
    const phrase = await phraseDuPartage(porteClub());

    expect(phrase).toContain('Viens nous rejoindre au club !');
  });

  it('🔒 l annonce garde la phrase de son gabarit', async () => {
    const phrase = await phraseDuPartage(porteAnnonce());

    expect(phrase).toContain('On recrute, rejoins l’équipe !');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMOIN 4 — SUR iOS, LE TEXTE ACCOMPAGNE BIEN LE FICHIER.
//
// C'est le chemin `share-sheet` : `Share.share({ message, url })` transporte les
// deux dans le MEME appel (constat mesure dans `visualRender.native.js:64-70`).
// Ce temoin-ci le verifie AU NIVEAU DE L'ECRAN — la ou la phrase est calculee —
// pour qu'un ecran qui cesserait de la passer se voie ici, et pas seulement dans
// la couche plateforme.
// ─────────────────────────────────────────────────────────────────────────────
describe('S05 ④ sur iOS, le texte part AVEC le fichier', () => {
  it('le partage confie un message NON VIDE a la couche plateforme', async () => {
    await phraseDuPartage(porteMenuGerer('Match'));

    const charge = mockDownloadAndShareRender.mock.calls[0][0];
    expect(charge.format).toBe('post');
    expect(typeof charge.message).toBe('string');
    expect(charge.message.length).toBeGreaterThan(0);
  });

  // Le lien public voyage AVEC la phrase : sans lui, l'affiche partirait sans
  // aucun moyen de revenir vers l'evenement.
  it('le lien public de l evenement accompagne la phrase', async () => {
    const phrase = await phraseDuPartage(porteMenuGerer('Match'));

    expect(phrase).toContain('Viens nous encourager pour ce match !');
    expect(phrase).toContain('/events/evt-1');
  });

  // TEMOIN NEGATIF : « Dans mes photos » n'envoie volontairement AUCUN texte
  // (`EventPublishedShowcase.js:487`). Un lot qui y joindrait la phrase par
  // symetrie collerait une invitation dans un simple enregistrement.
  it('TEMOIN NEGATIF : « Dans mes photos » ne joint aucun texte', async () => {
    await act(async () => {
      mounted = renderer.create(
        <EventPublishedShowcase
          navigation={/** @type {any} */ (navigation)}
          route={/** @type {any} */ ({ params: porteMenuGerer('Match') })}
        />,
      );
    });
    const presser = (/** @type {string} */ label) => mounted.root.findAll(
      (/** @type {any} */ node) => node.props
        && node.props.accessibilityLabel === label
        && typeof node.props.onPress === 'function',
    )[0];

    await act(async () => { await presser('Enregistrer l’image').props.onPress(); });
    await act(async () => { await presser('Dans mes photos').props.onPress(); });

    expect(mockDownloadAndShareRender.mock.calls[0][0].message).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEMOIN 5 🥇 — LA PORTE DEROBEE : `shareIntro` PASSE EN PARAMETRE.
//
// 🧨 CE QU'IL MESURE : `EventPublishedShowcase.js:151` lisait
// `intro: shareIntroParam || t(introTexts.key, …)`. Le parametre GAGNAIT sur
// tout, y compris sur le type. Aucun appelant ne le passe aujourd'hui (mesure du
// 2026-08-16 : les 4 portes ci-dessus, zero occurrence), mais un lot qui le
// brancherait « pour personnaliser » ferait mentir un match SANS AUCUNE ERREUR
// et sans qu'aucune porte de qualite ne le voie. C'est un piege arme.
//
// ⇒ Pour un EVENEMENT, le type gagne. Pour le club et l'annonce — qui n'ont
// aucun type d'ou deriver une phrase — le parametre reste leur seule voie de
// personnalisation, et il est conserve.
// ─────────────────────────────────────────────────────────────────────────────
describe('S05 ⑤ un shareIntro en parametre ne peut plus faire mentir un evenement', () => {
  it('🥇 un match garde SA phrase meme si un appelant en impose une autre', async () => {
    const phrase = await phraseDuPartage(porteMenuGerer('Match'));
    expect(phrase).toContain('Viens nous encourager pour ce match !');

    if (mounted) { act(() => { mounted.unmount(); }); mounted = null; }
    mockDownloadAndShareRender.mockClear();

    const phraseForcee = await phraseDuPartage({
      ...porteMenuGerer('Match'),
      shareIntro: 'Viens participer à notre détection / séance d’essai !',
    });

    expect(phraseForcee).toContain('Viens nous encourager pour ce match !');
    expect(phraseForcee).not.toContain('détection');
  });

  // 🔒 Le club et l'annonce n'ont pas de type : leur personnalisation SURVIT.
  // La retirer ici serait une regression silencieuse pour deux sujets sur quatre.
  it('🔒 le club, lui, peut toujours personnaliser sa phrase', async () => {
    const phrase = await phraseDuPartage({
      ...porteClub(),
      shareIntro: 'Le FC Test recrute pour la saison !',
    });

    expect(phrase).toContain('Le FC Test recrute pour la saison !');
  });
});
