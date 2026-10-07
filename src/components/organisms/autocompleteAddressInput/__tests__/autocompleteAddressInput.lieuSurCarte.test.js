import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AutocompleteAddressInput from '../autocompleteAddressInput';

// ADRESSE-CARTE (07/10) — « Adresse introuvable ? Placez-la sur la carte ».
//
// Le besoin d'Adel, en créant une installation : « si l'adresse qu'on veut n'est pas trouvée, on
// l'ajoute, et ça l'ajoute aussi dans notre base d'adresses ». Décision du 07/10 : dans le champ
// d'adresse PARTAGÉ, quand la liste ne trouve pas, un lien ouvre une carte ; on pose une épingle,
// on nomme le lieu ; le lieu devient une adresse comme une autre pour le formulaire.
//
// Ces témoins montent le VRAI champ (et la vraie liste déroulante) : seuls la feuille native, le
// réseau, la carte (une WebView sur téléphone, une iframe sur le site) et la position sont doublés.

const mockSearchPlaces = jest.fn();
const mockReverse = jest.fn();
const mockCreateLieu = jest.fn();
const mockCarte = [];
const mockPositionSiAccordee = jest.fn();
const mockDemanderPosition = jest.fn();

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const texte = typeof repli === 'string' ? repli : cle;
      const vars = typeof repli === 'object' ? repli : valeurs;
      return Object.entries(vars || {})
        .reduce((acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)), texte);
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/services/places/placesService', () => ({
  createLieu: (/** @type {any} */ lieu) => mockCreateLieu(lieu),
  getPlacesFromCoordinates: (/** @type {any} */ point) => mockReverse(point),
  searchPlaces: (/** @type {string} */ recherche, /** @type {string} */ type) => (
    mockSearchPlaces(recherche, type)
  ),
}));

// La carte : on garde ce qu'elle reçoit (le centre de départ, le rappel de déplacement).
jest.mock('@/platform/maps', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: {
      readCurrentLocationIfGranted: () => mockPositionSiAccordee(),
      renderPinMap: (/** @type {any} */ proprietes) => {
        mockCarte.push(proprietes);
        return <VueRN testID="carte-a-epingle" />;
      },
    },
  };
});

jest.mock('@/platform/maps/searchMapGeolocation', () => ({
  readCurrentSearchMapLocationIfGranted: () => mockPositionSiAccordee(),
  requestCurrentSearchMapLocation: () => mockDemanderPosition(),
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
        value={proprietes.value}
      />
    ),
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: Pressable } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      disabled, isLoading, onPress, title,
    }) => (
      <Pressable
        accessibilityState={{ disabled: Boolean(disabled || isLoading) }}
        disabled={disabled || isLoading}
        onPress={onPress}
      >
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

const LIEN = 'Adresse introuvable ? Placez-la sur la carte';
const NOM = 'Ex. Stade de Luminy';
const PLACER = 'Placer ici';

// Ce que la BAN rend pour « luminy » : une rue, pas le stade.
const RUE = {
  geometry: { coordinates: [5.4352, 43.2321] },
  properties: {
    city: 'Marseille',
    id: 'ban-rue',
    label: 'Route de Luminy 13009 Marseille',
    name: 'Route de Luminy',
    postcode: '13009',
    type: 'street',
  },
};

// Ce que le serveur rend pour un lieu posé (POST /lieux), à la forme d'une proposition de
// /geo/search.
const LIEU_POSE = {
  existing: false,
  place: {
    geometry: { coordinates: [5.4371, 43.2289] },
    properties: {
      city: 'Marseille',
      context: 'FR',
      id: 'lieu:abc',
      label: 'Stade de Luminy (13009 Marseille)',
      postcode: '13009',
      provider: 'internal',
      source: 'manual',
      street: 'Route de Luminy',
    },
  },
};

const aplatirTexte = (/** @type {any} */ noeud) => {
  if (Array.isArray(noeud)) return noeud.map(aplatirTexte).join(' ');
  if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return '';
  if (typeof noeud === 'object') return aplatirTexte(noeud.children);
  return String(noeud);
};
const texteVisible = (/** @type {any} */ arbre) => aplatirTexte(arbre.toJSON());

/**
 * Monte le champ dans un vrai fournisseur react-query.
 * @param {any} proprietes Les propriétés du champ.
 * @returns {{ arbre: any, client: QueryClient }} L'arbre rendu et son client.
 */
const monter = (proprietes = {}) => {
  const client = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { gcTime: 0, retry: false, staleTime: 60 * 60 * 1000 },
    },
  });
  let arbre;
  act(() => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <AutocompleteAddressInput
          label="Adresse"
          placeholder="Rechercher une adresse"
          // eslint-disable-next-line react/jsx-props-no-spreading
          {...proprietes}
        />
      </QueryClientProvider>,
    );
  });
  return { arbre, client };
};

