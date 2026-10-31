import renderer, { act } from 'react-test-renderer';

import ReserverCreneau from '@/views/reserverTerrain/ReserverCreneau';

import { RouteNames } from '@/navigation/routeNames';

import {
  dessins, enUnMot, lisibles, parRepere, pressable,
} from '@/testSupport/temoinComplexe';
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
      jest.requireActual('@/testSupport/temoinReserver').terrainPublic(),
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

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-10-14T08:00:00Z') });
  jest.clearAllMocks();
  mockParams = { slug: 'le-five-de-montrivage', terrainId: 't-1' };
  mockCreneauxParJour = {
    '2026-10-14': jour('2026-10-14', [
      creneau('17:00', '18:00'),
      creneau('18:00', '19:00'),
      creneau('19:00', '20:00', 'pris'),
      creneau('21:00', '22:00', 'trop-tard'),
    ]),
    '2026-10-15': jour('2026-10-15', [
      creneau('17:00', '18:00', 'ferme'),
      creneau('18:00', '19:00', 'ferme'),
    ]),
  };
  mockApercu.mockResolvedValue(recapitulatif({ date: '2026-10-14' }));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('E-P03 — l’en-tête, les jours, les créneaux', () => {
  it('le terrain, le complexe et le sport ; 14 jours ; le jour en toutes lettres', async () => {
    const arbre = await monter();
    const vus = lisibles(arbre);
    expect(vus).toEqual(
      expect.arrayContaining([
        'TERRAIN 1',
        'Le Five de Montrivage · Foot à 5',
        'Auj.',
        'Mercredi 14 octobre',
      ]),
    );
    const jours = arbre.root
      .findAll(
        (/** @type {any} */ n) => String(n.props?.testID || '').startsWith('jour-')
          && typeof n.props?.onPress === 'function',
      )
      .map((/** @type {any} */ n) => n.props.testID);
    expect(new Set(jours).size).toBe(14);
  });

  it('chaque créneau dit son état ; « pris » ne se touche pas', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(
      expect.arrayContaining([
        '17 h – 18 h',
        'Libre',
        '19 h – 20 h',
        'Pris',
        '21 h – 22 h',
        'Trop tard ici',
      ]),
    );
    expect(parRepere(arbre, 'creneau-19:00').props.disabled).toBe(true);
  });

  it('le prix indicatif et le rappel du mode', async () => {
    const vus = lisibles(await monter());
    expect(vus).toContain('60 € le créneau, à régler sur place');
    expect(vus).toContain('Confirmation immédiate');
  });

  it('choisir un créneau : « Choisi », et le pied avec le jour et « Continuer »', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).not.toContain('Continuer');
    await toucher(parRepere(arbre, 'creneau-18:00'));
    expect(lisibles(arbre)).toEqual(
      expect.arrayContaining(['Choisi', 'Mercredi 14/10 · 18 h – 19 h', 'Continuer']),
    );
  });

  it('le créneau donné par la page ou la recherche est déjà choisi', async () => {
    mockParams = { ...mockParams, date: '2026-10-14', from: '17:00' };
    expect(lisibles(await monter())).toContain('Mercredi 14/10 · 17 h – 18 h');
  });

  it('un jour tout fermé le dit au lieu de ses créneaux', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'jour-2026-10-15'));
    expect(lisibles(arbre)).toContain('Fermé ce jour-là : le complexe a fermé ce terrain.');
  });

  it('un jour sans aucun créneau : le dire, et proposer le jour suivant', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'jour-2026-10-16'));
    expect(lisibles(arbre)).toContain('Aucun créneau libre ce jour-là.');
    await toucher(pressable(arbre, 'Voir le jour suivant'));
    expect(lisibles(arbre)).toContain('Samedi 17 octobre');
  });

  it('« Trop tard ici » ouvre la feuille d’appel', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'creneau-21:00'));
    expect(lisibles(arbre)).toEqual(
      expect.arrayContaining(['Trop tard pour réserver dans l’app', 'Appeler le 06 39 98 12 34']),
    );
  });
});

