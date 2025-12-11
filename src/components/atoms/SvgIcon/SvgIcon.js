import React from 'react';
import { Image } from 'react-native';

// Import des icônes PNG
const icons = {
  users: require('@/assets/icons/users.png'),
  'clock-two-thirty': require('@/assets/icons/clock-two-thirty.png'),
  'calendar-days': require('@/assets/icons/calendar-days.png'),
  Player: require('@/assets/icons/Player.png'),
  money_bag: require('@/assets/icons/money_bag.png'),
  'location-pin-alt-1': require('@/assets/icons/location.png'),
};

/**
 * Composant SvgIcon pour afficher les icônes PNG
 * @param {string} name - Nom de l'icône (users, clock-two-thirty, calendar-days, Player, money_bag, location-pin-alt-1)
 * @param {number} width - Largeur de l'icône (par défaut: 18)
 * @param {number} height - Hauteur de l'icône (par défaut: 18)
 * @param {string} color - Couleur de l'icône via tintColor (par défaut: #FFFFFF)
 */
export const SvgIcon = ({ name, width = 18, height = 18, color = '#FFFFFF', style }) => {
  const iconSource = icons[name];

  if (!iconSource) {
    console.warn(`SvgIcon: Icône "${name}" non trouvée`);
    return null;
  }

  return (
    <Image
      source={iconSource}
      style={[
        {
          width,
          height,
          tintColor: color,
        },
        style,
      ]}
    />
  );
};

export default SvgIcon;