const laisserTourner = async (/** @type {number} */ tours = 6) => {
  for (let tour = 0; tour < tours; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
  }
};

const ouvrirEtTaper = async (/** @type {any} */ arbre, /** @type {string} */ texte) => {
  const zones = arbre.root.findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ noeud) => typeof noeud.props.onPress === 'function');
  act(() => {
    zones[0].props.onPress();
  });
  await laisserTourner(1);
  const saisie = arbre.root.findAllByType(TextInput)
    .find((/** @type {any} */ noeud) => noeud.props.editable !== false);
  await act(async () => {
    saisie.props.onChangeText(texte);
  });
  await laisserTourner();
};

const appuyerSurLeTexte = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const texte = arbre.root.findAllByType(Text)
    .find((/** @type {any} */ n) => aplatirTexte(n.props.children) === libelle);
  if (!texte) throw new Error(`« ${libelle} » absent de l'écran`);
  let noeud = texte;
  while (noeud && typeof noeud.props?.onPress !== 'function') noeud = noeud.parent;
  await act(async () => {
    noeud.props.onPress();
  });
  await laisserTourner(2);
};

const pressableDe = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  let noeud = arbre.root.findAllByType(Text)
    .find((/** @type {any} */ n) => aplatirTexte(n.props.children) === libelle);
  while (noeud && typeof noeud.props?.onPress !== 'function') noeud = noeud.parent;
  return noeud;
};

const derniereCarte = () => mockCarte[mockCarte.length - 1];

