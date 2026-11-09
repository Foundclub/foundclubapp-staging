import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ConvocationResponsesBlock from '../ConvocationResponsesBlock';

// ==========================================================================
// CONVOC-HORS-LISTE-2 (decision d'Adel du 07/11, « 158 ») — LE COACH VOIT QUI
// S'EST MARQUE « PRESENT SI BESOIN ».
//
// Dans le bloc « Reponses » sous la carte de la convocation : une ligne a part,
// « Présents si besoin · N », avec les prenoms. Ce sont les joueurs de SON equipe
// que la convocation publiee laisse dehors et qui ont repondu present. Ils ne
// comptent PAS dans les convoques : « Présents · N » ne bouge pas.
//
// La convocation (`GET /events/:id/convocation`) ne les porte pas : le serveur ne
// range que les convoques (`buildConvocationResponses`). Leur reponse vit dans
// l'evenement (`participations` / `missings`), que la fiche lit deja
// (`GET /events/:id`, cle `['event', id]`).
// ==========================================================================

const TEAM = 'equipe-seniors';

/** @type {any} */
const mockState = {
  convocation: null,
  event: null,
  eventOptions: null,
  user: null,
};

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({ Colors: couleurs, Fonts: genererPolices(couleurs) }),
  };
});

jest.mock('@/store/authRuntime', () => ({
  getAuthRuntimeSnapshot: () => ({ auth: { user: mockState.user } }),
}));

jest.mock('@/services/event/eventQueries', () => ({
  useGetEvent: (/** @type {string} */ _id, /** @type {any} */ options) => {
    mockState.eventOptions = options;
    return { data: options?.enabled === false ? undefined : mockState.event };
  },
  useGetEventConvocation: (
    /** @type {string} */ _eventId,
    /** @type {any} */ _teamId,
    /** @type {any} */ options,
  ) => ({ data: options?.enabled ? mockState.convocation : undefined }),
}));

const player = (/** @type {string} */ documentId, firstname, lastname) => ({
  documentId, firstname, lastname,
});
const hugo = player('hugo', 'Hugo', 'Martin');
const sami = player('sami', 'Sami', 'Diallo');
const theo = player('theo', 'Théo', 'Garcia');
const rayan = player('rayan', 'Rayan', 'Delmaure');
const nina = player('nina', 'Nina', 'Roux');
const yanis = player('yanis', 'Yanis', 'Benali');
const adverse = player('adverse-1', 'Lucas', 'Bernard');
const coach = player('coach-1', 'Karim', 'Coach');

const composition = {
  eventId: 'match-samedi',
  publishedVersion: 3,
  teamId: TEAM,
  type: 'lineup_share',
};

const entraineur = {
  documentId: 'coach-1', role: { name: 'Entraineur' }, trainedTeams: [{ documentId: TEAM }],
};

beforeEach(() => {
  mockState.user = entraineur;
  mockState.eventOptions = null;
  mockState.convocation = {
    branches: [{
      published: {
        manualPlayers: [],
        requireResponse: true,
        reservePlayerIds: ['theo'],
        snapshotPlayers: [hugo, sami, theo],
        teams: [{ placements: [{ playerId: 'hugo' }, { playerId: 'sami' }] }],
        version: 3,
      },
      responses: { byPlayerId: { hugo: 'present', sami: 'absent', theo: 'pending' } },
      team: { documentId: TEAM },
    }],
  };
  mockState.event = {
    documentId: 'match-samedi',
    invitedTeams: [{ documentId: 'equipe-adverse', players: [adverse], trainers: [] }],
    // Nina a dit present puis absent : `applyRsvp` la laisse dans les deux, absent l'emporte.
    missings: [{ documentId: 'nina' }, { documentId: 'sami' }],
    participations: [
      { documentId: 'hugo' }, { documentId: 'rayan' }, { documentId: 'nina' },
      { documentId: 'yanis' }, { documentId: 'coach-1' }, { documentId: 'adverse-1' },
    ],
    team: {
      documentId: TEAM,
      players: [hugo, sami, theo, rayan, nina, yanis],
      trainers: [coach],
    },
  };
});

const textes = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<ConvocationResponsesBlock composition={composition} />);
  });
  return arbre.root.findAllByType(Text)
    .map((/** @type {any} */ noeud) => [].concat(noeud.props.children).join(''));
};

describe('CONVOC-HORS-LISTE-2 · 3 — « Présents si besoin » dans le bloc Reponses du coach', () => {
  test('une ligne a part avec les prenoms ; « Présents » ne les compte pas', () => {
    const vus = textes();

    expect(vus).toEqual(expect.arrayContaining([
      'Présents · 1', 'Hugo Martin',
      'Présents si besoin · 2', 'Rayan Delmaure, Yanis Benali',
    ]));
    // Ni l'absente (Nina), ni le coach, ni le joueur d'en face.
    expect(vus.join(' | ')).not.toContain('Nina Roux');
    expect(vus.join(' | ')).not.toContain('Lucas Bernard');
    expect(vus.join(' | ')).not.toContain('Karim Coach');
  });

  test('personne ne s est marque : pas de ligne « si besoin »', () => {
    mockState.event.participations = [{ documentId: 'hugo' }];
    expect(textes().join(' | ')).not.toContain('si besoin');
  });

  test('un joueur ne lit pas le bloc, et la fiche n est pas relue pour lui', () => {
    mockState.user = { documentId: 'rayan', role: { name: 'Joueur' }, trainedTeams: [] };
    expect(textes()).toEqual([]);
    expect(mockState.eventOptions?.enabled).toBe(false);
  });
});
