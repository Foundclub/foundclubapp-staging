import { useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { getHostingSummary } from '@/domains/search/friendlyMatchFlow';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';

import { RouteNames } from '@/navigation/routeNames';

import { createFriendlyMatchAd } from '@/services/friendlyMatch/friendlyMatchService';

import { createLogger } from '@/utils/logger/logger';

/* eslint-disable perfectionist/sort-imports */
import { useAppFeedback } from '@/context/AppFeedbackContext';

import { toShortDay } from '../friendlyMatchDateLabels';

import { useFriendlyMatchWizard } from './FriendlyMatchWizardContext';
import {
  buildFriendlyMatchAdPayload,
  getFriendlyMatchWizardBlockingStep,
  getFriendlyMatchWizardStepCount,
  getFriendlyMatchWizardStepIndex,
  getFriendlyMatchWizardStepIssue,
} from './friendlyMatchWizardSteps';
/* eslint-enable perfectionist/sort-imports */

const logger = createLogger('friendly-match-wizard');

/** Vers quel ecran renvoyer quand une etape est encore en defaut. */
const STEP_ROUTES = {
  dates: RouteNames.FriendlyMatchWizardDates,
  description: RouteNames.FriendlyMatchWizardDescription,
  hosting: RouteNames.FriendlyMatchWizardHosting,
  location: RouteNames.FriendlyMatchWizardLocation,
  opponent: RouteNames.FriendlyMatchWizardOpponent,
  team: RouteNames.FriendlyMatchWizardTeam,
};

/**
 * Le libelle d une localisation, quelle que soit sa forme.
 * @param {any} location
 * @returns {string}
 */
const getLocationLabel = (location) => {
  if (!location) return '';
  if (typeof location === 'string') return location;
  return String(
    location.city || location.label || location.name || location.formatted_address || '',
  ).trim();
};

/**
 * Etape 7/7 — le recapitulatif, et le seul endroit qui publie (§4.1).
 *
 * Il ne re-verifie rien lui-meme : il demande a friendlyMatchWizardSteps quelle
 * est la PREMIERE etape en defaut, et y renvoie d un clic. Renvoyer au debut du
 * tunnel ferait recommencer un travail deja fait.
 * @param {{ navigation: any }} props
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchWizardRecap({ navigation }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());
  const { showBanner } = /** @type {any} */ (useAppFeedback());
  const { dispatch, state } = useFriendlyMatchWizard();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');

  const blockingStep = useMemo(() => getFriendlyMatchWizardBlockingStep(state), [state]);
  const blockingIssue = blockingStep
    ? getFriendlyMatchWizardStepIssue(blockingStep, state)
    : null;

  const slots = Array.isArray(state.candidateDates) ? state.candidateDates : [];
  const hostingSummary = getHostingSummary({ hostingPreference: state.hostingPreference });
  const formatLabel = state.format === 'Autre' ? state.formatOther : state.format;

  const handlePublish = async () => {
    if (blockingStep) {
      showBanner({
        body: blockingIssue || 'Il manque une information avant de publier.',
        title: 'Récapitulatif incomplet',
        tone: 'error',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitErrorMessage('');
    try {
      const createdAd = await createFriendlyMatchAd(buildFriendlyMatchAdPayload(state));
      // Le brouillon est vide AVANT la navigation : revenir sur le tunnel ne
      // doit pas reproposer une annonce deja publiee.
      dispatch({ type: 'RESET' });
      showBanner({
        body: 'Les équipes du secteur peuvent maintenant te proposer un match.',
        title: 'Annonce publiée',
        tone: 'success',
      });
      navigation.replace(RouteNames.FriendlyMatchAdDetails, {
        adId: createdAd?.documentId || createdAd?.id,
      });
    } catch (error) {
      // Le serveur explique deja POURQUOI il refuse (§3.3) : on garde SON
      // message plutot que d en inventer un plus vague.
      const message = /** @type {any} */ (error)?.message
        || "Impossible de publier l'annonce.";
      logger.error('Publication d annonce amicale refusee', { error });
      setSubmitErrorMessage(message);
      showBanner({ body: message, title: 'Publication impossible', tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Une ligne du recapitulatif, cliquable pour retourner corriger.
   * @param {string} label
   * @param {string} value
   * @param {string} stepKey
   * @returns {import('react').ReactElement}
   */
  const renderRow = (label, value, stepKey) => (
    <TouchableOpacity
      accessibilityHint="Retourne à cette étape pour la modifier"
      accessibilityLabel={`${label} : ${value || 'non renseigné'}`}
      accessibilityRole="button"
      key={label}
      onPress={() => navigation.navigate(
        STEP_ROUTES[/** @type {keyof typeof STEP_ROUTES} */ (stepKey)],
      )}
      style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.primary900, 0.94),
          borderColor: withAlpha(Colors.primary500, 0.15),
          borderRadius: 12,
          borderWidth: 1,
          minHeight: 44,
        },
      ]}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>{label}</Text>
        <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
          {value || 'Non renseigné'}
        </Text>
      </View>
      <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Modifier</Text>
    </TouchableOpacity>
  );

  return (
    <WizardStepLayout
      isNextDisabled={Boolean(blockingStep) || isSubmitting}
      isNextLoading={isSubmitting}
      nextLabel="Publier l’annonce"
      onBack={() => navigation.goBack()}
      onNext={handlePublish}
      stepCount={getFriendlyMatchWizardStepCount()}
      stepIndex={getFriendlyMatchWizardStepIndex('recap')}
      subtitle="Vérifie, puis publie. Tu pourras annuler tant que personne n’a répondu."
      title="Ton annonce"
    >
      <View style={[Spaces.gap[12]]}>
        {renderRow('Équipe', state.team?.name || '', 'team')}
        {renderRow('Je peux', hostingSummary.label, 'hosting')}
        {renderRow(
          slots.length > 1 ? `${slots.length} dates` : 'Date',
          slots.map((/** @type {any} */ slot) => toShortDay(slot.date)).join(' · '),
          'dates',
        )}
        {renderRow(
          'Où',
          [getLocationLabel(state.location), `${state.travelRadiusKm} km`]
            .filter(Boolean).join(' · '),
          'location',
        )}
        {renderRow(
          'Adversaire',
          [state.category?.name, state.level?.name, formatLabel]
            .filter(Boolean).join(' · ') || 'Peu importe',
          'opponent',
        )}
        {renderRow('Un mot', state.description || '', 'description')}

        {blockingIssue ? (
          <View style={[Spaces.padding[16], {
            backgroundColor: withAlpha(Colors.error500, 0.12),
            borderColor: withAlpha(Colors.error500, 0.4),
            borderRadius: 12,
            borderWidth: 1,
          }]}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{blockingIssue}</Text>
          </View>
        ) : null}

        {submitErrorMessage ? (
          <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>{submitErrorMessage}</Text>
        ) : null}

        <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
          Publier est gratuit, sans limite de nombre d’annonces.
        </Text>
      </View>
    </WizardStepLayout>
  );
}

export default FriendlyMatchWizardRecap;
