import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import canWriteInChat from '@/domains/messaging/canWriteInChat';
import { getConversationName } from '@/domains/messaging/messagingUseCases';

import { getEventChatState, openEventChat } from '@/services/chat/chatService';

import EventChatRow from '../EventChatRow';

// ==========================================================================
// CONVERSATION-EVENEMENT (10/11/2026) — LA RANGEE DE LA FICHE, d apres la maquette validee.
//   · un coach (staff) voit « Ouvrir le chat de l'événement » et l ouvre ;
//   · un joueur ne voit pas le bouton ; une fois le chat ouvert, s il en est membre, il a le
//     raccourci « Chat de l'événement » (« 3- B ») ;
//   · un 2e appui ouvre le meme chat, sans en recreer ;
//   · un dirigeant hors de l equipe (le serveur le dit : ni staff, ni membre) : rien (« 1- B ») ;
//   · un match : « les N convoqués » ; sans compo publiee : le staff seul ;
//   · un entrainement : les invites.
// ==========================================================================

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ _key, /** @type {any} */ fallback, /** @type {any} */ values) => (
      String(typeof fallback === 'string' ? fallback : _key).replace(/\{\{(\w+)\}\}/g, (_m, k) => String(values?.[k] ?? ''))
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Spaces,
    }),
  };
});

jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));

jest.mock('@/services/chat/chatService', () => ({
  getEventChatState: jest.fn(),
  openEventChat: jest.fn(),
}));

const RIVES = 'Match vs FC des Rives';

const etat = (champs) => ({
  chat: null,
  estMembre: false,
  estUnMatch: true,
  nombre: { membres: 14, staff: 2 },
  peutOuvrir: false,
  ...champs,
});

const monter = async (etatServeur) => {
  getEventChatState.mockResolvedValue(etatServeur);
  const navigation = { navigate: jest.fn() };
  let arbre;
  await act(async () => {
    arbre = renderer.create(<EventChatRow eventDocumentId="match-1" navigation={navigation} />);
  });
  const attendre = async () => {
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
    }
  };
  await attendre();
  const textes = () => arbre.root.findAllByType(Text)
    .map((n) => [].concat(n.props.children).join(''));
  const rangee = () => arbre.root
    .findAll((n) => n.props.testID === 'event-chat-row' && n.props.onPress);
  return {
    arbre, attendre, navigation, rangee, textes,
  };
};

beforeEach(() => {
  getEventChatState.mockReset();
  openEventChat.mockReset();
});

test('un coach voit « Ouvrir le chat de l’événement » et l’ouvre', async () => {
  openEventChat.mockResolvedValue({ chat: { documentId: 'chat-9', title: RIVES }, cree: true });
  const {
    attendre, navigation, rangee, textes,
  } = await monter(etat({ peutOuvrir: true }));
  expect(textes()).toEqual(['Ouvrir le chat de l’événement', 'Avec le staff et les 14 convoqués']);
  await act(async () => { rangee()[0].props.onPress(); });
  await attendre();
  expect(openEventChat).toHaveBeenCalledWith('match-1');
  expect(navigation.navigate).toHaveBeenCalledWith('Conversation', {
    chatId: 'chat-9', chatType: 'event', title: 'Match vs FC des Rives',
  });
});

test('un joueur ne voit pas le bouton', async () => {
  const { rangee, textes } = await monter(etat({ estMembre: true }));
  expect(rangee()).toHaveLength(0);
  expect(textes()).toEqual([]);
});

test('chat ouvert : le joueur membre a le raccourci, sans rien recreer', async () => {
  const { navigation, rangee, textes } = await monter(etat({
    chat: { documentId: 'chat-9', title: 'Match vs FC des Rives' }, estMembre: true,
  }));
  expect(textes()).toEqual(['Chat de l’événement', '16 membres']);
  await act(async () => { rangee()[0].props.onPress(); });
  expect(openEventChat).not.toHaveBeenCalled();
  expect(navigation.navigate)
    .toHaveBeenCalledWith('Conversation', expect.objectContaining({ chatId: 'chat-9' }));
});

test('un 2e appui du coach ouvre le meme chat', async () => {
  const { navigation, rangee } = await monter(etat({
    chat: { documentId: 'chat-9', title: RIVES },
    estMembre: true,
    peutOuvrir: true,
  }));
  await act(async () => { rangee()[0].props.onPress(); });
  await act(async () => { rangee()[0].props.onPress(); });
  expect(openEventChat).not.toHaveBeenCalled();
  expect(navigation.navigate.mock.calls.map((c) => c[1].chatId)).toEqual(['chat-9', 'chat-9']);
});

test('un dirigeant hors de l’équipe : rien, même quand le chat existe', async () => {
  const { rangee } = await monter(etat({ chat: null, estMembre: false, peutOuvrir: false }));
  expect(rangee()).toHaveLength(0);
});

test('match sans compo publiee : le staff seul ; entrainement : tous les invites', async () => {
  expect((await monter(etat({ nombre: { membres: 0, staff: 2 }, peutOuvrir: true }))).textes()[1])
    .toBe('Le staff seulement pour l’instant : les convoqués entreront à la publication');
  const entrainement = etat({
    estUnMatch: false, nombre: { membres: 22, staff: 2 }, peutOuvrir: true,
  });
  expect((await monter(entrainement)).textes()[1])
    .toBe('Avec le staff et les 22 invités, qu’ils aient répondu ou non');
});

test('la messagerie nomme le chat et laisse ecrire ses membres', () => {
  expect(getConversationName({ chatGroupName: RIVES, chatType: 'event' })).toBe(RIVES);
  const joueur = { documentId: 'p1', role: { type: 'joueur' } };
  expect(canWriteInChat({ chat: { type: 'event' }, hasClubAccess: () => false, user: joueur }))
    .toBe(true);
});
