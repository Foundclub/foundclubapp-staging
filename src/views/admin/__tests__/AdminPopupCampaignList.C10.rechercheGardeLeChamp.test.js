import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminPopupCampaignList from '../AdminPopupCampaignList';

/**
 * C10 / P9-14 — liste des campagnes de popup du SuperAdmin.
 *
 * LE SYMPTOME : chaque lettre tapee dans la recherche change la cle de la requete ;
 * la nouvelle requete n a pas encore de donnees, l ecran de chargement plein ecran
 * remplace TOUTE la vue, et le champ de recherche disparait (le clavier se ferme).
 * LE CONTRAT : pendant la nouvelle recherche, le champ reste a l ecran avec la liste
 * precedente. Le VRAI crochet tourne ici (vraie react-query) : seul le service HTTP
 * est double, pour prouver le crochet ET l ecran.
 */

/** @type {any[]} */
const mockAppels = [];

jest.mock('@/services/inAppPopupCampaign/inAppPopupCampaignService', () => ({
  listInAppPopupCampaigns: (/** @type {any} */ params) => new Promise((resolve) => {
    mockAppels.push({ params, resolve });
  }),
}));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
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
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Spaces: espaces,
    }),
  };
});
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/views/admin/components/AdminStateView',
  () => function AdminStateViewMock() { return null; },
);
jest.mock('@/components/atoms/button/Button', () => function ButtonMock() { return null; });

// react-query previent ses abonnes au tour suivant (setTimeout 0) : on laisse passer ce tour.
const laisserPasser = () => act(async () => {
  await new Promise((fin) => { setTimeout(fin, 0); });
});

test('P9-14 — taper dans la recherche garde le champ a l ecran pendant la requete', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={client}><AdminPopupCampaignList /></QueryClientProvider>,
    );
  });
  // 1re page : chargement plein ecran normal, puis la liste arrive.
  await act(async () => {
    mockAppels[0].resolve({ data: [{ documentId: 'c1', name: 'Rentrée', status: 'live' }] });
  });
  await laisserPasser();
  expect(arbre.root.findAllByType(TextInput)).toHaveLength(1);

  // Une lettre tapee : une 2e requete part et n a pas encore repondu.
  await act(async () => { arbre.root.findByType(TextInput).props.onChangeText('R'); });
  await laisserPasser();
  expect(mockAppels).toHaveLength(2);
  expect(mockAppels[1].params.search).toBe('R');

  expect(arbre.root.findAllByType(TextInput)).toHaveLength(1);

  await act(async () => { mockAppels[1].resolve({ data: [] }); });
  act(() => { arbre.unmount(); });
  client.clear();
});
