import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import StatsIcon from '@/components/atoms/SvgIcon/SvgIcon';

/**
 * ST-VUES — LES STATS D UN JOUEUR SUR SON PROFIL, VUES PAR UN AUTRE (planche 17).
 *
 * Decisions d Adel du 02/10 : « profil A » (les stats d un joueur sont PRIVEES, sauf
 * pour l entraineur de son equipe) et « b oui » (l entraineur voit les chiffres de
 * son joueur, pour SON equipe). C est le SERVEUR qui decide (`scope.viewer`) :
 *   · `coach` : « Dans ton équipe · U15 », trois tuiles, et qui les lit ;
 *   · `preview` (mon profil en apercu) : PAS de chiffres — l apercu montre enfin ce
 *     que voient les autres — et une ligne dit qui les voit (defaut 8 du releve) ;
 *   · `full` (le SuperAdmin, a qui le serveur rend tout) : les memes tuiles ;
 *   · tout autre lecteur : RIEN. La carte « Ces statistiques ne sont visibles que
 *     par la personne elle-même » disparait (note « retiré » de la planche).
 * ⛔ Retires aussi : les deux rangees d onglets Sport et Equipe (le filtre vit dans
 * la page « Mes stats »).
 */

/**
 * Le mode d affichage, depuis ce que le serveur a rendu.
 * @param {object} input - Les faits.
 * @param {any} [input.stats] - La reponse de `personal-stats`, ou rien (403).
 * @param {boolean} [input.isSelfPreview] - Mon profil, en apercu.
 * @returns {'coach' | 'full' | 'hidden' | 'preview'} - Le mode.
 */
export const resolveProfileStatsMode = ({ isSelfPreview = false, stats }) => {
  if (isSelfPreview) return 'preview';
  if (stats?.scope?.viewer === 'coach') return 'coach';
  if (stats?.overall) return 'full';
  return 'hidden';
};

/**
 * Le bloc stats du profil d un joueur, pour celui qui le regarde.
 * @param {object} props - Les proprietes du composant.
 * @param {any} [props.stats] - La reponse de `personal-stats`.
 * @param {boolean} [props.isLoading] - La lecture est en cours.
 * @param {boolean} [props.isSelfPreview] - Mon profil, en apercu.
 * @param {boolean} [props.mayBeCoach] - Le lecteur entraine une equipe du joueur (squelette).
 * @returns {import('react').ReactElement | null} - Le bloc, ou rien.
 */
function ProfileStatsForViewer({
  isLoading = false, isSelfPreview = false, mayBeCoach = false, stats,
}) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const lockLine = (/** @type {string} */ text, /** @type {string} */ testID) => (
    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]} testID={testID}>
      <StatsIcon color={Colors.neutral300} height={16} name="shield" width={16} />
      <Text style={[Fonts.p3, Fonts.neutral300, { flex: 1 }]}>{text}</Text>
    </View>
  );

  if (isSelfPreview) {
    return lockLine(
      t('profileStats.previewLine', 'Tes stats de match ne sont visibles que par toi et ton entraîneur.'),
      'profile-stats-preview',
    );
  }

  if (isLoading) {
    return mayBeCoach ? (
      <View
        style={{ backgroundColor: withAlpha(Colors.neutral00, 0.06), borderRadius: 24, height: 180 }}
        testID="profile-stats-loading"
      />
    ) : null;
  }

  const mode = resolveProfileStatsMode({ isSelfPreview, stats });
  if (mode === 'hidden') return null;

  const overall = stats?.overall || {};
  const isBasketball = Number(overall?.basketball?.points || 0) > 0 && !Number(overall?.football?.goals || 0);
  const scoring = isBasketball ? Number(overall?.basketball?.points || 0) : Number(overall?.football?.goals || 0);
  const teamNames = (Array.isArray(stats?.scope?.teams) ? stats.scope.teams : [])
    .map((team) => team?.name)
    .filter(Boolean)
    .join(', ');
  const tiles = [
    { key: 'matches', label: t('myStats.matches', 'Match', { count: Number(overall.matches || 0) }), value: Number(overall.matches || 0) },
    isBasketball
      ? { key: 'points', label: t('myStats.points', 'Point', { count: scoring }), value: scoring }
      : { key: 'goals', label: t('myStats.goals', 'But', { count: scoring }), value: scoring },
    { key: 'minutes', label: t('myStats.minutes', 'Minutes'), value: Number(overall.minutesPlayed || 0) },
  ];

  return (
    <View
      style={[ApplicationStyle.backgroundColor.primary700, ApplicationStyle.borderRadius24, Spaces.padding[16], Spaces.gap[12]]}
      testID={`profile-stats-${mode}`}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifyBetween, Spaces.gap[8]]}>
        <Text style={[Fonts.p4Bold, Fonts.primary200, { flex: 1 }]}>
          {mode === 'coach'
            ? t('profileStats.inYourTeam', 'Dans ton équipe · {{teams}}', { teams: teamNames, ...SANS_ECHAPPEMENT })
            : t('profileStats.matchStats', 'Stats de match')}
        </Text>
        {mode === 'coach' ? (
          <View
            style={{
              backgroundColor: withAlpha(Colors.neutral00, 0.08),
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Text style={[Fonts.p4Bold, Fonts.neutral100]}>{t('profileStats.coachBadge', 'Entraîneur')}</Text>
          </View>
        ) : null}
      </View>
      <View style={[Alignments.row, Spaces.gap[8]]}>
        {tiles.map((tile) => (
          <View
            key={tile.key}
            style={[
              Spaces.padding[12],
              Spaces.gap[4],
              { backgroundColor: withAlpha(Colors.neutral00, 0.04), borderRadius: 16, flex: 1 },
            ]}
          >
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{String(tile.value)}</Text>
            <Text numberOfLines={1} style={[Fonts.p4, Fonts.primary100]}>{tile.label}</Text>
          </View>
        ))}
      </View>
      {mode === 'coach'
        ? lockLine(
          t('profileStats.coachLine', 'Visible par toi, son entraîneur, pour l’équipe {{teams}} seulement.', {
            teams: teamNames,
            ...SANS_ECHAPPEMENT,
          }),
          'profile-stats-coach-line',
        )
        : null}
    </View>
  );
}

export default ProfileStatsForViewer;
