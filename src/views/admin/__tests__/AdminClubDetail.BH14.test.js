/* eslint-disable max-len */
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminClubDetail from '../AdminClubDetail';

// BH14 P9-08 (BUGHUNT 24/10/2026) — « Retirer » une relation de la fiche club ne faisait RIEN :
// la configuration de la relation n'existe que pendant la fenêtre d'ajout.

const mockMiseAJour = jest.fn(async () => ({}));

jest.setTimeout(30000);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }),
  useRoute: () => ({ params: { clubId: 'club-doc' } }),
}));
jest.mock('@/services/admin/adminClubContentQueries', () => ({
  useDeleteAdminClubContent: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useGetAdminClubContent: () => ({
    data: { data: { activites: [{ documentId: 'act-1', name: 'Football' }], documentId: 'club-doc', name: 'AS Test' } },
    error: null,
    isFetching: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useSearchAdminClubRelations: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useUpdateAdminClubRelation: () => ({ isPending: false, mutateAsync: mockMiseAJour }),
}));
jest.mock('@/services/admin/adminQueries', () => ({
  useVerifyAdminClub: () => ({ isPending: false, mutate: jest.fn() }),
}));
jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock('@/views/admin/components/OffreFoundclubClub', () => () => null);
jest.mock('react-native-gesture-handler', () => ({}));

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

const texteDe = (/** @type {any} */ n) => [n.props.children].flat().join('');
const appuyerSur = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const texte = arbre.root.findAllByType(Text).find((/** @type {any} */ n) => texteDe(n) === libelle);
  let noeud = texte;
  while (noeud && typeof noeud.props?.onPress !== 'function') noeud = noeud.parent;
  await act(async () => { await noeud.props.onPress(); });
};

test('P9-08 : « Retirer » une activité envoie la déconnexion', async () => {
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<AdminClubDetail />); });
  await appuyerSur(arbre, 'Relations');
  await appuyerSur(arbre, 'Retirer');
  expect(mockMiseAJour).toHaveBeenCalledWith(expect.objectContaining({
    action: 'disconnect', field: 'activites', targetDocumentId: 'act-1',
  }));
});
