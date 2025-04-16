import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, TouchableOpacity, View,
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 * SelectAvatar component for selecting/updating user avatar
 * @param {object} props Component props
 * @param {Avatar | undefined} props.currentAvatar Current avatar object with url or path property
 * @param {(avatar: Avatar) => void} props.onAvatarSelected Callback when avatar is selected
 * @param {number} props.size Size of the avatar in pixels
 * @returns {import('react').ReactElement} SelectAvatar component
 */
function SelectAvatar({ currentAvatar, onAvatarSelected, size = 95 }) {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const {
    Alignments, ApplicationStyle, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const takePicture = async () => {
    try {
      const image = await ImagePicker.openCamera({
        cropping: true,
        height: size * 2,
        includeBase64: true,
        mediaType: 'photo',
        width: size * 2,
      });
      onAvatarSelected(Object.assign(image, { url: '' }));
      setIsModalVisible(false);
    } catch (error) {
      // Handle error silently
    }
  };

  const selectFromGallery = async () => {
    try {
      const image = await ImagePicker.openPicker({
        cropping: true,
        height: size * 2,
        includeBase64: true,
        mediaType: 'photo',
        width: size * 2,
      });
      onAvatarSelected(Object.assign(image, { url: '' }));
      setIsModalVisible(false);
    } catch (error) {
      // Handle error silently
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
            <Image
              source={{ uri: currentAvatar.url || currentAvatar.path }}
              style={[
                ApplicationStyle.borderRadius24,
                { height: size, width: size }]}
            />
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
