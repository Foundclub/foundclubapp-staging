import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteChiffres from '../CollectiviteChiffres';

// 🏛️ COLL-AFFICHE (03/10) — PLANCHE 30 B : « Exporter le planning », le choix « Une affiche
// pour l'installation » (design HY521H1, page 5, « P5v3-chiffres » écran B ; décision d'Adel
// « affiche A »). Contrat : admin/docs/CONTRAT_CHIFFRES_VILLE.md §7 bis et §8.
//
// Ce que ce témoin fige (ROUGE avant le lot : le panneau n'avait que « Un tableau pour le
// service ») :
//   - les deux sorties, dans l'ordre de la planche : l'affiche d'abord (cochée), le tableau ;
//   - l'installation : la plus utilisée de la période par défaut, les autres au choix ;
//   - la semaine : celle des chiffres, puis « Semaine précédente » / « Semaine suivante » ;
//   - « Télécharger » rapatrie le PDF de la route gardée (avec le jeton du compte) sous le nom du
//     serveur ; un échec se dit ; le tableau garde son chemin ;
//   - sans installation, l'affiche ne se choisit pas ; le même panneau sur ordinateur.

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
const TABLEAU = 'Un tableau pour le service'
  + 'Tableur · toutes les séances · du 28/09/2026 au 04/10/2026';

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

describe('COLL-AFFICHE — planche 30 B : « Une affiche pour l’installation »', () => {
  it('deux sorties, dans l’ordre de la planche : l’affiche d’abord, cochée, sur l’installation '
    + 'la plus utilisée', async () => {
    const arbre = await ouvrir();
    expect(sorties(arbre)).toEqual([
      { coche: true, inactif: false, texte: `${AFFICHE}PDF · une semaine · Gymnase des Tilleuls` },
      { coche: false, inactif: false, texte: TABLEAU },
    ]);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Installation', 'Dojo municipal', 'Gymnase des Tilleuls',
      'Semaine', '28 sept. – 4 oct.',
      'On y lit le club et l’équipe, jamais le nom d’un membre.',
    ]));
  });

  it('choisir l’installation et la semaine, puis « Télécharger » rapatrie le PDF', async () => {
    mockTelecharger.mockResolvedValue({ opened: true, outcome: 'downloads' });
    const arbre = await ouvrir();
    await act(async () => { parTestID(arbre, 'affiche-installation-dojo').props.onPress(); });
    expect(sorties(arbre)[0].texte).toBe(`${AFFICHE}PDF · une semaine · Dojo municipal`);
    await act(async () => { parEtiquette(arbre, 'Semaine suivante').props.onPress(); });
    expect(textes(arbre)).toContain('5 oct. – 11 oct.');
    await act(async () => { parEtiquette(arbre, 'Semaine précédente').props.onPress(); });
    await act(async () => { parEtiquette(arbre, 'Semaine précédente').props.onPress(); });
    expect(textes(arbre)).toContain('21 sept. – 27 sept.');
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    expect(mockRequete).toHaveBeenCalledWith('ville-de-recette', {
      installation: 'dojo', semaine: '2026-09-21',
    });
    expect(mockTelecharger).toHaveBeenCalledWith({
      fileName: 'affiche-dojo-municipal-2026-09-21.pdf',
      headers: REQUETE.headers,
      mimeType: 'application/pdf',
      url: REQUETE.url,
    });
    expect(mockEnregistrer).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Affiche enregistrée : affiche-dojo-municipal-2026-09-21.pdf');
  });

  it('l’affiche qui échoue le dit', async () => {
    mockTelecharger.mockRejectedValue(new Error('Le serveur a refuse le fichier (403).'));
    const arbre = await ouvrir();
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    expect(mockRequete).toHaveBeenCalledWith('ville-de-recette', {
      installation: 'gymnase', semaine: '2026-09-28',
    });
    expect(textes(arbre)).toContain('L’affiche n’a pas pu être téléchargée.');
  });

  it('« Un tableau pour le service » garde son chemin : le CSV, jamais le PDF', async () => {
    mockExport.mockResolvedValue('"Date";"Début"\r\n');
    mockEnregistrer.mockResolvedValue({ opened: true, outcome: 'downloads' });
    const arbre = await ouvrir();
    await act(async () => { parTestID(arbre, 'export-tableau').props.onPress(); });
    expect(sorties(arbre).map((s) => s.coche)).toEqual([false, true]);
    expect(textes(arbre)).not.toContain('Installation');
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    expect(mockExport).toHaveBeenCalledWith('ville-de-recette', 'semaine');
    expect(mockTelecharger).not.toHaveBeenCalled();
    expect(mockEnregistrer).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'chiffres-ville-de-montrivage-semaine-2026-09-28.csv',
    }));
  });

  it('sans installation, l’affiche ne se choisit pas : le tableau est coché', async () => {
    mockChiffres = { ...mockChiffres, data: { ...SEMAINE, installations: [] } };
    const arbre = await ouvrir();
    expect(sorties(arbre)).toEqual([
      {
        coche: false,
        inactif: true,
        texte: `${AFFICHE}PDF · une semaine · aucune installation pour l’instant`,
      },
      { coche: true, inactif: false, texte: TABLEAU },
    ]);
  });

  it('sur ordinateur, le même panneau et le même téléchargement', async () => {
    mockOrdinateur = true;
    mockTelecharger.mockResolvedValue({ opened: true, outcome: 'downloads' });
    const arbre = await ouvrir();
    expect(sorties(arbre)[0].coche).toBe(true);
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    expect(mockTelecharger).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'affiche-gymnase-des-tilleuls-2026-09-28.pdf', mimeType: 'application/pdf',
    }));
  });
});

// 🎨 FINITIONS13-COLL (04/10) — point 8 : le message d'un téléchargement parle de CE choix
// (tournée T12, CAF_4b : « Affiche enregistrée : … » restait sous « Un tableau pour le service »).
// ROUGE avant le lot.
describe('FINITIONS13-COLL point 8 — le message suit le choix', () => {
  it('« Affiche enregistrée » disparaît quand on choisit le tableau', async () => {
    mockTelecharger.mockResolvedValue({ opened: true, outcome: 'downloads' });
    const arbre = await ouvrir();
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    const message = 'Affiche enregistrée : affiche-gymnase-des-tilleuls-2026-09-28.pdf';
    expect(textes(arbre)).toContain(message);
    await act(async () => { parTestID(arbre, 'export-tableau').props.onPress(); });
    expect(textes(arbre)).not.toContain(message);
  });
});
