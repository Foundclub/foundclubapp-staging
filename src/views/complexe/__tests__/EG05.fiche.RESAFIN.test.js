import renderer, { act } from 'react-test-renderer';

import ComplexeReservation from '@/views/complexe/ComplexeReservation';

import { RouteNames } from '@/navigation/routeNames';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';



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
let mockFidelite = /** @type {any} */ ({ data: null, isLoading: false });
const mockValider = jest.fn();
const mockEcrire = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  // RESA-FIN-APP : la fidélité du complexe (RESA-L4) et « Valider » (E-G14).
  useFideliteDuComplexe: () => mockFidelite,
  useValiderRecompense: () => ({ isPending: false, mutateAsync: mockValider }),
  // RESA-L5B-1 : « non honorée » et le seuil du complexe (témoin EG05.nonHonoree.L5B1).
  useAnnulerNonHonoree: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useAnnulerReservation: () => ({ isPending: false, mutateAsync: mockAnnuler }),
  useComplexeChoisi: jest.requireActual('@/testSupport/temoinComplexe').complexeChoisiDeTemoin,
  useComplexeGere: () => ({ data: null }),
  useDeciderDemande: () => ({ isPending: false, mutateAsync: mockDecider }),
  // RESA-FIN-APP-3 : « Écrire au réserveur » (le chemin de « Écrire » de la fiche client, E-G15).
  useEcrireAuReserveur: () => ({ isPending: false, mutateAsync: mockEcrire }),
  useMarquerNonHonoree: () => ({ isPending: false, mutateAsync: jest.fn() }),
  useModifierExterieur: () => ({ isPending: false, mutateAsync: mockModifier }),
  // RESA-PARTAGER : « Partager dans mon canal » (témoin EG05.partager.RESAPARTAGER).
  usePartagerAnnonce: () => ({ isPending: false, mutateAsync: jest.fn() }),
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

// RESA-FIN-APP (20/10/2026) — LA FICHE D'UNE RÉSERVATION (E-G05), CE QUI RESTAIT :
//   (4) reste de RESA-L5B-2 : « Valider la partie offerte » depuis la fiche (plan E-G05 :542-551, :557-558) — la
//       pastille « Récompense disponible : 1 partie offerte » quand le RÉSERVEUR a atteint sa récompense (lue
//       dans `GET …/fidelite`, liste `aValider`, comme la fiche client le fait déjà), puis la confirmation
//       « Valider la partie offerte de Julien M. ? Son compteur repart à 0. » et le geste de E-G14 ;
//   (5) tournée 2 : une demande EXPIRÉE (409 « Cette demande a expiré. ») proposait « Refuser avec un mot »,
//       qui échouait à son tour (409) : le refus du serveur se dit, la fiche se relit, aucun geste voué à
//       l'échec n'est proposé. Le conflit « créneau pris » garde « Refuser avec un mot » (témoin d'origine).
describe('RESA-FIN-APP (4) E-G05 — « Valider la partie offerte » depuis la fiche', () => {
  beforeEach(() => {
    mockFiche = {
      ...mockFiche,
      data: fiche({ booker: { ...fiche().booker, documentId: 'u-julien' } }),
    };
    mockFidelite = {
      data: {
        aValider: [{
          count: 10,
          joueur: { documentId: 'u-julien', firstname: 'Julien', lastname: 'Marchal' },
          reachedAt: '2026-10-13T08:00:00.000Z',
          threshold: 10,
        }],
        bientot: [],
        dernieresValidees: [],
        programme: {
          active: true, counts: 'participants', reward: '1 partie offerte', threshold: 10,
        },
      },
      isLoading: false,
    };
    mockValider.mockResolvedValue({ data: { count: 0, threshold: 10 } });
  });

  it('la pastille, puis la confirmation, puis le geste de E-G14', async () => {
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Récompense disponible : 1 partie offerte');
    await appuyerDans(arbre, 'fiche-valider-recompense');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Valider la partie offerte de Julien M. ?', 'Son compteur repart à 0.',
    ]));
    await appuyerDans(arbre, 'fiche-valider-confirmer');
    expect(mockValider).toHaveBeenCalledWith({ complexeId: 'cx-five', joueurId: 'u-julien' });
    expect(lisibles(arbre)).toContain('Julien M. : validée.');
  });

  it('sans récompense atteinte : ni pastille, ni bouton', async () => {
    mockFidelite = { ...mockFidelite, data: { ...mockFidelite.data, aValider: [] } };
    const arbre = await monter();
    expect(lisibles(arbre).some((texte) => texte.startsWith('Récompense disponible'))).toBe(false);
    expect(parRepere(arbre, 'fiche-valider-recompense')).toBeNull();
  });
});

describe('RESA-FIN-APP (5) E-G05 — une demande expirée ne propose plus de geste voué à l’échec', () => {
  beforeEach(() => {
    mockFiche = {
      ...mockFiche,
      data: fiche({ expiresAt: '2026-10-14T13:10:00.000Z', status: 'en_attente' }),
    };
  });

  it('« Cette demande a expiré. » : le message, la fiche relue, ni « Accepter » ni « Refuser »', async () => {
    mockDecider.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_STATE' }, message: 'Cette demande a expiré.', status: 409,
    });
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-accepter');
    expect(lisibles(arbre)).toContain('Cette demande a expiré.');
    expect(mockFiche.refetch).toHaveBeenCalled();
    expect(parRepere(arbre, 'fiche-accepter')).toBeNull();
    expect(parRepere(arbre, 'fiche-refuser')).toBeNull();
  });
});

// RESA-FIN-APP-3 (23/10/2026, tournée 3 du site) — plan E-G05 :549 : une réservation Confirmée à
// venir propose « Écrire au réserveur » + « Annuler la réservation ». « Écrire » ouvre la
// conversation de la réservation par le même chemin que la fiche client (E-G15), dans l'espace du
// complexe.
describe('RESA-FIN-APP-3 E-G05 — « Écrire au réserveur »', () => {
  it('confirmée à venir, de l’app : « Écrire au réserveur », espace complexe', async () => {
    mockEcrire.mockResolvedValue({ data: { chat: 'chat-r-1' } });
    const arbre = await monter();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Écrire au réserveur', 'Annuler la réservation',
    ]));
    await appuyerDans(arbre, 'fiche-ecrire');
    expect(mockEcrire).toHaveBeenCalledWith({ complexeId: 'cx-five', reservationId: 'r-1' });
    expect(mockNavigate).toHaveBeenCalledWith(RouteNames.Conversation, {
      chatId: 'chat-r-1', espace: 'complexe',
    });
  });

  it('extérieure, en attente ou passée : pas de « Écrire au réserveur »', async () => {
    const cas = [
      { booker: null, externalName: 'M. Dupont', source: 'exterieur' },
      { status: 'en_attente' },
      { endsAt: '2026-10-12T18:00:00.000Z', startsAt: '2026-10-12T17:00:00.000Z' },
    ];
    const lus = await cas.reduce(async (avant, autres) => {
      const deja = await avant;
      mockFiche = { data: fiche(autres), isLoading: false, refetch: jest.fn() };
      return [...deja, lisibles(await monter())];
    }, Promise.resolve(/** @type {string[][]} */ ([])));
    lus.forEach((vus) => expect(vus).not.toContain('Écrire au réserveur'));
  });

  it('un refus du serveur se dit, sans ouvrir de conversation', async () => {
    mockEcrire.mockRejectedValue(new Error('refus'));
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-ecrire');
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(parRepere(arbre, 'fiche-ecrire-erreur')).not.toBeNull();
  });
});
