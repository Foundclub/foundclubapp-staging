import { ScrollView, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import EventPublishedShowcase from '../EventPublishedShowcase';

// ─────────────────────────────────────────────────────────────────────────────
// AC02 (2026-08-21) — LE CONSTAT D'ADEL, MOT POUR MOT, capture a l'appui (20/08) :
//   « Non, regarde : il y a plusieurs boutons alors que je ne veux que le
//     bouton partager. »
//
// 🎯 SA DECISION DU 21/08, quand la question lui a ete posee : les deux autres
// formats (story 9:16, affiche A4 a imprimer) NE DISPARAISSENT PAS. Ils passent
// DERRIERE le partage.
//
// ⚠️ CE FICHIER RE-INVERSE UNE DECISION AA08 (2026-08-20), qui etait elle aussi
// d'Adel : « les formats remontent a l'ecran ». AA08 avait raison sur son sujet
// — la feuille de format n'avait qu'UNE porte, et cette porte tombait, donc le
// PDF serait devenu inatteignable. Il l'a paye d'une colonne de trois boutons ou
// rien ne dit lequel compte. AC02 garde les deux acquis d'AA08 (la croix, le
// retrait d'« Enregistrer l'image ») et range les deux formats derriere un
// DEPLIANT — pas une feuille : ⛔ il n'y a plus aucune feuille sur cet ecran.
//
// 📏 CE QUE CES TEMOINS MESURENT, ET C'EST LE COEUR DU LOT :
//   · UN seul geste d'envoi visible a l'ouverture ;
//   · les deux formats atteignables en DEUX GESTES, jamais trois ;
//   · rien de supprime, rien de perdu ;
//   · la sortie d'AA08 intacte, et elle SORT — elle n'annule rien.
// ─────────────────────────────────────────────────────────────────────────────

/** Le depliant qui range story et A4 derriere le partage. */
const DEPLIANT = 'Autres formats : story, A4 à imprimer';
const PARTAGE = 'Partager l’affiche';
const STORY = 'Version story 9:16';
const A4 = 'Affiche A4 à imprimer';

const mockDownloadAndShareRender = jest.fn();
const mockFetchRenderBase64 = jest.fn();
const mockShare = jest.fn();
const mockClientGet = jest.fn();
const mockClientPost = jest.fn();
const mockClientPut = jest.fn();
const mockClientDelete = jest.fn();

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

// 🔒 TEMOIN ⑤ : le client HTTP expose ici les QUATRE verbes, pas seulement `get`.
// Un double qui n'offre que la lecture rendrait le temoin « la croix n'annule
// pas l'evenement » VERT PAR CONSTRUCTION — il ne pourrait pas voir un `delete`.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: (/** @type {any} */ ...args) => mockClientDelete(...args),
    get: (/** @type {any} */ ...args) => mockClientGet(...args),
    post: (/** @type {any} */ ...args) => mockClientPost(...args),
    put: (/** @type {any} */ ...args) => mockClientPut(...args),
  },
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

// Le double rend ses enfants QUAND la feuille est ouverte. Il reste ici EXPRES,
// comme dans le filet d'AA08 : si une feuille de format revenait un jour, ses
// entrees seraient visibles — et le temoin ⛔ ci-dessous la verrait.
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

const navigation = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() };

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
 * @returns {Record<string, unknown>}
 */
const eventParams = () => ({ eventId: 'evt-1' });

/**
 * Premier noeud pressable portant ce libelle d accessibilite.
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
 * Tous les libelles de gestes reellement rendus, hors puces de style et hors
 * depliant du texte : c'est l'INVENTAIRE que voit Adel.
 * ⚠️ On lit les TouchableOpacity, pas les noeuds pressables : le rendu de test
 * expose le composite ET son noeud hote, donc `findAll` compterait double.
 * @param {any} tree
 * @returns {string[]}
 */
const gestesVisibles = (tree) => tree.root
  .findAllByType(TouchableOpacity)
  .map((/** @type {any} */ node) => node.props.accessibilityLabel)
  .filter((/** @type {any} */ label) => label
    && label !== 'Personnaliser le texte'
    && label !== 'Réinitialiser'
    && !String(label).startsWith('Choisir le style'));

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
 * Le format reellement demande au serveur lors du dernier telechargement.
 * @returns {string}
 */
const dernierFormatDemande = () => mockDownloadAndShareRender.mock.calls.at(-1)[0].format;

const renderedText = (/** @type {any} */ tree) => JSON.stringify(tree.toJSON());

