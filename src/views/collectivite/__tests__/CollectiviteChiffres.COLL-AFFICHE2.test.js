import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteChiffres from '../CollectiviteChiffres';

// 🏛️ COLL-AFFICHE-2 (03/10) — « Une affiche pour l'installation » : LA SEMAINE OU LA SAISON
// (décision d'Adel « saison A », 03/10 ~16h50 ; planche 30 B du design HY521H1, page 5).
// Contrat : admin/docs/CONTRAT_CHIFFRES_VILLE.md §7 ter et §8 (`periode=saison`).
//
// Ce que ce témoin fige (ROUGE avant le lot : l'affiche ne connaissait que la semaine) :
//   - le choix « La semaine » / « La saison », la semaine par défaut, et de nouveau à chaque
//     ouverture ;
//   - la saison n'a pas de flèches de semaine ; le sous-titre dit
//     « PDF · la saison · <installation> » ;
//   - « Télécharger » demande la saison à la route gardée, sous le nom du serveur
//     (« affiche-<installation>-saison-2026-2027.pdf ») ; le même choix sur ordinateur.
// Les montages sont ceux du témoin COLL-AFFICHE (même écran, même panneau).

/** @type {any} */
let mockChiffres;
let mockOrdinateur = false;
const mockExport = jest.fn();
const mockEnregistrer = jest.fn();
const mockRequete = jest.fn();
const mockTelecharger = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => ({ params: { collectiviteId: 'ville-de-recette' } }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  const lire = (/** @type {string} */ cle) => String(cle || '')
    .split('.')
    .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ autres) => {
        const options = typeof repli === 'object' && repli ? repli : (autres || {});
        const valeur = lire(cle);
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/responsive', () => ({
  ...jest.requireActual('@/responsive'),
  useIsDesktop: () => mockOrdinateur,
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteChiffres: () => mockChiffres,
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
    isLoading: false,
  }),
}));
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteChiffresExport: (/** @type {any[]} */ ...args) => mockExport(...args),
  requeteAfficheInstallation: (/** @type {any[]} */ ...args) => mockRequete(...args),
}));
jest.mock('@/platform/media/saveTextFile', () => ({
  saveTextFile: (/** @type {any} */ params) => mockEnregistrer(params),
}));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  downloadRemoteFile: (/** @type {any} */ params) => mockTelecharger(params),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});
jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SegmentedControlMock() { return null; },
);

// La semaine du banc serveur (admin tests/authz/_coll-c5-banc.js), telle que la route la rend.
const SEMAINE = {
  clubs: [],
  demandes: {
    acceptees: 1, delaiMoyenJours: 1.3, enAttente: 1, recues: 4, refusees: 1, sansSuite: 1,
  },
  from: '2026-09-28',
  installations: [
    {
      capaciteMinutes: null,
      documentId: 'dojo',
      minutes: 120,
      name: 'Dojo municipal',
      planningColor: null,
      seances: 1,
      taux: null,
    },
    {
      capaciteMinutes: 11280,
      documentId: 'gymnase',
      minutes: 630,
      name: 'Gymnase des Tilleuls',
      planningColor: null,
      seances: 7,
      taux: 6,
    },
  ],
  periode: 'semaine',
  seances: {
    annulees: 1, aVenir: 2, enAttente: 1, fermeture: 2, refusees: 1, tenues: 6,
  },
  to: '2026-10-04',
  ville: { capaciteMinutes: 11280, minutes: 750, taux: 6 },
};
const REQUETE = {
  headers: { Authorization: 'Bearer jeton-de-test' },
  url: 'https://api.exemple/api/collectivites/ville-de-recette/chiffres/affiche?installation=gymnase&semaine=2026-09-28',
};

/**
 * Aplati les enfants React en une chaîne.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<CollectiviteChiffres />);
  });
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

// Un bouton NEUF se trouve par son libellé (`Button` ne transmet pas `testID`).
const parTitre = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
)[0];
const parTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
)[0];
const parEtiquette = (/** @type {any} */ arbre, /** @type {string} */ etiquette) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === etiquette
    && typeof n.props?.onPress === 'function')[0];

