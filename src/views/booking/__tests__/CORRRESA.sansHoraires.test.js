import renderer, { act } from 'react-test-renderer';

// CORR-RESA (72 A) — le calendrier de réservation du site (BookingCalendar.web.js) : une
// installation sans horaires d'ouverture n'a aucun créneau ; l'écran le dit en français au lieu
// du refus brut du serveur. Mêmes doublures que BH16.calendrierWeb.test.js.

const REFUS = 'Facility does not have opening/closing times configured';
let mockErreur = /** @type {any} */ (null);

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));
jest.mock('@/components/templates/ScreenContainer', () => ({ children }) => children);
jest.mock('@/services/client', () => ({}));
jest.mock('@/services/facility/facilityQueries', () => ({
  useCreateBooking: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useGetBookableFacilities: () => ({
    data: [{ documentId: 'f-1', name: 'Five' }], isLoading: false,
  }),
  useGetFacility: () => ({ data: { documentId: 'f-1', name: 'Five' }, isLoading: false }),
  useGetFacilityAvailability: () => ({
    data: null, error: mockErreur, isLoading: false, refetch: jest.fn(),
  }),
}));

const BookingCalendar = jest.requireActual('@/views/booking/BookingCalendar.web').default;

const monter = async () => {
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <BookingCalendar
        navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: { date: '2026-10-14' } }}
      />,
    );
  });
  return arbre;
};

const texteRendu = (/** @type {any} */ arbre) => JSON.stringify(arbre.toJSON());

afterEach(() => {
  mockErreur = null;
});

describe('CORR-RESA (72 A) — installation sans horaires', () => {
  it('le refus « opening/closing times » devient la phrase en français', async () => {
    mockErreur = new Error(REFUS);
    const arbre = await monter();
    const lu = texteRendu(arbre);
    expect(lu).toContain(
      'Cette installation n’a pas encore d’horaires : aucun créneau ne peut être réservé.',
    );
    expect(lu).not.toContain('opening/closing times');
  });
});
