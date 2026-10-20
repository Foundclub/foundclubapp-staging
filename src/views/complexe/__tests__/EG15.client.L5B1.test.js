import renderer, { act } from 'react-test-renderer';

import ComplexeClient from '@/views/complexe/ComplexeClient';

import { lisibles, parRepere } from '@/testSupport/temoinComplexe';

// RESA-L5B-1 (20/10/2026) — E-G15, LA FICHE D'UN CLIENT (planche EG15 états 2 à 5 ; plan
// :970-1010 ; RG-BAN ; serveur RESA-L2B : `GET /complexes/:id/clients/:joueurId`,
// `POST /complexes/:id/bannis` { joueur, reason, until?, cancelUpcoming? },
// `POST /complexes/:id/bannis/:joueurId/lever`). La liste des clients attend RESA-L4 : l'entrée est
// la fiche d'une réservation (E-G05, `joueurId`) ou la notification N-12 (`reservationId`).

let mockParams = /** @type {any} */ ({});
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

let mockClient = /** @type {any} */ ({});
let mockViaReservation = /** @type {any} */ ({});
/** @type {any[]} */
const mockLecturesReservation = [];
/** @type {any[]} */
const mockLecturesClient = [];
const mockBannir = jest.fn();
const mockDebannir = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useBannir: () => ({ isPending: false, mutateAsync: mockBannir }),
  useClientDuComplexe: (/** @type {any[]} */ ...args) => {
    mockLecturesClient.push(args);
    return mockClient;
  },
  // La lecture du gérant (`toManagedView`) range les règles sous `rules`.
  useComplexeGere: () => ({ data: { rules: { autoBanNoShows: 3 } } }),
  useDebannir: () => ({ isPending: false, mutateAsync: mockDebannir }),
  useReservationGeree: (/** @type {any[]} */ ...args) => {
    mockLecturesReservation.push(args);
    return mockViaReservation;
  },
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
jest.mock('@/components/molecules/datePickerInput/DatePickerInput', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseDate(/** @type {any} */ { label, onChange, value }) {
    return <Saisie accessibilityLabel={label} onChangeText={onChange} value={value} />;
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
 * La fiche d'un client telle que le serveur la rend (`clientView`, RESA-L2B) : jamais un numéro.
 * @param {Record<string, any>} [autres] - Ce qui change.
 * @returns {Record<string, any>} Le client.
 */
const client = (autres = {}) => ({
  ban: null,
  documentId: 'u-julien',
  firstname: 'Julien',
  lastname: 'Marchal',
  lateCancellations: 0,
  noShows: 1,
  upcoming: 2,
  ...autres,
});

/** Le libellé du champ « Raison » de la feuille « Bannir ». */
const RAISON = 'Raison (privée, jamais montrée à Julien)';

const BAN_AUTO = {
  documentId: 'b-1',
  origin: 'automatique',
  reason: '3 réservations non honorées',
  since: '2026-10-14T07:30:00.000Z',
  until: null,
};

const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeClient />);
  });
  return arbre;
};

const appuyerDans = async (/** @type {any} */ arbre, /** @type {string} */ testID) => {
  const cible = parRepere(arbre, testID)
    .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
  await act(async () => {
    cible.props.onPress();
  });
};

const saisir = async (/** @type {any} */ arbre, /** @type {string} */ libelle, texte) => {
  const champ = arbre.root.findAll((/** @type {any} */ n) => (
    n.props?.accessibilityLabel === libelle && n.props?.onChangeText
  ))[0];
  await act(async () => {
    champ.props.onChangeText(texte);
  });
};

/**
 * Le bouton de confirmation d'une feuille (le Button dans son repère).
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère.
 * @returns {any} Le bouton.
 */
const bouton = (arbre, testID) => parRepere(arbre, testID)
  .findAll((/** @type {any} */ n) => (
    typeof n.props?.onPress === 'function' && 'disabled' in n.props
  ))[0];

