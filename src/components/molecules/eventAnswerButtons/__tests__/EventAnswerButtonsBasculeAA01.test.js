import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';

import EventAnswerButtons from '../EventAnswerButtons';

// LOT AA01 (E6) — TEMOIN 3 : « PRESENT -> ABSENT MARCHE AUSSI ».
//
// 📏 MESURE DU 2026-08-20, AVANT CE LOT : une fois « present », un joueur
// n avait plus qu UN bouton — « Annuler ma participation », qui le ramene a
// « sans reponse ». Pour se declarer absent il lui fallait DEUX gestes, et le
// premier effacait sa reponse entre les deux. C est le miroir exact du constat
// d Adel : une reponse qu on ne peut pas CHANGER, seulement effacer puis
// refaire.
//
// 🔒 CE QUE CE TEMOIN VERROUILLE EN MEME TEMPS : le bouton n apparait QUE pour
// un membre d une equipe conviee. `POST /events/:id/missing` exige une equipe
// source (`event.ts:3068`) et refuserait un participant venu du dehors — lui
// donner ce bouton, ce serait lui promettre une action qui echoue.

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

// `t` rend la CLE : les assertions ne dependent pas de la copie de `fr.js`.
jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (key) => key }),
}));

const mockUserData = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData() }),
}));

// ⚠️ COPIE FIDELE des trois fonctions reelles (`eventUseCases.js`), pas des
// `() => true` de confort : c est `haveIAlreadyJoined` qui aiguille vers la
// branche testee ici.
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

const PLAYER_ID = 'user-player';
const OUTSIDER_ID = 'user-outsider';

const playerUser = { documentId: PLAYER_ID, role: { name: USER_ROLES.player } };
const outsiderUser = { documentId: OUTSIDER_ID, role: { name: USER_ROLES.player } };

/**
 * Un evenement d equipe ou le joueur est DEJA present.
 * @param {object} [overrides]
 * @returns {any} L evenement.
 */
const buildJoinedEvent = (overrides = {}) => ({
  capacity: 0,
  date: '2099-05-12T18:00:00.000Z',
  documentId: 'event-1',
  missings: [],
  participationRequests: [],
  participations: [{ documentId: PLAYER_ID }],
  sessionStatus: 'closed',
  team: {
    documentId: 'team-1',
    name: 'Senior A',
    players: [{ documentId: PLAYER_ID }],
    trainers: [{ documentId: 'user-coach' }],
  },
  type: { name: 'Entrainement' },
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

const titlesOf = (tree) => tree.root.findAllByType(Button).map((button) => button.props.title);

test('AA01/3 — un membre DEJA PRESENT peut se declarer absent en UN geste', () => {
  mockUserData.mockReturnValue(playerUser);
  const onDecline = jest.fn();

  const tree = render({
    event: buildJoinedEvent(),
    onDecline,
    onDeleteParticipation: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  const titles = titlesOf(tree);
  expect(titles).toContain('eventList.actions.absent');
  // ⛔ Le bouton d annulation reste : se declarer absent et retirer sa reponse
  // ne sont pas le meme geste, et AA01 n en supprime aucun.
  expect(titles).toContain('eventDetails.actions.cancelResponse');

  const bouton = tree.root
    .findAllByType(Button)
    .find((node) => node.props.title === 'eventList.actions.absent');
  act(() => {
    bouton.props.onPress();
  });

  expect(onDecline).toHaveBeenCalledTimes(1);
});

test('AA01/3 bis — 🔒 un participant VENU DU DEHORS ne recoit pas ce bouton', () => {
  mockUserData.mockReturnValue(outsiderUser);

  const tree = render({
    event: buildJoinedEvent({
      participations: [{ documentId: OUTSIDER_ID }],
      sessionStatus: 'open',
    }),
    onDecline: () => {},
    onDeleteParticipation: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  const titles = titlesOf(tree);
  expect(titles).not.toContain('eventList.actions.absent');
  expect(titles).toContain('eventDetails.actions.cancelResponse');
});
