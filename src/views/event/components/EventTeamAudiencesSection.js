// @ts-nocheck
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Alert, Text, View } from 'react-native';

import { canUserEditClub } from '@/domains/auth/authUseCases';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { respondEventTeamAudience } from '@/services/event/eventService';

const getUserKey = (user) => {
  if (user?.documentId) return `doc:${user.documentId}`;
  if (user?.id) return `id:${String(user.id)}`;
  return '';
};

const getAudienceLabel = (audience) => {
  const kind = String(audience?.audienceKind || '').toUpperCase();
  if (kind === 'EXTERNAL_INVITED') return 'Équipe externe';
  if (kind === 'INTERNAL_INVITED') return 'Équipe interne';
  return 'Organisateur';
};

const getStatusLabel = (status) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'ACCEPTED') return 'Acceptee';
  if (normalized === 'REFUSED') return 'Refusee';
  if (normalized === 'CANCELLED') return 'Annulee';
  return 'En attente';
};

const isTeamTrainerForUser = (team, user) => {
  const userKey = getUserKey(user);
  if (!userKey) return false;
  return Array.isArray(team?.trainers) && team.trainers.some((trainer) => getUserKey(trainer) === userKey);
};

/**
 * S10-C / D5 — QUI PEUT REPONDRE, LU COMME LE SERVEUR LE LIT.
 *
 * Le serveur n'interroge pas la liste des entraineurs : il appelle
 * `canManageTeam(acteur, equipe)` (admin/event-team-audience.ts:135-144), qui
 * dit oui a l'entraineur de l'equipe ET au dirigeant de son club. Ne regarder
 * que `trainers` cacherait donc les boutons a un dirigeant que le serveur
 * laisserait passer.
 * @param {any} team
 * @param {any} user
 * @returns {boolean}
 */
const isTeamManagerForUser = (team, user) => {
  if (!getUserKey(user)) return false;
  if (isTeamTrainerForUser(team, user)) return true;
  return canUserEditClub(user, team?.club?.documentId || '');
};

function EventTeamAudiencesSection({ canManageEvent = false, event, userData }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const queryClient = useQueryClient();
  const audiences = useMemo(() => (Array.isArray(event?.teamAudiences) ? event.teamAudiences : []), [event?.teamAudiences]);

  const refreshEvent = () => {
    queryClient.invalidateQueries({ queryKey: ['event', event?.documentId] });
  };

  const respondMutation = useMutation({
    mutationFn: ({ action, audienceId }) => respondEventTeamAudience(audienceId, action),
    onError: (error) => Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour cette invitation.'),
    onSuccess: refreshEvent,
  });

  if (!audiences.length) return null;

  return (
    <View
      style={[ApplicationStyle.card, Spaces.padding[16], Spaces.gap[12], {
        backgroundColor: `${Colors.primary700}66`,
        borderColor: `${Colors.primary500}44`,
      }]}
    >
      <Text style={[Fonts.h4, Fonts.neutral00]}>Invitations d&apos;équipe</Text>
      <View style={Spaces.gap[12]}>
        {audiences.map((audience) => {
          const team = audience?.team || null;
          const audienceId = audience?.documentId || audience?.id;
          const selectedMembers = Array.isArray(audience?.selectedMembers) ? audience.selectedMembers : [];
          // S10-C / D5 — TROIS CHANGEMENTS, TROIS RAISONS MESUREES :
          //  1. `canManageEvent` sort : apres S10-A (D2) l'organisateur ne peut
          //     plus s'auto-accepter, ses boutons rendraient 403 ;
          //  2. la comparaison a `respondedBy` sort : sur un PENDING elle
          //     comparait DEUX chaines vides des que le lecteur n'avait pas
          //     d'identite chargee, et montrait les boutons a n'importe qui ;
          //  3. le dirigeant du club invite entre : c'est la regle du serveur.
          const isPending = String(audience?.status || '').toUpperCase() === 'PENDING';
          const canRespond = isPending && isTeamManagerForUser(team, userData);
          // L'organisateur garde l'annulation (S10-A D2). Sans ce bouton, la
          // route `cancel` ne serait atteinte par RIEN dans l'app.
          const canCancel = isPending && !canRespond && canManageEvent;

          return (
            <View
              key={audience.documentId || audience.id || `${team?.name || 'team'}-${audience?.audienceKind || 'audience'}`}
              style={[ApplicationStyle.card, Spaces.padding[12], Spaces.gap[8], {
                backgroundColor: `${Colors.primary800}A6`,
                borderColor: `${Colors.primary500}33`,
              }]}
            >
              <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, { gap: 8 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{team?.name || 'Equipe'}</Text>
                  <Text style={[Fonts.p3, Fonts.neutral200]}>
                    {getAudienceLabel(audience)}
                    {' '}
                    -
                    {' '}
                    {audience?.selectionMode === 'SELECTED_MEMBERS'
                      ? `${selectedMembers.length} membre(s)`
                      : 'Tous les membres'}
                  </Text>
                </View>
                <Text style={[Fonts.p3Bold, audience?.status === 'PENDING' ? Fonts.gold500 : Fonts.primary500]}>
                  {getStatusLabel(audience?.status)}
                </Text>
              </View>

              {audience?.team?.club?.name ? (
                <Text style={[Fonts.p3, Fonts.neutral200]}>{audience.team.club.name}</Text>
              ) : null}

              {canRespond ? (
                <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                  <Button
                    disabled={respondMutation.isPending}
                    onPress={() => respondMutation.mutate({ action: 'accept', audienceId })}
                    title="Accepter"
                  />
                  <Button
                    disabled={respondMutation.isPending}
                    onPress={() => respondMutation.mutate({ action: 'refuse', audienceId })}
                    title="Refuser"
                    variant="Secondary"
                  />
                </View>
              ) : null}

              {canCancel ? (
                <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                  <Button
                    disabled={respondMutation.isPending}
                    onPress={() => respondMutation.mutate({ action: 'cancel', audienceId })}
                    title="Annuler l'invitation"
                    variant="Secondary"
                  />
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default EventTeamAudiencesSection;
