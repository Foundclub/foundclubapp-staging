import { useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { respondToFriendlyMatchApplication } from '@/services/friendlyMatch/friendlyMatchService';

import { createLogger } from '@/utils/logger/logger';

import { getSlotHoursLabel, toReadableDay } from '../friendlyMatchDateLabels';
import { FRIENDLY_ACCEPT_CONSEQUENCE } from '../friendlyProposalInChat';
import FriendlyMatchTermsSheet from './FriendlyMatchTermsSheet';

const logger = createLogger('friendly-match-application');

/** Ce que le candidat a coché, dit du point de vue de celui qui LIT l annonce. */
const CHOSEN_HOSTING_LABELS = {
  AWAY: 'Elle se déplace chez toi',
  HOST: 'Elle reçoit chez elle',
};

const STATUS_LABELS = {
  accepted: 'Acceptée',
  cancelled: 'Annulée',
  declined: 'Refusée',
  pending: 'En attente de ta réponse',
  withdrawn: 'Retirée par l’équipe',
};

/**
 * Ce qui arrivera aux AUTRES propositions si on accepte celle-ci (Q6 : un match
 * = un adversaire). Dit avant le geste, pas decouvert apres.
 * @param {number} otherCount
 * @returns {string}
 */
const buildOtherApplicationsWarning = (otherCount) => {
  const plural = otherCount > 1 ? 's' : '';
  const verb = otherCount > 1 ? 'seront refusées' : 'sera refusée';
  return `Les ${otherCount} autre${plural} proposition${plural} ${verb} automatiquement.`;
};

/**
 * Une proposition recue, du point de vue du staff de l annonce (§4.5).
 *
 * Accepter est un geste LOURD et irreversible cote serveur : il refuse toutes
 * les autres candidatures, cree l evenement et le pose dans le planning des
 * deux equipes (friendly-match-workflow.ts). Il passe donc par une confirmation
 * qui dit ce qui va se produire, pas par un simple bouton.
 * @param {object} props
 * @param {any} props.ad
 * @param {any} props.application
 * @param {() => void} props.onOpenConversation
 * @param {() => void} props.onResponded
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchApplicationCard({
  ad,
  application,
  onOpenConversation,
  onResponded,
}) {
  const { Colors, Fonts, Spaces } = /** @type {any} */ (useTheme());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTermsSheetVisible, setIsTermsSheetVisible] = useState(false);

  const isPending = application?.status === 'pending';
  const isAccepted = application?.status === 'accepted';
  const chosenDayLabel = toReadableDay(application?.chosenDate);

  // Ce qui est convenu (§4.4) prime sur ce que le candidat avait coche : c est
  // cette date-la qui deviendra celle du match a l acceptation.
  const agreedDate = application?.agreedTerms?.date;
  const agreedLabel = agreedDate
    ? [
      toReadableDay(agreedDate),
      getSlotHoursLabel({ start: new Date(agreedDate).toTimeString().slice(0, 5) }),
      application?.agreedTerms?.venue,
    ].filter(Boolean).join(' · ')
    : '';

  /**
   * Accepte ou refuse la proposition, puis fait relire l annonce a l ecran.
   * @param {'accept' | 'decline'} action
   * @returns {Promise<void>}
   */
  const respond = async (action) => {
    setIsSubmitting(true);
    try {
      await respondToFriendlyMatchApplication(
        application?.documentId || application?.id,
        { action },
      );
      onResponded();
    } catch (error) {
      logger.error('Reponse a une proposition impossible', { action, error });
      Alert.alert(
        'Réponse impossible',
        /** @type {any} */ (error)?.message || 'Réessaie dans un instant.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmAccept = () => {
    const otherCount = Math.max(0, Number(ad?.applicationsCount || 0) - 1);
    Alert.alert(
      'Accepter cette équipe ?',
      [
        // S03 — la MEME phrase que la confirmation du fil de discussion : c'est
        // le meme geste, deux formulations feraient croire a deux gestes.
        FRIENDLY_ACCEPT_CONSEQUENCE,
        otherCount > 0 ? buildOtherApplicationsWarning(otherCount) : '',
      ].filter(Boolean).join('\n\n'),
      [
        { style: 'cancel', text: 'Annuler' },
        { onPress: () => respond('accept'), text: 'Accepter' },
      ],
    );
  };

  return (
    <View style={[Spaces.padding[16], Spaces.gap[8], {
      backgroundColor: withAlpha(Colors.primary900, 0.94),
      borderColor: isPending
        ? withAlpha(Colors.primary500, 0.4)
        : withAlpha(Colors.primary500, 0.15),
      borderRadius: 16,
      borderWidth: 1,
    }]}
    >
      <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
        {application?.team?.name || 'Une équipe'}
      </Text>

      {application?.team?.club?.name ? (
        <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
          {application.team.club.name}
        </Text>
      ) : null}

      <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
        {CHOSEN_HOSTING_LABELS[
          /** @type {keyof typeof CHOSEN_HOSTING_LABELS} */ (application?.chosenHosting)
        ] || 'Hébergement à confirmer'}
      </Text>

      {agreedLabel ? (
        <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>
          {`Convenu : ${agreedLabel}`}
        </Text>
      ) : null}

      {chosenDayLabel ? (
        <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
          {`Date souhaitée : ${chosenDayLabel}`}
        </Text>
      ) : (
        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
          Aucune date privilégiée : à convenir ensemble.
        </Text>
      )}

      {application?.message ? (
        <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>{application.message}</Text>
      ) : null}

      <Text style={[Fonts.p4Bold, {
        color: isAccepted ? Colors.success500 : Colors.neutral300,
      }]}
      >
        {STATUS_LABELS[
          /** @type {keyof typeof STATUS_LABELS} */ (application?.status)
        ] || application?.status}
      </Text>

      <View style={[Spaces.gap[8], Spaces.marginTop[8]]}>
        <Button
          onPress={onOpenConversation}
          title="Ouvrir la discussion"
          variant="Secondary"
        />

        {isPending ? (
          <>
            <Button
              disabled={isSubmitting}
              onPress={() => setIsTermsSheetVisible(true)}
              title={agreedLabel ? 'Modifier ce qui est convenu' : 'Convenir date, heure et lieu'}
              variant="Secondary"
            />
            <Button
              disabled={isSubmitting}
              isLoading={isSubmitting}
              onPress={confirmAccept}
              title="Accepter ce match"
              variant="Primary"
            />
            <Button
              disabled={isSubmitting}
              onPress={() => respond('decline')}
              title="Refuser"
              variant="Secondary"
            />
          </>
        ) : null}
      </View>

      <FriendlyMatchTermsSheet
        ad={ad}
        application={application}
        onClose={() => setIsTermsSheetVisible(false)}
        onSaved={() => {
          setIsTermsSheetVisible(false);
          onResponded();
        }}
        visible={isTermsSheetVisible}
      />
    </View>
  );
}

export default FriendlyMatchApplicationCard;
