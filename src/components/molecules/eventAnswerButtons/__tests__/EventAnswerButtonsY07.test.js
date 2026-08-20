import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';

import EventAnswerButtons from '../EventAnswerButtons';

// LOT Y07 (E6) — TEMOINS sur « un encadrant ne repond plus Present / Absent ».
//
// GO Adel du 2026-08-20 : « Non, ca ne sert a rien que les entraineurs
// repondent present / absent. » Seuls les JOUEURS repondent.
//
// Ecrits ROUGES contre le code d origine (preuve : Y07-e6-ROUGE.log).
//
// 🧨 CE QUE CES TEMOINS SURVEILLENT EN PLUS DU RETRAIT : le « bouton gris ».
// `EventAnswerButtons` appelle `canEventBeJoined` SANS lui passer `type`, et
// cette fonction exige le role Joueur des que `capacity > 0`
// (`eventUseCases.js:712-718`). Un encadrant tombait donc sur un bouton ETEINT,
// et la phrase d a-cote exigeait `!canAct` — qui valait `true`. Eteint, et muet.
// ⛔ Retirer la rangee sans traiter ce chemin ferait revenir ce bouton tel quel.

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

const coach = { documentId: COACH_ID, role: { name: USER_ROLES.coach } };
const playerUser = { documentId: PLAYER_ID, role: { name: USER_ROLES.player } };

/**
 * L equipe conviee : le joueur est dans `players`, l encadrant dans `trainers`
 * et lui seul. C est exactement la forme que le serveur lit.
 * @param {object} [overrides]
 * @returns {any} L evenement de test.
 */
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
    trainers: [{ documentId: COACH_ID }],
  },
  type: { name: 'Entrainement' },
  ...overrides,
});

const render = (props) => {
  let tree = null;
  act(() => {
    tree = renderer.create(<EventAnswerButtons {...props} />);
  });
  return tree;
};

const titlesOf = (tree) => tree.root.findAllByType(Button).map((button) => button.props.title);
const textsOf = (tree) => tree.root.findAllByType(Text)
  .map((node) => node.props.children)
  .filter((child) => typeof child === 'string');

// ---------------------------------------------------------------------------
// 1 & 2 — L ENCADRANT NE VOIT AUCUN BOUTON DE REPONSE
// ---------------------------------------------------------------------------

