import * as ReactNavigation from '@react-navigation/native';
import {
  createContext, useContext, useEffect, useRef,
} from 'react';
import { Platform, View } from 'react-native';

import isGuideSupported from '@/domains/tour/guideSupport';
import {
  notifyTourTargetLayout,
  registerTourTarget,
} from '@/domains/tour/tourTargetRegistry';

import TourSheetContext from '@/components/molecules/tour/tourSheetContext';

// Les doublures jest de `@react-navigation/native` (430 fichiers) n'exposent
// pas toujours `NavigationContext` : repli = « hors navigation » (l'ancre compte).
const NavigationContext = /** @type {any} */ (ReactNavigation).NavigationContext
  || createContext(undefined);
// Zone visible (ScrollView) qui contient l'ancre : sa mesure y est coupée.
const TourClipContext = createContext(/** @type {string | undefined} */ (undefined));

/**
 * Ancre invisible du guide (pack tutoriels, 01_ARCHITECTURE §3) : enveloppe un
 * élément EXISTANT sans rien changer à son aspect, et dépose sa mesure dans le
 * registre. `style` ne sert qu'à garder la mise en page de l'enfant (ex.
 * `{ flex: 1 }` dans une rangée) : l'ancre n'a aucun style propre.
 *
 * Sur le site, tant que son guide est éteint : l'ancre rend l'enfant tel quel,
 * sans boîte de plus dans le DOM.
 *
 * TUTOE-CALIBRAGE : l'ancre ne compte que si son écran a le focus (un écran
 * resté monté sous la pile garde ses ancres, décalées par l'animation) ; hors
 * navigation (feuille en portail), elle compte toujours. `clipChildren` fait
 * de l'ancre une zone visible (ex. autour d'un ScrollView) : toutes les ancres
 * qu'elle contient sont coupées à sa mesure (une longue liste dépassait de
 * 239 px sous « Suivant »).
 * `focusFromParent` (boutons de la barre d'onglets, qui reçoivent la
 * navigation de LEUR onglet) : le focus est celui de l'écran qui contient les
 * onglets.
 * @param {{
 *   children: import('react').ReactNode;
 *   clipChildren?: boolean;
 *   focusFromParent?: boolean;
 *   id: string;
 *   style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
 * }} props
 * @returns {import('react').ReactElement}
 */
function TourTarget({
  children, clipChildren = false, focusFromParent = false, id, style,
}) {
  const clipTo = useContext(TourClipContext);
  const inSheet = useContext(TourSheetContext);
  const viewRef = useRef(/** @type {any} */ (null));
  const ownNavigation = /** @type {any} */ (useContext(NavigationContext));
  const navigation = focusFromParent ? ownNavigation?.getParent?.() : ownNavigation;
  useEffect(() => {
    if (!isGuideSupported()) return undefined;
    return registerTourTarget(id, (done) => {
      const node = viewRef.current;
      if (!node?.measureInWindow) {
        done(null);
        return;
      }
      node.measureInWindow((
        /** @type {number} */ x,
        /** @type {number} */ y,
        /** @type {number} */ width,
        /** @type {number} */ height,
      ) => done({
        height, width, x, y,
      }));
    }, {
      clipTo,
      inSheet,
      // GUIDES-SITE : sur le site, le navigateur ramène l'ancre à l'écran, en faisant défiler la
      // page et chaque conteneur qui l'entoure (défilement automatique du guide).
      // GUIDES-SITE-CORR (tournée du 09/11, S10, S11, S19, S26) : « au milieu » amenait le MILIEU
      // des longues listes ; la couche choisit le bord (`start`, `nearest`) et la marge à garder
      // sous l'en-tête et au-dessus de la barre d'onglets.
      reveal: Platform.OS === 'web'
        ? (
          /** @type {{ block?: string; marginBottom?: number; marginTop?: number }} */ options = {},
        ) => {
          const node = viewRef.current;
          if (!node?.scrollIntoView) return;
          if (node.style) {
            node.style.scrollMarginTop = `${Math.round(options.marginTop || 0)}px`;
            node.style.scrollMarginBottom = `${Math.round(options.marginBottom || 0)}px`;
          }
          node.scrollIntoView({ behavior: 'smooth', block: options.block || 'center' });
        }
        : undefined,
      // Le focus se lit à la mesure : un événement « focus » arrivé avant
      // l'abonnement laissait le cadre absent 30 à 45 s (CALIBRAGE-2).
      isActive: () => (navigation?.isFocused ? navigation.isFocused() : true),
    });
  }, [clipTo, id, inSheet, navigation]);

  if (!isGuideSupported()) return /** @type {any} */ (children);

  return (
    <View
      collapsable={false}
      onLayout={notifyTourTargetLayout}
      ref={viewRef}
      style={style}
      // Calibrage (développement) : l'ancre se retrouve dans `uiautomator dump`.
      testID={__DEV__ ? `tour.target.${id}` : undefined}
    >
      {clipChildren
        ? <TourClipContext.Provider value={id}>{children}</TourClipContext.Provider>
        : children}
    </View>
  );
}

export default TourTarget;
