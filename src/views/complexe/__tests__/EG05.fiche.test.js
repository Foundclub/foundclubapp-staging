import { Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeReservation from '@/views/complexe/ComplexeReservation';

import { lisibles, parRepere, pressable } from '@/testSupport/temoinComplexe';

// RESA-L5A2 (14/10/2026) — E-G05 « La fiche d'une réservation, côté gérant » (planche EG05) : quand
// et où, qui (le téléphone SEULEMENT s'il est accordé, D7), l'historique, et le pied selon l'état
// et la source : Accepter / Refuser (en attente), Annuler la réservation (motif obligatoire, N-18),
// Modifier le nom / Supprimer (extérieur). Doublure : `GET /complexes/:id/reservations/:id`
// (`toManagerView`, RESA-L2A).

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: mockNavigate }),
  useRoute: () => ({ params: { complexeId: 'cx-five', reservationId: 'r-1' } }),
}));

let mockFiche = /** @type {any} */ ({});
const mockDecider = jest.fn();
const mockAnnuler = jest.fn();
const mockModifier = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useAnnulerReservation: () => ({ isPending: false, mutateAsync: mockAnnuler }),
  useDeciderDemande: () => ({ isPending: false, mutateAsync: mockDecider }),
  useModifierExterieur: () => ({ isPending: false, mutateAsync: mockModifier }),
  useReservationGeree: () => mockFiche,
}));

jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
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
 * La fiche telle que le serveur la rend au gérant (`toManagerView`).
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} La fiche.
 */
const fiche = (autres = {}) => ({
  booker: {
    bookingsHere: 12, firstname: 'Julien', lastname: 'Marchal', phone: '+33639985678',
  },
  cancelledAt: null,
  cancelledBy: null,
  createdAt: '2026-10-12T19:04:00.000Z',
  date: '2026-10-16',
  decidedAt: null,
  documentId: 'r-1',
  endsAt: '2026-10-16T18:00:00.000Z',
  expiresAt: null,
  externalName: null,
  from: '19:00',
  history: [{ at: '2026-10-12T19:04:00.000Z', kind: 'reservee' }],
  note: 'Foot du jeudi',
  players: 10,
  price: { amount: 60, perPlayer: 6, unit: 'creneau' },
  reason: null,
  source: 'app',
  startsAt: '2026-10-16T17:00:00.000Z',
  status: 'confirmee',
  terrain: {
    documentId: 't-1', name: 'Terrain 1', sport: { documentId: 'a-five', name: 'Foot à 5' },
  },
  to: '20:00',
  ...autres,
});

/**
 * Monte la fiche.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeReservation />);
  });
  return arbre;
};

/**
 * Appuie sur le premier élément pressable DANS le repère.
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère du conteneur.
 * @returns {Promise<void>} Fini.
 */
const appuyerDans = async (arbre, testID) => {
  const noeud = parRepere(arbre, testID);
  const cible = noeud.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
  await act(async () => {
    cible.props.onPress();
  });
};

/**
 * Le bouton de confirmation de la feuille ouverte.
 * @param {any} arbre - L'arbre.
 * @param {string} titre - Son libellé.
 * @returns {any} Le bouton.
 */
const dansLaFeuille = (arbre, titre) => parRepere(arbre, 'feuille-motif')
  .findAll((/** @type {any} */ n) => (
    n.props?.title === titre && typeof n.props?.onPress === 'function'
  ))[0];

beforeAll(() => {
  jest.useFakeTimers({
    doNotFake: [
      'nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval',
      'setTimeout', 'clearTimeout', 'queueMicrotask', 'requestAnimationFrame',
      'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'performance',
      'hrtime',
    ],
    now: new Date('2026-10-14T08:00:00.000Z'),
  });
});

afterAll(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFiche = { data: fiche(), isLoading: false, refetch: jest.fn() };
  mockAnnuler.mockResolvedValue({ data: {} });
  mockDecider.mockResolvedValue({ data: {} });
  mockModifier.mockResolvedValue({ data: {} });
});

describe('RESA-L5A2 E-G05 — confirmée, à venir, source App (état 1)', () => {
  it('les blocs dans l’ordre : en-tête, quand-où, qui, historique', async () => {
    const arbre = await monter();
    const lus = lisibles(arbre);
    const ordre = [
      'RÉSERVATION',
      'App',
      'Confirmée',
      'Quand, où',
      'Vendredi 16 octobre · 19 h – 20 h',
      'Terrain 1 · Foot à 5 · 10 joueurs',
      '60 €, à régler sur place',
      '« Foot du jeudi »',
      'Qui',
      'Julien Marchal',
      '12 réservations ici',
      '06 39 98 56 78',
      'Historique',
      'Réservée le 12/10 à 21 h 04 dans l’app',
    ].map((texte) => lus.indexOf(texte));
    expect(ordre.every((index) => index > -1)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
  });

  it('« Appeler » compose le numéro accordé', async () => {
    const appel = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const arbre = await monter();
    await act(async () => {
      pressable(arbre, 'Appeler').props.onPress();
    });
    expect(appel).toHaveBeenCalledWith('tel:+33639985678');
    appel.mockRestore();
  });

  it('numéro non accordé : « Numéro non partagé », aucun bouton « Appeler » (D7)', async () => {
    mockFiche = { ...mockFiche, data: fiche({ booker: { ...fiche().booker, phone: null } }) };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Numéro non partagé');
    expect(() => pressable(arbre, 'Appeler')).toThrow();
  });

  it('« Annuler la réservation » : motif obligatoire, puis le geste (N-18)', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-annuler');
    expect(lisibles(arbre)).toContain('Annuler la réservation de Julien M. ?');
    expect(dansLaFeuille(arbre, 'Annuler la réservation').props.disabled).toBe(true);
    const champ = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Motif, que Julien M. lira' && n.props?.onChangeText
    ))[0];
    await act(async () => {
      champ.props.onChangeText('Terrain impraticable');
    });
    await act(async () => {
      dansLaFeuille(arbre, 'Annuler la réservation').props.onPress();
    });
    expect(mockAnnuler).toHaveBeenCalledWith({
      complexeId: 'cx-five', motif: 'Terrain impraticable', reservationId: 'r-1',
    });
    expect(lisibles(arbre)).toContain('Réservation annulée. Julien M. est prévenu.');
  });
});

