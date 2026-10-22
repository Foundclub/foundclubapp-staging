/* eslint-disable global-require -- une table d images, un require par PNG (cf. theme/images.js) */
import { Image } from 'react-native';

// Import des icônes PNG
// SANS-EMOJI (01/10/2026) : la table s'élargit aux PNG déjà dessinés qui remplacent les emoji
// des textes (coche, croix, cloche, loupe…). Aucun dessin neuf : tous viennent de src/assets/icons.
// ICÔNES (01/10/2026, « icône go » d'Adel) : 8 icônes de plus pour les endroits restés en
// provisoire (effacer, répondre, trophée, radar, bulle, ballon, épées, blason mystère). Même
// gabarit que les autres : PNG 96 x 96, encre blanche, grille 24, trait 2, marge 2.
const icons = {
  'arrow-left': require('@/assets/icons/arrowLeft.png'),
  // COLL-CONSOLE (02/10) — la console des collectivites : le chevron d une ligne, l etat vide,
  // et « Plus d actions » (icone 10 dessinee et validee par Adel le 01/10, app da8181e5).
  'arrow-right': require('@/assets/icons/arrowRight.png'),
  bell: require('@/assets/icons/bell.png'),
  // COLL-C4A3 (03/10) : une actualité de la Ville (notification). Repris tel quel de l'ancien
  // système d'Adel (« Bank »), au gabarit du jeu validé le 01/10.
  'building-columns': require('@/assets/icons/building-columns.png'),
  calendar: require('@/assets/icons/calendar.png'),
  'calendar-days': require('@/assets/icons/calendar-days.png'),
  check: require('@/assets/icons/check.png'),
  'chevron-down': require('@/assets/icons/chevron-down.png'),
  'clock-two-thirty': require('@/assets/icons/clock-two-thirty.png'),
  close: require('@/assets/icons/close.png'),
  'delete-left': require('@/assets/icons/delete-left.png'),
  // COLL-C2B (02/10) : « Plus d actions » (icone 10 dessinee et validee le 01/10, da8181e5).
  'dots-horizontal': require('@/assets/icons/dots-horizontal.png'),
  edit: require('@/assets/icons/edit.png'),
  envelope: require('@/assets/icons/envelope.png'),
  'euro-circle': require('@/assets/icons/euro-circle.png'),
  flag: require('@/assets/icons/flag.png'),
  // RESA-L6B-2 (20/10/2026) — le favori d'un complexe : le cœur dessiné sur la toile validée
  // (AT-15 A, planches EP02 / EP11), contour (« Ajouter aux favoris ») et plein (« Dans tes
  // favoris ») ; même gabarit (viewBox 24, trait 2 arrondi, PNG 96 x 96, encre blanche).
  heart: require('@/assets/icons/heart.png'),
  'heart-filled': require('@/assets/icons/heart-filled.png'),
  'location-pin-alt-1': require('@/assets/icons/location.png'),
  'message-circle': require('@/assets/icons/message-circle.png'),
  money_bag: require('@/assets/icons/money_bag.png'),
  Player: require('@/assets/icons/Player.png'),
  radar: require('@/assets/icons/radar.png'),
  reply: require('@/assets/icons/reply.png'),
  search: require('@/assets/icons/search.png'),
  shield: require('@/assets/icons/shield.png'),
  'shield-question': require('@/assets/icons/shield-question.png'),
  'soccer-ball': require('@/assets/icons/soccer-ball.png'),
  stadium: require('@/assets/icons/stadium.png'),
  swords: require('@/assets/icons/swords.png'),
  trash: require('@/assets/icons/trash.png'),
  trophy: require('@/assets/icons/trophy.png'),
  users: require('@/assets/icons/users.png'),
};

/**
 * Composant SvgIcon pour afficher les icônes PNG
 * @param {object} props - Les props de l'icône.
 * @param {string} props.name - Nom de l'icône : une clé de la table `icons` ci-dessus
 * @param {number} [props.width] - Largeur de l'icône (par défaut: 18)
 * @param {number} [props.height] - Hauteur de l'icône (par défaut: 18)
 * @param {string} [props.color] - Couleur de l'icône via tintColor (par défaut: #FFFFFF)
 * @param {import('react-native').StyleProp<import('react-native').ImageStyle>} [props.style]
 *   - Style ajouté à l'image (marge, alignement).
 * @returns {import('react').ReactElement | null} L'image teintée, ou rien pour un nom inconnu.
 */
export function SvgIcon({
  color = '#FFFFFF', height = 18, name, style, width = 18,
}) {
  const iconSource = icons[name];

  if (!iconSource) {
    console.warn(`SvgIcon: Icône "${name}" non trouvée`);
    return null;
  }

  return (
    <Image
      resizeMode="contain"
      source={iconSource}
      style={[
        {
          height,
          tintColor: color,
          width,
        },
        style,
      ]}
    />
  );
}

export default SvgIcon;
