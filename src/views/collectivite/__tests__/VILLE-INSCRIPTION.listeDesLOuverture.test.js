import { FlatList, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteSignup from '../CollectiviteSignup';

// 🏛️ VILLE-INSCRIPTION (07/10/2026) — « Je représente une collectivité », étape 1 : une LISTE dès
// l'ouverture. Vu par Adel sur la TestFlight 2.6.70 (registre `.recette/TEST_PROD_2_6_70.md`,
// ligne 2) : « rien ne s'affiche tant qu'on n'a pas tapé ; au moins avoir la liste ».
// ROUGE avant le lot : aucune liste avant la saisie ; Intercommunalité, Département et Région
// n'avaient que la saisie libre.
//   - Région, Département, Intercommunalité : la liste COMPLÈTE du référentiel de l'État (lu par
//     le serveur) dès l'ouverture ; taper la FILTRE ; fini la saisie libre ;
//   - Commune : les DÉPARTEMENTS à l'ouverture, puis les communes du département touché ; taper
//     3 lettres cherche toujours dans toute la France (le chemin d'avant) ;
//   - une ligne de commune dit son DÉPARTEMENT (Démouville, Calvados : Adel l'a prise pour la
//     démo) ;
//   - la liste longue est VIRTUALISÉE (pas 1 250 lignes montées d'un coup) ;
//   - le référentiel ne répond pas : la saisie libre d'avant reste.

/** @type {any} */
let mockTrouvees;
/** @type {any} */
let mockCommunes;
/** @type {Record<string, any>} */
let mockReferentiels;
const mockEnvoi = jest.fn();
/** @type {any[]} */
const mockAppelsReferentiel = [];
/** @type {any[]} */
const mockAppelsCommunes = [];

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), reset: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        let texte = cle;
        if (typeof valeur === 'string') texte = valeur;
        else if (typeof repli === 'string') texte = repli;
        const valeurs = typeof repli === 'object' && repli ? repli : options;
        return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(valeurs?.[nom] ?? ''));
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

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    refetchUserData: jest.fn(async () => {}),
    userData: { documentId: 'agent', firstname: 'Agnès', lastname: 'Mairie' },
  }),
}));

jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn(async () => ({})) }));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteReferentiel: (/** @type {string} */ type, /** @type {any} */ options = {}) => {
    mockAppelsReferentiel.push({ options, type });
    if (options?.enabled === false) return { data: undefined, isLoading: false };
    const cle = options?.departement ? `${type}:${options.departement}` : type;
    return mockReferentiels[cle] || { data: [], isLoading: false };
  },
  useCollectiviteSignupSearch: () => mockTrouvees,
  useCommuneSearch: (/** @type {string} */ texte, /** @type {any} */ options) => {
    mockAppelsCommunes.push({ options, texte });
    return options?.enabled === false ? { data: undefined, isLoading: false } : mockCommunes;
  },
  useCreateManagerRequest: () => ({ isPending: false, mutateAsync: mockEnvoi }),
}));

jest.mock(
  '@/components/templates/FormScreenContainer',
  () => function FormScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TextInput: Saisie, View: Vue } = jest.requireActual('react-native');
  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      Vue,
      null,
      reactActuel.createElement(TexteRN, null, props.label),
      reactActuel.createElement(Saisie, {
        onBlur: props.onBlur,
        onChangeText: props.onChangeText,
        testID: props.testID,
        value: props.value,
      }),
      props.error ? reactActuel.createElement(TexteRN, null, props.error) : null,
    );
  };
});
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled, onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

/**
 * Aplati les enfants React en une chaine.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatirTexte(n.props.children).trim());
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<CollectiviteSignup />); });
  return arbre;
};
const trouver = (/** @type {any} */ arbre, /** @type {string} */ testID) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.testID === testID
    && typeof n.props?.onPress === 'function');
/**
 * Les testID des lignes touchables MONTÉES, par leur début (une fois chacune).
 * @param {any} arbre - L'arbre rendu.
 * @param {string} prefixe - Le début des testID.
 * @returns {string[]} Les testID.
 */
