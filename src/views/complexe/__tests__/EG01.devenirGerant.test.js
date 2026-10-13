import { Linking, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeDevenirGerant from '@/views/complexe/ComplexeDevenirGerant';

import { RouteNames } from '@/navigation/routeNames';

import { pressable, textes } from '@/testSupport/temoinComplexe';

// RESA-L5A1 (13/10/2026) — E-G01 « Devenir gérant » (planche EG01, AT-01, AT-02 B) : le tunnel de
// 3 étapes, la réponse « C'est le tien ? », les refus nommés, la feuille « un compte, deux modes ».

const mockNavigate = jest.fn();
const mockReset = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    canGoBack: () => true, goBack: mockGoBack, navigate: mockNavigate, reset: mockReset,
  }),
}));

let mockCompte = /** @type {any} */ ({
  birthdate: '1990-05-01', documentId: 'u-1', phoneNumber: '+33639981234',
});
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockCompte }),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({
    data: [
      { documentId: 'a-five', name: 'Football à 5' },
      { documentId: 'a-padel', name: 'Padel' },
      { documentId: 'a-tennis', name: 'Tennis' },
      { documentId: 'a-squash', name: 'Squash' },
    ],
  }),
}));

const mockCreer = jest.fn();
jest.mock('@/services/complexe/complexeQueries', () => ({
  useCreerMonComplexe: () => ({ isPending: false, mutateAsync: mockCreer }),
}));

const mockValeurs = new Map();
jest.mock('@/store/appContext', () => ({
  storage: {
    delete: (/** @type {string} */ cle) => mockValeurs.delete(cle),
    getString: (/** @type {string} */ cle) => mockValeurs.get(cle),
    set: (/** @type {string} */ cle, /** @type {string} */ valeur) => mockValeurs.set(cle, valeur),
  },
}));

// Les composants lourds (saisie d'adresse, téléphone, feuille, choix du sport, tunnel) : des
// doublures qui gardent leur contrat (valeur, rappel, titre, bouton suivant).
let mockPoserAdresse = /** @type {any} */ (null);
jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return function FausseAdresse(/** @type {any} */ { address, label, setAddress }) {
    mockPoserAdresse = setAddress;
    return <Texte>{`${label} : ${address?.label || ''}`}</Texte>;
  };
});
let mockPoserTelephone = /** @type {any} */ (null);
jest.mock('@/components/organisms/phoneInput/PhoneInput', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return function FauxTelephone(/** @type {any} */ { label, onChange, value }) {
    mockPoserTelephone = onChange;
    return <Texte>{`${label} : ${value || ''}`}</Texte>;
  };
});
jest.mock('@/components/molecules/input/Input', () => {
  const { TextInput } = jest.requireActual('react-native');
  return function FausseSaisie(/** @type {any} */ { label, onChangeText, value }) {
    return <TextInput accessibilityLabel={label} onChangeText={onChangeText} value={value} />;
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => (
  function FausseFeuille(/** @type {any} */ { children, isVisible }) {
    return isVisible ? children : null;
  }
));
jest.mock('@/components/organisms/choixDuSport/ChoixDuSport', () => {
  const { Text: Texte, TouchableOpacity: Touche } = jest.requireActual('react-native');
  const reel = jest.requireActual('@/components/organisms/choixDuSport/ChoixDuSport');
  return {
    ...reel,
    __esModule: true,
    default: function FauxChoix(/** @type {any} */ { onChoisir, sports }) {
      return sports.map((/** @type {any} */ sport) => (
        <Touche
          accessibilityLabel={`choisir ${sport.name}`}
          key={sport.documentId}
          onPress={() => onChoisir(sport.documentId)}
        >
          <Texte>{sport.name}</Texte>
        </Touche>
      ));
    },
  };
});
jest.mock('@/components/molecules/wizardStepLayout/WizardStepLayout', () => {
  const { Text: Texte, TouchableOpacity: Touche, View: Vue } = jest.requireActual('react-native');
  return function FauxTunnel(/** @type {any} */ {
    children, isNextDisabled, nextLabel, onBack, onNext, stepCount, stepIndex, title,
  }) {
    return (
      <Vue>
        <Texte>{`Étape ${stepIndex}/${stepCount}`}</Texte>
        <Texte>{title}</Texte>
        {children}
        <Touche
          accessibilityLabel={`suivant ${nextLabel}`}
          accessibilityState={{ disabled: isNextDisabled }}
          onPress={isNextDisabled ? undefined : onNext}
          testID="tunnel-suivant"
        >
          <Texte>{nextLabel}</Texte>
        </Touche>
        <Touche accessibilityLabel="retour du tunnel" onPress={onBack} />
      </Vue>
    );
  };
});

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/theme/themeContext', () => (
  jest.requireActual('@/testSupport/temoinComplexe').themeDeTemoin()
));