beforeEach(() => {
  jest.clearAllMocks();
  mockCapability = 'share-sheet';
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

// ─────────────────────────────────────────────────────────────────────────────
describe('AC02 — ① 🥇 un SEUL bouton principal, et c est « Partager l affiche »', () => {
  it('🥇 a l ouverture, AUCUN autre geste d envoi n est a l ecran', async () => {
    const tree = await renderScreen(eventParams());
    const gestes = gestesVisibles(tree);

    // La demande d'Adel, telle qu'il l'a ecrite : « je ne veux que le bouton
    // partager ». Les deux autres formats ne sont pas dans l'arbre.
    expect(gestes).toContain(PARTAGE);
    expect(gestes).not.toContain(STORY);
    expect(gestes).not.toContain(A4);
  });

  it('🥇 il est le PREMIER de la colonne, avant tout le reste', async () => {
    const tree = await renderScreen(eventParams());
    expect(gestesVisibles(tree)[0]).toBe(PARTAGE);
  });

  it('⛔ rendu a VIDE, pas seulement masque : rien a atteindre au lecteur d ecran', async () => {
    // Un bouton laisse dans l'arbre avec une opacite a zero resterait
    // atteignable au lecteur d'ecran et au clavier (web) : l'ecran mentirait
    // exactement la ou Adel demande qu'il ne reste qu'un geste.
    const tree = await renderScreen(eventParams());
    expect(findPressable(tree, STORY)).toBeUndefined();
    expect(findPressable(tree, A4)).toBeUndefined();
    expect(renderedText(tree)).not.toContain('9:16');
  });

  it('⛔ et toujours AUCUNE feuille : ce qui range les formats vit dans l ecran', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, DEPLIANT);
    expect(renderedText(tree)).not.toContain('Sous quel format ?');
    expect(renderedText(tree)).not.toContain('Dans mes photos');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC02 — ② 🔒 la version story reste atteignable', () => {
  it('🔒 elle est DERRIERE le depliant, pas supprimee', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, DEPLIANT);
    expect(findPressable(tree, STORY)).toBeTruthy();
  });

  it('🔒 et elle envoie toujours le PNG 9:16 — rien n a change d un octet', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, DEPLIANT);
    await press(tree, STORY);
    expect(dernierFormatDemande()).toBe('story');
  });

  it('📏 DEUX gestes, comptes : ouvrir, choisir. Jamais un troisieme', async () => {
    const tree = await renderScreen(eventParams());
    let gestes = 0;

    await press(tree, DEPLIANT);
    gestes += 1;
    await press(tree, STORY);
    gestes += 1;

    expect(gestes).toBe(2);
    expect(mockDownloadAndShareRender).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC02 — ③ 🔒 l affiche A4 reste atteignable', () => {
  it('🔒 elle est DERRIERE le depliant, pas supprimee', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, DEPLIANT);
    expect(findPressable(tree, A4)).toBeTruthy();
  });

  it('🔒 et elle envoie toujours le PDF A4 — rien n a change d un octet', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, DEPLIANT);
    await press(tree, A4);
    expect(dernierFormatDemande()).toBe('a4');
  });

  it('📏 DEUX gestes, comptes : ouvrir, choisir. Jamais un troisieme', async () => {
    const tree = await renderScreen(eventParams());
    let gestes = 0;

    await press(tree, DEPLIANT);
    gestes += 1;
    await press(tree, A4);
    gestes += 1;

    expect(gestes).toBe(2);
    expect(mockDownloadAndShareRender).toHaveBeenCalledTimes(1);
  });

  it('🧭 pas de chasse au tresor : le depliant NOMME l A4 avant qu on l ouvre', async () => {
    // Un president de club qui veut imprimer lit « A4 a imprimer » sur la porte,
    // fermee. Sans ce libelle, ranger le format reviendrait a le cacher.
    const tree = await renderScreen(eventParams());
    expect(findPressable(tree, DEPLIANT)).toBeTruthy();
    expect(renderedText(tree)).toContain('A4 à imprimer');
  });

  it('🔒 le depliant reste OUVRABLE meme quand l affiche a echoue', async () => {
    // ⛔ Sinon une panne de fabrication emporterait avec elle la SEULE porte
    //   vers l'A4 — exactement le defaut qu'AA08 avait repare en retirant la
    //   feuille dont la porte disparaissait.
    mockFetchRenderBase64.mockRejectedValue(new Error('HTTP 500'));
    const tree = await renderScreen(eventParams());
    const depliant = findPressable(tree, DEPLIANT);
    expect(depliant).toBeTruthy();
    expect(depliant.props.disabled).toBeFalsy();

    await press(tree, DEPLIANT);
    expect(findPressable(tree, A4)).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC02 — ④ la croix ferme toujours l ecran (non-regression AA08)', () => {
  it('➕ elle est la, et elle ferme', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, 'Fermer');
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('🔒 elle survit a l ouverture du depliant', async () => {
    // Le depliant ajoute deux boutons dans le defilement. La croix, elle, est
    // FRERE du ScrollView (AA08) : rien de ce qu'on deplie ne peut la pousser.
    const tree = await renderScreen(eventParams());
    await press(tree, DEPLIANT);
    const croix = findPressable(tree, 'Fermer');
    expect(croix).toBeTruthy();
    const dansLeDefilement = tree.root.findByType(ScrollView).findAll(
      (/** @type {any} */ node) => node === croix,
    );
    expect(dansLeDefilement).toHaveLength(0);
  });

  it('🔒 elle reste pressable pendant la fabrication de l affiche', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(eventParams());
    const croix = findPressable(tree, 'Fermer');
    expect(croix.props.disabled).toBeFalsy();
    await act(async () => { await croix.props.onPress(); });
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('AC02 — ⑤ 🔒 la croix n ANNULE PAS l evenement', () => {
  it('🔒 aucune ecriture ne part au serveur quand on ferme', async () => {
    // 🧨 L'ecran arrive JUSTE APRES la publication. Une croix qui annulerait
    // l'evenement detruirait le travail qu'on vient de faire — et rien a
    // l'ecran ne previendrait. Ce temoin l'interdit par la mesure.
    const tree = await renderScreen(eventParams());
    await press(tree, 'Fermer');

    expect(mockClientDelete).not.toHaveBeenCalled();
    expect(mockClientPost).not.toHaveBeenCalled();
    expect(mockClientPut).not.toHaveBeenCalled();
  });

  it('🔒 elle RECULE simplement : goBack, jamais une redirection', async () => {
    // La pile posee apres publication est [EventDetails, EventPublishedShowcase]
    // (EventWizardRecap) : reculer decouvre le detail de l'evenement CREE.
    const tree = await renderScreen(eventParams());
    await press(tree, 'Fermer');

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('🔒 « Plus tard » fait le MEME geste, et n annule pas davantage', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, 'Plus tard');

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(mockClientDelete).not.toHaveBeenCalled();
    expect(mockClientPost).not.toHaveBeenCalled();
    expect(mockClientPut).not.toHaveBeenCalled();
  });

  it('⛔ aucun mot d annulation n est propose a l ecran', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, DEPLIANT);
    const texte = renderedText(tree);
    expect(texte).not.toContain('Annuler l’événement');
    expect(texte).not.toContain('Supprimer l’événement');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ LES ETATS DE L'ECRAN. Il en a QUATRE, et le partage doit se trouver dans
// les quatre. ⚠️ « Atteignable » ne veut pas dire « pressable a tout instant » :
// tant qu'aucune affiche n'existe, le bouton est GRISE — pas muet, pas absent
// (choix d'AA08 : il n'y a litteralement rien a envoyer). Ce qui est interdit,
// c'est qu'il DISPARAISSE ou qu'il passe derriere quoi que ce soit.
// ─────────────────────────────────────────────────────────────────────────────
describe('AC02 — ⑥ le partage est atteignable dans TOUS les etats de l ecran', () => {
  it('⏳ etat CHARGEMENT : present, en tete, grise mais jamais cache', async () => {
    mockFetchRenderBase64.mockReturnValue(new Promise(() => {}));
    const tree = await renderScreen(eventParams());

    expect(gestesVisibles(tree)[0]).toBe(PARTAGE);
    expect(findPressable(tree, PARTAGE).props.disabled).toBe(true);
    expect(findPressable(tree, 'Fermer').props.disabled).toBeFalsy();
  });

  it('✅ etat PRET : present, en tete, et il envoie l affiche affichee', async () => {
    const tree = await renderScreen(eventParams());

    expect(gestesVisibles(tree)[0]).toBe(PARTAGE);
    await press(tree, PARTAGE);
    expect(dernierFormatDemande()).toBe('post');
  });

  it('💥 etat ERREUR : present, en tete, et « Reessayer » n est pas un envoi', async () => {
    mockFetchRenderBase64.mockRejectedValue(new Error('HTTP 500'));
    const tree = await renderScreen(eventParams());

    expect(gestesVisibles(tree)).toContain(PARTAGE);
    expect(findPressable(tree, 'Réessayer')).toBeTruthy();
    // ⛔ Le partage ne doit pas etre remplace par le bouton de reprise : les
    //   deux vivent a des endroits differents de l'ecran.
    expect(findPressable(tree, PARTAGE)).toBeTruthy();
  });

  it('🔁 etat APRES PARTAGE : il est toujours la, et il repart', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, PARTAGE);
    expect(mockDownloadAndShareRender).toHaveBeenCalledTimes(1);

    // Un partage rate ou envoye au mauvais endroit se refait : le bouton ne se
    // consomme pas.
    expect(findPressable(tree, PARTAGE).props.disabled).toBeFalsy();
    await press(tree, PARTAGE);
    expect(mockDownloadAndShareRender).toHaveBeenCalledTimes(2);
  });

  it('🔽 DEPLIANT OUVERT : le partage reste le PREMIER, jamais pousse en bas', async () => {
    const tree = await renderScreen(eventParams());
    await press(tree, DEPLIANT);

    const gestes = gestesVisibles(tree);
    expect(gestes[0]).toBe(PARTAGE);
    expect(gestes).toContain(STORY);
    expect(gestes).toContain(A4);
  });
});
