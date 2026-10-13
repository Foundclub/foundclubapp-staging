import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useGetTeam } from '@/services/team/teamQueries';

/**
 * « Karim B. » : le prénom et l'initiale du nom, comme la planche 7.
 * @param {{ firstname?: string, lastname?: string, username?: string } | null | undefined} person
 * @param {string} fallback Le nom à dire quand le compte n'en a pas.
 * @returns {string} Le nom court.
 */
const shortName = (person, fallback) => {
  const firstname = String(person?.firstname || '').trim();
  const initial = String(person?.lastname || '').trim().charAt(0);
  if (firstname) return initial ? `${firstname} ${initial.toUpperCase()}.` : firstname;
  return String(person?.username || '').trim() || fallback;
};

/**
 * 👪 PAR-L9b (13/10) — FEUILLE « OUVRIR UNE CONVERSATION » (E16, planche 7).
 *
 * Décision D3 d'Adel (11/10) : pour chaque demande d'intérêt, le dirigeant choisit — discuter
 * LUI-MÊME, ou ouvrir l'échange avec un·e COACH qu'il sélectionne dans les coachs de l'équipe
 * visée. Aucun choix n'est fait à sa place (rien de présélectionné), et la feuille rappelle
 * qu'une conversation ne vaut pas inscription. D3 bis A : le fil est à trois (dirigeant,
 * personne intéressée, coach) — c'est l'écran qui le crée, par la route existante.
 * ⛔ Cette feuille ne crée rien : elle rend le choix à `onConfirm`.
 * @param {{
 *   currentUserId?: string,
 *   isBusy?: boolean,
 *   item: any,
 *   onCancel: () => void,
 *   onConfirm: (choice: { coach: any | null }) => void,
 * }} props
 * @returns {import('react').ReactElement} La feuille.
 */
