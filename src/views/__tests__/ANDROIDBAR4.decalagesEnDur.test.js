import fs from 'fs';
import path from 'path';

import { parse } from '@babel/parser';
import { HeaderHeightContext } from '@react-navigation/elements';
import {
  DeviceEventEmitter, ImageBackground, KeyboardAvoidingView, Platform, StyleSheet, Text, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ScreenContainer from '@/components/templates/ScreenContainer';

// 🤖 ANDROIDBAR-4 — les 7 formulaires qui posaient, DANS leur ScreenContainer, un
// `KeyboardAvoidingView` à décalage écrit en dur (`keyboardVerticalOffset={100}`).
//
// La règle de la maison (D23, ScreenContainer.js) : le décalage vaut la position ÉCRAN du parent
// de l'évitement — ici le contenu du ScreenContainer, posé sous l'en-tête (56 dp + la barre
// d'état sur Android, 44 + la barre d'état sur iPhone). « 100 » est ce calcul figé sur UN
// téléphone. Mesuré ici, avec le VRAI ScreenContainer et le VRAI KeyboardAvoidingView :
// - Android 15/16 (bord à bord) : clavier REFERMÉ, Android envoie la hauteur VISIBLE comme haut
//   du clavier (ReactRootView.java) ⇒ 20 dp de vide restent sous le formulaire ; clavier ouvert,
//   le bas passe 10 dp SOUS le clavier sur un Pixel 9 (barre d'état de 54 dp) ;
// - Android ≤ 14 : les mêmes 20 dp de vide une fois le clavier refermé ;
// - iPhone : 3 dp sous le clavier (iPhone 15) à 36 dp au-dessus (iPhone SE).
//
// Ce témoin LIT le code de chaque écran (le ScreenContainer du formulaire, son
// `keyboardAvoiding`, son décalage, sa marge verticale), REMONTE cette construction avec les
// vraies briques, et joue les charges qu'Android et iOS envoient réellement — géométrie mesurée
// à l'émulateur par ANDROIDBAR-3 (Pixel 9, Android 16, 3 boutons). Monter les 7 écrans demande
// serveur, session et club moqués ; leur construction, elle, se lit.
//
// 🤖 ANDROIDBAR-6 — trois formulaires de plus, dont l'évitement à décalage 0 (ou 0 sur Android,
// 100 sur iPhone) vit lui aussi DANS le ScreenContainer, sous l'en-tête : SquadEditScreen,
// CreateSectionScreen, FacilityForm. Calcul : ≈ 110 dp SOUS le clavier sur un Pixel 9 (en-tête
// 56 + barre d'état 54). Et un téléphone de plus, le clavier MESURÉ à la séance émulateur du
// 14/10 : Gboard affiche sa barre de suggestions, le haut du clavier est à 1541 px, pas 1657.

const RACINE = path.resolve(__dirname, '..', '..', '..');

const ECRANS = [
  'src/views/club/AddCoach.js',
  'src/views/club/AddSponsor.js',
  'src/views/club/ClubEdit.js',
  'src/views/event/EventEdit.js',
  'src/views/multisportClub/MultisportClubEditDetails.js',
  'src/views/profile/ProfileEdit.js',
  'src/views/team/TeamEdit.js',
  // ANDROIDBAR-6
  'src/views/facility/FacilityForm.js',
  'src/views/league/edit/SquadEditScreen.js',
  'src/views/multisportClub/CreateSectionScreen.js',
];

// Le seul formulaire qui ne pose aucune marge à son contenu (son défilement porte la sienne).
const SANS_MARGE = new Set(['src/views/league/edit/SquadEditScreen.js']);

const DENSITE = 2.625;
const ECRAN_PIXEL_9 = 2424 / DENSITE;
const HAUT_DU_CLAVIER_PIXEL_9 = 1657 / DENSITE;
const CLAVIER_PIXEL_9 = ECRAN_PIXEL_9 - HAUT_DU_CLAVIER_PIXEL_9 - 48;
// ANDROIDBAR-6 — mesuré le 14/10 (`ime frame=[0,1541][1080,2424]`, barre de suggestions de Gboard).
const CLAVIER_MESURE_PIXEL_9 = ECRAN_PIXEL_9 - 1541 / DENSITE - 48;

/** @type {{ bottom: number, left: number, right: number, top: number }} */
const mockInsets = {
  bottom: 0, left: 0, right: 0, top: 0,
};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Alignments: { fill: { flex: 1 }, grow1: { flexGrow: 1 } },
    Images: { bg1: 1, bg2: 2, bg3: 3 },
  }),
}));

