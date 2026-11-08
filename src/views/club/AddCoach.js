import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Alert, Keyboard, Platform, ScrollView,
  Text, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { emitGuidanceAction, emitGuidanceInteraction } from '@/domains/guidance/guidanceRuntime';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { reportTourField } from '@/domains/tour/tourTargetRegistry';
import { Joi } from '@/theme/strings';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import TourTarget from '@/components/molecules/tour/TourTarget';
import useTourScroller from '@/components/molecules/tour/useTourScroller';
import PhoneInput from '@/components/organisms/phoneInput/PhoneInput';
import TrainerInvitedModal from '@/components/organisms/trainerInvitedModal/TrainerInvitedModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ClubStateView from '@/views/club/components/ClubStateView';

import { RouteNames } from '@/navigation/routeNames';

import { createManager, createTrainer } from '@/services/auth/authService';
import { useGetClub } from '@/services/club/clubQueries';

import { displayErrorAlert } from '@/utils/errors/displayError';
import { getFieldError } from '@/utils/form/formUtils';

const defaultValues = {
  birthdate: '',
  firstname: '',
  lastname: '',
  phoneNumber: '',
};

// D51 ecran 10 : les deux formulaires de staff etaient DEJA le meme composant,
// mais le role etait impose par la route. Un dirigeant entre par la mauvaise
// porte devait ressortir et recommencer. Le role devient un etat de l'ecran :
// la route ne fait plus que choisir la valeur de depart.
const STAFF_ROLES = {
  MANAGER: 'manager',
  TRAINER: 'trainer',
};

// Pilule de role : 44 pt de haut, libelle jamais tronque (« Entraineur·e » est
// un libelle systeme, il ne s'abrege pas).
const ROLE_PILL_STYLE = {
  flex: 1,
  minHeight: 44,
};

const addCoachSchema = Joi.object({
  birthdate: Joi.string().pattern(/^(\d{2}\/\d{2}\/\d{4})?$/).allow('').optional(),
  firstname: Joi.string().allow('').optional(),
  lastname: Joi.string().allow('').optional(),
  phoneNumber: Joi.string().required(),
}).unknown(true);

/**
 * @param {unknown} value
 * @returns {string}
 */
const sanitizeRouteParam = (value) => {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue || normalizedValue.startsWith(':')) {
    return '';
  }

  return normalizedValue;
};

/**
 * Add coach screen component. Allows club managers to add a new coach.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Add coach screen component
 */
