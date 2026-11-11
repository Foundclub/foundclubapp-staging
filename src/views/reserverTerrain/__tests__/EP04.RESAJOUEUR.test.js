import renderer, { act } from 'react-test-renderer';

import ReserverRecapitulatif from '@/views/reserverTerrain/ReserverRecapitulatif';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';
import { maReservation, recapitulatif } from '@/testSupport/temoinReserver';

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockGoBack = jest.fn();
let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, replace: mockReplace }),
  useRoute: () => ({ params: mockParams }),
}));

const mockReserver = jest.fn();
const mockApercu = jest.fn();
const mockPublier = jest.fn();
let mockReservationEnCours = false;
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useApercuDeReservation: () => ({ isPending: false, mutateAsync: mockApercu }),
  // RESA-L6B-2 : l'âge minimum du bandeau « Pour mon équipe » (témoin EP04.pourQuiCollecte).
  useComplexePublic: () => ({ data: null }),
  usePublierUneAnnonce: () => ({ isPending: false, mutateAsync: mockPublier }),
  useReserverUnCreneau: () => ({ isPending: mockReservationEnCours, mutateAsync: mockReserver }),
}));

let mockNaissance = /** @type {string | null} */ ('1990-05-02');
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { birthdate: mockNaissance, documentId: 'u-1' } }),
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
 * Le bouton dont le titre est EXACTEMENT celui-ci (RESA-L6B-2 : « Réserver seulement quand assez
 * de joueurs ont répondu présent » contient aussi « Réserver »).
 * @param {any} arbre - L'arbre.
 * @param {string} titre - Le titre.
 * @returns {any} Le bouton ; lève une erreur s'il n'existe pas.
 */
const bouton = (arbre, titre) => {
  const trouves = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.title === titre && typeof noeud.props?.onPress === 'function'
  ));
  if (!trouves.length) throw new Error(`Aucun bouton « ${titre} »`);
  return trouves[0];
};

/**
 * Appuie sur un nœud.
 * @param {any} noeud - Le nœud.
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

beforeEach(() => {
  jest.clearAllMocks();
  mockNaissance = '1990-05-02';
  mockReservationEnCours = false;
  mockParams = {
    apercu: recapitulatif(),
    date: '2026-10-16',
    from: '18:00',
    slug: 'le-five-de-montrivage',
    terrainId: 't-1',
  };
  mockReserver.mockResolvedValue(maReservation());
  mockApercu.mockResolvedValue(recapitulatif());
});

// RESA-JOUEUR (11/11/2026) — maquette validée par Adel le 10/11 (« 232- ok »), D50 : le joueur ne
// choisit plus un nombre de joueurs et ne coche plus « Réserver seulement quand assez de joueurs… »
// (Adel : « ce n'est pas au joueur de cocher ça »). « Ton groupe » dit le nombre fixé par le
// complexe ; « On a assez de joueurs » réserve ; « Il nous manque des joueurs » + « On est combien,
// toi compris ? » crée la réservation EN CONSTRUCTION (la collecte du serveur) et publie l'annonce.
// Ce que paie le groupe est écrit avant le bouton.

describe('RESA-JOUEUR — « Ton groupe »', () => {
  it('le nombre fixé par le complexe, deux choix ; plus de compteur ni de case', async () => {
    const vus = lisibles(await monter());
    expect(vus).toEqual(expect.arrayContaining([
      'Ton groupe',
      'Ce terrain se réserve pour 10 joueurs.',
      'Nombre fixé par le complexe.',
      'On a assez de joueurs',
      'Il nous manque des joueurs',
    ]));
    expect(vus).not.toContain('Combien de joueurs ?');
    expect(vus.join(' ')).not.toContain('Réserver seulement quand assez de joueurs');
  });

  it('au complet : ce que paie le groupe, l’avertissement, « Réserver » pour 10', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toContain(
      'Le groupe paie le créneau : 60 €, à régler sur place, même si vous '
        + 'êtes moins nombreux le jour J.',
    );
    expect(vus).toContain(
      'Si ton groupe ne vient pas, tu pourras être banni de ce complexe, et '
        + 'FoundClub peut suspendre ton compte.',
    );
    await toucher(bouton(arbre, 'Réserver'));
    expect(mockReserver).toHaveBeenCalledWith(expect.objectContaining({ players: 10 }));
    expect(mockReserver.mock.calls[0][0]).not.toHaveProperty('quorum');
  });

  it('prix par joueur : « Le groupe paie pour 10 joueurs : 60 € »', async () => {
    mockParams.apercu = recapitulatif({ price: { amount: 6, perPlayer: 6, unit: 'joueur' } });
    expect(lisibles(await monter())).toContain(
      'Le groupe paie pour 10 joueurs : 60 €, à régler sur place, même si '
        + 'vous êtes moins nombreux le jour J.',
    );
  });

  it('il en manque : « On est combien », le bandeau, la construction et l’annonce', async () => {
    mockApercu.mockResolvedValue(recapitulatif({
      collecte: { collectDeadline: 'x', latestDeadline: '2099-10-15T16:00:00.000Z', quorum: 10 },
      willBe: 'en_collecte',
    }));
    mockReserver.mockResolvedValue(
      maReservation({ documentId: 'r-construction', status: 'en_collecte' }),
    );
    mockPublier.mockResolvedValue({ documentId: 'an-1' });
    const arbre = await monter();
    await toucher(parRepere(arbre, 'groupe-manque'));
    expect(lisibles(arbre)).toContain('On est combien, toi compris ?');
    for (let fois = 0; fois < 5; fois += 1) {
      // eslint-disable-next-line no-await-in-loop
      await toucher(pressable(arbre, 'Un joueur de plus'));
    }
    const vus = lisibles(arbre);
    expect(vus).toEqual(expect.arrayContaining([
      'Il manque 4 joueurs.',
      'Ta réservation sera créée « en construction ».',
      'Tant que ce n’est pas confirmé, un autre groupe peut prendre ce créneau.',
    ]));
    await toucher(bouton(arbre, 'Réserver et publier l’annonce'));
    expect(mockApercu).toHaveBeenCalledWith(
      expect.objectContaining({ externalPlayers: 5, quorum: 10 }),
    );
    expect(mockReserver).toHaveBeenCalledWith(expect.objectContaining({
      collectDeadline: '2099-10-15T16:00:00.000Z', externalPlayers: 5, players: 10, quorum: 10,
    }));
    expect(mockPublier).toHaveBeenCalledWith({
      annonce: { notifyFavorites: true, places: 4 }, reservationId: 'r-construction',
    });
    expect(mockReplace).toHaveBeenCalledWith(RouteNames.ReserverResultat, expect.objectContaining({
      collecte: { collectDeadline: '2099-10-15T16:00:00.000Z', presents: 6, quorum: 10 },
      reservationId: 'r-construction',
    }));
  });
});
