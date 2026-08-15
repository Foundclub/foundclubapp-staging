import renderer, { act } from 'react-test-renderer';

import TeamCompoTemplateScreen from '../TeamCompoTemplateScreen';

// C-C — ECRAN 11 du pack composition, et le TEMOIN 4 du lot.
//
//   · L'ecran porte les 3 segments du pack, la carte « Appliquer a un match » et
//     les 2 CTA.
//   4. « le refus d'abonnement ouvre l'ECRAN PLEIN, pas une alerte » — c'est la
//      forme que le pack exige pour l'ecran 12.

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockAlert = jest.fn();
const mockSave = jest.fn(() => Promise.resolve({}));

/** @type {any} */
let mockDefaultComposition;
/** @type {any} */
let mockSaveError;

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({
    params: {
      players: [
        { documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla' },
        { documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra' },
      ],
      sport: 'football',
      teamId: 'team-1',
      teamName: 'Senior 1',
    },
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: () => {
      if (mockSaveError) {
        options.onError(mockSaveError);
        return;
      }
      options.mutationFn();
      options.onSuccess();
    },
  }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  alert: (/** @type {any} */ ...args) => mockAlert(...args),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const lire = (/** @type {string} */ chemin) => chemin.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        const compte = options?.count;
        let valeur = lire(cle);
        if (typeof valeur !== 'string' && compte !== undefined) {
          valeur = lire(`${cle}${compte === 1 ? '_one' : '_other'}`);
        }
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_correspondance, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeamDefaultComposition: () => ({ data: mockDefaultComposition }),
}));

jest.mock('@/services/team/teamService', () => ({
  saveTeamDefaultComposition: (/** @type {any} */ ...args) => mockSave(...args),
}));

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
      Images: { arrowLeft: 1, chevronLeft: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const { Text: TexteRN, TouchableOpacity, View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onChange, options }) => (
      <View>
        {options.map((/** @type {any} */ option) => (
          <TouchableOpacity key={option.value} onPress={() => onChange(option.value)}>
            <TexteRN>{option.label}</TexteRN>
          </TouchableOpacity>
        ))}
      </View>
    ),
  };
});

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/views/tactical_v2/DraggableToken', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { player }) => <TexteRN>{`JETON:${player?.firstname}`}</TexteRN>,
  };
});

jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  return {
    Gesture: {
      Pan: () => {
        const geste = {
          activateAfterLongPress: () => geste,
          minDistance: () => geste,
          onEnd: () => geste,
          onFinalize: () => geste,
          onStart: () => geste,
          onUpdate: () => geste,
        };
        return geste;
      },
    },
    GestureDetector: (/** @type {any} */ { children }) => children,
    GestureHandlerRootView: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View: VueRN },
    // `runOnJS` rend la fonction telle quelle : appelee depuis un rappel de
    // geste, elle s'execute donc pour de vrai dans le test.
    runOnJS: (/** @type {any} */ fn) => fn,
    useAnimatedStyle: () => ({}),
    useSharedValue: (/** @type {any} */ valeur) => ({ value: valeur }),
    withSpring: (/** @type {any} */ valeur) => valeur,
    withTiming: (/** @type {any} */ valeur) => valeur,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

/**
 * Aplati les enfants React en une chaine, pour lire le texte rendu.
 * @param {any} enfants
 * @returns {string}
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return arbre.root.findAllByType(TexteRN)
    .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
    .join(' | ');
};

/**
 * Le bouton dont le libelle est exactement celui attendu.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const bouton = (arbre, libelle) => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return arbre.root.findAllByType(TouchableOpacity).find(
    (/** @type {any} */ noeud) => noeud.findAllByType(TexteRN)
      .some((/** @type {any} */ texte) => aplatirTexte(texte.props.children) === libelle),
  );
};

const rendre = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TeamCompoTemplateScreen />);
  });
  return arbre;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSaveError = null;
  mockDefaultComposition = {
    composition: {
      placements: [{
        playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
      }],
    },
  };
});

describe('ECRAN 11 — la compo type d une equipe', () => {
  test('les 3 segments du pack, la carte « Appliquer a un match » et les 2 CTA sont la', () => {
    const texte = texteVisible(rendre());

    expect(texte).toContain('Compo type');
    expect(texte).toContain('Dernier');
    expect(texte).toContain('Nouvelle compo');
    expect(texte).toContain('Appliquer à un match');
    expect(texte).toContain('Dupliquer');
    expect(texte).toContain('Enregistrer la compo type');
  });

  test('la chip « Par défaut » s affiche quand l equipe a une compo type', () => {
    expect(texteVisible(rendre())).toContain('Par défaut');
  });

  test('le jeton place porte sa PASTILLE DE POSTE — le pack la veut ici', () => {
    expect(texteVisible(rendre())).toContain('GB');
  });

  test('🧾 « Dernier » dit pourquoi il est vide au lieu de mentir', () => {
    const arbre = rendre();

    act(() => {
      bouton(arbre, 'Dernier').props.onPress();
    });

    expect(texteVisible(arbre))
      .toContain('La compo du dernier match se retrouve depuis l’événement');
  });

  test('enregistrer envoie la compo affichee a la route qui existe deja', () => {
    const arbre = rendre();

    act(() => {
      bouton(arbre, 'Enregistrer la compo type').props.onPress();
    });

    expect(mockSave).toHaveBeenCalledWith('team-1', {
      composition: expect.objectContaining({
        placements: [{
          playerId: 'joueur-1', positionX: 50, positionY: 93, slotId: 'team_1:slot_1',
        }],
        sportContext: 'football',
      }),
    });
  });

  test('sans compo type enregistree, l ecran ouvre une formation neuve', () => {
    mockDefaultComposition = null;
    const texte = texteVisible(rendre());

    expect(texte).toContain('JETON:Karim');
    expect(texte).not.toContain('Par défaut');
  });
});

describe('TEMOIN 4 — le refus d abonnement ouvre l ECRAN PLEIN, pas une alerte', () => {
  test('un 403 porteur d une decision emmene sur le mur payant en ecran plein', () => {
    mockSaveError = {
      response: {
        data: {
          error: {
            details: {
              decision: { paywallKey: 'composition-required', requiredPlan: ['TEAM'] },
            },
            name: 'SUBSCRIPTION_PERMISSION_DENIED',
          },
          status: 403,
        },
      },
    };

    const arbre = rendre();
    act(() => {
      bouton(arbre, 'Enregistrer la compo type').props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('CompositionPaywall', expect.anything());
    expect(mockAlert).not.toHaveBeenCalled();
  });

  test('une erreur ORDINAIRE garde son alerte — le mur payant ne l avale pas', () => {
    mockSaveError = new Error('reseau coupe');

    const arbre = rendre();
    act(() => {
      bouton(arbre, 'Enregistrer la compo type').props.onPress();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockAlert).toHaveBeenCalled();
  });
});
