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

// LOT COACH1 (E6) — « les entraineurs repondent present / absent, et se
// convoquent aux matchs » (decision d Adel du 2026-09-21, confirmee « 3 - A »).
//
// Sur un MATCH, se convoquer = repondre PRESENT : l entraineur apparait alors
// dans la partie « Encadrement » de la convocation publiee (serveur :
// `event-composition.ts`, `buildConvocationStaff`). Rien ne le disait a
// l ecran : ce fichier verrouille la phrase qui le dit, et les cas ou elle doit
// se taire (joueur, coach-joueur, entrainement).
//
// Ecrits ROUGES contre `origin/staging` (app `f9ea5914`).

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
const OTHER_COACH_ID = 'user-other-coach';

const HINT = 'eventList.info.staffJoinsConvocation';

const coach = { documentId: COACH_ID, role: { name: USER_ROLES.coach } };

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

test('COACH1/A1 — MATCH : l entraineur a Present / Absent ET lit comment se convoquer', () => {
  mockUserData.mockReturnValue(coach);

  const tree = render({ event: buildEvent(), ...handlers });

  expect(titlesOf(tree)).toEqual(['eventList.actions.present', 'eventList.actions.absent']);
  expect(textsOf(tree)).toContain(HINT);
});

test('COACH1/A2 — ENTRAINEMENT : Present / Absent, sans phrase de convocation', () => {
  mockUserData.mockReturnValue(coach);

  const tree = render({
    event: buildEvent({ sessionStatus: 'closed', type: { name: 'Entrainement' } }),
    ...handlers,
  });

  expect(titlesOf(tree)).toEqual(['eventList.actions.present', 'eventList.actions.absent']);
  expect(textsOf(tree)).not.toContain(HINT);
});

test('COACH1/A3 — CARTE de liste (ni `players` ni `trainers`) : le profil suffit', () => {
  mockUserData.mockReturnValue({ ...coach, trainedTeams: [{ documentId: 'team-1' }] });

  const tree = render({
    event: buildEvent({
      team: { documentId: 'team-1', name: 'Senior A' },
      viewerCanRespond: undefined,
    }),
    onAbout: () => {},
    ...handlers,
  });

  expect(titlesOf(tree)).toEqual(['eventList.actions.present', 'eventList.actions.absent']);
  expect(textsOf(tree)).toContain(HINT);
});

test('COACH1/A4 🔒 — le COACH-JOUEUR se convoque comme un joueur : pas de phrase', () => {
  mockUserData.mockReturnValue({ documentId: COACH_PLAYER_ID, role: { name: USER_ROLES.coach } });

  const tree = render({ event: buildEvent(), ...handlers });

  expect(titlesOf(tree)).toEqual(['eventList.actions.present', 'eventList.actions.absent']);
  expect(textsOf(tree)).not.toContain(HINT);
});

test('COACH1/A5 🔒 — le JOUEUR ne voit rien de neuf', () => {
  mockUserData.mockReturnValue({ documentId: PLAYER_ID, role: { name: USER_ROLES.player } });

  const tree = render({ event: buildEvent(), ...handlers });

  expect(titlesOf(tree)).toEqual(['eventList.actions.present', 'eventList.actions.absent']);
  expect(textsOf(tree)).not.toContain(HINT);
});

test('COACH1/A6 🔒 — un entraineur d une AUTRE equipe n a pas la rangee de reponse', () => {
  mockUserData.mockReturnValue({ documentId: OTHER_COACH_ID, role: { name: USER_ROLES.coach } });

  const tree = render({ event: buildEvent(), ...handlers });

  expect(titlesOf(tree)).not.toContain('eventList.actions.present');
  expect(titlesOf(tree)).not.toContain('eventList.actions.absent');
  expect(textsOf(tree)).not.toContain(HINT);
});

test('COACH1/A7 — deja repondu PRESENT : l etat s affiche, la phrase d aide se tait', () => {
  mockUserData.mockReturnValue(coach);

  const tree = render({
    event: buildEvent({ participations: [{ documentId: COACH_ID }] }),
    onDeleteParticipation: () => {},
    ...handlers,
  });

  expect(textsOf(tree)).not.toContain(HINT);
  expect(titlesOf(tree)).toContain('eventDetails.actions.cancelResponse');
});
