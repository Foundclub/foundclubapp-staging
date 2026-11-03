import { createContext } from 'react';
import { View } from 'react-native';

/**
 * BOUTONS-FLOTTANTS (03/11/2026, demande d'Adel : « les bloque avec un fond derrière les boutons
 * flottants partout dans l'app ») — plus aucun bloc de fond : le contenu défile derrière les
 * boutons. Chaque bouton porte alors son propre fond, dans sa forme arrondie (`Button` lit ce
 * contexte) : un bouton à contour ou grisé resterait sinon illisible au-dessus du contenu, le
 * défaut qui avait fait poser ces blocs (FINITIONS5 du 01/10, F6-5 et FINITIONS8 du 02/10).
 */
export const PiedFlottantContext = createContext(false);

/**
 * Le pied d'un écran, sans fond, qui laisse passer les appuis et le défilement entre ses boutons.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {boolean} [props.flottant] - Faux quand le pied est dans le flux : les boutons n'ont
 *   rien à masquer derrière eux et gardent leur dessin habituel.
 * @param {(event: import('react-native').LayoutChangeEvent) => void} [props.onLayout]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @param {string} [props.testID]
 * @returns {import('react').ReactElement}
 */
function PiedFlottant({
  children, flottant = true, onLayout, style, testID,
}) {
  return (
    <PiedFlottantContext.Provider value={flottant}>
      <View onLayout={onLayout} pointerEvents="box-none" style={style} testID={testID}>
        {children}
      </View>
    </PiedFlottantContext.Provider>
  );
}

export default PiedFlottant;
