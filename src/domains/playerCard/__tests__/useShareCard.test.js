// @ts-nocheck
/**
 * app/src/domains/playerCard/__tests__/useShareCard.test.js
 *
 * L27 (E6) : useShareCard.js n'avait AUCUN test alors qu'il porte le geste le
 * plus visible de la carte joueur. Ce fichier a d'abord CARACTERISE le
 * comportement livre, puis verrouille la correction.
 *
 * CARACTERISATION E6, ecrite AVANT la correction et VERTE sur le code livre :
 *   « sur Android, l'image capturee est confiee a Share.share, et rien ne
 *     l'enregistre ni ne l'ouvre » -> Share.share appele avec
 *     { message, title, url }, et copyToMediaStore / actionViewIntent jamais
 *     appeles ; shareCard rendait le chemin du fichier capture.
 * RN 0.78 (node_modules/react-native/Libraries/Share/Share.js l.91-104) PURGE
 * `url` sur Android : l'utilisateur croyait partager sa carte, seul le texte
 * partait. Les tests ci-dessous sont l'exacte inversion de cette caracterisation.
 *
 * Ce qui est mocke : la frontiere plateforme uniquement (react-native,
 * react-native-view-shot, react-native-blob-util, camera-roll). Le chemin reel
 * shareCard -> shareLocalFile -> OS est donc reellement observe.
 */

import { createElement } from 'react';
import { PermissionsAndroid, Platform, Share } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import renderer, { act } from 'react-test-renderer';

import { FILE_SHARE_FAILURES, FILE_SHARE_OUTCOMES } from '../../../platform/share/fileShareContract';
import useShareCard, { CARD_SHARE_FILE_NAME } from '../useShareCard';

jest.mock('react-native', () => ({
  PermissionsAndroid: {
    PERMISSIONS: { WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE' },
    request: jest.fn(),
    RESULTS: { DENIED: 'denied', GRANTED: 'granted' },
  },
  // Platform.OS et Platform.Version sont mutes test par test : toute la decision
  // du lot en depend (iOS/web = feuille de partage, Android = enregistrer puis ouvrir).
  Platform: { OS: 'ios', Version: 34 },
  Share: { share: jest.fn() },
}));

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));

jest.mock('@react-native-camera-roll/camera-roll', () => ({
  CameraRoll: { saveAsset: jest.fn() },
}));

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    android: { actionViewIntent: jest.fn(), addCompleteDownload: jest.fn() },
    MediaCollection: { copyToMediaStore: jest.fn() },
  },
}));

// PlayerCard tire les SVG et le logo : seul CARD_FORMATS est utile ici.
jest.mock('@/components/organisms/playerCard/PlayerCard', () => ({
  CARD_FORMATS: { square: { height: 1262, key: 'square', width: 992 } },
}));

const { captureRef } = jest.requireMock('react-native-view-shot');

const FICHIER_CAPTURE = 'file:///data/cache/ReactNative-snapshot-image1.png';
const CHEMIN_NU = '/data/cache/ReactNative-snapshot-image1.png';
const CHARGE = {
  dialogTitle: 'Ouvrir ta carte avec…',
  message: 'Voici ma carte FoundClub.',
  title: 'Zinedine Zidane',
};

/**
 * Monte le hook dans une sonde sans rendu : les fonctions rendues sont stables
 * (useCallback), donc la boite reste valide entre les rendus provoques par
 * setIsBusy.
 * @returns {any}
 */
const monterHook = () => {
  const boite = {};
  /**
   * Composant sans rendu : il n'existe que pour executer le hook.
   * @returns {null}
   */
  function Sonde() {
    Object.assign(boite, useShareCard());
    return null;
  }
  act(() => {
    renderer.create(createElement(Sonde));
  });
  return boite;
};

/**
 * Execute un geste du hook dans un `act` et capture son issue, sans laisser
 * echapper de rejet non traite.
 * @param {() => Promise<any>} geste
 * @returns {Promise<{ erreur: any, resultat: any }>}
 */
