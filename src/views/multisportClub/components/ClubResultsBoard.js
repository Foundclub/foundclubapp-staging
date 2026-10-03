import { View } from 'react-native';

import ClubTeamsCard from './ClubTeamsCard';
import MultisportStatsRow from './MultisportStatsRow';
import WeekendResultsCard from './WeekendResultsCard';

/**
 * ST-VUES3-ORDI (03/10) — ÉCRAN 18 SUR ORDINATEUR, LA PLANCHE À 2 COLONNES
 * (« FoundClub — Statistiques », P5-club-ordi, « Le club du dirigeant — ordinateur »).
 *
 * « Les résultats de toutes les équipes en tableau, à gauche ; les équipes et le lien vers
 * leurs stats, à droite. » Trois parts à gauche, deux à droite (planche : `colonnes c32`).
 * Posée par « Gestion du club » d'un club omnisport (`CMDashboard`) et par le hub d'un club
 * simple (`ClubDetails`), sur ordinateur seulement : le téléphone garde la carte empilée.
 * @typedef {{
 *   data?: any, emptyAction?: { label: string, onPress: () => void } | null, error?: unknown,
 *   isLoading?: boolean, onEnterScore: (row: any) => void, onOpenMatch: (row: any) => void,
 *   onRemind: (row: any) => void, onRetry?: () => void, remindedKeys?: Set<string>,
 *   remindingKey?: string | null,
 * }} WeekendCardProps
 * @typedef {{ key: string, label: string, value: string | number, onPress?: () => void }} StatsItem
 * @param {object} props - Les propriétés du composant.
 * @param {WeekendCardProps} props.weekendCard - Ce que la carte du week-end reçoit au téléphone.
 * @param {StatsItem[]} props.statsItems - Les trois chiffres qui se touchent.
 * @param {import('./ClubTeamsCard').ClubTeam[]} props.teams - Les équipes du club.
 * @param {(team: any) => void} props.onOpenTeamStats - Ouvrir l'onglet Stats d'une équipe.
 * @returns {import('react').ReactElement} La planche.
 */
function ClubResultsBoard({
  onOpenTeamStats, statsItems, teams, weekendCard,
}) {
  return (
    <View
      style={{ alignItems: 'flex-start', flexDirection: 'row', gap: 24 }}
      testID="club-results-board"
    >
      <View style={{ flex: 3, minWidth: 0 }}>
        <WeekendResultsCard
          data={weekendCard.data}
          emptyAction={weekendCard.emptyAction}
          error={weekendCard.error}
          isLoading={weekendCard.isLoading}
          onEnterScore={weekendCard.onEnterScore}
          onOpenMatch={weekendCard.onOpenMatch}
          onRemind={weekendCard.onRemind}
          onRetry={weekendCard.onRetry}
          remindedKeys={weekendCard.remindedKeys}
          remindingKey={weekendCard.remindingKey}
          variant="table"
        />
      </View>
      <View style={{ flex: 2, gap: 16, minWidth: 0 }}>
        <MultisportStatsRow items={statsItems} />
        <ClubTeamsCard onOpenTeamStats={onOpenTeamStats} teams={teams} />
      </View>
    </View>
  );
}

export default ClubResultsBoard;
