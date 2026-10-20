// ==========================================================================
// MSG-SUPPORT (20/10/2026) — LA CONVERSATION « ASSISTANCE FOUNDCLUB », côté app : les règles.
//
//   1. le type `assistance` passe la validation du service (sinon `getChatById` JETTE : en-tête
//      de la conversation cassé, saisie fermée) et celle de la liste (sinon la page entière tombe
//      dans le repli non validé, avec un avertissement) ;
//   2. son nom est « Assistance FoundClub » ;
//   3. son titulaire y écrit (la saisie n'est pas fermée) ;
//   4. la liste la met à part (épinglée), et reconnaît une réponse de l'équipe à sa signature.
// ==========================================================================

const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: mockGet },
}));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({ emitGuidanceAction: jest.fn() }));

const mockLoggerWarn = jest.fn();
jest.mock('@/utils/logger/logger', () => ({
  createLogger: jest.fn(() => ({ info: jest.fn(), warn: mockLoggerWarn })),
}));

const {
  estFilDAssistance,
  estReponseDeLAssistance,
  nomCourt,
  separerLeFilDAssistance,
  titulaireDuFil,
} = require('@/domains/messaging/assistance');
const canWriteInChat = require('@/domains/messaging/canWriteInChat').default;
const { getConversationName } = require('@/domains/messaging/messagingUseCases');

const { getChatById, getChats } = require('@/services/chat/chatService');

const FIL = {
  createdAt: '2026-10-20T15:00:00.000Z',
  documentId: 'fil-assistance',
  messages: [],
  participants: [{ documentId: 'lina', firstname: 'Lina', lastname: 'Moreau' }],
  type: 'assistance',
  updatedAt: '2026-10-20T15:00:00.000Z',
};
const REPONSE = {
  documentId: 'm-2',
  message: 'On regarde',
  sender: { documentId: 'assistance-foundclub', firstname: 'Assistance', lastname: 'FoundClub' },
  senderSignature: { nom: 'Assistance FoundClub', voix: 'assistance' },
};

beforeEach(() => { jest.clearAllMocks(); });

describe('MSG-SUPPORT 1 — le type passe la validation du service', () => {
  test('getChatById rend la conversation d\'assistance (pas d\'exception)', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: FIL } });
    await expect(getChatById('fil-assistance')).resolves.toMatchObject({ type: 'assistance' });
  });

  test('getChats valide une page qui la contient, sans avertissement', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [FIL],
        meta: {
          pagination: {
            page: 1, pageCount: 1, pageSize: 20, total: 1,
          },
        },
      },
    });
    const page = await getChats(1, 20);
    expect(mockLoggerWarn).not.toHaveBeenCalled();
    expect(page.data[0].type).toBe('assistance');
  });
  // L'appel POST /assistance/ma-conversation : le service charge son client À L'APPEL
  // (`await import`), que jest n'exécute pas (mémoire piege-jest-import-dynamique) ; le témoin
  // navigateur du site le voit passer (web tests/components/msgsup-assistance.spec.ts).
});

describe('MSG-SUPPORT 2-3 — son nom, et son titulaire y écrit', () => {
  test('nom : « Assistance FoundClub »', () => {
    expect(getConversationName({
      chatParticipants: FIL.participants, chatType: 'assistance', meId: 'lina',
    }))
      .toBe('Assistance FoundClub');
  });

  test('la saisie est ouverte (titulaire, mineur compris : le serveur garde la porte)', () => {
    const lina = { documentId: 'lina', role: { type: 'joueur' } };
    expect(canWriteInChat({ chat: FIL, user: lina })).toBe(true);
  });
});

describe('MSG-SUPPORT 4 — la liste la met à part, et reconnaît l\'équipe', () => {
  test('séparée des autres fils, sans rien perdre ni doubler', () => {
    const autres = [{ documentId: 'a', type: 'whisper' }, { documentId: 'b', type: 'team' }];
    const { autres: reste, filDAssistance } = separerLeFilDAssistance([autres[0], FIL, autres[1]]);
    expect(filDAssistance).toBe(FIL);
    expect(reste).toEqual(autres);
    expect(separerLeFilDAssistance(autres).filDAssistance).toBeNull();
    expect(separerLeFilDAssistance(undefined)).toEqual({ autres: [], filDAssistance: null });
  });

  test('une réponse de l\'équipe se reconnaît à sa signature, pas à son nom', () => {
    expect(estReponseDeLAssistance(REPONSE)).toBe(true);
    const deLaVille = { ...REPONSE, senderSignature: { nom: 'Ville', voix: 'ville' } };
    expect(estReponseDeLAssistance(deLaVille)).toBe(false);
    const seulementLeNom = { sender: { firstname: 'Assistance', lastname: 'FoundClub' } };
    expect(estReponseDeLAssistance(seulementLeNom)).toBe(false);
    expect(estFilDAssistance(FIL)).toBe(true);
    expect(estFilDAssistance('assistance')).toBe(true);
    expect(estFilDAssistance({ type: 'whisper' })).toBe(false);
  });

  test('le titulaire, et le nom court de l\'admin pour la console', () => {
    expect(titulaireDuFil(FIL)).toEqual(FIL.participants[0]);
    expect(titulaireDuFil({})).toBeNull();
    expect(nomCourt({ firstname: 'Sophie', lastname: 'admin' })).toBe('Sophie A.');
    expect(nomCourt(null)).toBe('');
  });
});
