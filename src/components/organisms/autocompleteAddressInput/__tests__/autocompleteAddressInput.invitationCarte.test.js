import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AutocompleteAddressInput from '../autocompleteAddressInput';

// R17-ADRESSE (REC17-008, recette d'Adel du 17/10) — « Si je tape une adresse et qu'elle n'est pas
// référencée dans la liste des adresses, il faut pouvoir choisir une adresse au champ libre ; je
// sais que ça pose un enjeu : rendre le lieu introuvable dans la recherche ; peut-être en demandant
// intelligemment « votre point n'est pas répertorié, veuillez le placer sur la carte », en essayant
// de le placer avec les infos qu'on a. »
//
// Réglage du chef (19/10) : pas de texte libre pour un lieu PUBLIC (il disparaîtrait de la
// recherche par distance) ; à la place, l'invitation s'affiche D'ELLE-MÊME, la carte s'ouvre sur ce
// qu'on sait (la commune tapée, sinon la ville de l'objet, sinon la position déjà accordée, sinon
// la France) avec le texte tapé comme nom, et le texte tapé n'est plus effacé à la fermeture de la
// liste tant que la carte n'a pas été proposée.
//
// Ces témoins montent le VRAI champ et la vraie liste : seuls la feuille native, le réseau, la
// carte et la position sont doublés (même banc que autocompleteAddressInput.lieuSurCarte.test.js).

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

const INVITATION = 'Ton lieu n’est pas répertorié : place-le sur la carte';
const INVITATION_VOUS = 'Votre lieu n’est pas répertorié : placez-le sur la carte';
// Sous le champ (liste refermée), la phrase RAPPELLE le texte tapé (chef, 19/10 ~18:55) : à côté
// d'une adresse déjà enregistrée, « Ton lieu » seul laissait croire que c'était elle.
const SOUS_LE_CHAMP = '« Gymnase Toto Aix-en-Provence » n’est pas répertorié : place-le sur'
  + ' la carte';
const SOUS_LE_CHAMP_VOUS = '« Gymnase Toto Aix-en-Provence » n’est pas répertorié : placez-le sur'
  + ' la carte';
const OUVRIR = 'Placer sur la carte';
const ANCIEN_LIEN = 'Adresse introuvable ? Placez-la sur la carte';
// ADRESSE-EN-PREMIER (20/10) : DANS la liste, la porte vers la carte est sa 1re ligne, « Ajouter
// « <texte tapé> » » (autocompleteAddressInput.ajouterEnTete.test.js) ; l'invitation en est l'aide.
// Le bouton OUVRIR ne vit plus que SOUS le champ, liste refermée.
const PORTE = (/** @type {string} */ texte) => `Ajouter « ${texte} »`;
const SANS_POINT = 'Cette adresse n’est pas sur la carte : on ne la trouve pas en cherchant'
  + ' autour de soi.';
const NOM = 'Ex. Stade de Luminy';
const SELECTIONNER = 'modals.actions.select';
const RECHERCHE = 'saisie:modals.actions.search';
const TAPE = 'Gymnase Toto Aix-en-Provence';
const AIX = { label: 'Aix-en-Provence', lat: 43.5297, lng: 5.4474 };

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

