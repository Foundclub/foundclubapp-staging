import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

/**
 * User avatar selection screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User avatar screen component
 */
function UserAvatar({ navigation, route }) {
  // local state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const { data: userData } = useGetMe();
  // @ts-expect-error because avatar can come from local path image
  const [avatar, setAvatar] = useState(userData?.avatar?.url || '');
  // hooks
  const {
    Alignments, ApplicationStyle, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      navigation.navigate(route.params?.nextRoute || RouteNames.Welcome);
    },
  });

  const handleSaveAvatar = () => {
    if (avatar && userData) {
      updateUserMutation.mutate(Object.assign(userData, { avatar }));
    }
  };

  const handleNext = () => {
    navigation.navigate(route.params?.nextRoute || RouteNames.Welcome);
  };

  /**
   * Takes a picture with device camera.
   */
  const takePicture = () => {
    ImagePicker.openCamera({
      cropping: true,
      height: 600,
      width: 600,
    }).then((image) => {
      setAvatar(image);
      setIsModalVisible(false);
    });
  };

  /**
   * Selects a picture from device gallery.
   */
  const selectFromGallery = () => {
    ImagePicker.openPicker({
      cropping: true,
      height: 600,
      mediaType: 'photo',
      width: 600,
    }).then((image) => {
      setAvatar(image);
      setIsModalVisible(false);
    });
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.gap[40]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('profile.titles.avatar')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('profile.subtitles.avatar')}
          </Text>
        </View>

        <View style={[Alignments.row, Alignments.justifyCenter, Spaces.marginVertical[24]]}>
          <View style={[
            ApplicationStyle.backgroundColor.neutral00,
            ApplicationStyle.borderRadius24,
            Alignments.relative,
            Alignments.alignCenter,
            Alignments.justifyCenter,
          ]}
          >
            {avatar
              ? (
                <Image
                  source={avatar
                    ? { uri: typeof avatar === 'string' ? avatar : avatar.path } : Images.camera}
                  style={[
                    ApplicationStyle.borderRadius24,
                    { height: 95, width: 95 }]}
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
        </View>

      </View>
      <View style={[
        Spaces.gap[16]]}
      >
        <Button
          disabled={!avatar}
          onPress={handleSaveAvatar}
          title={t('profile.actions.save')}
          variant="Primary"
        />
        <TouchableOpacity
          onPress={handleNext}
          style={[
            Alignments.alignCenter,
          ]}
        >
          <Text style={[Fonts.p1, Fonts.neutral300, Fonts.underlineText]}>
            {t('profile.actions.ignore')}
          </Text>
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
    </ScreenContainer>
  );
}

export default UserAvatar;
