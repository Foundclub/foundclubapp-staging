import renderer, { act } from 'react-test-renderer';

// BH16 P13-09 / P13-10 — le calendrier de réservation du site (BookingCalendar.web.js).

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
  useGetBookableFacilities: () => ({ data: [{ documentId: 'f-1', name: 'Five' }], isLoading: false }),
  useGetFacility: () => ({ data: { documentId: 'f-1', name: 'Five' }, isLoading: false }),
  useGetFacilityAvailability: () => ({ data: null, isLoading: false }),
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

it('P13-10 — en partagé, pas plus de joueurs confirmés que le total prévu moins un', async () => {
  const arbre = await monter();
  const partage = arbre.root.findAll((n) => typeof n.props?.onClick === 'function'
    && n.findAll((m) => m.children?.includes?.('Partagé')).length > 0).at(-1);
  await act(async () => { partage.props.onClick(); });
  const champ = () => arbre.root.findAll((n) => n.type === 'input' && n.props.min === 1
    && n.props.max !== undefined)[0];
  expect(champ().props.max).toBe(9);
  await act(async () => { champ().props.onChange({ target: { value: '50' } }); });
  expect(champ().props.value).toBe(9);
});

it('P13-09 — « 2026-10-14 » dans l’adresse = le 14/10, même à l’ouest d’UTC (lancer aussi avec TZ=America/New_York)', async () => {
  const arbre = await monter();
  const textes = arbre.root.findAll((n) => n.type === 'strong').map((n) => n.children.join(''));
  expect(textes).toContain('14/10/2026');
});
