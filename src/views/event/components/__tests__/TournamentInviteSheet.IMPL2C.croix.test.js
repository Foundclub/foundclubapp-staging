/* eslint-disable max-len, react/jsx-props-no-spreading -- les témoins se lisent en entier ; le harnais passe les propriétés du cas. */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import TournamentInviteSheet from '../TournamentInviteSheet';

// IMPL-2C (19/11/2026, recette 48 écart 6, site 1280 px) — la fenêtre « Inviter un joueur » n'avait pas
// de croix : seule la touche Échap la fermait. `BottomModal` cache sa croix par défaut
// (`hideCloseButton = true`) ; la fenêtre la demande, comme les autres fenêtres qui en ont une.
// Ce témoin monte la VRAIE fenêtre du site (BottomModal.web.js), celle que la recette a vue.

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

const croix = () => arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'bottom-modal-fermer' && typeof n.props?.onPress === 'function')[0];

test('la croix est là, nommée « Fermer » pour un lecteur d’écran, et elle ferme la fenêtre', () => {
  const onClose = monter();
  const bouton = croix();
  expect(bouton).toBeTruthy();
  expect(bouton.props.accessibilityLabel).toBe('Fermer');
  expect(bouton.props.accessibilityRole).toBe('button');
  act(() => bouton.props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('la croix reste en mode recherche', () => {
  monter({ initialMode: 'search' });
  expect(croix()).toBeTruthy();
});
