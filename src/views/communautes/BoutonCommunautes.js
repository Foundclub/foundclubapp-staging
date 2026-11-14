import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity } from 'react-native';

import { afficherEntreeCommunautes } from '@/domains/messaging/communautes';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

import { RouteNames } from '@/navigation/routeNames';

import { getMesCommunautes } from '@/services/chat/communauteService';

/**
 * COMMUNAUTES-L2 (13/11/2026, D76) — l'entrée « Communautés » de la messagerie : un bouton rond
 * dans l'en-tête,
 * à côté de « Nouvelle conversation », jamais au-dessus des conversations (décision du 19/10).
 * Il n'apparaît que si le serveur rend au moins une communauté : un serveur d'avant le socle (404),
 * une erreur ou
 * une liste vide laissent la messagerie telle qu'aujourd'hui.
 * @param {object} props
 * @param {any} props.navigation
 * @param {number} [props.taille] - 44 au téléphone ; 36 dans l'en-tête de la liste du site («
 * Nouvelle discussion »).
 * @returns {import('react').ReactElement | null} Le bouton, ou rien.
 */
function BoutonCommunautes({ navigation, taille = 44 }) {
  const { Colors } = useTheme();
  const { t } = useTranslation();
  const [communautes, setCommunautes] = useState(/** @type {any[] | null} */ (null));

  useEffect(() => {
    let vivant = true;
    const charger = () => getMesCommunautes()
      .then((liste) => {
        if (vivant) setCommunautes(liste);
      })
      .catch(() => {
        if (vivant) setCommunautes(null);
      });
    charger();
    const desabonner = navigation?.addListener?.('focus', charger);
    return () => {
      vivant = false;
      if (typeof desabonner === 'function') desabonner();
    };
  }, [navigation]);

  if (!afficherEntreeCommunautes(communautes)) return null;
  return (
    <TouchableOpacity
      accessibilityLabel={t('communautes.titre', 'Communautés')}
      accessibilityRole="button"
      activeOpacity={0.85}
      onPress={() => navigation.navigate(RouteNames.Communautes)}
      style={{
        alignItems: 'center',
        backgroundColor: withAlpha(Colors.primary500, 0.18),
        borderRadius: taille / 2,
        height: taille,
        justifyContent: 'center',
        width: taille,
      }}
      testID="messaging-communautes"
    >
      <GlyphIcon color={Colors.neutral00} name="users" size={20} />
    </TouchableOpacity>
  );
}

export default BoutonCommunautes;
