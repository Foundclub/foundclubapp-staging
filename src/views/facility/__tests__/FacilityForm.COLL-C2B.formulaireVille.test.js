import {
  Alert, Switch, Text, TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { createFacility, updateFacility } from '@/services/facility/facilityService';

import FacilityForm from '../FacilityForm';

// 📐 COLL-C2B (02/10/2026), planche 2 du design HY521H1 : « P4-form-tel » (le formulaire
// d installation de la Ville, restyle) et « P4v3-plateaux-tel », ecran 1 (les plateaux nommes,
// D66 ; contrat C2A §8). Le vrai fr.js ecrit les phrases.
//
// Ce que ce temoin exige (ROUGE avant le lot) :
//   - six groupes nommes, dans l ordre ou l on pense : l essentiel, ou, quand, combien,
//     quand c est plein, la couleur ;
//   - le type dans une feuille, limite aux 11 types d une mairie (ni « Salle video », ni
//     « Club House ») ; en creation, rien n est choisi d avance ;
//   - « Creer » s allume quand le nom, le type et l adresse sont la ;
//   - « Nommer les plateaux » : un interrupteur sous « equipes a la fois » (a partir de 2),
//     puis un nom par plateau ; les noms partent au serveur, vides ou en double ils sont
//     refuses ici ; eteindre l interrupteur les efface ; ne rien toucher n envoie rien ;
//   - les erreurs : sous leur champ ET « n champs a corriger » en haut, sans fenetre systeme ;
//     un refus du serveur se lit au-dessus du bouton.
// Et le formulaire du CLUB ne change pas (ses 13 pastilles, aucun groupe, aucun plateau).

const i18nextTemoin = require('i18next');

const frTemoin = require('@/theme/strings/translations/fr');

(i18nextTemoin.default || i18nextTemoin).init({
  compatibilityJSON: 'v4',
  fallbackLng: 'fr',
  lng: 'fr',
  resources: { fr: { translation: frTemoin.default } },
});

/** @type {any[]} */
const mockInputProps = [];
/** @type {any[]} */
const mockAddressProps = [];
/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;
/** @type {any} */
let mockCollectiviteInstallations;
const mockSaveCollectivite = jest.fn();

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
  default: () => ({ userData: { club: { documentId: 'club-1' } } }),
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
      Images: { pin: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/services/facility/facilityQueries', () => ({
  useGetFacility: () => ({
    data: null, error: null, isLoading: false, refetch: jest.fn(),
  }),
}));

jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useCollectiviteInstallations: () => mockCollectiviteInstallations,
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
jest.mock('@/components/molecules/input/Input', () => function InputMock(/** @type {any} */ props) {
  mockInputProps.push(props);
  return null;
});
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => function AutocompleteAddressInputMock(/** @type {any} */ props) {
    mockAddressProps.push(props);
    return null;
  },
);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() { return null; },
);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock(
  /** @type {any} */ { children, isVisible },
) {
  return isVisible ? children : null;
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN, TouchableOpacity: PressableRN, View: VueRN,
  } = jest.requireActual('react-native');
  return function SegmentedControlMock(/** @type {any} */ { onChange, options }) {
    return reactActuel.createElement(VueRN, null, (options || []).map(
      (/** @type {any} */ option) => reactActuel.createElement(
        PressableRN,
        { key: option.value, onPress: () => onChange(option.value) },
        reactActuel.createElement(TexteRN, null, option.label),
      ),
    ));
  };
});

const ADRESSE_GEOCODEE = { label: '12 rue des Tilleuls, Montrivage', value: '5.39|43.26' };
const GYMNASE = {
  address: ADRESSE_GEOCODEE,
  capacityConflictMode: 'pending_validation',
  closingTime: '22:00:00.000',
  documentId: 'gym-tilleuls',
  maxSlots: 2,
  name: 'Gymnase des Tilleuls',
  openingTime: '08:00:00.000',
  planningColor: null,
  type: 'Gymnase',
};

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
const parLibelle = (/** @type {any} */ arbre, /** @type {string} */ libelle) => pressables(arbre)
  .find((/** @type {any} */ noeud) => String(noeud.props?.accessibilityLabel || '')
    .startsWith(libelle));
const appuyer = async (/** @type {any} */ noeud) => {
  await act(async () => { noeud.props.onPress(); });
};
const champ = (/** @type {string} */ libelle) => mockInputProps
  .filter((props) => props.label === libelle).pop();
