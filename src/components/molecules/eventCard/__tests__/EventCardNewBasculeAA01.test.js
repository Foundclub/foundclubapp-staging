import renderer, { act } from 'react-test-renderer';

import { USER_ROLES } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';

import EventCardNew from '../EventCardNew';

// LOT AA01 (E6) — TEMOIN 4 : LA BASCULE DEPUIS UNE CARTE DE LISTE.
//
// 📏 MESURE DU 2026-08-20, AVANT CE LOT : `EventListContent` ne passait AUCUN
// `onDeleteParticipation` a ses cartes (`EventListContent.js`, bloc
// `renderItem`). Un joueur qui avait repondu « absent » y lisait donc
// l etiquette « Je serai absent·e » et n avait plus AUCUN bouton : la bascule
// n existait QUE sur la fiche. Le constat d Adel etait donc, sur ce chemin,
// pire que ce qu il decrivait — il n y avait meme pas de geste a faire.
//
// 🎯 Ce temoin verrouille le passe-plat : la carte offre le bouton des qu on lui
// donne de quoi le brancher, et elle reste MUETTE quand on ne lui donne rien
// (une carte de reservation, par exemple, n a pas de bascule de reponse).

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { linear: jest.fn() },
    useAnimatedStyle: (factory) => (typeof factory === 'function' ? factory() : {}),
    useSharedValue: (value) => ({ value }),
    withTiming: (value) => value,
  };
});

jest.mock('@/utils/imageUrl', () => ({ getImageUrl: (url) => url }));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));

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

// `t` rend la CLE quand aucun repli n est fourni : les assertions ne dependent
// donc pas de la copie de `fr.js`. Les deux libelles en jeu sont
// `eventList.info.alreadyMissing` (l etiquette) et
// `eventDetails.actions.editResponse` (le bouton de bascule).
jest.mock('react-i18next', () => ({
  initReactI18next: { init: jest.fn(), type: '3rdParty' },
  useTranslation: () => ({ t: (key, fallback) => fallback || key }),
}));

const mockUserData = jest.fn();
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData() }),
}));

// 🔒 `haveIAlreadyAnsweredNo` rend VRAI : c est tout le sujet du temoin — la
// carte d un joueur qui a repondu « absent ». Les deux autres fonctions gardent
// leur reponse par defaut.
jest.mock('@/domains/event/useEvent', () => ({
  __esModule: true,
  default: () => ({
    canEventBeJoined: () => true,
    haveIAlreadyAnsweredNo: () => true,
    haveIAlreadyJoined: () => false,
  }),
}));

const ME = 'me';
const playerUser = { documentId: ME, role: { name: USER_ROLES.player } };

const absentOnMyTeamEvent = {
  capacity: 14,
  date: '2099-08-26T17:00:00',
  documentId: 'evt-1',
  endTime: '19:00:00',
  missings: [{ documentId: ME }],
  participationRequests: [],
  participations: [],
  sessionStatus: 'closed',
  startTime: '17:00:00',
  team: {
    activities: [{ name: 'Football' }],
    club: { name: 'FC Marseille Nord' },
    documentId: 'team-1',
    name: 'Senior A',
    players: [{ documentId: ME }],
    trainers: [],
  },
  type: { name: 'Entrainement' },
  validationMode: 'manual',
};

const collectTexts = (node, acc = []) => {
  if (node === null || node === undefined) return acc;
  if (typeof node === 'string') {
    acc.push(node);
    return acc;
  }
  if (Array.isArray(node)) {
    node.forEach((child) => collectTexts(child, acc));
    return acc;
  }
  collectTexts(node.children, acc);
  return acc;
};

const renderCard = (props) => {
  let tree;
  act(() => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    tree = renderer.create(<EventCardNew {...props} />);
  });
  return tree;
};

// On cherche le BOUTON par son titre, pas un noeud de l arbre rendu : c est le
// contrat de `Button`, et il ne bouge pas quand son habillage change.
const findButton = (tree, title) => tree.root
  .findAllByType(Button)
  .find((node) => node.props.title === title);

describe('AA01/4 — la bascule existe aussi depuis une carte de liste', () => {
  beforeEach(() => {
    mockUserData.mockReturnValue(playerUser);
  });

  it('offre « Modifier ma reponse » a qui a repondu absent, branche sur onEditAnswer', () => {
    const onEditAnswer = jest.fn();
    const tree = renderCard({ item: absentOnMyTeamEvent, onEditAnswer });

    const texts = collectTexts(tree.toJSON()).join('\n');
    expect(texts).toContain('eventDetails.actions.editResponse');

    const bouton = findButton(tree, 'eventDetails.actions.editResponse');
    expect(bouton).toBeTruthy();
    act(() => {
      bouton.props.onPress();
    });

    expect(onEditAnswer).toHaveBeenCalledTimes(1);
  });

  it('reste muette quand l appelant ne branche rien — l etat d avant AA01', () => {
    const tree = renderCard({ item: absentOnMyTeamEvent });

    const texts = collectTexts(tree.toJSON()).join('\n');
    expect(texts).toContain('eventList.info.alreadyMissing');
    expect(texts).not.toContain('eventDetails.actions.editResponse');
  });
});
