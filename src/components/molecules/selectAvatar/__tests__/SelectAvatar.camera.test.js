import { createElement } from 'react';
import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { captureRef } from 'react-native-view-shot';

import SelectAvatar from '../SelectAvatar';

// Filet D36 — POURQUOI UNE PHOTO PRISE A LA CAMERA N'ARRIVE PAS, ALORS QUE LA
// GALERIE MARCHE.
//
// Motif : recette d'Adel du 2026-08-07, « les photos de profil prises avec la
// camera ne chargent pas ». La galerie n'est pas citee — et c'est l'indice :
// les DEUX chemins partent du meme composant et rendent la meme forme de
// charge (mesure faite dans react-native-image-picker 7.2.3 : sur iOS, camera
// et galerie passent toutes les deux par `mapImageToAsset`, donc `file://…`
// des deux cotes). La seule difference entre les deux, c'est le
// post-traitement C01 : le de-miroir du selfie par `captureRef`.
//
// Ce fichier CARACTERISE le composant partage par HUIT ecrans (UserAvatar,
// ProfileEdit, ClubEdit, AddCoach, AddSponsor, MultisportClubEditDetails,
// SquadImageStep x2) : ce qui est corrige ici est corrige pour les huit.
//
// ⚠️ CE QU'IL NE PROUVE PAS, et il faut le dire : Jest n'a pas d'appareil
// photo et pas de moteur de rendu natif. Il ne peut pas constater qu'une
// capture est BLANCHE. Il lit ce que le composant EMET et les CONTRAINTES
// qu'il pose sur l'arbre. Le pixel, lui, se constate sur un telephone.

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));

// Le composant passe par `@/platform/media`, l'aiguillage deja en place dans le
// depot. On double la BIBLIOTHEQUE, pas l'aiguillage : le cablage reel est donc
// exerce par le test. `@react-native-documents/picker` est importe par le meme
// module — il doit etre double lui aussi, sinon le chargement echoue.
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

jest.mock('@react-native-documents/picker', () => ({ pick: jest.fn() }));

// La feuille du bas est doublee : on n'observe pas l'animation, on observe ce
// que les deux boutons declenchent.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: (/** @type {any} */ props) => (props.isVisible
      ? reactActuel.createElement(VueRN, { testID: 'feuille' }, props.children)
      : null),
  };
});

// Doublure de Button : un pressable qui PORTE son titre, pour retrouver les
// deux entrees sans dependre de la forme interne de l'atome.
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return {
    __esModule: true,
    default: (/** @type {any} */ props) => reactActuel.createElement(
      PressableRN,
      { onPress: props.onPress, testID: `bouton-${props.title}` },
      reactActuel.createElement(TexteRN, null, props.title),
    ),
  };
});

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
      Images: { camera: 1, plus: 2, trash: 3 },
      Spaces: espaces,
    }),
  };
});

const { launchCamera, launchImageLibrary } = jest.requireMock('react-native-image-picker');

// La charge que rend react-native-image-picker 7.2.3 sur iOS — IDENTIQUE en
// forme pour la camera et pour la galerie (mesure : ImagePickerManager.mm,
// `mapImageToAsset` est appelee par les deux delegues).
const CHARGE_CAMERA = {
  assets: [{
    fileName: 'photo-camera.jpg',
    fileSize: 812_345,
    height: 1000,
    type: 'image/jpeg',
    uri: 'file:///tmp/rn_image_picker_lib_temp_camera.jpg',
    width: 1000,
  }],
};

const CHARGE_GALERIE = {
  assets: [{
    fileName: 'photo-galerie.jpg',
    fileSize: 654_321,
    height: 800,
    type: 'image/jpeg',
    uri: 'file:///tmp/rn_image_picker_lib_temp_galerie.jpg',
    width: 800,
  }],
};

// Ce que `captureRef` rend reellement : un fichier temporaire PNG. Sur iOS un
// chemin NU (RNViewShot.mm l.173 `res = path`), sur Android une URL `file://`
// (ViewShot.java l.243 `Uri.fromFile`). Le format, lui, est PNG des deux cotes.
const URI_CAPTURE = '/var/mobile/tmp/ReactNative/capture-flip.png';