const saisir = async (/** @type {string} */ libelle, /** @type {string} */ valeur) => {
  await act(async () => { champ(libelle).onChangeText(valeur); });
};
const choisirAdresse = async (/** @type {any} */ adresse) => {
  await act(async () => { mockAddressProps[mockAddressProps.length - 1].setAddress(adresse); });
};
const interrupteur = (/** @type {any} */ arbre) => arbre.root.findAllByType(Switch)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === 'Nommer les plateaux');
const basculer = async (/** @type {any} */ arbre, /** @type {boolean} */ valeur) => {
  await act(async () => { interrupteur(arbre).props.onValueChange(valeur); });
};

/** @type {any[]} */
const arbres = [];
const monter = async (/** @type {any} */ params) => {
  mockRoute = { params };
  /** @type {any} */
  let arbre;
  await act(async () => { arbre = renderer.create(<FacilityForm />); });
  arbres.push(arbre);
  return arbre;
};
const monterVille = (/** @type {any} */ extra = {}) => monter({
  collectiviteId: 'ville-montrivage', ...extra,
});
const monterModifier = async (/** @type {any} */ installation) => {
  mockCollectiviteInstallations = { ...mockCollectiviteInstallations, data: [installation] };
  return monterVille({ facilityId: installation.documentId });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockInputProps.length = 0;
  mockAddressProps.length = 0;
  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockCollectiviteInstallations = {
    data: [], error: null, isLoading: false, refetch: jest.fn(),
  };
  mockSaveCollectivite.mockResolvedValue({ data: { documentId: 'gym-tilleuls' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  /** @type {any} */ (Alert.alert).mockRestore?.();
  act(() => { arbres.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('COLL-C2B planche 2 — six groupes, et le type dans une feuille', () => {
  // VILLE-INSTALLATION (07/10) — décision d Adel « on ne met pas d ouverture ni de fermeture » :
  // le groupe « Quand » (Ouverture / Fermeture) est parti ; il en reste cinq, dans le même ordre.
  it('les cinq groupes, dans l ordre du dessin, sans « Quand »', async () => {
    const lus = textes(await monterVille());
    expect(lus).not.toContain('Quand');
    expect(champ('Ouverture')).toBeUndefined();
    expect(champ('Fermeture')).toBeUndefined();
    const groupes = [
      'L’essentiel', 'Où', 'Combien d’équipes à la fois', 'Quand c’est plein',
      'Couleur dans le planning',
    ];
    const positions = groupes.map((groupe) => lus.indexOf(groupe));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(lus.filter((texte) => texte === 'Couleur dans le planning')).toHaveLength(1);
  });

  it('nouvelle : aucun type d avance, « Creer » eteint sans nom, type et adresse', async () => {
    const arbre = await monterVille();
    expect(textes(arbre)).toContain('Choisir le type');
    expect(parTexte(arbre, 'Créer').props.disabled).toBe(true);
    await saisir('Nom de l\'installation', 'Gymnase des Tilleuls');
    await choisirAdresse(ADRESSE_GEOCODEE);
    expect(parTexte(arbre, 'Créer').props.disabled).toBe(true);

    await appuyer(parLibelle(arbre, 'Type'));
    await appuyer(parTexte(arbre, 'Gymnase'));
    expect(parTexte(arbre, 'Créer').props.disabled).toBe(false);
  });

  it('la feuille propose les 11 types d une mairie, pas ceux d un club', async () => {
    const arbre = await monterVille();
    await appuyer(parLibelle(arbre, 'Type'));
    const lus = textes(arbre);
    ['Gymnase', 'Salle de sport', 'Dojo', 'Terrain', 'Terrain multisport', 'Terrain de rugby',
      'Piste d’athlétisme', 'Piscine', 'Court de tennis', 'Skatepark', 'Vestiaire']
      .forEach((type) => expect(lus).toContain(type));
    expect(lus).not.toContain('Salle vidéo');
    expect(lus).not.toContain('Club House');
    const lignes = arbre.root.findAllByType(TouchableOpacity)
      .filter((/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'radio'
        && String(noeud.props?.testID || '').startsWith('type-'));
    expect(lignes).toHaveLength(11);
  });

  it('creer : le type choisi dans la feuille part au serveur', async () => {
    const arbre = await monterVille();
    await saisir('Nom de l\'installation', 'Dojo municipal');
    await choisirAdresse(ADRESSE_GEOCODEE);
    await appuyer(parLibelle(arbre, 'Type'));
    await appuyer(parTexte(arbre, 'Dojo'));
    await appuyer(parTexte(arbre, 'Créer'));
    expect(mockSaveCollectivite).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Dojo municipal', type: 'Dojo' }),
      facilityId: null,
    }));
    expect(mockSaveCollectivite.mock.calls[0][0].data).not.toHaveProperty('plateaux');
  });
});

describe('COLL-C2B planche 2 — les plateaux nommes (D66, contrat §8)', () => {
  it('pas d interrupteur pour une installation d une seule equipe a la fois', async () => {
    const arbre = await monterModifier({ ...GYMNASE, maxSlots: 1 });
    expect(interrupteur(arbre)).toBeUndefined();
  });

  it('allumer : un nom par plateau, et les noms partent au serveur', async () => {
    const arbre = await monterModifier(GYMNASE);
    expect(interrupteur(arbre).props.value).toBe(false);
    expect(champ('Plateau 1')).toBeUndefined();

    await basculer(arbre, true);
    expect(champ('Plateau 1').value).toBe('Plateau A');
    expect(champ('Plateau 2').value).toBe('Plateau B');
    expect(champ('Plateau 3')).toBeUndefined();
    await saisir('Plateau 2', 'Côté tribune');
    await appuyer(parTexte(arbre, 'Enregistrer'));

    expect(mockSaveCollectivite).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ maxSlots: 2, plateaux: ['Plateau A', 'Côté tribune'] }),
      facilityId: 'gym-tilleuls',
    }));
  });

  it('une installation qui a des plateaux les montre ; eteindre les efface', async () => {
    const arbre = await monterModifier({ ...GYMNASE, plateaux: ['Nord', 'Sud'] });
    expect(interrupteur(arbre).props.value).toBe(true);
    expect(champ('Plateau 1').value).toBe('Nord');

    await basculer(arbre, false);
    await appuyer(parTexte(arbre, 'Enregistrer'));
    expect(mockSaveCollectivite.mock.calls[0][0].data.plateaux).toEqual([]);
  });

  it('sans plateaux, ne rien toucher n envoie rien', async () => {
    const arbre = await monterModifier(GYMNASE);
    await appuyer(parTexte(arbre, 'Enregistrer'));
    expect(mockSaveCollectivite.mock.calls[0][0].data).not.toHaveProperty('plateaux');
  });

  it('un nom vide ou en double est refuse ici, avant tout appel', async () => {
    const arbre = await monterModifier(GYMNASE);
    await basculer(arbre, true);
    await saisir('Plateau 2', 'Plateau A');
    await appuyer(parTexte(arbre, 'Enregistrer'));
    expect(mockSaveCollectivite).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Deux plateaux portent le même nom.');

    await saisir('Plateau 2', '   ');
    await appuyer(parTexte(arbre, 'Enregistrer'));
    expect(mockSaveCollectivite).not.toHaveBeenCalled();
    expect(textes(arbre)).toContain('Nommez chaque plateau.');
  });
});

