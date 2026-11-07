import { QueryClientProvider } from '@tanstack/react-query';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { creerQueryClientDeTest } from '../../../../testSupport/queryClientDeTest';
import CompositionMessageBubble from '../CompositionMessageBubble';

// ==========================================================================
// CONVOC-HORS-LISTE-2 (decision d'Adel du 07/11, « 158 ») — « Ton coach a publie
// les convocations et toi, tu n'es pas convoque. Il faut que tu puisses quand meme
// te marquer [...] un petit "present", au cas ou le coach a besoin de moi. »
//
// Sur la carte de la convocation dans la conversation de l'equipe, le membre de
// l'equipe que la convocation PUBLIEE de SON equipe laisse dehors lit le message du
// lot precedent, le bouton « Présent si besoin » (et « Absent » pour revenir sur sa
// reponse), et sous les boutons « Au cas où il manque un joueur, le coach pourra
// faire appel à toi. ». Meme route que la fiche : `POST /events/:id/rsvp`.
//
// ⛔ Jamais : pour un convoque, pour le coach, pour qui n'est pas de l'equipe, apres
// le match, reponses coupees, convocation sans demande de reponse, carte depassee.
//
// 🧪 Banc recopie de `CompositionMessageBubbleBULLE.test.js` : VRAI react-query,
// services doubles une couche plus bas, un « serveur » qui garde les reponses la ou
// le vrai les garde (`event.participations` / `event.missings`).
// ==========================================================================

const MOI = 'joueur-1';
const REMPLACANT = 'joueur-2';
const HORS = 'joueur-9';
const EQUIPE = 'team-1';
const A_VENIR = '2099-06-14T16:00:00.000Z';
const PASSE = '2020-06-14T16:00:00.000Z';

const AVIS = 'Tu n’es pas convoqué pour ce match et tu n’es pas compté dans la convocation. '
  + 'Tu peux quand même te marquer présent : s’il manque des joueurs, '
  + 'le coach pourra faire appel à toi.';
const AIDE = 'Au cas où il manque un joueur, le coach pourra faire appel à toi.';
const SI_BESOIN = 'Présent si besoin';

/** @type {any} */
let mockSnapshot;

const mockServeur = {
  /** @type {string[]} */
  absents: [],
  lecturesEvenement: 0,
  /** @type {string[]} */
  presents: [],
  requireResponse: true,
  /** @type {boolean | undefined} */
  rsvpEnabled: undefined,
  /** @type {string} */
  teamPubliee: 'team-1',
  version: 2,
};

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => mockSnapshot,
}));

jest.mock('@/services/event/eventService', () => ({
  getEventById: jest.fn(() => {
    mockServeur.lecturesEvenement += 1;
    return Promise.resolve({
      documentId: 'evt-1',
      missings: mockServeur.absents.map((documentId) => ({ documentId })),
      participations: mockServeur.presents.map((documentId) => ({ documentId })),
      team: {
        documentId: 'team-1',
        players: [
          { documentId: 'joueur-1' }, { documentId: 'joueur-2' }, { documentId: 'joueur-9' },
        ],
        trainers: [{ documentId: 'coach-1' }],
      },
    });
  }),
  getEventConvocation: jest.fn(() => Promise.resolve({
    branches: [{
      published: {
        requireResponse: mockServeur.requireResponse,
        reservePlayerIds: ['joueur-2'],
        reserveSnapshotPlayers: [
          { documentId: 'joueur-2', firstname: 'Paul', lastname: 'Veuillet' },
        ],
        snapshotPlayers: [
          { documentId: 'joueur-1', firstname: 'Adel', lastname: 'Ferchichi' },
          { documentId: 'joueur-2', firstname: 'Paul', lastname: 'Veuillet' },
        ],
        sportContext: 'football',
        teams: [{ id: 't1', placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 20 }] }],
        version: mockServeur.version,
      },
      // Le vrai serveur ne range que les convoques (`buildConvocationResponses`).
      responses: { byPlayerId: { 'joueur-1': 'pending', 'joueur-2': 'pending' } },
      team: { documentId: mockServeur.teamPubliee, name: 'Aix-Perd en Buvette' },
    }],
    event: {
      date: '2099-06-14T16:00:00.000Z',
      documentId: 'evt-1',
      name: '',
      ...(mockServeur.rsvpEnabled === undefined ? {} : { rsvpEnabled: mockServeur.rsvpEnabled }),
    },
  })),
  missingEvent: jest.fn(() => Promise.resolve({})),
  respondToEventRsvp: jest.fn((/** @type {string} */ _id, /** @type {string} */ reponse) => {
    // `applyRsvp` : une reponse retire l'autre liste.
    mockServeur.presents = mockServeur.presents.filter((id) => id !== 'joueur-9');
    mockServeur.absents = mockServeur.absents.filter((id) => id !== 'joueur-9');
    if (reponse === 'present') mockServeur.presents.push('joueur-9');
    if (reponse === 'absent') mockServeur.absents.push('joueur-9');
    return Promise.resolve({ changed: true });
  }),
}));

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, style }) => <View style={style}>{children}</View>,
  };
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  const theme = {
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Spaces: jest.requireActual('@/theme/spaces').default,
  };
  return { __esModule: true, default: () => theme };
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