const lignes = (arbre, prefixe) => [...new Set(arbre.root
  .findAll((/** @type {any} */ n) => typeof n.props?.testID === 'string'
    && n.props.testID.startsWith(prefixe)
    && typeof n.props?.onPress === 'function')
  .map((/** @type {any} */ n) => n.props.testID))];
const appuyer = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const [cible] = trouver(arbre, testID);
  expect(cible).toBeDefined();
  await act(async () => { await cible.props.onPress(); });
};
const saisir = async (
  /** @type {any} */ arbre,
  /** @type {string} */ testID,
  /** @type {string} */ valeur,
) => {
  const champ = arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput
    && n.props.testID === testID)[0];
  await act(async () => { champ.props.onChangeText(valeur); });
  await act(async () => { champ.props.onBlur?.(); });
};
const laListe = (/** @type {any} */ arbre) => arbre.root.findAllByType(FlatList)[0];
const envoyerLaDemande = async (/** @type {any} */ arbre) => {
  await appuyer(arbre, 'bouton-Continuer');
  await saisir(arbre, 'collectivite-inscription-jobTitle', 'Service des sports');
  await saisir(arbre, 'collectivite-inscription-professionalEmail', 'sports@exemple.fr');
  await appuyer(arbre, 'bouton-Envoyer ma demande');
};

// Le référentiel, tel que le serveur le rend (admin `listReferentiel`, VILLE-INSCRIPTION 1) : les
// collectivités déjà sur FoundClub en tête, puis l'ordre alphabétique.
const REGIONS = [
  {
    code: '28',
    collectivite: { documentId: 'region-normandie', name: 'Région Normandie' },
    name: 'Normandie',
  },
  ...[
    ['Auvergne-Rhône-Alpes', '84'], ['Bourgogne-Franche-Comté', '27'], ['Bretagne', '53'],
    ['Centre-Val de Loire', '24'], ['Corse', '94'], ['Grand Est', '44'], ['Guadeloupe', '01'],
    ['Guyane', '03'], ['Hauts-de-France', '32'], ['Île-de-France', '11'], ['La Réunion', '04'],
    ['Martinique', '02'], ['Mayotte', '06'], ['Nouvelle-Aquitaine', '75'], ['Occitanie', '76'],
    ['Pays de la Loire', '52'], ['Provence-Alpes-Côte d’Azur', '93'],
  ].map(([name, code]) => ({ code, collectivite: null, name })),
];
const DEPARTEMENTS = [
  {
    code: '14',
    collectivite: { documentId: 'dep-calvados', name: 'Département du Calvados' },
    name: 'Calvados',
    region: '28',
  },
  {
    code: '01', collectivite: null, name: 'Ain', region: '84',
  },
  {
    code: '74', collectivite: null, name: 'Haute-Savoie', region: '84',
  },
  ...Array.from({ length: 98 }, (_v, i) => ({
    code: String(i + 100), collectivite: null, name: `Département n° ${i + 100}`, region: '00',
  })),
];
const EPCIS = [
  {
    code: '200000172',
    collectivite: null,
    departements: ['74'],
    name: 'CC Faucigny - Glières',
  },
  ...Array.from({ length: 1249 }, (_v, i) => ({
    code: String(300000000 + i), collectivite: null, departements: ['01'], name: `CC numéro ${i}`,
  })),
];
const COMMUNES_14 = [
  {
    codeInsee: '14118',
    codesPostaux: ['14000'],
    collectivite: { documentId: 'ville-caen', name: 'Ville de Caen' },
    departement: '14',
    name: 'Caen',
    siren: '211401187',
  },
  {
    codeInsee: '14001',
    codesPostaux: ['14600'],
    collectivite: null,
    departement: '14',
    name: 'Ablon',
    siren: '211400015',
  },
  {
    codeInsee: '14221',
    codesPostaux: ['14120'],
    collectivite: null,
    departement: '14',
    name: 'Démouville',
    siren: '211402219',
  },
];
const INDISPONIBLE = 'La liste n’est pas disponible pour le moment : tapez le nom.';
const servi = (/** @type {any[]} */ data) => ({ data, isLoading: false });