/**
 * Les deux sorties, dans l'ordre affiché, une fois chacune (le bouton et son enveloppe
 * portent les mêmes props).
 * @param {any} arbre - L'arbre rendu.
 * @returns {Array<{ coche: boolean, inactif: boolean, texte: string }>} Les sorties.
 */
const sorties = (arbre) => {
  const radios = arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityRole === 'radio'
    && typeof n.props?.onPress === 'function');
  return radios
    .filter((/** @type {any} */ n, /** @type {number} */ i) => radios.findIndex(
      (/** @type {any} */ autre) => autre.props.testID === n.props.testID,
    ) === i)
    .map((/** @type {any} */ n) => ({
      coche: Boolean(n.props.accessibilityState?.checked),
      inactif: Boolean(n.props.accessibilityState?.disabled),
      texte: aplatirTexte(n.props.children),
    }));
};
const AFFICHE = 'Une affiche pour l’installation';

const ouvrir = async () => {
  const arbre = await monter();
  await act(async () => { parTitre(arbre, 'Exporter le planning…').props.onPress(); });
  return arbre;
};

beforeEach(() => {
  mockOrdinateur = false;
  mockExport.mockReset();
  mockEnregistrer.mockReset();
  mockRequete.mockReset().mockReturnValue(REQUETE);
  mockTelecharger.mockReset();
  mockChiffres = {
    data: SEMAINE, error: null, isLoading: false, refetch: jest.fn(),
  };
});

// La saison se nomme d'après AUJOURD'HUI (le serveur prend la saison de maintenant) : seul Date est
// figé, les minuteries restent vraies (act et les promesses en dépendent).
const FIGER_LA_DATE = {
  doNotFake: [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
    'clearInterval', 'setTimeout', 'clearTimeout',
  ],
  now: new Date('2026-10-03T12:00:00'),
};

/**
 * Le choix de la période de l'affiche, dans l'ordre affiché, une fois chacun.
 * @param {any} arbre - L'arbre rendu.
 * @returns {Array<{ choisie: boolean, texte: string }>} « La semaine », « La saison ».
 */
const periodes = (arbre) => {
  // Le bouton rendu (rôle accessible), pas le composant qui le décrit.
  const puces = arbre.root.findAll((/** @type {any} */ n) => String(n.props?.testID || '')
    .startsWith('affiche-periode-') && n.props?.accessibilityRole === 'button'
    && typeof n.props?.onPress === 'function');
  return puces
    .filter((/** @type {any} */ n, /** @type {number} */ i) => puces.findIndex(
      (/** @type {any} */ autre) => autre.props.testID === n.props.testID,
    ) === i)
    .map((/** @type {any} */ n) => ({
      choisie: Boolean(n.props.accessibilityState?.selected),
      texte: aplatirTexte(n.props.children),
    }));
};
const SAISON = 'affiche-gymnase-des-tilleuls-saison-2026-2027.pdf';

