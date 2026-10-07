import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { getAuthRuntimeSnapshot } from '@/store/authRuntime';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { findPublishedBranchForTeam } from '@/views/playerConvocation/playerConvocationUtils';

import { useGetEventConvocation } from '@/services/event/eventQueries';

import { buildAnswerGroups, canManageTeamConvocation } from './convocationWizardUtils';

/**
 * MESSAGERIE-1C — LE BLOC « REPONSES » SOUS LA CARTE D'UNE CONVOCATION (pack §3.7, §3.12).
 *
 * Pour qui peut la modifier (entraineur de l'equipe, super-admin) : « Presents · N »,
 * « Absents · N », « Sans reponse · N », AVEC LES NOMS (2 lignes au plus).
 *
 * 🔒 Les joueurs ajoutes a la main sont comptes PRESENTS D'OFFICE — regle d'affichage seulement
 * (`buildAnswerGroups`) : le serveur les exclut des reponses et ne change pas.
 *
 * 📡 Les reponses ne voyagent pas dans le message : elles viennent de
 * `GET /events/:id/convocation`, la lecture que la barre Present / Absent de la carte fait deja
 * (meme cle de cache). Le bloc ne se pose que sur la DERNIERE version : une carte depassee ne
 * montre pas des reponses qui ne la concernent plus.
 * @param {object} props
 * @param {any} props.composition La charge `lineup_share` de la carte.
 * @param {boolean} [props.isLatest] Cette carte est la plus recente de sa composition dans le fil.
 * @returns {import('react').ReactElement | null}
 */
function ConvocationResponsesBlock({ composition, isLatest = true }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const { auth } = /** @type {any} */ (getAuthRuntimeSnapshot());

  const eventId = String(composition?.eventId || '');
  const teamId = String(composition?.teamId || '');
  const canSee = composition?.type === 'lineup_share'
    && Boolean(eventId)
    && isLatest
    && canManageTeamConvocation({ teamId, user: auth?.user });

  const { data } = useGetEventConvocation(eventId, undefined, {
    enabled: canSee,
    refetchOnMount: true,
  });
  if (!canSee) return null;

  const branch = findPublishedBranchForTeam(data, teamId);
  const published = branch?.published || null;
  if (!published || published.requireResponse === false) return null;
  // Une carte d'une version depassee ne porte pas les reponses de la suivante.
  const cardVersion = Number(composition?.publishedVersion) || 0;
  if (cardVersion && Number(published.version) && Number(published.version) !== cardVersion) {
    return null;
  }

  const groups = buildAnswerGroups({ published, responses: branch?.responses });
  const rows = [
    {
      color: Colors.success500,
      key: 'present',
      label: t('conversationConvocation.responses.present', { count: groups.present.length }),
      names: groups.present,
    },
    {
      color: Colors.error500,
      key: 'absent',
      label: t('conversationConvocation.responses.absent', { count: groups.absent.length }),
      names: groups.absent,
    },
    {
      color: withAlpha(Colors.neutral00, 0.65),
      key: 'pending',
      label: t('conversationConvocation.responses.pending', { count: groups.pending.length }),
      names: groups.pending,
    },
  ].filter((row) => row.names.length > 0);
  if (rows.length === 0) return null;

  return (
    <View
      accessibilityLabel={[
        t('conversationConvocation.responses.title'),
        ...rows.map((row) => `${row.label} : ${row.names.join(', ')}`),
      ].join('. ')}
      accessible
      style={[styles.card, { backgroundColor: withAlpha(Colors.neutral900, 0.22) }]}
      testID="convocation-responses"
    >
      <Text style={[Fonts.p4Bold, styles.title, { color: withAlpha(Colors.neutral00, 0.72) }]}>
        {t('conversationConvocation.responses.title')}
      </Text>
      {rows.map((row) => (
        <View key={row.key}>
          <Text style={[Fonts.p3Black, styles.line, { color: row.color }]}>{row.label}</Text>
          <Text
            numberOfLines={2}
            style={[Fonts.p3, styles.line, { color: withAlpha(Colors.neutral00, 0.85) }]}
          >
            {row.names.join(', ')}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  line: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  title: {
    fontSize: 11.5,
    letterSpacing: 1,
  },
});

export default ConvocationResponsesBlock;
