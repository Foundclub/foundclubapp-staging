import { Platform } from 'react-native';

import { isDesktopWidth } from './breakpoints';

/**
 * GUIDES-SITE-CORR-2 (M1096) — le site ouvert sur un ordinateur (même seuil que `useIsDesktop`),
 * hors d'un composant : un service, ou le texte d'une étape du guide.
 * @returns {boolean} Vrai sur le site, à la largeur d'un ordinateur.
 */
export const isDesktopWeb = () => Platform.OS === 'web'
  && typeof window !== 'undefined'
  && isDesktopWidth(Number(window.innerWidth) || 0);

export default isDesktopWeb;