/**
 * Aplatit un style RN (tableau, valeurs nulles) en un seul objet.
 * @param {any} style Style tel que passe au composant.
 * @returns {Record<string, any>} Le style resolu.
 */
const styleAplati = (style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((acc, part) => ({ ...acc, ...styleAplati(part) }), {})
  : (style || {}));

/** @type {any} */
let arbre;
/** @type {jest.Mock} */
let avatarChoisi;
/** @type {jest.SpyInstance} */
let alerte;

/**
 * Monte le composant et ouvre la feuille des deux entrees.
 * @returns {void}
 */
const monterEtOuvrirLaFeuille = () => {
  act(() => {
    arbre = renderer.create(createElement(SelectAvatar, {
      currentAvatar: undefined,
      onAvatarSelected: avatarChoisi,
    }));
  });

  const bascule = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.accessibilityLabel === 'common.actions.photoFromGallery'
    && typeof noeud.props?.onPress === 'function'
  )).pop();

  act(() => { bascule.props.onPress(); });
};

/**
 * Vide la file des micro-taches. `takePicture` enchaine un `import()`
 * dynamique, puis l'appel a la bibliotheque, puis un `setState` : chaque
 * maillon consomme un tour, il en faut donc plusieurs.
 * @returns {Promise<void>} Rien.
 */
