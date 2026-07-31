import { useEffect, useMemo, useState } from 'react';
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
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ChoiceChipGroup from '@/components/molecules/choiceChipGroup/ChoiceChipGroup';

import { applyToFriendlyMatchAd } from '@/services/friendlyMatch/friendlyMatchService';

import { createLogger } from '@/utils/logger/logger';

import { toShortDay } from '../friendlyMatchDateLabels';

const logger = createLogger('friendly-match-apply');

const MESSAGE_MAX_LENGTH = 400;

/** Ce que le candidat annonce faire, dit de SON point de vue. */
const CHOSEN_HOSTING_LABELS = /** @type {Record<string, string>} */ ({
  AWAY: 'Je me déplace',
  HOST: 'Je reçois',
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
  const insets = useSafeAreaInsets();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = /** @type {any} */ (useTheme());

  const [teamId, setTeamId] = useState('');
  const [chosenHosting, setChosenHosting] = useState('');
  const [chosenDate, setChosenDate] = useState('');
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

  const dateOptions = useMemo(() => [
    { label: 'Peu importe', value: '' },
    ...normalizeCandidateDates(ad?.candidateDates).map((slot) => ({
      label: slot.start ? `${toShortDay(slot.date)} ${slot.start}` : toShortDay(slot.date),
      value: slot.date,
    })),
  ], [ad?.candidateDates]);

  // Rouvrir la feuille repart d un formulaire propre : garder un brouillon
  // abandonne ferait envoyer une proposition que personne n a relue.
  useEffect(() => {
    if (!visible) return;
    setTeamId(eligibleTeams.length === 1 ? getTeamKey(eligibleTeams[0]) : '');
    setChosenHosting('');
    setChosenDate('');
    setMessage('');
    setErrorMessage('');
  }, [eligibleTeams, visible]);

  const canSubmit = Boolean(teamId) && allowedHostings.includes(chosenHosting) && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const application = await applyToFriendlyMatchAd(ad?.documentId || ad?.id, {
        chosenHosting,
        team: teamId,
        ...(chosenDate ? { chosenDate } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      });
      onSubmitted(application);
    } catch (error) {
      // Le serveur dit deja pourquoi il refuse (annonce fermee, equipe deja
      // candidate, hebergement incompatible) : son message vaut mieux que le notre.
      const readableMessage = /** @type {any} */ (error)?.message
        || "Impossible d'envoyer la proposition.";
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
            <Text style={[Fonts.h4, Fonts.neutral00]}>Proposer un match</Text>
            <TouchableOpacity
              accessibilityLabel="Fermer"
              accessibilityRole="button"
              onPress={onClose}
              style={{
                alignItems: 'center', height: 44, justifyContent: 'center', width: 44,
              }}
            >
              <Text style={[Fonts.p1Bold, { color: Colors.neutral200 }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[16]]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {eligibleTeams.length === 0 ? (
              <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
                Tu n’as aucune équipe à proposer sur cette annonce.
              </Text>
            ) : (
              <ChoiceChipGroup
                onSelect={(value) => setTeamId(String(value))}
                options={eligibleTeams.map((team) => ({
                  label: team?.name || 'Mon équipe',
                  value: getTeamKey(team),
                }))}
                selectedValue={teamId}
                title="Quelle équipe"
              />
            )}

            <ChoiceChipGroup
              hint={allowedHostings.length === 1
                ? 'Cette annonce n’autorise que ce choix, mais il reste à cocher :'
                  + ' c’est lui qui décide où le match se joue.'
                : 'C’est ce choix qui décide où le match se joue.'}
              onSelect={(value) => setChosenHosting(String(value))}
              options={allowedHostings.map((value) => ({
                label: CHOSEN_HOSTING_LABELS[value] || value,
                value,
              }))}
              selectedValue={chosenHosting}
              title="Pour ce match"
            />

            {dateOptions.length > 1 ? (
              <ChoiceChipGroup
                hint="Tu pourras convenir de l’heure exacte dans la discussion."
                onSelect={(value) => setChosenDate(String(value))}
                options={dateOptions}
                selectedValue={chosenDate}
                title="Quelle date"
              />
            ) : null}

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral100 }]}>
                Un mot (facultatif)
              </Text>
              <TextInput
                accessibilityLabel="Message pour le staff de l’annonce"
                maxLength={MESSAGE_MAX_LENGTH}
                multiline
                onChangeText={setMessage}
                placeholder="Ex : bonjour, notre U15 est disponible, on peut décaler l’horaire."
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

            <Text style={[Fonts.p4, { color: withAlpha(Colors.neutral100, 0.63) }]}>
              Envoyer ouvre une discussion entre les deux staffs. C’est là que
              la date, l’heure et le lieu se décident.
            </Text>
          </ScrollView>

          <Button
            disabled={!canSubmit}
            isLoading={isSubmitting}
            onPress={handleSubmit}
            title="Envoyer ma proposition"
            variant="Primary"
          />
        </View>
      </View>
    </Modal>
  );
}

export default FriendlyMatchApplySheet;
