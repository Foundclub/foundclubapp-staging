import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// PARENT-PLANNING (06/10/2026) — LE PLANNING D UN PARENT MONTRE LES EVENEMENTS A VENIR
// DE SON ENFANT.
//
// Decision d Adel « parent planning oui » (registre des mineurs, ligne 21), apres la tournee
// T14 : le planning de Papa Test etait VIDE (« Tes prochains evenements s afficheront ici… »),
// il n avait aucun chemin vers un match A VENIR de Hugo.
//
// Le serveur (admin, meme lot) rend, quand l ecran le demande (`withChildren`), les evenements
// a venir de chaque enfant mineur, marques `viewerChildren` (prenoms) et `viewerChildrenOnly`
// (pas AUSSI un evenement du parent) ; `meta.viewerChildren` nomme les enfants trouves.
// Ce temoin dit ce que l ECRAN en fait :
//   1. il le DEMANDE (le flux « mes equipes » porte `withChildren`) ;
//   2. chaque carte d un enfant porte son PRENOM et ne propose aucune reponse (lecture
//      seule) ; la carte d un evenement qui est AUSSI celui du parent garde ses boutons ;
//   3. l appui ouvre la page de l evenement (vue parent : la page ne propose rien a un
//      compte Parent, FINITIONS13-STATS 6) ;
//   4. le message du vide nomme l enfant quand le parent en a, sinon il ne change pas.

const mockUseGetEvents = jest.fn();
const mockCartes = [];
const mockCalendriers = [];
const mockNavigate = jest.fn();

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canManageEvents: false,
    userData: { documentId: 'paul', role: { name: 'Parent', type: 'parent' } },
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

