import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ChildEdit from '../ChildEdit';

/**
 * PARENT P2 — ÉCRAN 8 : « AJOUTER OU MODIFIER UN ENFANT ».
 *
 * Trois champs obligatoires, et pas un de plus que ce que le plan autorise
 * (C10) : prénom, nom, date de naissance. ⛔ Ni téléphone, ni e-mail, ni
 * adresse (on contacte SON PARENT), ni taille, ni poids (ce sont ces deux-là
 * qui obligent les magasins à une déclaration « données de santé »), ni
 * nationalité. La liste blanche du serveur les jette de toute façon — ce témoin
 * garantit que l'écran ne les DEMANDE même pas.
 *
 * 🔒 LA MODIFICATION NE PEUT PAS PRÉ-REMPLIR LA DATE DE NAISSANCE, et ce n'est
 * pas un oubli : le serveur ne la rend JAMAIS (il rend un âge calculé). L'écran
 * doit donc le dire, au lieu d'afficher trois cases vides sans explication.
 *
 * 🧒 LE PALIER 13 SE DIT AVANT D'ENVOYER. `isBirthdateUnderParentAccountAge`
 * existait dans l'app depuis des mois sans être appelé nulle part (§4.5 du
 * plan) : le palier ne tenait que sur le refus serveur. Il est branché ici.
 */

/** @type {any} */
let mockEnfants;
const mockCreer = jest.fn();
const mockModifier = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockParams;

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
        const brut = String(cle || '');
        const source = (repli && typeof repli === 'object' ? repli : options) || {};
        const valeur = brut.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur === 'string') {
          return valeur.replace(
            /\{\{(\w+)\}\}/g,
            (/** @type {string} */ _tout, /** @type {string} */ clef) => String(source[clef] ?? ''),
          );
        }
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useCreateDeclaredChild: () => ({ isPending: false, mutate: mockCreer }),
  useGetMyDeclaredChildren: () => ({ data: mockEnfants, error: undefined, isLoading: false }),
  useUpdateDeclaredChild: () => ({ isPending: false, mutate: mockModifier }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

/**
 * 🎨 LE CONTENEUR EST RENDU AVEC SES VRAIES PROPS.
 *
 * On ne l'aplatit pas en `<View>` : le témoin ⑦ a besoin de LIRE
 * `keyboardAvoiding` et `keyboardScroll`. Sans les deux, le bouton du bas
 * devient inatteignable clavier ouvert — et AUCUNE porte ne mesure ça.
 */
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (
      <View
        keyboardAvoiding={props.keyboardAvoiding}
        keyboardScroll={props.keyboardScroll}
      >
        {props.children}
      </View>
    ),
  };
});

/**
 * Aplati les enfants React en une chaîne.
 * @param {any} enfants - Les enfants React.
 * @returns {string} Le texte.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Tout le texte visible de l'écran.
 * @param {any} arbre - L'arbre rendu.
 * @returns {string} Le texte.
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Monte l'écran.
 * @returns {Promise<any>} L'arbre rendu.
 */
const rendre = async () => {
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<ChildEdit />);
  });
  return arbre;
};

/**
 * Saisit une valeur dans le champ portant ce repère.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} repere - Le `testID` du champ.
 * @param {string} valeur - Ce qu'on tape.
 * @returns {Promise<void>} Rien.
 */
const saisir = async (arbre, repere, valeur) => {
  const champ = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.type === TextInput && noeud.props?.testID === repere
  ))[0];
  if (!champ) throw new Error(`champ introuvable : ${repere}`);
  await act(async () => { champ.props.onChangeText(valeur); });
};

/**
 * Appuie sur le bouton d'enregistrement.
 * @param {any} arbre - L'arbre rendu.
 * @returns {Promise<void>} Rien.
 */
const enregistrer = async (arbre) => {
  const bouton = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.testID === 'child-edit-submit' && typeof noeud.props?.onPress === 'function'
  ))[0];
  if (!bouton) throw new Error('bouton d’enregistrement introuvable');
  await act(async () => { bouton.props.onPress(); });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockEnfants = [];
  mockParams = undefined;
});

test("P2/8 ① l'écran ne demande QUE les champs autorisés", async () => {
  const arbre = await rendre();

  // 🔒 ON COMPTE LES CHAMPS, PAS LES MOTS. Chercher « téléphone » dans le texte
  // visible attraperait la phrase qui RASSURE le parent (« on ne demande ni
  // téléphone, ni adresse ») — un témoin qui interdit de DIRE ce qu'on ne
  // collecte pas mesure l'inverse de ce qu'il croit. Ce qui compte, c'est la
  // liste EXACTE des cases à remplir : ni téléphone, ni e-mail, ni adresse, ni
  // taille, ni poids, ni nationalité n'en fait partie (C10 du plan).
  const champs = arbre.root
    .findAllByType(TextInput)
    .map((/** @type {any} */ noeud) => noeud.props?.testID)
    .filter(Boolean)
    .sort();

  expect(champs).toEqual([
    'child-day',
    'child-firstname',
    'child-lastname',
    'child-month',
    'child-number',
    'child-position',
    'child-year',
  ]);

  const texte = texteVisible(arbre).toLowerCase();
  expect(texte).toContain('prénom');
  expect(texte).toContain('nom');
  expect(texte).toContain('date de naissance');
});