const ADRESSE = {
  city: 'Montrivage', label: '12 allée des Sports, Montrivage', lat: 48.83, lng: 1.48,
};

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ComplexeDevenirGerant />);
  });
  return arbre;
};

/**
 * Appuie sur un élément par son libellé.
 * @param {any} arbre - L'arbre.
 * @param {string} libelle - Le libellé.
 * @returns {Promise<void>} Fini.
 */
const appuyer = async (arbre, libelle) => {
  await act(async () => {
    pressable(arbre, libelle).props.onPress();
  });
};

/**
 * Le bouton « suivant » du tunnel est-il actif ?
 * @param {any} arbre - L'arbre.
 * @returns {boolean} Vrai s'il est actif.
 */
const suivantActif = (arbre) => typeof arbre.root.findAll((n) => n.type === TouchableOpacity
  && n.props?.testID === 'tunnel-suivant')[0].props.onPress === 'function';

/**
 * Remplit l'étape 1 (nom, adresse, Foot à 5).
 * @param {any} arbre - L'arbre.
 * @returns {Promise<void>} Fini.
 */
const remplirEtape1 = async (arbre) => {
  const [nom] = arbre.root.findAll((n) => n.props?.accessibilityLabel === 'Nom'
    && n.props?.onChangeText);
  await act(async () => {
    nom.props.onChangeText('Le Five de Montrivage');
    mockPoserAdresse(ADRESSE);
  });
  await appuyer(arbre, 'Foot à 5');
};

beforeEach(() => {
  jest.clearAllMocks();
  mockValeurs.clear();
  mockCompte = { birthdate: '1990-05-01', documentId: 'u-1', phoneNumber: '+33639981234' };
  mockCreer.mockResolvedValue({ data: { documentId: 'cx-five', name: 'Le Five de Montrivage' } });
});

describe('RESA-L5A1 E-G01 — étape 1 « Ton complexe »', () => {
  it('les champs de la planche, le téléphone d’un adulte, « Continuer » éteint', async () => {
    const arbre = await monter();
    // Les puces écrivent leurs mots avec des espaces insécables (ChoiceChipGroup, texteInsecable).
    const lus = textes(arbre).map((texte) => texte.split(String.fromCharCode(160)).join(' '));
    expect(lus).toEqual(expect.arrayContaining([
      'Étape 1/3',
      'Ton complexe',
      'Téléphone montré aux joueurs : +33639981234',
      'Foot à 5',
      'Padel',
      'Tennis',
      'Il servira à la pastille Vérifié.',
    ]));
    expect(suivantActif(arbre)).toBe(false);
    await remplirEtape1(arbre);
    expect(suivantActif(arbre)).toBe(true);
  });

  it('le numéro d’un compte MINEUR n’est jamais proposé (téléphone public)', async () => {
    const quinzeAns = new Date();
    quinzeAns.setFullYear(quinzeAns.getFullYear() - 15);
    mockCompte = { ...mockCompte, birthdate: quinzeAns.toISOString().slice(0, 10) };
    const arbre = await monter();
    expect(textes(arbre)).toContain('Téléphone montré aux joueurs : ');
    expect(suivantActif(arbre)).toBe(false);
    await remplirEtape1(arbre);
    expect(suivantActif(arbre)).toBe(false);
    await act(async () => {
      mockPoserTelephone('+33612345678');
    });
    expect(suivantActif(arbre)).toBe(true);
  });

  it('« + de sports » : tous les sports de l’app ; le choisi rejoint les puces', async () => {
    const arbre = await monter();
    await appuyer(arbre, '+ de sports');
    await appuyer(arbre, 'choisir Squash');
    await appuyer(arbre, 'Fermer');
    expect(textes(arbre)).toContain('Squash');
  });
});

