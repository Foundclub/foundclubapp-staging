import fs from 'fs';
import path from 'path';

import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';

import EventAnswerButtons from '../EventAnswerButtons';

// FINITIONS13-STATS · POINT 6 (tournee T13, page du match du 3 oct.) — DEUX BOUTONS DE TROP
// EN BAS DE LA PAGE D UN MATCH.
//
// 🔎 Ce que la T13 a vu :
//   (a) PAPA TEST (role « Parent »), sur la page du match de son fils : un bouton
//       « Participer ». Il ne mene nulle part qui le concerne : un compte CONNECTE qui n est ni
//       joueur ni encadrant tombait dans la derniere branche, celle du visiteur NON connecte —
//       « Participer » ouvrait… la connexion.
//   (b) HUGO, convoque, sous un match TERMINE : « Je participe ! » et « Annuler ma
//       participation ». Le serveur refuse toute reponse apres coup (`validateDateIsInFuture`) ;
//       seule la porte « Je passe en present » (POINTAGE, reponse B) reste ouverte.
//
// 🎯 Ce que ce filet exige :
//   · un compte connecte sans reponse a donner n a AUCUN bouton ; le visiteur non connecte
//     garde « Participer » (vers la connexion) ;
//   · un match fini (l horloge du SERVEUR le dit, EventDetails le passe) n offre plus de
//     reponse — sauf « Je passe en present », quand la fiche l ouvre ;
//   · rien ne change avant la fin du match.

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

const HUGO = { documentId: 'compte-130', role: { name: USER_ROLES.player } };
const PAPA = { documentId: 'compte-papa', role: { name: USER_ROLES.parent } };

const canActFlow = { actionLabel: 'Participer', canAct: true };

/**
 * Le match U15 du 3 oct. : Hugo est dans l effectif, et il a repondu present.
 * @param {object} [overrides]
 * @returns {any} L evenement.
 */
const match = (overrides = {}) => ({
  capacity: 0,
  date: '2026-10-03T13:00:00.000Z',
  documentId: 'match-du-03-10',
  missings: [],
  participationRequests: [],
  participations: [{ documentId: HUGO.documentId }],
  sessionStatus: 'closed',
  team: {
    documentId: 'equipe-u15',
    name: 'U15',
    players: [{ documentId: HUGO.documentId }],
    trainers: [{ documentId: 'compte-134' }],
  },
  type: { name: 'Match' },
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

const gestes = {
  onDecline: () => {},
  onDeleteParticipation: () => {},
  onJoin: () => {},
  onLogin: () => {},
  onParticipate: () => {},
  participationFlow: canActFlow,
};

const titlesOf = (tree) => tree.root.findAllByType(Button).map((node) => node.props.title);
const tagsOf = (tree) => tree.root.findAllByType(Tag).map((node) => node.props.text);

describe('FINITIONS13-STATS 6 (a) — un parent connecte n a pas de « Participer »', () => {
  test('🔴 Papa Test, sur la page du match de son fils : aucun bouton', () => {
    mockUserData.mockReturnValue(PAPA);
    const tree = render({ ...gestes, event: match() });

    expect(titlesOf(tree)).toEqual([]);
  });

  test('🔒 le visiteur NON connecte garde « Participer », qui mene a la connexion', () => {
    mockUserData.mockReturnValue(null);
    const onLogin = jest.fn();
    const tree = render({ ...gestes, event: match(), onLogin });

    const boutons = tree.root.findAllByType(Button);
    expect(boutons.map((node) => node.props.title)).toEqual(['eventList.actions.join']);
    act(() => { boutons[0].props.onPress(); });
    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});

describe('FINITIONS13-STATS 6 (b) — sous un match TERMINE, plus de reponse', () => {
  beforeEach(() => {
    mockUserData.mockReturnValue(HUGO);
  });

  test('🔒 avant la fin : « Je participe ! » et « Annuler ma participation » (rien ne change)', () => {
    const tree = render({ ...gestes, event: match(), isFinished: false });

    expect(tagsOf(tree)).toEqual(['eventList.info.alreadyJoined']);
    expect(titlesOf(tree)).toEqual(['eventDetails.actions.cancelResponse']);
  });

  test('🔴 match fini : ni « Je participe ! », ni « Annuler ma participation »', () => {
    const tree = render({ ...gestes, event: match(), isFinished: true });

    expect(tagsOf(tree)).toEqual([]);
    expect(titlesOf(tree)).toEqual([]);
  });

  test('🔴 match fini, joueur dehors : plus de « Participer »', () => {
    mockUserData.mockReturnValue({ documentId: 'compte-dehors', role: { name: USER_ROLES.player } });
    const tree = render({ ...gestes, event: match({ participations: [] }), isFinished: true });

    expect(titlesOf(tree)).toEqual([]);
  });

  test('🔒 match fini : « Je passe en present » reste, quand la fiche l ouvre', () => {
    const tree = render({
      ...gestes,
      event: match({ participations: [] }),
      isFinished: true,
      onDeclareLatePresence: () => {},
    });

    expect(titlesOf(tree)).toEqual(['eventList.actions.declareLatePresence']);
  });

  test('la page du match passe bien « le match est fini » (horloge du serveur)', () => {
    // Lu dans la source : un seul montage du composant sur la page d un evenement.
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', 'views', 'event', 'EventDetails.js'),
      'utf8',
    );
    const montages = source.match(/<EventAnswerButtons[\s\S]*?\/>/g) || [];
    expect(montages).toHaveLength(1);
    expect(montages[0]).toMatch(/isFinished=\{isMatchFinished\}/);
  });
});
