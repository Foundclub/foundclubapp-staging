import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

/**
 * DEUX-EQUIPES (19/11, recette 49, M1362 / M1363) — le bandeau « Ton équipe X a été refusée
 * par l'organisateur. », au-dessus de la carte « Mon équipe » de la fiche du tournoi (téléphone
 * et site). L'équipe refusée ne masque plus l'équipe où il joue ni son invitation
 * (`getViewerTournamentTeams`) : ce bandeau la garde visible.
 * `error700` sur `error100` : contraste lisible (≈ 4,6:1).
 * @param {object} props - Les propriétés.
 * @param {any} props.team - L'équipe refusée du lecteur.
 * @returns {import('react').ReactElement | null} Le bandeau.
 */
function TournamentDeclinedTeamNotice({ team }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  if (!team?.documentId) return null;
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: Colors.error100,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
      testID="tournament-declined-team-notice"
    >
      <Text style={[Fonts.p3, { color: Colors.error700 }]}>
        {/* DEUX-EQUIPES-2 : le nom vient du serveur ; */}
        {/* une apostrophe ne devient pas « &#39; » (FINITIONS3). */}
        {t('tournamentUtils.ownTeamDeclined', { name: team?.name || '', ...SANS_ECHAPPEMENT })}
      </Text>
    </View>
  );
}

export default TournamentDeclinedTeamNotice;
