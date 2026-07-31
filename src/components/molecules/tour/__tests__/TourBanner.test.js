import { Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TourBanner from '../TourBanner';

// Filet L01-B (audit docs/AUDIT_TOUR_GUIDE_ET_MISSIONS_2026_07_31.md §7) :
// le bandeau du tour n'avait AUCUN test (E6). Ces tests caractérisent ses
// 4 formes (plein, pastille, pause, succès) et ses commandes.

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
    Alignments: { alignCenter: {}, fill: {}, row: {} },
    // Chaînes opaques volontairement non-hex : le contrat de thème interdit les
    // littéraux hex hors allowlist, et un mock n'a pas besoin de vraies couleurs.
    Colors: {
      primary500: 'couleur-primaire',
      primary900: 'couleur-encre',
      success500: 'couleur-succes',
    },
    Fonts: {
      neutral00: {},
      neutral100: {},
      neutral200: {},
      neutral400: {},
      p2Bold: {},
      p3: {},
      p3Bold: {},
      p4Bold: {},
      primary500: {},
      primary900: {},
    },
    Spaces: {
      gap: { 12: {}, 16: {}, 8: {} },
      marginTop: { 4: {} },
      padding: { 12: {}, 16: {} },
    },
  }),
}));

const MANUAL_STEP = {
  id: 'coach_planning',
  instruction: 'Ton planning regroupe toute ta semaine.',
  manualLabel: "J'ai vu",
  success: { type: 'manual' },
  successMessage: 'Planning en poche.',
  title: 'Ton planning',
};

// Étape à signal automatique SANS skipLabel (ex. coach_composition) : le cas C3
// de l'audit — hors ligne, le signal n'arrive jamais.
const SIGNAL_STEP_WITHOUT_SKIP = {
  id: 'coach_composition',
  instruction: "Prépare ta compo — terrain d'essai.",
  success: { key: 'composition.simulated.published', type: 'action' },
  successMessage: 'Compo maîtrisée !',
  title: 'Préparer une composition',
};

const baseTourValue = () => ({
  completeCurrentStep: jest.fn(),
  currentStep: MANUAL_STEP,
  exitTour: jest.fn(),
  isTourActive: true,
  resumeTour: jest.fn(),
  setTourBannerReservedSpace: jest.fn(),
  stepIndex: 5,
  totalSteps: 9,
  tourStatus: 'active',
});

const renderBanner = (tourValue) => {
  mockUseTour.mockReturnValue(tourValue);
  let tree;
  act(() => { tree = renderer.create(<TourBanner />); });
  return tree;
};

const allTexts = (tree) => tree.root.findAllByType(Text)
  .map((node) => (Array.isArray(node.props.children)
    ? node.props.children.join('') : String(node.props.children)));

const findButtonByText = (tree, label) => tree.root.findAllByType(TouchableOpacity)
  .find((touchable) => touchable.findAllByType(Text)
    .some((node) => String(node.props.children) === label));

