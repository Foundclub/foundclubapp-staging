import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createElement } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { commonOptions } from '@/navigation/commonOptions';

/**
 * FINITIONS13-STATS, point 1 — L'EN-TETE TRANSPARENT EST INVISIBLE AUX LECTEURS D'ECRAN.
 *
 * 🔴 LE CONSTAT (T12, `.recette/tournee12/AJOUT4_dump_*.xml`) : sur la page d'un
 * evenement, « Retour », « Signaler l'evenement » et « Gerer l'evenement » sont
 * ABSENTS du releve d'accessibilite d'Android (`uiautomator dump`), alors que les
 * trois boutons sont a l'ecran et portent leur etiquette dans le code.
 *
 * 🔍 LA CAUSE, lue dans `@react-navigation/stack` 7.4.8 :
 *   · sur Android la pile dessine l'en-tete DANS la carte de l'ecran (`headerMode`
 *     « screen » par defaut, `CardStack.js`) ;
 *   · `CardContainer` l'enveloppe dans une boite `{ zIndex: 1 }` qui reste DANS la
 *     colonne de la carte ;
 *   · avec `headerTransparent: true` (TOUTE l'app, `commonOptions.js`), l'en-tete
 *     lui-meme passe en `position: absolute` (`HeaderContainer`) pour que le contenu
 *     passe dessous ;
 *   · une boite dont le seul enfant est en absolu a une HAUTEUR NULLE. Android la
 *     declare « invisible pour l'utilisateur » (`View.isVisibleToUser`, aire nulle)
 *     et les outils d'accessibilite sautent TOUT ce qu'elle contient : le releve de
 *     la T12 montre ce trou (indice 0 absent sous la carte).
 *   C'est le defaut amont react-navigation#13043 (« Headers on Android lose
 *   accessibility ability when headerTransparent: true »), corrige par #13075 dans
 *   une version plus recente que la notre.
 *
 * ✅ CE QUE CE FILET EXIGE, sur la VRAIE pile, en mode Android :
 *   1. chaque boite entre un bouton de l'en-tete et la racine a une hauteur ;
 *   2. l'en-tete ne prend toujours AUCUNE place dans la colonne : le contenu passe
 *      dessous, comme avant (l'apparence ne bouge pas — c'est le piege qu'a connu
 *      le premier correctif amont, react-navigation#13096).
 *
 * ⚠️ Ce filet lit `node_modules` : il est ROUGE tant que le correctif
 * `patches/@react-navigation+stack+7.4.8.patch` n'est pas applique
 * (`npx patch-package`, que `npm ci` lance seul en `postinstall`).
 */

// Le paquet de gestes est publie en TypeScript brut, que ce depot ne transpile pas
// (jest.config.js) : la pile n'en lit que le glisser-retour, sans objet ici.
jest.mock('react-native-gesture-handler', () => {
  const { View } = jest.requireActual('react-native');
  return {
    GestureHandlerRootView: View,
    PanGestureHandler: ({ children }) => children,
    State: {
      ACTIVE: 4, BEGAN: 2, CANCELLED: 3, END: 5, FAILED: 1, UNDETERMINED: 0,
    },
  };
});

