import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';

import {
  notifyTourTargetLayout,
  registerTourTarget,
} from '@/domains/tour/tourTargetRegistry';

/**
 * Ancre invisible du guide (pack tutoriels, 01_ARCHITECTURE §3) : enveloppe un
 * élément EXISTANT sans rien changer à son aspect, et dépose sa mesure dans le
 * registre. `style` ne sert qu'à garder la mise en page de l'enfant (ex.
 * `{ flex: 1 }` dans une rangée) : l'ancre n'a aucun style propre.
 *
 * Sur le site, le guide ne démarre jamais (`startTour` refuse) : l'ancre rend
 * l'enfant tel quel, sans boîte de plus dans le DOM.
 * @param {{
 *   children: import('react').ReactNode;
 *   id: string;
 *   style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
 * }} props
 * @returns {import('react').ReactElement}
 */
function TourTarget({ children, id, style }) {
  const viewRef = useRef(/** @type {any} */ (null));

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
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
    });
  }, [id]);

  if (Platform.OS === 'web') return /** @type {any} */ (children);

  return (
    <View
      collapsable={false}
      onLayout={notifyTourTargetLayout}
      ref={viewRef}
      style={style}
    >
      {children}
    </View>
  );
}

export default TourTarget;