describe('E-P03 — « Continuer » demande le récapitulatif au serveur', () => {
  it('accepté : le récapitulatif (E-P04), avec la réponse du serveur', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'creneau-18:00'));
    await toucher(pressable(arbre, 'Continuer'));
    expect(mockApercu).toHaveBeenCalledWith({ date: '2026-10-14', from: '18:00', terrain: 't-1' });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverRecapitulatif, {
      apercu: recapitulatif({ date: '2026-10-14' }),
      date: '2026-10-14',
      from: '18:00',
      slug: 'le-five-de-montrivage',
      terrainId: 't-1',
    });
  });

  it('pris entre-temps : le bandeau, le choix vidé, les créneaux relus', async () => {
    mockApercu.mockRejectedValue({
      details: { code: 'COMPLEXE_RESERVATION_SLOT_TAKEN' }, status: 409,
    });
    const arbre = await monter();
    await toucher(parRepere(arbre, 'creneau-18:00'));
    await toucher(pressable(arbre, 'Continuer'));
    const vus = lisibles(arbre);
    expect(vus).toContain('Ce créneau vient d’être pris. Choisis-en un autre.');
    expect(vus).not.toContain('Continuer');
    expect(mockRelire).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('âge, plafond, banni… : les messages d’échec (E-P13), avec la raison', async () => {
    const refus = {
      details: { code: 'COMPLEXE_RESERVATION_AGE', minAge: 16 },
      message: 'x',
      status: 403,
    };
    mockApercu.mockRejectedValue(refus);
    const arbre = await monter();
    await toucher(parRepere(arbre, 'creneau-18:00'));
    await toucher(pressable(arbre, 'Continuer'));
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.ReserverEchec, {
      complexe: 'Le Five de Montrivage',
      date: '2026-10-14',
      details: { code: 'COMPLEXE_RESERVATION_AGE', minAge: 16 },
      from: '18:00',
      message: 'x',
      slug: 'le-five-de-montrivage',
      telephone: '+33639981234',
      terrain: 'Terrain 1',
      terrainId: 't-1',
      to: '19:00',
      variante: 'age',
    });
  });

  it('sans réseau : rien n’est parti, on peut réessayer', async () => {
    mockApercu.mockRejectedValue({ code: 'ERR_NETWORK', message: 'Network Error' });
    const arbre = await monter();
    await toucher(parRepere(arbre, 'creneau-18:00'));
    await toucher(pressable(arbre, 'Continuer'));
    expect(lisibles(arbre)).toEqual(
      expect.arrayContaining(['La réservation n’est pas partie. Réessaie.', 'Continuer']),
    );
  });
});

describe('E-P03 — un terrain « par téléphone » et les états', () => {
  it('« par téléphone » : toucher un créneau ouvre l’appel, avec le créneau rappelé', async () => {
    mockParams = { slug: 'le-five-de-montrivage', terrainId: 't-padel' };
    mockCreneauxParJour['2026-10-14'] = jour('2026-10-14', [creneau('18:00', '19:30')], {
      bookingMode: 'telephone',
      documentId: 't-padel',
      name: 'Padel A',
      phone: { number: '+33639981234', text: 'Ce terrain ne peut être réservé que par appel au' },
    });
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Par téléphone : touche un créneau');
    await toucher(parRepere(arbre, 'creneau-18:00'));
    expect(lisibles(arbre)).toEqual(
      expect.arrayContaining([
        'Padel A · Mercredi 14 octobre',
        '18 h – 19 h 30',
        'Appeler le 06 39 98 12 34',
      ]),
    );
    expect(mockApercu).not.toHaveBeenCalled();
  });

  it('chargement : les créneaux en squelette', async () => {
    mockCreneauxParJour['2026-10-14'] = { data: undefined, isLoading: true, refetch: mockRelire };
    expect(parRepere(await monter(), 'reserver-creneau-squelette')).not.toBeNull();
  });

  it('erreur : « Réessayer » relit', async () => {
    mockCreneauxParJour['2026-10-14'] = {
      data: undefined,
      error: { status: 500 },
      isLoading: false,
      refetch: mockRelire,
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger les créneaux.');
    await toucher(pressable(arbre, 'Réessayer'));
    expect(mockRelire).toHaveBeenCalled();
  });
});

// RESA-FIN-APP (20/10/2026) — tournée 2 (Android 16) : le bouton s'affichait « Voir le jour » (son dernier mot
// passait sur une ligne invisible : bouton qui épouse son libellé). Dessiné en un seul mot.
describe('RESA-FIN-APP (1) E-P03 — « Voir le jour suivant » dessiné en un seul mot', () => {
  it('un jour sans créneau : le bouton garde « suivant »', async () => {
    const arbre = await monter();
    await toucher(parRepere(arbre, 'jour-2026-10-16'));
    expect(dessins(arbre, 'Voir le jour suivant')).toEqual([enUnMot('Voir le jour suivant')]);
  });
});
