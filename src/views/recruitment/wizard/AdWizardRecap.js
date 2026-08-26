import { CommonActions } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import EventWizardTeamCard from '@/views/event/wizard/components/EventWizardTeamCard';

import { RouteNames } from '@/navigation/routeNames';

import { createRecruitmentAd } from '@/services/recruitment/recruitmentService';

import { resolveLocationDisplayLabel } from '@/utils/facilityAddressLabel';
import { getShortAddress } from '@/utils/location';

import { useAppFeedback } from '@/context/AppFeedbackContext';

/* eslint-disable perfectionist/sort-imports */
import { useAdWizard } from './AdWizardContext';
import {
  getAdWizardRecapStepIndex,
  getAdWizardStepCount,
  isAdWizardCoachProfileComplete,
  isAdWizardSportProfileComplete,
} from './adWizardStepUtils';
/* eslint-enable perfectionist/sort-imports */

/**
 * Compact recap metric card.
 * @param {object} props
 * @param {any} props.ApplicationStyle
 * @param {boolean} props.complete
 * @param {any} props.Fonts
 * @param {string} props.label
 * @param {any} props.Spaces
 * @param {string} props.value
 * @returns {import('react').ReactElement}
 */
function OverviewMetric({
  ApplicationStyle,
  complete,
  Fonts,
  label,
  Spaces,
  value,
}) {
  return (
    <View
      style={[
        ApplicationStyle.card,
        Spaces.paddingHorizontal[16],
        Spaces.paddingVertical[16],
        {
          alignItems: 'center',
          backgroundColor: 'rgba(1, 179, 244, 0.08)',
          borderColor: complete ? 'rgba(1, 179, 244, 0.22)' : 'rgba(1, 179, 244, 0.16)',
          flexDirection: 'row',
          justifyContent: 'space-between',
          minHeight: 76,
        },
      ]}
    >
      <Text style={[Fonts.p4Bold, Fonts.neutral300]}>{label}</Text>
      <Text
        numberOfLines={2}
        style={[
          Fonts.p3Bold,
          complete ? Fonts.neutral00 : Fonts.primary100,
          { flex: 1, textAlign: 'right' },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/**
 * Shared section shell for the recap step.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string} [props.eyebrow]
 * @param {() => void} [props.onEdit]
 * @param {string} props.title
 * @returns {import('react').ReactElement}
 */
function RecapSection({
  children,
  eyebrow,
  onEdit,
  title,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <View
      style={[
        ApplicationStyle.card,
        Spaces.padding[24],
        Spaces.gap[12],
        {
          backgroundColor: 'rgba(4, 31, 44, 0.82)',
          borderColor: 'rgba(1, 179, 244, 0.24)',
        },
      ]}
    >
      <View
        style={[
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          Spaces.gap[16],
          { flexWrap: 'wrap' },
        ]}
      >
        <View style={[Spaces.gap[8], { flex: 1 }]}>
          {eyebrow ? <Text style={[Fonts.p4Bold, Fonts.primary500]}>{eyebrow}</Text> : null}
          <Text style={[Fonts.h4, Fonts.neutral00]}>{title}</Text>
        </View>
        {onEdit ? (
          <TouchableOpacity onPress={onEdit}>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>Modifier</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Final step before publication.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function AdWizardRecap({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { showBanner } = useAppFeedback();
  const { dispatch, state } = useAdWizard();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);

  const createAdMutation = useMutation({
    meta: { preventToastError: true },
    mutationFn: createRecruitmentAd,
  });
  const isCoachAd = state?.audienceType === 'coach';

  const totalPlayers = useMemo(
    () => state.positions.reduce((sum, position) => sum + position.quantity, 0),
    [state.positions],
  );
  const totalCoachOpenings = Math.max(1, Number(state.coachQuantity || 1));

  const displayAddress = state.address
    ? resolveLocationDisplayLabel(state.address, getShortAddress(state.address))
    : getShortAddress(state.team?.club?.address || state.team?.club?.addressDetails);
  const selectedFacilityName = state.address?.facilityName || state.facility?.name || '';
  const shortAddress = state.address ? getShortAddress(state.address) : '';
  const overviewLocationLabel = selectedFacilityName || shortAddress || displayAddress || 'À compléter';

  const missingRequiredItems = useMemo(() => {
    const items = [];

    if (!state.team) items.push('une équipe');
    if (!displayAddress) items.push('un lieu');
    if (!state.section) items.push('une section');
    if (!state.category) items.push('une catégorie');
    if (!state.minLevel) items.push('un niveau minimum');
    if (isCoachAd) {
      if (!isAdWizardCoachProfileComplete(state)) items.push('un profil entraîneur complet');
    } else if (!state.positions?.length) {
      items.push('au moins un poste');
    }

    return items;
  }, [displayAddress, isCoachAd, state]);

  const isReadyToSubmit = missingRequiredItems.length === 0;
  const sportName = state.sport?.name || state.team?.activities?.[0]?.name || 'Non défini';
  const profileLabel = [
    state.section?.name,
    state.category?.name,
    state.minLevel?.name,
  ].filter(Boolean).join(' · ');
  const coachRoleLabel = state.coachRole === 'other'
    ? (state.coachRoleOther || 'À preciser')
    : (state.coachRole || 'À completer');
  const playerPositionsLabel = state.positions.length > 0
    ? `${state.positions.length} poste${state.positions.length > 1 ? 's' : ''} · ${totalPlayers} joueur${totalPlayers > 1 ? 's' : ''}`
    : 'À compléter';
  const coachPositionsLabel = `${totalCoachOpenings} role${totalCoachOpenings > 1 ? 's' : ''} · ${coachRoleLabel}`;
  const positionsLabel = isCoachAd ? coachPositionsLabel : playerPositionsLabel;
  const playerAdTypeLabel = state.event ? 'Annonce liée à une détection' : 'Annonce saisonnière';
  const resolvedAdTypeLabel = isCoachAd ? 'Annonce entraîneur' : playerAdTypeLabel;
  const needsSectionTitle = isCoachAd ? 'Rôle recherche' : 'Postes recherchés';
  const needsEditRoute = isCoachAd ? RouteNames.AdWizardCoachProfile : RouteNames.AdWizardPositions;
  const coachNeedsSummary = `${totalCoachOpenings} profil${totalCoachOpenings > 1 ? 's' : ''} coach recherche${totalCoachOpenings > 1 ? 's' : ''} pour le rôle ${coachRoleLabel}.`;
  const playerNeedsSummary = state.positions.length > 0
    ? `${totalPlayers} joueur${totalPlayers > 1 ? 's' : ''} recherché${totalPlayers > 1 ? 's' : ''} sur ${state.positions.length} poste${state.positions.length > 1 ? 's' : ''}.`
    : "Aucun poste n'à encore été ajouté.";
  const needsSummary = isCoachAd ? coachNeedsSummary : playerNeedsSummary;
  let validationLabel = 'Publication directe';

  if (state.event && !isCoachAd) {
    validationLabel = state.validationMode === 'manual'
      ? 'Validation manuelle'
      : 'Validation automatique';
  }

  const quickOverviewItems = [
    {
      complete: Boolean(state.team),
      label: 'Équipe',
      value: state.team?.name || 'À compléter',
    },
    {
      complete: isAdWizardSportProfileComplete(state),
      label: 'Profil',
      value: profileLabel || 'À préciser',
    },
    {
      complete: Boolean(displayAddress),
      label: 'Lieu',
      value: overviewLocationLabel,
    },
    {
      complete: isCoachAd ? isAdWizardCoachProfileComplete(state) : state.positions.length > 0,
      label: isCoachAd ? 'Role' : 'Postes',
      value: positionsLabel,
    },
  ];
  const completedQuickOverviewCount = quickOverviewItems.filter((item) => item.complete).length;
  const needsCardsContent = isCoachAd ? (
    <View
      style={[
        ApplicationStyle.card,
        Alignments.row,
        Alignments.justifySpaceBetween,
        Alignments.alignCenter,
        Spaces.paddingHorizontal[12],
        Spaces.paddingVertical[12],
        {
          backgroundColor: 'rgba(1, 179, 244, 0.08)',
          borderColor: 'rgba(1, 179, 244, 0.18)',
        },
      ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{coachRoleLabel}</Text>
      <View
        style={[
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[8],
          {
            backgroundColor: Colors.primary500,
            borderRadius: 999,
          },
        ]}
      >
        <Text style={[Fonts.p4Bold, { color: Colors.neutral900 }]}>
          x
          {totalCoachOpenings}
        </Text>
      </View>
    </View>
  ) : null;
  const playerNeedsCardsContent = state.positions.length > 0 ? state.positions.map((position) => (
    <View
      key={`${position.name}-${position.quantity}`}
      style={[
        ApplicationStyle.card,
        Alignments.row,
        Alignments.justifySpaceBetween,
        Alignments.alignCenter,
        Spaces.paddingHorizontal[12],
        Spaces.paddingVertical[12],
        {
          backgroundColor: 'rgba(1, 179, 244, 0.08)',
          borderColor: 'rgba(1, 179, 244, 0.18)',
        },
      ]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{position.name}</Text>
      <View
        style={[
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[8],
          {
            backgroundColor: Colors.primary500,
            borderRadius: 999,
          },
        ]}
      >
        <Text style={[Fonts.p4Bold, { color: Colors.neutral900 }]}>
          x
          {position.quantity}
        </Text>
      </View>
    </View>
  )) : (
    <Text style={[Fonts.p2, Fonts.primary100]}>
      {'Ajoute au moins un poste pour publier l\'annonce.'}
    </Text>
  );

  // R07 point 4 — ON ATTERRIT SUR L'ANNONCE QU'ON VIENT D'ECRIRE.
  //
  // Constat d'Adel du 2026-08-13 : « ce n'est pas intuitif d'appuyer sur la
  // fleche retour en haut a gauche pour fermer la page. Il faudrait qu'une
  // fois le recap valide, cela amene a l'endroit de mon annonce publiee ».
  //
  // La pile est reconstruite avec DEUX routes, et les deux comptent :
  //   · `HomeTab` en dessous  -> la fleche retour a une destination. Une pile
  //     reduite a la seule annonce laisserait un ecran dont on ne sort plus.
  //   · l'annonce au-dessus   -> c'est elle qu'on voit en arrivant.
  // Et le tunnel, lui, QUITTE la pile : c'est l'acquis D81. Sans ca, un seul
  // « Retour » reposait le doigt sur « Publier l'annonce » d'une annonce deja
  // publiee.
  //
  // ⚠️ `RecruitmentAdDetails` et `AdWizardStack` sont FRERES a la racine
  // (`PrivateNavigator.js`, l. 311 et 594) : c'est donc la pile du PARENT
  // qu'il faut refaire, jamais celle du tunnel.
  /**
   * @param {string} adDocumentId - L'identifiant de l'annonce a montrer. VIDE
   *   quand le serveur n'en a rendu aucun : on retombe alors sur l'accueil
   *   plutot que d'ouvrir une fiche sans contenu.
   * @returns {void}
   */
  const resetToPublishedAd = (adDocumentId) => {
    const routes = adDocumentId
      ? [
        { name: RouteNames.HomeTab },
        { name: RouteNames.RecruitmentAdDetails, params: { adId: adDocumentId } },
      ]
      : [{ name: RouteNames.HomeTab }];
    const rootNavigation = navigation.getParent?.();

    // Forme reprise TELLE QUELLE de `TeamWizardRecap.js` (l. 144-158), qui fait
    // deja exactement ca en production : `getParent()` puis `reset`. On ne
    // reinvente pas un troisieme mecanisme (§1 bis, barreau 2).
    if (rootNavigation?.reset) {
      rootNavigation.reset({ index: routes.length - 1, routes });
      return;
    }

    // Dernier recours, et c'est l'ANCIEN comportement : mieux vaut l'accueil
    // qu'un ecran fige.
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: RouteNames.HomeTab }] }));
  };

  const handleSubmit = async () => {
    if (!isReadyToSubmit) {
      showBanner({
        body: `Il manque encore ${missingRequiredItems.join(', ')} avant de publier cette annonce.`,
        title: 'Récapitulatif incomplet',
        tone: 'error',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmitErrorMessage('');
      createAdMutation.reset();

      const sharedData = {
        address: state.address || undefined,
        audienceType: isCoachAd ? 'coach' : 'player',
        category: state.category?.documentId || state.category?.id,
        description: state.description || undefined,
        level: state.minLevel?.documentId || state.minLevel?.id,
        section: state.section?.documentId || state.section?.id,
        team: state.team?.documentId || state.team?.id,
        type: state.event && !isCoachAd ? 'ponctuel' : 'saison',
      };

      // R07 — les annonces creees sont RETENUES : c'est leur identifiant qui
      // permet d'atterrir dessus. Un brief a plusieurs postes en cree une PAR
      // poste ; il n'existe pas d'ecran « mes annonces » dans `routeNames.js`,
      // on montre donc la premiere. Ca vaut toujours mieux que de renvoyer a
      // l'accueil sans rien montrer.
      /** @type {any[]} */
      let createdAds = [];

      if (isCoachAd) {
        createdAds = [await createAdMutation.mutateAsync({
          ...sharedData,
          availabilityText: state.availabilityText || undefined,
          certificationsWanted: state.certificationsWanted || [],
          coachExperienceLevel: state.coachExperienceLevel || undefined,
          coachRole: state.coachRole || undefined,
          coachRoleOther: state.coachRole === 'other' ? state.coachRoleOther || undefined : undefined,
          engagementType: state.engagementType || undefined,
          missions: state.missions || undefined,
          quantity: totalCoachOpenings,
          validationMode: 'manual',
        })];
      } else {
        createdAds = await Promise.all(state.positions.map((position) => createAdMutation
          .mutateAsync({
            ...sharedData,
            event: state.event?.documentId || state.event?.id,
            position: position.name,
            quantity: position.quantity,
            validationMode: state.event ? state.validationMode : 'auto',
          })));
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] }),
        queryClient.invalidateQueries({ queryKey: ['myRecruitmentAds'] }),
      ]);

      // Le serveur pourrait ne rien renvoyer d'exploitable : dans ce cas
      // `resetToPublishedAd` retombe sur l'accueil, l'ancien comportement.
      // ⛔ Jamais d'ecran blanc : `RecruitmentAdDetails` sans identifiant
      // n'afficherait rien du tout.
      const publishedAd = createdAds.find((ad) => ad?.documentId || ad?.id);

      dispatch({ type: 'RESET' });
      resetToPublishedAd(publishedAd?.documentId || publishedAd?.id || '');
    } catch (error) {
      const subscriptionDecision = extractSubscriptionDecisionFromError(error);
      if (subscriptionDecision) {
        setSubscriptionPaywallDecision(subscriptionDecision);
        return;
      }
      const nextMessage = error?.message || "Impossible de créer l'annonce. Vérifie les informations puis réessaie.";
      setSubmitErrorMessage(nextMessage);
      showBanner({
        body: nextMessage,
        title: 'Publication impossible',
        tone: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <WizardStepLayout
        isNextDisabled={!isReadyToSubmit || isSubmitting}
        isNextLoading={isSubmitting}
        nextLabel="Publier l'annonce"
        onBack={() => navigation.goBack()}
        onNext={handleSubmit}
        stepCount={getAdWizardStepCount(state)}
        stepIndex={getAdWizardRecapStepIndex(state)}
        subtitle="Vérifie l'ensemble du brief avant de publier ton annonce."
        title="Récapitulatif"
      >
        <View style={[Spaces.gap[24], Spaces.paddingBottom[32]]}>
          {!isReadyToSubmit ? (
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[24],
                Spaces.gap[16],
                {
                  backgroundColor: 'rgba(53, 19, 24, 0.88)',
                  borderColor: 'rgba(239, 68, 68, 0.45)',
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Récapitulatif incomplet</Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                Il manque encore
                {' '}
                {missingRequiredItems.join(', ')}
                {' '}
                avant de publier cette annonce.
              </Text>
            </View>
          ) : null}

          {submitErrorMessage ? (
            <View
              style={[
                ApplicationStyle.card,
                Spaces.padding[24],
                Spaces.gap[16],
                {
                  backgroundColor: 'rgba(53, 19, 24, 0.88)',
                  borderColor: 'rgba(239, 68, 68, 0.45)',
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {'La publication n\'a pas abouti'}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>{submitErrorMessage}</Text>
            </View>
          ) : null}

          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Spaces.gap[16],
              {
                backgroundColor: 'rgba(4, 31, 44, 0.82)',
                borderColor: isReadyToSubmit ? 'rgba(1, 179, 244, 0.30)' : 'rgba(1, 179, 244, 0.18)',
              },
            ]}
          >
            <View
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifySpaceBetween,
                Spaces.gap[16],
                { flexWrap: 'wrap' },
              ]}
            >
              <View style={[Spaces.gap[12], { flex: 1 }]}>
                <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                  {'Vue d\'ensemble'}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {completedQuickOverviewCount}
                  {' '}
                  / 4 informations clés prêtes à publier
                </Text>
              </View>
              <View
                style={[
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[8],
                  {
                    backgroundColor: isReadyToSubmit ? 'rgba(1, 179, 244, 0.14)' : 'rgba(1, 179, 244, 0.10)',
                    borderColor: isReadyToSubmit ? 'rgba(1, 179, 244, 0.28)' : 'rgba(1, 179, 244, 0.18)',
                    borderRadius: 999,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, isReadyToSubmit ? Fonts.primary500 : Fonts.primary100]}>
                  {isReadyToSubmit ? 'Prêt à publier' : 'À compléter'}
                </Text>
              </View>
            </View>

            <View style={[Spaces.gap[12]]}>
              {quickOverviewItems.map((item) => (
                <OverviewMetric
                  ApplicationStyle={ApplicationStyle}
                  complete={item.complete}
                  Fonts={Fonts}
                  key={item.label}
                  label={item.label}
                  Spaces={Spaces}
                  value={item.value}
                />
              ))}
            </View>
          </View>

          <RecapSection
            eyebrow="Équipe qui recrute"
            onEdit={() => navigation.navigate(RouteNames.AdWizardTeam)}
            title="Structure"
          >
            {state.team ? (
              <EventWizardTeamCard
                onPress={() => navigation.navigate(RouteNames.AdWizardTeam)}
                team={state.team}
              />
            ) : (
              <Text style={[Fonts.p2, Fonts.primary100]}>Aucune équipe sélectionnée</Text>
            )}

            <View style={[Spaces.gap[12]]}>
              <OverviewMetric
                ApplicationStyle={ApplicationStyle}
                complete={Boolean(sportName && sportName !== 'Non défini')}
                Fonts={Fonts}
                label="Sport"
                Spaces={Spaces}
                value={sportName}
              />
              <OverviewMetric
                ApplicationStyle={ApplicationStyle}
                complete={Boolean(profileLabel)}
                Fonts={Fonts}
                label="Profil"
                Spaces={Spaces}
                value={profileLabel || 'À préciser'}
              />
            </View>
          </RecapSection>

          <RecapSection
            eyebrow="Besoins"
            onEdit={() => navigation.navigate(needsEditRoute)}
            title={needsSectionTitle}
          >
            <Text style={[Fonts.p2, Fonts.neutral100]}>{needsSummary}</Text>

            <View style={[Spaces.gap[12]]}>
              {isCoachAd ? needsCardsContent : playerNeedsCardsContent}
            </View>
          </RecapSection>

          <RecapSection
            eyebrow="Publication"
            onEdit={() => navigation.navigate(RouteNames.AdWizardInfo)}
            title="Ciblage sportif"
          >
            <View style={[Spaces.gap[16]]}>
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral300]}>Sport</Text>
                <Text style={[Fonts.p2, Fonts.neutral00]}>{sportName}</Text>
              </View>

              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral300]}>Profil</Text>
                <Text style={[Fonts.p2, profileLabel ? Fonts.neutral00 : Fonts.primary100]}>
                  {profileLabel || 'À préciser'}
                </Text>
              </View>

              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {'Type d\'annonce'}
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral00]}>{resolvedAdTypeLabel}</Text>
              </View>

              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral300]}>Validation</Text>
                <Text style={[Fonts.p2, Fonts.neutral00]}>{validationLabel}</Text>
              </View>

              {state.event ? (
                <View style={[Spaces.gap[8]]}>
                  <Text style={[Fonts.p3, Fonts.neutral300]}>Détection liée</Text>
                  <Text style={[Fonts.p2, Fonts.neutral00]}>
                    {state.event.name || state.event.type?.name || 'Événement'}
                  </Text>
                </View>
              ) : null}
            </View>
          </RecapSection>

          <RecapSection
            eyebrow="Lieu"
            onEdit={() => navigation.navigate(RouteNames.AdWizardLocation)}
            title="Lieu de publication"
          >
            {selectedFacilityName ? (
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral300]}>Installation sélectionnée</Text>
                <Text style={[Fonts.p2, Fonts.neutral00]}>{selectedFacilityName}</Text>
              </View>
            ) : null}

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p3, Fonts.neutral300]}>{selectedFacilityName ? 'Adresse' : 'Lieu'}</Text>
              <Text style={[Fonts.p2, displayAddress ? Fonts.neutral00 : Fonts.primary100]}>
                {displayAddress || 'À compléter'}
              </Text>
            </View>
          </RecapSection>

          <RecapSection
            eyebrow="Texte de l'annonce"
            onEdit={() => navigation.navigate(RouteNames.AdWizardDescription)}
            title={isCoachAd ? 'Description et missions' : 'Description'}
          >
            <Text style={[Fonts.p2, state.description ? Fonts.neutral100 : Fonts.neutral300]}>
              {state.description || "Aucune description personnalisée n'a été ajoutée."}
            </Text>
            {isCoachAd ? (
              <Text style={[Fonts.p2, state.missions ? Fonts.neutral100 : Fonts.neutral300]}>
                {state.missions || 'Aucune mission détaillée n à encore été ajoutée.'}
              </Text>
            ) : null}
          </RecapSection>

          <View
            style={[
              ApplicationStyle.card,
              Spaces.padding[24],
              Spaces.gap[16],
              {
                backgroundColor: 'rgba(1, 179, 244, 0.10)',
                borderColor: 'rgba(1, 179, 244, 0.24)',
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>Avant publication</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {isCoachAd
                ? "L'annonce sera visible dans le flux recrutement avec un badge entraîneur. Plus le rôle, les missions et le cadre sont precis, plus les candidatures seront pertinentes."
                : "L'annonce sera visible par les joueurs correspondant au profil recherche. Plus tes informations sont precises, plus la mise en relation sera pertinente."}
            </Text>
          </View>
        </View>
      </WizardStepLayout>

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={state.team?.club?.documentId || null}
        contextLabel="Ton annonce de recrutement"
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
        resumeRouteName={RouteNames.AdWizardStack}
        resumeRouteParams={{ screen: RouteNames.AdWizardRecap }}
      />
    </>
  );
}

export default AdWizardRecap;
