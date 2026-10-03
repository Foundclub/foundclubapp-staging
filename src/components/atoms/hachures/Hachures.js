import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';

import { withAlpha } from '@/theme/colors';

/**
 * 🖥️ COLL-C4B-BIS (03/10) — DE VRAIES HACHURES (design HY521H1 page 4, `.ferme-bande` des planches
 * « P4v3-fermer-tel » et « P4v3-fermer-ordi ») : des rayures a 135 degres, 8 px a 22 % puis 8 px a
 * 8 % de la couleur donnee. Posees en FOND de leur parent (absolument) ; le parent garde son bord,
 * son rayon (`overflow: hidden`) et son texte.
 *
 * Une seule voie, react-native-svg (`Pattern`) : le site la sert par sa cale (web/src/shims), qui
 * rend les memes elements SVG. L identifiant du motif ne depend que de la couleur : plusieurs
 * plages de la meme couleur partagent un motif IDENTIQUE (sur le site, les <svg> d une page lisent
 * le premier `id` venu — il dessine la meme chose).
 * @param {{ color: string, testID?: string }} props
 * @returns {import('react').ReactElement} Les rayures.
 */
function Hachures({ color, testID = 'hachures' }) {
  const id = `hachures-${String(color).replace(/[^A-Za-z0-9]/g, '')}`;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID={testID}>
      <Svg height="100%" width="100%">
        <Defs>
          <Pattern
            height={16}
            id={id}
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
            width={16}
          >
            <Rect fill={withAlpha(color, 0.22)} height={16} width={8} x={0} y={0} />
            <Rect fill={withAlpha(color, 0.08)} height={16} width={8} x={8} y={0} />
          </Pattern>
        </Defs>
        <Rect fill={`url(#${id})`} height="100%" width="100%" x={0} y={0} />
      </Svg>
    </View>
  );
}

export default Hachures;
