import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';

import EventAnswerButtons from '../EventAnswerButtons';

// TEMOINS-DATES (06/10/2026) — BOMBE A RETARDEMENT DESAMORCEE : l evenement de ce fichier est date
// en dur au 12/05/2027 18:00 UTC comme un moment « a venir », et le composant le compare a l heure
// REELLE (evenement passe = plus de Present / Absent). ROUGE a partir de ce moment-la, sans qu une
// ligne change (mesure : horloge avancee, fichier seul, vert a +218 j, rouge a +219 j). Seul `Date`
// est fige, au 06/10/2026, jour ou ce fichier est vert ; les minuteries restent vraies (act et les
// promesses en dependent), comme `FIGER_LA_DATE` de CollectiviteChiffres.COLL-AFFICHE2.
const FIGER_LA_DATE = {
  doNotFake: [
    'hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame',
    'cancelAnimationFrame',
    'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval',
    'clearInterval', 'setTimeout', 'clearTimeout',
  ],
  now: new Date('2026-10-06T00:00:00.000Z'),
};
beforeEach(() => { jest.useFakeTimers(FIGER_LA_DATE); });
afterEach(() => { jest.useRealTimers(); });

// CONVOC-HORS-LISTE (demande d Adel du 07/11) — LE MESSAGE DU JOUEUR NON CONVOQUE
// VIT AVEC SES BOUTONS. La fiche du match decide QUI le lit (`notice`) ; ce composant
// decide OU : au-dessus de la reponse, la ou il repond, et seulement la.
// Banc recopie de `EventAnswerButtonsCOACH1.test.js`.

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: (_target, key) => `image-${String(key)}` }),
      Spaces: makeRamp(),
    }),
  };
});

// `t` rend la CLE : les assertions ne dependent pas de la copie de fr.js.
jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (key) => key }),
}));

const mockUserData = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData() }),
}));

// ⚠️ COPIE FIDELE de `canEventBeJoined` (`eventUseCases.js:708-720`), et non un
// `() => true` de confort : c est ELLE qui fabrique le bouton gris. La doubler
// par un `true` rendrait le temoin 7 vert sur le code casse.
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: ({
      capacity, participations, userId, userRole,
    }) => {
      if (!capacity) return true;
      return userRole?.name === 'Joueur'
        && (participations || []).length < capacity
        && !(participations || []).some((p) => p.documentId === userId);
    },
    haveIAlreadyAnsweredNo: ({ missings, userId }) => (missings || [])
      .some((m) => m.documentId === userId),
    haveIAlreadyJoined: ({ participations, userId }) => (participations || [])
      .some((p) => p.documentId === userId),
  }),
}));

const COACH_ID = 'user-coach';
const PLAYER_ID = 'user-player';

const COACH_PLAYER_ID = 'user-coach-player';

const AVIS = 'Tu n es pas convoque pour ce match.';

/**
 * L equipe conviee : un joueur, un entraineur, et un coach-joueur inscrit des
 * deux cotes — la forme que la fiche recoit (`team.players` et `team.trainers`
 * sont peuples par `event.findOne`).
 * @param {object} [overrides]
 * @returns {any} L evenement.
 */
const buildEvent = (overrides = {}) => ({
  capacity: 0,
  date: '2027-05-12T18:00:00.000Z',
  documentId: 'event-1',
  missings: [],
  participationRequests: [],
  participations: [],
  sessionStatus: 'open',
  team: {
    documentId: 'team-1',
    name: 'Senior A',
    players: [{ documentId: PLAYER_ID }, { documentId: COACH_PLAYER_ID }],
    trainers: [{ documentId: COACH_ID }, { documentId: COACH_PLAYER_ID }],
  },
  type: { name: 'Match' },
  // Ce que le serveur envoie desormais sur la fiche, a tout le monde.
  viewerCanRespond: true,
  ...overrides,
});

const render = (props) => {
  let tree = null;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<EventAnswerButtons {...props} />);
  });
  return tree;
};

const handlers = {
  onDecline: () => {},
  onJoin: () => {},
  onLogin: () => {},
  onParticipate: () => {},
};

const titlesOf = (tree) => tree.root.findAllByType(Button).map((button) => button.props.title);
const textsOf = (tree) => tree.root.findAllByType(Text)
  .map((node) => node.props.children)
  .filter((child) => typeof child === 'string');

const joueur = { documentId: PLAYER_ID, role: { name: USER_ROLES.player } };

test('CONVOC-HORS-LISTE/1 — pas encore repondu : le message, puis Present / Absent', () => {
  mockUserData.mockReturnValue(joueur);

  const tree = render({ event: buildEvent(), notice: AVIS, ...handlers });

  expect(textsOf(tree)).toContain(AVIS);
  expect(titlesOf(tree)).toEqual(['eventList.actions.present', 'eventList.actions.absent']);
});

test('CONVOC-HORS-LISTE/2 — deja present : le message reste (il n est toujours pas compte)', () => {
  mockUserData.mockReturnValue(joueur);

  const tree = render({
    event: buildEvent({ participations: [{ documentId: PLAYER_ID }] }),
    notice: AVIS,
    onDeleteParticipation: () => {},
    ...handlers,
  });

  expect(textsOf(tree)).toContain(AVIS);
  expect(titlesOf(tree)).toContain('eventDetails.actions.cancelResponse');
});

test('CONVOC-HORS-LISTE/3 — deja absent : le message reste, il peut se raviser', () => {
  mockUserData.mockReturnValue(joueur);

  const tree = render({
    event: buildEvent({ missings: [{ documentId: PLAYER_ID }] }),
    notice: AVIS,
    onDeleteParticipation: () => {},
    ...handlers,
  });

  expect(textsOf(tree)).toContain(AVIS);
  expect(titlesOf(tree)).toContain('eventDetails.actions.editResponse');
});

test('CONVOC-HORS-LISTE/4 🔒 — sans `notice` (convoque, ou pas publie) : rien de neuf', () => {
  mockUserData.mockReturnValue(joueur);

  const tree = render({ event: buildEvent(), ...handlers });

  expect(textsOf(tree)).not.toContain(AVIS);
  expect(titlesOf(tree)).toEqual(['eventList.actions.present', 'eventList.actions.absent']);
});

test('CONVOC-HORS-LISTE/5 🔒 — reponses coupees : pas de boutons, donc pas de message', () => {
  mockUserData.mockReturnValue(joueur);

  const tree = render({ event: buildEvent({ rsvpEnabled: false }), notice: AVIS, ...handlers });

  expect(textsOf(tree)).not.toContain(AVIS);
});

test('CONVOC-HORS-LISTE/6 🔒 — match fini : « faire appel a toi » n a plus de sens', () => {
  mockUserData.mockReturnValue(joueur);

  const tree = render({
    event: buildEvent(),
    isFinished: true,
    notice: AVIS,
    onDeclareLatePresence: () => {},
    ...handlers,
  });

  expect(textsOf(tree)).not.toContain(AVIS);
  expect(titlesOf(tree)).toContain('eventList.actions.declareLatePresence');
});
