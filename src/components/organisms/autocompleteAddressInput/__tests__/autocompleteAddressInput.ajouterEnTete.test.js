import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AutocompleteAddressInput from '../autocompleteAddressInput';

// ADRESSE-EN-PREMIER (REC17-008 bis, Adel le 20/10 15:46) — « mettre en premier champ l'adresse
// qu'on est en train de taper, avec « ajouter cette adresse », et là ça ouvre pour la placer,
// plutôt que de devoir scroller jusqu'en bas ».
//
// Avant : sur un champ de lieu PUBLIC, la porte vers la carte était SOUS les propositions
// (« Adresse introuvable ? Placez-la sur la carte », capture d'Adel : sous 5 rues, après
// défilement), ou, sans proposition, une phrase et un bouton en bas de la liste.
// Maintenant : dès que le texte est tapé, la PREMIÈRE ligne de la liste est
// « Ajouter « <texte> » », qui ouvre la carte pré-placée, le texte comme nom (le comportement de
// R17-ADRESSE). Une seule porte : le lien du bas et le bouton de la liste disparaissent.
//
// Même banc que autocompleteAddressInput.invitationCarte.test.js : le VRAI champ et la vraie
// liste ; seuls la feuille native, le réseau, la carte et la position sont doublés.

const mockSearchPlaces = jest.fn();
const mockChercherCommune = jest.fn();
const mockReverse = jest.fn();
const mockCreateLieu = jest.fn();
const mockCarte = [];
const mockPositionSiAccordee = jest.fn();

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
  chercherCommune: (/** @type {string} */ texte) => mockChercherCommune(texte),
  createLieu: (/** @type {any} */ lieu) => mockCreateLieu(lieu),
  getPlacesFromCoordinates: (/** @type {any} */ point) => mockReverse(point),
  searchPlaces: (/** @type {string} */ recherche, /** @type {string} */ type) => (
    mockSearchPlaces(recherche, type)
  ),
}));

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
        accessibilityRole="button"
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

const TAPE = 'Gymnase Toto Aix';
const AJOUTER = (/** @type {string} */ texte) => `Ajouter « ${texte} »`;
const AIDE = 'Place-le sur la carte';
const AIDE_VOUS = 'Placez-le sur la carte';
const INVITATION = 'Ton lieu n’est pas répertorié : place-le sur la carte';
const INVITATION_VOUS = 'Votre lieu n’est pas répertorié : placez-le sur la carte';
const ANCIEN_LIEN = 'Adresse introuvable ? Placez-la sur la carte';
const OUVRIR = 'Placer sur la carte';
const AUCUNE_DONNEE = 'common.messages.noData';
const NOM = 'Ex. Stade de Luminy';
const RECHERCHE = 'saisie:modals.actions.search';
const AIX = { label: 'Aix-en-Provence', lat: 43.5297, lng: 5.4474 };

// La capture d'Adel : cinq rues de la base d'adresses, aucune n'est le lieu tapé.
const RUES = [
  ['Rue du Stade 97410 Saint-Pierre', 55.4781, -21.3393],
  ['Rue du Stade 97425 Les Avirons', 55.3393, -21.2402],
  ['Rue du Stade 97440 Saint-André', 55.6503, -20.9632],
  ['Route de La Luminié 81640 Le Ségur', 2.0581, 44.1087],
  ['Rue du Stade 13100 Aix-en-Provence', 5.4401, 43.5262],
].map(([label, lng, lat]) => ({
  geometry: { coordinates: [lng, lat] },
  properties: { city: '', label },
}));

const aplatirTexte = (/** @type {any} */ noeud) => {
  if (Array.isArray(noeud)) return noeud.map(aplatirTexte).join(' ');
  if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return '';
  if (typeof noeud === 'object') return aplatirTexte(noeud.children);
  return String(noeud);
};
const texteVisible = (/** @type {any} */ arbre) => aplatirTexte(arbre.toJSON());
const feuilleOuverte = (/** @type {any} */ arbre) => (
  arbre.root.findAllByProps({ testID: 'feuille' }).length > 0
);
const carteOuverte = (/** @type {any} */ arbre) => (
  arbre.root.findAllByProps({ testID: 'carte-a-epingle' }).length > 0
);
const derniereCarte = () => mockCarte[mockCarte.length - 1];

/**
 * Monte le champ dans un vrai fournisseur react-query.
 * @param {any} proprietes Les propriétés du champ.
 * @returns {any} L'arbre rendu.
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
  return arbre;
};

const laisserTourner = async (/** @type {number} */ tours = 6) => {
  for (let tour = 0; tour < tours; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
  }
};

