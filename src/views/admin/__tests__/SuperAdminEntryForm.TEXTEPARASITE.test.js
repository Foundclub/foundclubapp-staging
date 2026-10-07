import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SuperAdminEntryForm from '../SuperAdminEntryForm';

// TEXTE-PARASITE (07/10) — le commit 99ad995b du 07/05 a posé des lignes
// `// @ts-ignore: FIXME: Baseline TS regression` AU MILIEU du JSX de ce formulaire.
// Dans du JSX, `// …` n'est pas un commentaire : c'est du TEXTE.
//   - posé dans une View, une ScrollView ou un bouton, il fait planter l écran sur
//     téléphone (« Text strings must be rendered within a <Text> component ») : une
//     des dix lignes était à la racine de la ScrollView, donc le formulaire entier ;
//   - posé dans un <Text>, il s affiche tel quel devant la liste des champs.
// react-test-renderer ne plante pas comme le moteur natif : ce témoin parcourt
// l arbre rendu et relève tout texte hors d un <Text>, puis tout texte affiché qui
// ressemble à un commentaire. Chaque section du formulaire est ouverte (scalaires,
// choix, relations avec résultats de recherche, médias, champ non pris en charge).

jest.setTimeout(30000);

const mockRechercheRelation = jest.fn();

const mockAttributs = [
  { name: 'titre', type: 'string' },
  { enum: ['brouillon', 'publie'], name: 'statut', type: 'enumeration' },
  { name: 'actif', type: 'boolean' },
  {
    multiple: true,
    name: 'clubs',
    relation: { target: 'api::club.club' },
    type: 'relation',
  },
  { multiple: true, name: 'photos', type: 'media' },
  { name: 'reglages', type: 'json' },
  { name: 'position', type: 'customField' },
];

const mockEntree = {
  actif: true,
  clubs: [{ documentId: 'club-1' }],
  photos: [{
    id: 3,
    mime: 'image/png',
    name: 'logo.png',
    url: '/u/logo.png',
  }],
  reglages: { a: 1 },
  statut: 'brouillon',
  titre: 'Une entrée',
};

jest.mock('@/services/admin/superadminQueries', () => ({
  useCreateSuperadminEntry: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useGetSuperadminContentMetadata: () => ({
    data: { data: { attributes: mockAttributs } },
    error: null,
    isLoading: false,
  }),
  useGetSuperadminEntry: () => ({ data: { data: mockEntree }, error: null, isLoading: false }),
  useSearchSuperadminRelations: () => ({ mutateAsync: mockRechercheRelation }),
  useUpdateSuperadminEntry: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ defaut) => (
      typeof defaut === 'string' ? defaut : cle
    ),
  }),
}));

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

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);

/**
 * Les textes de l arbre rendu, avec le composant natif qui les porte.
 * @param {any} noeud
 * @param {Array<{ parent: string; texte: string }>} acc
 * @returns {Array<{ parent: string; texte: string }>}
 */
const textesRendus = (noeud, acc = []) => {
  if (!noeud) return acc;
  if (Array.isArray(noeud)) {
    noeud.forEach((enfant) => textesRendus(enfant, acc));
    return acc;
  }
  (noeud.children || []).forEach((/** @type {any} */ enfant) => {
    if (typeof enfant === 'string') acc.push({ parent: noeud.type, texte: enfant });
    else textesRendus(enfant, acc);
  });
  return acc;
};

/**
 * Le bouton qui porte ce libellé.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const bouton = (arbre, libelle) => arbre.root.findAllByType(TouchableOpacity).find(
  (/** @type {any} */ candidat) => candidat.findAllByType(Text)
    .some((/** @type {any} */ texte) => texte.props.children === libelle),
);

/**
 * Le formulaire en modification, chaque section ouverte.
 * @returns {Promise<import('react-test-renderer').ReactTestRenderer>}
 */
const ouvrirLeFormulaire = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <SuperAdminEntryForm
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() }}
        route={{ params: { documentId: 'doc-1', mode: 'edit', uid: 'api::essai.essai' } }}
      />,
    );
  });
  // Des résultats de recherche de relation : la liste qu ils ouvrent portait 2 lignes.
  mockRechercheRelation.mockResolvedValue({
    data: [{ documentId: 'club-9', label: 'Club 9', subtitle: 'Lyon' }],
  });
  const recherche = arbre.root.findAllByType(TextInput)
    .find((/** @type {any} */ champ) => champ.props.placeholder === 'Rechercher une relation...');
  await act(async () => { recherche.props.onChangeText('club'); });
  await act(async () => { await bouton(arbre, 'Chercher').props.onPress(); });
  // Le repli JSON des champs non pris en charge ne s ouvre qu au toucher.
  await act(async () => { bouton(arbre, 'Afficher').props.onPress(); });
  return arbre;
};

describe('TEXTE-PARASITE — le formulaire super-admin n affiche aucun commentaire de code', () => {
  /** @type {any} */
  let arbre;

  beforeAll(async () => {
    arbre = await ouvrirLeFormulaire();
  });

  afterAll(() => {
    act(() => { arbre.unmount(); });
  });

  it('chaque section du formulaire est bien ouverte (sinon le témoin ne regarde rien)', () => {
    const textes = textesRendus(arbre.toJSON()).map(({ texte }) => texte);
    ['Scalaires', 'Booleens / Enums', 'Relations', 'Médias', 'Avance', 'club-1', 'Club 9', 'Lyon',
      'logo.png', 'brouillon', 'Masquer'].forEach((attendu) => {
      expect(textes).toContain(attendu);
    });
  });

  it('aucun texte n est posé hors d un <Text> (sur téléphone, l écran planterait)', () => {
    const horsText = textesRendus(arbre.toJSON())
      .filter(({ parent }) => parent !== 'Text')
      .map(({ parent, texte }) => `${parent}: ${JSON.stringify(texte)}`);
    expect(horsText).toEqual([]);
  });

  it('aucun texte affiché ne ressemble à un commentaire de code', () => {
    const commentaires = textesRendus(arbre.toJSON())
      .map(({ texte }) => texte)
      .filter((texte) => /@ts-(ignore|expect-error)/.test(texte) || /^\s*(\/\/|\/\*)/.test(texte));
    expect(commentaires).toEqual([]);
  });
});
