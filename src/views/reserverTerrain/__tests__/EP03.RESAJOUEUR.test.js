import renderer, { act } from 'react-test-renderer';

import ReserverCreneau from '@/views/reserverTerrain/ReserverCreneau';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';
import { creneau, recapitulatif } from '@/testSupport/temoinReserver';

// RESA-L6A (14/10/2026) — E-P03 « Choisir un créneau » (planche EP03, P00 bloc 3 ; plan E-P03) :
// l'en-tête du terrain, la bande de 14 jours, les créneaux du jour (libre, choisi, pris, trop tard
// ici, fermé), le prix indicatif, le rappel du mode, le pied « Continuer ». « Continuer » demande
// au serveur le récapitulatif (`dryRun`, mêmes contrôles que réserver) : accepté ⇒ E-P04 ; créneau
// pris entre-temps ⇒ bandeau, choix vidé ; trop tard ⇒ la feuille d'appel ; par téléphone ⇒ E-P06 ;
// âge, plafond, banni… ⇒ E-P13 avec la raison.

const mockNavigate = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: mockParams }),
}));

let mockPhotos = /** @type {string[]} */ ([]);
let mockCreneauxParJour = /** @type {Record<string, any>} */ ({});
const mockRelire = jest.fn();
const mockApercu = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useApercuDeReservation: () => ({ isPending: false, mutateAsync: mockApercu }),
  useComplexePublic: () => ({
    data: jest.requireActual('@/testSupport/temoinReserver').complexePublic(),
  }),
  useCreneauxDuJour: (
    /** @type {any} */ _slug,
    /** @type {any} */ _terrain,
    /** @type {string} */ date,
  ) => mockCreneauxParJour[date] || {
    data: { date, slots: [] }, isLoading: false, refetch: mockRelire,
  },
  useTerrainsPublics: () => ({
    data: [
      jest.requireActual('@/testSupport/temoinReserver').terrainPublic({ photos: mockPhotos }),
      jest.requireActual('@/testSupport/temoinReserver').terrainPublic({
        bookingMode: 'telephone',
        documentId: 't-padel',
        name: 'Padel A',
        phone: { number: '+33639981234', text: 'Ce terrain ne peut être réservé que par appel au' },
        sport: { documentId: 'a-padel', name: 'Padel' },
      }),
    ],
  }),
}));

jest.mock('@/responsive', () => ({ useIsDesktop: () => false }));
// CORR-RESA (78 A) : l'écran lit le compte (l'âge) ; un adulte ici.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: '1990-01-01', documentId: 'u-1' } }),
}));
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  },
);
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
 * Les créneaux d'un jour, comme la route publique les rend.
 * @param {string} date - Le jour.
 * @param {any[]} slots - Les créneaux.
 * @param {Record<string, any>} [terrain] - Le terrain de la réponse.
 * @returns {any} La lecture.
 */
const jour = (date, slots, terrain = {}) => ({
  data: {
    date,
    slots,
    terrain: {
      bookingMode: 'automatique',
      capacity: 10,
      documentId: 't-1',
      name: 'Terrain 1',
      phone: null,
      ...terrain,
    },
  },
  isLoading: false,
  refetch: mockRelire,
});

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ReserverCreneau />);
  });
  return arbre;
};

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud pressable.
 * @returns {Promise<void>} Fini.
 */
const toucher = async (noeud) => {
  await act(async () => {
    noeud.props.onPress();
  });
  await act(async () => {
    await Promise.resolve();
  });
};

