import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';

import EventAnswerButtons from '../EventAnswerButtons';

// LOT R4 (retour de recette de la 2.6.26 — DECISION D ADEL DU 2026-08-24).
//
// 📏 CE QU IL A VU SUR LA VUE JOUEUR. Une fois « present », l ecran offrait
// DEUX boutons pour un seul geste :
//   · « Annuler ma participation »  → supprimait la reponse (« sans reponse »)
//   · « Absent·e »                  → creait une ligne 'missing'
// Deux defauts en un : le DOUBLON, et « Absent·e » qui se lit comme un ETAT
// (« je suis absent ») alors que c est un bouton (« deviens absent »).
//
// ⚖️ SA DECISION : UN SEUL bouton, « Annuler ma participation », et il MARQUE
// ABSENT. Annuler sa venue et se declarer absent sont le meme geste pour qui
// fait partie de l equipe conviee — le compteur des absents doit le voir.
//
// 🔒 CE QUE CES TEMOINS VERROUILLENT EN MEME TEMPS, parce que la branche est
// partagee par TROIS etats et que deux d entre eux ne changent pas :
//   · le participant VENU DU DEHORS n a pas d equipe source, et
//     `POST /events/:id/missing` la lui reclame (`event.ts:3068`) : son bouton
//     doit continuer de SUPPRIMER, sinon on lui promet un appel qui echoue ;
//   · la demande EN ATTENTE reste une suppression pure — ranger un demandeur
//     non accepte dans les absents polluerait le compteur.

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

const press = (tree, title) => {
  const bouton = tree.root
    .findAllByType(Button)
    .find((node) => node.props.title === title);
  expect(bouton).toBeTruthy();
  act(() => {
    bouton.props.onPress();
  });
};

test('R4/1 — un membre DEJA PRESENT ne voit plus QU UN SEUL bouton', () => {
  mockUserData.mockReturnValue(playerUser);

  const tree = render({
    event: buildJoinedEvent(),
    onDecline: jest.fn(),
    onDeleteParticipation: jest.fn(),
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  // ⛔ Le doublon d Adel : « Absent·e » a disparu de cet etat. Il n y reste
  // qu un geste, et il porte le libelle que le joueur comprend.
  expect(titlesOf(tree)).toEqual(['eventDetails.actions.cancelResponse']);
});

test('R4/2 — ce bouton passe par la porte qui CONFIRME puis marque absent', () => {
  mockUserData.mockReturnValue(playerUser);
  const onDecline = jest.fn();
  const onDeleteParticipation = jest.fn();

  const tree = render({
    event: buildJoinedEvent(),
    onDecline,
    onDeleteParticipation,
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  press(tree, 'eventDetails.actions.cancelResponse');

  // 🎯 UNE SEULE PORTE, celle qui demande confirmation AVANT d agir
  // (`handleDeleteParticipation`) : c est `resolveOwnAnswerAction` qui decide
  // ensuite entre supprimer et marquer absent. `onDecline` agit sans rien
  // demander (`EventDetails.js:2866`) — l utiliser ici retirerait au joueur la
  // confirmation qu il a aujourd hui.
  expect(onDeleteParticipation).toHaveBeenCalledTimes(1);
  expect(onDecline).not.toHaveBeenCalled();
});

test('R4/3 — 🔒 un participant VENU DU DEHORS garde son bouton, et il SUPPRIME', () => {
  mockUserData.mockReturnValue(outsiderUser);
  const onDecline = jest.fn();
  const onDeleteParticipation = jest.fn();

  const tree = render({
    event: buildJoinedEvent({
      participations: [{ documentId: OUTSIDER_ID }],
      sessionStatus: 'open',
    }),
    onDecline,
    onDeleteParticipation,
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  expect(titlesOf(tree)).toEqual(['eventDetails.actions.cancelResponse']);

  press(tree, 'eventDetails.actions.cancelResponse');

  expect(onDeleteParticipation).toHaveBeenCalledTimes(1);
  expect(onDecline).not.toHaveBeenCalled();
});

test('R4/4 — 🔒 une demande EN ATTENTE : un seul bouton, et il SUPPRIME', () => {
  mockUserData.mockReturnValue(playerUser);
  const onDecline = jest.fn();
  const onDeleteParticipation = jest.fn();

  const tree = render({
    event: buildJoinedEvent({ participations: [] }),
    hasPendingRequest: true,
    onDecline,
    onDeleteParticipation,
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  expect(titlesOf(tree)).toEqual(['eventDetails.actions.cancelResponse']);

  press(tree, 'eventDetails.actions.cancelResponse');

  expect(onDeleteParticipation).toHaveBeenCalledTimes(1);
  expect(onDecline).not.toHaveBeenCalled();
});

test('R4/5 — 🔒 ACQUIS : l etat ABSENT ne bouge pas', () => {
  mockUserData.mockReturnValue(playerUser);

  const tree = render({
    event: buildJoinedEvent({
      missings: [{ documentId: PLAYER_ID }],
      participations: [],
    }),
    onDecline: () => {},
    onDeleteParticipation: jest.fn(),
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  expect(titlesOf(tree)).toEqual(['eventDetails.actions.editResponse']);
});
