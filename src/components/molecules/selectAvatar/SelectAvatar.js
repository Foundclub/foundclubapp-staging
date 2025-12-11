import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Image, TouchableOpacity, View,
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';

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
 * @returns {import('react').ReactElement} SelectAvatar component
 */
function SelectAvatar({ currentAvatar, onAvatarSelected, onDelete, size = 95 }) {
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

  const takePicture = async () => {
    try {
      const image = await ImagePicker.openCamera({
        cropping: true,
        forceJpg: true,
        height: size * 2,
        includeBase64: true,
        mediaType: 'photo',
        width: size * 2,
      });
      onAvatarSelected(Object.assign(image, { url: '' }));
      setIsModalVisible(false);
    } catch (error) {
      console.warn('Camera Error:', error);
      Alert.alert('Erreur', `Impossible d'ouvrir la caméra : ${error.message}`);
    }
  };

  const selectFromGallery = async () => {
    try {
      const image = await ImagePicker.openPicker({
        cropping: true,
        forceJpg: true,
        height: size * 2,
        includeBase64: true,
        mediaType: 'photo',
        width: size * 2,
      });
      onAvatarSelected(Object.assign(image, { url: '' }));
      setIsModalVisible(false);
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
      ]}
      >
        {currentAvatar?.url || currentAvatar?.path
          ? (
            <>
              <Image
                source={{ uri: currentAvatar.path || getImageUrl(currentAvatar.url) }}
                style={[
                  ApplicationStyle.borderRadius24,
                  { height: size, width: size }]}
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