// RESA-JOUEUR (11/11/2026) — maquette validée par Adel le 10/11 (« 232- ok », piste B choisie) :
// D48 « il manque les photos de l'installation et les cases des heures sont pas très UX/UI ».
// Les photos du terrain en tête (elles défilent, « 1 / N », un appui les ouvre en grand) ; les
// pastilles d'infos en haut ; une LIGNE par créneau (début et fin, prix, état), rangée par moment de
// la journée avec le nombre de libres ; le pied redit le créneau ET son prix ; un jour fermé donne
// le motif du complexe (le serveur l'envoie déjà : `closureLabel`).

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockParams = { slug: 'le-five-de-montrivage', terrainId: 't-1' };
  mockPhotos = ['https://cdn.test/t1-a.jpg', 'https://cdn.test/t1-b.jpg'];
  mockCreneauxParJour = {
    '2026-10-14': jour('2026-10-14', [
      creneau('15:00', '16:30'),
      creneau('16:30', '18:00', 'pris'),
      creneau('18:00', '19:30'),
      creneau('19:30', '21:00'),
    ]),
    '2026-10-15': jour('2026-10-15', [
      creneau('17:00', '18:00', 'ferme', { closureLabel: 'Travaux' }),
      creneau('18:00', '19:00', 'ferme', { closureLabel: 'Travaux' }),
    ]),
  };
  mockApercu.mockResolvedValue(recapitulatif({ date: '2026-10-14' }));
});

afterEach(() => {
  jest.useRealTimers();
});

const pleinEcran = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === 'creneau-photos-plein-ecran',
);

const photosVues = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => n.props?.source?.uri && typeof n.type !== 'string')
  .map((/** @type {any} */ n) => n.props.source.uri);

describe('RESA-JOUEUR — E-P03 : les photos du terrain', () => {
  it('les photos en tête, avec « 1 / 2 »', async () => {
    const arbre = await monter();
    expect(new Set(photosVues(arbre))).toEqual(new Set(mockPhotos));
    expect(lisibles(arbre)).toContain('1 / 2');
  });

  it('un appui ouvre les photos en grand, la croix ferme', async () => {
    const arbre = await monter();
    expect(pleinEcran(arbre)).toHaveLength(0);
    await toucher(parRepere(arbre, 'creneau-galerie-agrandir'));
    expect(pleinEcran(arbre).length).toBeGreaterThan(0);
    await toucher(parRepere(arbre, 'creneau-photos-fermer'));
    expect(pleinEcran(arbre)).toHaveLength(0);
  });

  it('sans photo : pas de galerie, l’écran commence aux infos', async () => {
    mockPhotos = [];
    const arbre = await monter();
    expect(arbre.root.findAll(
      (/** @type {any} */ n) => n.props?.testID === 'creneau-galerie',
    )).toHaveLength(0);
    expect(lisibles(arbre)).toContain('TERRAIN 1');
  });
});

describe('RESA-JOUEUR — E-P03 : les infos et les créneaux (piste B)', () => {
  it('les pastilles : lieu, joueurs, mode', async () => {
    const vus = lisibles(await monter());
    expect(vus).toEqual(
      expect.arrayContaining(['Extérieur', '10 joueurs', 'Confirmation immédiate']),
    );
  });

  it('une ligne par créneau, rangées par moment, avec les libres', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toEqual(expect.arrayContaining([
      'Après-midi', '1 libre', 'Soir', '2 libres',
      '15 h – 16 h 30', '16 h 30 – 18 h', '18 h – 19 h 30', '60 €', 'Libre', 'Pris',
    ]));
    // L'ordre : l'après-midi avant le soir.
    expect(vus.indexOf('Après-midi')).toBeLessThan(vus.indexOf('Soir'));
    expect(vus.indexOf('15 h – 16 h 30')).toBeLessThan(vus.indexOf('Soir'));
  });

  it('le pied redit le créneau entier et son prix', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'creneau-19:30'));
    const vus = lisibles(arbre);
    expect(vus).toContain('Mercredi 14/10 · 19 h 30 – 21 h');
    expect(vus).toContain('60 € le créneau');
    expect(vus).toContain('Continuer');
  });

  it('un jour fermé donne le motif du complexe', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'jour-2026-10-15'));
    expect(lisibles(arbre)).toContain('Fermé ce jour-là : Travaux');
  });
});
