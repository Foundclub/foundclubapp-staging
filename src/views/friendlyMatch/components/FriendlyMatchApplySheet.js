import i18next from 'i18next';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getAllowedChosenHostings,
  normalizeCandidateDates,
} from '@/domains/search/friendlyMatchFlow';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';
import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';
import TimePickerInput from '@/components/molecules/timePickerInput/TimePickerInput';

import { applyToFriendlyMatchAd } from '@/services/friendlyMatch/friendlyMatchService';

import { createLogger } from '@/utils/logger/logger';

import { getSlotHoursLabel, toShortDay } from '../friendlyMatchDateLabels';
import { getProposalSlotNeeds } from '../friendlyMatchSlot';

const logger = createLogger('friendly-match-apply');

const MESSAGE_MAX_LENGTH = 400;
const VENUE_MAX_LENGTH = 120;

/**
 * « la date », « l’horaire et le lieu »… : ce qui manque, dit en une phrase.
 * @param {Array<'date' | 'place' | 'time'>} missing
 * @returns {string}
 */
const joinMissing = (missing) => {
  const labels = missing.map((part) => ({
    date: i18next.t('friendlyMatchApplySheet.missingDate', 'la date'),
    place: i18next.t('friendlyMatchApplySheet.missingPlace', 'le lieu'),
    time: i18next.t('friendlyMatchApplySheet.missingTime', 'l’horaire'),
  }[part]));
  if (labels.length < 2) return labels[0] || '';
  const and = i18next.t('friendlyMatchApplySheet.and', 'et');
  return `${labels.slice(0, -1).join(', ')} ${and} ${labels[labels.length - 1]}`;
};

/** Ce que le candidat annonce faire, dit de SON point de vue. */
// I18N-2 : des GETTERS, pas des textes — lus à l import, avant l initialisation
// d i18next ; le libellé se traduit au moment où il s affiche.
const CHOSEN_HOSTING_LABELS = /** @type {Record<string, string>} */ ({
  get AWAY() {
    return i18next.t('friendlyMatchApplySheet.hostingAway', 'Je me déplace');
  },
  get HOST() {
    return i18next.t('friendlyMatchApplySheet.hostingHost', 'Je reçois');
  },
});

/**
 * La cle d une equipe, quelle que soit la forme recue.
 * @param {any} team
 * @returns {string}
 */
const getTeamKey = (team) => String(team?.documentId || team?.id || '').trim();

/**
 * « Proposer un match » (§4.3).
 *
 * Le choix « qui recoit » est TOUJOURS coche explicitement, meme quand l annonce
 * n en laisse qu un seul possible : c est le point d Adel (Q1) — « il doit bien
 * la selectionner pour qu il en ait bien conscience ». Le serveur refuse de
 * toute facon un `chosenHosting` absent ou incompatible (§3.3).
 *
 * Une feuille, pas un ecran : un ecran de plus exigerait son motif web, et le
 * routage web est le lot L7.
 * @param {object} props
 * @param {any} props.ad
 * @param {any[]} props.managedTeams - Les equipes que le lecteur encadre.
 * @param {() => void} props.onClose
 * @param {(application: any) => void} props.onSubmitted
 * @param {boolean} props.visible
 * @returns {import('react').ReactElement}
 */