beforeEach(() => {
  jest.clearAllMocks();
  mockAppelsReferentiel.length = 0;
  mockAppelsCommunes.length = 0;
  mockTrouvees = { data: [], isLoading: false };
  mockCommunes = { data: [], isLoading: false };
  mockReferentiels = {
    'commune:14': servi(COMMUNES_14),
    departement: servi(DEPARTEMENTS),
    intercommunalite: servi(EPCIS),
    region: servi(REGIONS),
  };
  mockEnvoi.mockResolvedValue({ data: { status: 'pending' } });
});

describe('VILLE-INSCRIPTION — Région, Département, Intercommunalité : la liste d emblée', () => {
  it('🔴 Région : 18 lignes SANS RIEN TAPER, celle déjà sur FoundClub en tête', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-inscription-type-region');
    expect(arbre.root.findAll((/** @type {any} */ n) => n.type === TextInput
      && n.props.testID === 'collectivite-inscription-nom')[0].props.value).toBe('');
    const montees = [
      ...lignes(arbre, 'collectivite-inscription-referentiel-'),
      ...lignes(arbre, 'collectivite-inscription-trouvee-'),
    ];
    expect(montees).toHaveLength(18);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Région Normandie', 'Déjà sur FoundClub', 'Île-de-France', 'Pas encore sur FoundClub',
    ]));
    // Aucune ligne de saisie libre : la liste du référentiel la remplace.
    expect(trouver(arbre, 'collectivite-inscription-nouvelle')).toHaveLength(0);
  });

  it('🔴 Région : taper FILTRE la liste, sans accent ni majuscule', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-inscription-type-region');
    await saisir(arbre, 'collectivite-inscription-nom', 'ile');
    expect(lignes(arbre, 'collectivite-inscription-referentiel-'))
      .toEqual(['collectivite-inscription-referentiel-11']);
    await saisir(arbre, 'collectivite-inscription-nom', 'Région Sud');
    expect(lignes(arbre, 'collectivite-inscription-referentiel-')).toHaveLength(0);
    expect(textes(arbre)).toContain('Aucune collectivité ne correspond à « Région Sud ».');
    expect(trouver(arbre, 'collectivite-inscription-nouvelle')).toHaveLength(0);
  });

  it('🔴 Région absente de FoundClub : la demande part avec le nom de la liste', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-inscription-type-region');
    await appuyer(arbre, 'collectivite-inscription-referentiel-53');
    expect(textes(arbre)).toContain(
      'Bretagne n’a pas encore d’espace FoundClub. Continuez : votre demande servira à l’ouvrir.',
    );
    await envoyerLaDemande(arbre);
    expect(mockEnvoi).toHaveBeenCalledWith({
      collectiviteName: 'Bretagne',
      collectiviteType: 'region',
      jobTitle: 'Service des sports',
      professionalEmail: 'sports@exemple.fr',
    });
  });

  it('🔴 Région DÉJÀ sur FoundClub : se choisit comme une existante', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-inscription-type-region');
    await appuyer(arbre, 'collectivite-inscription-trouvee-region-normandie');
    await envoyerLaDemande(arbre);
    expect(mockEnvoi).toHaveBeenCalledWith(expect.objectContaining({
      collectiviteDocumentId: 'region-normandie',
    }));
  });

  it('🔴 Département : les 101 dans la liste, montées par morceaux', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-inscription-type-departement');
    expect(laListe(arbre).props.data).toHaveLength(101);
    const montees = lignes(arbre, 'collectivite-inscription-referentiel-').length
      + lignes(arbre, 'collectivite-inscription-trouvee-').length;
    expect(montees).toBeGreaterThanOrEqual(10);
    expect(montees).toBeLessThan(101);
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Département du Calvados', 'Ain']));
  });

  it('🔴 Intercommunalité : 1 250 lignes VIRTUALISÉES, au nom officiel', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-inscription-type-intercommunalite');
    expect(laListe(arbre).props.data).toHaveLength(1250);
    expect(lignes(arbre, 'collectivite-inscription-referentiel-').length).toBeLessThanOrEqual(30);
    await saisir(arbre, 'collectivite-inscription-nom', 'faucigny');
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Communauté de communes Faucigny - Glières',
      'Haute-Savoie · Pas encore sur FoundClub',
    ]));
    expect(trouver(arbre, 'collectivite-inscription-nouvelle')).toHaveLength(0);
    await appuyer(arbre, 'collectivite-inscription-referentiel-200000172');
    await envoyerLaDemande(arbre);
    expect(mockEnvoi).toHaveBeenCalledWith(expect.objectContaining({
      collectiviteName: 'Communauté de communes Faucigny - Glières',
      collectiviteType: 'intercommunalite',
    }));
  });
});

