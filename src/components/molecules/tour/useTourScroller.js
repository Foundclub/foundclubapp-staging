import * as ReactNavigation from '@react-navigation/native';
import {
  createContext, useCallback, useContext, useEffect, useRef,
} from 'react';

import isGuideSupported from '@/domains/tour/guideSupport';
import { registerTourScroller } from '@/domains/tour/tourTargetRegistry';

// Même repli que `TourTarget` : certaines doublures jest n'exposent pas `NavigationContext`.
const NavigationContext = /** @type {any} */ (ReactNavigation).NavigationContext
  || createContext(undefined);

/**
 * Le nœud qui défile vraiment : une FlatList / SectionList passe par sa ScrollView.
 * @param {any} node - Réf de la liste ou de la ScrollView.
 * @returns {any} ScrollView.
 */
const scrollNodeOf = (node) => node?.getNativeScrollRef?.() || node?.getScrollResponder?.() || node;

/**
 * GUIDE-D-CORR-2 (décision d'Adel, 08/11) : le défilement du guide est automatique. Un écran du
 * guide qui défile branche sa ScrollView (ou FlatList) ici : `ref` et `onScroll` sur la liste,
 * `scrollEventThrottle={16}`. Quand la cible d'une étape est hors de l'écran ou coupée, la couche
 * du guide fait défiler cette zone jusqu'à elle (`TourGuideLayer`), puis pose la bulle.
 * La zone ne compte que si son écran a le focus (comme `TourTarget`).
 * @param {import('react').MutableRefObject<any>} [givenRef] - Réf déjà portée par la liste.
 * @returns {{ onScroll: (event: any) => void; ref: import('react').MutableRefObject<any> }}
 */
function useTourScroller(givenRef) {
  const ownRef = useRef(/** @type {any} */ (null));
  const ref = givenRef || ownRef;
  const offsetRef = useRef(0);
  const navigation = /** @type {any} */ (useContext(NavigationContext));

  useEffect(() => {
    if (!isGuideSupported()) return undefined;
    return registerTourScroller({
      isActive: () => (navigation?.isFocused ? navigation.isFocused() : true),
      measure: (done) => {
        const node = scrollNodeOf(ref.current);
        if (!node?.measureInWindow) {
          done(null);
          return;
        }
        node.measureInWindow((
          /** @type {number} */ x,
          /** @type {number} */ y,
          /** @type {number} */ width,
          /** @type {number} */ height,
        ) => done(width > 0 && height > 0 ? {
          height, width, x, y,
        } : null));
      },
      scrollBy: (dy) => {
        const node = scrollNodeOf(ref.current);
        const y = Math.max(0, offsetRef.current + dy);
        if (node?.scrollTo) node.scrollTo({ animated: true, y });
        else ref.current?.scrollToOffset?.({ animated: true, offset: y });
        offsetRef.current = y;
      },
    });
  }, [navigation, ref]);

  const onScroll = useCallback((/** @type {any} */ event) => {
    offsetRef.current = event?.nativeEvent?.contentOffset?.y || 0;
  }, []);

  return { onScroll, ref };
}

export default useTourScroller;
