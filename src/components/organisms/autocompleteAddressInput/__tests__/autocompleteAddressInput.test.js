import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AutocompleteAddressInput from '../autocompleteAddressInput';

// D32 (E6) : `autocompleteAddressInput.js` et `AutocompleteSelect.js` n'avaient
// AUCUN test alors qu'ils sont la piece PARTAGEE par 26 ecrans qui cherchent une
// ville. Ce fichier fige la chaine complete : appui -> ouverture -> frappe ->
// propositions. Il ne double NI le composant de selection NI le service de
// mappage : seule la couche reseau est remplacee.

const mockSearchPlaces = jest.fn();

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/services/places/placesService', () => ({
  getPlacesFromCoordinates: jest.fn(),
  searchPlaces: (/** @type {string} */ recherche, /** @type {string} */ type) => (
    mockSearchPlaces(recherche, type)
  ),
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

// La feuille reelle repose sur @gorhom/bottom-sheet (natif) : elle est doublee
// par un conteneur qui rend ses enfants QUAND ET SEULEMENT QUAND `isVisible`.
// C'est exactement le contrat dont AutocompleteSelect depend.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, footerComponent, isVisible }) => (
      isVisible ? (
        <View testID="feuille">
          {children}
          {footerComponent}
        </View>
      ) : null
    ),
  };
});

jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput: SaisieRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <SaisieRN
        editable={proprietes.editable}
        onChangeText={proprietes.onChangeText}
        placeholder={proprietes.placeholder}
        testID={`saisie:${proprietes.placeholder || proprietes.label || ''}`}
      />
    ),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => (
      <Pressable disabled={disabled} onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </Pressable>
    ),
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => {
  const { Text: TexteRN, TouchableOpacity: Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { setIsChecked, text }) => (
      <Pressable onPress={setIsChecked}>
        <TexteRN>{text}</TexteRN>
      </Pressable>
    ),
  };
});

/**
 * Une reponse BAN credible pour « lyon ».
 * @returns {any[]} Deux lieux.
 */
const reponseBan = () => ([
  {
    geometry: { coordinates: [4.8357, 45.764] },
    properties: {
      city: 'Lyon',
      context: '69, Rhône',
      id: 'ban-1',
      label: 'Lyon',
      postcode: '69000',
      type: 'municipality',
    },
  },
  {
    geometry: { coordinates: [4.85, 45.75] },
    properties: {
      city: 'Lyon',
      context: '69, Rhône',
      id: 'ban-2',
      label: 'Lyon 3e Arrondissement',
      postcode: '69003',
      type: 'municipality',
    },
  },
]);

/**
 * Aplati un noeud de la sortie `toJSON` en une chaine.
 * @param {any} noeud Le noeud.
 * @returns {string} Le texte.
 */
const aplatirTexte = (noeud) => {
  if (Array.isArray(noeud)) return noeud.map(aplatirTexte).join(' ');
  if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return '';
  if (typeof noeud === 'object') return aplatirTexte(noeud.children);
  return String(noeud);
};

/**
 * Tout le texte visible de l'arbre.
 * @param {any} arbre L'arbre rendu.
 * @returns {string} Le texte.
 */
const texteVisible = (arbre) => aplatirTexte(arbre.toJSON());

describe('AutocompleteAddressInput — la recherche de ville, de l\'appui aux propositions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSearchPlaces.mockResolvedValue(reponseBan());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Monte le champ dans un vrai fournisseur react-query.
   * @param {any} proprietes Les proprietes du champ.
   * @returns {any} L'arbre rendu.
   */
  const monter = (proprietes = {}) => {
    const client = new QueryClient({
      defaultOptions: { queries: { gcTime: 0, retry: false, staleTime: 0 } },
    });
    let arbre;
    act(() => {
      arbre = renderer.create(
        <QueryClientProvider client={client}>
          <AutocompleteAddressInput
            label="Ville"
            placeholder="Rechercher une ville"
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...proprietes}
          />
        </QueryClientProvider>,
      );
    });
    return arbre;
  };

  /**
   * Appuie sur la zone fermee du champ.
   * @param {any} arbre L'arbre rendu.
   * @returns {void}
   */
  const appuyerSurLeChamp = (arbre) => {
    const zones = arbre.root.findAllByType(TouchableOpacity)
      .filter((/** @type {any} */ noeud) => typeof noeud.props.onPress === 'function');
    act(() => {
      zones[0].props.onPress();
    });
  };

  it('affiche le placeholder tant que rien n\'est choisi', () => {
    const arbre = monter();
    expect(texteVisible(arbre)).toContain('Rechercher une ville');
  });

  it('OUVRE la feuille quand on appuie sur le champ', async () => {
    const arbre = monter();
    expect(arbre.root.findAllByProps({ testID: 'feuille' }).length).toBe(0);

    appuyerSurLeChamp(arbre);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    expect(arbre.root.findAllByProps({ testID: 'feuille' }).length).toBeGreaterThan(0);
  });

  it('REND DES PROPOSITIONS quand on tape une ville', async () => {
    const arbre = monter();
    appuyerSurLeChamp(arbre);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    const saisie = arbre.root.findAllByType(TextInput)
      .find((/** @type {any} */ noeud) => noeud.props.editable !== false);
    await act(async () => {
      saisie.props.onChangeText('lyon');
    });
    // Le rebond (350 ms) puis la resolution de la requete : plusieurs tours de
    // boucle sont necessaires, react-query republie apres la micro-tache.
    for (let tour = 0; tour < 5; tour += 1) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
    }

    expect(mockSearchPlaces).toHaveBeenCalledWith('lyon', undefined);
    expect(texteVisible(arbre)).toContain('Lyon (69000)');
    expect(texteVisible(arbre)).toContain('Lyon 3e Arrondissement (69003)');
  });
});
