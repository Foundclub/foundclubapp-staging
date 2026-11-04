import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { getTournamentInvitationPreview } from '@/services/event/eventService';
import { registerClubTeamToTournament } from '@/services/tournamentTeam/tournamentTeamService';

/**
 * T3-TOURNOI-PRIVE (Adel « 8 A », 02/11 : lien = demande validée) —
 * ce que voit un compte sans lien
 * en ouvrant le lien d'un tournoi privé : le tournoi, et sa demande pour l'une de ses équipes.
 * @param {{ error?: any, eventId: string }} props - Le tournoi, et le refus du tableau de bord.
 * @returns {import('react').JSX.Element | null} L'écran, ou rien si le tournoi n'existe pas.
 */
export default function TournamentInvitationRequest({ eventId }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  const { userData } = useAuth();
  const [demandee, setDemandee] = useState(false);
  const [erreur, setErreur] = useState('');

  const { data: apercu, isLoading } = useQuery({
    queryFn: () => getTournamentInvitationPreview(eventId),
    queryKey: ['tournament-invitation-preview', eventId],
  });
  const demander = useMutation({
    mutationFn: (/** @type {string} */ equipeId) => registerClubTeamToTournament(eventId, equipeId),
    onError: (/** @type {any} */ raison) => setErreur(
      raison?.message || t('tournamentInvitation.error', "La demande n'a pas pu partir."),
    ),
    onSuccess: () => setDemandee(true),
  });

  if (isLoading || !apercu?.invitationPreview) return null;
  const equipes = (userData?.trainedTeams || [])
    .filter((/** @type {any} */ equipe) => equipe?.documentId);

  return (
    <View
      style={[Spaces.gap[12], Spaces.paddingVertical[24], { maxWidth: 560, width: '100%' }]}
      testID="tournoi-demande"
    >
      <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{apercu.name}</Text>
      {apercu.club?.name ? (
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t('tournamentInvitation.organizedBy', 'Organisé par {{club}}', {
            club: apercu.club.name,
            ...SANS_ECHAPPEMENT,
          })}
        </Text>
      ) : null}
      <Text style={[Fonts.p2, Fonts.neutral100]}>
        {t(
          'tournamentInvitation.private',
          "Ce tournoi est privé : l'organisateur valide chaque équipe.",
        )}
      </Text>

      {demandee ? (
        <Text accessibilityLiveRegion="polite" style={[Fonts.p2Bold, Fonts.primary100]}>
          {t(
            'tournamentInvitation.sent',
            "Demande envoyée. Tu verras le tournoi dès que l'organisateur l'aura acceptée.",
          )}
        </Text>
      ) : null}
      {!demandee && !equipes.length ? (
        <Text style={[Fonts.p2, Fonts.neutral100]}>
          {t(
            'tournamentInvitation.noTeam',
            'Il faut encadrer une équipe pour demander à participer.',
          )}
        </Text>
      ) : null}
      {!demandee ? equipes.map((/** @type {any} */ equipe) => (
        <Button
          isLoading={demander.isPending}
          key={equipe.documentId}
          onPress={() => { setErreur(''); demander.mutate(equipe.documentId); }}
          title={t('tournamentInvitation.request', 'Demander pour {{team}}', {
            team: equipe.name,
            ...SANS_ECHAPPEMENT,
          })}
          variant="Primary"
        />
      )) : null}
      {erreur ? (
        <Text accessibilityLiveRegion="polite" style={[Fonts.p3, Fonts.error500]}>{erreur}</Text>
      ) : null}
    </View>
  );
}
