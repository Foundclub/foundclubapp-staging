import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SuperAdminEntryForm from '../SuperAdminEntryForm';

// BH14 P9-07 (BUGHUNT 24/10/2026) — après une erreur de chargement de la fiche puis « Réessayer »,
// le formulaire restait VIDE (rempli pendant l'erreur) : l'enregistrer écrasait la fiche.

jest.setTimeout(30000);

const mockRechercheRelation = jest.fn();
/** @type {any} */
let mockEtatFiche = { data: undefined, error: new Error('réseau'), isLoading: false };

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
  useGetSuperadminEntry: () => mockEtatFiche,
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

test('P9-07 : la fiche rechargée après une erreur remplit le formulaire', async () => {
  /** @type {any} */
  let arbre;
  const ecran = () => (
    <SuperAdminEntryForm
      navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }}
      route={{ params: { documentId: 'doc-1', mode: 'edit', uid: 'api::essai.essai' } }}
    />
  );
  await act(async () => { arbre = renderer.create(ecran()); });
  mockEtatFiche = { data: { data: mockEntree }, error: null, isLoading: false };
  await act(async () => { arbre.update(ecran()); });
  const valeurs = arbre.root.findAllByType(TextInput).map((/** @type {any} */ c) => c.props.value);
  expect(valeurs).toContain('Une entrée');
});
