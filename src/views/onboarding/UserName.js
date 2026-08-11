import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey, onboardingCollectsBirthdate } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';

import { getFieldError } from '@/utils/form/formUtils';

import { isBirthdateUnderParentalAge } from '@/constants/parentalDeclaration';

// D15 - ECRAN FUSIONNE « Qui es-tu ? ».
// Prenom, nom et date de naissance tenaient sur DEUX etapes (UserName puis
// l'ancien ecran `UserBirthdate`, supprime par D22 une fois prouve qu'aucun
// parcours ne l'atteignait plus). Ils tiennent desormais sur celle-ci. Le
// dirigeant, lui, n'a
// jamais eu d'etape date de naissance : il ne voit que prenom + nom, et c'est sa
// seule etape obligatoire.
//
// Qui a droit aux trois champs est decide par `onboardingCollectsBirthdate`,
// dans authUseCases.js, a cote de la machine a etapes qui insere la declaration
// parentale. Un test lie les deux pour qu'elles ne divergent jamais.

// D66 — le formulaire ne porte QUE les champs que l'ecran demande.
//
// Avant, `defaultValues` portait toujours day / month / year. Pour un role sans
// date de naissance, ces trois clefs partaient quand meme au schema « nom
// seul », qui ne les declare pas : Joi les refusait (`object.unknown`) et le
// bouton restait grise sur des erreurs portant sur des champs QUI NE SONT PAS
// RENDUS — donc invisibles et incorrigibles. Un dirigeant ne pouvait pas finir
// son inscription (constate sur emulateur, commit fautif 7fe4959 du 06/08).
const nameDefaultValues = {
  firstname: '',
  lastname: '',
};

const birthdateDefaultValues = {
  day: '',
  month: '',
  year: '',
};

const buildDefaultValues = (/** @type {boolean} */ collectsBirthdate) => (
  collectsBirthdate
    ? { ...nameDefaultValues, ...birthdateDefaultValues }
    : { ...nameDefaultValues }
);

const resolveAvailableRoute = (navigation, ...candidates) => {
  const routeNames = navigation?.getState?.()?.routeNames || [];
  const firstCandidate = candidates.find(Boolean);

  if (!Array.isArray(routeNames) || routeNames.length === 0) {
    return firstCandidate;
  }

  return candidates.find(
    (candidate) => candidate && routeNames.includes(candidate),
  ) || firstCandidate;
};

const nameFields = {
  firstname: Joi.string().required(),
  lastname: Joi.string().required(),
};

// Regles reprises telles quelles de l'ancien UserBirthdate.js (fichier supprime
// par D22 ; ces lignes en sont la seule survivance) : bornes jour / mois /
// annee, puis controle que la date existe reellement (31 fevrier refuse).
const birthdateFields = {
  day: Joi.string()
    .pattern(/^\d{2}$/)
    .custom((/** @type {string} */ value, /** @type {any} */ helper) => {
      const num = Number(value);
      if (Number.isNaN(num) || num < 1 || num > 31) return helper.error('any.invalid');
      return value;
    })
    .required(),
  month: Joi.string()
    .pattern(/^\d{2}$/)
    .custom((/** @type {string} */ value, /** @type {any} */ helper) => {
      const num = Number(value);
      if (Number.isNaN(num) || num < 1 || num > 12) return helper.error('any.invalid');
      return value;
    })
    .required(),
  year: Joi.string()
    .pattern(/^\d{4}$/)
    .custom((/** @type {string} */ value, /** @type {any} */ helper) => {
      const num = Number(value);
      if (Number.isNaN(num) || num < 1920 || num > new Date().getFullYear()) return helper.error('any.invalid');
      return value;
    })
    .required(),
};

const isRealDate = (/** @type {{day: string, month: string, year: string}} */ value, /** @type {any} */ helper) => {
  const day = Number(value.day);
  const month = Number(value.month);
  const year = Number(value.year);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime())
    || date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return helper.error('any.invalid');
  }

  return value;
};

const identitySchema = Joi.object({ ...nameFields, ...birthdateFields }).custom(isRealDate);
const nameOnlySchema = Joi.object(nameFields);

/**
 * Ecran d'identite de l'inscription : prenom, nom, et date de naissance quand le
 * parcours du role la demande.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User identity screen component
 */
