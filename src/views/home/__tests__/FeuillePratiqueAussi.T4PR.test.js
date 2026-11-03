import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FeuillePratiqueAussi from '../FeuillePratiqueAussi';

// T4-PARENT-RETOURS (03/11/2026, M0096, captures d'Adel sur iPhone) — en portrait, la feuille s'ouvrait
// sans ses boutons. `BottomModal` en hauteur automatique ne mesure que son contenu : le pied posé
// dessous sort de l'écran (filet D19, BottomModal.debordement.test.js). La doublure ne rend donc QUE
// le contenu, comme l'écran du téléphone : les deux boutons doivent y être.
const mockMutate = jest.fn();

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      scheme: 'dark',
      Spaces,
    }),
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function Feuille({ children }) {
  return children;
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => () => null);
jest.mock('@/components/atoms/button/Button', () => function Bouton({ onPress, title }) {
  const { Text: Texte } = require('react-native');
  return <Texte onPress={onPress}>{title}</Texte>;
});
jest.mock('@/domains/auth/useAuth', () => () => ({ refetchUserData: jest.fn(), setDisplayMode: jest.fn() }));
jest.mock('@/domains/auth/authUseCases', () => ({ getRoleDocumentIdByKey: () => 'role-joueur' }));
jest.mock('@/services/auth/authQueries', () => ({ useGetRoles: () => ({ data: [] }) }));
jest.mock('@/services/auth/authService', () => ({ updateMe: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useMutation: () => ({ isPending: false, mutate: mockMutate }) }));
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

test('les deux boutons sont dans le contenu mesuré, et « Oui » change le rôle', () => {
  /** @type {any} */
  let arbre;
  const fermer = jest.fn();
  act(() => {
    arbre = renderer.create(
      <View>
        <FeuillePratiqueAussi isVisible onClose={fermer} onDone={jest.fn()} prenoms={['Farid', 'Kevin']} />
      </View>,
    );
  });
  const trouver = (cle) => arbre.root.findAll((noeud) => noeud.type === Text && noeud.props.children === cle)[0];
  expect(trouver('playerMode.sheet.confirm')).toBeTruthy();
  expect(trouver('playerMode.sheet.later')).toBeTruthy();
  act(() => trouver('playerMode.sheet.confirm').props.onPress());
  expect(mockMutate).toHaveBeenCalledWith({ role: 'role-joueur' });
  act(() => trouver('playerMode.sheet.later').props.onPress());
  expect(fermer).toHaveBeenCalled();
});
