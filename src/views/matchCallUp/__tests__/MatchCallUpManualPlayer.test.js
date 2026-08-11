import {
  Alert, Switch, Text, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MatchCallUpManualPlayer from '../MatchCallUpManualPlayer';

// D77 — ECRAN 3 du pack composition : « Ajouter un joueur hors app ».
//
// 🔒 La regle que ce fichier protege est la plus dure du pack : « le joueur
// hors app ne doit JAMAIS recevoir une promesse fausse ». Le bandeau jaune
// n'est pas une decoration, c'est la seule chose qui dit au coach qu'il devra
// prevenir ce joueur lui-meme.
//
// Il n'observe que le TEXTE VISIBLE et les couleurs du VRAI theme : un mock en
// Proxy rend les echecs Jest illisibles (constat du lot paywall du 2026-08-02).

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockRouteParams = {};
/** @type {any} */
let mockAlert;

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const valeur = String(cle || '').split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_correspondance, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

// Le VRAI theme, sans le contexte React qui le porte.
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
      Images: { arrowLeft: 1, chevronLeft: 1 },
      Spaces: espaces,
    }),
  };
});

jest.mock('@/components/templates/ScreenContainer', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: () => <TexteRN>RETOUR</TexteRN>,
  };
});

// Doublure de bouton qui PORTE son titre : on appuie sur ce qu'on lit.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

const couleursReelles = jest.requireActual('@/theme/colors').default();

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
 * Tout le texte visible de l'arbre rendu, concatene.
 * @param {any} arbre
 * @returns {string}
 */
const texteVisible = (arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children))
  .join(' | ');

/**
 * Le champ de saisie qui porte ce libelle.
 * @param {any} arbre
 * @param {string} libelle
 * @returns {any}
 */
const champ = (arbre, libelle) => arbre.root
  .findAllByType(TextInput)
  .find((/** @type {any} */ noeud) => noeud.props.accessibilityLabel === libelle);

/**
 * Appuie sur le bouton dont le titre est donne.
 * @param {any} arbre
 * @param {string} titre
 * @returns {Promise<void>}
 */
const appuyerSur = async (arbre, titre) => {
  const cible = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && aplatirTexte(noeud.props.children).includes(titre))
    .pop();
  await act(async () => { cible.props.onPress(); });
};

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran.
 * @param {any} [parametres]
 * @returns {Promise<any>}
 */
const rendre = async (parametres = {}) => {
  mockRouteParams = { teamName: 'Senior 1', ...parametres };
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCallUpManualPlayer />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

// 🧨 On DEMONTE entre deux tests : un arbre orphelin garde ses effets vivants
// et fait sortir jest en 1 avec tous les tests verts (piege D68).
afterEach(async () => {
  await act(async () => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  mockAlert.mockRestore();
});

describe('D77 ecran 3 — ajouter un joueur hors app', () => {
  test('l ecran porte l encart cyan, les 4 champs et l interrupteur SMS', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Ajouter un joueur');
    expect(texte).toContain("Il n'a pas l'app · Senior 1");
    expect(texte).toContain('Il apparaîtra sur la compo et dans la convocation comme les autres.');
    expect(texte).toContain('Prénom');
    expect(texte).toContain('Nom');
    expect(texte).toContain('Numéro de maillot');
    expect(texte).toContain('Téléphone');
    expect(texte).toContain('Le prévenir par SMS');
    expect(texte).toContain('Annuler');
    expect(texte).toContain('Ajouter au groupe');
  });

  test('le mot OPTIONNEL n apparait QUE sur les champs optionnels', async () => {
    const arbre = await rendre();
    const optionnels = arbre.root
      .findAllByType(Text)
      .filter((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children) === 'OPTIONNEL');

    // Numero de maillot + Telephone. Prenom et Nom sont requis.
    expect(optionnels).toHaveLength(2);
  });

  test('INTERRUPTEUR ETEINT : le bandeau jaune est la, et il nomme le joueur', async () => {
    const arbre = await rendre();
    await act(async () => {
      champ(arbre, 'Prénom').props.onChangeText('Yanis');
    });

    const texte = texteVisible(arbre);
    expect(texte).toContain('Sans téléphone, Yanis ne recevra');
    expect(texte).toContain('aucune notification');
    expect(texte).toContain('. Ce sera à toi de le prévenir.');
  });

  test('le bandeau est JAUNE — c est le jeton d avertissement du theme', async () => {
    const arbre = await rendre();
    const accent = arbre.root
      .findAllByType(Text)
      .find((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children)
        === 'aucune notification');

    const styles = [accent.props.style].flat(Infinity).filter(Boolean);
    expect(styles.some((/** @type {any} */ style) => style?.color === couleursReelles.warning500))
      .toBe(true);
  });

  test('SMS ALLUME SANS NUMERO : le bandeau RESTE, la promesse serait fausse', async () => {
    const arbre = await rendre();
    await act(async () => {
      champ(arbre, 'Prénom').props.onChangeText('Yanis');
      arbre.root.findByType(Switch).props.onValueChange(true);
    });

    expect(texteVisible(arbre)).toContain('aucune notification');
  });

  test('NUMERO + INTERRUPTEUR ALLUME : le bandeau disparait', async () => {
    const arbre = await rendre();
    await act(async () => {
      champ(arbre, 'Prénom').props.onChangeText('Yanis');
      champ(arbre, 'Téléphone').props.onChangeText('0612345678');
      arbre.root.findByType(Switch).props.onValueChange(true);
    });

    expect(texteVisible(arbre)).not.toContain('aucune notification');
  });

  test('sans prenom ni nom, on avertit et on ne navigue pas', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Ajouter au groupe');

    expect(mockAlert).toHaveBeenCalledWith('Ajouter un joueur', 'Prénom et nom requis.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('le joueur revient a l ecran 1 avec telephone, SMS et TOUS les parametres', async () => {
    const arbre = await rendre({ returnParams: { eventId: 'evt_1', sport: 'football' } });
    await act(async () => {
      champ(arbre, 'Prénom').props.onChangeText('Yanis');
      champ(arbre, 'Nom').props.onChangeText('Bertrand');
      champ(arbre, 'Numéro de maillot').props.onChangeText('23');
      champ(arbre, 'Téléphone').props.onChangeText('0612345678');
      arbre.root.findByType(Switch).props.onValueChange(true);
    });
    await appuyerSur(arbre, 'Ajouter au groupe');

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [nomEcran, parametres] = mockNavigate.mock.calls[0];
    expect(nomEcran).toBe('MatchCallUpSelection');
    // Les parametres de l'ecran 1 reviennent entiers : rien ne se perd en route.
    expect(parametres.eventId).toBe('evt_1');
    expect(parametres.sport).toBe('football');
    expect(parametres.pendingManualPlayer).toEqual(expect.objectContaining({
      firstname: 'Yanis',
      isManual: true,
      lastname: 'Bertrand',
      notifyBySms: true,
      number: '23',
      phone: '0612345678',
    }));
    expect(String(parametres.pendingManualPlayer.id)).toMatch(/^manual_\d+$/);
  });

  test('« Annuler » revient en arriere sans rien creer', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Annuler');

    expect(mockGoBack).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
