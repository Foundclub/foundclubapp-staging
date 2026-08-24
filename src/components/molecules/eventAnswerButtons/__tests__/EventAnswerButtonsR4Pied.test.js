import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';

import EventAnswerButtons from '../EventAnswerButtons';

// LOT R4 · D5 (micro-lot embarque, retour de recette du 2026-08-24) — LE PIED
// DE PAGE D UN ENTRAINEMENT OUVERT.
//
// 📏 CE QU ADEL A VU : la MEME seance, une fois passee de « privee » a
// « ouverte », RETIRE ses boutons Present / Absent au membre de l equipe
// conviee et les remplace par un « Participer » gris. Gris ET MUET : aucune
// phrase ne dit pourquoi. C est l inverse de ce qu ouvrir une seance veut dire.
//
// 🔎 LE MECANISME, parce qu il n est pas devinable : la rangee Present / Absent
// etait reservee a `sessionStatus === 'closed'`. Hors de la, tout le monde
// tombait sur le bouton « Participer », que `canEventBeJoined` eteint des que
// `capacity > 0` pour qui n a pas le role « Joueur » — et la phrase d a-cote
// exigeait `!canAct`, qui valait `true`. Bouton eteint, et pas un mot.
//
// 🎯 LA REGLE : etre CONVIE decide de la rangee de reponse. Que la seance
// accepte du monde en plus ne change rien pour ceux qui sont deja attendus.

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

// ⚠️ `t` rend le REPLI quand il y en a un, la cle sinon : c est le seul moyen de
// voir a l ecran ce que l utilisateur lira vraiment quand la cle manque a
// `fr.js` — et c etait justement le cas de `eventList.info.restrictedEvent`.
jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({
    t: (key, fallback) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

const mockUserData = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData() }),
}));

// ⚠️ COPIE FIDELE de `canEventBeJoined` (`eventUseCases.js`) : c est elle qui
// eteint le bouton, un `() => true` de confort masquerait tout le defaut.
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

const memberPlayer = { documentId: PLAYER_ID, role: { name: USER_ROLES.player } };
const outsiderPlayer = { documentId: OUTSIDER_ID, role: { name: USER_ROLES.player } };

const canActFlow = { actionLabel: 'Participer', canAct: true };

/**
 * Un entrainement OUVERT (`sessionStatus: 'open'`) d une equipe qui me convie.
 * @param {object} [overrides]
 * @returns {any} L evenement.
 */
const buildOpenEvent = (overrides = {}) => ({
  capacity: 0,
  date: '2099-05-12T18:00:00.000Z',
  documentId: 'event-1',
  missings: [],
  participationRequests: [],
  participations: [],
  sessionStatus: 'open',
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

const titlesOf = (tree) => tree.root.findAllByType(Button).map((node) => node.props.title);
const tagsOf = (tree) => tree.root.findAllByType(Tag).map((node) => node.props.text);
const textsOf = (tree) => tree.root.findAllByType(Text)
  .map((node) => node.props.children)
  .filter((child) => typeof child === 'string');

// 🪤 Un `Button` rend son libelle dans un `Text` : lister les `Text` bruts
// ferait passer « Participer » pour un motif. On retire les libelles.
const reasonsOf = (tree) => {
  const titles = new Set(titlesOf(tree));
  return textsOf(tree).filter((texte) => !titles.has(texte));
};

beforeEach(() => {
  mockUserData.mockReturnValue(memberPlayer);
});

test('R4/15 — entrainement OUVERT : le membre convie retrouve Present / Absent', () => {
  const tree = render({
    event: buildOpenEvent(),
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
    participationFlow: canActFlow,
  });

  expect(titlesOf(tree)).toEqual([
    'eventList.actions.present',
    'eventList.actions.absent',
  ]);
});

test('R4/16 — et ces deux boutons appellent bien des gestes DIFFERENTS', () => {
  const onDecline = jest.fn();
  const onParticipate = jest.fn();

  const tree = render({
    event: buildOpenEvent(),
    onDecline,
    onJoin: () => {},
    onLogin: () => {},
    onParticipate,
    participationFlow: canActFlow,
  });

  const boutons = tree.root.findAllByType(Button);
  act(() => {
    boutons.find((node) => node.props.title === 'eventList.actions.present').props.onPress();
  });
  act(() => {
    boutons.find((node) => node.props.title === 'eventList.actions.absent').props.onPress();
  });

  expect(onParticipate).toHaveBeenCalledTimes(1);
  expect(onDecline).toHaveBeenCalledTimes(1);
});

test('R4/17 — 🔒 le membre convie garde ses boutons meme quand la jauge est pleine', () => {
  // La jauge borne les INSCRIPTIONS venues du dehors ; elle n a jamais eu a
  // faire taire quelqu un qui est deja attendu.
  const tree = render({
    event: buildOpenEvent({
      capacity: 1,
      participations: [{ documentId: OUTSIDER_ID }],
    }),
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
    participationFlow: canActFlow,
  });

  expect(titlesOf(tree)).toEqual([
    'eventList.actions.present',
    'eventList.actions.absent',
  ]);
});

test('R4/18 — un bouton eteint porte SON motif : jamais gris et muet', () => {
  mockUserData.mockReturnValue(outsiderPlayer);

  const tree = render({
    event: buildOpenEvent({
      capacity: 1,
      participations: [{ documentId: 'user-someone-else' }],
    }),
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
    participationFlow: canActFlow,
  });

  const bouton = tree.root.findAllByType(Button)[0];
  expect(bouton.props.disabled).toBe(true);
  expect(reasonsOf(tree)).toEqual(['Cet événement est complet.']);
});

test('R4/19 — 🔒 ACQUIS : de la place et rien qui bloque, aucun motif inutile', () => {
  mockUserData.mockReturnValue(outsiderPlayer);

  const tree = render({
    event: buildOpenEvent({ capacity: 10 }),
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
    participationFlow: canActFlow,
  });

  expect(titlesOf(tree)).toEqual(['Participer']);
  expect(tree.root.findAllByType(Button)[0].props.disabled).toBe(false);
  expect(reasonsOf(tree)).toEqual([]);
});

test('R4/20 — la porte fermee s ecrit « Accès réservé », avec son accent', () => {
  const tree = render({
    event: buildOpenEvent({ sessionStatus: 'closed' }),
    onAbout: () => {},
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
    participationFlow: { canAct: false },
  });

  expect(tagsOf(tree)).toEqual(['Accès réservé']);
});

test('R4/21 — et quand le flux sait POURQUOI il refuse, il le dit', () => {
  const tree = render({
    event: buildOpenEvent({ sessionStatus: 'closed' }),
    onAbout: () => {},
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
    participationFlow: {
      blockedReason: 'Cet événement est déjà passé.',
      canAct: false,
    },
  });

  expect(tagsOf(tree)).toEqual(['Accès réservé']);
  expect(reasonsOf(tree)).toContain('Cet événement est déjà passé.');
});

test('R4/22 — 🔒 ACQUIS : sur une seance FERMEE, rien ne bouge pour le membre', () => {
  const tree = render({
    event: buildOpenEvent({ sessionStatus: 'closed' }),
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
    participationFlow: canActFlow,
  });

  expect(titlesOf(tree)).toEqual([
    'eventList.actions.present',
    'eventList.actions.absent',
  ]);
});
