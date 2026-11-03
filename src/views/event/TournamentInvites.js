import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, Text, View } from 'react-native';

import { buildInviteWebUrl } from '@/domains/invitations/inviteLink';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import {
  getEventTeamAudiences,
  inviteEventTeamAudience,
  respondEventTeamAudience,
} from '@/services/event/eventService';
import { getTeams } from '@/services/team/teamService';

import TournamentTeamSearch from './TournamentTeamSearch';

const STATUTS_VIVANTS = ['ACCEPTED', 'PENDING'];

/**
 * T3-TOURNOI-PRIVE (Adel « 8 A », 02/11) — la liste d'invités d'un tournoi privé, côté
 * organisateur : toutes les équipes de son club d'un geste, une équipe d'un autre club,
 * le lien à partager. Une équipe
 * invitée qui accepte est inscrite ; une demande par le lien arrive dans « Équipes inscrites ».
 * @param {{ clubId?: string | null, eventId: string }} props - Le tournoi.
 * @returns {import('react').JSX.Element} Le bloc.
 */
export default function TournamentInvites({ clubId = null, eventId }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const cleDesInvites = ['tournament-invites', eventId];

  const { data: reponse } = useQuery({
    queryFn: () => getEventTeamAudiences(eventId),
    queryKey: cleDesInvites,
  });
  const invites = (Array.isArray(reponse?.data) ? reponse.data : [])
    .filter((/** @type {any} */ audience) => (
      STATUTS_VIVANTS.includes(audience?.status) && audience?.team?.documentId
    ));
  const dejaInvitees = new Set(invites.map((/** @type {any} */ audience) => (
    audience.team.documentId
  )));

  const apresEcriture = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: cleDesInvites }),
    queryClient.invalidateQueries({ queryKey: ['tournament-dashboard', eventId] }),
  ]);
  const direLErreur = (/** @type {any} */ erreur) => setMessage(
    erreur?.message || t('tournamentInvites.error', "L'invitation n'a pas pu partir."),
  );

  const monClub = useMutation({
    mutationFn: async () => {
      const equipes = await getTeams({ clubId: clubId ?? undefined, pageSize: 100, summary: true });
      const aInviter = /** @type {any[]} */ (Array.isArray(equipes?.data) ? equipes.data : [])
        .filter((equipe) => equipe?.documentId && !dejaInvitees.has(equipe.documentId));
      // Une par une : le tournoi peut être plein, et ce qui est passé doit le rester.
      await aInviter.reduce(
        (suite, equipe) => suite.then(() => inviteEventTeamAudience(eventId, {
          audienceKind: 'internal_invited',
          teamId: equipe.documentId,
        })),
        Promise.resolve(),
      );
      return aInviter.length;
    },
    onError: direLErreur,
    onSettled: apresEcriture,
    onSuccess: (/** @type {number} */ nombre) => setMessage(nombre
      ? t(
        'tournamentInvites.clubInvited',
        'Équipes de ton club inscrites : {{count}}.',
        { count: nombre },
      )
      : t(
        'tournamentInvites.clubAlreadyInvited',
        'Toutes les équipes de ton club sont déjà invitées.',
      )),
  });

  const inviter = useMutation({
    mutationFn: (/** @type {any} */ equipe) => inviteEventTeamAudience(eventId, {
      audienceKind: 'external_invited',
      teamId: equipe?.documentId,
    }),
    onError: direLErreur,
    onSettled: apresEcriture,
    onSuccess: () => setMessage(t(
      'tournamentInvites.sent',
      'Invitation envoyée. Elle attend la réponse de son entraîneur.',
    )),
  });

  const retirer = useMutation({
    mutationFn: (/** @type {string} */ audienceId) => (
      respondEventTeamAudience(audienceId, 'cancel')
    ),
    onError: direLErreur,
    onSettled: apresEcriture,
  });

  const partagerLeLien = () => {
    const url = buildInviteWebUrl({ id: eventId, subject: 'tournament' });
    if (url) Share.share({ message: url, url });
  };

  return (
    <View style={Spaces.gap[12]} testID="tournoi-invites">
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
        {t('tournamentInvites.title', 'Invités')}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {t(
          'tournamentInvites.hint',
          "Avec le lien, une équipe demande à participer : c'est toi qui acceptes.",
        )}
      </Text>

      {clubId ? (
        <Button
          isLoading={monClub.isPending}
          onPress={() => monClub.mutate()}
          size="sm"
          title={t('tournamentInvites.myClub', 'Inviter mon club')}
          variant="Primary"
        />
      ) : null}
      <Button
        onPress={partagerLeLien}
        size="sm"
        title={t('tournamentInvites.shareLink', 'Partager le lien')}
        variant="Secondary"
      />
      <TournamentTeamSearch
        equipesDejaInvitees={dejaInvitees}
        exclureClubId={clubId}
        onChoisir={(/** @type {any} */ equipe) => inviter.mutate(equipe)}
      />

      {message ? (
        <Text accessibilityLiveRegion="polite" style={[Fonts.p3, Fonts.primary100]}>
          {message}
        </Text>
      ) : null}

      {invites.map((/** @type {any} */ audience) => (
        <View key={audience.documentId} style={Spaces.gap[4]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{audience.team.name}</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {audience.status === 'ACCEPTED'
              ? t('tournamentInvites.accepted', 'Inscrite')
              : t('tournamentInvites.pending', 'Attend sa réponse')}
          </Text>
          {audience.status === 'PENDING' ? (
            <Button
              isLoading={retirer.isPending}
              onPress={() => retirer.mutate(audience.documentId)}
              size="sm"
              title={t('tournamentInvites.cancel', "Retirer l'invitation")}
              variant="Secondary"
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}
