import { Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import OnboardingStickyFooter from '../OnboardingStickyFooter';

// INSCRIPTION-PARCOURS (D245, 18/11) — banc du site à 375 × 667 : sur Sport, Poste et Niveau,
// « Continuer » et « Passer cette étape » étaient au BAS de la page (Sport : 9 522 px, Niveau :
// 1 349 px). Le pied n'était fixe sur le site qu'à partir de la largeur ordinateur ; au
// téléphone (l'app), rien ne change.

const mockLargeur = { current: 375 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 667, scale: 2, width: mockLargeur.current,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({ Spaces: { gap: { 16: {} } } }),
}));
jest.mock('@/components/atoms/piedFlottant/PiedFlottant', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, style }) => <View style={style}>{children}</View>,
  };
});

const { OS } = Platform;
afterEach(() => { Platform.OS = OS; });

const estFixe = (/** @type {'ios' | 'web'} */ os, /** @type {number} */ largeur) => {
  Platform.OS = os;
  mockLargeur.current = largeur;
  let arbre;
  act(() => {
    arbre = renderer.create(
      <OnboardingStickyFooter><Text>Continuer</Text></OnboardingStickyFooter>,
    );
  });
  return /** @type {any} */ (arbre).root.findAll((/** @type {any} */ n) => [].concat(n.props.style)
    .some((s) => s && s.position === 'fixed')).length > 0;
};

describe('OnboardingStickyFooter — le pied reste dans l écran', () => {
  it('téléphone (app) : pas de pied fixe, comme avant', () => {
    expect(estFixe('ios', 375)).toBe(false);
  });

  it('site, ordinateur (1 360 px) : pied fixe, comme avant', () => {
    expect(estFixe('web', 1360)).toBe(true);
  });

  it('site, téléphone (375 px) : pied fixe — il était au bas de la page', () => {
    expect(estFixe('web', 375)).toBe(true);
  });
});