const COMPO = {
  eventDate: A_VENIR,
  eventDisplayName: 'Match vs US Pelican',
  eventId: 'evt-1',
  eventName: 'Match vs US Pelican',
  manualPlayers: [],
  placements: [],
  publishedVersion: 2,
  reservePlayers: [{ documentId: REMPLACANT, firstname: 'Paul', lastname: 'Veuillet' }],
  schemaVersion: 3,
  snapshotPlayers: [
    { documentId: MOI, firstname: 'Adel', lastname: 'Ferchichi' },
    { documentId: REMPLACANT, firstname: 'Paul', lastname: 'Veuillet' },
  ],
  sport: 'football',
  sportContext: 'football',
  teamId: EQUIPE,
  teamName: 'Aix-Perd en Buvette',
  teams: [{
    id: 't1',
    name: 'Aix-Perd en Buvette',
    placements: [{ playerId: MOI, positionX: 50, positionY: 20 }],
  }],
  type: 'lineup_share',
};

/** @type {any} */
let queryClient;
/** @type {any[]} */
const montes = [];

const texteVisible = (/** @type {any} */ arbre) => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const aplatir = (/** @type {any} */ enfants) => {
    if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
    if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
    if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
    return String(enfants);
  };
  return arbre.root.findAllByType(TexteRN)
    .map((/** @type {any} */ noeud) => aplatir(noeud.props.children))
    .join(' | ');
};

const boutons = (/** @type {any} */ arbre, /** @type {string} */ titre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.title === titre
    && typeof noeud.props?.variant === 'string');

const attendre = async (/** @type {() => boolean} */ condition) => {
  for (let tour = 0; tour < 20 && !condition(); tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await new Promise((resoudre) => { setTimeout(resoudre, 0); });
    });
  }
};

const laisserPasser = async () => { await attendre(() => false); };

const monter = async (/** @type {any} */ compo = COMPO) => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <CompositionMessageBubble composition={compo} />
      </QueryClientProvider>,
    );
  });
  montes.push(arbre);
  return arbre;
};

const joueurDeLEquipe = (/** @type {string} */ documentId) => ({
  auth: { user: { documentId, myTeams: [{ documentId: EQUIPE }], trainedTeams: [] } },
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockSnapshot = joueurDeLEquipe(HORS);
  mockServeur.absents = [];
  mockServeur.lecturesEvenement = 0;
  mockServeur.presents = [];
  mockServeur.requireResponse = true;
  mockServeur.rsvpEnabled = undefined;
  mockServeur.teamPubliee = EQUIPE;
  mockServeur.version = 2;
  queryClient = creerQueryClientDeTest();
});

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  queryClient.clear();
  jest.restoreAllMocks();
});