beforeEach(() => {
  jest.useFakeTimers();
  mockUseTour.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('TourBanner — bandeau plein (étape active)', () => {
  it("affiche progression, titre, instruction et le bouton manuel de l'étape", () => {
    const value = baseTourValue();
    const tree = renderBanner(value);
    const texts = allTexts(tree);

    expect(texts).toContain('Tour guidé · étape 6 sur 9');
    expect(texts).toContain(MANUAL_STEP.title);
    expect(texts).toContain(MANUAL_STEP.instruction);

    const manualButton = findButtonByText(tree, "J'ai vu");
    expect(manualButton).toBeTruthy();
    act(() => manualButton.props.onPress());
    expect(value.completeCurrentStep).toHaveBeenCalledWith();
  });

  it('« Quitter le tour » est visible et appelle exitTour', () => {
    const value = baseTourValue();
    const tree = renderBanner(value);

    const quitButton = findButtonByText(tree, 'Quitter le tour');
    expect(quitButton).toBeTruthy();
    act(() => quitButton.props.onPress());
    expect(value.exitTour).toHaveBeenCalled();
  });

  it('étape à signal sans skipLabel : « Passer » est proposé (cas C3, hors ligne)', () => {
    const value = { ...baseTourValue(), currentStep: SIGNAL_STEP_WITHOUT_SKIP };
    const tree = renderBanner(value);

    const skipButton = findButtonByText(tree, 'Passer');
    expect(skipButton).toBeTruthy();
    act(() => skipButton.props.onPress());
    expect(value.completeCurrentStep).toHaveBeenCalledWith({ skipped: true });
  });

  it('rien ne s\'affiche hors tour', () => {
    const tree = renderBanner({ ...baseTourValue(), currentStep: null, isTourActive: false });
    expect(tree.toJSON()).toBeNull();
  });
});

describe('TourBanner — pastille repliée', () => {
  it('une étape à signal se replie toute seule après 3,5 s ; toucher la pastille rouvre', () => {
    const value = { ...baseTourValue(), currentStep: SIGNAL_STEP_WITHOUT_SKIP, stepIndex: 4 };
    const tree = renderBanner(value);

    act(() => jest.advanceTimersByTime(3500));
    expect(allTexts(tree)).toContain('Tour 5/9');

    const pastille = tree.root.findAllByType(TouchableOpacity)
      .find((touchable) => touchable.props.accessibilityLabel === 'Afficher le tour guidé');
    act(() => pastille.props.onPress());
    expect(allTexts(tree)).toContain(SIGNAL_STEP_WITHOUT_SKIP.title);
  });

  it('une étape manuelle ne se replie jamais toute seule', () => {
    const tree = renderBanner(baseTourValue());
    act(() => jest.advanceTimersByTime(10000));
    expect(allTexts(tree)).toContain(MANUAL_STEP.title);
  });

  it('la pastille garde une porte de sortie (Quitter)', () => {
    const value = { ...baseTourValue(), currentStep: SIGNAL_STEP_WITHOUT_SKIP };
    const tree = renderBanner(value);
    act(() => jest.advanceTimersByTime(3500));

    const quit = tree.root.findAllByType(TouchableOpacity)
      .find((touchable) => touchable.props.accessibilityLabel === 'Quitter le tour');
    expect(quit).toBeTruthy();
    act(() => quit.props.onPress());
    expect(value.exitTour).toHaveBeenCalled();
  });
});

describe('TourBanner — bandeau « en pause »', () => {
  it('propose « Reprendre le tour » et « Quitter le tour »', () => {
    const value = { ...baseTourValue(), tourStatus: 'paused' };
    const tree = renderBanner(value);

    const resumeButton = findButtonByText(tree, 'Reprendre le tour');
    expect(resumeButton).toBeTruthy();
    act(() => resumeButton.props.onPress());
    expect(value.resumeTour).toHaveBeenCalled();

    const quitButton = findButtonByText(tree, 'Quitter le tour');
    expect(quitButton).toBeTruthy();
    act(() => quitButton.props.onPress());
    expect(value.exitTour).toHaveBeenCalled();
  });
});

describe('TourBanner — message de succès', () => {
  it("affiche le message de succès de l'étape", () => {
    const tree = renderBanner({ ...baseTourValue(), tourStatus: 'success' });
    expect(allTexts(tree)).toContain(MANUAL_STEP.successMessage);
  });
});

describe('TourBanner — la marge réservée a disparu (R03, audit §2.2 D-B)', () => {
  it('le bandeau ne publie plus jamais de hauteur vers les écrans', () => {
    const value = baseTourValue();
    const tree = renderBanner(value);

    // Le bandeau est en surimpression : quelle que soit sa forme, il ne
    // republie plus de « hauteur réservée » (c'était la cause du saut de
    // 140 px sur toutes les pages à t+3,5 s).
    tree.root.findAll((node) => typeof node.props?.onLayout === 'function')
      .forEach((node) => act(() => node.props.onLayout({
        nativeEvent: { layout: { height: 172 } },
      })));

    expect(value.setTourBannerReservedSpace).not.toHaveBeenCalled();
  });
});