function InterestConversationSheet({
  currentUserId = '',
  isBusy = false,
  item,
  onCancel,
  onConfirm,
}) {
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const [choice, setChoice] = useState(/** @type {'' | 'me' | 'coach'} */ (''));
  const [coachId, setCoachId] = useState('');

  const visible = Boolean(item);
  const teamId = String(item?.meta?.teamId || '').trim();
  const teamName = String(item?.meta?.teamName || '').trim();
  const requesterName = String(item?.meta?.requesterName || '').trim();
  const firstname = String(item?.meta?.requesterFirstname || '').trim() || requesterName;

  // La liste des coachs vient de la fiche de l'équipe (la requête existante, et son cache).
  // L'écran ne monte la feuille qu'ouverte : son état repart à zéro à chaque ouverture.
  const teamQuery = useGetTeam(teamId, { enabled: visible && Boolean(teamId) });

  // Le dirigeant qui entraîne aussi l'équipe ne se choisit pas : c'est « Moi ».
  const coaches = useMemo(() => {
    const trainers = Array.isArray(teamQuery?.data?.trainers) ? teamQuery.data.trainers : [];
    return trainers.filter((trainer) => (
      trainer?.documentId && trainer.documentId !== currentUserId
    ));
  }, [currentUserId, teamQuery?.data?.trainers]);
  const selectedCoach = coaches.find((coach) => coach.documentId === coachId) || null;
  const canOpen = choice === 'me' || (choice === 'coach' && Boolean(selectedCoach));

  const subtitle = teamName
    ? t('requestsHub.conversation.subtitleTeam', {
      defaultValue: '{{name}} · intérêt pour {{team}}',
      name: requesterName,
      team: teamName,
      ...SANS_ECHAPPEMENT,
    })
    : t('requestsHub.conversation.subtitleClub', {
      defaultValue: '{{name}} · intérêt pour le club',
      name: requesterName,
      ...SANS_ECHAPPEMENT,
    });

  /**
   * Une rangée à choix unique, cible de 44 points au moins.
   * @param {{ checked: boolean, disabled?: boolean, label: string, onPress?: () => void }} row
   * @returns {import('react').ReactElement} La rangée.
   */
  const renderRow = ({
    checked, disabled = false, label, onPress,
  }) => (
    <TouchableOpacity
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{ checked, disabled }}
      disabled={disabled || isBusy}
      key={label}
      onPress={onPress}
      style={[
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[12],
        Alignments.justifyCenter,
        {
          backgroundColor: checked ? 'rgba(1, 179, 244, 0.14)' : 'rgba(255,255,255,0.04)',
          borderColor: checked ? Colors.primary500 : `${Colors.primary500}33`,
          minHeight: 44,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={[Fonts.p3Bold, checked ? Fonts.primary100 : Fonts.neutral00]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  let coachOption = null;
  if (teamId) {
    if (teamQuery?.isLoading) {
      coachOption = renderRow({
        checked: false,
        disabled: true,
        label: t('requestsHub.conversation.listLoading', 'Chargement des coachs…'),
      });
    } else if (teamQuery?.isError) {
      coachOption = renderRow({
        checked: false,
        disabled: true,
        label: t(
          'requestsHub.conversation.listError',
          'La liste des coachs est indisponible : tu peux discuter toi-même.',
        ),
      });
    } else if (coaches.length === 0) {
      coachOption = renderRow({
        checked: false,
        disabled: true,
        label: t('requestsHub.conversation.noCoach', {
          defaultValue: 'Aucun·e coach dans {{team}}',
          team: teamName,
          ...SANS_ECHAPPEMENT,
        }),
      });
    } else {
      coachOption = renderRow({
        checked: choice === 'coach',
        label: t('requestsHub.conversation.optionCoach', {
          defaultValue: 'Un·e coach de {{team}} — je choisis qui.',
          team: teamName,
          ...SANS_ECHAPPEMENT,
        }),
        onPress: () => setChoice('coach'),
      });
    }
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={isBusy ? undefined : onCancel}
      transparent
      visible={visible}
    >
      <View
        style={[
          Alignments.fill,
          Alignments.justifyCenter,
          Spaces.padding[24],
          { backgroundColor: 'rgba(0, 0, 0, 0.55)' },
        ]}
      >
        <ScrollView
          contentContainerStyle={[Spaces.gap[16], { padding: 20 }]}
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderRadius16,
            ApplicationStyle.borderWidth1,
            {
              borderColor: `${Colors.primary500}66`,
              flexGrow: 0,
              maxHeight: '100%',
            },
          ]}
        >
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
              {t('requestsHub.conversation.title', 'Ouvrir une conversation')}
            </Text>
            <Text style={[Fonts.p3, Fonts.primary200]}>
              {subtitle}
            </Text>
          </View>

          <View style={[Spaces.gap[8]]}>
            {renderRow({
              checked: choice === 'me',
              label: t('requestsHub.conversation.optionMe', {
                defaultValue: 'Moi — je discute directement avec {{firstname}}.',
                firstname,
                ...SANS_ECHAPPEMENT,
              }),
              onPress: () => setChoice('me'),
            })}
            {coachOption}
            {choice === 'coach' ? (
              <View style={[Spaces.gap[8], { paddingLeft: 16 }]}>
                {coaches.map((coach) => renderRow({
                  checked: coach.documentId === coachId,
                  label: t('requestsHub.conversation.coachRow', {
                    defaultValue: '{{name}} · coach {{team}}',
                    name: shortName(coach, t('common.user', 'Utilisateur')),
                    team: teamName,
                    ...SANS_ECHAPPEMENT,
                  }),
                  onPress: () => setCoachId(coach.documentId),
                }))}
              </View>
            ) : null}
          </View>

          <Text style={[Fonts.p3, Fonts.primary100]}>
            {t(
              'requestsHub.conversation.info',
              "Ouvrir une conversation ne vaut pas inscription dans l'équipe.",
            )}
          </Text>

          <View style={[Spaces.gap[8]]}>
            <Button
              disabled={!canOpen || isBusy}
              icon="envelope"
              isLoading={isBusy}
              onPress={() => onConfirm({ coach: choice === 'coach' ? selectedCoach : null })}
              title={t('requestsHub.conversation.open', 'Ouvrir la conversation')}
              variant="Primary"
            />
            <Button
              disabled={isBusy}
              onPress={onCancel}
              title={t('common.actions.cancel', 'Annuler')}
              variant="Ghost"
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default InterestConversationSheet;