const ouvrirLeChamp = async (/** @type {any} */ arbre) => {
  const zones = arbre.root.findAllByType(TouchableOpacity)
    .filter((/** @type {any} */ noeud) => typeof noeud.props.onPress === 'function');
  act(() => {
    zones[0].props.onPress();
  });
  await laisserTourner(1);
};

const taper = async (/** @type {any} */ arbre, /** @type {string} */ texte) => {
  const saisie = arbre.root.findByProps({ testID: RECHERCHE });
  await act(async () => {
    saisie.props.onChangeText(texte);
  });
};

const ouvrirEtTaper = async (/** @type {any} */ arbre, /** @type {string} */ texte) => {
  await ouvrirLeChamp(arbre);
  await taper(arbre, texte);
  await laisserTourner();
};

/**
 * Le nœud appuyable qui porte ce libellé.
 * @param {any} arbre L'arbre rendu.
 * @param {string} libelle Le libellé exact.
 * @returns {any} Le nœud, ou null.
 */
const appuyableDe = (arbre, libelle) => {
  let noeud = arbre.root.findAllByType(Text)
    .find((/** @type {any} */ n) => aplatirTexte(n.props.children) === libelle);
  while (noeud && typeof noeud.props?.onPress !== 'function') noeud = noeud.parent;
  return noeud || null;
};

const appuyerSur = async (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  const noeud = appuyableDe(arbre, libelle);
  if (!noeud) throw new Error(`« ${libelle} » absent de l'écran`);
  await act(async () => {
    noeud.props.onPress();
  });
  await laisserTourner(2);
};

