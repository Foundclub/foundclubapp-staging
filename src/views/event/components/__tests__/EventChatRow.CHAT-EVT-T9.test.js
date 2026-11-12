import renderer, { act } from 'react-test-renderer';

import { getEventChatState } from '@/services/chat/chatService';

import EventChatRow from '../EventChatRow';

// ==========================================================================
// CHAT-EVT-T9 (12/11, M1205, demande du chef « a ») — QUAND LA RANGEE NE PEUT PAS LIRE SON ETAT.
// Au site, le service n'etait pas charge (un `require` que Vite ne traduit pas) : l'appel levait
// une TypeError, avalee par `.catch(() => {})`. La rangee disparaissait sans aucune trace, et
// personne ne l'a vu de deux trains. Ce que ces temoins fixent :
//   · service introuvable (la fonction n'existe pas) : la fiche ne casse pas, la rangee reste
//     vide, MAIS un avertissement nomme l'evenement et l'erreur ;
//   · serveur qui refuse (403, hors ligne) : meme chose.
// ==========================================================================

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
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

const monter = async () => {
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <EventChatRow eventDocumentId="evt-3436" navigation={{ navigate: jest.fn() }} />,
    );
  });
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((r) => { setTimeout(r, 0); }); });
  }
  return arbre;
};

// Le poste est partage par plusieurs sessions : 5 s ne suffisent pas toujours a monter l'arbre.
jest.setTimeout(30_000);

/** @type {jest.SpyInstance} */
let avertissements;
beforeEach(() => {
  getEventChatState.mockReset();
  avertissements = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { avertissements.mockRestore(); });

const avertissementsDuChat = () => avertissements.mock.calls
  .filter((appel) => String(appel[0]).includes('[event-chat-row]'));

test('service introuvable : rangee vide, fiche intacte, et un avertissement le dit', async () => {
  getEventChatState.mockImplementation(() => {
    throw new TypeError('getEventChatState is not a function');
  });
  const arbre = await monter();
  expect(arbre.toJSON()).toBeNull();
  expect(avertissementsDuChat()).toHaveLength(1);
  expect(avertissementsDuChat()[0][1]).toEqual({
    erreur: 'getEventChatState is not a function',
    eventDocumentId: 'evt-3436',
  });
});

test('serveur qui refuse : la rangee reste vide, et un avertissement le dit', async () => {
  const refus = Object.assign(new Error('Request failed with status code 403'), { status: 403 });
  getEventChatState.mockRejectedValue(refus);
  const arbre = await monter();
  expect(arbre.toJSON()).toBeNull();
  expect(avertissementsDuChat()).toHaveLength(1);
  expect(avertissementsDuChat()[0][1].erreur).toBe('Request failed with status code 403');
});

test('le temoin du temoin : un etat lu ne produit aucun avertissement', async () => {
  getEventChatState.mockResolvedValue({
    chat: null,
    estMembre: true,
    estUnMatch: false,
    nombre: { membres: 0, staff: 1 },
    peutOuvrir: true,
  });
  const arbre = await monter();
  expect(arbre.toJSON()).not.toBeNull();
  expect(avertissementsDuChat()).toHaveLength(0);
});
