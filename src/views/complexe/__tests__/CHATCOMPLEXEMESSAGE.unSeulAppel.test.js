import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import renderer, { act } from 'react-test-renderer';

import EcrireAuClient from '@/views/complexe/components/EcrireAuClient';

import { createChatMessage } from '@/services/chat/chatService';
import client from '@/services/client';

import { parRepere } from '@/testSupport/temoinComplexe';

// CHAT-COMPLEXE-MESSAGE (D64, train 12, 15/11/2026) — « Écrire au client » (le gérant), de l'appui
// au premier envoi, avec le VRAI crochet et le VRAI service : seul le client HTTP est une doublure.
// Avant : le premier envoi faisait POST de la conversation avec `{}`, PUIS POST /chat-messages ; un
// arrêt entre les deux laissait un fil VIDE chez le client. Maintenant :
//   1. ouvrir (l'appui) sans écrire ne fait AUCUN appel de création (un GET seul) ;
//   2. le premier envoi fait UN seul appel, le POST de la conversation avec `firstMessage`.

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('@/services/chat/chatService', () => ({
  createChatMessage: jest.fn(async () => ({ data: { documentId: 'm-1' } })),
}));
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: Saisie } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { onChangeText, testID, value }) {
    return <Saisie onChangeText={onChangeText} testID={testID} value={value} />;
  };
});
jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

jest.setTimeout(60000);

const mockClient = /** @type {any} */ (client);
const mockMessage = /** @type {any} */ (createChatMessage);
const mockNavigate = jest.fn();
const CHEMIN = '/complexes/cx-five/reservations/r-48/conversation';

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.get.mockResolvedValue({ data: { data: { chat: null } } });
  mockClient.post.mockResolvedValue({ data: { data: { chat: 'chat-154' } } });
});

const monter = async () => {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={queryClient}>
        <EcrireAuClient
          complexeId="cx-five"
          navigation={{ navigate: mockNavigate }}
          reservationId="r-48"
          testID="fiche-ecrire"
          title="Écrire au client"
        />
      </QueryClientProvider>,
    );
  });
  return arbre;
};

/**
 * Appuie sur le premier élément pressable DANS le repère.
 * @param {any} arbre - L'arbre.
 * @param {string} testID - Le repère.
 * @returns {Promise<void>} Fini.
 */
const appuyerDans = async (arbre, testID) => {
  const cible = parRepere(arbre, testID)
    .findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function')[0];
  await act(async () => {
    cible.props.onPress();
  });
};

describe('CHAT-COMPLEXE-MESSAGE — « Écrire au client », de l’appui au premier envoi', () => {
  it('ouvrir sans écrire : AUCUN appel de création (un GET seul, aucun POST)', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-ecrire');
    expect(mockClient.get).toHaveBeenCalledWith(CHEMIN);
    expect(mockClient.post).not.toHaveBeenCalled();
    expect(mockMessage).not.toHaveBeenCalled();
    expect(parRepere(arbre, 'fiche-ecrire-saisie')).not.toBeNull();
  });

  it('le premier envoi : UN seul appel, le POST avec firstMessage ; le fil s’ouvre', async () => {
    const arbre = await monter();
    await appuyerDans(arbre, 'fiche-ecrire');
    await act(async () => {
      parRepere(arbre, 'fiche-ecrire-premier-message').props.onChangeText('  Salut !  ');
    });
    await appuyerDans(arbre, 'fiche-ecrire-envoyer');
    expect(mockClient.post).toHaveBeenCalledTimes(1);
    expect(mockClient.post).toHaveBeenCalledWith(CHEMIN, { data: { firstMessage: 'Salut !' } });
    expect(mockMessage).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('Conversation', {
      chatId: 'chat-154', espace: 'complexe',
    });
  });
});
