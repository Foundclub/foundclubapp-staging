import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BlocMesEnfants from '../BlocMesEnfants';

/**
 * PAR-L7 (13/10, design parent E03, décision D1 A d'Adel du 12/10) — LE BLOC « MES ENFANTS » DE
 * « MON PROFIL ». Le parent l'a toujours (c'est son profil : ses enfants, puis ses infos) ; un
 * compte sportif ne l'a que s'il a des enfants. Les mêmes lignes que la carte de l'accueil,
 * « + 2 autres », « Voir tout » vers « Mes enfants », et le « + » carré pour en ajouter un.
 */

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const theme = {
    Alignments: alignements,
    ApplicationStyle: genererStyles(couleurs),
    Colors: couleurs,
    Fonts: genererPolices(couleurs),
    Images: { arrowRight: 1, plus: 1 },
    Spaces: espaces,
  };
  return { __esModule: true, default: () => theme };
});

const useMesEnfantsEnBref = jest.requireMock('@/views/profile/parent/useMesEnfantsEnBref').default;

/**
 * Aplati les enfants React en une chaîne.
 * @param {any} enfants - Les enfants d'un nœud.
 * @returns {string} - Le texte.
 */
const aplatir = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};

/** @type {renderer.ReactTestRenderer[]} */
const arbres = [];
afterEach(() => {
  arbres.splice(0).forEach((arbre) => act(() => { arbre.unmount(); }));
  useMesEnfantsEnBref.regler();
  useMesEnfantsEnBref.appels.length = 0;
});

/**
 * Monte le bloc.
 * @param {{ toujours?: boolean }} [props] - Les propriétés du bloc.
 * @returns {{ arbre: renderer.ReactTestRenderer, navigation: any, textes: string[] }} - Le rendu.
 */
const monter = (props = {}) => {
  const navigation = { navigate: jest.fn() };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <BlocMesEnfants navigation={navigation} toujours={props.toujours === true} />,
    );
  });
  arbres.push(arbre);
  // Les textes de PREMIER niveau : un prénom en gras est un Text DANS la ligne.
  const dansUnTexte = (/** @type {any} */ noeud) => {
    let ancetre = noeud.parent;
    while (ancetre) {
      if (ancetre.type === Text) return true;
      ancetre = ancetre.parent;
    }
    return false;
  };
  const textes = arbre.root.findAllByType(Text)
    .filter((noeud) => !dansUnTexte(noeud))
    .map((noeud) => aplatir(noeud.props.children));
  return { arbre, navigation, textes };
};

/**
 * Le bouton (nœud hôte) qui porte ce testID.
 * @param {renderer.ReactTestRenderer} arbre - L'arbre.
 * @param {string} testID - L'étiquette.
 * @returns {any} - Le nœud.
 */
const bouton = (arbre, testID) => arbre.root.find(
  (noeud) => typeof noeud.type === 'string' && noeud.props.testID === testID,
);

const QUATRE = {
  lignes: [
    ['a', 'U11 Filles', 'Anissa'],
    ['m', 'Demande en attente', 'Martin'],
    ['l', 'Pas encore d’équipe', 'Léa'],
  ].map(([cle, etat, prenom]) => ({
    cible: { id: `f-${cle}`, type: 'fiche' }, cle, etat, prenom,
  })),
  reste: 1,
  total: 4,
};

test('une ligne par enfant, « + 1 autre », puis « Voir tout » vers « Mes enfants »', () => {
  useMesEnfantsEnBref.regler(QUATRE);
  const { arbre, navigation, textes } = monter();

  expect(textes).toEqual([
    'Mes enfants',
    'Anissa · U11 Filles',
    'Martin · Demande en attente',
    'Léa · Pas encore d’équipe',
    '+ 1 autre',
    'Voir tout',
  ]);
  act(() => bouton(arbre, 'bloc-mes-enfants-voir-tout').props.onClick());
  expect(navigation.navigate).toHaveBeenCalledWith('MyChildren');
});

test('le « + » carré ajoute un enfant (44 px, nommé pour le lecteur d écran)', () => {
  useMesEnfantsEnBref.regler(QUATRE);
  const { arbre, navigation } = monter();
  const plus = bouton(arbre, 'bloc-mes-enfants-ajouter');

  expect(plus.props.accessibilityLabel).toBe('Ajouter un enfant');
  expect(plus.props.style).toEqual(expect.objectContaining({ height: 44, width: 44 }));
  act(() => plus.props.onClick());
  expect(navigation.navigate).toHaveBeenCalledWith('ChildEdit');
});

test('le parent sans enfant le garde et lit quoi faire (pas de « Voir tout » à vide)', () => {
  const { arbre, textes } = monter({ toujours: true });

  expect(textes).toEqual(['Mes enfants', 'Tu n’as pas encore déclaré d’enfant.']);
  expect(arbre.root.findAll((noeud) => noeud.props.testID === 'bloc-mes-enfants-voir-tout'))
    .toHaveLength(0);
});

test('un compte sportif sans enfant ne voit rien ; les lectures, elles, partent', () => {
  const { arbre } = monter();

  expect(arbre.toJSON()).toBeNull();
  expect(useMesEnfantsEnBref.appels).toEqual([{ actif: true }]);
});
