/**
 * INVITE-STAFF (10/11/2026, maquette validée, écran C) — dans la fiche club, rubrique Staff :
 * « Invitations en attente ». On n'y voit que ce que l'inviteur a tapé (prénom, 2 derniers
 * chiffres), jamais le profil de la personne : elle apparaît dans le staff quand elle accepte.
 * Un refus ne s'y distingue pas d'une invitation sans réponse (« 2A »).
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import useAuth from '@/domains/auth/useAuth';
import {
  cancelStaffInvitation,
  getSentStaffInvitations,
} from '@/services/staffInvitation/staffInvitationService';

import { dateCourte } from './textesInvitationDeStaff';

export const STAFF_INVITATIONS_SENT_KEY = 'staffInvitationsSent';

/**
 * @param {object} props
 * @param {string} props.clubId - le club.
 * @param {string} [props.clubName] - pour le SMS de relance.
 * @returns {import('react').ReactElement | null} la rubrique, ou rien s'il n'y a rien en attente.
 */
function InvitationsDeStaffEnAttente({ clubId, clubName = '' }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();
  const { inviteTrainer } = useAuth();

  const { data: invitations = [], refetch } = useQuery({
    enabled: Boolean(clubId),
    queryFn: () => getSentStaffInvitations(clubId),
    queryKey: [STAFF_INVITATIONS_SENT_KEY, clubId],
  });

  const annuler = useMutation({
    meta: { preventToastError: true },
    mutationFn: cancelStaffInvitation,
    onSettled: () => { refetch(); },
  });

  if (!invitations.length) return null;

  return (
    <View style={[Spaces.gap[8]]}>
      <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
        {t('staffInvitation.pending.title', { count: invitations.length })}
      </Text>
      {invitations.map((/** @type {any} */ invitation) => {
        const role = invitation.role === 'dirigeant'
          ? t('staffInvitation.roles.dirigeant')
          : t('staffInvitation.roles.coach');
        const details = [role, invitation.team?.name, t('staffInvitation.pending.sentOn', {
          date: dateCourte(invitation.createdAt),
        })].filter(Boolean).join(' · ');
        return (
          <View
            key={invitation.documentId}
            style={[
              ApplicationStyle.borderRadius24,
              ApplicationStyle.backgroundColor.primary700,
              Spaces.padding[16],
              Spaces.gap[12],
            ]}
            testID={`staff-invite-pending-${invitation.documentId}`}
          >
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[8]]}>
              <View style={[Alignments.fill]}>
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                  {[invitation.firstname || t('staffInvitation.pending.someone'), `•• ${invitation.phoneHint || ''}`]
                    .join(' · ')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>{details}</Text>
              </View>
              <Text style={[Fonts.p3Bold, Fonts.neutral200]}>{t('staffInvitation.pending.state')}</Text>
            </View>
            <View style={[Alignments.row, Spaces.gap[8]]}>
              <Button
                isLoading={annuler.isPending && annuler.variables === invitation.documentId}
                onPress={() => annuler.mutate(invitation.documentId)}
                style={{ flex: 1 }}
                testID={`staff-invite-cancel-${invitation.documentId}`}
                title={t('staffInvitation.pending.cancel')}
                variant="Secondary"
              />
              <Button
                onPress={() => inviteTrainer({
                  clubId,
                  clubName,
                  firstname: invitation.firstname || t('addCoach.fallbacks.inviteFirstname', 'Coach / Prof'),
                  isManager: invitation.role === 'dirigeant',
                })}
                style={{ flex: 1 }}
                title={t('staffInvitation.pending.resend')}
                variant="Primary"
              />
            </View>
          </View>
        );
      })}
      <Text style={[Fonts.p3, Fonts.neutral300]}>{t('staffInvitation.pending.note')}</Text>
    </View>
  );
}

export default InvitationsDeStaffEnAttente;
