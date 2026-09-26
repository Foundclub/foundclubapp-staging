import { Alert, Linking } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import PlayerConvocationScreen from '../PlayerConvocationScreen';

// CONVOC (demande d'Adel du 26/09) — LE LIEU DE « TU ES CONVOQUE » S'OUVRE DANS LE GPS.
//
// « Sur le lieu, dans la messagerie, quand je vois le lieu d'une convocation, ce
// serait bien qu'on puisse l'ouvrir dans le GPS, comme sur les evenements
// classiques. Et pouvoir choisir l'application : Waze, Maps, ou l'application
// native, Plans. »
//
// Jest tourne en iOS (preset react-native) : Plans est toujours propose, Google
// Maps et Waze le sont quand ils repondent a leur schema.

const mockNavigation = { goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() };

/** @type {any} */
let mockEvent;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: { eventId: 'evt-1', teamId: 'team-1' } }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

const mockAuth = { userData: { documentId: 'joueur-1' } };
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

const mockConvocation = {
  branches: [{
    published: {
      reservePlayerIds: [],
      snapshotPlayers: [{ documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla' }],
      sportContext: 'football',
      teams: [{
        id: 'team_1',
        placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 90 }],
      }],
    },
    responses: { byPlayerId: { 'joueur-1': 'pending' } },
    team: { documentId: 'team-1', name: 'Senior 1' },
  }],
  event: { documentId: 'evt-1', name: 'Match' },
};

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: () => ({ data: mockEvent }),
  useGetEventConvocation: () => ({ data: mockConvocation, isError: false, isLoading: false }),
}));

jest.mock('@/services/event/eventService', () => ({
  respondToEventRsvp: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: { arrowLeft: 1, chevronLeft: 1 },
    Spaces: espaces,
  };

  return { __esModule: true, default: () => theme };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/atoms/loader/Loader', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>CHARGEMENT</TexteRN> };
});

jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { name }) => <TexteRN>{`AVATAR:${name}`}</TexteRN>,
  };
});

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity accessibilityLabel={title} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

const ADRESSE = 'Stade de Pélissanne, 13330 Pélissanne';

/** Le lieu tel que le serveur le range : coordonnees dans `location`, adresse en JSON. */
const EVENEMENT_AVEC_LIEU = {
  date: '2026-09-28T17:30:00.000Z',
  documentId: 'evt-1',
  location: { lat: 43.63, lng: 5.15 },
  locationDetails: JSON.stringify({ address: ADRESSE }),
  startTime: '19:30:00.000',
};

/** @type {any[]} */
let arbresOuverts = [];

const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<PlayerConvocationScreen />);
  });
  arbresOuverts.push(arbre);
  return arbre;
};

/**
 * Le bouton « Ouvrir dans le GPS » du lieu, s'il existe.
 * @param {any} arbre
 * @returns {any}
 */
const boutonGps = (arbre) => arbre.root.findAll((/** @type {any} */ noeud) => (
  noeud.props?.accessibilityRole === 'button'
  && typeof noeud.props?.onPress === 'function'
  && String(noeud.props?.accessibilityLabel || '').includes('Ouvrir dans le GPS')
))[0] || null;

/**
 * Appuie sur le lieu et laisse les sondes d'applis repondre.
 * @param {any} arbre
 * @returns {Promise<void>}
 */
const toucherLeLieu = async (arbre) => {
  await act(async () => {
    boutonGps(arbre).props.onPress();
    await new Promise((resoudre) => { setTimeout(resoudre, 0); });
  });
};

/** @type {jest.SpyInstance} */
let espionAlerte;
/** @type {jest.SpyInstance} */
let espionOuvrir;
/** @type {jest.SpyInstance} */
let espionSonde;

beforeEach(() => {
  // `Linking` est DEJA une doublure dans le preset Jest : `spyOn` la reutilise,
  // et ses appels passeraient d'un temoin a l'autre sans cette remise a zero.
  jest.clearAllMocks();
  mockEvent = { ...EVENEMENT_AVEC_LIEU };
  espionAlerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  espionOuvrir = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true));
  espionSonde = jest.spyOn(Linking, 'canOpenURL').mockImplementation(() => Promise.resolve(true));
});

afterEach(() => {
  arbresOuverts.forEach((arbre) => act(() => arbre.unmount()));
  arbresOuverts = [];
  jest.restoreAllMocks();
});

describe('CONVOC — le lieu de « Tu es convoqué » ouvre le GPS', () => {
  it('témoin 1 — le lieu est un bouton « Ouvrir dans le GPS »', () => {
    const arbre = rendre();

    expect(boutonGps(arbre)).not.toBeNull();
  });

  it('témoin 2 — toucher le lieu propose Plans, Google Maps et Waze installés', async () => {
    const arbre = rendre();
    await toucherLeLieu(arbre);

    expect(espionAlerte).toHaveBeenCalledTimes(1);
    const [titre, , boutons] = espionAlerte.mock.calls[0];
    expect(titre).toBe('Ouvrir le lieu avec');
    expect(boutons.map((/** @type {any} */ bouton) => bouton.text))
      .toEqual(['Annuler', 'Plans', 'Google Maps', 'Waze']);
  });

  it('témoin 3 — choisir Waze ouvre Waze sur le point du lieu', async () => {
    const arbre = rendre();
    await toucherLeLieu(arbre);

    const [, , boutons] = espionAlerte.mock.calls[0];
    await act(async () => {
      boutons.find((/** @type {any} */ bouton) => bouton.text === 'Waze').onPress();
    });

    expect(espionOuvrir).toHaveBeenCalledWith('waze://?ll=43.63,5.15&navigate=yes');
  });

  it('témoin 4 — seul Plans est là : il s’ouvre directement, sans question', async () => {
    espionSonde.mockImplementation(() => Promise.resolve(false));
    const arbre = rendre();
    await toucherLeLieu(arbre);

    expect(espionAlerte).not.toHaveBeenCalled();
    expect(espionOuvrir).toHaveBeenCalledWith(
      `https://maps.apple.com/?ll=43.63,5.15&q=${encodeURIComponent(ADRESSE)}`,
    );
  });

  it('témoin 5 — sans lieu, aucun bouton GPS', () => {
    mockEvent = { date: '2026-09-28T17:30:00.000Z', documentId: 'evt-1' };
    const arbre = rendre();

    expect(boutonGps(arbre)).toBeNull();
  });
});
