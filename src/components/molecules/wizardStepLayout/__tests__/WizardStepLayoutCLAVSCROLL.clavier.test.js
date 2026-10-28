import { createElement } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import WizardStepLayout from '../WizardStepLayout';

// ⌨️ CLAVSCROLL — LE CHAMP DISPARAÎT VERS LE HAUT QUAND LE CLAVIER S'OUVRE (iPhone).
//
// CONSTATÉ par Adel le 28/10/2026 17:16, TestFlight 2.6.83, iPhone (852 pt, clavier 336 pt) :
// « Créer une équipe », étape 1/8. Clavier ouvert, le club, le libellé et le CHAMP sortent par
// le haut ; restent le titre, les suggestions et « Suivant ». Captures :
// `.local/bancs/CLAVSCROLL-20261028/AVANT-clavier-{ouvert,ferme}.webp`.
//
// LA CAUSE — deux compensations du même clavier sur le même chemin :
// 1. ScreenContainer `keyboardAvoiding` (posé par ANDROIDBAR-6) : un KeyboardAvoidingView
//    `padding` À L'ÉCRAN, qui rétrécit tout le gabarit de la hauteur du clavier ;
// 2. le ScrollView du gabarit `automaticallyAdjustKeyboardInsets` : à `keyboardWillChangeFrame`
//    (RCTScrollViewComponentView.mm, React Native 0.81), iOS pose `contentInset.bottom =
//    bas du ScrollView − haut du clavier`, mesuré sur le cadre AVANT que l'évitement ne le
//    rétrécisse. Le clavier est donc compté deux fois : la zone visible (cadre − retrait)
//    devient NÉGATIVE, et iOS, en ramenant le champ actif « dans le visible », le pousse
//    au-dessus du haut de la liste.
//
// Ce témoin monte le VRAI gabarit, lit ce qu'il rend (évitement, retrait automatique), puis
// rejoue l'algorithme natif d'iOS sur la géométrie RELEVÉE sur la capture d'Adel (2,347 px par
// point). Le modèle redonne le décalage mesuré : 205 pt calculés, 197 pt constatés (le haut des
// suggestions passe de 1057 px à 595 px). Jest n'a ni mise en page ni clavier : le rendu réel
// se constate sur l'iPhone.

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 34, left: 0, right: 0, top: 59,
};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
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
      Images: {
        arrowLeft: 1, bg1: 1, bg2: 2, bg3: 3, close: 2,
      },
      Spaces: espaces,
    }),
  };
});

jest.mock('@react-navigation/elements', () => ({
  // eslint-disable-next-line global-require
  HeaderHeightContext: require('react').createContext(0),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingTabBarScenePaddingBottom: () => 134,
}));

// ─── Géométrie relevée sur la capture (points, coordonnées de l'écran) ────────────────────

const ECRAN = 852;
const CLAVIER = 336;
const HAUT_DU_CLAVIER = ECRAN - CLAVIER;
// Haut de la liste (pastille du club) : 595 px.
const HAUT_DE_LA_LISTE = 253;
// Haut de « Suivant », clavier fermé : 1780 px ; la liste s'arrête 16 pt au-dessus.
const BAS_DE_LA_LISTE_FERME = 742;
// Écart entre la liste et « Suivant » (marginTop du bloc d'actions).
const ECART_LISTE_SUIVANT = 16;
// Le champ, dans le contenu de la liste : libellé 727 px, trait du champ 903 px.
const CHAMP = { bas: 132, haut: 57 };
// Bas des suggestions 1148 px, + 16 de marge basse du contenu.
const HAUTEUR_DU_CONTENU = 252;

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

afterEach(() => {
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
});

/**
 * Monte le vrai gabarit et lit les deux compensations du clavier qu'il rend.
 * @param {'ios' | 'android'} os
 * @param {number | string} version
 * @returns {{ evitementPadding: boolean, retraitAuto: boolean, retraitAndroid: boolean }}
 */
