import { useWindowDimensions } from 'react-native';

import { MessagesDuSite } from '@/views/Conversation.web';
// Le fichier du telephone, nomme en entier : sans l extension, le site reviendrait ici.
// eslint-disable-next-line import/extensions
import MessagingDuTelephone from '@/views/Messaging.js';

import { useTour } from '@/context/useTour';
import { BREAKPOINTS } from '@/responsive';

/**
 * L'étape du guide en cours vise-t-elle la liste des messages (`msg-canal`, `msg-new`) ?
 * @param {any} tour - État du guide.
 * @returns {boolean} Vrai pendant les bonus 2 et 3 du guide Dirigeant·e, sur la liste.
 */
const estUneEtapeDeLaListe = (tour) => tour?.tourStatus === 'active'
  && (tour?.currentStep?.targets || []).some((/** @type {string} */ id) => id.startsWith('msg-'));

/**
 * 🧭 SMF (T20, 08/10) — `/messages` SUR LE SITE : UNE SEULE LISTE.
 *
 * Sur ordinateur, `/messages` montrait la page du telephone (Messaging.js) en pleine largeur :
 * une 2e liste, differente de la colonne « Messages » de `/messages/:id` (« Épingler » et
 * « Archiver » rouges toujours visibles, un 2e logo, un bouton flottant sur une ligne). Elle
 * montre desormais la MEME colonne, et la place du fil a droite (`MessagesDuSite`). Sur un ecran
 * etroit, ou aucune colonne n accompagne le fil, et dans l espace de la Ville (sa propre liste),
 * la page du telephone reste.
 *
 * GUIDES-SITE-CORR S18, S17 (tournée du site, 09/11) : la colonne de l'ordinateur ne porte aucune
 * ancre du guide ; au bonus 3, la bulle recouvrait « Nouvelle discussion », et au bonus 2 le canal
 * n'était jamais montré. Le temps d'une étape du guide sur la liste, la page du téléphone revient :
 * ancres, canal « Exemple » et membres « Exemple » compris.
 * ponytail: la colonne de l'ordinateur reste sans ancre. Sortie : y poser `msg-new` et `msg-canal`
 * (et le canal d'exemple) si la recette veut garder la colonne pendant le guide.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - La navigation.
 * @returns {import('react').ReactElement} La page.
 */
function Messaging(props) {
  const { width } = useWindowDimensions();
  const tour = useTour();
  const { navigation, route } = props;
  if (width >= BREAKPOINTS.desktop && route?.params?.espace !== 'ville'
    && !estUneEtapeDeLaListe(tour)) {
    return <MessagesDuSite navigation={navigation} route={route} />;
  }
  // eslint-disable-next-line react/jsx-props-no-spreading -- la page recoit tout, telle quelle
  return <MessagingDuTelephone {...props} />;
}

export default Messaging;
