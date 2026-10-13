import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

/** @typedef {'attention' | 'erreur' | 'info' | 'ok'} TonDuBandeau */

/**
 * Le jeton de couleur et l'icône d'un ton.
 * @param {TonDuBandeau} ton - Le ton.
 * @returns {{ cle: 'error500' | 'primary500' | 'success500' | 'warning500', icone: string }} Le
 *   jeton et le glyphe.
 */
const allureDu = (ton) => {
  switch (ton) {
    case 'attention':
      return { cle: 'warning500', icone: 'triangleExclamation' };
    case 'erreur':
      return { cle: 'error500', icone: 'triangleExclamation' };
    case 'ok':
      return { cle: 'success500', icone: 'circleCheck' };
    default:
      return { cle: 'primary500', icone: 'circleInformation' };
  }
};

/**
 * LE BANDEAU D'ÉTAT DES ÉCRANS DU GÉRANT — RESA-L5A1 (13/10/2026), planches E-G01, E-G02, E-G08,
 * E-G09 (`bandeau-b` : info, ok, attention) : une icône, un texte, et une action facultative. Un
 * seul bandeau à la fois par écran ; c'est l'écran qui choisit lequel.
 * @param {object} props - Les propriétés.
 * @param {string} [props.action] - Le libellé de l'action.
 * @param {() => void} [props.onAction] - L'action.
 * @param {string} [props.testID] - Le repère.
 * @param {string} props.texte - Le texte.
 * @param {TonDuBandeau} [props.ton] - Le ton.
 * @returns {import('react').ReactElement} Le bandeau.
 */
function BandeauComplexe({
  action = undefined, onAction = undefined, testID = undefined, texte, ton = 'info',
}) {
  const { Alignments, Colors, Fonts } = useTheme();
  const { cle, icone } = allureDu(ton);
  const couleur = Colors[cle];
  return (
    <View
      accessibilityRole={ton === 'erreur' || ton === 'attention' ? 'alert' : undefined}
      style={{
        backgroundColor: withAlpha(couleur, 0.12),
        borderColor: withAlpha(couleur, 0.45),
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
        padding: 16,
      }}
      testID={testID}
    >
      <View style={[Alignments.row, { alignItems: 'flex-start', gap: 12 }]}>
        <GlyphIcon color={couleur} name={icone} size={20} />
        <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{texte}</Text>
      </View>
      {action && onAction ? (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button onPress={onAction} size="sm" title={action} variant="Secondary" />
        </View>
      ) : null}
    </View>
  );
}

export default BandeauComplexe;
