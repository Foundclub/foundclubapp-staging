import { CommonActions } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import EventWizardTeamCard from '@/views/event/wizard/components/EventWizardTeamCard';

import { RouteNames } from '@/navigation/routeNames';

import { createRecruitmentAd } from '@/services/recruitment/recruitmentService';

import { getShortAddress } from '@/utils/location';

import { useAppFeedback } from '@/context/AppFeedbackContext';

/* eslint-disable import/order, perfectionist/sort-imports */
import { useAdWizard } from './AdWizardContext';
import {
  getAdWizardRecapStepIndex,
  getAdWizardStepCount,
} from './adWizardStepUtils';
/* eslint-enable import/order, perfectionist/sort-imports */

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
        Spaces.paddingHorizontal[14],
        Spaces.paddingVertical[14],
        Spaces.gap[12],
        {
          backgroundColor: 'rgba(1, 179, 244, 0.08)',
          borderColor: complete ? 'rgba(1, 179, 244, 0.22)' : 'rgba(255, 219, 102, 0.26)',
          flexBasis: '48%',
        },
      ]}
    >
      <Text style={[Fonts.p4Bold, Fonts.neutral300]}>{label}</Text>
      <Text numberOfLines={2} style={[Fonts.p3Bold, complete ? Fonts.neutral00 : Fonts.gold500]}>
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
        Spaces.gap[24],
        {
          backgroundColor: 'rgba(4, 31, 44, 0.82)',
          borderColor: 'rgba(1, 179, 244, 0.24)',
        },
      ]}
    >
      <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[16]]}>
        <View style={[Spaces.gap[12], { flex: 1 }]}>
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

  const createAdMutation = useMutation({
    mutationFn: createRecruitmentAd,
  });
  const isCoachAd = state?.audienceType === 'coach';

  const totalPlayers = useMemo(
    () => state.positions.reduce((sum, position) => sum + position.quantity, 0),
    [state.positions],
  );
  const totalCoachOpenings = Math.max(1, Number(state.coachQuantity || 1));

  const displayAddress = state.address
    ? (state.address.label || getShortAddress(state.address))
    : getShortAddress(state.team?.club?.address || state.team?.club?.addressDetails);

  const missingRequiredItems = useMemo(() => {
    const items = [];

    if (!state.team) items.push('une \u00E9quipe');
    if (!displayAddress) items.push('un lieu');
    if (isCoachAd) {
      if (!state.coachRole) items.push('un role entraineur');
      if (state.coachRole === 'other' && !String(state.coachRoleOther || '').trim()) {
        items.push('un role precise');
      }
    } else if (!state.positions?.length) {
      items.push('au moins un poste');
    }

    return items;
  }, [displayAddress, isCoachAd, state.coachRole, state.coachRoleOther, state.positions, state.team]);

  const isReadyToSubmit = missingRequiredItems.length === 0;
  const sportName = state.sport?.name || state.team?.activities?.[0]?.name || 'Non d\u00E9fini';
  const profileLabel = [
    state.section?.name,
    state.category?.name,
    state.minLevel?.name,
  ].filter(Boolean).join(' \u00B7 ');
  const coachRoleLabel = state.coachRole === 'other'
    ? (state.coachRoleOther || '\u00C0 preciser')
    : (state.coachRole || '\u00C0 completer');
  const playerPositionsLabel = state.positions.length > 0
    ? `${state.positions.length} poste${state.positions.length > 1 ? 's' : ''} \u00B7 ${totalPlayers} joueur${totalPlayers > 1 ? 's' : ''}`
    : '\u00C0 compl\u00E9ter';
  const coachPositionsLabel = `${totalCoachOpenings} role${totalCoachOpenings > 1 ? 's' : ''} \u00B7 ${coachRoleLabel}`;
  const positionsLabel = isCoachAd ? coachPositionsLabel : playerPositionsLabel;
  const playerAdTypeLabel = state.event ? 'Annonce li\u00E9e \u00E0 une d\u00E9tection' : 'Annonce saisonni\u00E8re';
  const resolvedAdTypeLabel = isCoachAd ? 'Annonce entraineur' : playerAdTypeLabel;
  const needsSectionTitle = isCoachAd ? 'Role recherche' : 'Postes recherch\u00E9s';
  const needsEditRoute = isCoachAd ? RouteNames.AdWizardCoachProfile : RouteNames.AdWizardPositions;
  const coachNeedsSummary = `${totalCoachOpenings} profil${totalCoachOpenings > 1 ? 's' : ''} coach recherche${totalCoachOpenings > 1 ? 's' : ''} pour le role ${coachRoleLabel}.`;
  const playerNeedsSummary = state.positions.length > 0
    ? `${totalPlayers} joueur${totalPlayers > 1 ? 's' : ''} recherch\u00E9${totalPlayers > 1 ? 's' : ''} sur ${state.positions.length} poste${state.positions.length > 1 ? 's' : ''}.`
    : "Aucun poste n'a encore \u00E9t\u00E9 ajout\u00E9.";
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
      label: '\u00C9quipe',
      value: state.team?.name || '\u00C0 compl\u00E9ter',
    },
    {
      complete: Boolean(profileLabel),
      label: 'Profil',
      value: profileLabel || '\u00C0 pr\u00E9ciser',
    },
    {
      complete: Boolean(displayAddress),
      label: 'Lieu',
      value: displayAddress || '\u00C0 compl\u00E9ter',
    },
    {
      complete: isCoachAd ? Boolean(state.coachRole) : state.positions.length > 0,
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
          Spaces.paddingHorizontal[10],
          Spaces.paddingVertical[6],
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
          Spaces.paddingHorizontal[10],
          Spaces.paddingVertical[6],
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
    <Text style={[Fonts.p2, Fonts.gold500]}>
      {'Ajoutez au moins un poste pour publier l\'annonce.'}
    </Text>
  );

  const resetToHome = () => {
    const parentNavigation = navigation.getParent?.();

    if (parentNavigation?.dispatch) {
      parentNavigation.dispatch(CommonActions.reset({
        index: 0,
        routes: [{ name: RouteNames.HomeTab }],
      }));
      return;
    }

    navigation.navigate(RouteNames.HomeTab);
  };

  const handleSubmit = async () => {
    if (!isReadyToSubmit) {
      showBanner({
        body: `Il manque encore ${missingRequiredItems.join(', ')} avant de publier cette annonce.`,
        title: 'R\u00E9capitulatif incomplet',
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

      if (isCoachAd) {
        await createAdMutation.mutateAsync({
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
        });
      } else {
        await Promise.all(state.positions.map((position) => createAdMutation.mutateAsync({
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

      dispatch({ type: 'RESET' });
      resetToHome();
    } catch (error) {
      const nextMessage = error?.message || "Impossible de cr\u00E9er l'annonce. V\u00E9rifiez les informations puis r\u00E9essayez.";
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
    <WizardStepLayout
      isNextDisabled={!isReadyToSubmit || isSubmitting}
      isNextLoading={isSubmitting}
      nextLabel="Publier l'annonce"
      onBack={() => navigation.goBack()}
      onNext={handleSubmit}
      stepCount={getAdWizardStepCount(state)}
      stepIndex={getAdWizardRecapStepIndex(state)}
      subtitle={"V\u00E9rifiez l'ensemble du brief avant de publier votre annonce."}
      title={'R\u00E9capitulatif'}
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
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{'R\u00E9capitulatif incomplet'}</Text>
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
            Spaces.gap[24],
            {
              backgroundColor: 'rgba(4, 31, 44, 0.82)',
              borderColor: isReadyToSubmit ? 'rgba(1, 179, 244, 0.30)' : 'rgba(255, 219, 102, 0.26)',
            },
          ]}
        >
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[16]]}>
            <View style={[Spaces.gap[12], { flex: 1 }]}>
              <Text style={[Fonts.p2Bold, Fonts.primary500]}>
                {'Vue d\'ensemble'}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {completedQuickOverviewCount}
                {' '}
                / 4 informations cl\u00E9s pr\u00EAtes \u00E0 publier
              </Text>
            </View>
            <View
              style={[
                Spaces.paddingHorizontal[10],
                Spaces.paddingVertical[6],
                {
                  backgroundColor: isReadyToSubmit ? 'rgba(1, 179, 244, 0.14)' : 'rgba(255, 219, 102, 0.16)',
                  borderColor: isReadyToSubmit ? 'rgba(1, 179, 244, 0.28)' : 'rgba(255, 219, 102, 0.30)',
                  borderRadius: 999,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p4Bold, isReadyToSubmit ? Fonts.primary500 : Fonts.gold500]}>
                {isReadyToSubmit ? 'Pr\u00EAt \u00E0 publier' : '\u00C0 compl\u00E9ter'}
              </Text>
            </View>
          </View>

          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[16]]}>
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
          eyebrow={'\u00C9quipe qui recrute'}
          onEdit={() => navigation.navigate(RouteNames.AdWizardTeam)}
          title="Structure"
        >
          {state.team ? (
            <EventWizardTeamCard
              onPress={() => navigation.navigate(RouteNames.AdWizardTeam)}
              team={state.team}
            />
          ) : (
            <Text style={[Fonts.p2, Fonts.gold500]}>{'Aucune \u00E9quipe s\u00E9lectionn\u00E9e'}</Text>
          )}

          <View style={[Alignments.row, Alignments.wrap, Spaces.gap[14]]}>
            <OverviewMetric
              ApplicationStyle={ApplicationStyle}
              complete={Boolean(sportName && sportName !== 'Non d\u00E9fini')}
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
              value={profileLabel || '\u00C0 pr\u00E9ciser'}
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
          title={'Informations cl\u00E9s'}
        >
          <View style={[Spaces.gap[16]]}>
            <View style={[Spaces.gap[10]]}>
              <Text style={[Fonts.p3, Fonts.neutral300]}>
                {'Type d\'annonce'}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral00]}>{resolvedAdTypeLabel}</Text>
            </View>

            <View style={[Spaces.gap[10]]}>
              <Text style={[Fonts.p3, Fonts.neutral300]}>Lieu</Text>
              <Text style={[Fonts.p2, displayAddress ? Fonts.neutral00 : Fonts.gold500]}>
                {displayAddress || '\u00C0 compl\u00E9ter'}
              </Text>
            </View>

            <View style={[Spaces.gap[10]]}>
              <Text style={[Fonts.p3, Fonts.neutral300]}>Validation</Text>
              <Text style={[Fonts.p2, Fonts.neutral00]}>{validationLabel}</Text>
            </View>

            {state.event ? (
              <View style={[Spaces.gap[10]]}>
                <Text style={[Fonts.p3, Fonts.neutral300]}>{'D\u00E9tection li\u00E9e'}</Text>
                <Text style={[Fonts.p2, Fonts.neutral00]}>
                  {state.event.name || state.event.type?.name || '\u00C9v\u00E9nement'}
                </Text>
              </View>
            ) : null}
          </View>
        </RecapSection>

        <RecapSection
          eyebrow="Texte de l'annonce"
          onEdit={() => navigation.navigate(RouteNames.AdWizardDescription)}
          title={isCoachAd ? 'Description et missions' : 'Description'}
        >
          <Text style={[Fonts.p2, state.description ? Fonts.neutral100 : Fonts.neutral300]}>
            {state.description || "Aucune description personnalis\u00E9e n'a \u00E9t\u00E9 ajout\u00E9e."}
          </Text>
          {isCoachAd ? (
            <Text style={[Fonts.p2, state.missions ? Fonts.neutral100 : Fonts.neutral300]}>
              {state.missions || 'Aucune mission detaillee n a encore ete ajoutee.'}
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
              ? "L'annonce sera visible dans le flux recrutement avec un badge entraineur. Plus le role, les missions et le cadre sont precis, plus les candidatures seront pertinentes."
              : "L'annonce sera visible par les joueurs correspondant au profil recherche. Plus vos informations sont precises, plus la mise en relation sera pertinente."}
          </Text>
        </View>
      </View>
    </WizardStepLayout>
  );
}

export default AdWizardRecap;
