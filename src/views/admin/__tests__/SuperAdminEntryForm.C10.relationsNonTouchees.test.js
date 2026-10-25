import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SuperAdminEntryForm, { buildPayloadFromForm } from '../SuperAdminEntryForm';

// C10 / P9-03 (BUGHUNT 24/10) — CONSOLE « Gestion de contenu » › Modifier : chaque relation et
// chaque média repartaient en `{ set: [...] }` reconstruit depuis le formulaire, même sans y
// toucher. Le serveur charge la fiche avec `populate: '*'` (superadmin-console.ts, findOne) : les
// relations DIRECTES ne se perdaient donc pas, mais tout ce que ce chargement ne ramène pas
// entièrement aurait été remplacé. LE CONTRAT : une relation ou un média NON TOUCHÉ ne part plus ;
// un champ touché part comme avant.

jest.setTimeout(30000);

const mockMiseAJour = jest.fn(() => Promise.resolve({}));

const mockAttributs = [
  { name: 'name', type: 'string' },
  {
    multiple: false, name: 'club', target: 'api::club.club', type: 'relation',
  },
  {
    multiple: true, name: 'teams', target: 'api::team.team', type: 'relation',
  },
  { multiple: false, name: 'logo', type: 'media' },
];
const mockEntree = {
  club: { documentId: 'club-1', name: 'AS Test' },
  logo: { id: 5, name: 'logo.png', url: '/uploads/logo.png' },
  name: 'Fiche A',
  teams: [{ documentId: 'eq-1', name: 'U11' }, { documentId: 'eq-2', name: 'U13' }],
};

jest.mock('@/services/admin/superadminQueries', () => ({
  useCreateSuperadminEntry: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useGetSuperadminContentMetadata: () => ({
    data: { data: { attributes: mockAttributs } },
    error: null,
    isLoading: false,
  }),
  useGetSuperadminEntry: () => ({ data: { data: mockEntree }, error: null, isLoading: false }),
  useSearchSuperadminRelations: () => ({ mutateAsync: jest.fn() }),
  useUpdateSuperadminEntry: () => ({ isPending: false, mutateAsync: mockMiseAJour }),
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
const bouton = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root
  .findAllByType(TouchableOpacity).find(
    (/** @type {any} */ candidat) => candidat.findAllByType(Text)
      .some((/** @type {any} */ texte) => texte.props.children === libelle),
  );

/** @type {any} */
let arbre;
beforeEach(async () => {
  mockMiseAJour.mockClear();
  await act(async () => {
    arbre = renderer.create(
      <SuperAdminEntryForm
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() }}
        route={{ params: { documentId: 'fiche-1', mode: 'edit', uid: 'api::club.club' } }}
      />,
    );
  });
});
afterEach(() => {
  act(() => { arbre.unmount(); });
});

test('P9-03 — modifier un texte : relations et média non touchés ne partent pas', async () => {
  const champNom = arbre.root.findAllByType(TextInput)
    .find((/** @type {any} */ champ) => champ.props.value === 'Fiche A');
  await act(async () => { champNom.props.onChangeText('Fiche B'); });
  await act(async () => { await bouton(arbre, 'Enregistrer').props.onPress(); });

  expect(mockMiseAJour).toHaveBeenCalledTimes(1);
  const { data } = mockMiseAJour.mock.calls[0][0];
  expect(data.name).toBe('Fiche B');
  expect(data).not.toHaveProperty('club');
  expect(data).not.toHaveProperty('teams');
  expect(data).not.toHaveProperty('logo');
});

test('P9-03 — une relation modifiée, ou vidée, part comme avant ; en création tout part', () => {
  const charge = { club: 'club-1', name: 'Fiche A', teams: ['eq-1', 'eq-2'] };

  expect(buildPayloadFromForm(mockAttributs, { ...charge, teams: ['eq-1'] }, charge).data)
    .toEqual({ name: 'Fiche A', teams: { set: [{ documentId: 'eq-1' }] } });
  expect(buildPayloadFromForm(mockAttributs, { ...charge, club: '' }, charge).data)
    .toEqual({ club: { set: [] }, name: 'Fiche A' });
  expect(buildPayloadFromForm(mockAttributs, charge).data).toMatchObject({
    club: { set: [{ documentId: 'club-1' }] },
    teams: { set: [{ documentId: 'eq-1' }, { documentId: 'eq-2' }] },
  });
});