beforeEach(() => {
  jest.clearAllMocks();
  mockLecturesReservation.length = 0;
  mockLecturesClient.length = 0;
  mockParams = { complexeId: 'cx-five', joueurId: 'u-julien' };
  mockClient = { data: client(), isLoading: false, refetch: jest.fn() };
  mockViaReservation = { data: undefined, isLoading: false };
  mockBannir.mockResolvedValue({ data: client({ ban: { ...BAN_AUTO, origin: 'manuel' } }) });
  mockDebannir.mockResolvedValue({ data: client() });
});

describe('RESA-L5B-1 E-G15 — un client non banni (état 2)', () => {
  it('l’identité, ses chiffres ICI, « Non banni » et « Bannir »', async () => {
    const arbre = await monter();
    const lus = lisibles(arbre);
    const ordre = [
      'JM',
      'Julien Marchal',
      '1',
      'non honorée',
      '0',
      'annulation hors délai',
      '2',
      'réservations à venir',
      'BANNISSEMENT',
      'Non banni',
      'Bannissement automatique au bout de 3 non honorées.',
      'Bannir',
    ].map((texte) => lus.indexOf(texte));
    expect(ordre.every((index) => index > -1)).toBe(true);
    expect([...ordre].sort((a, b) => a - b)).toEqual(ordre);
    expect(parRepere(arbre, 'client-pastille-banni')).toBeNull();
    // Le joueur, jamais lu par la réservation quand il est connu.
    expect(mockLecturesReservation.every(([cx, r]) => cx === null && r === null)).toBe(true);
    expect(mockLecturesClient[0]).toEqual(['cx-five', 'u-julien']);
  });
});

describe('RESA-L5B-1 E-G15 — la feuille « Bannir » (état 3)', () => {
  it('raison PRIVÉE obligatoire, fin facultative, case décochée, puis le geste', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'client-bannir');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Bannir Julien M.',
      'Il ne pourra plus réserver chez toi. Rien ne change ailleurs.',
      'Annuler aussi ses 2 réservations à venir',
    ]));
    expect(bouton(arbre, 'feuille-bannir-confirmer').props.disabled).toBe(true);
    const caseAVenir = parRepere(arbre, 'feuille-bannir-annuler-a-venir');
    expect(caseAVenir.props.accessibilityState).toEqual({ checked: false });
    await saisir(arbre, RAISON, '  Comportement   au comptoir ');
    await saisir(arbre, 'Jusqu’au (facultatif)', '30/11/2026');
    await act(async () => {
      parRepere(arbre, 'feuille-bannir-annuler-a-venir').props.onPress();
    });
    expect(bouton(arbre, 'feuille-bannir-confirmer').props.disabled).toBe(false);
    await act(async () => {
      bouton(arbre, 'feuille-bannir-confirmer').props.onPress();
    });
    expect(mockBannir).toHaveBeenCalledWith({
      ban: {
        cancelUpcoming: true,
        joueur: 'u-julien',
        reason: 'Comportement au comptoir',
        until: '2026-11-30',
      },
      complexeId: 'cx-five',
    });
    expect(parRepere(arbre, 'feuille-bannir')).toBeNull();
    expect(lisibles(arbre)).toContain('Julien M. ne peut plus réserver chez toi.');
  });

  it('sans fin ni case : la raison et le joueur seulement', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'client-bannir');
    await saisir(arbre, RAISON, 'Retards répétés');
    await act(async () => {
      bouton(arbre, 'feuille-bannir-confirmer').props.onPress();
    });
    expect(mockBannir).toHaveBeenCalledWith({
      ban: { joueur: 'u-julien', reason: 'Retards répétés' }, complexeId: 'cx-five',
    });
  });

  it('un refus du serveur reste dans la feuille', async () => {
    mockBannir.mockRejectedValueOnce({
      details: { code: 'COMPLEXE_RESERVATION_STATE' },
      message: 'Ce joueur est déjà banni.',
      status: 409,
    });
    const arbre = await monter();
    await appuyerDans(arbre, 'client-bannir');
    await saisir(arbre, RAISON, 'Retards');
    await act(async () => {
      bouton(arbre, 'feuille-bannir-confirmer').props.onPress();
    });
    expect(parRepere(arbre, 'feuille-bannir')).not.toBeNull();
    expect(lisibles(arbre)).toContain('Ce joueur est déjà banni.');
  });

  it('sans réservation à venir : pas de case', async () => {
    mockClient = { ...mockClient, data: client({ upcoming: 0 }) };
    const arbre = await monter();
    await appuyerDans(arbre, 'client-bannir');
    expect(parRepere(arbre, 'feuille-bannir-annuler-a-venir')).toBeNull();
  });
});

