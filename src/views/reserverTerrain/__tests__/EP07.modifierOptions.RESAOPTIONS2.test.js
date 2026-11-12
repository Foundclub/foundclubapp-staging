/* eslint-disable max-len */
import renderer, { act } from 'react-test-renderer';

import ReserverMaReservation from '@/views/reserverTerrain/ReserverMaReservation';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { maReservation, terrainPublic } from '@/testSupport/temoinReserver';

// RESA-OPTIONS-2 (12/11/2026) — E-P07 « Ma réservation » (maquette section 4 bis, décision a de
// « 233- oui ») : « Modifier les options » dans le bloc « À régler sur place », tant que
// l'annulation est gratuite ; la feuille reprend les compteurs du récapitulatif, une option déjà
// prise garde son prix figé ; « Enregistrer les options » envoie la liste entière. Et l'en-tête
// (D79) : la photo du terrain en tête.

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), popToTop: jest.fn(), replace: jest.fn() }),
  useRoute: () => ({ params: { reservationId: 'r-1' } }),
}));
let mockLecture = /** @type {any} */ ({});
let mockTerrains = /** @type {any[]} */ ([]);
const mockModifier = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useAnnulerMaReservation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexePublic: () => ({ data: jest.requireActual('@/testSupport/temoinReserver').complexePublic() }),
  useGroupeDeLaReservation: () => ({ data: null }),
  useLienDInvitation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useMaRelationAuComplexe: () => ({ data: null }),
  useMaReservation: () => mockLecture,
  useModifierMesOptions: () => ({ isPending: false, mutateAsync: mockModifier }),
  useOuvrirUnFil: () => ({ isPending: false, mutateAsync: jest.fn() }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useRepondreALaPartie: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useTerrainsPublics: () => ({ data: mockTerrains }),
}));
jest.mock('@/platform/maps/externalMap', () => ({ openExternalMap: jest.fn() }));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/templates/ScreenContainer', () => function FauxConteneur(/** @type {any} */ { children }) {
  return children;
});
jest.mock('react-i18next', () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next);
jest.mock('@/theme/themeContext', () => jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin());

const CHASUBLES = {
  id: 'a1', name: 'Location de chasubles', price: 9, required: false, unit: 'reservation',
};
const BALLON = {
  id: 'b2', name: 'Ballon de match', price: 4, required: false, unit: 'unite',
};
const CHASUBLES_FIGEES = {
  id: 'a1', name: 'Location de chasubles', price: 5, quantity: 1, unit: 'reservation',
};

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverMaReservation />);
  });
  return arbre;
};
const toucher = async (/** @type {any} */ noeud) => {
  await act(async () => {
    noeud.props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
};
const lue = (/** @type {Record<string, any>} */ autres = {}) => ({
  data: maReservation(autres), error: null, isLoading: false, refetch: jest.fn(),
});

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockTerrains = [terrainPublic({ options: [CHASUBLES, BALLON] })];
  mockModifier.mockResolvedValue({ documentId: 'r-1' });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('RESA-OPTIONS-2 — E-P07, « Modifier les options »', () => {
  it('le lien est dans « À régler sur place » ; la feuille garde le prix figé (5 €), propose le ballon au prix du moment ; « Enregistrer les options » envoie la liste entière', async () => {
    mockLecture = lue({ options: [CHASUBLES_FIGEES] });
    const arbre = await monter();
    expect(parRepere(arbre, 'ma-reservation-modifier-options')).toBeTruthy();
    await toucher(pressable(arbre, 'Modifier les options'));
    expect(parRepere(arbre, 'feuille-modifier-options')).toBeTruthy();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Location de chasubles', '5 € par réservation', 'Ballon de match', '4 € par unité',
    ]));
    await toucher(pressable(arbre, 'Un de plus : Ballon de match'));
    await toucher(pressable(arbre, 'Enregistrer les options'));
    expect(mockModifier).toHaveBeenCalledWith({
      options: [{ id: 'a1', quantity: 1 }, { id: 'b2', quantity: 1 }],
      reservationId: 'r-1',
    });
    expect(parRepere(arbre, 'feuille-modifier-options')).toBeNull();
  });

  it('sans option prise mais avec des options sur le terrain : le lien se montre seul (ajouter des options)', async () => {
    mockLecture = lue({ options: [] });
    const arbre = await monter();
    expect(parRepere(arbre, 'bloc-regler-sur-place')).toBeNull();
    expect(parRepere(arbre, 'ma-reservation-modifier-options')).toBeTruthy();
  });

  it('un refus du serveur (délai passé) se lit dans la feuille ; elle reste ouverte', async () => {
    mockLecture = lue({ options: [CHASUBLES_FIGEES] });
    mockModifier.mockRejectedValue({
      code: 'COMPLEXE_RESERVATION_CANCEL_TOO_LATE',
      message: 'Le délai d’annulation gratuite est passé : les options ne se changent plus. Appelle le complexe.',
      status: 409,
    });
    const arbre = await monter();
    await toucher(pressable(arbre, 'Modifier les options'));
    await toucher(pressable(arbre, 'Enregistrer les options'));
    expect(parRepere(arbre, 'feuille-modifier-options')).toBeTruthy();
    expect(parRepere(arbre, 'feuille-modifier-options-refus')).toBeTruthy();
  });

  it('pas de lien : après le délai d’annulation gratuite, pour un participant, ou sans option nulle part (la réservation se lit comme aujourd’hui)', async () => {
    mockLecture = lue({ canCancel: false, options: [CHASUBLES_FIGEES] });
    expect(parRepere(await monter(), 'ma-reservation-modifier-options')).toBeNull();
    mockLecture = lue({ options: [CHASUBLES_FIGEES], role: 'participant' });
    expect(parRepere(await monter(), 'ma-reservation-modifier-options')).toBeNull();
    mockTerrains = [terrainPublic()];
    mockLecture = lue();
    const arbre = await monter();
    expect(parRepere(arbre, 'ma-reservation-modifier-options')).toBeNull();
    expect(parRepere(arbre, 'bloc-regler-sur-place')).toBeNull();
  });
});

describe('RESA-OPTIONS-2 (D79) — E-P07, la photo du terrain en tête', () => {
  it('la première photo du terrain (page publique) en tête de « Ma réservation » ; sans photo, rien', async () => {
    mockTerrains = [terrainPublic({ photos: ['https://cdn.test/terrain-1.jpg', 'https://cdn.test/terrain-1b.jpg'] })];
    mockLecture = lue();
    const photo = parRepere(await monter(), 'ma-reservation-photo');
    expect(photo).toBeTruthy();
    expect(photo.props.source).toEqual({ uri: 'https://cdn.test/terrain-1.jpg' });
    mockTerrains = [terrainPublic()];
    expect(parRepere(await monter(), 'ma-reservation-photo')).toBeNull();
  });
});
