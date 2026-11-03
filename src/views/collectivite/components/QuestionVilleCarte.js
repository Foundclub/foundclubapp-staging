import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { reportDayLabel } from '@/domains/facilityReport/facilityReportDisplay';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * T3-TICKETS-VILLE (03/11/2026) — une question sur une ligne : son début, son statut, sa date.
 * La même carte dans « Ma collectivité » (le dirigeant) et dans la boîte de la Ville (`sousTitre` :
 * le club).
 * @param {object} props - Les propriétés.
 * @param {any} props.question - La question rendue par le serveur.
 * @param {string} [props.sousTitre] - Ce qui précède la date.
 * @param {() => void} props.onPress - L'appui.
 * @returns {import('react').ReactElement} La carte.
 */
function QuestionVilleCarte({ onPress, question, sousTitre }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const couleur = {
    en_cours: Colors.primary500,
    recue: Colors.warning500,
    traitee: Colors.success500,
  }[/** @type {'en_cours' | 'recue' | 'traitee'} */ (question.status)] || Colors.neutral300;
  const statut = String(t(
    /** @type {string} */ (`collectiviteQuestions.statuts.${question.status}`),
    question.status,
  ));

  return (
    <TouchableOpacity
      accessibilityLabel={`${question.title}, ${statut}`}
      accessibilityRole="button"
      onPress={onPress}
      style={{
        backgroundColor: withAlpha(Colors.neutral00, 0.04),
        borderColor: withAlpha(Colors.neutral00, 0.1),
        borderRadius: 16,
        borderWidth: 1,
        gap: 6,
        minHeight: 44,
        padding: 14,
      }}
      testID={`question-${question.documentId}`}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', gap: 8 }}>
        <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>
          {question.title}
        </Text>
        <View
          style={{
            backgroundColor: withAlpha(couleur, 0.16),
            borderRadius: 999,
            paddingHorizontal: 10,
            paddingVertical: 2,
          }}
        >
          <Text style={[Fonts.p3Bold, { color: couleur }]}>{statut}</Text>
        </View>
      </View>
      <Text style={[Fonts.p3, Fonts.neutral200]}>
        {[sousTitre, reportDayLabel(question.createdAt)].filter(Boolean).join(' · ')}
      </Text>
    </TouchableOpacity>
  );
}

export default QuestionVilleCarte;
