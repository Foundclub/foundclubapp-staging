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
 * @param {number} [props.membres] - PAGE-EQUIPE (19/11, planche 4c) : le nombre de membres, dit
 *   dans le bouton (« Discussion de l'équipe · 7 membres »).
 * @param {boolean} [props.pleineLargeur] - PAGE-EQUIPE (planches 4c, 9b) : bouton à contour, sur
 *   toute la largeur. Sans lui, le bouton d'avant (la carte « Mon équipe » de la fiche).
 * @returns {import('react').ReactElement | null} Le bloc, ou rien.
 */
function TournamentTeamDiscussion({
  discussion, membres = 0, navigation, pleineLargeur = false,
}) {
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
        size={pleineLargeur ? undefined : 'sm'}
        style={{ alignSelf: pleineLargeur ? 'stretch' : 'flex-start' }}
        title={membres > 0
          ? t('implEquipe.page.discussion', { count: membres })
          : t('tournamentTeamDetails.teamDiscussion', "Discussion de l'équipe")}
        variant={pleineLargeur ? 'Secondary' : 'Primary'}
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