jest.mock('@react-navigation/elements', () => ({
  // eslint-disable-next-line global-require
  HeaderHeightContext: require('react').createContext(0),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/navigation/commonOptions', () => ({
  getFloatingTabBarScenePaddingBottom: () => 134,
}));

// ─── Lecture du code de l'écran ──────────────────────────────────────────────

const CLES_IGNOREES = new Set([
  'comments', 'end', 'extra', 'innerComments', 'leadingComments', 'loc', 'start',
  'trailingComments',
]);

/**
 * Parcourt l'arbre et appelle `visiter(noeud)` sur chaque nœud.
 * @param {any} noeud
 * @param {(noeud: any) => void} visiter
 */
const parcourir = (noeud, visiter) => {
  if (!noeud || typeof noeud.type !== 'string') return;
  visiter(noeud);
  Object.keys(noeud).forEach((cle) => {
    if (CLES_IGNOREES.has(cle)) return;
    const valeur = noeud[cle];
    if (Array.isArray(valeur)) valeur.forEach((enfant) => parcourir(enfant, visiter));
    else if (valeur && typeof valeur === 'object') parcourir(valeur, visiter);
  });
};

/**
 * Les éléments JSX d'un nom donné sous un nœud.
 * @param {any} racine
 * @param {string} nom
 * @returns {any[]}
 */
const elements = (racine, nom) => {
  /** @type {any[]} */
  const trouves = [];
  parcourir(racine, (noeud) => {
    if (noeud.type === 'JSXElement' && noeud.openingElement.name.name === nom) trouves.push(noeud);
  });
  return trouves;
};

const attribut = (/** @type {any} */ element, /** @type {string} */ nom) => element
  .openingElement.attributes.find((/** @type {any} */ a) => a.name && a.name.name === nom);

/**
 * La construction du formulaire, telle que le code de l'écran l'écrit.
 * @param {string} relatif
 * @returns {{ evitementDuConteneur: boolean, decalages: Decalage[], marge: number }}
 */
const lireLaConstruction = (relatif) => {
  const arbre = parse(fs.readFileSync(path.join(RACINE, relatif), 'utf8'), {
    plugins: ['jsx'],
    sourceType: 'module',
  });
  // Le formulaire : le plus grand ScreenContainer du fichier (les autres sont des états
  // « chargement » / « introuvable » de quelques lignes).
  const [conteneur] = elements(arbre, 'ScreenContainer')
    .sort((a, b) => (b.end - b.start) - (a.end - a.start));
  if (!conteneur) throw new Error(`${relatif} : aucun ScreenContainer`);

  const evitement = attribut(conteneur, 'keyboardAvoiding');
  const evitementDuConteneur = Boolean(evitement) && (
    evitement.value === null
    || (evitement.value.expression && evitement.value.expression.value === true)
  );

  const decalages = elements(conteneur, 'KeyboardAvoidingView').map((kav) => {
    const decalage = attribut(kav, 'keyboardVerticalOffset');
    if (!decalage) return 0;
    const expression = decalage.value && decalage.value.expression;
    // ANDROIDBAR-6 — `Platform.OS === 'ios' ? 100 : 0` (FacilityForm) : un décalage par système.
    if (expression && expression.type === 'ConditionalExpression'
      && expression.test.type === 'BinaryExpression'
      && expression.test.right.value === 'ios'
      && expression.consequent.type === 'NumericLiteral'
      && expression.alternate.type === 'NumericLiteral') {
      return { android: expression.alternate.value, ios: expression.consequent.value };
    }
    if (!expression || expression.type !== 'NumericLiteral') {
      throw new Error(`${relatif} : décalage non lisible (${expression && expression.type})`);
    }
    return expression.value;
  });

  /** @type {number[]} */
  const marges = [];
  const style = attribut(conteneur, 'contentContainerStyle');
  parcourir(style, (noeud) => {
    if (noeud.type === 'MemberExpression' && noeud.computed
      && noeud.property.type === 'NumericLiteral'
      && noeud.object.type === 'MemberExpression'
      && noeud.object.property.name === 'paddingVertical') {
      marges.push(noeud.property.value);
    }
  });

  return { decalages, evitementDuConteneur, marge: marges[0] || 0 };
};

/** @typedef {number | { android: number, ios: number }} Decalage */

// ─── Les téléphones ──────────────────────────────────────────────────────────