const lireLesCompensations = (os, version) => {
  Platform.OS = /** @type {any} */ (os);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      WizardStepLayout,
      {
        onNext: () => {}, stepCount: 8, stepIndex: 1, title: "Nom de l'équipe",
      },
      createElement(TextInput, { placeholder: 'Ex. : U15 Filles' }),
    ));
  });
  const [liste] = arbre.root.findAllByType(ScrollView);
  const evitements = arbre.root.findAllByType(KeyboardAvoidingView);
  // Android 15+ : l'évitement du ScreenContainer est une marge basse qui suit le clavier.
  const retraitAndroid = arbre.root.findAll((/** @type {any} */ n) => typeof n.type === 'string'
    && Object.prototype.hasOwnProperty.call(StyleSheet.flatten(n.props.style) || {}, 'paddingBottom')
    && n.findAllByType(ScrollView).length > 0
    && !n.findAllByType(KeyboardAvoidingView).length).length > 0;
  const resultat = {
    evitementPadding: evitements.some((e) => e.props.behavior === 'padding'),
    retraitAuto: Boolean(liste.props.automaticallyAdjustKeyboardInsets),
    retraitAndroid,
  };
  act(() => arbre.unmount());
  return resultat;
};

/**
 * Rejoue iOS : `_keyboardWillChangeFrame` (cadre d'AVANT l'évitement), puis l'évitement
 * rétrécit la liste, puis UIKit ramène le champ actif dans la zone visible (cadre − retrait).
 * Sur Android, `automaticallyAdjustKeyboardInsets` n'existe pas : retrait nul.
 * @param {{ evitementPadding: boolean, retraitAuto: boolean }} c
 * @param {'ios' | 'android'} os
 * @returns {{ champBas: number, champHaut: number, hautDeSuivant: number, visible: number }}
 *   en points, coordonnées de l'écran, clavier ouvert.
 */
const ouvrirLeClavier = (c, os) => {
  const retrait = os === 'ios' && c.retraitAuto
    ? Math.max(BAS_DE_LA_LISTE_FERME - HAUT_DU_CLAVIER, 0)
    : 0;
  // L'évitement remonte le bas du gabarit au haut du clavier (marge basse comprise : 34 + 12
  // sous « Suivant » clavier fermé, 0 ouvert — le relevé donne 406, l'arrondi est sans effet).
  const basDeLaListe = BAS_DE_LA_LISTE_FERME - CLAVIER;
  const cadre = basDeLaListe - HAUT_DE_LA_LISTE;
  const visible = cadre - retrait;
  const decalageMax = Math.max(0, HAUTEUR_DU_CONTENU + retrait - cadre);
  let decalage = 0;
  if (CHAMP.bas > decalage + visible) decalage = Math.min(CHAMP.bas - visible, decalageMax);
  return {
    champBas: HAUT_DE_LA_LISTE + CHAMP.bas - decalage,
    champHaut: HAUT_DE_LA_LISTE + CHAMP.haut - decalage,
    hautDeSuivant: basDeLaListe + ECART_LISTE_SUIVANT,
    visible,
  };
};

describe('CLAVSCROLL — clavier ouvert, le champ touché reste visible et « Suivant » accessible', () => {
  it('iPhone 852 pt, clavier 336 pt : un seul évitement, le champ entre la liste et le clavier', () => {
    const c = lireLesCompensations('ios', '18.0');
    expect(c.evitementPadding).toBe(true);

    const ecran = ouvrirLeClavier(c, 'ios');
    expect(ecran.champHaut).toBeGreaterThanOrEqual(HAUT_DE_LA_LISTE);
    expect(ecran.champBas).toBeLessThanOrEqual(HAUT_DU_CLAVIER);
    expect(ecran.visible).toBeGreaterThan(0);
    expect(ecran.hautDeSuivant).toBeLessThan(HAUT_DU_CLAVIER);
    // Le clavier n'est compté qu'une fois : l'évitement de l'écran, pas de retrait en plus.
    expect(c.retraitAuto).toBe(false);
  });

  it('Android 15+ : marge basse du conteneur seulement, le champ et « Suivant » restent visibles', () => {
    const c = lireLesCompensations('android', 35);
    expect(c.evitementPadding).toBe(false);
    expect(c.retraitAndroid).toBe(true);

    const ecran = ouvrirLeClavier(c, 'android');
    expect(ecran.champHaut).toBeGreaterThanOrEqual(HAUT_DE_LA_LISTE);
    expect(ecran.champBas).toBeLessThanOrEqual(HAUT_DU_CLAVIER);
    expect(ecran.hautDeSuivant).toBeLessThan(HAUT_DU_CLAVIER);
  });
});
