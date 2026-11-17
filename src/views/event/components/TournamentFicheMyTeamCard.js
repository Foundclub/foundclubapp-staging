import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useGetTournamentTeam } from '@/services/tournamentTeam/tournamentTeamQueries';

import { createTournamentDesignSystem } from '../tournamentDesignSystem';
import TournamentTeamProgress from './TournamentTeamProgress';

/**
 * T-PAGES-4 (17/11, maquette validée (b), R4) — la carte « Mon équipe » de la fiche du tournoi,
 * au téléphone : capitaine, membre, invité ou demandeur retrouvent leur équipe et leur seul geste.
 *
 * La fiche ne reçoit ni les membres ni les places payées (`members` vide, pas de `payment`) : la
 * carte lit la page d'équipe (`useGetTournamentTeam`, la requête de « Voir mon équipe », aucun
 * changement serveur) et rend la brique de T-PAGES-A, `TournamentTeamProgress`, sans la modifier.
 * Tant que la page d'équipe n'est pas là (chargement, refus), la carte dit seulement le nom et le
 * geste : jamais « 0 / 5 » faute de données.
 * ⛔ Le hook vit ici, pas dans `EventDetails.js` : une trentaine de suites montent l'écran avec une
 * doublure de react-query sans `useQuery` ; seule la fiche d'un lecteur qui a une équipe le monte.
 * @param {object} props - Les propriétés.
 * @param {{ onPress: () => void, title: string } | null} props.action - Le geste du lecteur (le
 *   même que le bouton du bas, `getTournamentPrimaryAction`).
 * @param {any} props.team - L'équipe du lecteur, telle que la fiche la reçoit.
 * @param {any} [props.tournamentConfig] - Le réglage du tournoi.
 * @returns {import('react').ReactElement} La carte.
 */
function TournamentFicheMyTeamCard({ action, team, tournamentConfig = {} }) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const ds = createTournamentDesignSystem({
    ApplicationStyle, Colors, Fonts, Spaces,
  });
  const { data: detail } = useGetTournamentTeam(team?.documentId);

  const pied = (
    <View style={Spaces.gap[12]}>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{detail?.name || team?.name}</Text>
      {action ? (
        <Button
          onPress={action.onPress}
          style={{ minHeight: 44 }}
          title={action.title}
          variant="Secondary"
        />
      ) : null}
    </View>
  );

  return (
    <View testID="tournament-fiche-my-team">
      {detail ? (
        <TournamentTeamProgress
          footer={pied}
          members={detail.members}
          payment={detail.payment}
          showTodo
          teamStatus={detail.status}
          tournamentConfig={detail?.event?.tournamentConfig || tournamentConfig}
        />
      ) : (
        <View style={[...ds.styles.panelCard, Spaces.gap[12]]}>{pied}</View>
      )}
    </View>
  );
}

export default TournamentFicheMyTeamCard;