// Un telephone sans encoche (meme doublure que SearchStack.enTeteRetour.test.js).
jest.mock('react-native-safe-area-context', () => {
  const reactActuel = jest.requireActual('react');
  const zero = {
    bottom: 0, left: 0, right: 0, top: 0,
  };
  const cadre = {
    height: 812, width: 375, x: 0, y: 0,
  };
  const SafeAreaInsetsContext = reactActuel.createContext(zero);
  const SafeAreaFrameContext = reactActuel.createContext(cadre);
  return {
    initialWindowMetrics: { frame: cadre, insets: zero },
    SafeAreaFrameContext,
    SafeAreaInsetsContext,
    SafeAreaProvider: ({ children }) => children,
    SafeAreaView: ({ children }) => children,
    useSafeAreaFrame: () => cadre,
    useSafeAreaInsets: () => zero,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : clef
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const genererStyle = jest.requireActual('@/theme/applicationStyle').default;
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();
  const theme = {
    Alignments,
    ApplicationStyle: genererStyle(Colors),
    Colors,
    Fonts: genererPolices(Colors),
    Images: { arrowLeft: 1 },
    Spaces,
  };
  return { __esModule: true, default: () => theme };
});

// `commonOptions` tire le verre depoli et le bouton d'onglet anime (modules natifs) :
// ils ne servent qu'a la barre d'onglets, jamais a l'en-tete mesure ici.
jest.mock('@/components/atoms/glassSurface/GlassSurface', () => 'GlassSurface');
jest.mock(
  '@/components/atoms/animatedTabBarButton/AnimatedTabBarButton',
  () => 'AnimatedTabBarButton',
);

const SIGNALER = 'Signaler l’événement';
const RETOUR = 'Retour';
const CONTENU = 'contenu:evenement';

const Pile = createStackNavigator();

/** @type {any} */
let conteneur = null;
/** @type {any} */
let arbre = null;

/**
 * Un ecran doublure : il affiche son contenu, rien d'autre.
 * @returns {import('react').ReactElement} le contenu
 */
function Evenement() {
  return createElement(Text, null, CONTENU);
}

/**
 * L'ecran de depart : sans lui, pas de fleche « Retour ».
 * @returns {import('react').ReactElement} le contenu
 */
function Depart() {
  return createElement(Text, null, 'contenu:depart');
}

/**
 * Monte la VRAIE pile, avec les options de toute l'app, puis ouvre l'evenement.
 * La barre de droite imite celle d'EventDetails (un bouton de 44 pt, etiquete).
 * @returns {void}
 */
const monterEtOuvrir = () => {
  act(() => {
    arbre = renderer.create(createElement(
      NavigationContainer,
      { ref: (/** @type {any} */ reference) => { if (reference) conteneur = reference; } },
      createElement(
        Pile.Navigator,
        { screenOptions: commonOptions },
        createElement(Pile.Screen, { component: Depart, name: 'Depart' }),
        createElement(Pile.Screen, {
          component: Evenement,
          name: 'Evenement',
          options: {
            headerBackAccessibilityLabel: RETOUR,
            headerRight: () => createElement(TouchableOpacity, {
              accessibilityLabel: SIGNALER,
              accessibilityRole: 'button',
              style: { height: 44, width: 44 },
            }),
          },
        }),
      ),
    ));
  });
  act(() => { conteneur.navigate('Evenement'); });
};

/**
 * Les noeuds HOTES (ceux qu'Android dessine) directement sous `noeud`.
 * @param {any} noeud un noeud du rendu de test
 * @returns {any[]} ses enfants hotes (une chaine compte pour un texte)
 */
const enfantsHotes = (noeud) => noeud.children.flatMap((/** @type {any} */ enfant) => {
  if (typeof enfant === 'string') return [{ texte: enfant }];
  if (typeof enfant.type === 'string') return [enfant];
  return enfantsHotes(enfant);
});

/**
 * Dit si une dimension de style donne une taille.
 * @param {any} valeur une dimension de style
 * @returns {boolean} vrai si elle donne une taille
 */
const positive = (valeur) => (typeof valeur === 'number' && valeur > 0)
  || (typeof valeur === 'string' && !['0', '0%', 'auto'].includes(valeur));

/**
 * Le style aplati d'un noeud hote (vide pour un texte).
 * @param {any} noeud un noeud hote
 * @returns {Record<string, any>} son style aplati
 */
const styleDe = (noeud) => (noeud.texte === undefined
  ? StyleSheet.flatten(noeud.props.style) || {}
  : {});

/**
 * La regle de mise en page qui compte ici (Yoga, colonne) : une boite sans hauteur,
 * sans `flex`, sans marge interne verticale, dont aucun enfant n'est DANS le flux,
 * a une hauteur NULLE — un enfant en absolu ne lui donne aucune taille.
 * @param {any} noeud un noeud hote
 * @returns {boolean} vrai si la boite a une hauteur
 */
const aUneHauteur = (noeud) => {
  if (noeud.texte !== undefined) return noeud.texte.length > 0;
  // Texte, image, dessin : une boite de contenu.
  if (noeud.type !== 'View') return true;
  const style = styleDe(noeud);
  if (style.display === 'none') return false;
  if (positive(style.height) || positive(style.minHeight)) return true;
  if (style.position === 'absolute') {
    if (style.top !== undefined && style.bottom !== undefined) return true;
  } else if ((style.flex ?? 0) > 0 || (style.flexGrow ?? 0) > 0) {
    return true;
  }
  if (['padding', 'paddingVertical', 'paddingTop', 'paddingBottom']
    .some((clef) => positive(style[clef]))) return true;
  return enfantsHotes(noeud).some((enfant) => (
    styleDe(enfant).position !== 'absolute' && aUneHauteur(enfant)
  ));
};

/**
 * Les ancetres HOTES d'un noeud, du plus proche au plus lointain.
 * @param {any} noeud un noeud du rendu de test
 * @returns {any[]} ses ancetres hotes
 */
const ancetresHotes = (noeud) => {
  const liste = [];
  let courant = noeud.parent;
  while (courant) {
    if (typeof courant.type === 'string') liste.push(courant);
    courant = courant.parent;
  }
  return liste;
};

/**
 * Le bouton hote qui porte l'etiquette, dans l'en-tete de l'ecran AU-DESSUS.
 * @param {string} etiquette l'etiquette lue par le lecteur d'ecran
 * @returns {any} le noeud hote
 */
const boutonHote = (etiquette) => {
  const trouves = arbre.root.findAll((/** @type {any} */ n) => (
    typeof n.type === 'string' && n.props?.accessibilityLabel === etiquette
  ));
  return trouves[trouves.length - 1];
};

/**
 * Les boites hotes SANS hauteur entre un bouton et la racine — celles qui font
 * sauter le bouton aux outils d'accessibilite d'Android.
 * @param {string} etiquette l'etiquette du bouton
 * @returns {string[]} leur style, lisible
 */
const boitesNullesAuDessus = (etiquette) => ancetresHotes(boutonHote(etiquette))
  .filter((boite) => !aUneHauteur(boite))
  .map((boite) => JSON.stringify(styleDe(boite)));

beforeEach(() => {
  // Le telephone de la recette : Android, donc l'en-tete DANS la carte (« screen »).
  jest.replaceProperty(Platform, 'OS', 'android');
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  conteneur = null;
  jest.restoreAllMocks();
});

describe('FINITIONS13-STATS 1 — l en-tete transparent atteignable par les lecteurs d ecran', () => {
  it('la mesure porte bien sur le cas de la recette (sinon ce filet ne mesure rien)', () => {
    monterEtOuvrir();

    expect(conteneur.getRootState().routes.map((/** @type {any} */ r) => r.name))
      .toEqual(['Depart', 'Evenement']);
    expect(commonOptions.headerTransparent).toBe(true);
    // Les deux boutons existent, avec leur etiquette : ce n'est PAS un oubli d'etiquette.
    expect(boutonHote(SIGNALER)).toBeDefined();
    expect(boutonHote(RETOUR)).toBeDefined();
  });

  it('« Signaler l evenement » : aucune boite sans hauteur entre le bouton et la racine', () => {
    monterEtOuvrir();

    expect(boitesNullesAuDessus(SIGNALER)).toEqual([]);
  });

  it('« Retour » : aucune boite sans hauteur entre la fleche et la racine', () => {
    monterEtOuvrir();

    expect(boitesNullesAuDessus(RETOUR)).toEqual([]);
  });

  it('l apparence ne bouge pas : l en-tete ne prend aucune place, le contenu passe dessous', () => {
    monterEtOuvrir();

    // Le plus proche ancetre commun du bouton et du contenu de l'ecran : la carte.
    const ancetresBouton = ancetresHotes(boutonHote(SIGNALER));
    const texteContenu = arbre.root.findAll((/** @type {any} */ n) => (
      typeof n.type === 'string' && n.children.includes(CONTENU)
    ))[0];
    const ancetresContenu = new Set(ancetresHotes(texteContenu));
    const carte = ancetresBouton.find((boite) => ancetresContenu.has(boite));
    const branche = ancetresBouton[ancetresBouton.indexOf(carte) - 1];

    // La branche de l'en-tete, dans la carte : hors du flux (absolue), ou sans
    // hauteur — dans les deux cas le contenu commence tout en haut, sous l'en-tete.
    const horsDuFlux = styleDe(branche).position === 'absolute';
    expect(horsDuFlux || !aUneHauteur(branche)).toBe(true);
  });
});
