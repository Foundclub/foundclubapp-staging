import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import { buildLineupUpdateNotice } from './convocationWizardUtils';

/**
 * MESSAGERIE-1C — LA NOTICE « COMPOSITION MODIFIEE (v3) : X REMPLACE Y » (pack §3.12, §3.17).
 *
 * Deduite des messages `lineup_share` deja charges du fil, sans serveur : chaque publication
 * poste une nouvelle carte (version + 1), la precedente est dans le fil. Une seule notice par
 * composition : seule la carte la plus recente la porte. Style discret du pack (11,5 / 15).
 * @param {object} props
 * @param {any} props.composition La charge `lineup_share` de la carte.
 * @param {any[]} [props.messages] Les messages bruts deja charges du fil.
 * @returns {import('react').ReactElement | null}
 */
function ConvocationUpdateNotice({ composition, messages = [] }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const notice = buildLineupUpdateNotice({ composition, messages });
  if (!notice) return null;

  let text = t('conversationConvocation.notice.updated', { version: notice.version });
  if (notice.kind === 'replaced') {
    // Des NOMS de joueurs (« Rayan N'Diaye ») : sans echappement, comme tout nom (FINITIONS3).
    text = t('conversationConvocation.notice.replaced', {
      entering: notice.entering,
      leaving: notice.leaving,
      version: notice.version,
      ...SANS_ECHAPPEMENT,
    });
  } else if (notice.kind === 'changed') {
    const changes = [
      notice.added ? t('conversationConvocation.notice.added', { count: notice.added }) : '',
      notice.removed ? t('conversationConvocation.notice.removed', { count: notice.removed }) : '',
    ].filter(Boolean).join(', ');
    text = t('conversationConvocation.notice.changed', {
      changes, version: notice.version, ...SANS_ECHAPPEMENT,
    });
  }

  return (
    <View style={styles.row} testID="convocation-update-notice">
      <Text
        style={[
          Fonts.p4,
          styles.pill,
          {
            backgroundColor: withAlpha(Colors.primary900, 0.55),
            color: withAlpha(Colors.neutral00, 0.62),
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 8,
    fontSize: 11.5,
    lineHeight: 15,
    maxWidth: 280,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 6,
  },
});

export default ConvocationUpdateNotice;
