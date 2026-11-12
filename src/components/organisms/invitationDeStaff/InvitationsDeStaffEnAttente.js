/**
 * INVITE-STAFF (10/11/2026, maquette validée, écran C) — dans la fiche club, rubrique Staff :
 * « Invitations en attente ». On n'y voit que ce que l'inviteur a tapé (prénom, 2 derniers
 * chiffres), jamais le profil de la personne : elle apparaît dans le staff quand elle accepte.
 * INVITE-REFUS (« 274 B », 12/11/2026, remplace « 2A ») : une invitation refusée (serveur :
 * `state: 'refused'`) reste visible, « Refusée », avec « Inviter à nouveau » qui rouvre le
 * formulaire (le numéro n'est jamais renvoyé : on le retape). Elle ne compte pas dans
 * « Invitations en attente · N ». Le club n'a reçu aucune notification.
 */
import { useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { RouteNames } from '@/navigation/routeNames';

import {
  cancelStaffInvitation,
  getSentStaffInvitations,
} from '@/services/staffInvitation/staffInvitationService';

import { dateCourte } from './textesInvitationDeStaff';

export const STAFF_INVITATIONS_SENT_KEY = 'staffInvitationsSent';

/**
 * INVITE-STAFF-DESIGN (maquette D) — la lecture des invitations envoyées, partagée par la rubrique
 * et par les lignes du staff (même clé, une seule requête) : les invitations en attente, et les
 * comptes entrés par une invitation acceptée depuis moins de 7 jours (« Nouveau »). Un serveur
 * plus ancien ne renvoie pas `recentlyAccepted` : personne n'est marqué.
 * @param {string | undefined} clubId - le club.
 * @param {boolean} [enabled] - lire (dirigeant ou coach qui invite).
 * @returns {{ invitations: any[], nouveaux: Set<string>, refetch: () => void }} la lecture.
 */
export const useInvitationsDeStaffEnvoyees = (clubId, enabled = true) => {
  const { data, refetch } = useQuery({
    enabled: Boolean(clubId) && enabled,
    queryFn: () => getSentStaffInvitations(String(clubId)),
    queryKey: [STAFF_INVITATIONS_SENT_KEY, clubId],
  });
  const reponse = /** @type {any} */ (data);
  return {
    invitations: Array.isArray(reponse?.invitations) ? reponse.invitations : [],
    nouveaux: new Set(Array.isArray(reponse?.recentlyAccepted) ? reponse.recentlyAccepted : []),
    refetch,
  };
};

/**
 * La rubrique « Invitations en attente » de la fiche du club (dirigeant ou coach qui invite).
 * @param {object} props
 * @param {string} props.clubId - le club.
 * @param {string} [props.clubName] - pour le SMS de relance.
 * @param {any} [props.navigation] - pour « Inviter à nouveau » (INVITE-REFUS, 274 B).
 * @returns {import('react').ReactElement | null} la rubrique, ou rien s'il n'y a rien en attente.
 */
function InvitationsDeStaffEnAttente({ clubId, clubName = '', navigation }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { inviteTrainer } = useAuth();

  const { invitations, refetch } = useInvitationsDeStaffEnvoyees(clubId);

  const annuler = useMutation({
    meta: { preventToastError: true },
    mutationFn: cancelStaffInvitation,
    onSettled: () => {
      refetch();
    },
  });

  if (!invitations.length) return null;
  const enAttente = invitations.filter((/** @type {any} */ item) => item?.state !== 'refused');

  // Mêmes écrans que les « + » de la fiche club (ClubDetails) : coach, ou dirigeant·e.
  const inviterANouveau = (/** @type {any} */ invitation) => {
    if (invitation.role === 'dirigeant') {
      navigation?.navigate(RouteNames.AddClubManager, { clubId, clubName, staffType: 'manager' });
      return;
    }
    navigation?.navigate(RouteNames.AddCoach, {
      clubId,
      clubName,
      ...(invitation.team?.documentId ? { teamId: invitation.team.documentId } : {}),
    });
  };

  return (
    <View style={[Spaces.gap[8]]}>
      {enAttente.length ? (
        <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
          {t('staffInvitation.pending.title', { count: enAttente.length })}
        </Text>
      ) : null}
      {invitations.map((/** @type {any} */ invitation) => {
        const refusee = invitation.state === 'refused';
        const role = invitation.role === 'dirigeant'
          ? t('staffInvitation.roles.dirigeant')
          : t('staffInvitation.roles.coach');
        const details = [
          role,
          invitation.team?.name,
          t('staffInvitation.pending.sentOn', {
            date: dateCourte(invitation.createdAt),
            interpolation: { escapeValue: false },
          }),
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <View
            key={invitation.documentId}
            style={[
              ApplicationStyle.borderRadius24,
              ApplicationStyle.backgroundColor.primary700,
              Spaces.padding[16],
              Spaces.gap[12],
              // INVITE-STAFF-DESIGN (maquette C) : pas encore dans le staff, bord pointillé.
              {
                borderColor: withAlpha(Colors.primary200, 0.25),
                borderStyle: 'dashed',
                borderWidth: 1,
              },
            ]}
            testID={`staff-invite-pending-${invitation.documentId}`}
          >
            <View
              style={[
                Alignments.row,
                Alignments.alignCenter,
                Alignments.justifySpaceBetween,
                Spaces.gap[8],
              ]}
            >
              <View style={[Alignments.fill]}>
                <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                  {[
                    invitation.firstname || t('staffInvitation.pending.someone'),
                    `•• ${invitation.phoneHint || ''}`,
                  ].join(' · ')}
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>{details}</Text>
              </View>
              <Text
                style={[
                  Fonts.p3Bold,
                  Spaces.paddingHorizontal[8],
                  Spaces.paddingVertical[4],
                  {
                    backgroundColor: withAlpha(Colors.warning500, 0.16),
                    borderRadius: 999,
                    color: Colors.warning400,
                    overflow: 'hidden',
                  },
                ]}
              >
                {t(`staffInvitation.pending.${refusee ? 'refusedState' : 'state'}`)}
              </Text>
            </View>
            {refusee ? (
              <Button
                onPress={() => inviterANouveau(invitation)}
                title={t('staffInvitation.pending.inviteAgain')}
                variant="Primary"
              />
            ) : (
              <View style={[Alignments.row, Spaces.gap[8]]}>
                <Button
                  isLoading={annuler.isPending && annuler.variables === invitation.documentId}
                  onPress={() => annuler.mutate(invitation.documentId)}
                  style={{ flex: 1 }}
                  title={t('staffInvitation.pending.cancel')}
                  variant="Secondary"
                />
                <Button
                  onPress={() => inviteTrainer({
                    clubId,
                    clubName,
                    firstname:
                      invitation.firstname
                      || t('addCoach.fallbacks.inviteFirstname', 'Coach / Prof'),
                    isManager: invitation.role === 'dirigeant',
                    // Le numéro n'est jamais renvoyé à l'inviteur : il choisit le destinataire.
                    phoneNumber: undefined,
                  })}
                  style={{ flex: 1 }}
                  title={t('staffInvitation.pending.resend')}
                  variant="Primary"
                />
              </View>
            )}
          </View>
        );
      })}
      <Text style={[Fonts.p3, Fonts.neutral300]}>{t('staffInvitation.pending.note')}</Text>
    </View>
  );
}

export default InvitationsDeStaffEnAttente;
