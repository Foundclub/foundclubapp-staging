import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { getTournamentEssentials } from '@/views/event/components/TournamentEssentials';

import { RouteNames } from '@/navigation/routeNames';

import {
  MY_TOURNAMENT_INVITATIONS_KEY,
  useMyTournamentInvitations,
} from '@/services/tournamentTeam/tournamentTeamQueries';
import { respondToTournamentInvitation } from '@/services/tournamentTeam/tournamentTeamService';

import texteInsecable from '@/utils/texteInsecable';

// Une panne de cette lecture ne dit rien : l'accueil reste tel quel (ancien serveur, rôle sans
// droit).
const LECTURE_DISCRETE = Object.freeze({ meta: { preventToastError: true }, retry: false });

/**
 * La ligne « jour · heures » puis « lieu » de la fiche du tournoi (mêmes règles que ses cases).
 * @param {any} event - Le tournoi de l'invitation.
 * @returns {string[]} Les lignes, sans les vides.
 */
const lignesDuTournoi = (event) => {
  const cases = getTournamentEssentials(event);
  return [['date', ' · '], ['place', ', ']].map(([cle, joint]) => {
    const item = cases.find((candidat) => candidat.key === cle);
    return item ? [item.value, item.note].filter(Boolean).join(joint) : '';
  }).filter(Boolean);
};

/**
 * Une invitation : qui invite, le tournoi, la question, et trois gestes.
 * @param {object} props - Les propriétés.
 * @param {any} props.invitation - L'invitation (`team`, `event`, `invitedBy`).
 * @param {{ navigate: (...args: any[]) => void }} props.navigation - La navigation de l'accueil.
 * @returns {import('react').ReactElement} La carte.
 */