describe('CONVOC-HORS-LISTE-2 · 1 — le non-convoque de l equipe repond depuis la carte', () => {
  it('pas encore repondu : le message, « Présent si besoin », « Absent », l aide', async () => {
    const arbre = await monter();
    await attendre(() => boutons(arbre, SI_BESOIN).length > 0);

    expect(boutons(arbre, SI_BESOIN)).toHaveLength(1);
    expect(boutons(arbre, 'Absent')).toHaveLength(1);
    expect(boutons(arbre, 'Présent')).toHaveLength(0);
    const texte = texteVisible(arbre);
    expect(texte).toContain(AVIS);
    expect(texte).toContain(AIDE);
    expect(texte).not.toContain('Tu as répondu');
    // La phrase d'aide se lit SOUS les boutons.
    expect(texte.lastIndexOf(AIDE)).toBeGreaterThan(texte.indexOf(`| ${SI_BESOIN} |`));
  });

  it('appui sur « Présent si besoin » : la route de la fiche, puis la reponse', async () => {
    const { respondToEventRsvp } = jest.requireMock('@/services/event/eventService');
    const arbre = await monter();
    await attendre(() => boutons(arbre, SI_BESOIN).length > 0);

    await act(async () => {
      arbre.root.findByProps({ accessibilityLabel: SI_BESOIN }).props.onPress();
    });
    await attendre(() => texteVisible(arbre).includes('Tu as répondu Présent si besoin'));

    expect(respondToEventRsvp).toHaveBeenCalledTimes(1);
    expect(respondToEventRsvp.mock.calls[0].slice(0, 2)).toEqual(['evt-1', 'present']);
    expect(boutons(arbre, SI_BESOIN)[0].props.variant).toBe('Primary');
    expect(boutons(arbre, 'Absent')[0].props.variant).toBe('Secondary');
  });

  it('deja marque present si besoin : il le lit, et revient dessus par « Absent »', async () => {
    mockServeur.presents = [HORS];
    const arbre = await monter();
    await attendre(() => texteVisible(arbre).includes('Tu as répondu Présent si besoin'));

    expect(texteVisible(arbre)).toContain('Tu as répondu Présent si besoin');

    await act(async () => {
      arbre.root.findByProps({ accessibilityLabel: 'Absent' }).props.onPress();
    });
    await attendre(() => texteVisible(arbre).includes('Tu as répondu Absent'));

    expect(texteVisible(arbre)).toContain('Tu as répondu Absent');
    expect(texteVisible(arbre)).not.toContain('Tu as répondu Présent si besoin');
  });
});

describe('CONVOC-HORS-LISTE-2 · 1 — 🔒 jamais ailleurs', () => {
  const rienDeSiBesoin = (/** @type {any} */ arbre) => {
    expect(boutons(arbre, SI_BESOIN)).toHaveLength(0);
    expect(texteVisible(arbre)).not.toContain(AVIS);
    expect(texteVisible(arbre)).not.toContain(AIDE);
  };

  it('le convoque garde « Présent » / « Absent », sans message ni « si besoin »', async () => {
    mockSnapshot = joueurDeLEquipe(MOI);
    const arbre = await monter();
    await attendre(() => boutons(arbre, 'Présent').length > 0);

    expect(boutons(arbre, 'Présent')).toHaveLength(1);
    rienDeSiBesoin(arbre);
    // Sa reponse est dans la convocation : la fiche entiere n'est pas relue pour lui.
    expect(mockServeur.lecturesEvenement).toBe(0);
  });

  it('le coach de l equipe : aucun bouton', async () => {
    mockSnapshot = {
      auth: {
        user: {
          documentId: 'coach-1',
          myTeams: [{ documentId: EQUIPE }],
          trainedTeams: [{ documentId: EQUIPE }],
        },
      },
    };
    const arbre = await monter();
    await laisserPasser();

    rienDeSiBesoin(arbre);
    expect(boutons(arbre, 'Absent')).toHaveLength(0);
  });

  it('quelqu un qui n est pas de l equipe (parent, autre club) : aucun bouton', async () => {
    mockSnapshot = { auth: { user: { documentId: 'parent-1', myTeams: [], trainedTeams: [] } } };
    const arbre = await monter();
    await laisserPasser();

    rienDeSiBesoin(arbre);
    expect(boutons(arbre, 'Absent')).toHaveLength(0);
  });

  it('apres le match : aucun bouton', async () => {
    const arbre = await monter({ ...COMPO, eventDate: PASSE });
    await laisserPasser();

    rienDeSiBesoin(arbre);
  });

  it('reponses coupees par l organisateur : aucun bouton', async () => {
    mockServeur.rsvpEnabled = false;
    const arbre = await monter();
    await laisserPasser();

    rienDeSiBesoin(arbre);
  });

  it('convocation sans demande de reponse : aucun bouton (comme le convoque)', async () => {
    mockServeur.requireResponse = false;
    const arbre = await monter();
    await laisserPasser();

    rienDeSiBesoin(arbre);
  });

  it('carte depassee (le coach a republie) : aucun bouton', async () => {
    mockServeur.version = 3;
    const arbre = await monter();
    await laisserPasser();

    rienDeSiBesoin(arbre);
  });

  it('seule l autre equipe a une convocation publiee : aucun bouton', async () => {
    mockServeur.teamPubliee = 'team-adverse';
    const arbre = await monter();
    await laisserPasser();

    rienDeSiBesoin(arbre);
  });
});
