import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ReserverComplexe from '@/views/reserverTerrain/ReserverComplexe';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { complexePublic, creneau, terrainPublic } from '@/testSupport/temoinReserver';

// RESA-JOUEUR-2 (11/11/2026) — E-P02 de la maquette validée « 232- ok » (page du complexe, onglet
// « Réserver ») :
//   · les photos du complexe défilent en tête, avec « 1 / N » (avant : une seule photo de 112 px) ;
//   · la carte d'un terrain : sa photo passe à 150 px et dit « N photos » ;
//   · le prix de départ s'écrit « Dès 6 € par joueur » en tête de ligne ;
//   · 3 raccourcis au plus, l'heure de départ et son prix (avant : jusqu'à 6 puces), qui ouvrent
//     l'écran du terrain sur ce créneau.
// Sans changement : le badge, le cœur, les deux onglets, le bloc Règles, la feuille « Par
// téléphone », les vignettes de l'onglet « Infos ».

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
let mockParams = /** @type {any} */ ({ slug: 'le-five-de-montrivage' });
let mockAnnonces = /** @type {any[]} */ ([]);
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
  // RESA-JOUEUR (D51) : les annonces « Il manque des joueurs » de CE complexe.
  useAnnoncesOuvertes: (/** @type {any} */ lieu) => ({
    data: lieu?.complexe ? mockAnnonces : [],
  }),
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
  mockAnnonces = [];
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

describe('RESA-JOUEUR-2 E-P02 — la galerie du complexe', () => {
  it('ses photos défilent en tête, avec « 1 / 3 »', async () => {
    mockComplexe.data = complexePublic({
      photos: ['https://cdn.test/c-1.jpg', 'https://cdn.test/c-2.jpg', 'https://cdn.test/c-3.jpg'],
    });
    const arbre = await monter();
    expect(parRepere(arbre, 'complexe-galerie')).not.toBeNull();
    expect(lisibles(arbre)).toContain('1 / 3');
  });

  it('sans photo : pas de galerie, la bande de couleur reste', async () => {
    const arbre = await monter();
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'complexe-galerie'))
      .toHaveLength(0);
  });
});

describe('RESA-JOUEUR-2 E-P02 — la carte d’un terrain', () => {
  it('la photo à 150 px, « 5 photos »', async () => {
    mockTerrains.data = [terrainPublic({
      photos: [1, 2, 3, 4, 5].map((rang) => `https://cdn.test/t-${rang}.jpg`),
    })];
    const arbre = await monter();
    expect(parRepere(arbre, 'carte-terrain-photo-t-1').props.style)
      .toEqual(expect.objectContaining({ height: 150 }));
    expect(lisibles(arbre)).toContain('5 photos');
  });

  it('une seule photo : pas de compteur', async () => {
    mockTerrains.data = [terrainPublic({ photos: ['https://cdn.test/t-1.jpg'] })];
    const vus = lisibles(await monter());
    expect(vus.join(' ')).not.toMatch(/\d photos?/);
  });

  it('plusieurs prix : « Dès 6 € par joueur », en tête de ligne', async () => {
    mockTerrains.data = [terrainPublic({ price: { max: 8, min: 6, unit: 'joueur' } })];
    const vus = lisibles(await monter());
    expect(vus).toContain('Dès 6 € par joueur');
    expect(vus).not.toContain('dès 6 € par joueur');
  });

  it('3 raccourcis au plus : l’heure et son prix ; un raccourci ouvre ce créneau', async () => {
    mockTerrains.data = [terrainPublic()];
    mockCreneaux['t-1'] = {
      data: {
        slots: [
          creneau('17:00', '18:00'),
          creneau('18:00', '19:00'),
          creneau('19:00', '20:00', 'pris'),
          creneau('20:30', '21:30'),
          creneau('21:30', '22:30'),
        ],
      },
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Libres aujourd’hui',
      '17 h · 60 €',
      '18 h · 60 €',
      '20 h 30 · 60 €',
    ]));
    expect(arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.testID === 'terrain-t-1-creneau-21:30' && typeof n.props?.onPress === 'function'
    ))).toHaveLength(0);
    await act(async () => {
      parRepere(arbre, 'terrain-t-1-creneau-18:00').props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverCreneau, expect.objectContaining({
      from: '18:00', terrainId: 't-1',
    }));
  });

  it('un prix par joueur : le raccourci dit le prix par joueur', async () => {
    mockTerrains.data = [terrainPublic({ price: { max: 6, min: 6, unit: 'joueur' } })];
    mockCreneaux['t-1'] = {
      data: {
        slots: [creneau('18:00', '19:00', 'libre', {
          price: { amount: 6, perPlayer: 6, unit: 'joueur' },
        })],
      },
    };
    expect(lisibles(await monter())).toContain('18 h · 6 €');
  });
});
