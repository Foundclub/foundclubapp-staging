import {
  Alert, ScrollView, StyleSheet, Switch, Text, TextInput,
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

// ⚠️ CE FICHIER A CHANGE DE VERDICT LE 2026-08-14 — decision d Adel, option B.
//
// D77 avait dessine un interrupteur « Le prevenir par SMS » et un champ
// Telephone. Mesure du lot C1 : AUCUN service SMS n existe dans `admin`
// (0 occurrence de sendSms/twilio/brevo/vonage). L interrupteur promettait
// « Un lien vers la convocation, consultable sans compte » — une promesse
// fausse, precisement ce que la regle du pack interdit — et le numero d une
// personne sans compte etait conserve, puis livre a tout le canal de l equipe.
//
// Adel a tranche : on retire les DEUX. Le joueur reste ajoutable, c est son NOM
// qui sert. Le bandeau jaune, lui, devient PERMANENT : il ne depend plus d un
// interrupteur, donc il ne peut plus se contredire.
describe('D77 ecran 3 — ajouter un joueur hors app', () => {
  test('l ecran porte l encart cyan et les 3 champs, sans plus rien promettre', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).toContain('Ajouter un joueur');
    expect(texte).toContain("Il n'a pas l'app · Senior 1");
    expect(texte).toContain('Il apparaîtra sur la compo et dans la convocation comme les autres.');
    expect(texte).toContain('Prénom');
    expect(texte).toContain('Nom');
    expect(texte).toContain('Numéro de maillot');
    expect(texte).toContain('Annuler');
    expect(texte).toContain('Ajouter au groupe');
  });

  test('🥇 PLUS AUCUNE PROMESSE D ENVOI SMS A L ECRAN', async () => {
    const arbre = await rendre();
    const texte = texteVisible(arbre);

    expect(texte).not.toContain('SMS');
    expect(texte).not.toContain('Téléphone');
    expect(texte).not.toContain('consultable sans compte');
  });

  test('⛔ et il n y a plus AUCUN interrupteur a actionner', async () => {
    const arbre = await rendre();

    expect(arbre.root.findAllByType(Switch)).toHaveLength(0);
  });

  test('le mot OPTIONNEL n apparait QUE sur le champ optionnel', async () => {
    const arbre = await rendre();
    const optionnels = arbre.root
      .findAllByType(Text)
      .filter((/** @type {any} */ noeud) => aplatirTexte(noeud.props.children) === 'OPTIONNEL');

    // Le numero de maillot, seul. Prenom et Nom sont requis.
    expect(optionnels).toHaveLength(1);
  });

  test('le bandeau jaune est la d entree de jeu, et il nomme le joueur', async () => {
    const arbre = await rendre();
    await act(async () => {
      champ(arbre, 'Prénom').props.onChangeText('Yanis');
    });

    const texte = texteVisible(arbre);
    expect(texte).toContain('Yanis ne recevra');
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

  test('🔒 le bandeau ne peut PLUS disparaitre : rien ne peut le contredire', async () => {
    // Avant, un numero + l interrupteur le faisaient disparaitre — donc l ecran
    // affirmait que le joueur serait prevenu, alors qu aucun envoi n existait.
    const arbre = await rendre();
    await act(async () => {
      champ(arbre, 'Prénom').props.onChangeText('Yanis');
      champ(arbre, 'Nom').props.onChangeText('Bertrand');
      champ(arbre, 'Numéro de maillot').props.onChangeText('23');
    });

    expect(texteVisible(arbre)).toContain('aucune notification');
  });

  test('sans prenom ni nom, on avertit et on ne navigue pas', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Ajouter au groupe');

    expect(mockAlert).toHaveBeenCalledWith('Ajouter un joueur', 'Prénom et nom requis.');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('le joueur revient a l ecran 1 avec TOUS les parametres, sans telephone', async () => {
    const arbre = await rendre({ returnParams: { eventId: 'evt_1', sport: 'football' } });
    await act(async () => {
      champ(arbre, 'Prénom').props.onChangeText('Yanis');
      champ(arbre, 'Nom').props.onChangeText('Bertrand');
      champ(arbre, 'Numéro de maillot').props.onChangeText('23');
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
      number: '23',
    }));
    expect(parametres.pendingManualPlayer.phone).toBeUndefined();
    expect(parametres.pendingManualPlayer.notifyBySms).toBeUndefined();
    expect(String(parametres.pendingManualPlayer.id)).toMatch(/^manual_\d+$/);
  });

  test('« Annuler » revient en arriere sans rien creer', async () => {
    const arbre = await rendre();
    await appuyerSur(arbre, 'Annuler');

    expect(mockGoBack).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

// D84 — LE VOISIN AVAIT LE MEME DEFAUT, et il est mesure, pas suppose.
//
// Meme cause exactement qu'a l'ecran 1 : un ScrollView non borne se mesure a la
// hauteur de ses enfants et pousse le pied de page dehors. Ici le formulaire
// pese 696 pt a lui seul (58 d'en-tete + 567 de contenu + 71 de pied, mesure sur
// l'arbre rendu) : il DEBORDE deja sur un petit telephone (iPhone SE : 647 pt
// utiles) et il deborde sur TOUS des que le clavier retracte la fenetre — or
// c'est un formulaire, le clavier y est ouvert presque tout le temps.
describe('D84 — les 2 boutons du bas restent atteignables', () => {
  test('🥇 LE CONTENEUR DEFILANT EST BORNE — il ne se mesure pas sur son contenu', async () => {
    const arbre = await rendre();
    const style = StyleSheet.flatten(arbre.root.findByType(ScrollView).props.style) || {};

    expect(style.flex).toBe(1);
  });

  test('⛔ le pied est hors du defilement, sans surimpression ni marge basse a zero', async () => {
    const arbre = await rendre();
    const racine = arbre.toJSON();
    const pied = racine.children[racine.children.length - 1];
    const style = StyleSheet.flatten(pied.props.style) || {};

    /**
     * Tout le texte porte par un noeud de l'arbre JSON, enfants compris.
     * @param {any} noeud
     * @returns {string}
     */
    const texteDuNoeud = (noeud) => {
      if (noeud === null || noeud === undefined || typeof noeud === 'boolean') return '';
      if (typeof noeud !== 'object') return String(noeud);
      return (noeud.children || []).map(texteDuNoeud).join(' ');
    };

    expect(texteDuNoeud(pied)).toContain('Annuler');
    expect(texteDuNoeud(pied)).toContain('Ajouter au groupe');
    expect(String(pied.type)).not.toContain('ScrollView');
    expect(style.position).not.toBe('absolute');
    // 🛟 L'ecran est `edge-to-edge` : ce pied est le seul a porter le retrait bas.
    expect(style.paddingBottom).toBeGreaterThanOrEqual(12);
  });

  test('le dernier champ garde sa reserve en bas du formulaire', async () => {
    const arbre = await rendre();
    const contenu = StyleSheet.flatten(
      arbre.root.findByType(ScrollView).props.contentContainerStyle,
    ) || {};

    expect(contenu.paddingBottom).toBeGreaterThan(0);
    // ⌨️ Le champ le plus bas, celui que le clavier menace, reste dans l'arbre.
    // C-A : c'etait « Telephone » avant son retrait, c'est le maillot depuis.
    expect(champ(arbre, 'Numéro de maillot')).toBeDefined();
  });
});