describe('RESA-L5A2 E-G05 — en attente (états 2, 3, 8)', () => {
  beforeEach(() => {
    mockFiche = {
      ...mockFiche,
      data: fiche({
        booker: { ...fiche().booker, phone: null },
        expiresAt: '2026-10-14T13:10:00.000Z',
        status: 'en_attente',
      }),
    };
  });

  it('l’échéance, puis « Accepter » (N-14)', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Expire dans 5 h');
    await appuyerDans(arbre, 'fiche-accepter');
    expect(mockDecider).toHaveBeenCalledWith({
      complexeId: 'cx-five', decision: 'accepter', reservationId: 'r-1',
    });
    expect(lisibles(arbre)).toContain('Demande acceptée. Julien M. est prévenu.');
  });

  it('conflit à l’acceptation (409) : la fiche le dit, puis seulement « Refuser »', async () => {
    mockDecider.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_SLOT_TAKEN' }, message: 'pris', status: 409,
    });
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-accepter');
    expect(lisibles(arbre)).toContain('Ce créneau vient d’être pris.');
    expect(parRepere(arbre, 'fiche-accepter')).toBeNull();
    await appuyerDans(arbre, 'fiche-refuser');
    await appuyer(arbre, 'Fermeture');
    await act(async () => {
      dansLaFeuille(arbre, 'Refuser').props.onPress();
    });
    expect(mockDecider).toHaveBeenLastCalledWith({
      complexeId: 'cx-five', decision: 'refuser', reason: 'Fermeture', reservationId: 'r-1',
    });
  });
});

describe('RESA-L5A2 E-G05 — source Extérieur (état 4)', () => {
  beforeEach(() => {
    mockFiche = {
      ...mockFiche,
      data: fiche({
        booker: null,
        externalName: 'M. Dupont, téléphone',
        history: [{ at: '2026-10-13T08:12:00.000Z', kind: 'notee' }],
        note: null,
        players: null,
        price: null,
        source: 'exterieur',
      }),
    };
  });

  it('« Au nom de », la source seule, et « Notée par toi »', async () => {
    const arbre = await monter();
    const lus = lisibles(arbre);
    expect(lus).toEqual(expect.arrayContaining([
      'Extérieur', 'Au nom de : M. Dupont, téléphone', 'Notée par toi le 13/10 à 10 h 12',
    ]));
    expect(lus).not.toContain('Confirmée');
  });

  it('« Modifier le nom » puis « Supprimer » (le créneau redevient libre)', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-modifier-nom');
    const champ = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.accessibilityLabel === 'Au nom de' && n.props?.onChangeText
    ))[0];
    expect(champ.props.value).toBe('M. Dupont, téléphone');
    await act(async () => {
      champ.props.onChangeText('Mme Roux');
    });
    await appuyerDans(arbre, 'fiche-enregistrer-nom');
    expect(mockModifier).toHaveBeenCalledWith({
      complexeId: 'cx-five', nom: 'Mme Roux', reservationId: 'r-1',
    });
    await appuyerDans(arbre, 'fiche-supprimer');
    await appuyerDans(arbre, 'fiche-confirmer-suppression');
    expect(mockAnnuler)
      .toHaveBeenCalledWith({ complexeId: 'cx-five', motif: null, reservationId: 'r-1' });
  });
});

describe('RESA-L5A2 E-G05 — introuvable, chargement, erreur (état 10)', () => {
  it('404 : « Cette réservation n’existe plus. »', async () => {
    mockFiche = {
      data: undefined,
      error: { details: { code: 'COMPLEXE_RESERVATION_NOT_FOUND' }, status: 404 },
      isLoading: false,
      refetch: jest.fn(),
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Cette réservation n’existe plus.');
  });

  it('chargement : le squelette ; panne : « Réessayer » relit', async () => {
    mockFiche = { data: undefined, isLoading: true };
    let arbre = await monter();
    expect(parRepere(arbre, 'fiche-squelette')).not.toBeNull();
    const refetch = jest.fn();
    mockFiche = {
      data: undefined, error: new Error('boum'), isLoading: false, refetch,
    };
    arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger la réservation.');
    await appuyer(arbre, 'Réessayer');
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

/**
 * Appuie sur un élément par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
async function appuyer(arbre, libelle) {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
}