test('Y07/1 — sur la FICHE, un entraineur membre d une equipe conviee : aucun bouton', () => {
  mockUserData.mockReturnValue(coach);

  const tree = render({
    event: buildEvent(),
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  const titles = titlesOf(tree);
  expect(titles).not.toContain('eventList.actions.present');
  expect(titles).not.toContain('eventList.actions.absent');
});

test('Y07/2 — sur une CARTE de liste (planning compris), il n en voit pas davantage', () => {
  mockUserData.mockReturnValue(coach);

  // La carte monte le composant avec `onAbout` et SANS `onEdit`/`onCancel` —
  // c est la forme reelle d EventCardNew.js:606.
  const tree = render({
    event: buildEvent(),
    onAbout: () => {},
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  const titles = titlesOf(tree);
  expect(titles).not.toContain('eventList.actions.present');
  expect(titles).not.toContain('eventList.actions.absent');
});

// ---------------------------------------------------------------------------
// 3 & 4 — LA CHARGE UTILE REELLE DES LISTES : NI `players`, NI `trainers`
// ---------------------------------------------------------------------------
//
// 🧨 LE TROU QUE CES DEUX TEMOINS BOUCHENT, ET IL VALAIT CHER.
// Les temoins 1 et 2 ci-dessus montent un evenement dont l equipe porte
// `players` et `trainers`. C est la forme de la FICHE — et la fiche est
// justement la seule surface ou le serveur pose `viewerCanRespond`
// (`event.ts:1695`). Ils ne pouvaient donc pas voir le defaut.
//
// Les CARTES, elles, sont peuplees par `buildCompactEventCardPopulate`
// (`services/event/eventService.js:674`) : `team` n y descend que
// `documentId`, `name`, `activities`, `category`, `club`, `level`, `section`.
// ⛔ NI `players`, NI `trainers`. L appartenance ne peut alors se lire que
// sur le PROFIL — `myTeams` pour la joueuse, `trainedTeams` pour l encadrante,
// qui sont les deux faces des memes relations Strapi (`team.players` est
// declare `inversedBy: 'myTeams'`).
//
// Une premiere version de la regle ne lisait que `sourceTeam.players` : sur ces
// cartes elle repondait « pas dans players » pour TOUT LE MONDE, et disait donc
// « tu encadres cet evenement » a CHAQUE JOUEUR de chaque liste. Le temoin 3
// est ce joueur-la.
const buildCardEvent = (overrides = {}) => buildEvent({
  team: { documentId: 'team-1', name: 'Senior A' },
  ...overrides,
});

test('Y07/3 🔒 — sur une carte SANS `players`, le JOUEUR garde ses boutons', () => {
  mockUserData.mockReturnValue({ ...playerUser, myTeams: [{ documentId: 'team-1' }] });

  const tree = render({
    event: buildCardEvent(),
    onAbout: () => {},
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  const titles = titlesOf(tree);
  expect(titles).toContain('eventList.actions.present');
  expect(titles).toContain('eventList.actions.absent');
  expect(textsOf(tree)).not.toContain('eventList.info.staffDoesNotRsvp');
});

test('Y07/4 — sur cette meme carte, l ENCADRANTE lit bien la phrase', () => {
  mockUserData.mockReturnValue({ ...coach, trainedTeams: [{ documentId: 'team-1' }] });

  const tree = render({
    event: buildCardEvent(),
    onAbout: () => {},
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  const titles = titlesOf(tree);
  expect(titles).not.toContain('eventList.actions.present');
  expect(titles).not.toContain('eventList.actions.absent');
  expect(textsOf(tree)).toContain('eventList.info.staffDoesNotRsvp');
});

// ---------------------------------------------------------------------------
// 5 & 6 — CE QUI NE DOIT PAS BOUGER
// ---------------------------------------------------------------------------

test('Y07/5 — un JOUEUR repond toujours, exactement comme avant', () => {
  mockUserData.mockReturnValue(playerUser);

  const tree = render({
    event: buildEvent(),
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  const titles = titlesOf(tree);
  expect(titles).toContain('eventList.actions.present');
  expect(titles).toContain('eventList.actions.absent');
});

test('Y07/6 — un encadrant COCHE DANS LA COMPO (donc dans les joueurs) repond toujours', () => {
  // 🎯 LE CAS LIMITE DU LOT. Le coach ne peut cocher quelqu un dans la compo que
  // s il est dans `team.players` (`event-composition.ts:234` et
  // `MatchCallUpSelection.js:146-160` ne listent jamais les `trainers`). Un
  // coach-joueur est donc dans `players` : a ce moment-la il n est pas
  // encadrant, il est JOUEUR de ce match. ⛔ Le lui interdire le rendrait
  // injoignable, et Adel n a jamais demande ca.
  mockUserData.mockReturnValue(coach);

  const event = buildEvent();
  const tree = render({
    event: {
      ...event,
      team: { ...event.team, players: [{ documentId: PLAYER_ID }, { documentId: COACH_ID }] },
    },
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  const titles = titlesOf(tree);
  expect(titles).toContain('eventList.actions.present');
  expect(titles).toContain('eventList.actions.absent');
});

// ---------------------------------------------------------------------------
// 7 — LE TEMOIN QUI GARDE LE BOUTON GRIS FERME
// ---------------------------------------------------------------------------

test('Y07/7 — a la place des boutons, une PHRASE : jamais un bouton eteint, jamais rien', () => {
  mockUserData.mockReturnValue(coach);

  // `capacity > 0` et session OUVERTE : c est la combinaison EXACTE qui
  // fabriquait le bouton gris (`canEventBeJoined` exige le role Joueur).
  const tree = render({
    event: buildEvent({ capacity: 12, sessionStatus: 'open' }),
    onDecline: () => {},
    onJoin: () => {},
    onLogin: () => {},
    onParticipate: () => {},
  });

  // a) une phrase est lue
  expect(textsOf(tree)).toContain('eventList.info.staffDoesNotRsvp');

  // b) AUCUN bouton eteint — c est le defaut d origine, il ne doit pas renaitre
  const buttons = tree.root.findAllByType(Button);
  expect(buttons.filter((button) => button.props.disabled)).toHaveLength(0);

  // c) et l ecran n est pas vide non plus
  expect(tree.toJSON()).not.toBeNull();
});
