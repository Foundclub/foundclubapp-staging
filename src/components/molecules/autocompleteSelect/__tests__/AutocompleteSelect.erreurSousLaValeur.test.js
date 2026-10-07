import { StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AutocompleteSelect from '../AutocompleteSelect';

// 📍 VILLE-INSTALLATION (07/10/2026) — LA VALEUR S ECRIVAIT PAR-DESSUS LE MESSAGE D ERREUR.
//
// Essai d Adel sur la 2.6.70 (formulaire « Ajouter une installation » de la Ville) : l adresse
// choisie s affichait SOUS la ligne du champ, a cheval sur « Sélectionnez une adresse
// géolocalisée dans la liste. ».
//
// La mecanique : la valeur fermee vit dans une SURCOUCHE absolue (`fullSize`, contenu colle en
// BAS) posee sur l `Input`. Or l `Input` dessine aussi, sous sa ligne, le message d erreur : avec
// une erreur, la boite que couvre la surcouche s allonge de ce message, et le « bas » ou se pose
// la valeur n est plus la ligne — c est le message. 55 usages passent une erreur a ce champ.
//
// Ce temoin monte le VRAI Input et le VRAI theme, et exige que le message d erreur soit HORS de
// la boite couverte par la surcouche — donc que la valeur ne puisse plus le recouvrir.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces,
    }),
  };
});

jest.mock('../../bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
});
jest.mock('@/components/atoms/checkable/Checkable', () => function CheckableMock() {
  return null;
});
jest.mock('@/components/atoms/button/Button', () => function ButtonMock() {
  return null;
});

const Colors = jest.requireActual('@/theme/colors').default();
const MESSAGE = 'Sélectionnez une adresse géolocalisée dans la liste.';
const VALEUR = 'Avenue de Luminy 13009 Marseille';

const aplatir = (/** @type {any} */ enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};

/** @type {any[]} */
const arbres = [];
const monter = (/** @type {string | undefined} */ erreur = MESSAGE) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <AutocompleteSelect
        error={erreur}
        isSearchable
        label="Adresse (lieu exact)"
        options={[]}
        placeholder="Ex: 12 Rue du Stade..."
        setValue={jest.fn()}
        value={VALEUR}
      />,
    );
  });
  arbres.push(arbre);
  return arbre;
};
const surcouche = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props.accessibilityRole === 'button'
    && typeof n.props.onPress === 'function'
    && StyleSheet.flatten(n.props.style)?.position === 'absolute',
)[0];
const texte = (/** @type {any} */ noeud, /** @type {string} */ contenu) => noeud
  .findAllByType(Text)
  .filter((/** @type {any} */ t) => aplatir(t.props.children).trim() === contenu);

afterEach(() => {
  act(() => { arbres.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('VILLE-INSTALLATION — la valeur choisie ne recouvre plus le message d erreur', () => {
  it('le message d erreur est dessine HORS de la boite que couvre la surcouche', () => {
    const arbre = monter();
    const zoneCouverte = surcouche(arbre).parent;

    expect(texte(arbre.root, MESSAGE)).toHaveLength(1);
    expect(texte(zoneCouverte, MESSAGE)).toHaveLength(0);
    expect(texte(surcouche(arbre), VALEUR)).toHaveLength(1);
  });

  it('le champ reste dit en erreur : libelle rouge, et le message a la couleur d avant', () => {
    const arbre = monter();
    const [libelle] = texte(arbre.root, 'Adresse (lieu exact)');
    const [message] = texte(arbre.root, MESSAGE);

    expect(StyleSheet.flatten(libelle.props.style).color).toBe(Colors.error300);
    expect(StyleSheet.flatten(message.props.style).color).toBe(Colors.error300);
  });

  it('sans erreur, aucun message, et le libelle reste blanc', () => {
    const arbre = monter('');
    const [libelle] = texte(arbre.root, 'Adresse (lieu exact)');

    expect(texte(arbre.root, MESSAGE)).toHaveLength(0);
    expect(StyleSheet.flatten(libelle.props.style).color).toBe(Colors.neutral00);
  });
});
