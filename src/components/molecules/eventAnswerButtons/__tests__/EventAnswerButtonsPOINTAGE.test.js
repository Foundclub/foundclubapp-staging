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

// LOT POINTAGE (decisions d Adel du 29/09) — LES BOUTONS PRESENT / ABSENT
// SUIVENT L OPTION « LES PARTICIPANTS REPONDENT », ET LE « PAS RENSEIGNE »
// PEUT PASSER PRESENT APRES COUP.
//
// Ce composant est monte par la fiche evenement ET par les cartes de liste :
// c est ici, et une seule fois, que l option se lit. Ecrits ROUGES contre app
// `8d017cd6`. Harnais repris de `EventAnswerButtonsCOACH1.test.js`.

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

jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: ({ missings, userId }) => (missings || [])
      .some((m) => m.documentId === userId),
    haveIAlreadyJoined: ({ participations, userId }) => (participations || [])
      .some((p) => p.documentId === userId),
  }),
}));

const PLAYER_ID = 'user-player';
const player = { documentId: PLAYER_ID, role: { name: USER_ROLES.player } };

const buildEvent = (overrides = {}) => ({
  capacity: 0,
  date: '2027-05-12T18:00:00.000Z',
  documentId: 'event-1',
  missings: [],
  participationRequests: [],
  participations: [],
  sessionStatus: 'closed',
  team: {
    documentId: 'team-1',
    name: 'Senior A',
    players: [{ documentId: PLAYER_ID }],
    trainers: [{ documentId: 'user-coach' }],
  },
  type: { name: 'Match' },
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

beforeEach(() => {
  mockUserData.mockReturnValue(player);
});

test('POINTAGE-A1 — option cochee (ou evenement d avant le lot) : Present / Absent', () => {
  const tree = render({ event: buildEvent(), ...handlers });

  expect(titlesOf(tree)).toEqual(['eventList.actions.present', 'eventList.actions.absent']);
});

test('POINTAGE-A2 — 🚨 reponses DECOCHEES : ni Present ni Absent, ni motif de refus', () => {
  const tree = render({ event: buildEvent({ rsvpEnabled: false }), ...handlers });

  expect(titlesOf(tree)).toEqual([]);
  expect(textsOf(tree)).not.toContain('eventList.info.restrictedEvent');
});

test('POINTAGE-A3 — 🚨 apres coup, le « pas renseigne » voit « Je passe en present »', () => {
  const onDeclareLatePresence = jest.fn();
  const tree = render({
    event: buildEvent({ date: '2026-09-28T18:00:00.000Z' }),
    onDeclareLatePresence,
    ...handlers,
  });

  expect(titlesOf(tree)).toEqual(['eventList.actions.declareLatePresence']);
  expect(textsOf(tree)).toContain('eventList.info.notReported');
  act(() => {
    tree.root.findAllByType(Button)[0].props.onPress();
  });
  expect(onDeclareLatePresence).toHaveBeenCalledTimes(1);
});

test('POINTAGE-A4 — sans la porte (la fiche ne la donne pas), le passe reste ferme', () => {
  const tree = render({ event: buildEvent({ date: '2026-09-28T18:00:00.000Z' }), ...handlers });

  expect(titlesOf(tree)).not.toContain('eventList.actions.declareLatePresence');
});