describe('RESA-L5B-1 E-G15 — un client banni (états 4 et 5)', () => {
  it('automatique : la pastille, l’état, ce que le joueur lit, puis « Débannir »', async () => {
    mockClient = { ...mockClient, data: client({ ban: BAN_AUTO, noShows: 3 }) };
    const arbre = await monter();
    expect(parRepere(arbre, 'client-pastille-banni')).not.toBeNull();
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Banni',
      'Banni depuis le 14/10 · automatique : 3 réservations non honorées',
      'Julien M. ne peut plus réserver chez toi.',
      'Julien lit seulement « Tu ne peux plus réserver dans ce complexe. »',
    ]));
    expect(lisibles(arbre)).not.toContain('Bannissement automatique au bout de 3 non honorées.');
    await appuyerDans(arbre, 'client-debannir');
    expect(lisibles(arbre)).toEqual(expect.arrayContaining([
      'Débannir Julien M. ?', 'Julien M. pourra à nouveau réserver chez toi.',
    ]));
    await appuyerDans(arbre, 'feuille-debannir-confirmer');
    expect(mockDebannir).toHaveBeenCalledWith({ complexeId: 'cx-five', joueurId: 'u-julien' });
    expect(lisibles(arbre)).toContain('Julien M. peut à nouveau réserver.');
  });

  it('à la main, avec une fin : « Banni jusqu’au 30/11 · raison privée : … »', async () => {
    mockClient = {
      ...mockClient,
      data: client({
        ban: {
          ...BAN_AUTO, origin: 'manuel', reason: 'Comportement au comptoir', until: '2026-11-30',
        },
      }),
    };
    const arbre = await monter();
    expect(lisibles(arbre))
      .toContain('Banni jusqu’au 30/11 · raison privée : Comportement au comptoir');
  });
});

describe('RESA-L5B-1 E-G15 — l’entrée par N-12 (le joueur lu dans la réservation)', () => {
  it('sans joueur dans l’adresse : la fiche de la réservation donne le joueur', async () => {
    mockParams = { complexeId: 'cx-five', reservationId: 'r-1' };
    mockViaReservation = {
      data: { booker: { documentId: 'u-julien', firstname: 'Julien' } }, isLoading: false,
    };
    await monter();
    expect(mockLecturesReservation[0]).toEqual(['cx-five', 'r-1']);
    expect(mockLecturesClient[mockLecturesClient.length - 1]).toEqual(['cx-five', 'u-julien']);
  });
});

describe('RESA-L5B-1 E-G15 — chargement, jamais venu, panne', () => {
  it('chargement : le squelette', async () => {
    mockClient = { data: undefined, isLoading: true };
    const arbre = await monter();
    expect(parRepere(arbre, 'client-squelette')).not.toBeNull();
  });

  it('404 : « Ce joueur n’a jamais réservé chez toi. », sans « Réessayer »', async () => {
    mockClient = {
      data: undefined,
      error: { details: { code: 'COMPLEXE_CLIENT_NOT_FOUND' }, status: 404 },
      isLoading: false,
      refetch: jest.fn(),
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Ce joueur n’a jamais réservé chez toi.');
    expect(lisibles(arbre)).not.toContain('Réessayer');
  });

  it('panne : « Réessayer » relit', async () => {
    const refetch = jest.fn();
    mockClient = {
      data: undefined, error: new Error('boum'), isLoading: false, refetch,
    };
    const arbre = await monter();
    expect(lisibles(arbre)).toContain('Impossible de charger la fiche du client.');
    const reessayer = arbre.root.findAll((/** @type {any} */ n) => (
      n.props?.title === 'Réessayer' && typeof n.props?.onPress === 'function'
    ))[0];
    await act(async () => {
      reessayer.props.onPress();
    });
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
