import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// S8 (recette 2.6.27) — « Mon planning est trop long a charger ».
//
// 📏 Mesure du 25/08 : 3 a 7 s pour rendre 3-5 evenements, alors qu il n y en a
// que 54 en base. La cause principale est le serveur de recette (1 cœur, 1,2 Go)
// et elle n est PAS dans ce fichier. Ce lot-ci traite le versant application,
// et il ne traite que deux choses :
//
//   D5 — l ecran demandait au serveur TOUS les participants de CHAQUE evenement
//        pour n en lire qu un seul : le sien. Les deux configs portent desormais
//        `viewerDocumentId`, exactement comme le fait deja `EventListContent`
//        sur les MEMES cartes.
//   D6 — pendant l attente, l ecran disait « Mise a jour des evenements... » en
//        petit gris. On montre maintenant la FORME de ce qui arrive.
//
// ⚠️ CE QUE CE FICHIER NE PROUVE PAS : aucune duree. Il prouve ce que l ecran
// DEMANDE et ce qu il MONTRE. Le gain se constate en recette.

const mockUseGetEvents = jest.fn();

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canManageEvents: false,
    userData: { club: { documentId: 'club-1' }, documentId: 'user-1' },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvents: (/** @type {any} */ config, /** @type {any} */ options) => mockUseGetEvents(
    config,
    options,
  ),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(),
}));

jest.mock('@/services/reservation/reservationService', () => ({
  joinReservation: jest.fn(),
}));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingActionContainerStyle: () => ({}),
}));

// TOUTES les feuilles lourdes de cet ecran vivent derriere UN seul module
// differe : le doubler entierement suffit, et evite d en importer sept.
jest.mock('@/views/event/ParticipantEventListDeferred', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  const doublure = (/** @type {string} */ nom) => function Doublure() {
    return react.createElement(rn.Text, null, nom);
  };
  return {
    DateSlider: doublure('DOUBLURE_DateSlider'),
    EventCardNew: doublure('DOUBLURE_EventCardNew'),
    FeaturedEvents: doublure('DOUBLURE_FeaturedEvents'),
    JoinEventModal: doublure('DOUBLURE_JoinEventModal'),
    LeagueHeaderSwitch: doublure('DOUBLURE_LeagueHeaderSwitch'),
    NotificationBadge: doublure('DOUBLURE_NotificationBadge'),
    ProfileButton: doublure('DOUBLURE_ProfileButton'),
  };
});

/* eslint-disable global-require */
jest.mock(
  '@/views/event/PlanningOnboardingWrapper',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function PlanningOnboardingWrapperDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '@/components/templates/ScreenContainer',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function ScreenContainerDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '@/components/atoms/errorWrapper/ErrorWrapper',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function ErrorWrapperDouble(/** @type {any} */ props) {
      return react.createElement(rn.View, null, props.children);
    };
  },
);
jest.mock(
  '@/components/organisms/planning/PersonalPlanningContainer',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_PersonalPlanning'),
);
jest.mock(
  '@/components/atoms/emptyState/EmptyState',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_EmptyState'),
);
jest.mock(
  '@/components/atoms/webFloatingOverlay/WebFloatingOverlay',
  () => require('@/testSupport/textDouble').makeTextDouble('DOUBLURE_WebFloatingOverlay'),
);
/* eslint-enable global-require */

// eslint-disable-next-line import/first
import ParticipantEventList from '../ParticipantEventList';

jest.setTimeout(30000);

/** @type {any} */
let arbre = null;

const requeteVide = (/** @type {boolean} */ enChargement) => ({
  data: undefined,
  error: null,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isError: false,
  isFetchingNextPage: false,
  isLoading: enChargement,
  refetch: jest.fn(),
});

/**
 * Monte l ecran « Mon planning ».
 * @param {boolean} [enChargement] - Les deux flux sont-ils en cours de lecture ?
 * @returns {any} - La racine du rendu.
 */
const monter = (enChargement = true) => {
  mockUseGetEvents.mockImplementation(() => requeteVide(enChargement));

  act(() => {
    arbre = renderer.create(
      <ParticipantEventList
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: jest.fn(),
          setOptions: jest.fn(),
        }}
      />,
    );
  });

  return arbre.root;
};

