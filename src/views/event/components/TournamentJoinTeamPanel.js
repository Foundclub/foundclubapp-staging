import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';

import { requestJoinTournamentTeam } from '@/services/tournamentTeam/tournamentTeamService';

import {
  canAskToJoinTournamentTeam,
  getTournamentJoinBlockingNotice,
  getTournamentTeamPlayersLine,
  getTournamentTeamsSeekingPlayers,
} from '../tournamentJoinRules';
import { isPaidTournament } from './tournamentTerms';

/**
 * T-REJOINDRE (17/11/2026, Clément D50 « 2- A », registre D210) — « Rejoindre une équipe » sur la
 * fiche d'un tournoi, le même panneau pour le site (`EventDetails.web.js`) et le téléphone
 * (`EventDetails.js`). L'affiche promet « seul : on te trouve une équipe ».
 *
 * Le bouton ouvre la liste des équipes ouvertes aux demandes ET pas complètes ; « Demander à
 * rejoindre » ouvre la déclaration (la fenêtre de la page d'équipe), puis envoie la demande par
 * la route existante (`requestJoin` : l'âge et « déjà dans une équipe » sont jugés par le
 * serveur, son message est montré tel quel). Qui voit le bouton : `canAskToJoinTournamentTeam`.
 * Petit texte : celui de la maquette validée (design/DESIGN-TOURNOI-PAGES, texte d'Adel du
 * 16/11), sans « ouvre l'équipe » puisque la liste est sur la fiche.
 * @param {object} props - Les propriétés.
 * @param {any} props.event - Le tournoi.
 * @param {(team: any) => void} [props.onRequested] - Après l'envoi, avec l'équipe rendue.
 * @param {any[]} [props.teams] - Les équipes du tournoi, telles que la fiche les a reçues.
 * @returns {import('react').ReactElement | null} Le panneau, ou rien.
 */
function TournamentJoinTeamPanel({ event, onRequested, teams = [] }) {
  const { accountRoleKey, userData } = useAuth();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isListOpen, setIsListOpen] = useState(false);
  const [chosenTeam, setChosenTeam] = useState(/** @type {any} */ (null));
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');

  if (!canAskToJoinTournamentTeam({
    accountRoleKey, event, teams, user: userData,
  })) return null;

  // T-PAGES-6 (F22) : un refus connu d'avance se lit ici, avant la liste et la déclaration.
  const blockingNotice = getTournamentJoinBlockingNotice({ event, user: userData });
  if (blockingNotice) {
    return (
      <View style={Spaces.gap[12]} testID="tournament-join-team-panel">
        <Text
          accessibilityRole="alert"
          style={[Fonts.p3, Fonts.neutral00]}
          testID="tournament-join-team-blocked"
        >
          {blockingNotice}
        </Text>
      </View>
    );
  }

  const seekingTeams = getTournamentTeamsSeekingPlayers(teams, event?.tournamentConfig);
  // Le serveur refuse avec une phrase (âge, autre équipe…) : elle est montrée telle quelle. Sans
  // phrase (réseau coupé : le client rejette une simple chaîne), le joueur lit quoi faire
  // (fait de recette du 17/11 : « Impossible d'envoyer cette demande. » ne l'aidait pas).
  const fallbackError = t(
    'tournamentJoin.sendError',
    'La demande n’est pas partie. Vérifie ta connexion, puis réessaie.',
  );

  const closeDeclaration = () => {
    setChosenTeam(null);
    setSendError('');
  };

  const sendRequest = async (/** @type {any} */ acceptance = {}) => {
    if (!chosenTeam?.documentId || isSending) return;
    setSendError('');
    setIsSending(true);
    try {
      const updatedTeam = await requestJoinTournamentTeam(chosenTeam.documentId, {
        acceptRiskDeclaration: acceptance?.acceptRiskDeclaration === true,
      });
      setChosenTeam(null);
      queryClient.invalidateQueries({ queryKey: ['event', event?.documentId] });
      if (onRequested) onRequested(updatedTeam || chosenTeam);
    } catch (/** @type {any} */ error) {
      setSendError(error?.message || fallbackError);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={Spaces.gap[12]} testID="tournament-join-team-panel">
      {/* Le bouton commun ne porte pas de testID : l'identifiant est sur son enveloppe. */}
      <View testID="tournament-join-team-button">
        <Button
          onPress={() => setIsListOpen((open) => !open)}
          title={t('tournamentJoin.button', 'Rejoindre une équipe')}
          variant="Secondary"
        />
      </View>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {isPaidTournament(event)
          ? t(
            'tournamentJoin.hintPaid',
            'Tu n’as pas d’équipe ? Rejoins-en une déjà inscrite : touche « Demander à '
              + 'rejoindre ». Quand le capitaine accepte, tu paies ta place.',
          )
          : t(
            'tournamentJoin.hintFree',
            'Tu n’as pas d’équipe ? Rejoins-en une déjà inscrite : touche « Demander à '
              + 'rejoindre ». Quand le capitaine accepte, tu es dans l’équipe.',
          )}
      </Text>

      {isListOpen && seekingTeams.length === 0 ? (
        <Text accessibilityRole="alert" style={[Fonts.p3, Fonts.neutral00]}>
          {t(
            'tournamentJoin.none',
            'Aucune équipe ne cherche de joueur pour l’instant : crée la tienne ou reviens '
              + 'plus tard.',
          )}
        </Text>
      ) : null}

      {isListOpen && seekingTeams.length > 0 ? (
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
            {t('tournamentJoin.listTitle', 'Équipes qui cherchent un joueur')}
          </Text>
          {seekingTeams.map((entry) => {
            const playersLine = getTournamentTeamPlayersLine(entry);
            return (
              <View
                key={entry.team.documentId}
                style={[
                  Alignments.row,
                  Alignments.alignCenter,
                  Alignments.justifySpaceBetween,
                  ApplicationStyle.borderRadius16,
                  ApplicationStyle.borderWidth1,
                  Spaces.gap[12],
                  Spaces.padding[12],
                  { borderColor: `${Colors.primary500}44`, flexWrap: 'wrap' },
                ]}
              >
                <View style={{ flexShrink: 1, minWidth: 120 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {entry.team.name || t('eventDetails.tournamentTeam', 'Équipe tournoi')}
                  </Text>
                  {playersLine ? (
                    <Text style={[Fonts.p4, Fonts.neutral200]}>{playersLine}</Text>
                  ) : null}
                </View>
                <View testID={`tournament-join-team-ask-${entry.team.documentId}`}>
                  <Button
                    onPress={() => {
                      setSendError('');
                      setChosenTeam(entry.team);
                    }}
                    size="sm"
                    title={t('tournamentTeamDetails.askToJoin', 'Demander à rejoindre')}
                    variant="Primary"
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <JoinEventModal
        clubName={event?.club?.name || ''}
        confirmLabel={t('tournamentTeamDetails.sendMyRequest', 'Envoyer ma demande')}
        contextNote={t('tournamentTeamDetails.chosenTeam', 'Équipe choisie : {{name}}.', {
          name: chosenTeam?.name || t('eventDetails.tournamentTeam', 'Équipe tournoi'),
          ...SANS_ECHAPPEMENT,
        })}
        errorMessage={sendError || null}
        eventId={event?.documentId || ''}
        isSubmitting={isSending}
        isVisible={Boolean(chosenTeam)}
        onClose={closeDeclaration}
        onConfirm={sendRequest}
      />
    </View>
  );
}

export default TournamentJoinTeamPanel;
