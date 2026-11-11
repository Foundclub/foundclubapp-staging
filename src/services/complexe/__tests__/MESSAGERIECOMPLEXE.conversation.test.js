import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import '@/theme/strings';
import { getConversationName } from '@/domains/messaging/messagingUseCases';

import { createChatMessage } from '@/services/chat/chatService';
import client from '@/services/client';

import { useEcrireAuReserveur } from '../complexeQueries';
import {
  ecrireLePremierMessageAuClient,
  trouverConversationDuClient,
} from '../complexeService';

// MESSAGERIE-COMPLEXE (10/11/2026, ligne Gérant 47 / M1137 de la feuille « Suivi des tests ») —
// Adel, gérant de « Five EDLV 2 » : « Écrire au réserveur » posait la conversation AVANT tout
// message, et elle n'apparaissait pas dans sa liste Messages (la liste n'était pas relue). Puis,
// côté joueur, le fil portait le prénom et le nom du gérant au lieu de « Gérant - Five EDLV 2 ».
//   1. le GET retrouve le fil sans le créer ; le POST n'est fait qu'avec le premier message ;
//   2. la liste des conversations est RELUE (même en veille) dès qu'un fil s'ouvre ;
//   3. le titre : « Gérant - <complexe> » chez le client, le nom du client chez le gérant.

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('@/services/chat/chatService', () => ({
  createChatMessage: jest.fn(async () => ({ data: { documentId: 'm-1' } })),
}));

const mockClient = /** @type {any} */ (client);
const mockMessage = /** @type {any} */ (createChatMessage);

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.get.mockResolvedValue({ data: { data: { chat: null } } });
  mockClient.post.mockResolvedValue({ data: { data: { chat: 'chat-154' } } });
});

const CHEMIN = '/complexes/cx-five/reservations/r-48/conversation';

describe(
  'MESSAGERIE-COMPLEXE — le service : retrouver sans créer, créer au premier message',
  () => {
    it('trouverConversationDuClient : un GET, jamais un POST', async () => {
      const rendu = await trouverConversationDuClient('cx-five', 'r-48');
      expect(rendu).toEqual({ data: { chat: null } });
      expect(mockClient.get).toHaveBeenCalledWith(CHEMIN);
      expect(mockClient.post).not.toHaveBeenCalled();
    });

    it('ecrireLePremierMessageAuClient : le POST crée le fil, puis le message y part', async () => {
      const rendu = await ecrireLePremierMessageAuClient({
        complexeId: 'cx-five', message: 'Salut !', reservationId: 'r-48',
      });
      expect(rendu).toEqual({ data: { chat: 'chat-154' } });
      expect(mockClient.post).toHaveBeenCalledWith(CHEMIN, {});
      expect(mockMessage).toHaveBeenCalledWith({ chatId: 'chat-154', message: 'Salut !' });
    });
  },
);

/**
 * Monte le crochet dans un vrai client react-query.
 * @returns {Promise<{ queryClient: QueryClient, valeur: () => any }>} Le client et le crochet.
 */
const monter = async () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  let courant = /** @type {any} */ (null);
  /**
   * Garde le crochet sous la main.
   * @returns {null} Rien à dessiner.
   */
  function Sonde() {
    courant = useEcrireAuReserveur();
    return null;
  }
  await act(async () => {
    renderer.create(
      createElement(QueryClientProvider, { client: queryClient }, createElement(Sonde)),
    );
  });
  return { queryClient, valeur: () => courant };
};

describe('MESSAGERIE-COMPLEXE — le crochet « Écrire au client »', () => {
  it('sans message : il retrouve (GET) et ne crée rien ; aucun fil ⇒ rien à relire', async () => {
    const { queryClient, valeur } = await monter();
    const relire = jest.spyOn(queryClient, 'refetchQueries');
    let rendu;
    await act(async () => {
      rendu = await valeur().mutateAsync({ complexeId: 'cx-five', reservationId: 'r-48' });
    });
    expect(rendu).toEqual({ data: { chat: null } });
    expect(mockClient.post).not.toHaveBeenCalled();
    expect(relire).not.toHaveBeenCalled();
  });

  it(
    'avec le premier message : le fil naît, et la liste des conversations est RELUE (en veille'
      + ' aussi)',
    async () => {
      const { queryClient, valeur } = await monter();
      const relire = jest.spyOn(queryClient, 'refetchQueries');
      await act(async () => {
        await valeur().mutateAsync({
          complexeId: 'cx-five', message: 'Salut !', reservationId: 'r-48',
        });
      });
      expect(mockMessage).toHaveBeenCalledWith({ chatId: 'chat-154', message: 'Salut !' });
      expect(relire).toHaveBeenCalledWith({ queryKey: ['chats'], type: 'all' });
    },
  );

  it(
    'un fil qui existe déjà : la liste est relue aussi (elle a pu être gardée d’avant)',
    async () => {
      mockClient.get.mockResolvedValue({ data: { data: { chat: 'chat-154' } } });
      const { queryClient, valeur } = await monter();
      const relire = jest.spyOn(queryClient, 'refetchQueries');
      await act(async () => {
        await valeur().mutateAsync({ complexeId: 'cx-five', reservationId: 'r-48' });
      });
      expect(relire).toHaveBeenCalledWith({ queryKey: ['chats'], type: 'all' });
    },
  );
});

describe('MESSAGERIE-COMPLEXE — le titre du fil complexe ↔ client', () => {
  const fil = {
    chatGroupAdmins: [{ documentId: 'u-gerant' }],
    chatGroupName: 'Five EDLV 2',
    chatParticipants: [
      { documentId: 'u-dorian', firstname: 'Dorian', lastname: 'Cocequet' },
      { documentId: 'u-gerant', firstname: 'Adel', lastname: 'F' },
    ],
    chatType: 'whisper',
  };

  it('chez le CLIENT : « Gérant - <complexe> », pas la personne du gérant', () => {
    expect(getConversationName({ ...fil, meId: 'u-dorian' })).toBe('Gérant - Five EDLV 2');
  });

  it('chez le GÉRANT : le nom du client', () => {
    expect(getConversationName({ ...fil, meId: 'u-gerant' })).toBe('Dorian Cocequet');
  });

  it('un tête-à-tête ordinaire (ni nom ni côté) : la personne d’en face, comme avant', () => {
    expect(getConversationName({
      chatParticipants: fil.chatParticipants, chatType: 'whisper', meId: 'u-dorian',
    })).toBe('Adel F');
  });
});