const executer = async (geste) => {
  let resultat;
  let erreur;
  await act(async () => {
    try {
      resultat = await geste();
    } catch (e) {
      erreur = e;
    }
  });
  return { erreur, resultat };
};

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
  Platform.Version = 34;
  captureRef.mockResolvedValue(FICHIER_CAPTURE);
  Share.share.mockResolvedValue({ action: 'sharedAction' });
  PermissionsAndroid.request.mockResolvedValue('granted');
  ReactNativeBlobUtil.MediaCollection.copyToMediaStore.mockResolvedValue('content://media/1');
  ReactNativeBlobUtil.android.actionViewIntent.mockResolvedValue(true);
});

describe('L27 — le defaut caracterise (E6) ne peut plus revenir', () => {
  it('sur Android, la carte n est plus confiee a la feuille de partage qui la jette', async () => {
    Platform.OS = 'android';
    const { shareCard } = monterHook();

    await executer(() => shareCard(CHARGE));

    expect(Share.share).not.toHaveBeenCalled();
    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).toHaveBeenCalled();
  });
});

describe('L27 — sur Android, la carte est ENREGISTREE au lieu d etre perdue', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });

  it('l image capturee part dans la galerie du telephone', async () => {
    const { shareCard } = monterHook();

    const { resultat } = await executer(() => shareCard(CHARGE));

    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).toHaveBeenCalledWith(
      { mimeType: 'image/png', name: CARD_SHARE_FILE_NAME, parentFolder: 'FoundClub' },
      'Image',
      CHEMIN_NU,
    );
    expect(resultat).toMatchObject({ outcome: FILE_SHARE_OUTCOMES.GALLERY });
  });

  it('puis le selecteur d application s ouvre sur le fichier enregistre', async () => {
    const { shareCard } = monterHook();

    const { resultat } = await executer(() => shareCard(CHARGE));

    expect(ReactNativeBlobUtil.android.actionViewIntent).toHaveBeenCalledWith(
      CHEMIN_NU,
      'image/png',
      CHARGE.dialogTitle,
    );
    expect(resultat).toMatchObject({ opened: true });
  });

  it('aucune application pour ouvrir l image : l enregistrement RESTE un succes', async () => {
    ReactNativeBlobUtil.android.actionViewIntent.mockRejectedValue(new Error('ENOAPP'));
    const { shareCard } = monterHook();

    const { erreur, resultat } = await executer(() => shareCard(CHARGE));

    expect(erreur).toBeUndefined();
    expect(resultat).toMatchObject({ opened: false, outcome: FILE_SHARE_OUTCOMES.GALLERY });
  });

  it('le chemin du fichier capture reste lisible par l appelant', async () => {
    const { shareCard } = monterHook();

    const { resultat } = await executer(() => shareCard(CHARGE));

    expect(resultat).toMatchObject({ fileUri: FICHIER_CAPTURE });
  });
});

describe('L27 — un refus se dit, il ne se tait pas', () => {
  beforeEach(() => {
    Platform.OS = 'android';
  });

  it('Android 9 : permission refusee -> erreur PORTEUSE, rien n est ecrit', async () => {
    Platform.Version = 28;
    PermissionsAndroid.request.mockResolvedValue('denied');
    const { shareCard } = monterHook();

    const { erreur } = await executer(() => shareCard(CHARGE));

    expect(erreur).toMatchObject({ reason: FILE_SHARE_FAILURES.PERMISSION_DENIED });
    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).not.toHaveBeenCalled();
  });

  it('enregistrement impossible (disque plein) : erreur PORTEUSE', async () => {
    ReactNativeBlobUtil.MediaCollection.copyToMediaStore.mockRejectedValue(new Error('ENOSPC'));
    const { shareCard } = monterHook();

    const { erreur } = await executer(() => shareCard(CHARGE));

    expect(erreur).toMatchObject({ reason: FILE_SHARE_FAILURES.SAVE_FAILED });
  });

  it('un echec laisse le hook disponible pour un nouvel essai (verrou relache)', async () => {
    ReactNativeBlobUtil.MediaCollection.copyToMediaStore
      .mockRejectedValueOnce(new Error('ENOSPC'))
      .mockResolvedValueOnce('content://media/1');
    const { shareCard } = monterHook();

    await executer(() => shareCard(CHARGE));
    const { erreur, resultat } = await executer(() => shareCard(CHARGE));

    expect(erreur).toBeUndefined();
    expect(resultat).toMatchObject({ outcome: FILE_SHARE_OUTCOMES.GALLERY });
  });

  it('Android 10 et au-dela : aucune permission n est demandee', async () => {
    const { shareCard } = monterHook();

    await executer(() => shareCard(CHARGE));

    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  });
});

