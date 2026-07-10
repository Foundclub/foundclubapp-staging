import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Badge d&apos;offre du handoff design : pastille + libellé indiquant quelle
 * offre couvre une action (cyan = Équipe, violet = Club). Purement
 * informatif — ne bloque jamais l&apos;action.
 * @param {object} props
 * @param {'club' | 'team'} props.scope - Offre concernée.
 * @param {string} [props.label] - Libellé custom (défaut « Offre Équipe » / « Offre Club »).
 * @returns {import('react').ReactElement}
 */
function PremiumBadge({ label, scope }) {
  const { Alignments, Colors, Fonts } = useTheme();
  const tone = scope === 'club' ? Colors.violet500 : Colors.primary500;
  const resolvedLabel = label || (scope === 'club' ? 'Offre Club' : 'Offre Équipe');

  return (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        {
          backgroundColor: `${tone}1F`,
          borderRadius: 999,
          columnGap: 5,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
      ]}
    >
      <View
        style={{
          backgroundColor: tone,
          borderRadius: 999,
          height: 6,
          width: 6,
        }}
      />
      <Text style={[Fonts.p4Bold, { color: tone }]}>
        {resolvedLabel}
      </Text>
    </View>
  );
}

export default PremiumBadge;