describe('COLL-C2B planche 2 — les erreurs, sans fenetre systeme', () => {
  it('sous leur champ, et « n champs a corriger » en haut', async () => {
    const arbre = await monterVille();
    await saisir('Nom de l\'installation', 'Salle');
    await appuyer(parLibelle(arbre, 'Type'));
    await appuyer(parTexte(arbre, 'Dojo'));
    await choisirAdresse({ label: 'rue des Tilleuls' });
    // VILLE-INSTALLATION (07/10) : plus d horaires ; la seconde erreur est un plateau sans nom.
    await appuyer(parTexte(arbre, '+'));
    await basculer(arbre, true);
    await saisir('Plateau 1', '   ');
    await appuyer(parTexte(arbre, 'Créer'));

    expect(mockSaveCollectivite).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockAddressProps[mockAddressProps.length - 1].error)
      .toBe('Sélectionnez une adresse géolocalisée dans la liste.');
    expect(textes(arbre)).toContain('Nommez chaque plateau.');
    expect(textes(arbre)).toContain('2 champs à corriger');
  });

  it('un refus du serveur se lit au-dessus du bouton, pas dans une fenetre', async () => {
    mockSaveCollectivite.mockRejectedValue({
      details: { code: 'FACILITY_PLATEAUX_INVALID' }, message: 'Bad', status: 400,
    });
    const arbre = await monterModifier(GYMNASE);
    await appuyer(parTexte(arbre, 'Enregistrer'));
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(textes(arbre).join(' | ')).toMatch(/Chaque plateau a un nom court et différent/);
  });
});

describe('COLL-C2B planche 2 — le formulaire du CLUB ne change pas', () => {
  it('ses pastilles de type, aucun groupe, aucun plateau', async () => {
    const arbre = await monter({});
    const lus = textes(arbre);
    expect(lus).toContain('Salle vidéo');
    expect(lus).toContain('Club House');
    expect(lus).not.toContain('L’essentiel');
    expect(lus).not.toContain('Choisir le type');
    expect(interrupteur(arbre)).toBeUndefined();
    expect(lus).toContain('Capacité');
    expect(updateFacility).not.toHaveBeenCalled();
    expect(createFacility).not.toHaveBeenCalled();
  });
});