function FriendlyMatchApplySheet({
  ad,
  managedTeams,
  onClose,
  onSubmitted,
  visible,
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());

  const [teamId, setTeamId] = useState('');
  const [chosenHosting, setChosenHosting] = useState('');
  const [chosenDate, setChosenDate] = useState('');
  const [chosenTime, setChosenTime] = useState('');
  const [venue, setVenue] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Une equipe ne peut pas candidater a sa propre annonce (le serveur le refuse
  // aussi) : on ne la propose donc pas du tout.
  const eligibleTeams = useMemo(() => {
    const adTeamKey = getTeamKey(ad?.team);
    return (managedTeams || []).filter(
      (team) => getTeamKey(team) && getTeamKey(team) !== adTeamKey,
    );
  }, [ad?.team, managedTeams]);

  const allowedHostings = useMemo(
    () => getAllowedChosenHostings(ad?.hostingPreference),
    [ad?.hostingPreference],
  );

  // AMICAUX-PROPOSITIONS (13/10) — plus de « Peu importe » : une proposition donne toujours
  // une date de l annonce (decision d Adel du 12/10, le serveur refuse sinon).
  const dateOptions = useMemo(() => normalizeCandidateDates(ad?.candidateDates).map((slot) => ({
    label: slot.start ? `${toShortDay(slot.date)} ${slot.start}` : toShortDay(slot.date),
    value: slot.date,
  })), [ad?.candidateDates]);

  // Rouvrir la feuille repart d un formulaire propre : garder un brouillon
  // abandonne ferait envoyer une proposition que personne n a relue.
  useEffect(() => {
    if (!visible) return;
    setTeamId(eligibleTeams.length === 1 ? getTeamKey(eligibleTeams[0]) : '');
    setChosenHosting('');
    setChosenDate('');
    setChosenTime('');
    setVenue('');
    setMessage('');
    setErrorMessage('');
  }, [eligibleTeams, visible]);

  // Ce que l annonce donne deja (horaire du jour, son lieu quand elle recoit) se reprend ;
  // le reste, le proposant le donne. Meme regle que le serveur (friendlyMatchSlot.js).
  const slotNeeds = getProposalSlotNeeds(ad, {
    chosenDate, chosenHosting, chosenTime, proposedVenue: venue,
  });

  const canSubmit = Boolean(teamId)
    && allowedHostings.includes(chosenHosting)
    && slotNeeds.missing.length === 0
    && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const application = await applyToFriendlyMatchAd(ad?.documentId || ad?.id, {
        chosenDate,
        chosenHosting,
        team: teamId,
        ...(slotNeeds.asksTime ? { chosenTime } : {}),
        ...(slotNeeds.asksPlace ? { proposedVenue: venue.trim() } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      onSubmitted(application);
    } catch (error) {
      // Le serveur dit deja pourquoi il refuse (annonce fermee, equipe deja
      // candidate, hebergement incompatible) : son message vaut mieux que le notre.
      const readableMessage = /** @type {any} */ (error)?.message
        || t(
          'friendlyMatchApplySheet.unableToSendTheProposal',
          "Impossible d'envoyer la proposition.",
        );
      logger.error('Candidature amicale refusee', { error });
      setErrorMessage(readableMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={{
        backgroundColor: withAlpha(Colors.neutral900, 0.55),
        flex: 1,
        justifyContent: 'flex-end',
      }}
      >
        <View style={{
          backgroundColor: Colors.primary900,
          borderColor: withAlpha(Colors.primary500, 0.19),
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          borderWidth: 1,
          maxHeight: '90%',
          paddingBottom: insets.bottom + 16,
          paddingHorizontal: 20,
          paddingTop: 16,
        }}
        >
          <View style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            Spaces.marginBottom[16],
          ]}
          >
            <Text style={[Fonts.h4, Fonts.neutral00]}>
              {t('friendlyMatchApplySheet.proposeAMatch', 'Proposer un match')}
            </Text>
            <TouchableOpacity
              accessibilityLabel={t('friendlyMatchApplySheet.close', 'Fermer')}
              accessibilityRole="button"
              onPress={onClose}
              style={{
                alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
              }}
            >
              <SvgIcon color={Colors.neutral200} height={16} name="close" width={16} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[16]]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {eligibleTeams.length === 0 ? (
              <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
                {t(
                  'friendlyMatchApplySheet.youHaveNoTeamTo',
                  'Tu n’as aucune équipe à proposer sur cette annonce.',
                )}
              </Text>
            ) : (
              <ChoiceChipGroup
                onSelect={(value) => setTeamId(String(value))}
                options={eligibleTeams.map((team) => ({
                  label: team?.name || t('friendlyMatchApplySheet.myTeam', 'Mon équipe'),
                  value: getTeamKey(team),
                }))}
                selectedValue={teamId}
                title={t('friendlyMatchApplySheet.whichTeam', 'Quelle équipe')}
              />
            )}

            <ChoiceChipGroup
              hint={allowedHostings.length === 1
                ? t(
                  'friendlyMatchApplySheet.thisListingOnlyAllowsThis',
                  'Cette annonce n’autorise que ce choix, mais il reste à cocher :',
                )
                  + t(
                    'friendlyMatchApplySheet.itDecidesWhereTheMatch',
                    ' c’est lui qui décide où le match se joue.',
                  )
                : t(
                  'friendlyMatchApplySheet.thisChoiceDecidesWhereThe',
                  'C’est ce choix qui décide où le match se joue.',
                )}
              onSelect={(value) => setChosenHosting(String(value))}
              options={allowedHostings.map((value) => ({
                label: CHOSEN_HOSTING_LABELS[value] || value,
                value,
              }))}
              selectedValue={chosenHosting}
              title={t('friendlyMatchApplySheet.forThisMatch', 'Pour ce match')}
            />

            {dateOptions.length > 0 ? (
              <ChoiceChipGroup
                onSelect={(value) => setChosenDate(String(value))}
                options={dateOptions}
                selectedValue={chosenDate}
                title={t('friendlyMatchApplySheet.whichDate', 'Quelle date')}
              />
            ) : null}

            {slotNeeds.adStart ? (
              <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
                {t('friendlyMatchApplySheet.hoursOfTheListing', 'Horaire : {{hours}}', {
                  hours: getSlotHoursLabel(normalizeCandidateDates(ad?.candidateDates)
                    .find((slot) => slot.date === chosenDate)),
                  ...SANS_ECHAPPEMENT,
                })}
              </Text>
            ) : null}

            {slotNeeds.asksTime ? (
              <TimePickerInput
                label={t('friendlyMatchTermsSheet.kickOffTime', 'Heure du coup d’envoi')}
                onChange={setChosenTime}
                value={chosenTime}
              />
            ) : null}

            {chosenHosting && !slotNeeds.asksPlace ? (
              <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
                {t('friendlyMatchApplySheet.venueOfTheListing', 'Lieu : {{venue}}', {
                  ...SANS_ECHAPPEMENT,
                  venue: slotNeeds.adPlace,
                })}
              </Text>
            ) : null}

            {chosenHosting && slotNeeds.asksPlace ? (
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
                  {t('friendlyMatchApplySheet.whereIsTheMatch', 'Où se joue le match')}
                </Text>
                <TextInput
                  accessibilityLabel={t('friendlyMatchTermsSheet.matchVenue', 'Lieu du match')}
                  maxLength={VENUE_MAX_LENGTH}
                  onChangeText={setVenue}
                  placeholder={t(
                    'friendlyMatchTermsSheet.eGNorthStadiumPitch',
                    'Ex : Stade Nord, terrain 2',
                  )}
                  placeholderTextColor={Colors.neutral400}
                  style={[Fonts.p1, {
                    backgroundColor: withAlpha(Colors.primary900, 0.94),
                    borderColor: withAlpha(Colors.primary500, 0.15),
                    borderRadius: 12,
                    borderWidth: 1,
                    color: Colors.neutral00,
                    minHeight: 48,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }]}
                  value={venue}
                />
              </View>
            ) : null}

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
                {t('friendlyMatchApplySheet.aWordOptional', 'Un mot (facultatif)')}
              </Text>
              <TextInput
                accessibilityLabel={t(
                  'friendlyMatchApplySheet.messageForTheListingS',
                  'Message pour le staff de l’annonce',
                )}
                maxLength={MESSAGE_MAX_LENGTH}
                multiline
                onChangeText={setMessage}
                placeholder={t(
                  'friendlyMatchApplySheet.eGHelloOurU15',
                  'Ex : bonjour, notre U15 est disponible, on peut décaler l’horaire.',
                )}
                placeholderTextColor={Colors.neutral400}
                style={[Fonts.p1, {
                  backgroundColor: withAlpha(Colors.primary900, 0.94),
                  borderColor: withAlpha(Colors.primary500, 0.15),
                  borderRadius: 12,
                  borderWidth: 1,
                  color: Colors.neutral00,
                  minHeight: 80,
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  textAlignVertical: 'top',
                }]}
                value={message}
              />
            </View>

            {errorMessage ? (
              <View style={[Spaces.padding[16], {
                backgroundColor: withAlpha(Colors.error500, 0.12),
                borderColor: withAlpha(Colors.error500, 0.4),
                borderRadius: 12,
                borderWidth: 1,
              }]}
              >
                <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {slotNeeds.missing.length > 0 ? (
              <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
                {t(
                  'friendlyMatchApplySheet.missingBeforeSending',
                  'Pour envoyer, choisis {{missing}}.',
                  { ...SANS_ECHAPPEMENT, missing: joinMissing(slotNeeds.missing) },
                )}
              </Text>
            ) : null}

            <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
              {t(
                'friendlyMatchAdDetails.answeringOpensAConversationBetween',
                'Répondre ouvre une discussion entre les deux staffs.',
              )}
            </Text>
          </ScrollView>

          <Button
            disabled={!canSubmit}
            isLoading={isSubmitting}
            onPress={handleSubmit}
            title={t('friendlyMatchApplySheet.sendMyProposal', 'Envoyer ma proposition')}
            variant="Primary"
          />
        </View>
      </View>
    </Modal>
  );
}

export default FriendlyMatchApplySheet;
