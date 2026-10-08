import { useWindowDimensions } from 'react-native';

import { MessagesDuSite } from '@/views/Conversation.web';
// Le fichier du telephone, nomme en entier : sans l extension, le site reviendrait ici.
// eslint-disable-next-line import/extensions
import MessagingDuTelephone from '@/views/Messaging.js';

import { BREAKPOINTS } from '@/responsive';

/**
 * 🧭 SMF (T20, 08/10) — `/messages` SUR LE SITE : UNE SEULE LISTE.
 *
 * Sur ordinateur, `/messages` montrait la page du telephone (Messaging.js) en pleine largeur :
 * une 2e liste, differente de la colonne « Messages » de `/messages/:id` (« Épingler » et
 * « Archiver » rouges toujours visibles, un 2e logo, un bouton flottant sur une ligne). Elle
 * montre desormais la MEME colonne, et la place du fil a droite (`MessagesDuSite`). Sur un ecran
 * etroit, ou aucune colonne n accompagne le fil, et dans l espace de la Ville (sa propre liste),
 * la page du telephone reste.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - La navigation.
 * @returns {import('react').ReactElement} La page.
 */
function Messaging(props) {
  const { width } = useWindowDimensions();
  const { navigation, route } = props;
  if (width >= BREAKPOINTS.desktop && route?.params?.espace !== 'ville') {
    return <MessagesDuSite navigation={navigation} />;
  }
  // eslint-disable-next-line react/jsx-props-no-spreading -- la page recoit tout, telle quelle
  return <MessagingDuTelephone {...props} />;
}

export default Messaging;
