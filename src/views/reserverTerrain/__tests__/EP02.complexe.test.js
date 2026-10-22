import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ReserverComplexe from '@/views/reserverTerrain/ReserverComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { complexePublic, creneau, terrainPublic } from '@/testSupport/temoinReserver';

// RESA-L6A (14/10/2026) — E-P02 « La page du complexe » (planches EP02, RA2, OR2 ; plan E-P02) :
// la carte d'identité (logo, nom, pastille « Complexe de réservation », « Vérifié », ville,
// sports), les segments « Réserver » · « Infos », une carte par terrain (mode, prix au créneau ET
// par joueur, les créneaux libres du jour), « par téléphone » ⇒ la feuille E-P06, les Règles (âge
// minimum, annulation, paiement sur place, le mot aux joueurs), les Infos (description, horaires
// d'accueil, adresse et itinéraire, téléphone DU complexe, site), et les états (chargement,
// erreur, complexe parti, aucun terrain, aperçu du gérant, sous l'âge minimum).
// ⛔ Pas dans ce lot : favori, canal, fidélité, partenaires, « Signaler » (L4 puis L6b).

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams = /** @type {any} */ ({ slug: 'le-five-de-montrivage' });
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ canGoBack: () => true, goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

let mockComplexe = /** @type {any} */ ({});
let mockTerrains = /** @type {any} */ ({});
let mockCreneaux = /** @type {Record<string, any>} */ ({});
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  // RESA-L6B-2 : la communauté du complexe (favori, relation, partenaires, signalement), vide.
  useAjouterAuxFavoris: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useComplexePublic: () => mockComplexe,
  useCreneauxDuJour: (/** @type {any} */ _slug, /** @type {string} */ terrainId) => (
    mockCreneaux[terrainId] || { data: { slots: [] } }
  ),
  useMaRelationAuComplexe: () => ({ data: null }),
  usePartenairesPublics: () => ({ data: [] }),
  useRetirerDesFavoris: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useSignalerUnComplexe: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useTerrainsPublics: () => mockTerrains,
}));

let mockNaissance = /** @type {string | null} */ ('1990-05-02');
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: mockNaissance, documentId: 'u-1' } }),
}));

const mockCarte = jest.fn();
jest.mock('@/platform/maps/externalMap', () => ({
  openExternalMap: (/** @type {any} */ cible) => mockCarte(cible),
}));

const mockVersLaRecherche = jest.fn();
jest.mock('@/views/search/searchRouteHelpers', () => ({
  navigateToSearchHub: (/** @type {any[]} */ ...args) => mockVersLaRecherche(...args),
}));

let mockOrdinateur = false;
jest.mock('@/responsive', () => ({ useIsDesktop: () => mockOrdinateur }));
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
// Les segments réels tirent react-native-gesture-handler : doublés, ils gardent leurs libellés et
// leur geste (`onChange`).
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => (
  function FauxSegments(/** @type {any} */ { onChange, options, value }) {
    const { Text: Texte, TouchableOpacity: Touche, View: Vue } = jest.requireActual('react-native');
    return (
      <Vue>
        {options.map((/** @type {any} */ option) => (
          <Touche
            accessibilityState={{ selected: option.value === value }}
            key={option.value}
            onPress={() => onChange(option.value)}
          >
            <Texte>{option.label}</Texte>
          </Touche>
        ))}
      </Vue>
    );
  }
));
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

const relireLeComplexe = jest.fn();

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverComplexe />);
  });
  return arbre;
};

