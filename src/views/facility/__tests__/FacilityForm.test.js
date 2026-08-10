import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { createFacility, updateFacility } from '@/services/facility/facilityService';

import { FACILITY_PLANNING_PALETTE } from '@/utils/facilityPlanningColor';

import FacilityForm from '../FacilityForm';

// D2 (E6) : FacilityForm.js fait 823 lignes et n'avait AUCUN test, alors qu'il
// porte trois choses qu'une refonte de mise en page ne doit jamais deplacer :
// un schema Joi, l'ouverture du paywall, et la normalisation d'adresse en
// GeoJSON. Ce fichier fige ce comportement AVANT la refonte D2 (design Tour 7c
// « page resserree ») et doit passer, INCHANGE, avant et apres.
//
// Il ne decrit volontairement AUCUN pixel : il n'observe que ce qui part sur le
// reseau (`createFacility` / `updateFacility`), ce que recoit la feuille de
// paywall, et ce que l'ecran refuse d'envoyer. Une mise en page peut donc etre
// refaite de fond en comble sans qu'une seule ligne d'ici ne bouge.
//
// Seuil de tolerance assume : les gestes sont pilotes par le TEXTE VISIBLE
// (« Creer », « - », « Demande en attente »...), parce que c'est le seul point
// d'appui qui survit au passage de cartes empilees a un controle segmente.

/** @type {any[]} */
const mockButtonProps = [];
/** @type {any[]} */
const mockInputProps = [];
/** @type {any[]} */
const mockAddressProps = [];
/** @type {any[]} */
const mockPaywallProps = [];
/** @type {any[]} */
const mockSegmentedProps = [];

/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;
/** @type {any} */
let mockFacilityQuery;
/** @type {any} */
let mockUserData;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => mockRoute,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall, 2026-08-02), et un objet
// invente masquerait un jeton absent. `Images` est le seul element stub, pour
// ne pas faire dependre ce test de la resolution des fichiers d'assets.
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
  useGetFacility: () => mockFacilityQuery,
}));

jest.mock('@/services/facility/facilityService', () => ({
  createFacility: jest.fn(),
  updateFacility: jest.fn(),
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

// Le bouton est rendu comme un vrai element pressable portant son libelle :
// c'est ce qui permet aux tests d'appuyer « sur le texte », que le libelle soit
// porte par un Button (avant) ou par un TouchableOpacity (apres).
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    mockButtonProps.push(props);
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
  () => function SubscriptionPaywallSheetMock(/** @type {any} */ props) {
    mockPaywallProps.push(props);
    return null;
  },
);

// Doublure fidele du controle segmente partage : meme contrat (options / value /
// onChange), meme forme rendue (un pressable portant le libelle). Elle existe
// pour que la refonte D2 puisse l'adopter sans que ce fichier change.
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => {
  const reactActuel = jest.requireActual('react');
  const {
    Text: TexteRN,
    TouchableOpacity: PressableRN,
    View: VueRN,
  } = jest.requireActual('react-native');

  return function SegmentedControlMock(/** @type {any} */ props) {
    const { onChange, options, value } = props;
    mockSegmentedProps.push(props);
    return reactActuel.createElement(
      VueRN,
      null,
      (options || []).map((/** @type {any} */ option) => reactActuel.createElement(
        PressableRN,
        {
          accessibilityState: { selected: option.value === value },
          key: option.value,
          onPress: () => onChange(option.value),
        },
        reactActuel.createElement(TexteRN, null, option.label),
      )),
    );
  };
});

// Adresse telle que la rend reellement l'autocomplete BAN : les coordonnees
// vivent dans `value`, sous la forme « lng|lat ».
const ADRESSE_GEOCODEE = {
  label: '3 Boulevard Michelet 13008 Marseille',
  value: '5.395|43.269',
};

// Meme forme, mais sans coordonnees : c'est le cas que l'ecran doit refuser.
const ADRESSE_SANS_GPS = {
  label: 'Quelque part',
  value: '',
};

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
 * Texte visible sous un noeud de l'arbre rendu.
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children))
  .join(' ');

/**
 * Appuie sur l'element pressable qui porte ce libelle.
 * Priorite au texte EXACT (« - » ne doit pas attraper une phrase qui contient
 * un tiret) ; a defaut, le pressable le plus profond qui le contient.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, libelle) => {
  const candidats = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));

  if (candidats.length === 0) {
    throw new Error(`Aucun element pressable ne porte le libelle « ${libelle} »`);
  }

  const cible = candidats.find((/** @type {any} */ noeud) => texteDe(noeud).trim() === libelle)
    || candidats[candidats.length - 1];

  await act(async () => {
    cible.props.onPress();
  });
};

