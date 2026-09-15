import i18next from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { respondToFriendlyMatchApplication } from '@/services/friendlyMatch/friendlyMatchService';

import { createLogger } from '@/utils/logger/logger';

import { getSlotHoursLabel, toReadableDay } from '../friendlyMatchDateLabels';
import FriendlyMatchTermsSheet from './FriendlyMatchTermsSheet';

const logger = createLogger('friendly-match-application');

/** Ce que le candidat a coché, dit du point de vue de celui qui LIT l annonce. */
// I18N-2 : des GETTERS, pas des textes — lus à l import, avant l initialisation
// d i18next ; le libellé se traduit au moment où il s affiche.
const CHOSEN_HOSTING_LABELS = {
  get AWAY() {
    return i18next.t('friendlyMatchApplicationCard.hostingAway', 'Elle se déplace chez toi');
  },
  get HOST() {
    return i18next.t('friendlyMatchApplicationCard.hostingHost', 'Elle reçoit chez elle');
  },
};

const STATUS_LABELS = {
  get accepted() {
    return i18next.t('friendlyMatchApplicationCard.statusAccepted', 'Acceptée');
  },
  get cancelled() {
    return i18next.t('friendlyMatchApplicationCard.statusCancelled', 'Annulée');
  },
  get declined() {
    return i18next.t('friendlyMatchApplicationCard.statusDeclined', 'Refusée');
  },
  get pending() {
    return i18next.t('friendlyMatchApplicationCard.statusPending', 'En attente de ta réponse');
  },
  get withdrawn() {
    return i18next.t('friendlyMatchApplicationCard.statusWithdrawn', 'Retirée par l’équipe');
  },
};

/**
 * Ce qui arrivera aux AUTRES propositions si on accepte celle-ci (Q6 : un match
 * = un adversaire). Dit avant le geste, pas decouvert apres.
 * @param {number} otherCount
 * @returns {string}
 */
const buildOtherApplicationsWarning = (otherCount) => i18next.t(
  'friendlyMatchApplicationCard.otherApplicationsWarning',
  {
    count: otherCount,
    defaultValue_one: 'Les {{count}} autre proposition sera refusée automatiquement.',
    defaultValue_other: 'Les {{count}} autres propositions seront refusées automatiquement.',
  },
);

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
  const { t } = useTranslation();
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
        t('friendlyMatchApplicationCard.answerNotPossible', 'Réponse impossible'),
        /** @type {any} */ (error)?.message || t(
          'friendlyMatchApplicationCard.tryAgainInAMoment',
          'Réessaie dans un instant.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmAccept = () => {
    const otherCount = Math.max(0, Number(ad?.applicationsCount || 0) - 1);
    Alert.alert(
      t('friendlyMatchApplicationCard.acceptThisTeam', 'Accepter cette équipe ?'),
      [
        // S03 — la MEME phrase que la confirmation du fil de discussion : c'est
        // le meme geste, deux formulations feraient croire a deux gestes.
        t(
          'friendlyProposalInChat.acceptConsequence',
          'Le match sera créé et apparaîtra dans le planning des deux équipes.',
        ),
        otherCount > 0 ? buildOtherApplicationsWarning(otherCount) : '',
      ].filter(Boolean).join('\n\n'),
      [
        { style: 'cancel', text: t('friendlyMatchApplicationCard.cancel', 'Annuler') },
        {
          onPress: () => respond('accept'),
          text: t(
            'friendlyMatchApplicationCard.accept',
            'Accepter',
          ),
        },
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
        {application?.team?.name || t('friendlyMatchApplicationCard.aTeam', 'Une équipe')}
      </Text>

      {application?.team?.club?.name ? (
        <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
          {application.team.club.name}
        </Text>
      ) : null}

      <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
        {CHOSEN_HOSTING_LABELS[
          /** @type {keyof typeof CHOSEN_HOSTING_LABELS} */ (application?.chosenHosting)
        ] || t('friendlyMatchApplicationCard.hostingToBeConfirmed', 'Hébergement à confirmer')}
      </Text>

      {agreedLabel ? (
        <Text style={[Fonts.p3Bold, { color: Colors.success500 }]}>
          {`Convenu : ${agreedLabel}`}
        </Text>
      ) : null}

      {chosenDayLabel ? (
        <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
          {t(
            'friendlyMatchApplicationCard.preferredDate',
            'Date souhaitée : {{day}}',
            { day: chosenDayLabel, ...SANS_ECHAPPEMENT },
          )}
        </Text>
      ) : (
        <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
          {t(
            'friendlyMatchApplicationCard.noPreferredDateToBe',
            'Aucune date privilégiée : à convenir ensemble.',
          )}
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
          title={t('friendlyMatchApplicationCard.openTheConversation', 'Ouvrir la discussion')}
          variant="Secondary"
        />

        {isPending ? (
          <>
            <Button
              disabled={isSubmitting}
              onPress={() => setIsTermsSheetVisible(true)}
              title={agreedLabel ? t(
                'friendlyMatchApplicationCard.editWhatWasAgreed',
                'Modifier ce qui est convenu',
              ) : t(
                'friendlyMatchApplicationCard.agreeOnDateTimeAnd',
                'Convenir date, heure et lieu',
              )}
              variant="Secondary"
            />
            <Button
              disabled={isSubmitting}
              isLoading={isSubmitting}
              onPress={confirmAccept}
              title={t('friendlyMatchApplicationCard.acceptThisMatch', 'Accepter ce match')}
              variant="Primary"
            />
            <Button
              disabled={isSubmitting}
              onPress={() => respond('decline')}
              title={t('friendlyMatchApplicationCard.decline', 'Refuser')}
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