/**
 * @typedef {object} Telephone
 * @property {string} nom
 * @property {'ios' | 'android'} os
 * @property {number | string} version `Platform.Version`.
 * @property {number} haut `insets.top` (barre d'état).
 * @property {number} bas `insets.bottom` (barre du bas).
 * @property {number} entete Hauteur de l'en-tête de la pile (`HeaderHeightContext`).
 * @property {number} fenetre Hauteur de la fenêtre, clavier fermé.
 * @property {number} fenetreClavierOuvert Hauteur de la fenêtre, clavier ouvert (Android ≤ 14 :
 *   `adjustResize` la rétrécit ; ailleurs elle ne bouge pas).
 * @property {number} hautDuClavier Haut du clavier dans les coordonnées de l'écran.
 * @property {any} ouverture La charge de l'événement d'ouverture.
 * @property {any} fermeture La charge de l'événement de fermeture.
 */

/**
 * Android 15/16, bord à bord : la fenêtre couvre tout l'écran.
 * @param {string} nom
 * @param {number} version
 * @param {number} barreDEtat
 * @param {number} barreDuBas
 * @param {number} [clavier] Hauteur du clavier sans la barre système (dp).
 * @returns {Telephone}
 */
const androidBordABord = (nom, version, barreDEtat, barreDuBas, clavier = CLAVIER_PIXEL_9) => ({
  bas: barreDuBas,
  entete: 56 + barreDEtat,
  fenetre: ECRAN_PIXEL_9,
  fenetreClavierOuvert: ECRAN_PIXEL_9,
  // Charges de ReactRootView.java : clavier SANS la barre système ; à la fermeture, la
  // hauteur VISIBLE (écran − barres) en guise de haut du clavier.
  fermeture: {
    height: 0, screenX: 0, screenY: ECRAN_PIXEL_9 - barreDuBas - barreDEtat, width: 411,
  },
  haut: barreDEtat,
  hautDuClavier: ECRAN_PIXEL_9 - clavier - barreDuBas,
  nom,
  os: 'android',
  ouverture: {
    height: clavier,
    screenX: 0,
    screenY: ECRAN_PIXEL_9 - clavier - barreDuBas,
    width: 411,
  },
  version,
});

/** Android ≤ 14 : barre d'état opaque (24 dp), 3 boutons, fenêtre rétrécie par `adjustResize`. */
const ANDROID_14 = /** @type {Telephone} */ ({
  bas: 0,
  entete: 56,
  fenetre: ECRAN_PIXEL_9 - 24 - 48,
  fenetreClavierOuvert: HAUT_DU_CLAVIER_PIXEL_9 - 24,
  // L'événement porte des coordonnées d'ÉCRAN ; la vue racine, elle, commence sous la barre
  // d'état (24 dp plus bas) — c'est ce que voit le KeyboardAvoidingView.
  fermeture: {
    height: 0, screenX: 0, screenY: ECRAN_PIXEL_9 - 24 - 48, width: 411,
  },
  haut: 0,
  hautDuClavier: HAUT_DU_CLAVIER_PIXEL_9 - 24,
  nom: 'Android 14, 3 boutons',
  os: 'android',
  ouverture: {
    height: CLAVIER_PIXEL_9, screenX: 0, screenY: HAUT_DU_CLAVIER_PIXEL_9, width: 411,
  },
  version: 34,
});

/**
 * iPhone : la fenêtre couvre l'écran, la barre du bas est sous le clavier.
 * @param {string} nom
 * @param {number} ecran
 * @param {number} barreDEtat
 * @param {number} barreDuBas
 * @param {number} clavier Hauteur du clavier (avec la zone du bas).
 * @returns {Telephone}
 */
const iphone = (nom, ecran, barreDEtat, barreDuBas, clavier) => ({
  bas: barreDuBas,
  entete: 44 + barreDEtat,
  fenetre: ecran,
  fenetreClavierOuvert: ecran,
  fermeture: {
    height: 0, screenX: 0, screenY: ecran, width: 393,
  },
  haut: barreDEtat,
  hautDuClavier: ecran - clavier,
  nom,
  os: 'ios',
  ouverture: {
    height: clavier, screenX: 0, screenY: ecran - clavier, width: 393,
  },
  version: '18.0',
});

const ANDROID_15_16 = [
  androidBordABord('Android 16, Pixel 9, 3 boutons', 36, 142 / DENSITE, 48),
  androidBordABord(
    'Android 16, Pixel 9, 3 boutons, clavier mesuré 1541 px',
    36,
    142 / DENSITE,
    48,
    CLAVIER_MESURE_PIXEL_9,
  ),
  androidBordABord('Android 15, Pixel 9, gestes', 35, 142 / DENSITE, 24),
  androidBordABord('Android 15, barre d état 24 dp, 3 boutons', 35, 24, 48),
];
const IPHONES = [
  iphone('iPhone 15', 852, 59, 34, 336),
  iphone('iPhone SE', 667, 20, 0, 260),
];