/**
 * Dernieres props recues par une doublure.
 * @param {any[]} journal
 * @returns {any}
 */
const dernieresProps = (journal) => journal[journal.length - 1];

/**
 * Monte l'ecran.
 * @param {{ facility?: any, params?: any }} [options]
 * @returns {Promise<any>}
 */
const monterEcran = async (options = {}) => {
  mockRoute = { params: options.params || {} };
  mockFacilityQuery = {
    data: options.facility || null,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  };

  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<FacilityForm />);
  });
  return arbre;
};

/**
 * Saisit le nom de l'installation.
 * @param {string} valeur
 * @returns {Promise<void>}
 */
const saisirNom = async (valeur) => {
  const champ = dernieresProps(mockInputProps);
  await act(async () => {
    champ.onChangeText(valeur);
  });
};

/**
 * Choisit une adresse dans l'autocomplete.
 * @param {any} adresse
 * @returns {Promise<void>}
 */
const choisirAdresse = async (adresse) => {
  const champ = dernieresProps(mockAddressProps);
  await act(async () => {
    champ.setAddress(adresse);
  });
};

/**
 * Remplit le minimum valide : un nom et une adresse geocodee.
 * @returns {Promise<void>}
 */
const remplirLeMinimumValide = async () => {
  await saisirNom('Terrain Honneur');
  await choisirAdresse(ADRESSE_GEOCODEE);
};

