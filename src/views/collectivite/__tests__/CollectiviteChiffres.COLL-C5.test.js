import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteChiffres from '../CollectiviteChiffres';

// 🏛️ COLL-C5 (03/10) — PLANCHE 30 : « Chiffres et export » (design HY521H1, page 5, point E,
// « P5v3-chiffres », écrans A et B). Contrat des chiffres : admin/docs/CONTRAT_CHIFFRES_VILLE.md.
//
// Ce que ce témoin fige (ROUGE avant le lot : l'écran n'existait pas) :
//   - « Planning » au-dessus, « Chiffres » en titre, les trois périodes (Cette semaine · Ce mois ·
//     La saison) et « Exporter le planning… » ;
//   - les quatre blocs, dans l'ordre de la planche : Heures de séances, par installation · Heures,
//     par club · Séances tenues · Demandes ; les nombres viennent TELS QUELS du serveur ;
//   - le taux d'occupation, et « — » quand le serveur ne le sait pas (jamais 0) ;
//   - changer de période relit les chiffres de cette période ;
//   - l'export : « Un tableau pour le service », « Télécharger » enregistre le CSV du serveur, avec
//     sa marque UTF-8, sous le nom du serveur ; un échec se dit ;
//   - une panne de lecture se dit, et « Réessayer » relit.

/** @type {any} */
let mockChiffres;
const mockLectures = jest.fn();
const mockExport = jest.fn();
const mockEnregistrer = jest.fn();

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
        let valeur = lire(cle);
        if (typeof options.count === 'number') {
          const forme = options.count <= 1 ? 'one' : 'other';
          valeur = lire(`${cle}_${forme}`) ?? options[`defaultValue_${forme}`];
        }
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

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteChiffres: (/** @type {any} */ collectiviteId, /** @type {any} */ periode) => {
    mockLectures(collectiviteId, periode);
    return mockChiffres;
  },
  useMyCollectivites: () => ({
    data: [{ documentId: 'ville-de-recette', name: 'Ville de Montrivage' }],
    isLoading: false,
  }),
}));
jest.mock('@/services/collectivite/collectiviteService', () => ({
  getCollectiviteChiffresExport: (/** @type {any[]} */ ...args) => mockExport(...args),
}));
jest.mock('@/platform/media/saveTextFile', () => ({
  saveTextFile: (/** @type {any} */ params) => mockEnregistrer(params),
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
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const { Text: Texte, TouchableOpacity } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ { onChange, options, value }) {
    return options.map((/** @type {any} */ option) => (
      <TouchableOpacity
        accessibilityState={{ selected: option.value === value }}
        key={option.value}
        onPress={() => onChange(option.value)}
        testID={`periode-${option.value}`}
      >
        <Texte>{option.label}</Texte>
      </TouchableOpacity>
    ));
  };
});

// La semaine du banc serveur (admin tests/authz/_coll-c5-banc.js), telle que la route la rend.
const SEMAINE = {
  clubs: [
    {
      annulees: 0,
      aVenir: 1,
      documentId: 'as',
      enAttente: 1,
      fermeture: 1,
      minutes: 390,
      name: 'AS Montrivage',
      rattache: true,
      seances: 4,
      tenues: 3,
    },
    {
      annulees: 1,
      aVenir: 1,
      documentId: 'fc',
      enAttente: 0,
      fermeture: 1,
      minutes: 300,
      name: 'Montrivage FC',
      rattache: true,
      seances: 3,
      tenues: 2,
    },
    {
      annulees: 0,
      aVenir: 0,
      documentId: 'basket',
      enAttente: 0,
      fermeture: 0,
      minutes: 0,
      name: 'Montrivage Basket',
      rattache: true,
      seances: 0,
      tenues: 0,
    },
  ],
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
      planningColor: 'couleur-du-dojo',
      seances: 1,
      taux: null,
    },
    {
      capaciteMinutes: 11280,
      documentId: 'gymnase',
      minutes: 630,
      name: 'Gymnase des Tilleuls',
      planningColor: 'couleur-du-gymnase',
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

const titres = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .filter((/** @type {any} */ n) => n.props.accessibilityRole === 'header')
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());

const parTestID = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === testID && typeof n.props?.onPress === 'function',
)[0];

// Un bouton NEUF se trouve par son libellé (`Button` ne transmet pas `testID`).
const parTitre = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.title === titre && typeof n.props?.onPress === 'function',
)[0];

