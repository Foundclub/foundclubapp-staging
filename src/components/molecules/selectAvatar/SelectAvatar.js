import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, PermissionsAndroid, Platform, TouchableOpacity, View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

import { capturePhoto, pickImage } from '@/platform/media';
import { getImageUrl } from '@/utils/imageUrl';

/**
 * D36 — la capture C01 réécrit toujours la photo en PNG (`format: 'png'`).
 * Sans ce recalage, la charge continuait d'annoncer le `image/jpeg` et le nom
 * `.jpg` de la photo d'origine : l'app envoyait un PNG étiqueté JPEG, avec en
 * prime la taille d'un fichier qui n'existait plus.
 * @param {any} asset Asset rendu par la caméra.
 * @param {string} uri Chemin du fichier produit par la capture.
 * @returns {any} L'asset dé-miroité, décrit pour ce qu'il est.
 */
const decrireLaCapture = (asset, uri) => {
  const nomSansExtension = String(asset?.fileName || 'avatar').replace(/\.[^./\\]+$/, '');

  return {
    ...asset,
    fileName: `${nomSansExtension}.png`,
    fileSize: undefined,
    path: uri,
    type: 'image/png',
    uri,
  };
};

/**
 * SelectAvatar component for selecting/updating user avatar
 * @param {object} props Component props
 * @param {Avatar | undefined} props.currentAvatar Current avatar object with url or path property
 * @param {(avatar: Avatar) => void} props.onAvatarSelected Callback when avatar is selected
 * @param {() => void} [props.onDelete] Callback when avatar is deleted
 * @param {number} props.size Size of the avatar in pixels
 * @param {number} [props.cropWidth] Width of the crop area
 * @param {number} [props.cropHeight] Height of the crop area
 * @param {'cover' | 'contain' | 'stretch' | 'center' | 'repeat'} [props.imageResizeMode]
 * @param {import('react-native').ViewStyle} [props.containerStyle] Custom container style
 * @param {import('react-native').ImageStyle} [props.imageStyle] Custom image style
 * @returns {import('react').ReactElement} SelectAvatar component
 */
