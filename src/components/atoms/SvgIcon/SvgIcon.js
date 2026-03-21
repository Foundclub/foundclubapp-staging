import React from 'react';
import { Image } from 'react-native';

// Import des icônes PNG
const icons = {
  'calendar-days': require('@/assets/icons/calendar-days.png'),
  'clock-two-thirty': require('@/assets/icons/clock-two-thirty.png'),
  'location-pin-alt-1': require('@/assets/icons/location.png'),
  money_bag: require('@/assets/icons/money_bag.png'),
  Player: require('@/assets/icons/Player.png'),
  users: require('@/assets/icons/users.png'),
};

/**
 * Composant SvgIcon pour afficher les icônes PNG
 * @param {string} name - Nom de l'icône (users, clock-two-thirty, calendar-days, Player, money_bag, location-pin-alt-1)
 * @param {number} width - Largeur de l'icône (par défaut: 18)
 * @param {number} height - Hauteur de l'icône (par défaut: 18)
 * @param {string} color - Couleur de l'icône via tintColor (par défaut: #FFFFFF)
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
