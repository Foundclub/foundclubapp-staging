import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ClubStateView from '@/views/club/components/ClubStateView';

import { useGetClub } from '@/services/club/clubQueries';
import { updateClub } from '@/services/club/clubService';
import { getMultisportClubById, updateMultisportClub } from '@/services/multisportClub/multisportClubService';

import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  link: '',
  title: '',
};

// D51 ecran 08 : la zone logo etait un apercu pleine largeur a ratio variable,
// qui faisait sauter la page selon la forme de l'image deposee. Elle devient un
// carre fixe de 104 pt — la taille du pack. SelectAvatar rend deja la camera
// centree et le « + » cyan : seule sa boite change ici.
const SPONSOR_LOGO_ZONE = 104;

const addSponsorSchema = Joi.object({
  link: Joi.string().uri().allow('').optional(),
  title: Joi.string().required(),
}).unknown(true);

const sanitizeRouteParam = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.startsWith(':')) {
    return '';
  }

  return normalizedValue;
};

/**
 * Add sponsor screen component. Allows club managers to add a new sponsor.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Add sponsor screen component
 */
function AddSponsor({ navigation, route }) {
  const routeClubId = sanitizeRouteParam(route?.params?.clubId);
  const routeCmId = sanitizeRouteParam(route?.params?.cmId);
  const isMultisportFlow = !routeClubId && !!routeCmId;

  const {
    data: clubData,
    error: clubError,
    isLoading: isLoadingClub,
    refetch: refetchClub,
  } = useGetClub(routeClubId, {
    enabled: !!routeClubId,
  });
  const {
    data: multisportData,
    error: multisportError,
    isLoading: isLoadingMultisport,
    refetch: refetchMultisport,
  } = useQuery({
    enabled: !!routeCmId && !routeClubId,
    queryFn: () => getMultisportClubById(routeCmId),
    queryKey: ['multisport-club', routeCmId],
  });
  const currentTarget = routeClubId ? clubData : multisportData;
  const currentTargetError = routeClubId ? clubError : multisportError;
  const isLoadingTarget = routeClubId ? isLoadingClub : isLoadingMultisport;

  const handleRetry = () => {
    if (routeClubId) {
      return refetchClub();
    }
    return refetchMultisport();
  };

  // local state
  const [logo, setLogo] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

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
    mutationFn: (data) => (routeClubId ? updateClub(data) : updateMultisportClub(routeCmId, data)),
    onError: () => {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('addSponsor.errors.save', "Impossible d'enregistrer ce sponsor pour le moment."),
      );
    },
    onSuccess: () => {
      navigation.goBack();
    },
  });

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    if (currentTarget && logo) {
      // Logic is same for both: sponsor is an array of objects
      const newClub = { ...currentTarget };

      // Sanitize payload to avoid sending populated objects that updateClub doesn't handle correctly
      // (It would stringify them, causing "Document not found" errors in Strapi)
      delete newClub.parentMultisport;
      delete newClub.sections;
      delete newClub.admins;
      delete newClub.user; // If present

      newClub.sponsor = (currentTarget.sponsor || []).concat({ ...data, logo });
      createSponsorMutation.mutate(newClub);
    }
  };

  if (!routeClubId && !routeCmId) {
    return (
      <ClubStateView
        description={t(
          'addSponsor.state.missingContext.description',
          "Impossible d'ouvrir l'ajout de sponsor sans club ou structure multisport valide.",
        )}
        title={t('addSponsor.state.missingContext.title', 'Contexte introuvable')}
      />
    );
  }

  if (isLoadingTarget && !currentTarget) {
    return (
      <ClubStateView
        description={isMultisportFlow
          ? t(
            'addSponsor.state.loading.multisportDescription',
            'Nous récupérons les informations de ta structure multisport.',
          )
          : t(
            'addSponsor.state.loading.clubDescription',
            'Nous récupérons les informations du club.',
          )}
        isLoading
        title={t('addSponsor.state.loading.title', 'Chargement du contexte')}
      />
    );
  }

  if (currentTargetError && !currentTarget) {
    return (
      <ClubStateView
        actionLabel={t('addSponsor.state.loadError.retry', 'Réessayer')}
        description={isMultisportFlow
          ? t(
            'addSponsor.state.loadError.multisportDescription',
            'Impossible de charger cette structure multisport pour le moment.',
          )
          : t(
            'addSponsor.state.loadError.clubDescription',
            'Impossible de charger ce club pour le moment.',
          )}
        onAction={() => handleRetry()}
        title={t('addSponsor.state.loadError.title', 'Ajout indisponible')}
      />
    );
  }

  if (!isLoadingTarget && !currentTargetError && !currentTarget) {
    return (
      <ClubStateView
        actionLabel={t('addSponsor.state.notFound.refresh', 'Actualiser')}
        description={isMultisportFlow
          ? t(
            'addSponsor.state.notFound.multisportDescription',
            "Cette structure multisport est introuvable ou n'est plus accessible.",
          )
          : t(
            'addSponsor.state.notFound.clubDescription',
            "Ce club est introuvable ou n'est plus accessible.",
          )}
        onAction={() => handleRetry()}
        title={isMultisportFlow ? t(
          'addSponsor.state.notFound.multisportTitle',
          'Structure introuvable',
        ) : t(
          'addSponsor.state.notFound.clubTitle',
          'Club introuvable',
        )}
      />
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        // D63 : l ecran n avait AUCUNE marge laterale — champs et bouton
        // touchaient les deux bords. Posee ici, elle vaut aussi pour le CTA,
        // qui vit hors du defilement.
        Spaces.paddingHorizontal[16],
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
                containerStyle={{
                  backgroundColor: withAlpha(Colors.primary800, 0.6),
                  borderColor: withAlpha(Colors.primary500, 0.45),
                  borderRadius: 20,
                  borderStyle: 'dashed',
                  borderWidth: 2,
                  height: SPONSOR_LOGO_ZONE,
                  width: SPONSOR_LOGO_ZONE,
                }}
                currentAvatar={logo}
                imageResizeMode="contain"
                imageStyle={{ height: '100%', width: '100%' }}
                onAvatarSelected={setLogo}
                size={SPONSOR_LOGO_ZONE}
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

            {/* D51 : un dirigeant deposait un logo sans savoir ou il */}
            {/* atterrissait. Il le decouvrait apres coup, sur une carte equipe. */}
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t('addSponsor.hints.visibility')}
            </Text>
          </View>
        </ScrollView>

        <View style={[Spaces.gap[4]]}>
          <Button
            disabled={!!Object.keys(formErrors).length || !logo || !currentTarget || isLoadingTarget}
            isLoading={createSponsorMutation.isPending}
            onPress={handleSubmit(handleFormSubmit)}
            title={t('addSponsor.actions.save')}
            variant="Primary"
          />
          {/* D63 : la maquette pose « Annuler » sous chacun de ses CTA. Sans */}
          {/* lui, le seul retour en arriere etait la fleche de l en-tete. */}
          <Button
            onPress={() => navigation.goBack()}
            title={t('common.cancel', 'Annuler')}
            variant="Ghost"
          />
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default AddSponsor;
