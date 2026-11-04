import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// T3-BANDE-BAS (03/11, décision d'Adel) : avec `bottomInsetMode="scroll-edge"`, le contenu descend
// jusqu'au bord de l'écran, sans bande au-dessus de la barre du téléphone. Le retrait passe du
// cadre à la fin de ce qui défile : le dernier élément s'arrête au même endroit qu'avant. Le site
// n'a pas de barre du téléphone et ignore ce mode : rien à y ajouter.
/**
 * Ce que la fin d'un défilement doit laisser libre quand le cadre ne garde plus rien en bas.
 * @param {number} [margeDuCadre] Le `bottomInsetExtra` que le cadre posait (12 en mode `screen`).
 * @returns {number} Ce que la fin du défilement doit laisser libre, en plus de sa propre marge.
 */
function useRetraitBasDuDefilement(margeDuCadre = 0) {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'web' ? 0 : insets.bottom + margeDuCadre;
}

export default useRetraitBasDuDefilement;
