import { useTranslation } from 'react-i18next';
import { Image, Pressable, Text } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * ACCUEIL-JOUEUR (09/11/2026, point 4, mots d'Adel relayés par le chef) — « OUVRIR DANS LE GPS »,
 * VISIBLE. Toucher l'adresse d'un événement ouvrait déjà le GPS, mais rien ne montrait que c'était
 * un bouton. Cette ligne d'action, bleue avec son icône, se pose sous l'adresse et appelle la MÊME
 * ouverture que l'adresse (`openExternalMap` : Plans, Google Maps ou Waze au choix ; sur le site,
 * la carte dans un nouvel onglet). Le texte existe déjà (`common.openInGps`).
 * @param {object} props - Les propriétés.
 * @param {() => void} props.onPress - L'ouverture du lieu, celle de l'adresse.
 * @param {string} [props.testID] - Repère des témoins.
 * @returns {import('react').ReactElement} - La ligne d'action.
 */
function OuvrirDansLeGps({ onPress, testID }) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Images,
  } = useTheme();
  const libelle = t('common.openInGps', 'Ouvrir dans le GPS');
  return (
    <Pressable
      accessibilityLabel={libelle}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={[Alignments.row, Alignments.alignCenter, { alignSelf: 'flex-start', gap: 8 }]}
      testID={testID}
    >
      <Image source={Images.send} style={{ height: 14, tintColor: Colors.primary400, width: 14 }} />
      <Text style={[Fonts.p3Bold, { color: Colors.primary400 }]}>{libelle}</Text>
    </Pressable>
  );
}

export default OuvrirDansLeGps;
