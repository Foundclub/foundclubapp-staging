import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, TouchableOpacity, View, PermissionsAndroid, Platform,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

import useTheme from '@/theme/themeContext';
import { getImageUrl } from '@/utils/imageUrl';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * SelectAvatar component for selecting/updating user avatar
 * @param {object} props Component props
 * @param {Avatar | undefined} props.currentAvatar Current avatar object with url or path property
 * @param {(avatar: Avatar) => void} props.onAvatarSelected Callback when avatar is selected
 * @param {() => void} [props.onDelete] Callback when avatar is deleted
 * @param {number} props.size Size of the avatar in pixels
 * @param {number} [props.cropWidth] Width of the crop area
 * @param {number} [props.cropHeight] Height of the crop area
 * @param {import('react-native').ViewStyle} [props.containerStyle] Custom container style
 * @param {import('react-native').ImageStyle} [props.imageStyle] Custom image style
 * @returns {import('react').ReactElement} SelectAvatar component
 */
function SelectAvatar({
  containerStyle, cropHeight, cropWidth, currentAvatar, imageStyle, onAvatarSelected, onDelete, size = 95,
}) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const {
    Alignments, ApplicationStyle, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const handleDelete = () => {
    Alert.alert(
      t('common.actions.delete'),
      t('profile.actions.confirmDeleteAvatar'),
      [
        {
          text: t('common.actions.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.actions.delete'),
          onPress: onDelete,
          style: 'destructive',
        },
      ],
    );
  };

  const handleResponse = (response) => {
    if (response.didCancel) {
      return;
    }
    if (response.errorCode) {
      console.warn('ImagePicker Error:', response.errorMessage);
      Alert.alert('Erreur', `Erreur lors de la sélection : ${response.errorMessage}`);
      return;
    }

    if (response.assets && response.assets.length > 0) {
      const asset = response.assets[0];
      // Map to format expected by Upload Service (path, mime, filename)
      const mappedImage = {
        path: asset.uri,
        uri: asset.uri,
        mime: asset.type,
        filename: asset.fileName,
        width: asset.width,
        height: asset.height,
        size: asset.fileSize,
        url: '', // Clear url to indicate new file
      };
      onAvatarSelected(mappedImage);
      setIsModalVisible(false);
    }
  };

  const takePicture = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('permissions.camera.title', 'Permission Caméra'),
            message: t('permissions.camera.message', 'L\'application a besoin d\'accéder à votre caméra pour prendre une photo.'),
            buttonNeutral: t('common.actions.askLater', 'Plus tard'),
            buttonNegative: t('common.actions.cancel', 'Annuler'),
            buttonPositive: t('common.actions.ok', 'OK'),
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(t('common.error'), t('permissions.camera.denied', 'Permission caméra refusée'));
          return;
        }
      }

      const result = await launchCamera({
        mediaType: 'photo',
        includeBase64: false,
        includeExtra: true,
        maxWidth: cropWidth || 1000,
        maxHeight: cropHeight || 1000,
        quality: 0.8,
        saveToPhotos: false,
        cameraType: 'back',
      });
      handleResponse(result);
    } catch (error) {
      console.warn('Camera Error:', error);
      Alert.alert('Erreur', `Impossible d'ouvrir la caméra : ${error.message}`);
    }
  };

  const selectFromGallery = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false,
        includeExtra: true,
        maxWidth: cropWidth || 1000,
        maxHeight: cropHeight || 1000,
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
                source={{ uri: currentAvatar.path || getImageUrl(currentAvatar.url) }}
                style={[
                  ApplicationStyle.borderRadius24,
                  { height: size, width: size },
                  imageStyle,
                ]}
              />
              {onDelete && (
                <TouchableOpacity
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
              ApplicationStyle.tintColor.neutral900]}
          />
        </TouchableOpacity>
      </View>

      <BottomModal
        close={() => { setIsModalVisible(false); }}
        hideCloseButton
        isVisible={isModalVisible}
      >
        <View style={[
          Spaces.paddingTop[32],
          Spaces.gap[24],
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