const OS_D_ORIGINE = Platform.OS;
const VERSION_D_ORIGINE = /** @type {PropertyDescriptor} */ (
  Object.getOwnPropertyDescriptor(Platform, 'Version')
);

afterEach(() => {
  act(() => {
    DeviceEventEmitter.emit('keyboardDidHide');
    DeviceEventEmitter.emit('keyboardWillHide');
  });
  Platform.OS = OS_D_ORIGINE;
  Object.defineProperty(Platform, 'Version', VERSION_D_ORIGINE);
});

// ─── La mesure ───────────────────────────────────────────────────────────────

const lire = (/** @type {any} */ style, /** @type {'Top' | 'Bottom'} */ cote) => {
  const s = StyleSheet.flatten(style) || {};
  return s[`padding${cote}`] ?? s.paddingVertical ?? s.padding ?? 0;
};

/**
 * Remonte la construction de l'écran sur un téléphone et joue ouverture puis fermeture.
 * @param {{ evitementDuConteneur: boolean, decalages: Decalage[], marge: number }} construction
 * @param {Telephone} tel
 * @returns {Promise<{ ferme: number, ouvert: number, referme: number }>} y (dp, coordonnées de
 *   la vue racine) du bas du formulaire — là où s'arrêtent ses boutons.
 */
const jouer = async (construction, tel) => {
  Platform.OS = /** @type {any} */ (tel.os);
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => tel.version });
  mockInsets.top = tel.haut;
  mockInsets.bottom = tel.bas;
  let { fenetre } = tel;

  const formulaire = (/** @type {any} */ decalage) => (decalage === undefined ? (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <Text>formulaire</Text>
    </View>
  ) : (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={decalage}
      style={{ flex: 1, justifyContent: 'space-between' }}
      testID="evitement-de-l-ecran"
    >
      <Text>formulaire</Text>
    </KeyboardAvoidingView>
  ));

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <HeaderHeightContext.Provider value={tel.entete}>
        <ScreenContainer
          contentContainerStyle={[{ paddingVertical: construction.marge }]}
          keyboardAvoiding={construction.evitementDuConteneur}
        >
          {formulaire(typeof construction.decalages[0] === 'object'
            ? construction.decalages[0][tel.os]
            : construction.decalages[0])}
        </ScreenContainer>
      </HeaderHeightContext.Provider>,
    );
  });

  // Les vues hôtes du fond de l'écran jusqu'au formulaire, de l'extérieur vers l'intérieur.
  const chemin = () => {
    const vues = [];
    let noeud = arbre.root.findByType(Text).parent;
    while (noeud && noeud.type !== ImageBackground) {
      if (typeof noeud.type === 'string') vues.unshift(noeud);
      noeud = noeud.parent;
    }
    return vues;
  };

  // Le bas du formulaire : chaque vue part du haut de son parent et remplit sa hauteur, sauf
  // si l'évitement lui impose une hauteur ; on retire les marges basses rencontrées.
  const basDuFormulaire = () => {
    let haut = 0;
    let bas = fenetre;
    chemin().forEach((vue) => {
      const style = StyleSheet.flatten(vue.props.style) || {};
      if (style.height !== undefined) bas = haut + style.height;
      haut += lire(style, 'Top');
      bas -= lire(style, 'Bottom');
    });
    return bas;
  };

  // L'appareil renvoie une mesure à chaque changement de hauteur : on la rejoue pour chaque
  // KeyboardAvoidingView (le seul qui la lise), avec son cadre DANS SON PARENT.
  // L'émetteur n'attend pas la promesse de l'évitement (`_updateBottomIfNecessary`) : on vide
  // la file avant de lire, sinon la lecture a un pas de retard (vu au 1er passage du banc).
  const vider = () => act(async () => {
    await new Promise((fin) => { setImmediate(fin); });
  });

  const mesurer = async () => {
    const evitements = arbre.root.findAllByType(KeyboardAvoidingView);
    // eslint-disable-next-line no-restricted-syntax
    for (const evitement of evitements) {
      const vue = evitement.findAllByType(View)[0];
      const style = StyleSheet.flatten(vue.props.style) || {};
      const duConteneur = evitement.props.testID !== 'evitement-de-l-ecran';
      // Cadre dans le parent : l'évitement du conteneur part sous l'en-tête ; celui de
      // l'écran part sous la marge haute du contenu.
      const y = duConteneur ? tel.entete : construction.marge;
      const hauteurNaturelle = duConteneur
        ? fenetre - tel.entete - tel.bas
        : fenetre - tel.entete - tel.bas - 2 * construction.marge;
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        // eslint-disable-next-line no-underscore-dangle
        await evitement.instance._onLayout({
          nativeEvent: {
            layout: {
              height: style.height === undefined ? hauteurNaturelle : style.height,
              width: 411,
              x: 0,
              y,
            },
          },
          persist: () => {},
        });
      });
    }
    await vider();
  };

  const evenement = async (/** @type {'Show' | 'Hide'} */ sens, /** @type {any} */ charge) => {
    await act(async () => {
      DeviceEventEmitter.emit(`keyboard${tel.os === 'ios' ? 'Will' : 'Did'}${sens}`, {
        duration: 0,
        easing: 'keyboard',
        endCoordinates: charge,
      });
    });
    await vider();
  };

  await mesurer();
  const ferme = basDuFormulaire();

  // Android ≤ 14 : la fenêtre rétrécit AVANT que l'événement arrive (ANDROIDBAR-1).
  fenetre = tel.fenetreClavierOuvert;
  await mesurer();
  await evenement('Show', tel.ouverture);
  await mesurer();
  await mesurer();
  const ouvert = basDuFormulaire();

  fenetre = tel.fenetre;
  await mesurer();
  await evenement('Hide', tel.fermeture);
  await mesurer();
  await mesurer();
  const referme = basDuFormulaire();

  act(() => arbre.unmount());
  return { ferme, ouvert, referme };
};

