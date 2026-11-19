/* eslint-disable max-len -- les témoins se lisent en entier. */
import '@/theme/strings';

import { Platform } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TournamentInviteSheet from '../TournamentInviteSheet';

// IMPL-2C (19/11/2026, recette 48 écart 7, tournée Android) — dans la fenêtre « Inviter un joueur »,
// « Chercher un joueur FoundClub » : la fenêtre DISPARAISSAIT à l'ouverture du clavier (2 fois sur 2).
// Cause : le champ de recherche est `BottomModalTextInput`, sur Android le `BottomSheetTextInput` de
// gorhom, qui se DÉCLARE lui-même au focus ; la feuille était en `interactive` à hauteur automatique,
// et le cran changeait (choix → recherche) au moment où le clavier s'ouvre : c'est le chemin qui
// rend l'index -1 et ferme la feuille (CLAVPOP / CLAVPOP-ANDROID, BottomModal.js, haut du fichier).
// La règle déjà suivie par les feuilles qui portent ce champ (AutocompleteSelect en recherche,
// PollCreationModal, EventTasksEditor) : `androidKeyboardBehavior="extend"` et un cran fixe.
// Le comportement de BottomModal en `extend` est prouvé par BottomModal.androidFocusClose.test.js ;
// ce témoin prouve que la fenêtre le demande, et que son cran ne bouge pas en passant à la recherche.

/** @type {any[]} */
const mockProps = [];
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(/** @type {any} */ props) {
  mockProps.push(props);
  return props.children;
});
jest.mock('@/components/atoms/bottomModalTextInput/BottomModalTextInput', () => {
  const { TextInput } = jest.requireActual('react-native');
  return { __esModule: true, default: TextInput };
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function ProfileAvatarMock() { return null; });
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

const systemeDOrigine = Platform.OS;
/** @type {any} */
let arbre = null;
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  mockProps.splice(0);
  Platform.OS = systemeDOrigine;
});

const monter = (/** @type {string} */ systeme) => {
  Platform.OS = /** @type {any} */ (systeme);
  act(() => {
    arbre = renderer.create(
      <TournamentInviteSheet
        candidates={[]}
        isVisible
        onChangeQuery={jest.fn()}
        onClose={jest.fn()}
        onInvite={jest.fn()}
        onShare={jest.fn()}
        query=""
        teamName="Les Lions"
      />,
    );
  });
};
const tuileRecherche = () => arbre.root.findAll((/** @type {any} */ n) => typeof n.props?.onPress === 'function'
  && JSON.stringify(n.props?.accessibilityLabel || n.props?.title || '').includes('Chercher un joueur'))[0];

test('Android : la fenêtre demande `extend` et un cran fixe, le même avant et après « Chercher un joueur FoundClub »', () => {
  monter('android');
  const avant = mockProps[mockProps.length - 1];
  expect(avant.androidKeyboardBehavior).toBe('extend');
  expect(avant.snapPoints).toEqual(['86%']);
  const tuile = tuileRecherche();
  expect(tuile).toBeTruthy();
  act(() => tuile.props.onPress());
  const apres = mockProps[mockProps.length - 1];
  expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'tournament-invite-search-input').length).toBeGreaterThan(0);
  expect(apres.androidKeyboardBehavior).toBe('extend');
  expect(apres.snapPoints).toBe(avant.snapPoints);
});

test('site : hauteur automatique inchangée (pas de cran : la feuille à 375 px et la fenêtre au centre restent comme avant)', () => {
  monter('web');
  expect(mockProps[mockProps.length - 1].snapPoints).toBeUndefined();
});
