import {
  LayoutAnimation, Modal, ScrollView, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';
import AdminManagerRequests from '@/views/admin/AdminManagerRequests';

import {
  appuyer,
  cadre,
  clavierAndroid,
  clavierIOS,
  IPHONES,
  restaurerTelephone,
  retraitBas,
  telephone,
  verifierDefilement,
} from '@/testSupport/clavami2ModalGeometry';

jest.setTimeout(30000);

const mockInsets = {
  bottom: 34,
  left: 0,
  right: 0,
  top: 59,
};
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => mockInsets }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, navigate: jest.fn() }),
  useRoute: () => ({}),
}));
jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);
jest.mock(
  'i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next,
);
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
const mockDemande = {
  collectivite: {
    clubsCount: 0,
    exists: false,
    gestionnaires: [],
    name: 'Ville de Valfleuri',
    type: 'commune',
  },
  createdAt: '2026-10-01T09:00:00.000Z',
  documentId: 'demande-clavami2',
  jobTitle: 'Sports',
  requester: { firstname: 'Agnès', lastname: 'Test' },
  status: 'pending',
};
const mockVide = { data: [], isLoading: false, refetch: jest.fn() };
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useAdminManagerRequests: (statut) => (
    statut === 'pending' ? { ...mockVide, data: [mockDemande] } : mockVide
  ),
  useDecideManagerRequest: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => ({ children }) => children,
);
jest.mock('@/components/atoms/loader/Loader', () => () => null);
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => () => null);

let arbre;
const ouvrir = async (kind) => {
  if (!arbre) {
    await act(async () => {
      arbre = renderer.create(<AdminManagerRequests />);
    });
    await appuyer(
      arbre.root,
      (n) => n.props.testID === `gestionnaire-demande-${mockDemande.documentId}`,
    );
  }
  await appuyer(
    arbre.root,
    (n) => n.props.title === (kind === 'refuse' ? 'Refuser' : 'Valider et créer la Ville'),
  );
  const [fenetre] = arbre.root.findAllByType(Modal);
  const champ = fenetre
    .findAllByType(TextInput)
    .find(
      (n) => n.props.testID === (kind === 'refuse' ? 'gestionnaire-motif' : 'gestionnaire-siren'),
    );
  expect(champ).toBeDefined();
  await act(async () => {
    champ.props.onChangeText(kind === 'refuse' ? 'Vérification impossible' : '123456789');
  });
  return { champ, fenetre };
};
afterEach(async () => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  await clavierIOS(IPHONES[0], false);
  jest.restoreAllMocks();
  restaurerTelephone();
});

describe.each(['refuse', 'accept'])('CLAVAMI2 — décision %s', (kind) => {
  test.each(IPHONES)(
    '$nom : champ et actions ont une zone au-dessus du clavier',
    async (iphone) => {
      telephone('ios', '18.0', iphone.barre, mockInsets);
      const { fenetre } = await ouvrir(kind);
      await clavierIOS(iphone, true);
      expect(iphone.ecran - retraitBas(cadre(fenetre).voile)).toBeLessThanOrEqual(
        iphone.ecran - iphone.clavier,
      );
    },
  );

  test.each(IPHONES)('$nom : le panneau peut défiler si la hauteur manque', async (iphone) => {
    telephone('ios', '18.0', iphone.barre, mockInsets);
    const { fenetre } = await ouvrir(kind);
    await clavierIOS(iphone, true);
    verifierDefilement(fenetre, iphone, 24);
    const [defilement] = fenetre.findAllByType(ScrollView);
    const idChamp = kind === 'refuse' ? 'gestionnaire-motif' : 'gestionnaire-siren';
    expect(defilement.findAllByType(TextInput).some((n) => n.props.testID === idChamp)).toBe(
      true,
    );
    expect(defilement.findAllByType(Button).map((n) => n.props.title)).toEqual([
      kind === 'refuse' ? 'Refuser la demande' : 'Valider et créer la Ville',
      'Annuler',
    ]);
  });

  test('fermée clavier ouvert puis rouverte clavier fermé : marge 24 restituée', async () => {
    telephone('ios', '18.0', 34, mockInsets);
    const { fenetre } = await ouvrir(kind);
    await clavierIOS(IPHONES[0], true);
    expect(retraitBas(cadre(fenetre).voile)).toBe(360);
    await act(async () => {
      fenetre.props.onRequestClose();
    });
    await clavierIOS(IPHONES[0], false);
    const { fenetre: rouverte } = await ouvrir(kind);
    expect(retraitBas(cadre(rouverte).voile)).toBe(24);
  });

  test.each(IPHONES)('$nom : clavier refermé, marge initiale restituée', async (iphone) => {
    telephone('ios', '18.0', iphone.barre, mockInsets);
    const { fenetre } = await ouvrir(kind);
    const avant = retraitBas(cadre(fenetre).voile);
    await clavierIOS(iphone, true);
    await clavierIOS(iphone, false);
    expect(retraitBas(cadre(fenetre).voile)).toBe(avant);
  });

  test.each([34, 35, 36])(
    'Android API %s : aucun second retrait ni transparence système ajoutés',
    async (api) => {
      telephone('android', api, 48, mockInsets);
      const { fenetre } = await ouvrir(kind);
      const avant = retraitBas(cadre(fenetre).voile);
      await clavierAndroid();
      expect(retraitBas(cadre(fenetre).voile)).toBe(avant);
      expect(fenetre.props.statusBarTranslucent).toBeFalsy();
      expect(fenetre.props.navigationBarTranslucent).toBeFalsy();
    },
  );
});

test('aucune décision ouverte : aucune animation du clavier de la page', async () => {
  telephone('ios', '18.0', 34, mockInsets);
  await act(async () => {
    arbre = renderer.create(<AdminManagerRequests />);
  });
  const animation = jest.spyOn(LayoutAnimation, 'configureNext');
  await clavierIOS(IPHONES[0], true);
  expect(animation).not.toHaveBeenCalled();
});
