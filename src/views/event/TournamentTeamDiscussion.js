import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { RouteNames } from '@/navigation/routeNames';

/**
 * T-FIL-EQUIPE (15/11/2026, tournoi du 19/12, Adel D25 « B ») — « Discussion de l'équipe »,
 * sur la fiche d'équipe. Le serveur pose `team.discussion` (admin, team-chat.js) :
 *   · `{ chat, ecriture }` : le lecteur est dans le fil → le bouton ouvre la conversation ;
 *     `ecriture: false` (équipe refusée ou archivée) → on peut la relire ;
 *   · `{ ferme, message }` : membre tenu dehors par la règle des mineurs → la phrase seule ;
 *   · rien (tiers, équipe de club, serveur d'avant) → rien.
 * @param {object} props - Les propriétés.
 * @param {any} props.discussion - `team.discussion`.
 * @param {any} props.navigation - La navigation de l'écran.
 * @returns {import('react').ReactElement | null} Le bloc, ou rien.
 */
function TournamentTeamDiscussion({ discussion, navigation }) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  if (discussion?.ferme === true) {
    return (
      <Text style={[Fonts.p3, Fonts.neutral200]} testID="tournament-team-discussion-closed">
        {t('tournamentTeamDetails.discussionMinorOutside', String(discussion?.message || ''))}
      </Text>
    );
  }
  const chatId = String(discussion?.chat || '');
  if (!chatId) return null;
  return (
    <View style={Spaces.gap[8]}>
      <Button
        onPress={() => navigation.navigate(RouteNames.Conversation, { chatId })}
        size="sm"
        style={{ alignSelf: 'flex-start' }}
        title={t('tournamentTeamDetails.teamDiscussion', "Discussion de l'équipe")}
        variant="Primary"
      />
      {discussion?.ecriture === false ? (
        <Text style={[Fonts.p4, Fonts.neutral200]}>
          {t(
            'tournamentTeamDetails.discussionReadOnly',
            'La discussion est fermée : tu peux la relire.',
          )}
        </Text>
      ) : null}
    </View>
  );
}

export default TournamentTeamDiscussion;