/**
 * Tous les textes rendus a l ecran.
 * @param {any} racine - Racine du rendu.
 * @returns {string} - Les textes, colles.
 */
const texteDeLEcran = (racine) => {
  const morceaux = [];
  const parcourir = (/** @type {any} */ enfant) => {
    if (enfant === null || enfant === undefined || enfant === false) return;
    if (typeof enfant === 'string' || typeof enfant === 'number') {
      morceaux.push(String(enfant));
      return;
    }
    const enfants = enfant?.props?.children;
    if (Array.isArray(enfants)) enfants.forEach(parcourir);
    else parcourir(enfants);
  };
  racine.findAllByType(Text).forEach(parcourir);
  return morceaux.join(' ');
};

/**
 * Laisse partir les interactions differees.
 *
 * 🪤 SANS CA, L ECRAN RESTE FIGE AVANT SON PREMIER TIR : `shouldLoadEventFeed`
 * ne passe a vrai que dans un `InteractionManager.runAfterInteractions`. Un
 * temoin qui ne le lance pas ne mesure pas « en cours de chargement », il
 * mesure « pas encore commence » — deux etats differents qui rendent la meme
 * chose a l ecran, donc une confusion invisible.
 * @returns {Promise<void>} - Quand les interactions sont parties.
 */
const laisserPartirLesInteractions = async () => {
  await act(async () => {
    await new Promise((resoudre) => { setTimeout(resoudre, 0); });
  });
};

beforeEach(() => {
  mockUseGetEvents.mockClear();
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('S8 / D5 — l ecran ne demande plus que SA propre ligne', () => {
  // 🔑 CE QUI CHANGE COTE SERVEUR : sans `viewerDocumentId`, le populate compact
  // ramene `participations`, `missings` et `participationRequests` de TOUS les
  // participants, pour CHAQUE evenement de la page. Avec, le serveur filtre sur
  // le spectateur : au plus une ligne par evenement.
  // ⚠️ Ca change aussi la CLE de la requete : le premier affichage part donc
  // d un cache froid. C est normal, et ca ne se produit qu une fois.
  test('le flux principal porte le documentId du spectateur', () => {
    monter();

    const [configPrincipale] = mockUseGetEvents.mock.calls[0];

    expect(configPrincipale.viewerDocumentId).toBe('user-1');
  });

  test('et le flux « a la une » aussi', () => {
    monter();

    const configs = mockUseGetEvents.mock.calls.map((/** @type {any} */ appel) => appel[0]);
    const configALaUne = configs.find((/** @type {any} */ c) => c.isFeatured === true);

    expect(configALaUne).toBeDefined();
    expect(configALaUne.viewerDocumentId).toBe('user-1');
  });

  // CARACTERISATION — ce qui ne doit PAS bouger : les deux flux restent compacts
  // et gardent leur tri / leur portee.
  test('les deux flux restent compacts', () => {
    monter();

    const configs = mockUseGetEvents.mock.calls.map((/** @type {any} */ appel) => appel[0]);

    expect(configs.length).toBeGreaterThanOrEqual(2);
    configs.forEach((/** @type {any} */ config) => expect(config.compact).toBe(true));
  });
});

describe('S8 / D6 — l attente montre la FORME de ce qui arrive', () => {
  test('pendant le chargement, trois cartes squelettes tiennent la place', async () => {
    const racine = monter(true);
    await laisserPartirLesInteractions();

    const squelettes = racine.findAll(
      (/** @type {any} */ noeud) => noeud.props?.testID === 'planning-skeleton-card',
      { deep: false },
    );

    expect(squelettes).toHaveLength(3);
  });

  test('et la petite phrase grise a disparu', async () => {
    const racine = monter(true);
    await laisserPartirLesInteractions();

    expect(texteDeLEcran(racine)).not.toContain('Mise à jour des événements');
  });

  test('une fois charge, plus aucun squelette', async () => {
    const racine = monter(false);
    await laisserPartirLesInteractions();

    const squelettes = racine.findAll(
      (/** @type {any} */ noeud) => noeud.props?.testID === 'planning-skeleton-card',
      { deep: false },
    );

    expect(squelettes).toHaveLength(0);
  });
});
