import { ImageBackground, StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ScreenContainer from '../ScreenContainer';

// Filet L01-B (audit docs/AUDIT_TOUR_GUIDE_ET_MISSIONS_2026_07_31.md §2.4) :
// ScreenContainer est l'enveloppe de 149 écrans et n'avait AUCUN test (E6).
// Ces tests caractérisent la marge basse, avec et sans tour actif.

// Encoche basse iPhone : la valeur de l'audit, pour que les chiffres se recoupent.
const INSETS = {
  bottom: 34, left: 0, right: 0, top: 59,
};

// La valeur publiée par le bandeau plein mesurée dans l'audit (§2.2 D-B).
const TOUR_RESERVED_FULL_BANNER = 310;

// Dégagement du dock flottant figé : le sujet du test est l'interaction avec la
// marge du tour, pas la formule du dock (couverte par commonOptions).
const DOCK_SCENE_PADDING = 134;

const mockUseTour = jest.fn();

jest.mock('@/context/TourContext', () => ({
  useTour: () => mockUseTour(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Alignments: { fill: {}, grow1: {} },
    Images: { bg1: 1, bg2: 2, bg3: 3 },
  }),
}));

jest.mock('@react-navigation/elements', () => ({
  // eslint-disable-next-line global-require
  HeaderHeightContext: require('react').createContext(0),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingTabBarScenePaddingBottom: () => 134,
}));

const renderScreen = (bottomInsetMode) => {
  let tree;
  act(() => {
    tree = renderer.create(
      <ScreenContainer bottomInsetMode={bottomInsetMode}>
        <Text>contenu</Text>
      </ScreenContainer>,
    );
  });
  return tree;
};

const getPaddingBottom = (tree) => {
  const background = tree.root.findByType(ImageBackground);
  return StyleSheet.flatten(background.props.style).paddingBottom;
};

const withTourReservedSpace = (value) => {
  mockUseTour.mockReturnValue({ tourBannerReservedSpace: value });
};

afterEach(() => {
  mockUseTour.mockReset();
});

describe('ScreenContainer — marge basse hors tour (invariants)', () => {
  beforeEach(() => withTourReservedSpace(0));

  it("mode par défaut (none) : plancher système = l'encoche basse", () => {
    expect(getPaddingBottom(renderScreen())).toBe(INSETS.bottom);
  });

  it('mode screen : encoche + bottomInsetExtra', () => {
    expect(getPaddingBottom(renderScreen('screen'))).toBe(INSETS.bottom + 12);
  });

  it('mode tab-scene : dégagement du dock flottant', () => {
    expect(getPaddingBottom(renderScreen('tab-scene'))).toBe(DOCK_SCENE_PADDING);
  });

  it('mode edge-to-edge : aucun plancher, comme documenté dans son en-tête', () => {
    expect(getPaddingBottom(renderScreen('edge-to-edge'))).toBe(0);
  });
});

describe('ScreenContainer — pendant le tour guidé (R03, audit §2.2)', () => {
  beforeEach(() => withTourReservedSpace(TOUR_RESERVED_FULL_BANNER));

  it("edge-to-edge + tour actif : l'écran garde SA marge (0), le bandeau ne réserve rien", () => {
    // C'était LE bug R03 (D-A) : Math.max(0, 310) donnait 310 sur les 52 écrans
    // de tunnel (WizardStepLayout), cibles des étapes 1 et 3 du tour coach.
    expect(getPaddingBottom(renderScreen('edge-to-edge'))).toBe(0);
  });

  it('tab-scene + tour actif : le dégagement du dock reste inchangé', () => {
    // D-C : la scène d'onglet ajoutait déjà sa propre marge — on empilait 134 + 310.
    expect(getPaddingBottom(renderScreen('tab-scene'))).toBe(DOCK_SCENE_PADDING);
  });

  it('mode par défaut + tour actif : le plancher système reste inchangé', () => {
    expect(getPaddingBottom(renderScreen())).toBe(INSETS.bottom);
  });
});