/**
 * Appuie sur un élément par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
};

const PADEL = terrainPublic({
  bookingMode: 'telephone',
  capacity: 4,
  documentId: 't-padel',
  name: 'Padel A',
  phone: { number: '+33639981234', text: 'Ce terrain ne peut être réservé que par appel au' },
  price: { max: 6, min: 6, unit: 'joueur' },
  sport: { documentId: 'a-padel', name: 'Padel' },
});

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  mockParams = { slug: 'le-five-de-montrivage' };
  mockOrdinateur = false;
  mockNaissance = '1990-05-02';
  mockComplexe = {
    data: complexePublic(), error: null, isLoading: false, refetch: relireLeComplexe,
  };
  mockTerrains = {
    data: [
      terrainPublic(),
      terrainPublic({
        bookingMode: 'manuel', documentId: 't-2', name: 'Terrain 2', setting: 'interieur',
      }),
      PADEL,
    ],
    error: null,
    isLoading: false,
  };
  mockCreneaux = {
    't-1': {
      data: {
        slots: [
          creneau('18:00', '19:00'),
          creneau('19:00', '20:00', 'pris'),
          creneau('20:30', '21:30'),
        ],
      },
    },
    't-padel': {
      data: {
        slots: [creneau('18:00', '19:30', 'libre', {
          price: { amount: 6, perPlayer: 6, unit: 'joueur' },
        })],
      },
    },
  };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('E-P02 — la carte d’identité et le segment « Réserver »', () => {
  it('le nom, la pastille, la ville, les sports', async () => {
    const vus = lisibles(await monter());
    expect(vus).toEqual(expect.arrayContaining([
      'LE FIVE DE MONTRIVAGE',
      'Complexe de réservation',
      'Montrivage',
      'Foot à 5 · Padel',
      'Réserver',
      'Infos',
    ]));
    expect(vus).not.toContain('Vérifié');
  });

  it('« Vérifié » seulement si FoundClub l’a vérifié', async () => {
    mockComplexe.data = complexePublic({ verified: true });
    expect(lisibles(await monter())).toContain('Vérifié');
  });

  it('une carte par terrain : la ligne, le mode, le prix au créneau ET par joueur', async () => {
    const vus = lisibles(await monter());
    expect(vus).toEqual(expect.arrayContaining([
      'Terrain 1',
      'Foot à 5 · Extérieur · 10 joueurs',
      'Confirmation immédiate',
      '60 € le créneau',
      'soit 6 € par joueur à 10, à régler sur place',
      'Terrain 2',
      'Sur demande',
      'Padel A',
      'Par téléphone',
      '6 € par joueur',
      '24 € pour 4 joueurs, à régler sur place',
    ]));
  });

  it('les créneaux LIBRES du jour en puces ; « pris » n’y est pas', async () => {
    const arbre = await monter();
    expect(parRepere(arbre, 'terrain-t-1-creneau-18:00')).not.toBeNull();
    expect(parRepere(arbre, 'terrain-t-1-creneau-20:30')).not.toBeNull();
    expect(parRepere(arbre, 'terrain-t-1-creneau-19:00')).toBeNull();
  });

  it('« Voir les créneaux » et une puce ouvrent le calendrier du terrain (E-P03)', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Terrain 1 : voir les créneaux');
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ReserverCreneau, {
      slug: 'le-five-de-montrivage', terrainId: 't-1',
    });
    await act(async () => {
      parRepere(arbre, 'terrain-t-1-creneau-20:30').props.onPress();
    });
    expect(mockNavigate).toHaveBeenLastCalledWith(RouteNames.ReserverCreneau, {
      date: '2026-10-14', from: '20:30', slug: 'le-five-de-montrivage', terrainId: 't-1',
    });
  });

  it('« par téléphone » : un créneau, ou « Réserver par téléphone », ouvre l’appel', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Par téléphone : touche un créneau');
    await act(async () => {
      parRepere(arbre, 'terrain-t-padel-creneau-18:00').props.onPress();
    });
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Padel A · Mercredi 14 octobre',
      '18 h – 19 h 30',
      'Appeler le 06 39 98 12 34',
    ]));
    await appuyer(arbre, 'Fermer');
    await appuyer(arbre, 'Réserver par téléphone');
    expect(lisibles(arbre))
      .toContain('Ce terrain ne peut être réservé que par appel au 06 39 98 12 34.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('les Règles : âge minimum, annulation, paiement sur place, mot aux joueurs', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Règles',
      'Réservation à partir de 16 ans',
      'Annulation gratuite jusqu’à 24 h avant',
      'Paiement sur place',
      'Le mot du complexe',
      'Arrive 10 minutes avant, chasubles à l’accueil.',
    ]));
    expect(parRepere(arbre, 'regle-age-en-evidence')).toBeNull();
  });

  it('sous l’âge minimum (ou sans date de naissance) : l’âge est mis en évidence', async () => {
    mockNaissance = '2012-01-01';
    expect(parRepere(await monter(), 'regle-age-en-evidence')).not.toBeNull();
    mockNaissance = null;
    expect(parRepere(await monter(), 'regle-age-en-evidence')).not.toBeNull();
  });
});

describe('E-P02 — le segment « Infos »', () => {
  it('description, horaires d’accueil, adresse, téléphone du complexe, site', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Infos');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Le complexe',
      'Deux terrains de foot à 5 et un padel en plein air, vestiaires et douches.',
      'Horaires d’accueil',
      'Lundi',
      '17 h – 23 h',
      'Samedi',
      '9 h – 22 h',
      'Adresse',
      '12 allée des Sports, Montrivage',
      'Téléphone du complexe',
      '06 39 98 12 34',
      'lefive-montrivage.fr',
    ]));
  });

  it('« Itinéraire », « Appeler », le site : les applications du téléphone', async () => {
    const arbre = await monter();
    await appuyer(arbre, 'Infos');
    await appuyer(arbre, 'Itinéraire');
    expect(mockCarte).toHaveBeenCalledWith({
      label: '12 allée des Sports, Montrivage', latitude: 48.8365, longitude: 1.484,
    });
    await appuyer(arbre, 'Appeler');
    expect(Linking.openURL).toHaveBeenCalledWith('tel:+33639981234');
    await appuyer(arbre, 'lefive-montrivage.fr');
    expect(Linking.openURL).toHaveBeenCalledWith('https://lefive-montrivage.fr');
  });
});

describe('E-P02 — les états', () => {
  it('chargement : la carte d’identité et les terrains en squelette', async () => {
    mockComplexe = { ...mockComplexe, data: undefined, isLoading: true };
    expect(parRepere(await monter(), 'reserver-complexe-squelette')).not.toBeNull();
  });

  it('erreur : « Réessayer » relit', async () => {
    mockComplexe = { ...mockComplexe, data: undefined, error: { message: 'x', status: 500 } };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger ce complexe.');
    await appuyer(arbre, 'Réessayer');
    expect(relireLeComplexe).toHaveBeenCalled();
  });

  it('retiré ou suspendu : « plus sur FoundClub », et « Réserver ailleurs »', async () => {
    mockComplexe = {
      ...mockComplexe,
      data: undefined,
      error: { details: { code: 'COMPLEXE_NOT_FOUND' }, status: 404 },
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Ce complexe n’est plus sur FoundClub.');
    await appuyer(arbre, 'Réserver ailleurs');
    expect(mockVersLaRecherche).toHaveBeenCalledWith(expect.anything(), 'reservations');
  });

  it('aucun terrain réservable : la page s’affiche et le dit', async () => {
    mockTerrains = { data: [], error: null, isLoading: false };
    expect(lisibles(await monter()))
      .toContain('Ce complexe n’ouvre pas encore ses terrains à la réservation.');
  });

  it('l’aperçu du gérant : le bandeau et « Quitter »', async () => {
    mockParams = { apercu: true, slug: 'le-five-de-montrivage' };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Aperçu : c’est ce que voient les joueurs.');
    await appuyer(arbre, 'Quitter');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('sur ordinateur (OR2) : les infos et la colonne « Réserver », sans segments', async () => {
    mockOrdinateur = true;
    const vus = lisibles(await monter());
    expect(vus).toEqual(expect.arrayContaining([
      'Le complexe', 'Règles', 'Terrain 1', 'Réserver · aujourd’hui',
    ]));
    expect(vus).not.toContain('Infos');
  });
});