describe('VILLE-INSCRIPTION — Commune : les départements, puis leurs communes', () => {
  it('🔴 à l ouverture, les DÉPARTEMENTS ; on en touche un, ses communes ; on revient', async () => {
    const arbre = await monter();
    const departementsMontes = lignes(arbre, 'collectivite-inscription-departement-');
    expect(departementsMontes.length).toBeGreaterThanOrEqual(10);
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Calvados', 'Ain']));
    // Les communes ne sont pas demandées avant qu'un département soit choisi.
    expect(mockAppelsReferentiel.some((appel) => appel.type === 'commune'
      && appel.options?.enabled !== false)).toBe(false);

    await appuyer(arbre, 'collectivite-inscription-departement-14');
    expect(mockAppelsReferentiel).toContainEqual(expect.objectContaining({
      options: expect.objectContaining({ departement: '14' }), type: 'commune',
    }));
    expect(lignes(arbre, 'collectivite-inscription-departement-')).toHaveLength(0);
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Département 14 · Calvados',
      'Ville de Caen',
      'Déjà sur FoundClub · Calvados',
      'Ville de Démouville',
      '14120 · Calvados · Code INSEE 14221',
    ]));

    await appuyer(arbre, 'collectivite-inscription-tous-departements');
    expect(lignes(arbre, 'collectivite-inscription-departement-'))
      .toEqual(departementsMontes);
  });

  it('🔴 une commune du département choisie : la demande porte son code INSEE', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-inscription-departement-14');
    await appuyer(arbre, 'collectivite-inscription-commune-14221');
    await envoyerLaDemande(arbre);
    expect(mockEnvoi).toHaveBeenCalledWith({
      codeInsee: '14221',
      collectiviteName: 'Ville de Démouville',
      collectiviteType: 'commune',
      jobTitle: 'Service des sports',
      professionalEmail: 'sports@exemple.fr',
    });
  });

  it('🔴 3 lettres cherchent dans toute la France ; chaque ligne dit son département', async () => {
    mockTrouvees = {
      data: [{ documentId: 'ville-caen', name: 'Ville de Caen', type: 'commune' }],
      isLoading: false,
    };
    mockCommunes = { data: COMMUNES_14, isLoading: false };
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-inscription-departement-01');
    await saisir(arbre, 'collectivite-inscription-nom', 'Dém');
    expect(mockAppelsCommunes[mockAppelsCommunes.length - 1]).toEqual({
      options: { enabled: true }, texte: 'Dém',
    });
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Déjà sur FoundClub · Calvados',
      '14120 · Calvados · Code INSEE 14221',
    ]));
  });
});

describe('VILLE-INSCRIPTION — le référentiel ne répond pas : la saisie libre d avant reste', () => {
  it('🔒 Région sans liste : on le dit ; le nom tapé devient une demande d ouverture', async () => {
    mockReferentiels = {};
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-inscription-type-region');
    expect(textes(arbre)).toContain(INDISPONIBLE);
    await saisir(arbre, 'collectivite-inscription-nom', 'Région Sud');
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Région Sud', 'Pas encore sur FoundClub']));
    expect(trouver(arbre, 'collectivite-inscription-nouvelle')).not.toHaveLength(0);
  });

  it('🔒 Commune sans liste des départements : on le dit, la recherche tapée reste', async () => {
    mockReferentiels = {};
    const arbre = await monter();
    expect(textes(arbre)).toContain(INDISPONIBLE);
    await saisir(arbre, 'collectivite-inscription-nom', 'Valfleuri');
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Valfleuri', 'Pas encore sur FoundClub']));
  });

  it('🔒 pendant le chargement : « Chargement », jamais « indisponible »', async () => {
    mockReferentiels = { departement: { data: undefined, isLoading: true } };
    const arbre = await monter();
    expect(textes(arbre)).toContain('Chargement de la liste…');
    expect(textes(arbre)).not.toContain(INDISPONIBLE);
  });
});