// `.env` n existe dans aucune copie de travail : tout service atteint par l ecran est double.
jest.mock('@/services/event/eventService', () => ({
  missingEvent: jest.fn(),
  respondToEventRsvp: jest.fn(),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

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

// La carte est doublee : on garde ce que l ecran lui DONNE.
jest.mock('@/views/event/ParticipantEventListDeferred', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  const doublure = (/** @type {string} */ nom) => function Doublure() {
    return react.createElement(rn.Text, null, nom);
  };
  return {
    DateSlider: doublure('DOUBLURE_DateSlider'),
    EventCardNew: function EventCardNewDouble(/** @type {any} */ props) {
      mockCartes.push(props);
      return react.createElement(rn.Text, null, `CARTE ${props.item?.documentId}`);
    },
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
// Le calendrier du haut est double : on garde ce que l ecran lui DONNE (« calendrier B »).
jest.mock(
  '@/components/organisms/planning/PersonalPlanningContainer',
  () => function PersonalPlanningDouble(/** @type {any} */ props) {
    mockCalendriers.push(props);
    return null;
  },
);
// Le vide est double : il rend son titre et sa description, ce que lit le parent.
jest.mock(
  '@/components/atoms/emptyState/EmptyState',
  () => {
    const react = jest.requireActual('react');
    const rn = jest.requireActual('react-native');
    return function EmptyStateDouble(/** @type {any} */ props) {
      return react.createElement(rn.Text, null, `VIDE ${props.title} | ${props.description}`);
    };
  },
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

const JOUR = 24 * 60 * 60 * 1000;
// R17-VUE : l heure de Paris peut decaler le jour lu (fuseau du poste) ; on compare a 2 jours pres.
const DEUX_JOURS = 2 * JOUR;
const dans = (/** @type {number} */ jours) => new Date(Date.now() + (jours * JOUR)).toISOString();

/**
 * Une page de la liste, telle que le serveur la rend.
 * @param {any[]} data - Les evenements.
 * @param {any} [meta] - Le `meta` de la page.
 * @returns {any} Le resultat de `useGetEvents`.
 */
const requete = (data, meta = {}) => ({
  data: {
    pages: [{
      data,
      meta: {
        pagination: {
          page: 1, pageCount: 1, pageSize: 10, total: data.length,
        },
        ...meta,
      },
    }],
  },
  error: null,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isError: false,
  isFetchingNextPage: false,
  isLoading: false,
  refetch: jest.fn(),
});
const vide = () => ({ ...requete([]), data: undefined });

/**
 * Monte « Mon planning » : le flux « mes equipes » rend `principal`, les autres rien.
 * @param {any} principal - Ce que rend le flux « mes equipes ».
 * @returns {Promise<any>} La racine du rendu.
 */
const monter = async (principal) => {
  mockUseGetEvents.mockImplementation(
    (/** @type {any} */ config) => (config?.myTeams ? principal : vide()),
  );
  act(() => {
    arbre = renderer.create(
      <ParticipantEventList
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: mockNavigate,
          setOptions: jest.fn(),
        }}
      />,
    );
  });
  // `shouldLoadEventFeed` ne passe a vrai qu apres les interactions.
  await act(async () => {
    await new Promise((resoudre) => { setTimeout(resoudre, 0); });
  });
  return arbre.root;
};

/**
 * Tous les textes de l ecran, colles.
 * @param {any} racine - La racine du rendu.
 * @returns {string} Les textes.
 */
const texteDeLEcran = (racine) => racine.findAllByType(Text)
  .map((/** @type {any} */ noeud) => {
    const enfants = noeud.props.children;
    return Array.isArray(enfants) ? enfants.join('') : enfants;
  })
  .filter((/** @type {any} */ valeur) => typeof valeur === 'string')
  .join(' || ');

/**
 * Les props de la derniere carte rendue pour un evenement.
 * @param {string} documentId - L evenement.
 * @returns {any} Les props donnees a la carte.
 */
const carte = (documentId) => [...mockCartes].reverse()
  .find((props) => props.item?.documentId === documentId);

const HUGO = { documentId: 'hugo', firstname: 'Hugo' };
const LEA = { documentId: 'lea', firstname: 'Léa' };

beforeEach(() => {
  mockUseGetEvents.mockReset();
  mockNavigate.mockReset();
  mockCartes.length = 0;
  mockCalendriers.length = 0;
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

describe('PARENT-PLANNING / 3 — le planning d un parent', () => {
  test('3-1 ROUGE-AVANT — l ecran DEMANDE les evenements des enfants', async () => {
    await monter(vide());
    const configs = mockUseGetEvents.mock.calls.map((/** @type {any} */ appel) => appel[0]);
    const mesEquipes = configs.find((/** @type {any} */ c) => c.myTeams === true);
    expect(mesEquipes).toBeDefined();
    expect(mesEquipes.withChildren).toBe(true);
    // Le flux « a la une » ne le demande pas : le serveur ne le lit qu avec `myTeams`.
    configs.filter((/** @type {any} */ c) => c.isFeatured === true)
      .forEach((/** @type {any} */ c) => expect(c.withChildren).toBeUndefined());
  });

  test('3-2 ROUGE-AVANT — la carte de Hugo porte « Hugo », sans reponse', async () => {
    await monter(requete([{
      date: dans(2),
      documentId: 'e1',
      name: 'Entrainement U15',
      viewerChildren: [HUGO],
      viewerChildrenOnly: true,
    }]));
    const props = carte('e1');
    expect(props).toBeDefined();
    expect(props.childLabel).toBe('Hugo');
    expect(props.readOnly).toBe(true);
  });

  test('3-3 ROUGE-AVANT — deux enfants dans la meme equipe : les DEUX prenoms', async () => {
    await monter(requete([{
      date: dans(2), documentId: 'e1', viewerChildren: [HUGO, LEA], viewerChildrenOnly: true,
    }]));
    expect(carte('e1').childLabel).toBe('Hugo et Léa');
  });

  test('3-4 ROUGE-AVANT — evenement AUSSI au parent : boutons gardes, enfant nomme', async () => {
    await monter(requete([
      { date: dans(2), documentId: 'e6', name: 'Match Seniors' },
      {
        date: dans(3), documentId: 'e7', viewerChildren: [HUGO], viewerChildrenOnly: false,
      },
    ]));
    expect(carte('e6').readOnly).toBeFalsy();
    expect(carte('e6').childLabel).toBeFalsy();
    expect(carte('e7').readOnly).toBeFalsy();
    expect(carte('e7').childLabel).toBe('Hugo');
  });

  test('3-5 — l appui sur la carte de Hugo ouvre la page de l evenement', async () => {
    await monter(requete([{
      date: dans(2), documentId: 'e1', viewerChildren: [HUGO], viewerChildrenOnly: true,
    }]));
    act(() => carte('e1').onPress());
    expect(mockNavigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'e1' },
      screen: 'EventDetails',
    });
  });

  test('3-6 ROUGE-AVANT — parent sans evenement a venir : le vide nomme l enfant', async () => {
    const racine = await monter(requete([], { viewerChildren: [HUGO] }));
    expect(texteDeLEcran(racine)).toContain(
      'Les prochains événements de Hugo s’afficheront ici dès que son équipe en publiera.',
    );
  });

  test('3-7 ROUGE-AVANT — deux enfants : le vide les nomme tous les deux', async () => {
    const racine = await monter(requete([], { viewerChildren: [HUGO, LEA] }));
    expect(texteDeLEcran(racine)).toContain(
      'Les prochains événements de Hugo et Léa s’afficheront ici dès que leurs équipes '
      + 'en publieront.',
    );
  });

  test('3-15 ROUGE-AVANT — un parent : le calendrier demande AUSSI les enfants', async () => {
    await monter(requete([], { viewerChildren: [HUGO] }));
    expect(mockCalendriers[mockCalendriers.length - 1].withChildren).toBe(true);
  });

  test('3-16 PROTEGE — un compte sans enfant : le calendrier ne demande rien de plus', async () => {
    await monter(requete([]));
    expect(mockCalendriers[mockCalendriers.length - 1].withChildren).toBeFalsy();
  });

  // 🗓️ R17-VUE (19/10, REC17-010) — la liste, deja triee par date, dit au calendrier du haut
  // ou s ouvrir quand ses 3 jours sont vides (aucune lecture de plus) ; null tant qu elle lit.
  test('R17-VUE ROUGE-AVANT — la liste donne au calendrier les jours a venir', async () => {
    const date = dans(9);
    await monter(requete([{ date, documentId: 'e9', name: 'Match U15' }]));
    const { datesAVenir } = mockCalendriers[mockCalendriers.length - 1];
    expect(datesAVenir).toHaveLength(1);
    expect(Math.abs(datesAVenir[0].getTime() - new Date(date).getTime())).toBeLessThan(DEUX_JOURS);
  });

  test('R17-VUE ROUGE-AVANT — liste encore en lecture : le calendrier attend (null)', async () => {
    await monter({ ...requete([]), data: undefined, isLoading: true });
    expect(mockCalendriers[mockCalendriers.length - 1].datesAVenir).toBeNull();
  });

  test('3-8 PROTEGE — sans enfant, le message du vide ne change pas', async () => {
    const racine = await monter(requete([]));
    expect(texteDeLEcran(racine)).toContain(
      'Tes prochains événements s’afficheront ici dès que ton équipe en publiera.',
    );
  });
});
