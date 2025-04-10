import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Image, KeyboardAvoidingView, Platform, TouchableOpacity, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import ImagePicker from 'react-native-image-crop-picker';

import { formatBirthdateToDisplay, formatBirthdateToSend, USER_SECTIONS } from '@/domains/auth/authUseCases';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import AutocompleteSelect from '@/components/molecules/autocompleteSelect/AutocompleteSelect';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import Input from '@/components/molecules/input/Input';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  birthdate: '',
  firstname: '',
  lastname: '',
  phoneNumber: '',
  section: /** @type {'female' | 'male'} */ (''),
};

const profileSchema = Joi.object({
  birthdate: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/),
  documentId: Joi.string().allow(null, '').optional(),
  firstname: Joi.string().required(),
  lastname: Joi.string().required(),
  phoneNumber: Joi.string(),
  section: Joi.string().allow(null, '').optional(),
}).unknown(true);

/**
 * Profile edit screen component. Allows users to edit their profile information.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Profile edit screen component
 */
function ProfileEdit({ navigation }) {
  const {
    Alignments, ApplicationStyle, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const [isModalVisible, setIsModalVisible] = useState(false);
  // @ts-expect-error because avatar can come from local path image
  const [avatar, setAvatar] = useState(userData?.avatar?.url || undefined);

  const sectionOptions = [
    { label: t('profile.fields.sections.female'), value: USER_SECTIONS.female },
    { label: t('profile.fields.sections.male'), value: USER_SECTIONS.male },
  ];

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      navigation.goBack();
    },
  });

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setFocus,
  } = useForm({
    defaultValues: {
      ...defaultValues,
      ...userData,
    },
    mode: 'onBlur',
    resolver: joiResolver(profileSchema),
    shouldFocusError: false,
  });

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    if (userData) {
      updateUserMutation.mutate({
        ...userData,
        ...data,
        avatar,
        birthdate: formatBirthdateToSend(data.birthdate),
      });
    }
  };

  const takePicture = async () => {
    try {
      const image = await ImagePicker.openCamera({
        cropping: true,
        height: 300,
        includeBase64: true,
        width: 300,
      });
      setAvatar(image);
      setIsModalVisible(false);
    } catch (error) {
      // Handle error silently
    }
  };

  const selectFromGallery = async () => {
    try {
      const image = await ImagePicker.openPicker({
        cropping: true,
        height: 300,
        includeBase64: true,
        width: 300,
      });
      setAvatar(image);
      setIsModalVisible(false);
    } catch (error) {
      // Handle error silently
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingVertical[24]]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
        style={[Alignments.justifySpaceBetween, Alignments.fill]}
      >
        <ScrollView
          contentContainerStyle={[
            Spaces.gap[24],
            Spaces.paddingBottom[40],
          ]}
          style={[Alignments.fill]}
        >
          <View style={[Alignments.fill, Spaces.gap[24]]}>
            <View style={[Alignments.row, Spaces.marginVertical[24]]}>
              <View style={[
                ApplicationStyle.backgroundColor.neutral00,
                ApplicationStyle.borderRadius24,
                Alignments.relative,
                Alignments.alignCenter,
                Alignments.justifyCenter,
                { height: 110, width: 110 },
              ]}
              >
                {avatar
                  ? (
                    <Image
                      source={{ uri: typeof avatar === 'string' ? avatar : avatar.path }}
                      style={[
                        ApplicationStyle.borderRadius24,
                        { height: 110, width: 110 }]}
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

            <Controller
              control={control}
              name="phoneNumber"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  editable={false}
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('profile.fields.phoneNumber.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('profile.fields.phoneNumber.placeholder')}
                  readOnly
                  ref={ref}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="firstname"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('profile.fields.firstname.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('lastname')}
                  placeholder={t('profile.fields.firstname.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="lastname"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('profile.fields.lastname.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('birthdate')}
                  placeholder={t('profile.fields.lastname.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="birthdate"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="done"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  label={t('profile.fields.birthdate.label')}
                  maxLength={10}
                  onBlur={onBlur}
                  onChangeText={(text) => onChange(formatBirthdateToDisplay(text))}
                  placeholder="JJ/MM/AAAA"
                  ref={ref}
                  value={value}
                />
              )}
            />
            <Controller
              control={control}
              name="section"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <AutocompleteSelect
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('profile.fields.section.label')}
                  onBlur={onBlur}
                  options={sectionOptions}
                  placeholder={t('profile.fields.section.placeholder')}
                  ref={ref}
                  setValue={
                    (/** @type {{value: string, label: string}} */option) => { onChange(option?.label || ''); }
                  }
                  value={value}
                />
              )}
            />
          </View>
        </ScrollView>

        <Button
          onPress={handleSubmit(handleFormSubmit)}
          title={t('profile.actions.save')}
          variant="Primary"
        />

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
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default ProfileEdit;
