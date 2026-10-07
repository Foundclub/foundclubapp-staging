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

// Ce que rend NOTRE serveur (`GET /geo/search`, admin `api/geo/services/providers/ban.ts`) : une
// RUE (le cas d Adel) et une COMMUNE (l installation « T » creee en prod le 07/10 a 11:49 avec
// « Marseille (13001) », [5.405, 43.282] — indice du chef d orchestre).
const mockReponsesDuServeur = {
  luminy: {
    address_line: 'Avenue de Luminy',
    city: 'Marseille',
    confidence: 0.92,
    country: 'FR',
    label: 'Avenue de Luminy 13009 Marseille',
    lat: 43.2318,
    lng: 5.4356,
    postcode: '13009',
    provider: 'ban',
    provider_id: '13209_5530',
    source: 'autocomplete',
  },
  marseille: {
    address_line: 'Marseille',
    city: 'Marseille',
    confidence: 0.97,
    country: 'FR',
    label: 'Marseille',
    lat: 43.282,
    lng: 5.405,
    postcode: '13001',
    provider: 'ban',
    provider_id: '13201',
    source: 'autocomplete',
  },
};
const mockClientGet = jest.fn(async (/** @type {string} */ chemin, /** @type {any} */ options) => {
  const q = String(options?.params?.q || '').toLowerCase();
  const trouvees = Object.entries(mockReponsesDuServeur)
    .filter(([clef]) => q.includes(clef)).map(([, lieu]) => lieu);
  return { data: chemin === '/geo/search' ? { data: trouvees, meta: {} } : { features: [] } };
});

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

// La recherche : le VRAI `searchPlaces` (validation Joi de la reponse, remise en point GeoJSON) ;
// seul l appel reseau est double. `useGetPlaces` garde son contrat : rien sous 3 lettres
// (`enabled`), une recherche videe ne rend plus rien.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: (/** @type {any[]} */ ...args) => mockClientGet(...args) },
}));
jest.mock('@/services/places/placesQueries', () => {
  const reactActuel = jest.requireActual('react');
  const { searchPlaces } = jest.requireActual('@/services/places/placesService');
  return {
    useGetPlaces: (/** @type {any} */ { options, searchParam, type }) => {
      const [data, setData] = reactActuel.useState(undefined);
      reactActuel.useEffect(() => {
        if (!options?.enabled) {
          setData(undefined);
          return undefined;
        }
        let vivant = true;
        searchPlaces(searchParam, type).then((lieux) => { if (vivant) setData(lieux); });
        return () => { vivant = false; };
      }, [options?.enabled, searchParam, type]);
      return { data, isLoading: false };
    },
  };
});

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

// Chercher dans la feuille ouverte, puis choisir une ligne de la liste et « Sélectionner ».
const chercherEtChoisir = async (
  /** @type {any} */ arbre,
  /** @type {string} */ recherche,
  /** @type {string} */ libelle,
) => {
  await saisir(arbre, 'saisie:Rechercher...', recherche);
  await attendre(400);
  await attendre(0);
  await appuyer(parId(arbre, `option:${libelle}`));
  await appuyer(parTexte(arbre, 'Sélectionner'));
  // Une seconde passe : la recherche s est videe (350 ms d attente de frappe).
  await attendre(1000);
};

// Le geste d Adel : un nom, un type, puis l adresse cherchee et choisie DANS LA LISTE.
const remplirCommeAdel = async (
  /** @type {any} */ arbre,
  recherche = 'Avenue de Luminy',
  libelle = LIBELLE_LUMINY,
) => {
  await saisir(arbre, 'saisie:Nom de l\'installation', 'Stade de Luminy');
  await appuyer(pressables(arbre).find((/** @type {any} */ noeud) => String(
    noeud.props?.accessibilityLabel || '',
  ).startsWith('Type')));
  await appuyer(parId(arbre, 'type-Terrain'));
  await appuyer(parTexte(arbre, INVITE_ADRESSE));
  await chercherEtChoisir(arbre, recherche, libelle);
};

// L adresse que le serveur doit recevoir : le point exact de la liste.
const ADRESSE_ENVOYEE = {
  description: LIBELLE_LUMINY,
  geometry: { coordinates: [5.4356, 43.2318], type: 'Point' },
};
const COMMUNE_ENVOYEE = {
  description: 'Marseille (13001)',
  geometry: { coordinates: [5.405, 43.282], type: 'Point' },
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
  // Indice du chef (prod, 07/10) : une COMMUNE a marche, une RUE non. Les deux formes, telles
  // que le serveur les rend, passent par le meme chemin : la forme n est pas la cause.
  it.each([
    ['une RUE', 'Avenue de Luminy', LIBELLE_LUMINY, ADRESSE_ENVOYEE],
    ['une COMMUNE', 'Marseille', 'Marseille (13001)', COMMUNE_ENVOYEE],
  ])('choisir %s dans la liste puis « Créer » : l envoi part, avec son point', async (
    _cas,
    recherche,
    libelle,
    attendue,
  ) => {
    const arbre = await monterVille();
    await remplirCommeAdel(arbre, recherche, libelle);
    expect(textes(arbre)).toContain(libelle);
    expect(textes(arbre)).toContain('GPS activé');

    await appuyer(parTexte(arbre, 'Créer'));

    expect(textes(arbre)).not.toContain(REFUS_ADRESSE);
    expect(mockSaveCollectivite).toHaveBeenCalledTimes(1);
    expect(mockSaveCollectivite.mock.calls[0][0].data.address).toEqual(attendue);
  });

  it('commune d abord, puis RUE choisie a la place : c est la rue qui part', async () => {
    const arbre = await monterVille();
    await remplirCommeAdel(arbre, 'Marseille', 'Marseille (13001)');

    await appuyer(parTexte(arbre, 'Marseille (13001)'));
    await chercherEtChoisir(arbre, 'Avenue de Luminy', LIBELLE_LUMINY);
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

  // Ce qu Adel decrit : « le libellé reste rouge » APRES avoir choisi la rue. Rechoisir une ligne
  // de la liste doit effacer le refus et laisser partir l envoi. (Avant le correctif, le premier
  // « Créer » est refuse ; apres, il part deja : on juge donc le DERNIER envoi.)
  it('apres un refus, rechoisir la rue efface l erreur et « Créer » part', async () => {
    const arbre = await monterVille();
    await remplirCommeAdel(arbre);
    await appuyer(parTexte(arbre, LIBELLE_LUMINY));
    await appuyer(parTexte(arbre, 'Sélectionner'));
    await attendre(50);
    await appuyer(parTexte(arbre, 'Créer'));

    await appuyer(parTexte(arbre, LIBELLE_LUMINY));
    await chercherEtChoisir(arbre, 'Avenue de Luminy', LIBELLE_LUMINY);
    expect(textes(arbre)).not.toContain(REFUS_ADRESSE);
    await appuyer(parTexte(arbre, 'Créer'));

    expect(mockSaveCollectivite).toHaveBeenCalled();
    expect(mockSaveCollectivite.mock.lastCall[0].data.address).toEqual(ADRESSE_ENVOYEE);
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
