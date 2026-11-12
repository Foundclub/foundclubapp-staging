import renderer, { act } from 'react-test-renderer';

import ReserverRecapitulatif from '@/views/reserverTerrain/ReserverRecapitulatif';

import { lisibles } from '@/testSupport/temoinComplexe';
import { maReservation, recapitulatif } from '@/testSupport/temoinReserver';

// DT-3 (DUREES-TARIFS, 12/11/2026) — maquette validée par Adel le 12/11, écran J2 : la carte
// « Ta réservation » dit la durée après les heures (« · 2 h »), SEULEMENT quand le joueur l'a
// choisie parmi plusieurs (E-P03 passe alors `durationMinutes`) ; « Réserver » renvoie cette
// durée au serveur (DT-1 : absente, c'est la plus courte). Sans durée : l'écran et la demande
// d'avant, à l'identique (caractérisant).

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate, replace: mockReplace }),
  useRoute: () => ({ params: mockParams }),
}));

const mockReserver = jest.fn();
const mockApercu = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useApercuDeReservation: () => ({ isPending: false, mutateAsync: mockApercu }),
  useComplexePublic: () => ({ data: null }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useReserverUnCreneau: () => ({ isPending: false, mutateAsync: mockReserver }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: '1990-05-02', documentId: 'u-1' } }),
}));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function FauxConteneur(/** @type {any} */ { children }) {
    return children;
  },
);
jest.mock(
  'react-i18next',
  () => jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next,
);
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

/**
 * Monte l'écran, et laisse passer une lecture éventuelle.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverRecapitulatif />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return arbre;
};

/**
 * Appuie sur « Réserver » et laisse passer la réponse.
 * @param {any} arbre - L'arbre.
 * @returns {Promise<void>} Fini.
 */
const reserverIci = async (arbre) => {
  const bouton = arbre.root.find((/** @type {any} */ n) => (
    n.props?.title === 'Réserver' && typeof n.props?.onPress === 'function'
  ));
  await act(async () => {
    bouton.props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

const DEUX_HEURES = { endsAt: '2026-10-16T18:00:00.000Z', from: '18:00', to: '20:00' };

beforeEach(() => {
  jest.clearAllMocks();
  mockReserver.mockResolvedValue(maReservation());
  mockApercu.mockResolvedValue(recapitulatif());
});

describe('DT-3 — E-P04 sans durée choisie : comme aujourd’hui (caractérisant)', () => {
  beforeEach(() => {
    mockParams = {
      apercu: recapitulatif(),
      date: '2026-10-16',
      from: '18:00',
      slug: 'le-five-de-montrivage',
      terrainId: 't-1',
    };
  });

  it('la carte dit le jour et les heures, sans durée', async () => {
    const vus = lisibles(await monter());
    expect(vus).toContain('Vendredi 16 octobre · 18 h – 19 h');
    expect(vus.some((texte) => texte.includes('· 1 h'))).toBe(false);
  });

  it('« Réserver » n’envoie aucune durée', async () => {
    await reserverIci(await monter());
    expect(mockReserver).toHaveBeenCalledTimes(1);
    expect(mockReserver.mock.calls[0][0]).not.toHaveProperty('durationMinutes');
  });
});

describe('DT-3 — J2 : la durée choisie', () => {
  beforeEach(() => {
    mockParams = {
      apercu: recapitulatif(DEUX_HEURES),
      date: '2026-10-16',
      durationMinutes: 120,
      from: '18:00',
      slug: 'le-five-de-montrivage',
      terrainId: 't-1',
    };
  });

  it('« · 2 h » suit les heures', async () => {
    const vus = lisibles(await monter());
    // « · 2 h » est dans la ligne (en couleur), comme sur la maquette.
    expect(vus).toContain('Vendredi 16 octobre · 18 h – 20 h · 2 h');
    expect(vus).toContain(' · 2 h');
  });

  it('« Réserver » renvoie la durée', async () => {
    await reserverIci(await monter());
    expect(mockReserver).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-10-16', durationMinutes: 120, from: '18:00', terrain: 't-1',
    }));
  });

  it('arrivé sans récapitulatif (lien), la lecture demande cette durée', async () => {
    mockParams = { ...mockParams, apercu: undefined };
    mockApercu.mockResolvedValue(recapitulatif(DEUX_HEURES));
    await monter();
    expect(mockApercu).toHaveBeenCalledWith({
      date: '2026-10-16', durationMinutes: 120, from: '18:00', terrain: 't-1',
    });
  });
});
