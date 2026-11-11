import { Linking, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ComplexeDevenirGerant from '@/views/complexe/ComplexeDevenirGerant';

import { pressable, textes } from '@/testSupport/temoinComplexe';

// REGLES-COMPLEXES (10/11/2026, « 225- A », M0855) — « Lire les règles » à côté de la case du
// récapitulatif (E-G01). Le lien ouvre la page publique sans quitter le tunnel : au retour, les
// champs et la case sont gardés.

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
// RESA-INSCRIPTION (19/10) : le rôle du COMPTE ('new' = né « pour un complexe »).
let mockRoleDuCompte = '';
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ accountRoleKey: mockRoleDuCompte, userData: mockCompte }),
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
jest.mock('@/components/organisms/phoneInput/PhoneInput', () => {
  const { Text: Texte } = jest.requireActual('react-native');
  return function FauxTelephone(/** @type {any} */ { label, value }) {
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
  mockRoleDuCompte = '';
  mockCompte = { birthdate: '1990-05-01', documentId: 'u-1', phoneNumber: '+33639981234' };
  mockCreer.mockResolvedValue({ data: { documentId: 'cx-five', name: 'Le Five de Montrivage' } });
});

/**
 * Va jusqu'au récapitulatif (étape 3), règles 16 ans.
 * @returns {Promise<any>} L'arbre.
 */
const jusquAuRecapitulatif = async () => {
  const arbre = await monter();
  await remplirEtape1(arbre);
  await appuyer(arbre, 'suivant Continuer');
  await appuyer(arbre, '16 ans');
  await appuyer(arbre, 'suivant Continuer');
  return arbre;
};

describe('REGLES-COMPLEXES — « Lire les règles » à côté de la case', () => {
  it('le lien est au récapitulatif, juste après la case', async () => {
    const arbre = await jusquAuRecapitulatif();
    const lus = textes(arbre);
    expect(lus).toContain('Étape 3/3');
    const iCase = lus.indexOf('J’accepte les règles d’utilisation des complexes');
    expect(iCase).toBeGreaterThanOrEqual(0);
    expect(lus.indexOf('Lire les règles')).toBe(iCase + 1);
    expect(pressable(arbre, 'Lire les règles').props.accessibilityRole).toBe('link');
  });

  it('il ouvre la page publique des règles, et le tunnel garde tout au retour', async () => {
    const ouvrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const arbre = await jusquAuRecapitulatif();
    await appuyer(arbre, 'J’accepte les règles d’utilisation des complexes');
    await appuyer(arbre, 'Lire les règles');
    expect(ouvrir).toHaveBeenCalledTimes(1);
    // Un seul argument : sur le site, react-native-web l'ouvre alors dans un NOUVEL onglet.
    expect(ouvrir.mock.calls[0]).toHaveLength(1);
    expect(ouvrir.mock.calls[0][0]).toMatch(/^https:\/\/[^/]+\/regles-complexes$/);
    // Rien n'a navigué : on est toujours au récapitulatif, avec ce qui a été rempli.
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(textes(arbre)).toEqual(expect.arrayContaining([
      'Étape 3/3',
      'Le Five de Montrivage',
      'Montrivage · Foot à 5',
      'Réservation à partir de 16 ans',
    ]));
    // La case reste cochée : « Créer mon complexe » part avec les mêmes champs.
    expect(suivantActif(arbre)).toBe(true);
    await appuyer(arbre, 'suivant Créer mon complexe');
    expect(mockCreer).toHaveBeenCalledWith(expect.objectContaining({
      acceptRules: true, minAge: 16, name: 'Le Five de Montrivage', rulesVersion: '2026-11-10',
    }));
    ouvrir.mockRestore();
  });
});
