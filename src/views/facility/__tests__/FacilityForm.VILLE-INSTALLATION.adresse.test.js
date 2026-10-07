import { Alert, Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import FacilityForm from '../FacilityForm';

// 📍 VILLE-INSTALLATION (07/10/2026) — essai d Adel sur la TestFlight 2.6.70, contre la PROD,
// compte gestionnaire d une Ville : Installations › Ajouter. Il choisit « Avenue de Luminy
// 13009 Marseille » dans la liste, appuie sur « Créer »… et RIEN n est cree (prod : 0
// installation, aucune erreur au serveur). Le champ reste rouge « Sélectionnez une adresse
// géolocalisée dans la liste. », et l adresse s ecrit PAR-DESSUS ce message.
//
// Les temoins d avant doublaient le champ d adresse ENTIER (`setAddress(objet)` a la main) :
// le chemin reel — la feuille, sa liste, son bouton, sa fermeture — n etait vu par personne.
// Ici, le champ d adresse et sa liste sont les VRAIS composants. Seuls sont doubles : la
// recherche reseau (la Geoplateforme rend des points GeoJSON) et la feuille native de
// @gorhom, remplacee par une vue qui fait ce que fait la vraie (`BottomModal.js`) : une fois
// refermee, elle rappelle `close()` (son `onDismiss`).

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;
const mockSaveCollectivite = jest.fn();

// Ce que rend la Geoplateforme pour « Avenue de Luminy » (forme de `searchPlaces`).
const mockLuminy = {
  geometry: { coordinates: [5.4356, 43.2318], type: 'Point' },
  properties: {
    city: 'Marseille',
    context: '13, Bouches-du-Rhône, Provence-Alpes-Côte d’Azur',
    id: '13209_5530',
    label: 'Avenue de Luminy 13009 Marseille',
    postcode: '13009',
    type: 'street',
  },
  type: 'Feature',
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: {} }),
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

// La recherche : la liste ne propose QUE quand la recherche tape au moins 3 lettres
// (`enabled`), exactement comme `useGetPlaces`.
jest.mock('@/services/places/placesQueries', () => ({
  useGetPlaces: (/** @type {any} */ { options, searchParam }) => ({
    data: options?.enabled && /luminy/i.test(searchParam) ? [mockLuminy] : undefined,
    isLoading: false,
  }),
}));

jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacility: () => ({
    data: null, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => ({
    data: [], error: null, isLoading: false, refetch: jest.fn(),
  }),
  useSaveCollectiviteInstallation: () => ({ mutateAsync: mockSaveCollectivite }),
}));

jest.mock('@/services/facility/facilityService', () => ({
  createFacility: jest.fn(),
  updateFacility: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});
// Le champ : son libelle, sa saisie, et son message d erreur — c est ce qu Adel lit.
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const actuel = jest.requireActual('@/components/molecules/input/Input');
  const { Text: TexteRN, TextInput: SaisieRN, View: VueRN } = jest.requireActual('react-native');
  return {
    ...actuel,
    __esModule: true,
    default: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      null,
      props.label ? reactActuel.createElement(TexteRN, null, props.label) : null,
      reactActuel.createElement(SaisieRN, {
        onChangeText: props.onChangeText,
        placeholder: props.placeholder,
        testID: `saisie:${props.label || props.placeholder || ''}`,
        value: props.value,
      }),
      props.error && props.error !== ' '
        ? reactActuel.createElement(TexteRN, { testID: 'erreur-du-champ' }, props.error)
        : null,
    ),
  };
});
jest.mock('@/components/atoms/checkable/Checkable', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  return function CheckableMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.setIsChecked, testID: `option:${props.text}` },
      reactActuel.createElement(TexteRN, null, props.text),
    );
  };
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() { return null; },
);
// La feuille : ouverte, elle rend son entete, son contenu, son pied, et un FOND qu on peut
// toucher (geste « toucher a cote »). Refermee, elle rappelle `close()` comme le fait
// `handleDismiss` de la vraie BottomModal a la fin de l animation de sortie.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { TouchableOpacity: PressableRN, View: VueRN } = jest.requireActual('react-native');
  return function BottomModalMock(/** @type {any} */ props) {
    const etaitOuverte = reactActuel.useRef(false);
    const fermer = reactActuel.useRef(props.close);
    fermer.current = props.close;
    reactActuel.useEffect(() => {
      if (props.isVisible) etaitOuverte.current = true;
      else if (etaitOuverte.current) {
        etaitOuverte.current = false;
        fermer.current?.();
      }
    }, [props.isVisible]);
    if (!props.isVisible) return null;
    return reactActuel.createElement(
      VueRN,
      { testID: 'feuille' },
      reactActuel.createElement(PressableRN, { onPress: () => props.close(), testID: 'fond' }),
      props.headerComponent,
      props.children,
      props.footerComponent,
    );
  };
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => function SegMock() {
  return null;
});