function AddCoach({ navigation, route }) {
  // GUIDE-D-CORR-2 : le guide fait défiler cet écran jusqu'à sa cible (useTourScroller).
  const tourScroll = useTourScroller();
// local state
  const [avatar, setAvatar] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [createdTrainer, setCreatedTrainer] = useState(
    /** @type {{ firstname?: string, lastname?: string, phoneNumber?: string } | null} */
    (null),
  );
  // `club.roles.manage` exige l'offre Club : ces deux mutations sont les seules de l'ecran
  // qui peuvent revenir avec une decision d'abonnement, depuis que le serveur la transmet.
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  const { t } = useTranslation();
  const { Alignments, Fonts, Spaces } = useTheme();
  const { formatBirthdateToDisplay, userData } = useAuth();
  const openedAsManager = route?.name === RouteNames.AddClubManager
    || route?.params?.staffType === STAFF_ROLES.MANAGER;
  const [staffRole, setStaffRole] = useState(
    openedAsManager ? STAFF_ROLES.MANAGER : STAFF_ROLES.TRAINER,
  );
  const isManagerMode = staffRole === STAFF_ROLES.MANAGER;
  const routeClubId = sanitizeRouteParam(route?.params?.clubId);
  const routeClubName = String(route?.params?.clubName || '').trim();
  const {
    data: clubData,
    error: clubError,
    isLoading: isLoadingClub,
    refetch: refetchClub,
  } = useGetClub(routeClubId, {
    enabled: !!routeClubId,
  });
  const resolvedClubName = routeClubName || clubData?.name || userData?.club?.name || t(
    'addCoach.fallbacks.clubName',
    'Club',
  );
  /**
   * @param {string | undefined} firstname
   * @param {string | undefined} lastname
   * @param {string | undefined} fallbackPhone
   * @returns {string}
   */
  const successEntityName = (firstname, lastname, fallbackPhone) => (
    [firstname, lastname].filter(Boolean).join(' ').trim() || fallbackPhone || (isManagerMode ? t(
      'addCoach.fallbacks.managerName',
      'dirigeant',
    ) : t(
      'addCoach.fallbacks.coachName',
      'coach',
    ))
  );

  const {
    control,
    formState: { errors: formErrors },
    handleSubmit,
    setFocus,
    watch,
  } = useForm({
    defaultValues,
    mode: 'onBlur',
    resolver: joiResolver(addCoachSchema),
    shouldFocusError: false,
  });

  // Guide Dirigeant·e, M2 : « Suivant » de la bulle demande le numéro ; la saisie vit ici.
  const phoneNumber = watch('phoneNumber');
  useEffect(() => { reportTourField('cf.phone', Boolean(phoneNumber)); }, [phoneNumber]);

  const { invitationDuStaff, inviteTrainer } = useAuth();

  const createTrainerMutation = useMutation({
    mutationFn: isManagerMode ? createManager : createTrainer,
    onError: (/** @type {import('axios').AxiosError} */error, variables) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }

      // PETITSBUGS-3 : le service aplatit l'erreur (`buildPreservedApiError`) ; ses
      // `details` restent sur l'erreur, plus sous `response`. Lus sous les deux
      // formes : sinon « Failed to create trainer: Uniqueness check failed » brut,
      // puis l'alerte du filet global (2 alertes, rejeu 4).
      const details = /** @type {any} */ (error)?.details
        || /** @type {any} */ (error)?.response?.data?.error?.details;
      // SECU-NOM-NUMERO (decision « 119- A ») : un numero deja inscrit ne dit plus
      // QUI le detient, ni dans quel club. Le serveur ne dit que « deja dans CE club ».
      if (details?.code === 'PHONE_NUMBER_TAKEN' && details.sameClub) {
        Alert.alert(
          t('addCoach.alerts.alreadyInThisClub.title'),
          t('addCoach.alerts.alreadyInThisClub.description'),
        );
      } else if (details?.code === 'PHONE_NUMBER_TAKEN') {
        Alert.alert(
          t('addCoach.alerts.invitation.title'),
          t('addCoach.alerts.invitation.description'),
          [
            { style: 'cancel', text: t('common.cancel', 'Annuler') },
            {
              onPress: () => {
                // Le guide avance comme apres l'ancien rattachement direct.
                emitGuidanceAction('staff.linked');
                inviteTrainer({
                  clubId: routeClubId || clubData?.documentId || userData?.club?.documentId,
                  clubName: resolvedClubName,
                  firstname: variables?.firstname || (isManagerMode
                    ? t('addCoach.roles.manager')
                    : t('addCoach.fallbacks.inviteFirstname', 'Coach / Prof')),
                  isManager: isManagerMode,
                  phoneNumber: variables?.phoneNumber,
                });
                navigation.goBack();
              },
              text: t('addCoach.alerts.invitation.actions.send'),
            },
          ],
        );
      } else {
        // Une seule alerte, traduite (code EMAIL_TAKEN…), jamais le message brut.
        displayErrorAlert(error);
      }
    },
    // L'écran parle seul : le filet global (queryClient) se tait.
    meta: { preventToastError: true },
    onSuccess: (data, variables) => {
      emitGuidanceAction('staff.invited', { firstName: variables?.firstname || '' });
      setCreatedTrainer({ ...(data || {}), ...variables });
      // INVITESMS (29/10/2026, decision d'Adel « 2- A ») — le dirigeant aussi : la feuille
      // d'invitation (SMS pre-rempli) au lieu d'une alerte, sinon personne ne le previent.
      // PETITSBUGS-3 (R4-34) : « Ajout réussi ! » s'ouvrait sur le clavier numérique.
      Keyboard.dismiss();
      setIsSuccessModalVisible(true);
    },
  });

  /**
   * Handle form submit
   * @param {typeof defaultValues} data
   */
  const handleFormSubmit = (data) => {
    createTrainerMutation.mutate({
      ...data,
      avatar,
      clubId: routeClubId || clubData?.documentId,
    });
  };

  if (!routeClubId) {
    return (
      <ClubStateView
        description={t(
          'addCoach.state.missingClub.description',
          "Impossible d'ouvrir ce formulaire sans club valide. Reviens à la fiche club puis "
            + "relance l'ajout.",
        )}
        title={t('addCoach.state.missingClub.title', 'Club introuvable')}
      />
    );
  }

  if (isLoadingClub && !clubData) {
    return (
      <ClubStateView
        description={isManagerMode
          ? t(
            'addCoach.state.loading.managerDescription',
            "Nous récupérons les informations de la section pour préparer l'ajout du dirigeant.",
          )
          : t(
            'addCoach.state.loading.trainerDescription',
            "Nous récupérons les informations du club pour préparer l'ajout du coach.",
          )}
        isLoading
        title={isManagerMode ? t(
          'addCoach.state.loading.managerTitle',
          'Chargement de la section',
        ) : t(
          'addCoach.state.loading.trainerTitle',
          'Chargement du club',
        )}
      />
    );
  }

  if (clubError && !clubData) {
    return (
      <ClubStateView
        actionLabel={t('addCoach.state.loadError.retry', 'Réessayer')}
        description={t(
          'addCoach.state.loadError.description',
          'Impossible de charger ce club pour le moment.',
        )}
        onAction={() => refetchClub()}
        title={t('addCoach.state.loadError.title', 'Ajout indisponible')}
      />
    );
  }

  if (!isLoadingClub && !clubError && !clubData) {
    return (
      <ClubStateView
        actionLabel={t('addCoach.state.notFound.refresh', 'Actualiser')}
        description={t(
          'addCoach.state.notFound.description',
          "Ce club est introuvable ou n'est plus accessible.",
        )}
        onAction={() => refetchClub()}
        title={t('addCoach.state.missingClub.title', 'Club introuvable')}
      />
    );
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        // D63 : l ecran n avait AUCUNE marge laterale — champs, pilules de
        // role et bouton touchaient les deux bords. Posee ici, elle vaut aussi
        // pour le CTA, qui vit hors du defilement.
        // CORR-SOCLE (30/10, point 6) : sur le site, le conteneur pose deja 24 (40 avant).
        Platform.OS === 'web' ? null : Spaces.paddingHorizontal[16],
        // R5-48 (REJEU-5) : borne le contenu a l'ecran (ScreenContainer le pose en `flexGrow`) ;
        // sans elle le ScrollView ne defilait pas et la date restait sous le bouton.
        Alignments.fill,
      ]}
      keyboardAvoiding
    >
      {/* 🤖 ANDROIDBAR-4 — l'évitement du clavier est celui du ScreenContainer : le
          décalage écrit en dur (100) laissait 20 dp de vide sous le formulaire une fois le
          clavier refermé, et passait 10 dp SOUS le clavier sur Android 15/16 (Pixel 9). */}
      <View
        style={[
          Alignments.fill,
          Alignments.justifySpaceBetween,
        ]}
      >
        <TourTarget clipChildren id="cf-zone" style={[Alignments.fill]}>
          <ScrollView
            contentContainerStyle={[
              Spaces.gap[24],
              Spaces.paddingBottom[40],
            ]}
            onScroll={tourScroll.onScroll}
            ref={tourScroll.ref}
            scrollEventThrottle={16}
            style={[Alignments.fill]}
          >
            <View style={[Alignments.fill, Spaces.gap[24]]}>
              <View style={[Alignments.row, Spaces.marginVertical[24]]}>
                <SelectAvatar
                  currentAvatar={avatar}
                  onAvatarSelected={setAvatar}
                  size={110}
                />
              </View>

              <TourTarget id="cf-role" style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                  {t('addCoach.fields.role.label')}
                </Text>
                <View style={[Alignments.row, Spaces.gap[8]]}>
                  {[
                    [STAFF_ROLES.MANAGER, t('addCoach.roles.manager')],
                    [STAFF_ROLES.TRAINER, t('addCoach.roles.trainer')],
                  ].map(([roleValue, roleLabel]) => {
                    const isActive = staffRole === roleValue;
                    return (
                      <Button
                        accessibilityRole="radio"
                        accessibilityState={{ selected: isActive }}
                        key={roleValue}
                        onPress={() => setStaffRole(roleValue)}
                        style={ROLE_PILL_STYLE}
                        title={roleLabel}
                        variant={isActive ? 'Primary' : 'SecondaryLight'}
                      />
                    );
                  })}
                </View>
              </TourTarget>

              <TourTarget id="cf-fields" style={[Spaces.gap[24]]}>
                <Controller
                  control={control}
                  name="phoneNumber"
                  render={({
                    field: {
                      name, onBlur, onChange, ref, value,
                    },
                  }) => (
                    <PhoneInput
                      error={getFieldError({ errors: formErrors, fieldName: name })}
                      label={t('addCoach.fields.phoneNumber.label')}
                      onBlur={onBlur}
                      onChange={onChange}
                      ref={ref}
                      value={value}
                    />
                  )}
                />

                {/* Dit AVANT l'envoi ce que le numero declenche : sans cette ligne, */}
                {/* le SMS partait sans que personne l'ait annonce. */}
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t('addCoach.hints.invitation')}
                </Text>
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
                      label={t('addCoach.fields.firstname.label')}
                      onBlur={onBlur}
                      onChangeText={onChange}
                      onSubmitEditing={() => setFocus('lastname')}
                      placeholder={t('addCoach.fields.firstname.placeholder')}
                      ref={ref}
                      value={value}
                    />
                  )}
                />
              </TourTarget>
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
                    label={t('addCoach.fields.lastname.label')}
                    onBlur={onBlur}
                    onChangeText={onChange}
                    onSubmitEditing={() => setFocus('birthdate')}
                    placeholder={t('addCoach.fields.lastname.placeholder')}
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
                    label={t('addCoach.fields.birthdate.label')}
                    maxLength={10}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(formatBirthdateToDisplay(text))}
                    placeholder={t('addCoach.fields.birthdate.placeholder', 'JJ/MM/AAAA')}
                    ref={ref}
                    value={value}
                  />
                )}
              />
            </View>
          </ScrollView>
        </TourTarget>

        <View style={[Spaces.gap[4]]}>
          <TourTarget id="cf-send">
            <Button
              disabled={!!Object.keys(formErrors).length}
              isLoading={createTrainerMutation.isPending}
              onPress={handleSubmit(handleFormSubmit)}
              title={t('addCoach.actions.save')}
              variant="Primary"
            />
          </TourTarget>
          {/* D63 : la maquette pose « Annuler » sous chacun de ses CTA. Sans */}
          {/* lui, le seul retour en arriere etait la fleche de l en-tete. */}
          <Button
            onPress={() => navigation.goBack()}
            title={t('common.cancel', 'Annuler')}
            variant="Ghost"
          />
        </View>
      </View>
      <TrainerInvitedModal
        isManager={isManagerMode}
        isVisible={isSuccessModalVisible}
        // RETOURS-TESTEUR-2 (M0077) : sur ordinateur, ce texte se copie ou part par e-mail.
        messageDInvitation={createdTrainer ? invitationDuStaff?.({
          clubId: routeClubId || clubData?.documentId || userData?.club?.documentId,
          clubName: resolvedClubName,
          firstname: createdTrainer.firstname || (isManagerMode
            ? t('addCoach.roles.manager')
            : t('addCoach.fallbacks.inviteFirstname', 'Coach / Prof')),
          isManager: isManagerMode,
        })?.message : ''}
        onClose={() => {
          emitGuidanceInteraction('staff.invite.later');
          setIsSuccessModalVisible(false);
          navigation.goBack();
        }}
        onInvite={() => {
          emitGuidanceInteraction('staff.sms.opened');
          if (createdTrainer) {
            inviteTrainer({
              clubId: routeClubId || clubData?.documentId || userData?.club?.documentId,
              clubName: resolvedClubName,
              firstname: createdTrainer.firstname || (isManagerMode
                ? t('addCoach.roles.manager')
                : t('addCoach.fallbacks.inviteFirstname', 'Coach / Prof')),
              isManager: isManagerMode,
              phoneNumber: createdTrainer.phoneNumber,
            });
          }
          setIsSuccessModalVisible(false);
          navigation.goBack();
        }}
        trainerName={successEntityName(
          createdTrainer?.firstname,
          createdTrainer?.lastname,
          createdTrainer?.phoneNumber,
        )}
      />

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={routeClubId || clubData?.documentId || userData?.club?.documentId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </ScreenContainer>
  );
}

export default AddCoach;