function SelectAvatar({
  containerStyle,
  cropHeight,
  cropWidth,
  currentAvatar,
  imageResizeMode = 'cover',
  imageStyle,
  onAvatarSelected,
  onDelete,
  size = 95,
}) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const browserInputRef = useRef(null);
  // C01 (Path A) : dé-miroir d'un selfie caméra avant via react-native-view-shot.
  // On monte une vue cachée contenant l'image retournée (scaleX:-1) puis on la
  // recapture. flipSource porte l'uri + les dimensions ; flipResolveRef relaie le
  // résultat de onLoad->captureRef vers la promesse. Garde-fou : toute erreur/timeout
  // retombe sur la photo d'origine (le miroir reste, mais la capture ne casse jamais).
  const flipViewRef = useRef(null);
  const flipResolveRef = useRef(null);
  const [flipSource, setFlipSource] = useState(null);
  const {
    Alignments, ApplicationStyle, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  /**
   * @param {File | undefined} file
   */
  const handleBrowserFileSelection = (file) => {
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    onAvatarSelected({
      file,
      fileName: file.name,
      filename: file.name,
      height: undefined,
      mime: file.type || 'application/octet-stream',
      name: file.name,
      path: objectUrl,
      size: file.size,
      type: file.type || 'application/octet-stream',
      uri: objectUrl,
      url: '',
      width: undefined,
    });
    setIsModalVisible(false);
  };

  const handleDelete = () => {
    Alert.alert(
      t('common.actions.delete'),
      t('profile.actions.confirmDeleteAvatar'),
      [
        {
          style: 'cancel',
          text: t('common.actions.cancel'),
        },
        {
          onPress: onDelete,
          style: 'destructive',
          text: t('common.actions.delete'),
        },
      ],
    );
  };

  const handleResponse = (response) => {
    if (response?.didCancel) {
      return;
    }
    if (response?.errorCode) {
      console.warn('ImagePicker Error:', response.errorCode, response.errorMessage);
      // D36 : sur simulateur iOS, la bibliothèque rend `camera_unavailable`
      // SANS `errorMessage` — le message affiché se terminait par « undefined ».
      Alert.alert(
        t('common.error'),
        response.errorMessage
          || t('profile.errors.photoUnavailable', "L'appareil photo n'est pas disponible."),
      );
      return;
    }

    const asset = response?.assets?.[0];
    if (!asset?.uri) {
      // ⛔ D36 : ni photo, ni annulation, ni code d'erreur. Sans ce garde-fou,
      // l'écran ne disait RIEN et l'utilisateur croyait avoir raté son geste.
      Alert.alert(
        t('common.error'),
        t('profile.errors.photoNotRetrieved', "La photo n'a pas pu être récupérée. Réessaie."),
      );
      return;
    }

    // Map to format expected by Upload Service (path, mime, filename)
    const mappedImage = {
      filename: asset.fileName,
      height: asset.height,
      mime: asset.type,
      path: asset.uri,
      size: asset.fileSize,
      uri: asset.uri,
      url: '', // Clear url to indicate new file
      width: asset.width,
    };
    onAvatarSelected(mappedImage);
    setIsModalVisible(false);
  };

  /**
   * Retourne horizontalement une capture caméra avant (selfie) pour supprimer
   * l'effet miroir natif. En cas d'échec (capture impossible/vide, timeout), on
   * renvoie l'asset d'origine : la capture d'avatar ne doit jamais casser.
   * @param {any} asset asset renvoyé par react-native-image-picker
   * @returns {Promise<any>} asset dé-miroité, ou l'asset d'origine en repli
   */
  const flipAssetHorizontally = (asset) => new Promise((resolve) => {
    if (Platform.OS === 'web' || !asset?.uri) {
      resolve(asset);
      return;
    }
    const width = asset.width || cropWidth || 1000;
    const height = asset.height || cropHeight || 1000;
    let settled = false;
    /** @type {any} */
    let minuterie = null;
    const finish = (uri) => {
      if (settled) return;
      settled = true;
      if (minuterie) clearTimeout(minuterie);
      flipResolveRef.current = null;
      setFlipSource(null);
      // uri renseignée = capture réussie ; sinon repli sur l'original (miroir conservé).
      resolve(uri ? decrireLaCapture(asset, uri) : asset);
    };
    flipResolveRef.current = finish;
    // Garde-fou : si onLoad/capture ne répond pas, on retombe sur l'original.
    minuterie = setTimeout(() => finish(null), 4000);
    setFlipSource({ height, uri: asset.uri, width });
  });

  const handleFlipImageReady = async () => {
    if (!flipSource) return;
    try {
      const uri = await captureRef(flipViewRef, {
        format: 'png',
        height: flipSource.height,
        quality: 1,
        result: 'tmpfile',
        width: flipSource.width,
      });
      flipResolveRef.current?.(uri);
    } catch (error) {
      console.warn('Avatar flip failed, using original:', error?.message);
      flipResolveRef.current?.(null);
    }
  };

  const takePicture = async () => {
    try {
      if (Platform.OS === 'web') {
        browserInputRef.current?.setAttribute('capture', 'environment');
        browserInputRef.current?.click();
        return;
      }

      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            buttonNegative: t('common.actions.cancel', 'Annuler'),
            buttonNeutral: t('common.actions.askLater', 'Plus tard'),
            buttonPositive: t('common.actions.ok', 'OK'),
            message: t('permissions.camera.message', 'L\'application a besoin d\'accéder à ta caméra pour prendre une photo.'),
            title: t('permissions.camera.title', 'Permission Caméra'),
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(t('common.error'), t('permissions.camera.denied', 'Permission caméra refusée'));
          return;
        }
      }

      const result = await capturePhoto({
        // C01 : un avatar est un selfie -> caméra avant par défaut.
        cameraType: 'front',
        includeBase64: false,
        includeExtra: true,
        maxHeight: cropHeight || 1000,
        maxWidth: cropWidth || 1000,
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: false,
      });
      // C01 : la caméra avant renvoie une image en miroir -> on la dé-miroite
      // (repli sur l'original si le flip échoue).
      if (result?.assets?.length > 0) {
        const flipped = await flipAssetHorizontally(result.assets[0]);
        handleResponse({ ...result, assets: [flipped] });
      } else {
        handleResponse(result);
      }
    } catch (error) {
      console.warn('Camera Error:', error);
      Alert.alert('Erreur', `Impossible d'ouvrir la caméra : ${error.message}`);
    }
  };

  const selectFromGallery = async () => {
    try {
      if (Platform.OS === 'web') {
        browserInputRef.current?.removeAttribute('capture');
        browserInputRef.current?.click();
        return;
      }

      const result = await pickImage({
        includeBase64: false,
        includeExtra: true,
        maxHeight: cropHeight || 1000,
        maxWidth: cropWidth || 1000,
        mediaType: 'photo',
        quality: 0.8,
      });
      handleResponse(result);
    } catch (error) {
      console.warn('Gallery Error:', error);
      Alert.alert('Erreur', `Impossible d'ouvrir la galerie : ${error.message}`);
    }
  };

  return (
    <>
      {/* C01 : vue cachée (hors écran) qui rend le selfie retourné puis le recapture.
          collapsable=false pour rester dans la hiérarchie native (sinon capture vide).
          ⚠️ D36 — HORS ÉCRAN, JAMAIS TRANSPARENT. `captureRef` photographie ce qui
          est VISIBLE (RNViewShot.mm, drawViewHierarchyInRect) : une source à
          `opacity: 0` rend une image entièrement vide, et la bibliothèque annonce
          quand même un succès (son propre commentaire : « reports incorrect
          success even though the image is blank »). La photo de la caméra était
          alors remplacée par du vide — c'est ça, « la photo ne charge pas ». */}
      {flipSource ? (
        <View
          collapsable={false}
          pointerEvents="none"
          ref={flipViewRef}
          style={{
            height: flipSource.height,
            left: -10000,
            position: 'absolute',
            top: -10000,
            width: flipSource.width,
          }}
        >
          <Image
            onLoad={handleFlipImageReady}
            source={{ uri: flipSource.uri }}
            style={{
              height: flipSource.height,
              transform: [{ scaleX: -1 }],
              width: flipSource.width,
            }}
          />
        </View>
      ) : null}
      {Platform.OS === 'web' ? (
        <input
          accept="image/*"
          onChange={(event) => {
            const nextFile = event.currentTarget.files?.[0];
            handleBrowserFileSelection(nextFile);
            event.currentTarget.value = '';
          }}
          ref={browserInputRef}
          style={{ display: 'none' }}
          type="file"
        />
      ) : null}
      <View style={[
        ApplicationStyle.backgroundColor.neutral00,
        ApplicationStyle.borderRadius24,
        Alignments.relative,
        Alignments.alignCenter,
        Alignments.justifyCenter,
        { height: size, width: size },
        containerStyle,
      ]}
      >
        {currentAvatar?.url || currentAvatar?.path
          ? (
            <>
              <Image
                resizeMode={imageResizeMode}
                source={{ uri: currentAvatar.path || getImageUrl(currentAvatar.url) }}
                style={[
                  ApplicationStyle.borderRadius24,
                  { height: size, width: size },
                  imageStyle,
                ]}
              />
              {onDelete && (
                <TouchableOpacity
                  accessibilityHint={t(
                    'profile.actions.confirmDeleteAvatar',
                  )}
                  accessibilityLabel={t('common.actions.delete')}
                  accessibilityRole="button"
                  hitSlop={ApplicationStyle.hitSlop.min44From32}
                  onPress={handleDelete}
                  style={[
                    Alignments.absolute,
                    ApplicationStyle.backgroundColor.error700,
                    ApplicationStyle.borderRadius24,
                    Spaces.padding[8],
                    {
                      bottom: -8,
                      elevation: 10,
                      right: -8,
                      zIndex: 10,
                    },
                  ]}
                >
                  <Image
                    source={Images.trash}
                    style={[
                      ApplicationStyle.icon16,
                      ApplicationStyle.tintColor.neutral00]}
                  />
                </TouchableOpacity>
              )}
            </>
          ) : (
            <Image
              source={Images.camera}
              style={[
                ApplicationStyle.icon48,
                Spaces.margin[24],
                ApplicationStyle.tintColor.primary500]}
            />
          )}
        <TouchableOpacity
          accessibilityLabel={t('common.actions.photoFromGallery')}
          accessibilityRole="button"
          hitSlop={ApplicationStyle.hitSlop.min44From40}
          onPress={() => setIsModalVisible(true)}
          style={[
            Alignments.absolute,
            ApplicationStyle.backgroundColor.primary500,
            ApplicationStyle.borderRadius32,
            Spaces.padding[12],
            { right: -12, top: -12 },
          ]}
        >
          <Image
            source={Images.plus}
            style={[
              ApplicationStyle.icon16,
              ApplicationStyle.tintColor.primary900]}
          />
        </TouchableOpacity>
      </View>

      <BottomModal
        close={() => { setIsModalVisible(false); }}
        contentContainerStyle={[Spaces.paddingBottom[16]]}
        hideCloseButton
        isVisible={isModalVisible}
        scrollable={false}
        snapPoints={['34%']}
      >
        <View style={[
          Spaces.paddingTop[24],
          Spaces.gap[24],
          Spaces.paddingBottom[8],
        ]}
        >
          <Button
            onPress={takePicture}
            title={t('common.actions.photoFromCamera')}
            variant="SecondaryLight"
          />
          <Button
            onPress={selectFromGallery}
            title={t('common.actions.photoFromGallery')}
            variant="SecondaryLight"
          />
        </View>
      </BottomModal>
    </>
  );
}

export default SelectAvatar;