const INVITE_ADRESSE = 'Ex: 12 Rue du Stade...';
const LIBELLE_LUMINY = 'Avenue de Luminy 13009 Marseille';
const REFUS_ADRESSE = 'Sélectionnez une adresse géolocalisée dans la liste.';

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatir(noeud.props.children).trim());
const pressables = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function');
const parTexte = (/** @type {any} */ arbre, /** @type {string} */ libelle) => pressables(arbre)
  .filter((/** @type {any} */ noeud) => noeud.findAllByType(Text)
    .some((/** @type {any} */ texte) => aplatir(texte.props.children).trim() === libelle))
  .pop();
const parId = (/** @type {any} */ arbre, /** @type {string} */ id) => pressables(arbre)
  .find((/** @type {any} */ noeud) => noeud.props.testID === id);
const appuyer = async (/** @type {any} */ noeud) => {
  await act(async () => { noeud.props.onPress(); });
};
const saisir = async (
  /** @type {any} */ arbre,
  /** @type {string} */ id,
  /** @type {string} */ valeur,
) => {
  const saisie = arbre.root.findAllByType(TextInput)
    .find((/** @type {any} */ noeud) => noeud.props.testID === id);
  await act(async () => { saisie.props.onChangeText(valeur); });
};
const attendre = async (/** @type {number} */ ms) => {
  await act(async () => { jest.advanceTimersByTime(ms); });
};

/** @type {any[]} */
const arbres = [];
const monterVille = async () => {
  mockRoute = { params: { collectiviteId: 'ville-marseille' } };
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<FacilityForm />); });
  arbres.push(arbre);
  return arbre;
};

// Le geste d Adel : un nom, un type, puis l adresse cherchee et choisie DANS LA LISTE.
const remplirCommeAdel = async (/** @type {any} */ arbre) => {
  await saisir(arbre, 'saisie:Nom de l\'installation', 'Stade de Luminy');
  await appuyer(pressables(arbre).find((/** @type {any} */ noeud) => String(
    noeud.props?.accessibilityLabel || '',
  ).startsWith('Type')));
  await appuyer(parId(arbre, 'type-Terrain'));
  await appuyer(parTexte(arbre, INVITE_ADRESSE));
  await saisir(arbre, 'saisie:Rechercher...', 'Avenue de Luminy');
  await attendre(400);
  await appuyer(parId(arbre, `option:${LIBELLE_LUMINY}`));
  await appuyer(parTexte(arbre, 'Sélectionner'));
  // Une seconde passe : la recherche s est videe (350 ms d attente de frappe).
  await attendre(1000);
};

// L adresse que le serveur doit recevoir : le point exact de la liste.
const ADRESSE_ENVOYEE = {
  description: LIBELLE_LUMINY,
  geometry: { coordinates: [5.4356, 43.2318], type: 'Point' },
};

// Le premier temoin charge l ecran entier (une dizaine de secondes sur ce PC).
jest.setTimeout(30000);

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockSaveCollectivite.mockResolvedValue({ data: { documentId: 'stade-luminy' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  /** @type {any} */ (Alert.alert).mockRestore?.();
  act(() => { arbres.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.useRealTimers();
});

describe('VILLE-INSTALLATION 1 — « Créer » cree l installation avec l adresse choisie', () => {
  it('choisir dans la liste puis « Créer » : l envoi part, avec le point de la liste', async () => {
    const arbre = await monterVille();
    await remplirCommeAdel(arbre);
    expect(textes(arbre)).toContain(LIBELLE_LUMINY);

    await appuyer(parTexte(arbre, 'Créer'));

    expect(textes(arbre)).not.toContain(REFUS_ADRESSE);
    expect(mockSaveCollectivite).toHaveBeenCalledTimes(1);
    expect(mockSaveCollectivite.mock.calls[0][0].data.address).toEqual(ADRESSE_ENVOYEE);
  });

  it('rouvrir le champ, puis « Sélectionner » sans rien toucher : l adresse reste', async () => {
    const arbre = await monterVille();
    await remplirCommeAdel(arbre);

    await appuyer(parTexte(arbre, LIBELLE_LUMINY));
    await appuyer(parTexte(arbre, 'Sélectionner'));
    await attendre(50);
    await appuyer(parTexte(arbre, 'Créer'));

    expect(textes(arbre)).not.toContain(REFUS_ADRESSE);
    expect(mockSaveCollectivite).toHaveBeenCalledTimes(1);
    expect(mockSaveCollectivite.mock.calls[0][0].data.address).toEqual(ADRESSE_ENVOYEE);
  });

  it('rouvrir le champ puis toucher a cote de la feuille : l adresse reste', async () => {
    const arbre = await monterVille();
    await remplirCommeAdel(arbre);

    await appuyer(parTexte(arbre, LIBELLE_LUMINY));
    await appuyer(parId(arbre, 'fond'));
    await attendre(50);
    await appuyer(parTexte(arbre, 'Créer'));

    expect(mockSaveCollectivite).toHaveBeenCalledTimes(1);
    expect(mockSaveCollectivite.mock.calls[0][0].data.address).toEqual(ADRESSE_ENVOYEE);
  });
});