/** @type {any[]} */
const releves = [];

afterAll(() => {
  // Banc : `ANDROIDBAR4_BANC=<fichier>` écrit les mesures (aucun effet en porte).
  if (process.env.ANDROIDBAR4_BANC) {
    fs.writeFileSync(process.env.ANDROIDBAR4_BANC, JSON.stringify(releves, null, 2));
  }
});

describe.each(ECRANS)('ANDROIDBAR-4 — %s', (relatif) => {
  const construction = lireLaConstruction(relatif);

  it('la construction se lit : une marge verticale, au plus un évitement', () => {
    if (SANS_MARGE.has(relatif)) expect(construction.marge).toBe(0);
    else expect(construction.marge).toBeGreaterThan(0);
    expect(construction.decalages.length).toBeLessThanOrEqual(1);
  });

  it.each(ANDROID_15_16.map((tel) => [tel.nom, tel]))(
    '%s : clavier ouvert, le bas du formulaire s arrête au clavier ; refermé, aucun vide',
    async (_nom, tel) => {
      const mesure = await jouer(construction, tel);
      releves.push({
        ecran: relatif, telephone: tel.nom, ...mesure, clavier: tel.hautDuClavier,
      });

      expect(mesure.ouvert).toBeLessThanOrEqual(tel.hautDuClavier + 0.01);
      // Pas d'autre trou que la marge basse que l'écran garde déjà.
      expect(tel.hautDuClavier - mesure.ouvert).toBeLessThanOrEqual(construction.marge + 0.01);
      expect(mesure.referme).toBeCloseTo(mesure.ferme, 5);
    },
  );

  it(`${ANDROID_14.nom} : clavier ouvert au-dessus du clavier ; refermé, aucun vide`, async () => {
    const mesure = await jouer(construction, ANDROID_14);
    releves.push({
      ecran: relatif, telephone: ANDROID_14.nom, ...mesure, clavier: ANDROID_14.hautDuClavier,
    });

    expect(mesure.ouvert).toBeLessThanOrEqual(ANDROID_14.hautDuClavier + 0.01);
    expect(mesure.referme).toBeCloseTo(mesure.ferme, 5);
  });

  it.each(IPHONES.map((tel) => [tel.nom, tel]))(
    '%s (caractérisation) : fermé comme avant ; ouvert, jamais plus de 6 dp sous le clavier',
    async (_nom, tel) => {
      const mesure = await jouer(construction, tel);
      releves.push({
        ecran: relatif, telephone: tel.nom, ...mesure, clavier: tel.hautDuClavier,
      });

      expect(mesure.ferme).toBeCloseTo(tel.fenetre - tel.bas - construction.marge, 5);
      expect(mesure.ouvert).toBeLessThanOrEqual(tel.hautDuClavier + 6);
      expect(mesure.referme).toBeCloseTo(mesure.ferme, 5);
    },
  );
});
