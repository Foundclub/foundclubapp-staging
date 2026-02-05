import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView, Platform, ScrollView, Text, View,
} from 'react-native';

import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetClub } from '@/services/club/clubQueries';
import { getClubById, updateClub } from '@/services/club/clubService';
import { getMultisportClubById, updateMultisportClub } from '@/services/multisportClub/multisportClubService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  link: '',
  title: '',
};

const addSponsorSchema = Joi.object({
  link: Joi.string().uri().allow('').optional(),
  title: Joi.string().required(),
}).unknown(true);

/**
 * Add sponsor screen component. Allows club managers to add a new sponsor.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Add sponsor screen component
 */
function AddSponsor({ navigation, route }) {
  const { clubId, cmId } = route?.params ?? {};
  
  const { data: clubData } = useQuery({
    queryKey: clubId ? ['club', clubId] : ['multisport-club', cmId],
    queryFn: () => (clubId ? getClubById(clubId) : getMultisportClubById(cmId)),
    enabled: !!(clubId || cmId),
  });

  // local state
  const [logo, setLogo] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );
  const { t } = useTranslation();
  const { Alignments, Fonts, Spaces } = useTheme();

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setFocus,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(addSponsorSchema),
    shouldFocusError: false,
  });

  const createSponsorMutation = useMutation({
    mutationFn: (data) => (clubId ? updateClub(data) : updateMultisportClub(cmId, data)),
    onSuccess: () => {
      navigation.goBack();
    },
  });

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    if (clubData && logo) {
      // Logic is same for both: sponsor is an array of objects
      const newClub = { ...clubData };
      
      // Sanitize payload to avoid sending populated objects that updateClub doesn't handle correctly
      // (It would stringify them, causing "Document not found" errors in Strapi)
      delete newClub.parentMultisport;
      delete newClub.sections;
      delete newClub.admins;
      delete newClub.user; // If present

      newClub.sponsor = (clubData.sponsor || []).concat({ ...data, logo });
      createSponsorMutation.mutate(newClub);
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
      ]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
        style={[
          Alignments.fill,
          Alignments.justifySpaceBetween,
        ]}
      >
        <ScrollView
          contentContainerStyle={[
            Spaces.gap[24],
            Spaces.paddingBottom[40],
          ]}
          style={[Alignments.fill]}
        >
          <View style={[Alignments.fill, Spaces.gap[24]]}>
            <View style={[Alignments.column, Spaces.gap[24], Spaces.marginVertical[24]]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                {t('addSponsor.fields.logo')}
              </Text>
              <SelectAvatar
                containerStyle={{ height: 150, width: 300 }}
                cropHeight={400}
                cropWidth={800}
                currentAvatar={logo}
                imageStyle={{ height: 150, width: 300 }}
                onAvatarSelected={setLogo}
                size={80}
              />
            </View>

            <Controller
              control={control}
              name="title"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  enterKeyHint="next"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  label={t('addSponsor.fields.title.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  onSubmitEditing={() => setFocus('link')}
                  placeholder={t('addSponsor.fields.title.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />

            <Controller
              control={control}
              name="link"
              render={({
                field: {
                  name, onBlur, onChange, ref, value,
                },
              }) => (
                <Input
                  autoComplete="url"
                  enterKeyHint="done"
                  error={getFieldError({ errors: formErrors, fieldName: name })}
                  inputMode="url"
                  keyboardType="url"
                  label={t('addSponsor.fields.link.label')}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  placeholder={t('addSponsor.fields.link.placeholder')}
                  ref={ref}
                  value={value}
                />
              )}
            />
          </View>
        </ScrollView>

        <Button
          disabled={!!Object.keys(formErrors).length}
          isLoading={createSponsorMutation.isPending}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('addSponsor.actions.save')}
          variant="Primary"
        />
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default AddSponsor;