describe('RESA-L5A1 E-G01 — étapes 2 et 3, puis « Créer mon complexe »', () => {
  it('règles par défaut (18 ans, 24 h), récapitulatif, case obligatoire, envoi', async () => {
    const arbre = await monter();
    await remplirEtape1(arbre);
    await appuyer(arbre, 'suivant Continuer');
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Étape 2/3',
      'Tes règles',
      'Âge minimum pour réserver',
      'De 13 à 18 ans. Proposé : 18 ans.',
      'Délai d’annulation',
      'Annulation gratuite jusqu’à 24 h avant le créneau.',
      'Tu pourras tout changer dans Réglages.',
    ]));
    await appuyer(arbre, '16 ans');
    await appuyer(arbre, 'suivant Continuer');
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Étape 3/3',
      'Récapitulatif',
      'Le Five de Montrivage',
      'Montrivage · Foot à 5',
      'Complexe de réservation',
      'Réservation à partir de 16 ans',
      'Annulation gratuite jusqu’à 24 h avant',
      // eslint-disable-next-line max-len
      'Ton complexe est visible dès maintenant. FoundClub peut le suspendre s’il ne respecte pas les règles d’utilisation.',
    ]));
    expect(suivantActif(arbre)).toBe(false);
    await appuyer(arbre, 'J’accepte les règles d’utilisation des complexes');
    expect(suivantActif(arbre)).toBe(true);
    await appuyer(arbre, 'suivant Créer mon complexe');
    expect(mockCreer).toHaveBeenCalledWith({
      acceptRules: true,
      address: { label: ADRESSE.label, lat: ADRESSE.lat, lng: ADRESSE.lng },
      addressLabel: ADRESSE.label,
      cancellationDelayHours: 24,
      city: 'Montrivage',
      coordinates: { lat: ADRESSE.lat, lng: ADRESSE.lng },
      minAge: 16,
      name: 'Le Five de Montrivage',
      phoneNumber: '+33639981234',
      sports: ['a-five'],
    });
    // État 5 : un compte, deux modes.
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Le Five de Montrivage est créé',
      'Ton compte a maintenant deux modes.',
      'Tu gardes tes équipes, tes réservations et tes messages de joueur.',
    ]));
    await appuyer(arbre, 'Ouvrir l’espace du complexe');
    expect(mockValeurs.get('user.complexe_mode.u-1')).toBe('on');
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{
        name: RouteNames.ComplexeEspace,
        params: { complexeId: 'cx-five', justeCree: true },
      }],
    });
  });

  it('« Rester en mode joueur » : retour, sans mode complexe', async () => {
    const arbre = await monter();
    await remplirEtape1(arbre);
    await appuyer(arbre, 'suivant Continuer');
    await appuyer(arbre, 'suivant Continuer');
    await appuyer(arbre, 'J’accepte les règles d’utilisation des complexes');
    await appuyer(arbre, 'suivant Créer mon complexe');
    await appuyer(arbre, 'Rester en mode joueur');
    expect(mockValeurs.size).toBe(0);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});

describe('RESA-L5A1 E-G01 — « C’est le tien ? » et les refus', () => {
  /**
   * Va jusqu'à « Créer mon complexe » et appuie.
   * @returns {Promise<any>} L'arbre.
   */
  const jusquALEnvoi = async () => {
    const arbre = await monter();
    await remplirEtape1(arbre);
    await appuyer(arbre, 'suivant Continuer');
    await appuyer(arbre, 'suivant Continuer');
    await appuyer(arbre, 'J’accepte les règles d’utilisation des complexes');
    await appuyer(arbre, 'suivant Créer mon complexe');
    return arbre;
  };

  it('un doublon possible : la question, puis « Non, continuer » avec forceCreate', async () => {
    mockCreer.mockResolvedValueOnce({
      data: {
        duplicate: true,
        suggestions: [{
          city: 'Montrivage', distanceMeters: 300, name: 'Five Montrivage', slug: 'five-montrivage',
        }],
      },
    });
    const arbre = await jusquALEnvoi();
    expect(textes(arbre))
      .toContain('Un complexe « Five Montrivage » existe déjà à 300 m. C’est le tien ?');
    await appuyer(arbre, 'Non, continuer');
    expect(mockCreer).toHaveBeenCalledTimes(2);
    expect(mockCreer.mock.calls[1][0]).toEqual(expect.objectContaining({ forceCreate: true }));
    expect(textes(arbre)).toContain('Le Five de Montrivage est créé');
  });

  it('« Oui, c’est le mien » : écrire à FoundClub, rien n’est créé', async () => {
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    mockCreer.mockResolvedValueOnce({
      data: { duplicate: true, suggestions: [{ distanceMeters: 300, name: 'Five Montrivage' }] },
    });
    const arbre = await jusquALEnvoi();
    await appuyer(arbre, 'Oui, c’est le mien');
    expect(ouvrir).toHaveBeenCalledTimes(1);
    expect(mockCreer).toHaveBeenCalledTimes(1);
    ouvrir.mockRestore();
  });

  it('un refus nommé reste sous le bouton, les champs restent remplis', async () => {
    mockCreer.mockRejectedValueOnce({ details: { code: 'COMPLEXE_ALREADY_MANAGED' }, status: 409 });
    const arbre = await jusquALEnvoi();
    expect(textes(arbre))
      .toEqual(expect.arrayContaining(['Tu gères déjà un complexe.', 'Le Five de Montrivage']));
  });

  it('hors connexion : « Pas de connexion : tes informations sont gardées. »', async () => {
    mockCreer.mockRejectedValueOnce(new Error('Network Error'));
    const arbre = await jusquALEnvoi();
    expect(textes(arbre)).toContain('Pas de connexion : tes informations sont gardées.');
    expect(arbre.root.findAllByType(Text).length).toBeGreaterThan(0);
  });
});