beforeEach(() => {
  mockLectures.mockClear();
  mockExport.mockReset();
  mockEnregistrer.mockReset();
  mockChiffres = {
    data: SEMAINE, error: null, isLoading: false, refetch: jest.fn(),
  };
});

describe('COLL-C5 — planche 30 : « Chiffres et export »', () => {
  it('le titre, les 3 périodes, « Exporter le planning… », les blocs dans l’ordre', async () => {
    const arbre = await monter();
    expect(titres(arbre)).toEqual([
      'Chiffres',
      'Heures de séances, par installation',
      'Heures, par club',
      'Séances tenues',
      'Demandes',
    ]);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Planning', 'Cette semaine', 'Ce mois', 'La saison', 'Exporter le planning…',
    ]));
    expect(mockLectures).toHaveBeenCalledWith('ville-de-recette', 'semaine');
  });

  it('les nombres du serveur, en mots : heures, taux, séances, demandes, délai', async () => {
    const lus = textes(await monter());
    expect(lus).toEqual(expect.arrayContaining([
      'Gymnase des Tilleuls', '10 h 30', 'Dojo municipal', '2 h',
      'Taux d’occupation : 6 %.',
      'AS Montrivage', '6 h 30', 'Montrivage FC', '5 h', 'Montrivage Basket', '0 h',
      '8 séances sur 2 installations.',
      '6 tenues · 1 annulée par le club · 2 touchées par une fermeture · 2 à venir',
      '4 reçues · 1 acceptée · 1 refusée · 1 en attente',
      'Délai moyen de réponse : 1,3 jour.',
      'Une demande « chaque semaine » compte une fois par date.',
    ]));
  });

  it('sans horaires d’ouverture nulle part : le taux s’écrit « — », jamais 0', async () => {
    mockChiffres = {
      ...mockChiffres,
      data: { ...SEMAINE, ville: { capaciteMinutes: null, minutes: 750, taux: null } },
    };
    expect(textes(await monter())).toContain(
      'Taux d’occupation : — (horaires d’ouverture non renseignés).',
    );
  });

  it('changer de période relit les chiffres de cette période', async () => {
    const arbre = await monter();
    await act(async () => { parTestID(arbre, 'periode-saison').props.onPress(); });
    expect(mockLectures).toHaveBeenLastCalledWith('ville-de-recette', 'saison');
  });

  it('l’export : « Un tableau pour le service », le CSV enregistré avec sa marque', async () => {
    mockExport.mockResolvedValue('"Date";"Début"\r\n');
    mockEnregistrer.mockResolvedValue({ opened: true, outcome: 'downloads' });
    const arbre = await monter();
    await act(async () => { parTitre(arbre, 'Exporter le planning…').props.onPress(); });
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Exporter le planning',
      'Un tableau pour le service',
      'Tableur · toutes les séances · du 28/09/2026 au 04/10/2026',
      'On y lit le club et l’équipe, jamais le nom d’un membre.',
    ]));
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    expect(mockExport).toHaveBeenCalledWith('ville-de-recette', 'semaine');
    expect(mockEnregistrer).toHaveBeenCalledWith({
      contenu: '\uFEFF"Date";"Début"\r\n',
      fileName: 'chiffres-ville-de-montrivage-semaine-2026-09-28.csv',
      mimeType: 'text/csv',
    });
    expect(textes(arbre)).toContain(
      'Tableau enregistré : chiffres-ville-de-montrivage-semaine-2026-09-28.csv',
    );
  });

  it('l’export qui échoue le dit, sans rien enregistrer', async () => {
    mockExport.mockRejectedValue(new Error('Panne réseau'));
    const arbre = await monter();
    await act(async () => { parTitre(arbre, 'Exporter le planning…').props.onPress(); });
    await act(async () => { parTitre(arbre, 'Télécharger').props.onPress(); });
    expect(mockEnregistrer).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Le tableau n’a pas pu être téléchargé.');
  });

  it('une panne de lecture se dit, et « Réessayer » relit', async () => {
    const refetch = jest.fn();
    mockChiffres = {
      data: undefined, error: { message: 'Panne' }, isLoading: false, refetch,
    };
    const arbre = await monter();
    expect(textes(arbre)).toContain('Les chiffres n’ont pas pu être lus.');
    await act(async () => { parTitre(arbre, 'Réessayer').props.onPress(); });
    expect(refetch).toHaveBeenCalled();
  });
});
