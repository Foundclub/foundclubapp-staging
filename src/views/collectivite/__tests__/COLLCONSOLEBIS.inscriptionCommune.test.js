import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CollectiviteSignup from '../CollectiviteSignup';

// 🏛️ COLL-CONSOLE-BIS (03/10/2026), point 1 — « CHERCHER LA COMMUNE » à l'inscription « Je
// représente une collectivité » (planches 7 et 8, `P1-inscription-tel` / `-ordi`, états 2 et 3).
// ROUGE avant le lot : seules les collectivités DÉJÀ sur FoundClub se trouvaient ; une commune
// absente n'était qu'un texte libre, sans code.
//   - le référentiel de l'État (lu par le serveur) propose les communes : nom officiel, code
//     postal, code INSEE ; en choisir une garde son code INSEE pour la demande ;
//   - une commune du référentiel DÉJÀ sur FoundClub se choisit comme une existante ;
//   - référentiel muet ou en panne : la saisie libre d'avant reste en place.

/** @type {any} */
let mockTrouvees;
/** @type {any} */
let mockCommunes;
const mockEnvoi = jest.fn();
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
  // VILLE-INSCRIPTION (07/10) — les listes du référentiel, muettes ici : la saisie libre reste.
  useCollectiviteReferentiel: () => ({ data: [], isLoading: false }),
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

const VALFLEURI = {
  codeInsee: '13999',
  codesPostaux: ['13990'],
  collectivite: null,
  departement: '13',
  name: 'Valfleuri',
  siren: '213999999',
};
const MONTRIVAGE_DU_REFERENTIEL = {
  codeInsee: '13998',
  codesPostaux: ['13980'],
  collectivite: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
  departement: '13',
  name: 'Montrivage',
  siren: '213998888',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAppelsCommunes.length = 0;
  mockTrouvees = { data: [], isLoading: false };
  mockCommunes = { data: [], isLoading: false };
  mockEnvoi.mockResolvedValue({ data: { status: 'pending' } });
});

describe('COLL-CONSOLE-BIS — planches 7 et 8 : chercher la commune à l inscription', () => {
  it('le référentiel propose une commune ABSENTE : nom officiel, code postal, INSEE', async () => {
    mockCommunes = { data: [VALFLEURI], isLoading: false };
    const arbre = await monter();
    await saisir(arbre, 'collectivite-inscription-nom', 'Valfl');
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Ville de Valfleuri',
      '13990 · Code INSEE 13999',
    ]));
    // Le référentiel a trouvé : plus de ligne « texte libre » sans code.
    expect(trouver(arbre, 'collectivite-inscription-nouvelle')).toHaveLength(0);
    await appuyer(arbre, 'collectivite-inscription-commune-13999');
    expect(textes(arbre)).toContain(
      // eslint-disable-next-line max-len
      'Ville de Valfleuri n’a pas encore d’espace FoundClub. Continuez : votre demande servira à l’ouvrir.',
    );
  });

  it('la demande d une commune trouvée porte son code INSEE et son nom officiel', async () => {
    mockCommunes = { data: [VALFLEURI], isLoading: false };
    const arbre = await monter();
    await saisir(arbre, 'collectivite-inscription-nom', 'Valfl');
    await appuyer(arbre, 'collectivite-inscription-commune-13999');
    await appuyer(arbre, 'bouton-Continuer');
    await saisir(arbre, 'collectivite-inscription-jobTitle', 'Service des sports');
    await saisir(arbre, 'collectivite-inscription-professionalEmail', 'sports@valfleuri.fr');
    await appuyer(arbre, 'bouton-Envoyer ma demande');
    expect(mockEnvoi).toHaveBeenCalledWith({
      codeInsee: '13999',
      collectiviteName: 'Ville de Valfleuri',
      collectiviteType: 'commune',
      jobTitle: 'Service des sports',
      professionalEmail: 'sports@valfleuri.fr',
    });
  });

  it('une commune du référentiel DÉJÀ sur FoundClub se choisit comme une existante', async () => {
    mockCommunes = { data: [MONTRIVAGE_DU_REFERENTIEL], isLoading: false };
    const arbre = await monter();
    await saisir(arbre, 'collectivite-inscription-nom', 'Montriv');
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Ville de Montrivage', 'Déjà sur FoundClub']));
    await appuyer(arbre, 'collectivite-inscription-trouvee-ville-montrivage');
    await appuyer(arbre, 'bouton-Continuer');
    await saisir(arbre, 'collectivite-inscription-jobTitle', 'Service des sports');
    await saisir(arbre, 'collectivite-inscription-professionalEmail', 'sports@montrivage.fr');
    await appuyer(arbre, 'bouton-Envoyer ma demande');
    expect(mockEnvoi).toHaveBeenCalledWith(expect.objectContaining({
      collectiviteDocumentId: 'ville-montrivage',
    }));
  });

  it('référentiel muet ou en panne : la saisie libre d avant reste', async () => {
    mockCommunes = { data: [], error: new Error('boom'), isLoading: false };
    const arbre = await monter();
    await saisir(arbre, 'collectivite-inscription-nom', 'Valfleuri');
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Valfleuri', 'Pas encore sur FoundClub']));
    expect(trouver(arbre, 'collectivite-inscription-nouvelle')).not.toHaveLength(0);
  });

  it('un autre type que « Commune » ne demande pas le référentiel des communes', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'collectivite-inscription-type-region');
    await saisir(arbre, 'collectivite-inscription-nom', 'Région Sud');
    const dernier = mockAppelsCommunes[mockAppelsCommunes.length - 1];
    expect(dernier).toEqual({ options: { enabled: false }, texte: 'Région Sud' });
  });
});
