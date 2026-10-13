import { Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import texteInsecable from '@/utils/texteInsecable';

/**
 * PAR-L5L6 (13/10, design parent E04 et E07) — LA PASTILLE D ETAT D UN ENFANT : « En équipe »
 * (vert), « Demande en attente » (orange), « Pas encore d'équipe » (neutre), « A son compte »
 * (cyan). Le motif de l app (pastille arrondie, liseré, texte gras) ; la couleur dit l etat,
 * le texte le dit AUSSI (jamais la couleur seule).
 *
 * 📱 Une pastille épouse son texte : espaces insécables, sinon Android 16 perd son dernier mot
 * (`texteInsecable`, recette du 28/09).
 * @param {object} props - Les propriétés.
 * @param {'ok' | 'attente' | 'neutre' | 'compte'} props.ton - L état.
 * @param {string} props.texte - Ce que dit la pastille.
 * @param {string} [props.testID] - L étiquette de test.
 * @returns {import('react').ReactElement} - La pastille.
 */
function PastilleDEtat({ testID, texte, ton }) {
  const { Colors, Fonts } = useTheme();
  const teintes = {
    attente: { encre: Colors.warning400, lisere: Colors.warning500 },
    compte: { encre: Colors.primary300, lisere: Colors.primary500 },
    neutre: { encre: Colors.neutral100, lisere: Colors.primary500 },
    ok: { encre: Colors.success200, lisere: Colors.success500 },
  };
  const teinte = teintes[ton] || teintes.neutre;

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: withAlpha(teinte.lisere, 0.12),
        borderColor: withAlpha(teinte.lisere, 0.45),
        borderRadius: 16,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 3,
      }}
      testID={testID}
    >
      <Text style={[Fonts.p3Bold, { color: teinte.encre }]}>{texteInsecable(texte)}</Text>
    </View>
  );
}

export default PastilleDEtat;