function UserName({ navigation }) {
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    getNextOnboardingRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const collectsBirthdate = onboardingCollectsBirthdate(userData?.role);
  const isPresident = getUserRoleKey(userData?.role?.name || userData?.role?.type) === 'president';

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour ton profil.');
    },
    onSuccess: (unused, submitted) => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });

      // Le piege de la fusion : `needsParentalDeclaration` se calcule A PARTIR
      // de la date qui vient d'etre saisie. On la lit donc dans ce qui a ete
      // envoye, pas dans `userData`, qui date d'avant l'enregistrement.
      if (
        submitted?.birthdate
        && isBirthdateUnderParentalAge(submitted.birthdate)
        && userData?.parentalDeclarationAccepted !== true
      ) {
        navigation.navigate(RouteNames.UserParentalDeclaration);
        return;
      }

      const nextRoute = resolveAvailableRoute(
        navigation,
        getNextOnboardingRoute(RouteNames.UserName),
        RouteNames.UserAvatar,
      );
      if (nextRoute) {
        navigation.navigate(nextRoute);
      }
    },
  });
  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    reset,
    setFocus,
  } = useForm({
    defaultValues: {
      ...buildDefaultValues(collectsBirthdate),
      firstname: userData?.firstname || '',
      lastname: userData?.lastname || '',
    },
    mode: 'onBlur',
    resolver: joiResolver(collectsBirthdate ? identitySchema : nameOnlySchema),
    shouldFocusError: false,
  });

  useEffect(() => {
    const parsedDate = userData?.birthdate ? new Date(userData.birthdate) : null;
    const hasParsedDate = parsedDate && !Number.isNaN(parsedDate.getTime());

    // Le `collectsBirthdate` de la condition n'est PAS decoratif : un dirigeant
    // qui porte deja une date en base (changement de role, compte migre) se
    // verrait sinon reinjecter les trois clefs ici, et le defaut D66
    // reviendrait par ce chemin-la.
    reset({
      ...buildDefaultValues(collectsBirthdate),
      firstname: userData?.firstname || '',
      lastname: userData?.lastname || '',
      ...(collectsBirthdate && hasParsedDate ? {
        day: String(parsedDate.getUTCDate()).padStart(2, '0'),
        month: String(parsedDate.getUTCMonth() + 1).padStart(2, '0'),
        year: String(parsedDate.getUTCFullYear()),
      } : {}),
    });
  }, [collectsBirthdate, reset, userData?.birthdate, userData?.firstname, userData?.lastname]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de modifier ton nom."
        isLoading
        title="Chargement du profil"
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel="Réessayer"
        description={userDataError?.message || 'Impossible de charger ton profil.'}
        onAction={refetchUserData}
        title="Chargement impossible"
      />
    );
  }

  /**
   * Handle form submit
   * Les trois champs de date sont OPTIONNELS depuis D66 : le formulaire ne les
   * porte plus quand le role ne les demande pas.
   * @param {{firstname: string, lastname: string, day?: string,
   *   month?: string, year?: string}} data - Les valeurs du formulaire.
   */
  const handleFormSubmit = (data) => {
    if (!userData) return;

    updateUserMutation.mutate({
      firstname: data.firstname,
      lastname: data.lastname,
      ...(collectsBirthdate && data.year && data.month && data.day
        ? { birthdate: `${data.year}-${data.month}-${data.day}` }
        : {}),
    });
  };

  // D66 — INVARIANT CONTRE LE CUL-DE-SAC : le bouton est grise SI ET SEULEMENT
  // SI un message explique pourquoi. Un meme booleen commande les deux, donc
  // aucune cause future ne peut plus rendre le bouton mort ET muet.
  //
  // Le cas des trois champs de date merite son propre message : ils s'affichent
  // en rouge sans texte (`error={… ? ' ' : undefined}`, la convention du champ
  // pour ne pas repeter trois fois la meme phrase sous JJ / MM / AAAA), donc
  // sans cette ligne l'ecran ne dirait rien de lisible.
  const blockingFields = Object.keys(formErrors);
  const hasBlockingError = blockingFields.length > 0;
  const blocksOnBirthdate = blockingFields
    .some((field) => ['day', 'month', 'year'].includes(field));
  const blockingMessage = blocksOnBirthdate
    ? t(
      'profile.errors.birthdateIncomplete',
      'Renseigne une date de naissance valide pour continuer.',
    )
    : t(
      'profile.errors.formIncomplete',
      'Vérifie les informations saisies pour continuer.',
    );

  return (
    <FormScreenContainer
      bgImage="bg2"
      // D31 ⑤ — l'écran pose LUI-MÊME le retrait bas (`marginBottom` ci-dessous).
      // Sans ce mode, le conteneur en ajoutait un SECOND : `insets.bottom` était
      // compté deux fois, soit ~34 pt de vide sous « Passer cette étape ».
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        // D23 — reprises telles quelles du KeyboardAvoidingView imbrique qui
        // vivait ici : c'etait le SECOND de l'ecran (le conteneur en monte deja
        // un) et il portait un decalage de 110 ecrit en dur.
        Alignments.justifySpaceBetween,
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.gap[40]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('profile.titles.identity', 'Qui es-tu ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {isPresident
              ? t(
                'profile.subtitles.identityPresident',
                'La seule étape obligatoire du parcours dirigeant.',
              )
              : t('profile.subtitles.identity', 'Renseigne ton nom, ton prénom et ta date de naissance.')}
          </Text>
        </View>

        <View style={[Spaces.gap[24]]}>
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
                enterKeyHint={collectsBirthdate ? 'next' : 'done'}
                error={getFieldError({ errors: formErrors, fieldName: name })}
                label={t('profile.fields.lastname.label')}
                onBlur={onBlur}
                onChangeText={onChange}
                onSubmitEditing={() => collectsBirthdate && setFocus('day')}
                placeholder={t('profile.fields.lastname.placeholder')}
                ref={ref}
                value={value}
              />
            )}
          />

          {collectsBirthdate ? (
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2, Fonts.neutral00]}>
                {t('profile.fields.birthdate.label', 'Date de naissance')}
              </Text>
              <View style={[
                Alignments.row,
                Alignments.alignEnd,
                Alignments.justifyCenter,
                Spaces.gap[16]]}
              >
                <Controller
                  control={control}
                  name="day"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <Input
                      enterKeyHint="next"
                      error={getFieldError({ errors: formErrors, fieldName: name }) ? ' ' : undefined}
                      inputMode="numeric"
                      keyboardType="number-pad"
                      maxLength={2}
                      onBlur={onBlur}
                      onChangeText={(text) => {
                        onChange(text);
                        if (text.length === 2) {
                          setFocus('month');
                        }
                      }}
                      onSubmitEditing={() => setFocus('month')}
                      placeholder="JJ"
                      ref={ref}
                      value={value}
                      wrapperStyle={{ width: 60 }}
                    />
                  )}
                />
                <Text style={[Fonts.h1Bold, Fonts.neutral00, Spaces.paddingHorizontal[4]]}>
                  /
                </Text>
                <Controller
                  control={control}
                  name="month"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <Input
                      enterKeyHint="next"
                      error={getFieldError({ errors: formErrors, fieldName: name }) ? ' ' : undefined}
                      inputMode="numeric"
                      keyboardType="number-pad"
                      maxLength={2}
                      onBlur={onBlur}
                      onChangeText={(text) => {
                        onChange(text);
                        if (text.length === 2) {
                          setFocus('year');
                        }
                      }}
                      onSubmitEditing={() => setFocus('year')}
                      placeholder="MM"
                      ref={ref}
                      value={value}
                      wrapperStyle={{ width: 60 }}
                    />
                  )}
                />
                <Text style={[Fonts.h1Bold, Fonts.neutral00, Spaces.paddingHorizontal[4]]}>
                  /
                </Text>
                <Controller
                  control={control}
                  name="year"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <Input
                      enterKeyHint="done"
                      error={getFieldError({ errors: formErrors, fieldName: name }) ? ' ' : undefined}
                      inputMode="numeric"
                      keyboardType="number-pad"
                      maxLength={4}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      placeholder="AAAA"
                      ref={ref}
                      value={value}
                      wrapperStyle={{ width: 80 }}
                    />
                  )}
                />
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[Spaces.gap[8]]}>
        {hasBlockingError ? (
          <Text style={[Fonts.p2, Fonts.error300]}>
            {blockingMessage}
          </Text>
        ) : null}
        <Button
          disabled={hasBlockingError}
          isLoading={updateUserMutation.isPending}
          onPress={handleSubmit(handleFormSubmit)}
          title={t('profile.actions.save')}
          variant="Primary"
        />
      </View>
    </FormScreenContainer>
  );
}

export default UserName;
