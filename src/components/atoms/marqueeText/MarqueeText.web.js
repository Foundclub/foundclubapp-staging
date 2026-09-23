import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getActiveMarqueeCount } from '@/hooks/useMarqueeLoop';

// ANNUAIRE (2026-09-23) — SUR LE SITE, LE NOM D UN CLUB SORTAIT EN DOUBLE.
//
// La version telephone (`MarqueeText.js`) rend le texte TROIS a QUATRE fois :
// une sonde de mesure hors flux, la ligne tronquee qui tient la place, puis —
// pendant le defilement — deux copies cote a cote. Sur un telephone ca ne se
// voit pas : `accessibilityElementsHidden` et `importantForAccessibility`
// retirent le bloc du lecteur d ecran, et l oeil ne voit qu une piste qui file.
//
// Sur le web, ces deux proprietes n existent pas : react-native-web ne les
// transmet pas (elles ne sont pas dans `forwardedProps`). Les copies restent
// donc dans le DOM, et le texte de la page devient de la bouillie —
// « Resultat annuaire FoundClubSTA », « 0DResultat annuaire FoundClub0 »
// releve en ligne le 23/09. Pour un visiteur c est laid ; pour Google c est un
// texte FAUX sur des pages dont le referencement est tout l interet.
//
// CE FICHIER NE FAIT QU UNE CHOSE : sur le web, le nom est rendu UNE SEULE
// FOIS. Le defilement disparait — il n a pas de sens la ou il y a une souris —
// et ce qu il servait a faire (lire un nom trop long sans ouvrir la fiche) est
// rendu par l infobulle du navigateur, posee seulement quand ca depasse
// vraiment.
//
// TROIS POINTS QUI NE SONT PAS DES DETAILS :
//  · le texte COMPLET reste dans le DOM. La coupure par « … » est purement
//    visuelle (`text-overflow`), donc Google lit le nom entier, une fois.
//  · le bloc n est PAS masque au lecteur d ecran, contrairement au telephone.
//    La raison de ce masquage etait la duplication ; elle a disparu. La ou la
//    carte porte deja un `accessibilityLabel` (c est le cas de
//    `ClubSearchResultCard`), ce libelle fait foi et le texte interne n est pas
//    relu ; la ou elle n en porte pas, le nom devient enfin lisible.
//  · la propriete `paused` des ~50 appelants n est plus dans la signature : elle
//    ne servait qu a suspendre une animation qui n existe plus ici. Elle reste
//    acceptee sans effet — aucun appelant a modifier.

// Marge sous-pixel : un nom qui tient PILE ne merite pas une infobulle.
const OVERFLOW_EPSILON = 1;

export { getActiveMarqueeCount };

/**
 * Texte d une ligne, coupe par « … » quand il depasse — version web.
 * @param {object} props - Les proprietes du composant.
 * @param {any} [props.containerStyle] - Porte la PLACE (flex, marges, largeur).
 * @param {any} [props.style] - Porte la POLICE.
 * @param {string} props.text - Texte a afficher.
 * @returns {import('react').ReactElement}
 */
function MarqueeText({
  containerStyle = null,
  style = null,
  text,
}) {
  // react-native-web rend un vrai noeud du DOM derriere ce <Text> : c est lui
  // qui sait mesurer sa largeur. Les types de react-native, eux, decrivent un
  // composant Text — les deux ne se rencontrent pas. D ou ce `any` assume, et
  // le garde `typeof node.scrollWidth !== 'number'` plus bas, qui est le vrai
  // controle : sur une plateforme sans DOM, on ne fait simplement rien.
  /** @type {import('react').MutableRefObject<any>} */
  const lineRef = useRef(null);

  // `title` n est pas dans la liste des proprietes que react-native-web
  // transmet au DOM : on la pose donc a la main. Et seulement si le nom
  // depasse — une infobulle sur un texte entierement visible est du bruit.
  useEffect(() => {
    const node = lineRef.current;
    if (!node || typeof node.scrollWidth !== 'number') {
      return undefined;
    }

    const syncTooltip = () => {
      if (node.scrollWidth > node.clientWidth + OVERFLOW_EPSILON) {
        node.setAttribute('title', text);
      } else {
        node.removeAttribute('title');
      }
    };

    syncTooltip();

    // La place disponible change quand la fenetre bouge : sans cette veille,
    // l infobulle resterait celle de la largeur du premier rendu.
    if (typeof window === 'undefined' || typeof window.ResizeObserver !== 'function') {
      return undefined;
    }
    const observer = new window.ResizeObserver(syncTooltip);
    observer.observe(node);
    return () => observer.disconnect();
  }, [text]);

  return (
    <View style={[styles.viewport, containerStyle]}>
      <Text
        ellipsizeMode="tail"
        numberOfLines={1}
        ref={lineRef}
        style={style}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    // Meme geometrie que la version telephone : `containerStyle` porte la
    // place (flex, marges), `style` porte la police. Sans `flexShrink`, un nom
    // long pousserait la pastille de certification hors de la carte.
    flexShrink: 1,
    overflow: 'hidden',
  },
});

export default MarqueeText;
