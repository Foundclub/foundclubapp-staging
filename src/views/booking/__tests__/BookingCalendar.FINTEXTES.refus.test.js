import renderer, { act } from 'react-test-renderer';

// FIN-TEXTES (02/11, DIRIGEANT) — POST /api/events/booking refusé (403) : le site affichait
// « Forbidden », en anglais, dans le cadre rouge. Sur le site, le client rejette l'erreur du
// serveur telle quelle : `{ status, name, message }`, sans `response`.

const mockEnvoi = jest.fn();

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));
jest.mock('@/components/templates/ScreenContainer', () => ({ children }) => children);
jest.mock('@/services/client', () => ({}));
jest.mock('@/services/facility/facilityQueries', () => ({
  useCreateBooking: () => ({ isPending: false, mutateAsync: mockEnvoi }),
  useGetBookableFacilities: () => ({
    data: [{ documentId: 'f-1', name: 'Gymnase' }], isLoading: false,
  }),
  useGetFacility: () => ({
    data: { documentId: 'f-1', name: 'Gymnase', slotDuration: 60 }, isLoading: false,
  }),
  useGetFacilityAvailability: () => ({
    data: { slots: [{ maxDuration: 60, remaining: 1, time: '10:00' }] }, isLoading: false,
  }),
}));

const BookingCalendar = jest.requireActual('@/views/booking/BookingCalendar.web').default;

const texteDe = (noeud) => noeud.children
  .map((enfant) => (typeof enfant === 'string' ? enfant : texteDe(enfant))).join('');

const confirmerAvecRefus = async (refus) => {
  mockEnvoi.mockReset();
  mockEnvoi.mockRejectedValue(refus);
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <BookingCalendar
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() }}
        route={{ params: { date: '2026-10-14', facilityId: 'f-1' } }}
      />,
    );
  });
  const bouton = (libelle) => arbre.root.findAll((n) => n.type === 'button'
    && texteDe(n).includes(libelle))[0];
  await act(async () => { bouton('10:00').props.onClick(); });
  await act(async () => { await bouton('Confirmer la réservation').props.onClick(); });
  expect(mockEnvoi).toHaveBeenCalledTimes(1);
  return texteDe(arbre.root);
};

const REFUS_EN_CLAIR = 'Ton compte ne peut pas réserver cette installation pour l’instant';

test('🔴 un refus 403 se dit en français, plus de « Forbidden »', async () => {
  const ecran = await confirmerAvecRefus({
    message: 'Forbidden', name: 'ForbiddenError', status: 403,
  });
  expect(ecran).not.toContain('Forbidden');
  expect(ecran).toContain(REFUS_EN_CLAIR);
});

test('un créneau déjà pris (400) garde la phrase française du serveur', async () => {
  const phrase = 'Cette installation est deja utilisee sur ce creneau.';
  const ecran = await confirmerAvecRefus({ message: phrase, name: 'BadRequestError', status: 400 });
  expect(ecran).toContain(phrase);
});

test('🔴 une panne sans phrase du serveur (500, réseau) ne montre pas son anglais', async () => {
  const ecran = await confirmerAvecRefus({ message: 'Internal Server Error', status: 500 });
  expect(ecran).not.toContain('Internal Server Error');
  expect(ecran).toContain('Impossible de créer cette réservation.');
});