describe('COLL-AFFICHE-2 — « La semaine » ou « La saison » (décision d’Adel « saison A »)', () => {
  beforeEach(() => { jest.useFakeTimers(FIGER_LA_DATE); });
  afterEach(() => { jest.useRealTimers(); });

  it('l’affiche propose sa période : « La semaine » par défaut, avec ses flèches', async () => {
    const arbre = await ouvrir();
    expect(periodes(arbre)).toEqual([
      { choisie: true, texte: 'La semaine' },
      { choisie: false, texte: 'La saison' },
    ]);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Période', 'Semaine', '28 sept. – 4 oct.',
    ]));
    expect(parEtiquette(arbre, 'Semaine suivante')).toBeDefined();
    expect(sorties(arbre)[0].texte).toBe(`${AFFICHE}PDF · une semaine · Gymnase des Tilleuls`);
  });

  it('« La saison » : ni flèches ni semaine, le sous-titre dit la saison, « Télécharger » '
    + 'demande la saison', async () => {
    mockTelecharger.mockResolvedValue({ opened: true, outcome: 'downloads' });
    const arbre = await ouvrir();
    await act(async () => { parTestID(arbre, 'affiche-periode-saison').props.onPress(); });
    expect(periodes(arbre).map((p) => p.choisie)).toEqual([false, true]);
    expect(sorties(arbre)[0].texte).toBe(`${AFFICHE}PDF · la saison · Gymnase des Tilleuls`);
    expect(parEtiquette(arbre, 'Semaine précédente')).toBeUndefined();
    expect(parEtiquette(arbre, 'Semaine suivante')).toBeUndefined();
    expect(textes(arbre)).not.toContain('Semaine');
    expect(textes(arbre)).not.toContain('28 sept. – 4 oct.');
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    expect(mockRequete).toHaveBeenCalledWith('ville-de-recette', {
      installation: 'gymnase', periode: 'saison',
    });
    expect(mockTelecharger).toHaveBeenCalledWith({
      fileName: SAISON,
      headers: REQUETE.headers,
      mimeType: 'application/pdf',
      url: REQUETE.url,
    });
    expect(textes(arbre)).toContain(`Affiche enregistrée : ${SAISON}`);
  });

  it('l’installation se choisit aussi pour la saison', async () => {
    mockTelecharger.mockResolvedValue({ opened: true, outcome: 'downloads' });
    const arbre = await ouvrir();
    await act(async () => { parTestID(arbre, 'affiche-periode-saison').props.onPress(); });
    await act(async () => { parTestID(arbre, 'affiche-installation-dojo').props.onPress(); });
    expect(sorties(arbre)[0].texte).toBe(`${AFFICHE}PDF · la saison · Dojo municipal`);
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    expect(mockRequete).toHaveBeenCalledWith('ville-de-recette', {
      installation: 'dojo', periode: 'saison',
    });
    expect(mockTelecharger).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'affiche-dojo-municipal-saison-2026-2027.pdf',
    }));
  });

  it('revenir à « La semaine » rend les flèches et la semaine des chiffres', async () => {
    mockTelecharger.mockResolvedValue({ opened: true, outcome: 'downloads' });
    const arbre = await ouvrir();
    await act(async () => { parTestID(arbre, 'affiche-periode-saison').props.onPress(); });
    await act(async () => { parTestID(arbre, 'affiche-periode-semaine').props.onPress(); });
    expect(textes(arbre)).toContain('28 sept. – 4 oct.');
    expect(sorties(arbre)[0].texte).toBe(`${AFFICHE}PDF · une semaine · Gymnase des Tilleuls`);
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    expect(mockRequete).toHaveBeenCalledWith('ville-de-recette', {
      installation: 'gymnase', semaine: '2026-09-28',
    });
  });

  it('rouvrir le panneau repart sur « La semaine »', async () => {
    const arbre = await ouvrir();
    await act(async () => { parTestID(arbre, 'affiche-periode-saison').props.onPress(); });
    await act(async () => { parTitre(arbre, 'Exporter le planning…').props.onPress(); });
    expect(periodes(arbre).map((p) => p.choisie)).toEqual([true, false]);
  });

  it('sur ordinateur, le même choix et le même téléchargement', async () => {
    mockOrdinateur = true;
    mockTelecharger.mockResolvedValue({ opened: true, outcome: 'downloads' });
    const arbre = await ouvrir();
    await act(async () => { parTestID(arbre, 'affiche-periode-saison').props.onPress(); });
    expect(parEtiquette(arbre, 'Semaine suivante')).toBeUndefined();
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    expect(mockTelecharger).toHaveBeenCalledWith(expect.objectContaining({
      fileName: SAISON, mimeType: 'application/pdf',
    }));
  });
});