describe('ADRESSE-EN-PREMIER — « Ajouter « <texte tapé> » » en TÊTE de la liste', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCarte.length = 0;
    mockSearchPlaces.mockResolvedValue(RUES);
    mockChercherCommune.mockResolvedValue(null);
    mockReverse.mockResolvedValue(null);
    mockCreateLieu.mockResolvedValue(null);
    mockPositionSiAccordee.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('e1 la 1re ligne de la liste est « Ajouter « texte » », AVANT les propositions', async () => {
    const arbre = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, TAPE);

    const texte = texteVisible(arbre);
    expect(texte).toContain('Rue du Stade 97410 Saint-Pierre');
    expect(texte).toContain(AJOUTER(TAPE));
    expect(texte.indexOf(AJOUTER(TAPE)))
      .toBeLessThan(texte.indexOf('Rue du Stade 97410 Saint-Pierre'));
    // Une action, pas une proposition : un bouton, au libellé complet pour le lecteur d'écran.
    const ligne = appuyableDe(arbre, AJOUTER(TAPE));
    expect(ligne.props.accessibilityRole).toBe('button');
    expect(ligne.props.accessibilityLabel).toBe(`${AJOUTER(TAPE)}. ${AIDE}`);
    expect(texte).toContain(AIDE);
  });

  it('e2 elle suit la frappe tout de suite, sans attendre la recherche', async () => {
    mockSearchPlaces.mockReturnValue(new Promise(() => {}));
    const arbre = monter({ permettreLieuSurCarte: true });
    await ouvrirLeChamp(arbre);
    await taper(arbre, 'Gym');
    expect(texteVisible(arbre)).toContain(AJOUTER('Gym'));
    await taper(arbre, 'Gymnase');
    expect(texteVisible(arbre)).toContain(AJOUTER('Gymnase'));
    expect(texteVisible(arbre)).not.toContain(AJOUTER('Gym'));
  });

  it('e3 l appui ferme la liste, ouvre la carte, nom pré-rempli, valeur intacte', async () => {
    const setAddress = jest.fn();
    const arbre = monter({ permettreLieuSurCarte: true, setAddress });
    await ouvrirEtTaper(arbre, TAPE);
    await appuyerSur(arbre, AJOUTER(TAPE));

    expect(feuilleOuverte(arbre)).toBe(false);
    expect(carteOuverte(arbre)).toBe(true);
    expect(arbre.root.findByProps({ testID: `saisie:${NOM}` }).props.value).toBe(TAPE);
    // Comme le lien qu'elle remplace : la carte part de la 1re proposition, à la rue.
    expect(derniereCarte().regionHint).toEqual({ lat: -21.3393, lng: 55.4781, zoom: 16 });
    expect(setAddress).not.toHaveBeenCalled();
  });

  it('e4 rien de proposé : la même ligne porte l invitation, carte sur la commune', async () => {
    mockSearchPlaces.mockResolvedValue([]);
    mockChercherCommune.mockImplementation((/** @type {string} */ texte) => Promise.resolve(
      texte === TAPE ? AIX : null,
    ));
    const arbre = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, TAPE);

    expect(texteVisible(arbre)).toContain(AJOUTER(TAPE));
    expect(texteVisible(arbre)).toContain(INVITATION);
    expect(appuyableDe(arbre, AJOUTER(TAPE)).props.accessibilityLabel)
      .toBe(`${AJOUTER(TAPE)}. ${INVITATION}`);
    expect(texteVisible(arbre)).not.toContain(AUCUNE_DONNEE);

    await appuyerSur(arbre, AJOUTER(TAPE));
    await laisserTourner(2);
    expect(mockChercherCommune).toHaveBeenCalledWith(TAPE);
    expect(derniereCarte().regionHint).toEqual({ lat: 43.5297, lng: 5.4474, zoom: 13 });
    expect(arbre.root.findByProps({ testID: `saisie:${NOM}` }).props.value).toBe(TAPE);
  });

  it('e5 une seule porte : ni le lien du bas, ni le bouton dans la liste', async () => {
    const arbre = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, TAPE);
    expect(texteVisible(arbre)).not.toContain(ANCIEN_LIEN);
    expect(appuyableDe(arbre, OUVRIR)).toBeNull();

    mockSearchPlaces.mockResolvedValue([]);
    await taper(arbre, 'Gymnase Inconnu');
    await laisserTourner();
    expect(texteVisible(arbre)).toContain(INVITATION);
    expect(appuyableDe(arbre, OUVRIR)).toBeNull();
  });

  it('e6 la Ville est vouvoyée', async () => {
    const arbre = monter({ permettreLieuSurCarte: true, vouvoyer: true });
    await ouvrirEtTaper(arbre, TAPE);
    expect(texteVisible(arbre)).toContain(AIDE_VOUS);
    expect(texteVisible(arbre)).not.toContain(AIDE);

    mockSearchPlaces.mockResolvedValue([]);
    await taper(arbre, 'Gymnase Inconnu');
    await laisserTourner();
    expect(texteVisible(arbre)).toContain(INVITATION_VOUS);
  });

  it('e7 un texte long : tronqué à l écran, entier pour le lecteur et la carte', async () => {
    // 76 caractères : au-delà de 60 l'écran tronque ; jusqu'à 80, le nom du lieu est entier.
    const long = 'Complexe sportif municipal du quartier des Jardins de la Torse, côté parking';
    const arbre = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, long);

    const titre = arbre.root.findAllByType(Text)
      .map((/** @type {any} */ n) => aplatirTexte(n.props.children))
      .find((/** @type {string} */ libelle) => libelle.startsWith('Ajouter « '));
    expect(titre).toMatch(/^Ajouter « Complexe sportif municipal du quartier .+… »$/);
    expect(titre.length).toBeLessThan(AJOUTER(long).length);
    const debut = titre.slice('Ajouter « '.length, -' »'.length).replace(/…$/, '');
    expect(long.startsWith(debut)).toBe(true);
    const ligne = appuyableDe(arbre, titre);
    expect(ligne.props.accessibilityLabel).toBe(`${AJOUTER(long)}. ${AIDE}`);

    await appuyerSur(arbre, titre);
    expect(arbre.root.findByProps({ testID: `saisie:${NOM}` }).props.value).toBe(long);
  });

  it('e8 rien de tapé, ou moins de 3 caractères : pas de ligne', async () => {
    const arbre = monter({ permettreLieuSurCarte: true });
    await ouvrirLeChamp(arbre);
    expect(texteVisible(arbre)).not.toContain('Ajouter «');
    await taper(arbre, 'Gy');
    await laisserTourner();
    expect(texteVisible(arbre)).not.toContain('Ajouter «');
  });

  // Mesuré appelant par appelant (20/10) : sur les 24 champs SANS le réglage (profil, inscription,
  // partage en conversation, filtres, adversaire…), aucun n'accepte de texte libre aujourd'hui ; le
  // lieu court de la convocation est une saisie simple, hors de ce champ. Rien ne change pour eux.
  it('e9 sans le réglage : ni « Ajouter », ni « Utiliser », rien ne change', async () => {
    const setAddress = jest.fn();
    const arbre = monter({ setAddress });
    await ouvrirEtTaper(arbre, TAPE);

    expect(texteVisible(arbre)).toContain('Rue du Stade 97410 Saint-Pierre');
    expect(texteVisible(arbre)).not.toContain('Ajouter «');
    expect(texteVisible(arbre)).not.toContain('Utiliser «');
    expect(texteVisible(arbre)).not.toContain(ANCIEN_LIEN);
  });

  it('e10 tout le texte neuf est en français, sans emoji', async () => {
    const arbre = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, TAPE);
    expect(/\p{Extended_Pictographic}/u.test(texteVisible(arbre))).toBe(false);
    expect(arbre.root.findAllByType(TextInput).length).toBeGreaterThan(0);
  });
});
