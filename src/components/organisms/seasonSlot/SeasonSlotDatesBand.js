import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { slotShape, slotWho, timeRange } from '@/domains/seasonSlot/seasonSlotDisplay';
import { formeEnMots } from '@/domains/seasonSlot/seasonSlotWhen';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * 🗓️ R17-QUAND-1, point 6 (planche P11-quand-v2-ordi, état A ; P11-quand-ou-ca-vit, 2) — LA BANDE
 * « DATES CHOISIES, HORS SEMAINE TYPE ». Un créneau aux dates choisies n'a pas de jour fixe : il ne
 * tient dans aucune colonne de la semaine type. Il se lit ici, sous la grille (au téléphone, en
 * groupe sous les jours) : qui, quelles heures, quelles dates, combien. Dans le planning daté, il
 * s'affiche à ses dates comme les autres (serveur). Un appui ouvre le créneau (« Gérer »).
 * @param {{ creneaux: any[], onCreneau?: (creneau: any) => void }} props - Tous les créneaux de
 *   l'installation : la bande garde ceux aux dates choisies.
 * @returns {import('react').ReactElement | null} La bande, ou rien.
 */
function SeasonSlotDatesBand({ creneaux, onCreneau }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const aDates = (Array.isArray(creneaux) ? creneaux : [])
    .filter((creneau) => slotShape(creneau).recurrence === 'dates');
  if (!aDates.length) return null;
  const titre = t('collectiviteCreneaux.quand.bandeTitre', 'Dates choisies, hors semaine type');
  return (
    <View
      accessibilityLabel={titre}
      style={{
        backgroundColor: withAlpha(Colors.primary500, 0.05),
        borderColor: withAlpha(Colors.primary500, 0.5),
        borderRadius: 12,
        borderStyle: 'dashed',
        borderWidth: 1,
        gap: 8,
        padding: 12,
      }}
      testID="bande-dates-choisies"
    >
      <View
        style={[
          Alignments.row, Alignments.alignCenter, { gap: 8, justifyContent: 'space-between' },
        ]}
      >
        <Text accessibilityRole="header" style={[Fonts.p2Bold, Fonts.neutral00]}>{titre}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t('collectiviteCreneaux.quand.bandeCompte', {
            count: aDates.length,
            defaultValue_one: '{{count}} créneau',
            defaultValue_other: '{{count}} créneaux',
          })}
        </Text>
      </View>
      {aDates.map((creneau) => (
        <TouchableOpacity
          accessibilityRole="button"
          disabled={!onCreneau}
          key={creneau.documentId}
          onPress={() => onCreneau?.(creneau)}
          style={[Alignments.row, Alignments.alignCenter, {
            backgroundColor: withAlpha(creneau.displayColor || Colors.primary500, 0.14),
            borderLeftColor: creneau.displayColor || Colors.primary500,
            borderLeftWidth: 4,
            borderRadius: 10,
            gap: 12,
            minHeight: 44,
            paddingHorizontal: 10,
            paddingVertical: 6,
          }]}
          testID={`bande-dates-${creneau.documentId}`}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {[slotWho(creneau), timeRange(creneau.startTime, creneau.endTime)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>{formeEnMots(t, creneau)}</Text>
          </View>
          <Text
            style={[Fonts.p3Bold, Fonts.primary200, {
              borderColor: withAlpha(Colors.primary200, 0.5),
              borderRadius: 100,
              borderWidth: 1,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }]}
          >
            {formeEnMots(t, creneau, { court: true })}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default SeasonSlotDatesBand;