describe('ADRESSE-CARTE — « Adresse introuvable ? Placez-la sur la carte »', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCarte.length = 0;
    mockSearchPlaces.mockResolvedValue([]);
    mockReverse.mockResolvedValue(RUE);
    mockCreateLieu.mockResolvedValue(LIEU_POSE);
    mockPositionSiAccordee.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('① adresse introuvable ⇒ le lien sous la liste (champ d un lieu public)', async () => {
    const { arbre } = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, 'stade de luminy');
    expect(mockSearchPlaces).toHaveBeenCalledWith('stade de luminy', undefined);
    expect(texteVisible(arbre)).toContain(LIEN);
  });

  it('① bis sans le réglage : JAMAIS le lien (profil, filtres, conversation)', async () => {
    const { arbre } = monter();
    await ouvrirEtTaper(arbre, 'stade de luminy');
    expect(texteVisible(arbre)).not.toContain(LIEN);
  });

  it('② la carte part de la 1re proposition tapée, sans rien demander', async () => {
    mockSearchPlaces.mockResolvedValue([RUE]);
    const { arbre } = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, 'luminy');
    expect(texteVisible(arbre)).toContain('Route de Luminy 13009 Marseille');
    await appuyerSurLeTexte(arbre, LIEN);

    expect(arbre.root.findAllByProps({ testID: 'carte-a-epingle' }).length).toBeGreaterThan(0);
    expect(derniereCarte().regionHint).toEqual({ lat: 43.2321, lng: 5.4352, zoom: 16 });
    expect(mockDemanderPosition).not.toHaveBeenCalled();
    expect(mockPositionSiAccordee).not.toHaveBeenCalled();
  });

  it('② bis rien trouvé : la position SEULEMENT si déjà accordée, jamais demandée', async () => {
    mockPositionSiAccordee.mockResolvedValue({ lat: 45.76, lng: 4.83 });
    const { arbre } = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, 'stade inconnu');
    await appuyerSurLeTexte(arbre, LIEN);
    await laisserTourner(2);

    expect(mockPositionSiAccordee).toHaveBeenCalledTimes(1);
    expect(mockDemanderPosition).not.toHaveBeenCalled();
    expect(derniereCarte().regionHint).toEqual({ lat: 45.76, lng: 4.83, zoom: 16 });
  });

  it('② ter sinon la France, et « Placer ici » attend le zoom de la rue', async () => {
    const { arbre } = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, 'stade inconnu');
    await appuyerSurLeTexte(arbre, LIEN);
    await laisserTourner(2);

    expect(derniereCarte().regionHint.zoom).toBeLessThan(10);
    const saisieNom = arbre.root.findByProps({ testID: `saisie:${NOM}` });
    await act(async () => {
      saisieNom.props.onChangeText('Stade de Luminy');
    });
    expect(pressableDe(arbre, PLACER).props.disabled).toBe(true);
    expect(texteVisible(arbre)).toContain('Zoomez jusqu’à la rue');
  });

  it('③ épingle + nom ⇒ le lieu part, le FORMULAIRE reçoit le point', async () => {
    mockSearchPlaces.mockResolvedValue([RUE]);
    const setAddress = jest.fn();
    const { arbre } = monter({ address: undefined, permettreLieuSurCarte: true, setAddress });
    await ouvrirEtTaper(arbre, 'luminy');
    await appuyerSurLeTexte(arbre, LIEN);

    // On déplace la carte : l'épingle (au centre) est sur le stade.
    await act(async () => {
      derniereCarte().onRegionChangeComplete({ lat: 43.2289, lng: 5.4371, zoom: 17 });
    });
    await laisserTourner(3);
    expect(mockReverse).toHaveBeenCalledWith({ lat: 43.2289, lon: 5.4371 });
    expect(texteVisible(arbre)).toContain('Route de Luminy 13009 Marseille');

    const saisieNom = arbre.root.findByProps({ testID: `saisie:${NOM}` });
    await act(async () => {
      saisieNom.props.onChangeText('  Stade de Luminy ');
    });
    await appuyerSurLeTexte(arbre, PLACER);

    expect(mockCreateLieu).toHaveBeenCalledWith({
      addressLine: 'Route de Luminy',
      city: 'Marseille',
      lat: 43.2289,
      lng: 5.4371,
      name: 'Stade de Luminy',
      postcode: '13009',
    });
    expect(setAddress).toHaveBeenLastCalledWith(expect.objectContaining({
      city: 'Marseille',
      label: 'Stade de Luminy (13009 Marseille)',
      lat: 43.2289,
      lng: 5.4371,
      postcode: '13009',
      value: '5.4371|43.2289',
    }));
    expect(arbre.root.findAllByProps({ testID: 'carte-a-epingle' }).length).toBe(0);
  });

  it('④ refus sans nom : « Placer ici » reste inactif, rien ne part', async () => {
    mockSearchPlaces.mockResolvedValue([RUE]);
    const setAddress = jest.fn();
    const { arbre } = monter({ permettreLieuSurCarte: true, setAddress });
    await ouvrirEtTaper(arbre, 'luminy');
    await appuyerSurLeTexte(arbre, LIEN);
    await act(async () => {
      arbre.root.findByProps({ testID: `saisie:${NOM}` }).props.onChangeText('St');
    });

    expect(pressableDe(arbre, PLACER).props.disabled).toBe(true);
    expect(texteVisible(arbre)).toContain('Donnez un nom au lieu');
    expect(mockCreateLieu).not.toHaveBeenCalled();
    expect(setAddress).not.toHaveBeenCalled();
  });

  it('④ bis un refus du serveur se DIT dans la carte ; le formulaire ne reçoit rien', async () => {
    mockSearchPlaces.mockResolvedValue([RUE]);
    mockCreateLieu.mockRejectedValue({
      response: { data: { error: { details: { code: 'LIEU_PERSONAL_DATA' } }, status: 400 } },
    });
    const setAddress = jest.fn();
    const { arbre } = monter({ permettreLieuSurCarte: true, setAddress });
    await ouvrirEtTaper(arbre, 'luminy');
    await appuyerSurLeTexte(arbre, LIEN);
    await act(async () => {
      arbre.root.findByProps({ testID: `saisie:${NOM}` })
        .props.onChangeText('Chez Paul 06 12 34 56 78');
    });
    await appuyerSurLeTexte(arbre, PLACER);

    expect(texteVisible(arbre)).toContain('pas de courriel, de téléphone ni de lien');
    expect(setAddress).not.toHaveBeenCalled();
    expect(arbre.root.findAllByProps({ testID: 'carte-a-epingle' }).length).toBeGreaterThan(0);
  });

  it('⑤ « Annuler » referme la carte et garde l adresse d avant', async () => {
    mockSearchPlaces.mockResolvedValue([RUE]);
    const setAddress = jest.fn();
    const avant = {
      label: 'Ancienne adresse', lat: 1, lng: 2, value: '2|1',
    };
    const { arbre } = monter({ address: avant, permettreLieuSurCarte: true, setAddress });
    await ouvrirEtTaper(arbre, 'luminy');
    await appuyerSurLeTexte(arbre, LIEN);
    await appuyerSurLeTexte(arbre, 'Annuler');

    expect(arbre.root.findAllByProps({ testID: 'carte-a-epingle' }).length).toBe(0);
    expect(setAddress).not.toHaveBeenCalled();
    expect(texteVisible(arbre)).toContain('Ancienne adresse');
  });

  it('⑥ le lieu posé est proposé à la recherche SUIVANTE (cache local vidé)', async () => {
    mockSearchPlaces.mockResolvedValue([RUE]);
    const { arbre } = monter({ permettreLieuSurCarte: true, setAddress: jest.fn() });
    await ouvrirEtTaper(arbre, 'luminy');
    const appelsAvant = mockSearchPlaces.mock.calls.length;
    await appuyerSurLeTexte(arbre, LIEN);
    await act(async () => {
      derniereCarte().onRegionChangeComplete({ lat: 43.2289, lng: 5.4371, zoom: 17 });
    });
    await act(async () => {
      arbre.root.findByProps({ testID: `saisie:${NOM}` }).props.onChangeText('Stade de Luminy');
    });
    await appuyerSurLeTexte(arbre, PLACER);

    // La même frappe, une heure de cache plus tard : la recherche repart au serveur.
    await ouvrirEtTaper(arbre, 'luminy');
    expect(mockSearchPlaces.mock.calls.length).toBeGreaterThan(appelsAvant);
  });

  it('⑦ tout le texte est en français, sans emoji', async () => {
    mockSearchPlaces.mockResolvedValue([RUE]);
    const { arbre } = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, 'luminy');
    await appuyerSurLeTexte(arbre, LIEN);
    const texte = texteVisible(arbre);
    expect(texte).toContain('Placer le lieu sur la carte');
    expect(arbre.root.findAllByProps({ testID: `saisie:${NOM}` }, { deep: false }).length).toBe(1);
    expect(/\p{Extended_Pictographic}/u.test(texte)).toBe(false);
  });
});
