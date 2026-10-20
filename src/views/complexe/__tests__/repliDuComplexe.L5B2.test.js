import renderer, { act } from 'react-test-renderer';

// RESA-L5B-2 (20/10/2026) — LE REPLI SUR « MON » COMPLEXE (trouvé par RESA-L7-1, consigne du feu
// RESA-L4) : sur le site, une adresse de l'espace du gérant s'ouvre SANS `?complexeId=` (menu
// latéral, lien direct) ; l'écran doit lire le complexe du compte (`useComplexeChoisi`), comme
// Demandes, Planning et Fermetures le font déjà. Avant : `params?.complexeId` seul, donc aucune
// lecture (complexeId vide) — un écran vide. Témoin : chaque écran, monté SANS paramètre, lit
// le complexe du compte ('cx-five').

/** Les premiers arguments reçus par chaque lecture doublée, par nom. */
const mockAppels = /** @type {Record<string, unknown[]>} */ ({});
jest.mock('@/services/complexe/complexeQueries', () => new Proxy({}, {
  get: (_cible, nom) => {
    if (nom === '__esModule') return true;
    if (nom === 'useComplexeChoisi') {
      return (/** @type {any} */ complexeId) => ({
        complexe: { documentId: complexeId || 'cx-five', name: 'Le Five de Montrivage' },
        complexeId: complexeId || 'cx-five',
        mes: { data: [{ documentId: 'cx-five' }], isLoading: false },
      });
    }
    return (/** @type {any[]} */ ...args) => {
      (mockAppels[String(nom)] ||= []).push(args[0]);
      return {
        data: undefined,
        isLoading: true,
        isPending: false,
        mutate: jest.fn(),
        mutateAsync: jest.fn(),
        refetch: jest.fn(),
      };
    };
  },
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({
    addListener: () => () => {}, goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn(),
  }),
  useRoute: () => ({ params: {} }),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
// Les composants natifs que jest ne lit pas, doublés comme dans les témoins de chaque écran
// (EG04, EG08) : les onglets, le choix du sport, les saisies, le choix d'une photo.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => (
  jest.requireActual('@/testSupport/temoinComplexe').ongletsDeTemoin()
));
jest.mock('@/components/organisms/choixDuSport/ChoixDuSport', () => () => null);
jest.mock('@/components/molecules/input/Input', () => () => null);
jest.mock('@/components/organisms/phoneInput/PhoneInput', () => () => null);
jest.mock('@/components/atoms/checkable/Checkable', () => () => null);
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickImage: jest.fn() } }));
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));
jest.mock('@/services/complexe/complexeService', () => ({ televerserPhoto: jest.fn() }));
jest.mock('@/components/templates/ScreenContainer', () => (
  function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  }
));
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/* eslint-disable global-require */
// L'écran, la lecture qui prouve qu'il a trouvé son complexe, et son chargement.
const ECRANS = [
  ['ComplexeInstallations', 'useTerrains', () => require('@/views/complexe/ComplexeInstallations')],
  ['ComplexeTerrain', 'useTerrains', () => require('@/views/complexe/ComplexeTerrain')],
  ['ComplexeCreneaux', 'useTerrains', () => require('@/views/complexe/ComplexeCreneaux')],
  ['ComplexeReglages', 'useComplexeGere', () => require('@/views/complexe/ComplexeReglages')],
  [
    'ComplexeReservations',
    'useReservationsDuComplexe',
    () => require('@/views/complexe/ComplexeReservations'),
  ],
  [
    'ComplexeReservation',
    'useReservationGeree',
    () => require('@/views/complexe/ComplexeReservation'),
  ],
  ['ComplexeClient', 'useComplexeGere', () => require('@/views/complexe/ComplexeClient')],
];
/* eslint-enable global-require */

describe('RESA-L5B-2 — sans `complexeId` dans l’adresse, l’écran lit le complexe du compte', () => {
  it.each(ECRANS)('%s lit « mon » complexe', async (_ecran, lecture, charger) => {
    Object.keys(mockAppels).forEach((nom) => delete mockAppels[nom]);
    const Ecran = /** @type {any} */ (charger()).default;
    await act(async () => {
      renderer.create(<Ecran />);
    });
    expect(mockAppels[lecture]).toContain('cx-five');
  });
});
