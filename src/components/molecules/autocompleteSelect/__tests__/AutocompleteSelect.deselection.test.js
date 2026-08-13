import { InteractionManager } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AutocompleteSelect from '../AutocompleteSelect';

// R03 (E6) — LE CONTRAT DE `setValue`, QUE PERSONNE N'AVAIT ECRIT.
//
// Motif : le 2026-08-13, Adel retire le niveau de son equipe dans « modifier
// mon equipe » et l'app se ferme sur `Cannot read property 'value' of
// undefined`. `AutocompleteSelect` sert 32 ecrans et n'avait AUCUN test : rien
// ne disait ce qu'il rend a son appelant quand on DESELECTIONNE.
//
// Ce fichier CARACTERISE le composant partage, il ne le modifie pas. Il fige la
// seule chose qui compte pour le crash : en mono-selection, retirer le choix
// courant fait remonter `undefined` — c'est-a-dire « aucune valeur », pas une
// chaine vide. Tout appelant qui lit `option.value` sans garde meurt ici.
//
// ⚠️ CE QU'IL NE PROUVE PAS : la feuille native est doublee (BottomModal a son
// propre filet). On observe ce qui SORT du composant, pas ce qu'il dessine.

const OPTIONS = [
  { label: 'Departemental', value: 'niveau-1' },
  { label: 'Regional', value: 'niveau-2' },
];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      return cle;
    },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const feuilleDeStyle = {};
  const rampe = () => new Proxy({}, { get: () => feuilleDeStyle });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => feuilleDeStyle }),
      Colors: new Proxy({}, { get: (_cible, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

// La feuille native est doublee par une vue qui rend entete, contenu et pied
// UNIQUEMENT quand elle est ouverte : c'est ce qui rend le bouton de validation
// pressable, et c'est lui qui declenche `setValue`.
jest.mock('../../bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return function BottomModalMock(/** @type {any} */ props) {
    if (!props.isVisible) return null;
    return reactActuel.createElement(
      VueRN,
      { testID: 'feuille' },
      props.headerComponent,
      props.children,
      props.footerComponent,
    );
  };
});

// Chaque option devient un vrai pressable portant son libelle : c'est le seul
// moyen d'appuyer DEUX fois sur « Regional » — une fois pour choisir, une fois
// pour retirer — sans dependre de la mise en page.
jest.mock('@/components/atoms/checkable/Checkable', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function CheckableMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      {
        accessibilityState: { checked: props.isChecked },
        onPress: props.setIsChecked,
        testID: `option-${props.text}`,
      },
      reactActuel.createElement(TexteRN, null, props.text),
    );
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    );
  };
});

jest.mock('../../input/Input', () => function InputMock() {
  return null;
});

/**
 * Monte le selecteur, ouvre sa feuille, et rend de quoi agir dessus.
 * @param {any} props Surcharges passees au composant.
 * @returns {{ arbre: any, setValue: jest.Mock }} L'arbre monte et l'espion.
 */
const monterEtOuvrir = (props = {}) => {
  const setValue = jest.fn();
  let arbre;

  act(() => {
    arbre = renderer.create(
      <AutocompleteSelect
        isSearchable
        label="Niveau"
        options={OPTIONS}
        placeholder="Choisir un niveau"
        setValue={setValue}
        value=""
        {...props}
      />,
    );
  });

  // Ouvrir la feuille : le pressable ferme, puis les 80 ms d'attente du champ
  // de recherche (le composant les pose pour laisser le clavier se ranger).
  const pressableFerme = arbre.root.findAll(
    (noeud) => noeud.props.accessibilityRole === 'button' && typeof noeud.props.onPress === 'function',
  )[0];

  act(() => {
    pressableFerme.props.onPress();
  });
  act(() => {
    jest.advanceTimersByTime(200);
  });

  return { arbre, setValue };
};

/**
 * @param {any} arbre L'arbre monte.
 * @param {string} testID L'identifiant du pressable a actionner.
 * @returns {void}
 */
const appuyerSur = (arbre, testID) => {
  const cible = arbre.root.findAll((noeud) => noeud.props.testID === testID)[0];
  act(() => {
    cible.props.onPress();
  });
};

describe('R03 · AutocompleteSelect — ce qu il rend quand on DESELECTIONNE', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      .mockImplementation((/** @type {any} */ tache) => {
        if (typeof tache === 'function') tache();
        return /** @type {any} */ ({ cancel: () => {} });
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('temoin 1 — retirer le choix courant fait remonter `undefined`, pas une chaine vide', () => {
    const { arbre, setValue } = monterEtOuvrir({ value: 'niveau-2' });

    // L'option deja choisie est bien cochee a l'ouverture.
    const optionChoisie = arbre.root.findAll((noeud) => noeud.props.testID === 'option-Regional')[0];
    expect(optionChoisie.props.accessibilityState.checked).toBe(true);

    // On la retire, puis on valide : c'est le geste exact d'Adel.
    appuyerSur(arbre, 'option-Regional');
    appuyerSur(arbre, 'bouton-modals.actions.select');

    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith(undefined);
  });

  it('temoin 2 — choisir une option fait remonter l objet complet', () => {
    const { arbre, setValue } = monterEtOuvrir({ value: '' });

    appuyerSur(arbre, 'option-Regional');
    appuyerSur(arbre, 'bouton-modals.actions.select');

    expect(setValue).toHaveBeenCalledWith({ label: 'Regional', value: 'niveau-2' });
  });

  it('temoin 3 — valider sans jamais rien choisir remonte aussi `undefined`', () => {
    const { arbre, setValue } = monterEtOuvrir({ value: '' });

    appuyerSur(arbre, 'bouton-modals.actions.select');

    expect(setValue).toHaveBeenCalledWith(undefined);
  });
});
