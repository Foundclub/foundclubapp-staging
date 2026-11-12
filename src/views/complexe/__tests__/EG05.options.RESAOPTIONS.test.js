/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ComplexeReservation from '@/views/complexe/ComplexeReservation';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';

// RESA-OPTIONS (12/11/2026) — E-G05, la fiche d'une réservation vue par le GÉRANT (D61, maquette
// section 4 bis) : « Options à préparer » (quoi, combien), puis « À encaisser sur place » (le
// terrain, les options, le total). Sans option : la fiche d'avant. (Mêmes doublures qu'EG05.fiche.)

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five', reservationId: 'r-1' } }),
}));

let mockFiche = /** @type {any} */ ({});
const mockDecider = jest.fn();
const mockAnnuler = jest.fn();
const mockModifier = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  // RESA-L5B-1 : « non honorée » et le seuil du complexe (témoin EG05.nonHonoree.L5B1).
  useAnnulerNonHonoree: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useAnnulerReservation: () => ({ isPending: false, mutateAsync: mockAnnuler }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => ({ data: null }),
  useDeciderDemande: () => ({ isPending: false, mutateAsync: mockDecider }),
  // RESA-FIN-APP-3 : « Écrire au réserveur » dans la fiche (E-G05).
  useEcrireAuReserveur: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useMarquerNonHonoree: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useModifierExterieur: () => ({ isPending: false, mutateAsync: mockModifier }),
  // RESA-PARTAGER : « Partager dans mon canal » (témoin EG05.partager.RESAPARTAGER).
  usePartagerAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
  // RESA-FIN-APP : la fidélité du complexe (« Valider la partie offerte » depuis la fiche).
  useFideliteDuComplexe: () => ({ data: null, isLoading: false }),
  useReservationGeree: () => mockFiche,
  useValiderRecompense: () => ({ isPending: false, mutateAsync: jest.fn() }),
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
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

const fiche = (autres = {}) => ({
  booker: {
    bookingsHere: 12, firstname: 'Julien', lastname: 'Marchal', phone: '+33639985678',
  },
  cancelledAt: null,
  cancelledBy: null,
  createdAt: '2026-10-12T19:04:00.000Z',
  date: '2026-10-16',
  decidedAt: null,
  documentId: 'r-1',
  endsAt: '2026-10-16T18:00:00.000Z',
  expiresAt: null,
  externalName: null,
  from: '19:00',
  history: [{ at: '2026-10-12T19:04:00.000Z', kind: 'reservee' }],
  note: 'Foot du jeudi',
  players: 10,
  price: { amount: 60, perPlayer: 6, unit: 'creneau' },
  reason: null,
  source: 'app',
  startsAt: '2026-10-16T17:00:00.000Z',
  status: 'confirmee',
  terrain: {
    documentId: 't-1', name: 'Terrain 1', sport: { documentId: 'a-five', name: 'Foot à 5' },
  },
  to: '20:00',
  ...autres,
});

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeReservation />);
  });
  return arbre;
};

describe('RESA-OPTIONS — E-G05, les options à préparer', () => {
  it('« Options à préparer » : 1 lot de chasubles, 2 ballons ; « À encaisser sur place » : terrain 150 €, options 11 €, total 161 €', async () => {
    mockFiche = {
      data: fiche({
        options: [
          {
            id: 'o-chas', name: 'Location de chasubles', price: 5, quantity: 1, unit: 'reservation',
          },
          {
            id: 'o-ball', name: 'Ballon de match', price: 3, quantity: 2, unit: 'unite',
          },
        ],
        price: { amount: 15, perPlayer: 15, unit: 'joueur' },
      }),
      isLoading: false,
      refetch: jest.fn(),
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      // La légende de la fiche garde sa casse (« Quand, où »).
      'Options à préparer', 'Location de chasubles × 1', 'Ballon de match × 2',
      'À ENCAISSER SUR PLACE', 'Terrain · 10 joueurs', '150 €', 'Options', '11 €', 'Total', '161 €',
    ]));
  });

  it('SANS option : ni « Options à préparer », ni bloc de plus', async () => {
    mockFiche = { data: fiche(), isLoading: false, refetch: jest.fn() };
    const arbre = await monter();
    expect(parRepere(arbre, 'fiche-options-a-preparer')).toBeNull();
    expect(parRepere(arbre, 'bloc-regler-sur-place')).toBeNull();
  });
});
