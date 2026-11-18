import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import {
  decrireLInscriptionAuTournoi,
  lireLInscriptionAuTournoi,
} from '@/domains/tournoi/inscriptionEnCours';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

/**
 * T-PAGES-6b (18/11/2026, points 5 et 6 de T-PAGES-6) — LE RAPPEL DU TOURNOI dans le tunnel de
 * création du compte (écran du numéro, écran du rôle). Il ne s'affiche QUE si le visiteur vient
 * d'un tournoi (domains/tournoi/inscriptionEnCours.js) ; sinon il ne rend rien et le tunnel reste
 * celui de tout le monde.
 * « Tournoi FoundClub x AR Soccer · Sam. 19 déc. », ou « Tu rejoins <équipe> · <tournoi> ».
 * Les noms ne passent pas par l'interpolation d'i18next : ils sont collés au texte traduit.
 * @param {{ phrase?: string | null }} props - Une phrase sous le rappel (l'écran du rôle).
 * @returns {import('react').ReactElement | null} Le bandeau, ou rien.
 */
function BandeauTournoiEnCours({ phrase = null }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const [bandeau] = useState(() => decrireLInscriptionAuTournoi(lireLInscriptionAuTournoi()));
  if (!bandeau) return null;

  const ligne = bandeau.equipe
    ? `${t('inscriptionTournoi.tuRejoins', 'Tu rejoins')} ${bandeau.equipe} · ${bandeau.tournoi}`
    : [bandeau.tournoi, bandeau.jour].filter(Boolean).join(' · ');

  return (
    <View
      accessibilityRole="summary"
      style={[
        Spaces.paddingHorizontal[16],
        Spaces.paddingVertical[12],
        Spaces.gap[4],
        styles.cadre,
        {
          backgroundColor: withAlpha(Colors.primary500, 0.08),
          borderColor: Colors.primary500,
        },
      ]}
      testID="bandeau-tournoi-en-cours"
    >
      <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{ligne}</Text>
      {phrase ? <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>{phrase}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    borderRadius: 12,
    borderWidth: 1,
  },
});

export default BandeauTournoiEnCours;