test('P2/8 ② un enfant complet part avec ses trois champs obligatoires', async () => {
  const arbre = await rendre();

  await saisir(arbre, 'child-firstname', 'Léa');
  await saisir(arbre, 'child-lastname', 'Martin');
  await saisir(arbre, 'child-day', '04');
  await saisir(arbre, 'child-month', '05');
  await saisir(arbre, 'child-year', '2017');
  await enregistrer(arbre);

  expect(mockCreer).toHaveBeenCalledTimes(1);
  expect(mockCreer.mock.calls[0][0]).toEqual({
    birthdate: '2017-05-04',
    firstname: 'Léa',
    lastname: 'Martin',
  });
});

test('P2/8 ③ 🔢 un numéro de maillot laissé VIDE ne part pas en zéro', async () => {
  const arbre = await rendre();

  await saisir(arbre, 'child-firstname', 'Léa');
  await saisir(arbre, 'child-lastname', 'Martin');
  await saisir(arbre, 'child-day', '04');
  await saisir(arbre, 'child-month', '05');
  await saisir(arbre, 'child-year', '2017');
  await saisir(arbre, 'child-number', '');
  await enregistrer(arbre);

  const charge = mockCreer.mock.calls[0][0];
  expect(Object.prototype.hasOwnProperty.call(charge, 'number')).toBe(false);
});

test("P2/8 ④ 🧒 LE PALIER 13 EST DIT AVANT D'ENVOYER : 25 ans n'atteint pas le serveur", async () => {
  const arbre = await rendre();

  await saisir(arbre, 'child-firstname', 'Paul');
  await saisir(arbre, 'child-lastname', 'Martin');
  await saisir(arbre, 'child-day', '04');
  await saisir(arbre, 'child-month', '05');
  await saisir(arbre, 'child-year', '2000');
  await enregistrer(arbre);

  expect(mockCreer).not.toHaveBeenCalled();
  expect(texteVisible(arbre)).toContain('13 ans');
});

test('P2/8 ⑤ MODIFIER : l\'écran DIT pourquoi la date de naissance est vide', async () => {
  mockParams = { childDocumentId: 'enfant-1' };
  mockEnfants = [{
    age: 9,
    documentId: 'enfant-1',
    firstname: 'Léa',
    lastname: 'Martin',
    number: 10,
    position: 'Gardienne',
  }];

  const arbre = await rendre();
  const texte = texteVisible(arbre);

  // Ce qui EST connu est pré-rempli...
  const prenom = arbre.root.findAll((/** @type {any} */ n) => (
    n.type === TextInput && n.props?.testID === 'child-firstname'
  ))[0];
  expect(prenom.props.value).toBe('Léa');
  // ...et ce qui ne peut pas l'être est EXPLIQUÉ, au lieu de trois cases muettes.
  expect(texte).toContain('Laisse vide pour ne pas la changer');
});

test('P2/8 ⑥ MODIFIER sans retoucher la date : la date n\'est PAS envoyée', async () => {
  mockParams = { childDocumentId: 'enfant-1' };
  mockEnfants = [{
    age: 9,
    documentId: 'enfant-1',
    firstname: 'Léa',
    lastname: 'Martin',
    number: null,
    position: null,
  }];

  const arbre = await rendre();
  await saisir(arbre, 'child-number', '7');
  await enregistrer(arbre);

  expect(mockModifier).toHaveBeenCalledTimes(1);
  const { documentId, payload } = mockModifier.mock.calls[0][0];
  expect(documentId).toBe('enfant-1');
  expect(Object.prototype.hasOwnProperty.call(payload, 'birthdate')).toBe(false);
  expect(payload.number).toBe(7);
});

test('P2/8 ⑦ 🎨 le bouton du bas reste ATTEIGNABLE clavier ouvert', async () => {
  const arbre = await rendre();

  // `ScreenContainer` ne monte un défilement QUE si on lui passe les DEUX
  // props : `keyboardScroll` seul ne fait rien sans `keyboardAvoiding`
  // (ScreenContainer.js — le défilement est à l'intérieur de l'évitement).
  // Cet écran porte 5 champs plus un bouton : clavier ouvert, la zone restante
  // ne les contient plus. Aucune porte ne mesure ça.
  const conteneur = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.keyboardScroll === true
  ));
  expect(conteneur.length).toBeGreaterThan(0);
  expect(conteneur[0].props.keyboardAvoiding).toBe(true);
});
