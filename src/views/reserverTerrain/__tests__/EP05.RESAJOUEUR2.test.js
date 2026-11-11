import renderer, { act } from 'react-test-renderer';

import ReserverResultat from '@/views/reserverTerrain/ReserverResultat';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { maReservation } from '@/testSupport/temoinReserver';

// RESA-JOUEUR-2 (11/11/2026) — E-P05 de la maquette validée « 232- ok » :
//   · au complet : la carte résumé reprend la photo du terrain, la durée et ce que paie le groupe
//     (« 60 € pour 10 joueurs, à régler sur place ») ;
//   · réservation en construction (remplace « Collecte lancée : 1/10 ») : une jauge « 6 sur 10 »,
//     « Il manque 4 joueurs », puis deux bandeaux — le créneau peut encore être pris, l'annonce est
//     en ligne (seulement si elle est vraiment partie) ; « Inviter par lien », « Voir ma
//     réservation ».
// Sans changement : « Demande envoyée », « C'est réservé pour U15 Valbrune ! ».

jest.setTimeout(30000);

const mockReplace = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ addListener: () => () => {}, navigate: jest.fn(), replace: mockReplace }),
  useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { documentId: 'u-1' } }),
}));
let mockTerrains = /** @type {any[]} */ ([]);
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useLienDInvitation: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useMaReservation: () => ({ data: null, isLoading: false }),
  useTerrainsPublics: () => ({ data: mockTerrains }),
}));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
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

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverResultat />);
  });
  return arbre;
};

/**
 * Le bouton dont le titre est exactement celui-ci.
 * @param {any} arbre - L'arbre.
 * @param {string} titre - Le titre.
 * @returns {any} Le bouton.
 */
const bouton = (arbre, titre) => arbre.root.findAll((/** @type {any} */ noeud) => (
  noeud.props?.title === titre && typeof noeud.props?.onPress === 'function'
))[0];

beforeEach(() => {
  // Le créneau du 16/10 est à venir : sinon la pastille dirait « Jouée ».
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockTerrains = [{ documentId: 't-1', name: 'Terrain 1', photos: ['https://cdn.test/t1-a.jpg'] }];
  mockParams = { reservation: maReservation({ price: { amount: 6, unit: 'joueur' } }) };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('RESA-JOUEUR-2 E-P05 — au complet', () => {
  it('la photo du terrain, la durée et ce que paie le groupe', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'C’est réservé !',
      'Vendredi 16/10 · 18 h – 19 h',
      'Terrain 1 · 1 h · Le Five de Montrivage',
      '60 € pour 10 joueurs, à régler sur place',
      'Confirmée',
    ]));
    expect(parRepere(arbre, 'resultat-photo').props.source).toEqual({ uri: 'https://cdn.test/t1-a.jpg' });
  });

  it('sans photo : pas d’image ; au créneau : « 60 €, à régler sur place »', async () => {
    mockTerrains = [{ documentId: 't-1', name: 'Terrain 1', photos: [] }];
    mockParams = { reservation: maReservation() };
    const arbre = await monter();
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'resultat-photo'))
      .toHaveLength(0);
    expect(lisibles(arbre)).toContain('60 €, à régler sur place');
  });
});

describe('RESA-JOUEUR-2 E-P05 — réservation en construction', () => {
  beforeEach(() => {
    mockParams = {
      collecte: {
        annonce: true, collectDeadline: '2026-10-16T16:00:00.000Z', presents: 6, quorum: 10,
      },
      reservation: maReservation({ price: { amount: 6, unit: 'joueur' }, status: 'en_collecte' }),
    };
  });

  it('la jauge « 6 sur 10 », ce qui manque, les deux bandeaux', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toEqual(expect.arrayContaining([
      'Réservation en construction',
      'Vendredi 16/10 · 18 h – 19 h · Terrain 1',
      'Le Five de Montrivage · 1 h',
      '6 sur 10',
      'Il manque 4 joueurs',
      'En construction',
      'Tant que ce n’est pas confirmé, un autre groupe peut prendre ce créneau. '
        + 'Dis « On a assez de joueurs » dès que ton groupe est prêt.',
      'Ton annonce « Il manque 4 joueurs » est en ligne dans « Recherche de joueurs ».',
    ]));
    expect(parRepere(arbre, 'resultat-jauge')).not.toBeNull();
    // Remplacés par la maquette : « Collecte lancée », la date limite, l'annonce à la main.
    expect(vus.join(' ')).not.toMatch(/Collecte lancée|date limite|Il me manque des joueurs/);
  });

  it('« Inviter par lien » puis « Voir ma réservation », qui ouvre la fiche', async () => {
    const arbre = await monter();
    expect(bouton(arbre, 'Inviter par lien').props.variant).toBe('Primary');
    expect(bouton(arbre, 'Voir ma réservation').props.variant).toBe('Secondary');
    expect(bouton(arbre, 'Voir ma collecte')).toBeUndefined();
    await act(async () => {
      bouton(arbre, 'Voir ma réservation').props.onPress();
    });
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverMaReservation, {
      reservationId: 'r-1',
    });
  });

  it('l’annonce n’est pas partie : on ne dit pas qu’elle est en ligne', async () => {
    mockParams.collecte.annonce = false;
    const vus = lisibles(await monter());
    expect(vus.join(' ')).not.toContain('est en ligne dans « Recherche de joueurs »');
    expect(vus).toContain('6 sur 10');
  });
});
