import { joiResolver } from '@hookform/resolvers/joi';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import {
  Keyboard, Platform, ScrollView,
  Text, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { emitGuidanceAction, emitGuidanceInteraction } from '@/domains/guidance/guidanceRuntime';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import { reportTourField } from '@/domains/tour/tourTargetRegistry';
import { Joi } from '@/theme/strings';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Input from '@/components/molecules/input/Input';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import TourBubbleSlot from '@/components/molecules/tour/TourBubbleSlot';
import TourTarget from '@/components/molecules/tour/TourTarget';
import useTourScroller from '@/components/molecules/tour/useTourScroller';
import PhoneInput from '@/components/organisms/phoneInput/PhoneInput';
import TrainerInvitedModal from '@/components/organisms/trainerInvitedModal/TrainerInvitedModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import ClubStateView from '@/views/club/components/ClubStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetClub } from '@/services/club/clubQueries';
import { sendStaffInvitation } from '@/services/staffInvitation/staffInvitationService';

import { displayErrorAlert } from '@/utils/errors/displayError';
import { getFieldError } from '@/utils/form/formUtils';

import { useTour } from '@/context/useTour';
import useKeyboardFrame from '@/hooks/useKeyboardFrame';

// INVITE-STAFF (10/11, « 1A ») : on invite, on ne crée plus le compte. La personne remplit
// elle-même son nom et sa date de naissance ; le prénom ne sert qu'au message.
const defaultValues = {
  firstname: '',
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
  firstname: Joi.string().allow('').optional(),
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
// local state
  // GUIDE-D-CORR-2 : le guide fait défiler cet écran jusqu'à sa cible (useTourScroller).
  const tourScroll = useTourScroller();
  // GUIDE-D-CORR-3 (M1078) : clavier ouvert, « Envoyer » et « Annuler » mangeaient la place de la
  // saisie ; ils s'effacent (comme AddSponsor, TG-08) et reviennent clavier fermé. Quand le guide
  // montre « Envoyer », le clavier se ferme pour que le bouton soit là.
  const keyboard = useKeyboardFrame();
  const { currentStep: tourStep, tourStatus } = useTour();
  const isTourOnSend = tourStatus === 'active' && Boolean(tourStep?.targets?.includes('cf-send'));
  useEffect(() => {
    if (isTourOnSend) Keyboard.dismiss();
  }, [isTourOnSend]);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [createdTrainer, setCreatedTrainer] = useState(
    /** @type {{ expiresAt?: string, firstname?: string, lastname?: string, phoneHint?: string, phoneNumber?: string } | null} */
    (null),
  );
  // `club.roles.manage` exige l'offre Club : ces deux mutations sont les seules de l'ecran
  // qui peuvent revenir avec une decision d'abonnement, depuis que le serveur la transmet.
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  const { t } = useTranslation();
  const { Alignments, Fonts, Spaces } = useTheme();
  const { userData } = useAuth();
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

  // INVITE-STAFF (10/11, maquette validée) — une vraie invitation : la personne accepte ou
  // refuse. Le serveur répond PAREIL que le numéro ait un compte ou non (pas d'oracle) :
  // l'écran n'a qu'un seul succès, « Invitation envoyée ». Le guide compte M2 à l'envoi.
  const createTrainerMutation = useMutation({
    mutationFn: sendStaffInvitation,
    onError: (/** @type {any} */error) => {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      // Une seule alerte, traduite, jamais le message brut.
      displayErrorAlert(error);
    },
    // L'écran parle seul : le filet global (queryClient) se tait.
    meta: { preventToastError: true },
    onSuccess: (data, variables) => {
      emitGuidanceAction('staff.invited', { firstName: variables?.firstname || '' });
      setCreatedTrainer({ ...variables, ...(data?.invitation || {}) });
      // PETITSBUGS-3 (R4-34) : la feuille ne s'ouvre pas sur le clavier numérique.
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
      clubId: routeClubId || clubData?.documentId,
      firstname: data.firstname,
      phoneNumber: data.phoneNumber,
      role: isManagerMode ? 'dirigeant' : 'coach',
      teamId: isManagerMode ? null : sanitizeRouteParam(route?.params?.teamId) || null,
    });
  };

  const expiresOn = createdTrainer?.expiresAt
    ? new Date(createdTrainer.expiresAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    : '';
  const sentTitle = t('staffInvitation.sent.title', {
    name: createdTrainer?.firstname || t('staffInvitation.sent.fallbackName'),
    ...SANS_ECHAPPEMENT,
  });
  const sentText = t('staffInvitation.sent.description', {
    date: expiresOn,
    hint: createdTrainer?.phoneHint || '',
    role: isManagerMode ? t('staffInvitation.roles.dirigeant') : t('staffInvitation.roles.coach'),
    ...SANS_ECHAPPEMENT,
  });

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
                      placeholder={t('addCoach.fields.firstname.placeholder')}
                      ref={ref}
                      value={value}
                    />
                  )}
                />
              </TourTarget>
            </View>
          </ScrollView>
        </TourTarget>
        {/* GUIDE-D-CORR-4 (M1098) : la place de la bulle du guide (m2-fields), au-dessus des */}
        {/* boutons ; la zone rétrécit d'autant. Rien hors du guide. */}
        <TourBubbleSlot scrollRef={tourScroll.ref} />

        <View style={[Spaces.gap[4], keyboard && !isTourOnSend ? { display: 'none' } : null]}>
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
        libelleInviter={t('staffInvitation.sent.actions.sms')}
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
          setIsSuccessModalVisible(false);
          emitGuidanceInteraction('staff.invite.later');
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
        texte={sentText}
        titre={sentTitle}
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
