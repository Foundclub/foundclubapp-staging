/* eslint-disable max-len -- témoin C06 : fils et attentes gardés sur une ligne */
import renderer, { act } from 'react-test-renderer';

import ShareEventModal from '@/components/organisms/shareEventModal/ShareEventModal';

// C06 / Q3-12 — « Partager dans une discussion » : les trois fenêtres de partage proposent les
// fils où la personne peut écrire. Elles avaient chacune une copie locale de la règle,
// différente de celle du domaine (`canWriteInChat`). Les cas « caractérisation » étaient verts
// avant le correctif ; les cas Q3-12 étaient rouges.

/** @type {any[]} */
let mockFils = [];

jest.mock('@shopify/flash-list', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    FlashList: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      (props.data || []).map((/** @type {any} */ item) => reactActuel.createElement(
        VueRN,
        { key: item.documentId },
        props.renderItem({ item }),
      )),
    ),
  };
});
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (typeof repli === 'string' ? repli : cle),
  }),
}));
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
const mockAuth = {
  allMyTeams: [],
  hasClubAccess: (/** @type {string} */ id) => ['club-foot', 'section-hand'].includes(id),
  userData: {
    club: { documentId: 'club-foot' },
    documentId: 'moi',
    role: { name: 'Dirigeant', type: 'dirigeant' },
  },
};
jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockAuth }));
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ getConversationName: (/** @type {any} */ e) => `fil:${e.chatGroupName}` }),
}));
jest.mock('@/services/chat/chatQueriesCompat', () => ({
  useGetChats: () => ({
    data: { pages: [{ data: mockFils }] }, error: null, isLoading: false,
  }),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() }, share: jest.fn() }));
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => (/** @type {any} */ props) => props.children || null,
);
jest.mock('@/components/atoms/button/Button', () => () => null);
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);

// FICHE-MINIS (19/11/2026, chef, question 9 de FICHE-TOURNOI) — la feuille « Partager » d'un
// tournoi s'ouvre maintenant depuis la fiche, pour tous, visiteur sans compte compris : sans
// aucune conversation où écrire, la section « Partager dans une conversation » ne s'affiche plus
// (le visiteur lisait « Aucune conv disponible. »). Le partage par lien reste.
const textes = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.props?.children === 'string')
  .map((/** @type {any} */ n) => n.props.children);
const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ShareEventModal event={{ documentId: 'ev-1', name: 'Tournoi' }} isVisible onClose={jest.fn()} onSelectChat={jest.fn()} />,
    );
  });
  return arbre;
};

describe('FICHE-MINIS · la section des conversations de la feuille « Partager »', () => {
  test('🔴 aucune conversation : ni « Partager dans une conversation », ni « Aucune conv disponible. »', () => {
    mockFils = [];
    const arbre = monter();
    const lu = textes(arbre);
    expect(lu).not.toContain('Partager dans une conversation');
    expect(lu).not.toContain('Aucune conv disponible.');
    expect(lu).toContain('Lien externe');
    act(() => arbre.unmount());
  });

  test('avec une conversation : la section et la conversation restent', () => {
    mockFils = [{
      chatGroupName: 'equipe', documentId: 'f1', groupName: 'f1', participants: [], type: 'whisper', updatedAt: '2026-10-20T10:00:00.000Z',
    }];
    const arbre = monter();
    const lu = textes(arbre);
    expect(lu).toContain('Partager dans une conversation');
    act(() => arbre.unmount());
  });
});