describe('TEMOIN POSITIF — la plateforme qui marchait ne bouge pas', () => {
  it('iOS : la feuille de partage recoit TOUJOURS l image', async () => {
    const { shareCard } = monterHook();

    const { resultat } = await executer(() => shareCard(CHARGE));

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({ url: FICHIER_CAPTURE }),
    );
    expect(resultat).toMatchObject({ outcome: FILE_SHARE_OUTCOMES.SHARE_SHEET });
  });

  // ⚠️ VERDICT CHANGE LE 2026-08-18 (U06). Le `message` etait un SECOND element
  // a partager pour iOS : « Enregistrer l'image » echouait a cause de lui, et
  // « Enregistrer dans Fichiers » deposait un `.txt` a cote de l'image. Le titre,
  // lui, reste — il n'est pas un element, et le web s'en sert.
  it('U06 — iOS : le TITRE voyage, le message NON (il devenait un fichier texte)', async () => {
    const { shareCard } = monterHook();

    await executer(() => shareCard(CHARGE));

    expect(Share.share).toHaveBeenCalledWith({
      title: CHARGE.title,
      url: FICHIER_CAPTURE,
    });
  });

  it('iOS : aucune ecriture Android n est declenchee', async () => {
    const { shareCard } = monterHook();

    await executer(() => shareCard(CHARGE));

    expect(ReactNativeBlobUtil.MediaCollection.copyToMediaStore).not.toHaveBeenCalled();
    expect(ReactNativeBlobUtil.android.actionViewIntent).not.toHaveBeenCalled();
    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  });

  it('le partage reste debounce : un second appel pendant le premier rend null', async () => {
    const { shareCard } = monterHook();
    let premier;

    await act(async () => {
      premier = shareCard(CHARGE);
      // Le second appel part alors que le premier n'est pas resolu.
      await expect(shareCard(CHARGE)).resolves.toBeNull();
      await premier;
    });

    expect(Share.share).toHaveBeenCalledTimes(1);
  });
});

describe('HORS SUJET L27, fige pour surveillance — l enregistrement en galerie', () => {
  it('Android 9 : saveCardToGallery garde SA propre demande de permission', async () => {
    Platform.OS = 'android';
    Platform.Version = 28;
    const { saveCardToGallery } = monterHook();

    await executer(() => saveCardToGallery());

    expect(PermissionsAndroid.request).toHaveBeenCalledWith(
      'android.permission.WRITE_EXTERNAL_STORAGE',
    );
  });
});

describe('PERMS — enregistrer sa carte apres le retrait des permissions media', () => {
  // 🖼️ 2026-09-03 — LE TEMOIN QUI REPOND A « on pourra toujours publier des
  // photos ? » du cote de la carte joueur. Les trois READ_MEDIA_* ont ete
  // retirees du manifeste (android/app/src/main/AndroidManifest.xml) : cet
  // enregistrement doit continuer a marcher SANS rien demander.
  //
  // ⛔ Il rougit le jour ou quelqu'un « repare » l'enregistrement en ajoutant
  // une demande de permission : sur Android 10+, PermissionsAndroid.request
  // rendrait 'never_ask_again' pour une permission que le manifeste ne declare
  // plus, et le garde-fou du code bloquerait l'enregistrement lui-meme.
  //
  // 33 = Android 13 (premiere version a exiger READ_MEDIA_IMAGES pour LIRE la
  // galerie) · 36 = Android 16, la version de l'emulateur de recette.
  const TITRE = 'Android API %i : la carte s enregistre sans rien demander';

  it.each([33, 36])(TITRE, async (version) => {
    const { CameraRoll } = jest.requireMock('@react-native-camera-roll/camera-roll');
    CameraRoll.saveAsset.mockResolvedValue({ node: { image: { uri: 'content://media/42' } } });
    Platform.OS = 'android';
    Platform.Version = version;
    const { saveCardToGallery } = monterHook();

    const { erreur, resultat } = await executer(() => saveCardToGallery());

    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    expect(CameraRoll.saveAsset).toHaveBeenCalledWith(
      FICHIER_CAPTURE,
      { album: 'FoundClub', type: 'photo' },
    );
    expect(erreur).toBeUndefined();
    expect(resultat).toBe('content://media/42');
  });
});