const ouvrirEtTaper = async (/** @type {any} */ arbre, /** @type {string} */ texte) => {
  await ouvrirLeChamp(arbre);
  const saisie = arbre.root.findByProps({ testID: RECHERCHE });
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

const estUnBouton = (/** @type {any} */ arbre, /** @type {string} */ libelle) => {
  let noeud = arbre.root.findAllByType(Text)
    .find((/** @type {any} */ n) => aplatirTexte(n.props.children) === libelle);
  while (noeud && typeof noeud.props?.onPress !== 'function') noeud = noeud.parent;
  return noeud?.props?.accessibilityRole === 'button';
};

describe('R17-ADRESSE — l adresse absente des suggestions : « place-le sur la carte »', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockCarte.length = 0;
    mockSearchPlaces.mockResolvedValue([]);
    mockChercherCommune.mockResolvedValue(null);
    mockReverse.mockResolvedValue(null);
    mockCreateLieu.mockResolvedValue(null);
    mockPositionSiAccordee.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('(a) l invitation s affiche d elle-même', () => {
    it('a1 aucune suggestion ⇒ la phrase ET un bouton, sans toucher de lien', async () => {
      const arbre = monter({ permettreLieuSurCarte: true });
      await ouvrirEtTaper(arbre, TAPE);

      expect(texteVisible(arbre)).toContain(INVITATION);
      expect(estUnBouton(arbre, PORTE(TAPE))).toBe(true);
      expect(texteVisible(arbre)).not.toContain(ANCIEN_LIEN);
    });

    it('a2 la liste refermée : le texte tapé reste, l invitation reste SOUS le champ', async () => {
      const arbre = monter({ permettreLieuSurCarte: true, setAddress: jest.fn() });
      await ouvrirEtTaper(arbre, TAPE);
      await appuyerSurLeTexte(arbre, SELECTIONNER);

      expect(feuilleOuverte(arbre)).toBe(false);
      expect(texteVisible(arbre)).toContain(SOUS_LE_CHAMP);
      expect(estUnBouton(arbre, OUVRIR)).toBe(true);

      await ouvrirLeChamp(arbre);
      expect(arbre.root.findByProps({ testID: RECHERCHE }).props.value).toBe(TAPE);
      // Dans la liste, le texte est déjà dans la saisie : la phrase courte suffit.
      expect(texteVisible(arbre)).toContain(INVITATION);
    });

    it('a2 bis sous le champ, la Ville est vouvoyée elle aussi', async () => {
      const arbre = monter({ permettreLieuSurCarte: true, setAddress: jest.fn(), vouvoyer: true });
      await ouvrirEtTaper(arbre, TAPE);
      await appuyerSurLeTexte(arbre, SELECTIONNER);

      expect(texteVisible(arbre)).toContain(SOUS_LE_CHAMP_VOUS);
    });

    it('a3 la Ville est vouvoyée', async () => {
      const arbre = monter({ permettreLieuSurCarte: true, vouvoyer: true });
      await ouvrirEtTaper(arbre, TAPE);

      expect(texteVisible(arbre)).toContain(INVITATION_VOUS);
      expect(texteVisible(arbre)).not.toContain(INVITATION);
    });

    it('a4 des suggestions ⇒ pas d invitation ; porte en tête, plus de lien en bas', async () => {
      mockSearchPlaces.mockResolvedValue([{
        geometry: { coordinates: [5.4352, 43.2321] },
        properties: { city: 'Marseille', label: 'Route de Luminy 13009 Marseille' },
      }]);
      const arbre = monter({ permettreLieuSurCarte: true });
      await ouvrirEtTaper(arbre, 'luminy');

      expect(estUnBouton(arbre, PORTE('luminy'))).toBe(true);
      expect(texteVisible(arbre)).not.toContain(ANCIEN_LIEN);
      expect(texteVisible(arbre)).not.toContain(INVITATION);
    });

    it('a5 sans le réglage (profil, filtres, conversation) : rien ne change', async () => {
      const arbre = monter({ setAddress: jest.fn() });
      await ouvrirEtTaper(arbre, TAPE);

      expect(texteVisible(arbre)).not.toContain(INVITATION);
      await appuyerSurLeTexte(arbre, SELECTIONNER);
      expect(texteVisible(arbre)).not.toContain(INVITATION);
      await ouvrirLeChamp(arbre);
      expect(arbre.root.findByProps({ testID: RECHERCHE }).props.value).toBeUndefined();
    });
  });

  describe('(b) la carte s ouvre sur ce qu on sait, le nom pré-rempli', () => {
    it('b1 la commune tapée ⇒ carte centrée sur elle, nom = texte tapé', async () => {
      mockChercherCommune.mockImplementation((/** @type {string} */ texte) => Promise.resolve(
        texte === TAPE ? AIX : null,
      ));
      const arbre = monter({ permettreLieuSurCarte: true, villeConnue: 'Vitrolles' });
      await ouvrirEtTaper(arbre, TAPE);
      await appuyerSurLeTexte(arbre, PORTE(TAPE));
      await laisserTourner(2);

      expect(carteOuverte(arbre)).toBe(true);
      expect(mockChercherCommune).toHaveBeenCalledWith(TAPE);
      expect(derniereCarte().regionHint).toEqual({ lat: 43.5297, lng: 5.4474, zoom: 13 });
      expect(arbre.root.findByProps({ testID: `saisie:${NOM}` }).props.value).toBe(TAPE);
      expect(mockPositionSiAccordee).not.toHaveBeenCalled();
    });

    it('b2 rien de reconnu dans le texte ⇒ la ville de l objet (club, Ville, équipe)', async () => {
      mockChercherCommune.mockImplementation((/** @type {string} */ texte) => Promise.resolve(
        texte === 'Vitrolles' ? { label: 'Vitrolles', lat: 43.46, lng: 5.25 } : null,
      ));
      const arbre = monter({ permettreLieuSurCarte: true, villeConnue: 'Vitrolles' });
      await ouvrirEtTaper(arbre, 'Gymnase Toto');
      await appuyerSurLeTexte(arbre, PORTE('Gymnase Toto'));
      await laisserTourner(2);

      expect(mockChercherCommune.mock.calls.map((appel) => appel[0]))
        .toEqual(['Gymnase Toto', 'Vitrolles']);
      expect(derniereCarte().regionHint).toEqual({ lat: 43.46, lng: 5.25, zoom: 13 });
      expect(mockPositionSiAccordee).not.toHaveBeenCalled();
    });

    it('b3 ni commune ni ville ⇒ la position déjà accordée, sinon la France', async () => {
      mockPositionSiAccordee.mockResolvedValue({ lat: 45.76, lng: 4.83 });
      const arbre = monter({ permettreLieuSurCarte: true });
      await ouvrirEtTaper(arbre, 'Gymnase Toto');
      await appuyerSurLeTexte(arbre, PORTE('Gymnase Toto'));
      await laisserTourner(2);

      expect(mockPositionSiAccordee).toHaveBeenCalledTimes(1);
      expect(derniereCarte().regionHint).toEqual({ lat: 45.76, lng: 4.83, zoom: 16 });
    });

    it('b4 la carte proposée, le texte gardé a servi : refermée, plus d invitation', async () => {
      const arbre = monter({ permettreLieuSurCarte: true, setAddress: jest.fn() });
      await ouvrirEtTaper(arbre, TAPE);
      await appuyerSurLeTexte(arbre, PORTE(TAPE));
      await appuyerSurLeTexte(arbre, 'Annuler');

      expect(carteOuverte(arbre)).toBe(false);
      expect(texteVisible(arbre)).not.toContain(INVITATION);
    });
  });

  describe('(c) un champ de lieu public ne valide JAMAIS une adresse sans point', () => {
    it('c1 texte sans suggestion + « Sélectionner » ⇒ aucun texte libre ne part', async () => {
      const setAddress = jest.fn();
      const arbre = monter({ permettreLieuSurCarte: true, setAddress });
      await ouvrirEtTaper(arbre, TAPE);
      await appuyerSurLeTexte(arbre, SELECTIONNER);

      setAddress.mock.calls.forEach(([valeur]) => {
        expect(valeur === undefined
          || (Number.isFinite(valeur.lat) && Number.isFinite(valeur.lng))).toBe(true);
      });
      expect(setAddress).not.toHaveBeenCalledWith(expect.objectContaining({ label: TAPE }));
    });

    it('c2 une adresse enregistrée SANS point se dit, et la carte s ouvre dessus', async () => {
      mockChercherCommune.mockImplementation((/** @type {string} */ texte) => Promise.resolve(
        texte === 'Stade Toto 13080 Aix-en-Provence' ? AIX : null,
      ));
      const arbre = monter({
        address: { label: 'Stade Toto 13080 Aix-en-Provence' },
        permettreLieuSurCarte: true,
        setAddress: jest.fn(),
      });

      expect(texteVisible(arbre)).toContain(SANS_POINT);
      await appuyerSurLeTexte(arbre, OUVRIR);
      await laisserTourner(2);

      expect(derniereCarte().regionHint).toEqual({ lat: 43.5297, lng: 5.4474, zoom: 13 });
      expect(arbre.root.findByProps({ testID: `saisie:${NOM}` }).props.value)
        .toBe('Stade Toto 13080 Aix-en-Provence');
    });

    it('c3 une adresse AVEC son point ne dit rien', () => {
      const arbre = monter({
        address: {
          label: 'Route de Luminy 13009 Marseille',
          lat: 43.2321,
          lng: 5.4352,
          value: '5.4352|43.2321',
        },
        permettreLieuSurCarte: true,
        setAddress: jest.fn(),
      });

      expect(texteVisible(arbre)).not.toContain(SANS_POINT);
      expect(texteVisible(arbre)).not.toContain(OUVRIR);
    });
  });

  it('tout le texte neuf est en français, sans emoji ; la frappe reste un TextInput', async () => {
    const arbre = monter({ permettreLieuSurCarte: true });
    await ouvrirEtTaper(arbre, TAPE);
    expect(/\p{Extended_Pictographic}/u.test(texteVisible(arbre))).toBe(false);
    expect(arbre.root.findAllByType(TextInput).length).toBeGreaterThan(0);
  });
});