const viderLaFileMicro = async () => {
  for (let tour = 0; tour < 8; tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

/**
 * Appuie sur une des deux entrees et laisse la chaine asynchrone se derouler.
 * @param {string} titre Cle de traduction portee par le bouton.
 * @returns {Promise<void>} Rien — l'observation se fait sur les espions.
 */
const appuyerSur = async (titre) => {
  const bouton = arbre.root.findAll((/** @type {any} */ noeud) => (
    noeud.props?.testID === `bouton-${titre}`
    && typeof noeud.props?.onPress === 'function'
  )).pop();

  // On ne peut pas attendre `onPress()` : sur le chemin camera, la promesse
  // du de-miroir ne se resout qu'au `onLoad` de l'image cachee.
  await act(async () => {
    bouton.props.onPress();
    await viderLaFileMicro();
  });
};

/**
 * Retrouve la vue cachee qui sert de source a la capture C01.
 * @returns {any} Le noeud, ou undefined si le de-miroir n'est pas en cours.
 */
const sourceDeCapture = () => arbre.root.findAll((/** @type {any} */ noeud) => (
  noeud.props?.collapsable === false && noeud.props?.pointerEvents === 'none'
)).pop();

/**
 * Declenche le `onLoad` de l'image retournee : c'est lui qui lance `captureRef`.
 * @returns {Promise<void>} Rien.
 */
const laisserLaCaptureSeFaire = async () => {
  const imageRetournee = arbre.root.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onLoad === 'function',
  ).pop();

  await act(async () => {
    await imageRetournee.props.onLoad();
    await viderLaFileMicro();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  avatarChoisi = jest.fn();
  alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  launchCamera.mockResolvedValue(CHARGE_CAMERA);
  launchImageLibrary.mockResolvedValue(CHARGE_GALERIE);
  captureRef.mockResolvedValue(URI_CAPTURE);
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  alerte.mockRestore();
  jest.useRealTimers();
});

describe('D36 — la photo prise a la CAMERA', () => {
  // 🥇 TEMOIN D'ARRET N°1 : une photo prise a la camera doit arriver, et
  // arriver en se decrivant HONNETEMENT. Le de-miroir C01 reecrit le fichier en
  // PNG mais laissait la charge annoncer `image/jpeg` et un nom en `.jpg` :
  // l'app envoyait alors un PNG etiquete JPEG.
  it('remonte la photo capturee, decrite pour ce qu elle est', async () => {
    monterEtOuvrirLaFeuille();
    await appuyerSur('common.actions.photoFromCamera');
    await laisserLaCaptureSeFaire();

    expect(avatarChoisi).toHaveBeenCalledTimes(1);

    const envoye = avatarChoisi.mock.calls[0][0];
    expect(envoye.path).toBe(URI_CAPTURE);
    expect(envoye.uri).toBe(URI_CAPTURE);
    // Le fichier capture est un PNG : la charge doit le dire.
    expect(envoye.mime).toBe('image/png');
    expect(envoye.filename).toMatch(/\.png$/);
    // La taille de la photo D'ORIGINE ne decrit plus le fichier envoye.
    expect(envoye.size).toBeUndefined();
  });

  // 🥇 TEMOIN D'ARRET N°2 : la GALERIE doit continuer de marcher a l'identique,
  // sinon on a deplace le probleme au lieu de le corriger.
  it('laisse la GALERIE intacte : aucune capture, charge inchangee', async () => {
    monterEtOuvrirLaFeuille();
    await appuyerSur('common.actions.photoFromGallery');

    expect(captureRef).not.toHaveBeenCalled();
    expect(avatarChoisi).toHaveBeenCalledTimes(1);
    expect(avatarChoisi.mock.calls[0][0]).toEqual({
      filename: 'photo-galerie.jpg',
      height: 800,
      mime: 'image/jpeg',
      path: 'file:///tmp/rn_image_picker_lib_temp_galerie.jpg',
      size: 654_321,
      uri: 'file:///tmp/rn_image_picker_lib_temp_galerie.jpg',
      url: '',
      width: 800,
    });
  });

  // 🎯 LA CAUSE RACINE, lue comme une contrainte sur l'arbre.
  // `captureRef` capture par `drawViewHierarchyInRect` (RNViewShot.mm l.122) :
  // c'est un instantane de ce qui est VISIBLE. Une source a `opacity: 0` rend
  // une image entierement transparente — et la bibliotheque annonce quand meme
  // un succes (son propre commentaire, l.121 : « reports incorrect success even
  // though the image is blank »). La photo etait donc remplacee par du vide.
  it('rend la source de la capture au lieu de la masquer par transparence', async () => {
    monterEtOuvrirLaFeuille();
    await appuyerSur('common.actions.photoFromCamera');

    const source = sourceDeCapture();
    expect(source).toBeDefined();

    const style = styleAplati(source.props.style);
    // Une source transparente se capture en blanc.
    expect(style.opacity).not.toBe(0);
    // Elle reste invisible en sortant de l'ecran, pas en s'effacant.
    expect(Math.min(style.left ?? 0, style.top ?? 0)).toBeLessThanOrEqual(-1000);
  });

  // ⛔ AUCUN ECHEC MUET : une charge sans photo, sans annulation et sans code
  // d'erreur ne laissait RIEN a l'ecran — l'utilisateur croyait avoir rate son
  // geste.
  it('previent a l ecran quand la camera ne rend aucune photo', async () => {
    launchCamera.mockResolvedValue({});

    monterEtOuvrirLaFeuille();
    await appuyerSur('common.actions.photoFromCamera');

    expect(avatarChoisi).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledTimes(1);
  });

  // ⛔ Un refus doit se lire. Sur simulateur iOS, `launchCamera` rend
  // `{errorCode: 'camera_unavailable'}` SANS `errorMessage`
  // (ImagePickerManager.mm l.70) : le message affiche se terminait par
  // « undefined ».
  it('affiche un refus lisible meme sans message de la bibliotheque', async () => {
    launchCamera.mockResolvedValue({ errorCode: 'camera_unavailable' });

    monterEtOuvrirLaFeuille();
    await appuyerSur('common.actions.photoFromCamera');

    expect(avatarChoisi).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(alerte.mock.calls[0])).not.toContain('undefined');
  });

  // 🛟 LE REPLI NE DETRUIT JAMAIS LA PHOTO : si le de-miroir echoue, on garde
  // la photo d'origine (miroir compris) plutot que rien.
  it('garde la photo d origine quand le de-miroir echoue', async () => {
    captureRef.mockRejectedValue(new Error('capture impossible'));

    monterEtOuvrirLaFeuille();
    await appuyerSur('common.actions.photoFromCamera');
    await laisserLaCaptureSeFaire();

    expect(avatarChoisi).toHaveBeenCalledTimes(1);
    expect(avatarChoisi.mock.calls[0][0].path)
      .toBe('file:///tmp/rn_image_picker_lib_temp_camera.jpg');
    expect(avatarChoisi.mock.calls[0][0].mime).toBe('image/jpeg');
  });
});
