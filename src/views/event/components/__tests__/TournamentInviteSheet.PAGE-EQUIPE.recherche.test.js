/* eslint-disable max-len, react/jsx-props-no-spreading -- les témoins se lisent en entier ; le harnais passe les propriétés du cas. */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import TournamentInviteSheet from '../TournamentInviteSheet';

// PAGE-EQUIPE (19/11/2026, planches 3c, 3d) — la recherche d'un joueur : la loupe et la croix
// d'effacement dans le champ, « ✓ Invité » en pastille, l'icône de partage sur « Partager le lien de
// l'équipe » quand personne n'est trouvé. Harnais repris de TournamentInviteSheet.IMPL2C.croix.

jest.mock('@/components/molecules/bottomModal/BottomModal', () => jest.requireActual('@/components/molecules/bottomModal/BottomModal.web'));
jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});
// react-dom n'est pas installé dans app (le site l'apporte) ; sans `document`, la fenêtre ne s'en sert pas.
jest.mock('react-dom', () => ({ createPortal: (/** @type {any} */ noeud) => noeud }), { virtual: true });
jest.mock('@/components/atoms/bottomModalTextInput/BottomModalTextInput', () => {
  const { TextInput } = jest.requireActual('react-native');
  return { __esModule: true, default: TextInput };
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function ProfileAvatarMock() { return null; });
jest.mock('@/components/atoms/glyphIcon/GlyphIcon', () => function GlyphIconMock(/** @type {any} */ props) {
  const { Text } = jest.requireActual('react-native');
  const react = jest.requireActual('react');
  return react.createElement(Text, null, `icone:${props.name}`);
});
jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  const rn = jest.requireActual('react-native');
  const react = jest.requireActual('react');
  return react.createElement(rn.TouchableOpacity, { accessibilityLabel: props.title, icone: props.icon, onPress: props.onPress }, react.createElement(rn.Text, null, props.title));
});

/** @type {any} */
let arbre = null;
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});

const monter = (/** @type {any} */ extra = {}) => {
  const onClose = jest.fn();
  act(() => {
    arbre = renderer.create(
      <TournamentInviteSheet
        candidates={[]}
        isVisible
        isWide
        onChangeQuery={jest.fn()}
        onClose={onClose}
        onInvite={jest.fn()}
        onShare={jest.fn()}
        query=""
        teamName="Les Lions"
        {...extra}
      />,
    );
  });
  return onClose;
};

const texte = () => JSON.stringify(arbre.toJSON());
const parId = (/** @type {string} */ id) => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === id && typeof n.props?.onPress === 'function')[0];

test('🔴 3c : la loupe est dans le champ ; la croix n’apparaît qu’avec du texte et vide le champ', () => {
  const onChangeQuery = jest.fn();
  monter({ initialMode: 'search', onChangeQuery });
  expect(texte()).toContain('icone:search');
  expect(parId('tournament-invite-search-clear')).toBeUndefined();
  act(() => { arbre.update(<TournamentInviteSheet candidates={[]} initialMode="search" isVisible isWide onChangeQuery={onChangeQuery} onClose={jest.fn()} onInvite={jest.fn()} onShare={jest.fn()} query="lu" teamName="Les Lions" />); });
  const croixDuChamp = parId('tournament-invite-search-clear');
  expect(croixDuChamp.props.accessibilityLabel).toBe('Effacer la recherche');
  act(() => croixDuChamp.props.onPress());
  expect(onChangeQuery).toHaveBeenCalledWith('');
});

test('🔴 3c : un joueur déjà invité porte « ✓ Invité » (coche + mot), plus de bouton « Inviter »', () => {
  monter({
    candidates: [{ documentId: 'u-1', firstname: 'Lucas' }], initialMode: 'search', invitedIds: new Set(['u-1']), query: 'lu',
  });
  const pastille = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-invite-invited-u-1')[0];
  expect(JSON.stringify(pastille.findAll((/** @type {any} */ n) => typeof n.props?.children === 'string').map((/** @type {any} */ n) => n.props.children))).toMatch(/icone:check.*Invité/);
});

test('🔴 3d : personne trouvé : « Partager le lien de l’équipe » porte l’icône de partage', () => {
  monter({ candidates: [], initialMode: 'search', query: 'zz' });
  const bouton = arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityLabel === 'Partager le lien de l’équipe' && typeof n.props?.onPress === 'function')[0];
  expect(bouton.props.icone).toBe('share');
});
