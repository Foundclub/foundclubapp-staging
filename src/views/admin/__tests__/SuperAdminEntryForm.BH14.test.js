import { buildPayloadFromForm } from '../SuperAdminEntryForm';

jest.mock('@/services/admin/superadminQueries', () => ({}));
jest.mock('@/services/client', () => ({ __esModule: true, default: {} }));
jest.mock('react-native-image-picker', () => ({ launchCamera: jest.fn(), launchImageLibrary: jest.fn() }));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);

// BH14 (BUGHUNT 24/10/2026) — le formulaire générique du superadmin.
describe('BH14 — buildPayloadFromForm', () => {
  const entier = [{ name: 'n', type: 'integer' }];
  const decimal = [{ name: 'd', type: 'decimal' }];

  test.each(['1.5', '12abc'])('P9-06 : « %s » dans un entier est refusé', (saisie) => {
    const { errors } = buildPayloadFromForm(entier, { n: saisie });
    expect(errors).toHaveLength(1);
  });

  test('P9-06 : « 3,5 » dans un décimal vaut 3.5', () => {
    expect(buildPayloadFromForm(decimal, { d: '3,5' }).data.d).toBe(3.5);
  });

  test('caractérisé : « 42 » et « -7 » restent des entiers valides', () => {
    expect(buildPayloadFromForm(entier, { n: '42' }).data.n).toBe(42);
    expect(buildPayloadFromForm(entier, { n: '-7' }).data.n).toBe(-7);
  });

  test('P9-22 : un champ de type inconnu contenant un objet repart en objet', () => {
    const champ = [{ name: 'pos', type: 'customField' }];
    expect(buildPayloadFromForm(champ, { pos: '{"lat":1,"lng":2}' }).data.pos).toEqual({ lat: 1, lng: 2 });
    expect(buildPayloadFromForm(champ, { pos: 'texte simple' }).data.pos).toBe('texte simple');
  });
});
