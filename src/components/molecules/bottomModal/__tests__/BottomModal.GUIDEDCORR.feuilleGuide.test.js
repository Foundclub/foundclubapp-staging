import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  isTourTargetInSheet,
  measureTourTarget,
  resetTourTargetsForTests,
} from '@/domains/tour/tourTargetRegistry';

import TourTarget from '@/components/molecules/tour/TourTarget';
import { TOUR_SHEET_TARGET } from '@/components/molecules/tour/tourSheetContext';

import BottomModal from '../BottomModal';

// GUIDE-D-CORR TG-01 / TG-02 (tournée du 07/11) : la feuille ouverte pendant le guide passait sous
// sa couche. Ouverte, elle le dit au guide (signal `tour.sheet`) ; une ancre du guide posée dans
// son contenu est marquée « dans la feuille », pour que le guide reste sur elle.

jest.mock('@/domains/tour/guideSupport', () => ({ __esModule: true, default: () => true }));

const mockPresentSpy = jest.fn();
const mockDismissSpy = jest.fn();
/** @type {{ courant: null | (() => void) }} */
const mockRenvoiFermeture = { courant: null };

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));

jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));

// Double fidele : `dismiss()` ne declenche `onDismiss` que lorsqu'on le decide,
// exactement comme la vraie feuille qui l'emet APRES son animation de sortie.
jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef(
      (/** @type {any} */ props, /** @type {any} */ ref) => {
        reactActuel.useImperativeHandle(ref, () => ({
          dismiss: () => {
            mockDismissSpy();
            mockRenvoiFermeture.courant = props.onDismiss;
          },
          present: () => mockPresentSpy(),
        }));
        return reactActuel.createElement(
          VueRN,
          { onDismiss: props.onDismiss, testID: 'feuille' },
          props.children,
        );
      },
    ),
    BottomSheetScrollView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      props.children,
    ),
    BottomSheetView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      props.children,
    ),
    useBottomSheetInternal: () => null, // CLAVREGLE : lu par BottomModal
  };
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { close: 1 },
      Spaces: espaces,
    }),
  };
});


const sheet = (isVisible) => (
  <BottomModal close={() => {}} isVisible={isVisible} snapPoints={['34%']}>
    <TourTarget id="dans.la.feuille"><Text>Inviter</Text></TourTarget>
  </BottomModal>
);

beforeEach(() => resetTourTargetsForTests());

describe('BottomModal et le guide', () => {
  it('ouverte, la feuille se signale ; refermée, le signal part', async () => {
    let tree;
    act(() => { tree = renderer.create(sheet(false)); });
    expect(await measureTourTarget(TOUR_SHEET_TARGET)).toBeNull();
    act(() => { tree.update(sheet(true)); });
    expect(await measureTourTarget(TOUR_SHEET_TARGET)).not.toBeNull();
    act(() => { tree.update(sheet(false)); });
    expect(await measureTourTarget(TOUR_SHEET_TARGET)).toBeNull();
    act(() => tree.unmount());
  });

  it('une ancre du guide dans la feuille est marquée « dans la feuille »', () => {
    let tree;
    act(() => { tree = renderer.create(sheet(true)); });
    expect(isTourTargetInSheet('dans.la.feuille')).toBe(true);
    act(() => tree.unmount());
  });

  it('témoin : une ancre hors feuille ne l’est pas', () => {
    let tree;
    act(() => {
      tree = renderer.create(<TourTarget id="sur.l.ecran"><Text>Logo</Text></TourTarget>);
    });
    expect(isTourTargetInSheet('sur.l.ecran')).toBe(false);
    act(() => tree.unmount());
  });
});
