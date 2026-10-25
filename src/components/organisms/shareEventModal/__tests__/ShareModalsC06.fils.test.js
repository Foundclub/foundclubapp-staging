import renderer, { act } from 'react-test-renderer';

import ShareCardModal from '@/components/organisms/shareCardModal/ShareCardModal';
import ShareCompositionModal from '@/components/organisms/shareCompositionModal/ShareCompositionModal';
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
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => () => null);

const fil = (/** @type {string} */ id, /** @type {Record<string, any>} */ plus) => ({
  documentId: id, groupName: id, participants: [], updatedAt: '2026-10-20T10:00:00.000Z', ...plus,
});

const FENETRES = [
  ['ShareCardModal', ShareCardModal, {}],
  ['ShareEventModal', ShareEventModal, { event: { documentId: 'ev-1', name: 'Match' } }],
  ['ShareCompositionModal', ShareCompositionModal, {
    composition: { documentId: 'compo-1' }, event: { documentId: 'ev-1', name: 'Match' },
  }],
];

/**
 * Les fils proposés par une fenêtre.
 * @param {any} Fenetre - Le composant.
 * @param {any} props - Ses props en plus.
 * @returns {string[]} Les identifiants des fils proposés.
 */
const filsProposes = (Fenetre, props) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <Fenetre isVisible onClose={jest.fn()} onSelectChat={jest.fn()} {...props} />,
    );
  });
  const ids = arbre.root
    .findAll((/** @type {any} */ n) => typeof n.props?.children === 'string' && n.props.children.startsWith('fil:'))
    .map((/** @type {any} */ n) => n.props.children.slice(4));
  act(() => arbre.unmount());
  return [...new Set(ids)].sort();
};

describe.each(FENETRES)('%s — les fils proposés au partage', (_nom, Fenetre, props) => {
  test('caractérisation : privé, équipe, groupe, canal de MON club, omnisport dont je suis admin', () => {
    mockFils = [
      fil('prive', { type: 'whisper' }),
      fil('equipe', { type: 'team' }),
      fil('groupe', { type: 'group' }),
      fil('canal-foot', { club: { documentId: 'club-foot' }, type: 'club' }),
      fil('canal-autre', { club: { documentId: 'club-autre' }, type: 'club' }),
      fil('omni', { multisportClub: { admins: [{ documentId: 'moi' }], documentId: 'ms-1' }, type: 'multisport' }),
      fil('omni-autre', { multisportClub: { admins: [{ documentId: 'lui' }], documentId: 'ms-2' }, type: 'multisport' }),
    ];
    expect(filsProposes(Fenetre, props)).toEqual(['canal-foot', 'equipe', 'groupe', 'omni', 'prive']);
  });

  test('Q3-12 : canal de ma section omnisport, fil de ligue et assistance sont proposés', () => {
    mockFils = [
      fil('canal-hand', { club: { documentId: 'section-hand' }, type: 'club' }),
      fil('ligue', { type: 'league_match' }),
      fil('assistance', { type: 'assistance' }),
    ];
    expect(filsProposes(Fenetre, props)).toEqual(['assistance', 'canal-hand', 'ligue']);
  });
});
