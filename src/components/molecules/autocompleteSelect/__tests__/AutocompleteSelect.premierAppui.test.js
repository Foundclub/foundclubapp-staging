import renderer, { act } from 'react-test-renderer';

import AutocompleteSelect from '../AutocompleteSelect';

// EVEDIT-3 (R5, E6) — LE PREMIER APPUI DOIT OUVRIR LE CHAMP.
//
// 🧱 LE CONSTAT D'ADEL, TROIS FOIS DE SUITE (27/08 et 28/08) : « il faut
// cliquer plusieurs fois pour pouvoir ouvrir et modifier un des champs ».
// Un CHAMP. L'ecran de modification en porte huit qui s'ouvrent — type,
// equipe, equipes conviees, statut, confidentialite, validation, et les deux
// de la recurrence. Tous sont ce composant.
//
// 🕳️ CE QUE MESURE CE FICHIER, ET C'EST LA SEULE CHOSE QUI COMPTE : entre
// l'appui et l'ouverture, `AutocompleteSelect` intercalait
// `InteractionManager.runAfterInteractions` — c'est-a-dire « attends que TOUTES
// les animations en cours soient finies ». Sur cet ecran, l'appui est precede
// d'un `Keyboard.dismiss()`, et le `KeyboardAvoidingView` de l'ecran anime sa
// hauteur dans la foulee : la liste ne s'ouvrait donc JAMAIS au moment du
// doigt. Le second appui passait parce que les animations avaient fini.
// Les champs date et heure, eux, ouvrent leur fenetre sur-le-champ
// (`setShowPicker(true)`) — c'est exactement l'asymetrie decrite en recette.
//
// 📅 Introduit le 2026-06-09 par le commit `9ddbabec` (« V0906 »), un
// fourre-tout de 15 fichiers, SANS UNE LIGNE d'explication. Avant lui,
// l'ouverture etait synchrone. Ni EVEDIT-1 ni EVEDIT-2 n'ont touche ce fichier.
//
// ⛔ ⛔ CE FICHIER NE DOIT JAMAIS DOUBLER `InteractionManager`, ET C'EST TOUT
// SON INTERET. Le seul autre temoin du composant
// (`AutocompleteSelect.deselection.test.js`) le remplace par un appel immediat
// pour pouvoir tester le reste — donc il s'execute dans un monde ou ce defaut
// N'EXISTE PAS. C'est la lecon d'EVEDIT-2, reecrite ici en negatif : un temoin
// qui neutralise le mecanisme fautif reste vert pour toujours.
//
// ⛔ NI HORLOGE TRUQUEE, NI `await`, NI VIDANGE DE FILE : on appuie une fois,
// et on regarde. Toute facilite ajoutee ici rendrait le temoin complaisant.

const OPTIONS = [
  { label: 'Entrainement', value: 'type-1' },
  { label: 'Match', value: 'type-2' },
];

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
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

// La feuille est doublee : ce qu'on observe n'est PAS son animation (c'est la
// ou EVEDIT-2 s'est trompe de couche), mais la DECISION du composant — a-t-il
// demande l'ouverture au moment du doigt, oui ou non.
jest.mock('../../bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return function BottomModalMock(/** @type {any} */ props) {
    if (!props.isVisible) return null;
    return reactActuel.createElement(
      VueRN,
      { testID: 'feuille-ouverte' },
      props.headerComponent,
      props.children,
      props.footerComponent,
    );
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function CheckableMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.setIsChecked, testID: `option-${props.text}` },
      reactActuel.createElement(TexteRN, null, props.text),
    );
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress, testID: `bouton-${props.title}` },
      null,
    );
  };
});

jest.mock('../../input/Input', () => function InputMock() {
  return null;
});

/**
 * Monte le selecteur ferme et rend son pressable.
 * @param {any} props - Surcharges passees au composant.
 * @returns {{ arbre: any, appuyerUneFois: () => void }} - L'arbre et le geste.
 */
const monterFerme = ({ disabled = false, isSearchable = false } = {}) => {
  /** @type {any} */
  let arbre;

  act(() => {
    arbre = renderer.create(
      <AutocompleteSelect
        disabled={disabled}
        isSearchable={isSearchable}
        label="Type"
        options={OPTIONS}
        placeholder="Choisir un type"
        setValue={jest.fn()}
        value=""
      />,
    );
  });

  const appuyerUneFois = () => {
    const pressableFerme = arbre.root.findAll(
      (/** @type {any} */ n) => n.props.accessibilityRole === 'button'
        && typeof n.props.onPress === 'function',
    )[0];
    // UN SEUL appui, synchrone. Rien d'autre n'est vidange ensuite.
    act(() => {
      pressableFerme.props.onPress();
    });
  };

  return { appuyerUneFois, arbre };
};

/**
 * Dit si la feuille de choix est montee.
 * @param {any} arbre - L'arbre monte.
 * @returns {boolean} - Vrai si la liste est ouverte.
 */
const laListeEstOuverte = (arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.testID === 'feuille-ouverte',
).length > 0;

describe('EVEDIT-3 · AutocompleteSelect — le premier appui ouvre le champ', () => {
  it('temoin 1 — un seul appui suffit a ouvrir la liste (champ simple)', () => {
    const { appuyerUneFois, arbre } = monterFerme();

    expect(laListeEstOuverte(arbre)).toBe(false);

    appuyerUneFois();

    // 🔴 ROUGE AVANT : `runAfterInteractions` remettait l'ouverture a plus
    // tard, donc la liste etait encore fermee ici — et Adel rappuyait.
    expect(laListeEstOuverte(arbre)).toBe(true);
  });

  it('temoin 2 — un seul appui suffit aussi quand le champ est cherchable', () => {
    // Les champs cherchables portaient UNE ATTENTE DE PLUS : 80 ms de minuterie
    // par-dessus l'attente des animations. Deux paris sur la vitesse du
    // telephone empiles l'un sur l'autre.
    const { appuyerUneFois, arbre } = monterFerme({ isSearchable: true });

    appuyerUneFois();

    expect(laListeEstOuverte(arbre)).toBe(true);
  });

  it('temoin 3 — un champ desactive ne s ouvre pas, meme au premier appui', () => {
    // ⛔ La garde qui ne doit pas partir avec le reste : `disabled` continue de
    // refuser. Sans ce temoin, « ouvrir tout de suite » pourrait vouloir dire
    // « ouvrir toujours ».
    const { appuyerUneFois, arbre } = monterFerme({ disabled: true });

    appuyerUneFois();

    expect(laListeEstOuverte(arbre)).toBe(false);
  });

  it('temoin 4 — la liste ouverte porte bien les options du champ', () => {
    // Ouvrir tout de suite ne sert a rien si la liste arrive vide : ce temoin
    // verifie que le contenu est la DES le premier appui, pas un cadre vide
    // qui se remplirait ensuite.
    const { appuyerUneFois, arbre } = monterFerme();

    appuyerUneFois();

    // 🪤 `findAll` rend AUSSI les noeuds d'accueil sous chaque option (le
    // pressable, ses vues internes) : un meme libelle ressort quatre fois. On
    // compare donc les identifiants DISTINCTS, jamais leur nombre brut.
    const options = [...new Set(arbre.root.findAll(
      (/** @type {any} */ n) => typeof n.props.testID === 'string'
        && n.props.testID.startsWith('option-'),
    ).map((/** @type {any} */ n) => n.props.testID))];

    expect(options).toEqual(['option-Entrainement', 'option-Match']);
  });
});
