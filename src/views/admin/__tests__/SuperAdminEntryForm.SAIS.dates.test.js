/* eslint-disable max-len -- des appels entiers, compares tels quels */
import { format } from 'date-fns';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SuperAdminEntryForm from '../SuperAdminEntryForm';

// 🗓️ SAIS (08/10/2026, tournée T20, hors lots) — CONSOLE « Gestion de contenu » › Modifier : les
// champs date, heure et date + heure se TAPAIENT en texte (placeholder « 2026-03-07T10:30:00.000Z »,
// capture SITE_S08a). Ils se choisissent désormais aux sélecteurs de l'app, et le serveur reçoit
// le MÊME format qu'avant : « AAAA-MM-JJ », « HH:mm:ss.SSS », ISO complet (heure LOCALE → UTC).

jest.setTimeout(30000);

const mockMiseAJour = jest.fn(() => Promise.resolve({}));
/** @type {any[]} */
const mockSelecteurs = [];

const mockAttributs = [
  { name: 'startDate', type: 'date' },
  { name: 'startTime', type: 'time' },
  { name: 'reopenedAt', type: 'datetime' },
  { name: 'endDate', type: 'date' },
];
const mockEntree = {
  endDate: '2026-10-09',
  reopenedAt: '2026-10-08T10:30:00.000Z',
  startDate: '2026-10-08',
  startTime: '18:30:00.000',
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
// Les sélecteurs de l'app : la doublure garde ce qu'ils montrent et leur rappel, par champ.
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => function DatePickerInputMock(/** @type {any} */ props) {
  mockSelecteurs.push({ ...props, sorte: 'date' });
  return null;
});
jest.mock('@/components/molecules/timePickerInput/TimePickerInput', () => function TimePickerInputMock(/** @type {any} */ props) {
  mockSelecteurs.push({ ...props, sorte: 'heure' });
  return null;
});

const selecteur = (/** @type {string} */ testID) => [...mockSelecteurs].reverse()
  .find((props) => props.testID === testID);
const bouton = (/** @type {any} */ arbre, /** @type {string} */ libelle) => arbre.root.findAllByType(TouchableOpacity).find(
  (/** @type {any} */ candidat) => candidat.findAllByType(Text)
    .some((/** @type {any} */ texte) => texte.props.children === libelle),
);

/** @type {any} */
let arbre;
beforeEach(async () => {
  mockSelecteurs.length = 0;
  mockMiseAJour.mockClear();
  await act(async () => {
    arbre = renderer.create(
      <SuperAdminEntryForm
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() }}
        route={{ params: { documentId: 'fermeture-1', mode: 'edit', uid: 'api::facility-closure.facility-closure' } }}
      />,
    );
  });
});
afterEach(() => {
  act(() => { arbre.unmount(); });
});

describe('SAIS — la console choisit dates et heures aux sélecteurs', () => {
  test('plus aucun champ texte de date ou d’heure (ni placeholder ISO)', () => {
    const placeholders = arbre.root.findAllByType(TextInput).map((/** @type {any} */ champ) => champ.props.placeholder);
    expect(placeholders).not.toContain('2026-03-07T10:30:00.000Z');
    expect(selecteur('champ-startDate-date')).toEqual(expect.objectContaining({ sorte: 'date', value: '08/10/2026' }));
    expect(selecteur('champ-startTime-heure')).toEqual(expect.objectContaining({ sorte: 'heure', value: '18:30' }));
    const instant = new Date('2026-10-08T10:30:00.000Z');
    expect(selecteur('champ-reopenedAt-date').value).toBe(format(instant, 'dd/MM/yyyy'));
    expect(selecteur('champ-reopenedAt-heure').value).toBe(format(instant, 'HH:mm'));
  });

  test('le serveur reçoit le même format qu’avant ; un champ non touché part tel quel', async () => {
    await act(async () => { selecteur('champ-startDate-date').onChange('09/10/2026'); });
    await act(async () => { selecteur('champ-startTime-heure').onChange('19:00'); });
    await act(async () => { selecteur('champ-reopenedAt-heure').onChange('11:00'); });
    await act(async () => { await bouton(arbre, 'Enregistrer').props.onPress(); });
    const instant = new Date('2026-10-08T10:30:00.000Z');
    const attendu = new Date(instant.getFullYear(), instant.getMonth(), instant.getDate(), 11, 0).toISOString();
    expect(mockMiseAJour).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        endDate: '2026-10-09',
        reopenedAt: attendu,
        startDate: '2026-10-09',
        startTime: '19:00:00.000',
      },
    }));
  });

  test('vider un champ (site : le navigateur rend « ») l’envoie vide (null)', async () => {
    await act(async () => { selecteur('champ-endDate-date').onChange(''); });
    await act(async () => { await bouton(arbre, 'Enregistrer').props.onPress(); });
    expect(mockMiseAJour).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ endDate: null }),
    }));
  });
});
