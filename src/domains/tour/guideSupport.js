import { Platform } from 'react-native';

import { GUIDE_SUR_LE_SITE } from '@/config/fonctionsMasquees';

/**
 * Vrai là où le guide à missions peut se jouer : le téléphone, et le site si son interrupteur est
 * allumé (T3-GUIDE-SITE).
 * @returns {boolean} Vrai si le guide est disponible sur cette plateforme.
 */
const isGuideSupported = () => Platform.OS !== 'web' || GUIDE_SUR_LE_SITE;

export default isGuideSupported;