beforeEach(() => {
  jest.clearAllMocks();
  mockButtonProps.length = 0;
  mockInputProps.length = 0;
  mockAddressProps.length = 0;
  mockPaywallProps.length = 0;
  mockSegmentedProps.length = 0;

  mockNavigation = { goBack: jest.fn(), navigate: jest.fn() };
  mockUserData = { club: { documentId: 'club-1' } };

  /** @type {any} */ (createFacility).mockResolvedValue({ data: { documentId: 'fac-9' } });
  /** @type {any} */ (updateFacility).mockResolvedValue({ data: { documentId: 'fac-9' } });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

describe('FacilityForm — ce que le formulaire accepte et refuse (Joi)', () => {
  it('sans nom : rien ne part sur le reseau, et aucune alerte n est levee', async () => {
    const arbre = await monterEcran();
    await choisirAdresse(ADRESSE_GEOCODEE);

    await appuyerSur(arbre, 'Créer');

    // Joi bloque en amont de handleSave : ni requete, ni alerte.
    expect(createFacility).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('nom + adresse geocodee : la creation part avec la charge attendue', async () => {
    const arbre = await monterEcran();
    await remplirLeMinimumValide();

    await appuyerSur(arbre, 'Créer');

    expect(createFacility).toHaveBeenCalledTimes(1);
    expect(createFacility).toHaveBeenCalledWith({
      address: {
        description: '3 Boulevard Michelet 13008 Marseille',
        geometry: {
          coordinates: [5.395, 43.269],
          type: 'Point',
        },
      },
      allowOverflowRequests: true,
      capacityConflictMode: 'pending_validation',
      club: 'club-1',
      maxSlots: 1,
      name: 'Terrain Honneur',
      planningColor: FACILITY_PLANNING_PALETTE[0],
      type: 'Terrain',
    });
    expect(mockNavigation.goBack).toHaveBeenCalledTimes(1);
  });

  it('adresse choisie mais sans coordonnees : refus explicite, aucune requete', async () => {
    const arbre = await monterEcran();
    await saisirNom('Terrain Honneur');
    await choisirAdresse(ADRESSE_SANS_GPS);

    await appuyerSur(arbre, 'Créer');

    expect(createFacility).not.toHaveBeenCalled();
    // Le champ peut etre hors ecran au moment de l'envoi : sans alerte, le
    // bouton semble ne rien faire. Ce doublon message + alerte est voulu.
    expect(Alert.alert).toHaveBeenCalledWith(
      'Erreur',
      'Sélectionne une adresse géolocalisée dans la liste.',
    );
    expect(dernieresProps(mockAddressProps).error)
      .toBe('Sélectionne une adresse géolocalisée dans la liste.');
  });

  it('en modification : la mise a jour part sur le documentId de l installation', async () => {
    const arbre = await monterEcran({
      facility: {
        address: ADRESSE_GEOCODEE,
        capacityConflictMode: 'allow_and_notify',
        documentId: 'fac-42',
        maxSlots: 3,
        name: 'Gymnase Nord',
        planningColor: FACILITY_PLANNING_PALETTE[2],
        type: 'Gymnase',
      },
      params: { facilityId: 'fac-42' },
    });

    await appuyerSur(arbre, 'Enregistrer');

    expect(updateFacility).toHaveBeenCalledTimes(1);
    const [documentId, charge] = /** @type {any} */ (updateFacility).mock.calls[0];
    expect(documentId).toBe('fac-42');
    expect(charge.name).toBe('Gymnase Nord');
    expect(charge.maxSlots).toBe(3);
    expect(charge.type).toBe('Gymnase');
    expect(charge.capacityConflictMode).toBe('allow_and_notify');
    expect(createFacility).not.toHaveBeenCalled();
  });
});

describe('FacilityForm — bornes de capacite', () => {
  it('borne basse : 12 appuis sur « - » ne descendent pas sous 1', async () => {
    const arbre = await monterEcran();
    await remplirLeMinimumValide();

    for (let i = 0; i < 12; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await appuyerSur(arbre, '-');
    }
    await appuyerSur(arbre, 'Créer');

    expect(/** @type {any} */ (createFacility).mock.calls[0][0].maxSlots).toBe(1);
  });

  it('borne haute : 15 appuis sur « + » ne montent pas au-dessus de 10', async () => {
    const arbre = await monterEcran();
    await remplirLeMinimumValide();

    for (let i = 0; i < 15; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await appuyerSur(arbre, '+');
    }
    await appuyerSur(arbre, 'Créer');

    expect(/** @type {any} */ (createFacility).mock.calls[0][0].maxSlots).toBe(10);
  });

  it('entre les bornes : 4 appuis sur « + » envoient bien 5', async () => {
    const arbre = await monterEcran();
    await remplirLeMinimumValide();

    for (let i = 0; i < 4; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await appuyerSur(arbre, '+');
    }
    await appuyerSur(arbre, 'Créer');

    expect(/** @type {any} */ (createFacility).mock.calls[0][0].maxSlots).toBe(5);
  });
});

describe('FacilityForm — valeurs envoyees par les 2 modes de conflit', () => {
  // Les deux chaines sont recopiees a la main VOLONTAIREMENT : c'est le contrat
  // avec le serveur. Passer par FACILITY_CONFLICT_MODES rendrait le test aveugle
  // a un changement de la constante elle-meme.
  it('par defaut, le mode envoye est « pending_validation »', async () => {
    const arbre = await monterEcran();
    await remplirLeMinimumValide();

    await appuyerSur(arbre, 'Créer');

    expect(/** @type {any} */ (createFacility).mock.calls[0][0].capacityConflictMode)
      .toBe('pending_validation');
  });

  it('apres avoir choisi « notifier », le mode envoye est « allow_and_notify »', async () => {
    const arbre = await monterEcran();
    await remplirLeMinimumValide();

    // Sous-chaine et non libelle entier : le libelle de cette option change de
    // forme avec la refonte, sa VALEUR ne change pas.
    await appuyerSur(arbre, 'notifier');
    await appuyerSur(arbre, 'Créer');

    expect(/** @type {any} */ (createFacility).mock.calls[0][0].capacityConflictMode)
      .toBe('allow_and_notify');
  });

  it('retour sur « Demande à valider » : la valeur repasse a « pending_validation »', async () => {
    const arbre = await monterEcran();
    await remplirLeMinimumValide();

    await appuyerSur(arbre, 'notifier');
    await appuyerSur(arbre, 'Demande à valider');
    await appuyerSur(arbre, 'Créer');

    expect(/** @type {any} */ (createFacility).mock.calls[0][0].capacityConflictMode)
      .toBe('pending_validation');
  });
});

describe('FacilityForm — conditions d ouverture du paywall', () => {
  const REFUS_ABONNEMENT = {
    details: {
      decision: {
        allowed: false,
        paywall: 'FACILITY_MANAGE_REQUIRED',
        reason: 'SUBSCRIPTION_REQUIRED',
        requiredPlan: ['CLUB'],
      },
    },
  };

  it('la feuille est fermee tant que rien n a ete refuse', async () => {
    await monterEcran();

    expect(dernieresProps(mockPaywallProps).isVisible).toBe(false);
    expect(dernieresProps(mockPaywallProps).decision).toBeNull();
  });

  it('refus d abonnement : la feuille s ouvre avec la decision, sans alerte', async () => {
    /** @type {any} */ (createFacility).mockRejectedValue(REFUS_ABONNEMENT);
    const arbre = await monterEcran();
    await remplirLeMinimumValide();

    await appuyerSur(arbre, 'Créer');

    expect(dernieresProps(mockPaywallProps).isVisible).toBe(true);
    expect(dernieresProps(mockPaywallProps).decision)
      .toEqual(REFUS_ABONNEMENT.details.decision);
    expect(dernieresProps(mockPaywallProps).clubDocumentId).toBe('club-1');
    // Une decision de paywall n'est PAS une erreur technique : pas d'alerte.
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(mockNavigation.goBack).not.toHaveBeenCalled();
  });

  it('erreur ordinaire : la feuille reste fermee et l alerte prend le relais', async () => {
    /** @type {any} */ (createFacility).mockRejectedValue(new Error('Panne reseau'));
    const arbre = await monterEcran();
    await remplirLeMinimumValide();

    await appuyerSur(arbre, 'Créer');

    expect(dernieresProps(mockPaywallProps).isVisible).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Erreur', 'Panne reseau');
  });

  it('refus d abonnement en modification : meme ouverture', async () => {
    /** @type {any} */ (updateFacility).mockRejectedValue(REFUS_ABONNEMENT);
    const arbre = await monterEcran({
      facility: {
        address: ADRESSE_GEOCODEE,
        documentId: 'fac-42',
        maxSlots: 1,
        name: 'Gymnase Nord',
        planningColor: FACILITY_PLANNING_PALETTE[0],
        type: 'Gymnase',
      },
      params: { facilityId: 'fac-42' },
    });

    await appuyerSur(arbre, 'Enregistrer');

    expect(dernieresProps(mockPaywallProps).isVisible).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});

describe('FacilityForm — garde-fous de contexte', () => {
  it('sans club ni multisport, l ecran ne propose pas le formulaire', async () => {
    mockUserData = { club: null };
    const arbre = await monterEcran();

    expect(mockInputProps).toHaveLength(0);
    expect(texteDe(arbre.root)).toContain('Contexte club introuvable');
    expect(createFacility).not.toHaveBeenCalled();
  });

  it('le club du contexte de route prend le pas sur celui du profil', async () => {
    const arbre = await monterEcran({ params: { clubId: 'club-de-la-route' } });
    await remplirLeMinimumValide();

    await appuyerSur(arbre, 'Créer');

    expect(/** @type {any} */ (createFacility).mock.calls[0][0].club).toBe('club-de-la-route');
  });
});

// ---------------------------------------------------------------------------
// AJOUT D2 : tout ce qui precede figeait l'ancien comportement et passe des DEUX
// cotes de la refonte. Ce qui suit decrit ce que la refonte APPORTE — ces tests
// ne peuvent pas passer sur l'ancienne mise en page, c'est leur raison d'etre.
// ---------------------------------------------------------------------------

describe('FacilityForm — refonte D2 « page resserree »', () => {
  const DESCRIPTION_ATTENTE = 'Le créneau passe en demande, '
    + 'un dirigeant valide avant confirmation.';
  const DESCRIPTION_NOTIFIER = 'Le créneau reste confirmé, les dirigeants sont notifiés.';

  it('la description suit le mode choisi, la valeur envoyee reste celle du serveur', async () => {
    const arbre = await monterEcran();
    await remplirLeMinimumValide();

    // Une seule description a l'ecran, celle du mode actif : c'est ce qui
    // remplace les deux paragraphes empiles de l'ancienne version.
    expect(texteDe(arbre.root)).toContain(DESCRIPTION_ATTENTE);
    expect(texteDe(arbre.root)).not.toContain(DESCRIPTION_NOTIFIER);

    await appuyerSur(arbre, 'notifier');

    expect(texteDe(arbre.root)).toContain(DESCRIPTION_NOTIFIER);
    expect(texteDe(arbre.root)).not.toContain(DESCRIPTION_ATTENTE);

    await appuyerSur(arbre, 'Créer');

    // La presentation a change, le contrat serveur non.
    expect(/** @type {any} */ (createFacility).mock.calls[0][0].capacityConflictMode)
      .toBe('allow_and_notify');
  });

  it('« GPS activé » n apparait que lorsque l adresse porte des coordonnees', async () => {
    const arbre = await monterEcran();
    expect(texteDe(arbre.root)).not.toContain('GPS activé');

    await choisirAdresse(ADRESSE_SANS_GPS);
    expect(texteDe(arbre.root)).not.toContain('GPS activé');

    await choisirAdresse(ADRESSE_GEOCODEE);
    expect(texteDe(arbre.root)).toContain('GPS activé');
  });

  it('les 3 astuces en paragraphe ont disparu de l ecran', async () => {
    const arbre = await monterEcran();
    const texte = texteDe(arbre.root);

    expect(texte).not.toContain('Entre un nom clair');
    expect(texte).not.toContain('Sélectionne une adresse dans la liste pour activer le GPS');
    expect(texte).not.toContain('Cette couleur apparaîtra dans le planning');
  });

  it('« Couleur dans le planning » n est plus ecrit deux fois', async () => {
    const arbre = await monterEcran();
    const occurrences = texteDe(arbre.root).split('Couleur dans le planning').length - 1;

    expect(occurrences).toBe(1);
  });

  // D2 avait fige l'apercu par `it('l apercu garde ses 3 puces')`, parce qu'a
  // l'epoque il portait de l'information que le formulaire n'affichait pas.
  // D51 supprime l'apercu : chaque reglage annonce desormais son propre etat,
  // et repeter le tout en bas de page ne faisait qu'allonger l'ecran. Le test
  // n'est pas retire, il est RETOURNE — il garde la meme surface d'observation.
  it('l apercu redondant a disparu, les reglages parlent d eux-memes', async () => {
    const arbre = await monterEcran();
    const texte = texteDe(arbre.root);

    // Cette chaine n'existait QUE dans l'apercu : le pas-a-pas de capacite
    // affiche le nombre seul, et son unite toujours au pluriel.
    expect(texte).not.toContain('1 équipe simultanée');

    expect(texte).toContain('Capacité');
    expect(texte).toContain('Demande à valider');
  });

  it('la palette entiere reste proposee, ni couleur perdue ni couleur inventee', async () => {
    const arbre = await monterEcran();
    // On compte les COULEURS, pas les noeuds : un TouchableOpacity en expose
    // deux (le composite et son hote), ce qui doublerait un comptage naif.
    const couleursProposees = new Set(
      arbre.root
        .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
        .map((/** @type {any} */ noeud) => noeud.props?.style?.[1]?.backgroundColor)
        .filter((/** @type {any} */ couleur) => FACILITY_PLANNING_PALETTE.includes(couleur)),
    );

    expect([...couleursProposees].sort()).toEqual([...FACILITY_PLANNING_PALETTE].sort());
  });
});

describe('FacilityForm — refonte D51 ecran 04', () => {
  it('le type annonce qu il est requis', async () => {
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Type — requis');
  });

  it('le libelle du mode par defaut est complet, jamais abrege', async () => {
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('Demande à valider');
    expect(texteDe(arbre.root)).not.toContain('Demande en attente');
  });

  it('la couleur dit a quoi elle sert', async () => {
    const arbre = await monterEcran();

    expect(texteDe(arbre.root)).toContain('repérer l\'installation dans le planning');
  });

  // Le vrai garde-fou contre le saut de mise en page : les DEUX modes portent
  // une explication non vide. Une hauteur reservee ne sert a rien si l'un des
  // deux etats laisse la place vide — c'est la bascule plein/vide qui fait
  // sauter le formulaire, pas la difference de longueur entre deux phrases.
  it('les deux modes affichent une explication : jamais de case vide', async () => {
    const arbre = await monterEcran();
    const texteAttente = texteDe(arbre.root);

    expect(texteAttente).toContain('Le créneau passe en demande');

    await appuyerSur(arbre, 'notifier');

    expect(texteDe(arbre.root)).toContain('Le créneau reste confirmé');
  });
});

// D63 : Adel a compare l'ecran a la maquette sur l'emulateur le 2026-08-10.
// Les portes de D51 etaient toutes vertes, et pourtant l'ecran ne ressemblait
// pas au dessin. Ce bloc mesure la FORME, pas le comportement.
describe('FacilityForm — D63 : l ecart entre la maquette et l ecran', () => {
  it('les deux libelles de conflit sont demandes ENTIERS au controle segmente', async () => {
    // Le texte, lui, a toujours ete complet dans l'arbre — c'est `numberOfLines`
    // qui coupait a l'ecran. Le seul temoin honnete est donc la consigne passee
    // au composant partage, pas le texte rendu.
    await monterEcran();

    const controle = dernieresProps(mockSegmentedProps);

    expect(controle.fullLabels).toBe(true);
    expect(controle.options.map((/** @type {any} */ option) => option.label)).toEqual([
      'Demande à valider',
      'Autoriser et notifier',
    ]);
  });

});
