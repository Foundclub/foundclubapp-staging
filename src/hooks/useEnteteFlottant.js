import { HeaderHeightContext } from '@react-navigation/elements';
import { createContext, useContext, useLayoutEffect } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';

// Les doublures jest de `react-native-safe-area-context` n'exposent pas toujours le contexte, et
// plusieurs écrans sont montés sans fournisseur : repli = aucune marge, plutôt qu'une exception.
const ContexteDesMarges = SafeAreaInsetsContext || createContext(null);

/**
 * T3-BANDEAU-HAUT (03/11/2026, essai demandé par Adel) — tout défile, sauf la flèche de retour.
 * L'en-tête de la pile reste celui de react-navigation (retour Android, geste de l'iPhone) : seul
 * ce que l'écran réservait sous lui passe dans sa liste. La barre système reste réservée, pour que
 * rien ne passe sous l'heure. La flèche porte son fond (décision BOUTONS-FLOTTANTS).
 * @param {{ setOptions?: (options: object) => void }} [navigation]
 * @returns {{
 *   conteneur: { style?: Array<import('react-native').ViewStyle>, withHeaderPadding?: boolean },
 *   retraitDuDefilement: number,
 * }} `conteneur` : à passer au `ScreenContainer` ; `retraitDuDefilement` : le haut de sa liste.
 */
function useEnteteFlottant(navigation) {
  const { Colors } = useTheme();
  const margeDuHaut = useContext(ContexteDesMarges)?.top || 0;
  const hauteurDeLEntete = useContext(HeaderHeightContext) || 0;
  const fondDuRond = Colors?.primary800;

  useLayoutEffect(() => {
    navigation?.setOptions?.({
      headerBackImage: () => (
        <HeaderBackButton decorative style={{ backgroundColor: fondDuRond }} />
      ),
    });
  }, [fondDuRond, navigation]);

  return {
    conteneur: { style: [{ paddingTop: margeDuHaut }], withHeaderPadding: false },
    retraitDuDefilement: Math.max(0, hauteurDeLEntete - margeDuHaut),
  };
}

export default useEnteteFlottant;