function CarteInvitationTournoi({ invitation, navigation }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const queryClient = useQueryClient();
  const [erreur, setErreur] = useState('');
  const teamId = String(invitation?.team?.documentId || '');
  const eventId = String(invitation?.event?.documentId || '');

  const reponse = useMutation({
    meta: { preventToastError: true }, // le refus s'écrit sur la carte, pas dans une alerte
    mutationFn: (/** @type {'accepted' | 'declined'} */ status) => (
      respondToTournamentInvitation(teamId, status)
    ),
    onError: (/** @type {any} */ raison) => {
      setErreur(raison?.message || t(
        'tournamentHomeInvitation.error',
        'Ta réponse n’est pas partie. Vérifie ta connexion, puis réessaie.',
      ));
    },
    onSuccess: async (_equipe, status) => {
      setErreur('');
      // Les clefs de la page d'équipe (son `invalidate`), plus la liste de l'accueil : la carte
      // s'en va.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...MY_TOURNAMENT_INVITATIONS_KEY] }),
        queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
        queryClient.invalidateQueries({ queryKey: ['tournamentTeam', teamId] }),
      ]);
      if (status === 'accepted') {
        navigation.navigate(RouteNames.EventStack, {
          params: { eventId, teamId },
          screen: RouteNames.TournamentTeamDetails,
        });
      }
    },
  });

  const invitant = invitation?.invitedBy?.displayName
    || t('tournamentHomeInvitation.someone', 'Un joueur');
  const enCours = reponse.isPending;

  return (
    <View
      style={{
        backgroundColor: withAlpha(Colors.primary800, 0.82),
        borderColor: withAlpha(Colors.primary500, 0.3),
        borderRadius: 20,
        borderWidth: 1,
        gap: 6,
        padding: 16,
      }}
      testID={`accueil-invitation-tournoi-${teamId}`}
    >
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>
        {t('tournamentHomeInvitation.pending', 'Invitation en attente')}
      </Text>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
        {t(
          'tournamentHomeInvitation.sentence',
          '{{inviter}} t’invite à rejoindre son équipe {{team}} pour le tournoi {{tournament}}.',
          {
            inviter: invitant,
            team: invitation?.team?.name || '',
            tournament: invitation?.event?.name || '',
            ...SANS_ECHAPPEMENT,
          },
        )}
      </Text>
      {lignesDuTournoi(invitation?.event).map((ligne) => (
        <Text key={ligne} style={[Fonts.p3, Fonts.neutral200]}>{ligne}</Text>
      ))}
      <Text style={[Fonts.p3, Fonts.neutral00, { marginTop: 4 }]}>
        {t('tournamentHomeInvitation.question', 'Veux-tu rejoindre son équipe pour ce tournoi ?')}
      </Text>
      {erreur ? (
        <Text accessibilityLiveRegion="polite" style={[Fonts.p3, { color: Colors.error500 }]}>
          {erreur}
        </Text>
      ) : null}
      <View
        style={[
          Alignments.row, Alignments.alignCenter, { flexWrap: 'wrap', gap: 12, marginTop: 4 },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="link"
          onPress={() => navigation.navigate(RouteNames.EventStack, {
            params: { eventId },
            screen: RouteNames.EventDetails,
          })}
          style={{ justifyContent: 'center', minHeight: 44, paddingRight: 8 }}
        >
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>
            {texteInsecable(t('tournamentHomeInvitation.seeTournament', 'Voir le tournoi'))}
          </Text>
        </TouchableOpacity>
        <View style={[Alignments.row, { flexGrow: 1, gap: 12, justifyContent: 'flex-end' }]}>
          <Button
            disabled={enCours}
            onPress={() => reponse.mutate('declined')}
            // Même « Refuser » que la page d'équipe (TournamentTeamDetails.js) : bord et texte
            // rouges.
            style={{ borderColor: withAlpha(Colors.error500, 0.33) }}
            textStyle={{ color: Colors.error500 }}
            title={t('tournamentHomeInvitation.decline', 'Refuser')}
            variant="SecondaryLight"
          />
          <Button
            disabled={enCours}
            isLoading={enCours && reponse.variables === 'accepted'}
            keepTitleWhileLoading
            onPress={() => reponse.mutate('accepted')}
            title={t('tournamentHomeInvitation.accept', 'Accepter')}
            variant="Primary"
          />
        </View>
      </View>
    </View>
  );
}

/**
 * T-INVITATION-ACCUEIL (18/11/2026, Adel D237 ; constat M1357 de la recette 46) — L'INVITATION À
 * REJOINDRE UNE ÉQUIPE DE TOURNOI, EN ATTENTE, EN HAUT DE L'ACCUEIL (téléphone et site) : une carte
 * par invitation `invited`, avec qui invite (nom entier d'un majeur, « Prénom I. » sinon : le
 * serveur décide), le tournoi (jour, heures, lieu : les cases de la fiche), « Voir le tournoi », «
 * Refuser » et « Accepter ». Accepter et Refuser appellent l'action de la page d'équipe
 * (`respondToTournamentInvitation`) : aucune règle neuve, le refus du serveur (déjà dans une
 * équipe, équipe pleine, âge) s'écrit sur la carte. Après « Accepter », la page d'équipe (« Ta
 * place » à payer). Rien sans invitation, rien si la lecture échoue. Témoins :
 * __tests__/InvitationsTournoiAccueil.test.js, __tests__/HomeHub.T-INVITATION-ACCUEIL.test.js.
 * @param {object} props - Les propriétés.
 * @param {{ navigate: (...args: any[]) => void }} props.navigation - La navigation de l'accueil.
 * @returns {import('react').ReactElement | null} Les cartes, ou rien.
 */
function InvitationsTournoiAccueil({ navigation }) {
  // L'onglet de l'accueil reste monté et l'app ne relit rien au retour (`refetchOnWindowFocus: false`) :
  // la lecture suit le focus de l'écran (comme HomeHub.js), une invitation répondue sur la page
  // d'équipe ou reçue entre-temps est à jour au retour sur l'accueil.
  const isFocused = useIsFocused();
  const lecture = useMyTournamentInvitations({ ...LECTURE_DISCRETE, enabled: isFocused });
  const invitations = (Array.isArray(lecture?.data) ? lecture.data : [])
    .filter((invitation) => invitation?.responseStatus === 'invited'
      && invitation?.team?.documentId && invitation?.event?.documentId);
  if (!invitations.length) return null;
  return (
    <View style={{ gap: 12 }}>
      {invitations.map((invitation) => (
        <CarteInvitationTournoi
          invitation={invitation}
          key={String(invitation.team.documentId)}
          navigation={navigation}
        />
      ))}
    </View>
  );
}

export default InvitationsTournoiAccueil;
