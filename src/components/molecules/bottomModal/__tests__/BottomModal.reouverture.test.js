import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// D32 : la feuille doit se PRESENTER a chaque fois qu'on l'ouvre, pas seulement
// la premiere. Ce fichier fige ce contrat, parce que c'est lui que 26 ecrans de
// recherche de ville partagent : AutocompleteSelect ouvre et ferme cette feuille
// a chaque frappe de l'utilisateur.

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

describe('BottomModal — se represente a chaque ouverture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRenvoiFermeture.courant = null;
  });

  /**
   * Monte la feuille et rend un pilote pour changer sa visibilite.
   * @returns {{ arbre: any, ouvrir: () => void, fermer: () => void }} Le pilote.
   */
  const monter = () => {
    let arbre;
    act(() => {
      arbre = renderer.create(
        <BottomModal close={() => {}} isVisible={false} snapPoints={['86%']}>
          <Text>contenu</Text>
        </BottomModal>,
      );
    });
    /**
     * Change la visibilite de la feuille.
     * @param {boolean} visible La visibilite voulue.
     * @returns {void}
     */
    const definirVisible = (visible) => {
      act(() => {
        arbre.update(
          <BottomModal close={() => {}} isVisible={visible} snapPoints={['86%']}>
            <Text>contenu</Text>
          </BottomModal>,
        );
      });
    };
    return {
      arbre,
      fermer: () => definirVisible(false),
      ouvrir: () => definirVisible(true),
    };
  };

  it('presente la feuille a la premiere ouverture', () => {
    const { ouvrir } = monter();
    ouvrir();
    expect(mockPresentSpy).toHaveBeenCalledTimes(1);
  });

  it('la REPRESENTE apres une fermeture complete (onDismiss recu)', () => {
    const { fermer, ouvrir } = monter();
    ouvrir();
    fermer();
    expect(mockDismissSpy).toHaveBeenCalledTimes(1);
    // La vraie feuille emet onDismiss a la fin de son animation de sortie.
    act(() => {
      mockRenvoiFermeture.courant?.();
    });

    ouvrir();
    expect(mockPresentSpy).toHaveBeenCalledTimes(2);
  });

  it('la REPRESENTE meme si on la rouvre AVANT la fin de l\'animation de sortie', () => {
    const { fermer, ouvrir } = monter();
    ouvrir();
    fermer();
    // onDismiss n'est PAS encore arrive : l'utilisateur retape tout de suite.
    ouvrir();
    expect(mockPresentSpy).toHaveBeenCalledTimes(2);
  });

  it('n\'avale PAS la fermeture perimee au point de perdre l\'ouverture demandee', () => {
    const fermetureRemontee = jest.fn();
    let arbre;
    /**
     * Change la visibilite de la feuille.
     * @param {boolean} visible La visibilite voulue.
     * @returns {void}
     */
    const rendre = (visible) => {
      const noeud = (
        <BottomModal close={fermetureRemontee} isVisible={visible} snapPoints={['86%']}>
          <Text>contenu</Text>
        </BottomModal>
      );
      act(() => {
        if (arbre) arbre.update(noeud);
        else arbre = renderer.create(noeud);
      });
    };

    rendre(false);
    rendre(true);
    rendre(false);
    rendre(true);
    // La fermeture en vol revient APRES la re-ouverture : elle ne doit pas
    // redescendre au parent, sinon l'appui de l'utilisateur est annule.
    act(() => {
      mockRenvoiFermeture.courant?.();
    });

    // Le contrat n'est pas un NOMBRE d'appels : c'est que la feuille reste
    // presentee et que la fermeture perimee ne redescend pas au parent.
    expect(mockPresentSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(fermetureRemontee).not.toHaveBeenCalled();
  });

  it('PROPAGE une fermeture faite par l\'utilisateur (glissement vers le bas)', () => {
    const fermetureRemontee = jest.fn();
    let arbre;
    act(() => {
      arbre = renderer.create(
        <BottomModal close={fermetureRemontee} isVisible snapPoints={['86%']}>
          <Text>contenu</Text>
        </BottomModal>,
      );
    });
    expect(mockPresentSpy).toHaveBeenCalledTimes(1);

    // Aucune demande de fermeture cote appelant : c'est la feuille elle-meme qui
    // se ferme sous le doigt. Le parent DOIT l'apprendre.
    act(() => {
      arbre.root.findAllByProps({ testID: 'feuille' })[0].props.onDismiss?.();
    });

    expect(fermetureRemontee).toHaveBeenCalledTimes(1);
  });
});
