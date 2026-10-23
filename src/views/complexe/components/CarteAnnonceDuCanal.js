import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';

/**
 * 🏟️ RESA-PARTAGER (23/10/2026, A-G32, plan E-G12) — L'ANNONCE PARTAGÉE, EN CARTE DANS LE CANAL
 * DU COMPLEXE, chez le gérant comme chez le joueur (téléphone et site) : « PARTIE À COMPLÉTER », le
 * complexe, le jour et l'heure, le terrain, « n places », et « Voir l'annonce » (E-P09, zone de
 * 44 au moins, nommée pour le lecteur d'écran). La carte vient de `carteDAnnonce`
 * (domains/complexe/annonceDuCanal.js).
 * @param {{ carte: import('@/domains/complexe/annonceDuCanal').CarteDAnnonce,
 *   onOuvrir: () => void }} props - La carte et l'ouverture de l'annonce.
 * @returns {import('react').ReactElement} La carte.
 */
function CarteAnnonceDuCanal({ carte, onOuvrir }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const quand = [carte.jour, carte.heure].filter(Boolean).join(' · ');
  return (
    <View
      style={{
        alignItems: 'center', marginVertical: 6, paddingHorizontal: 12, width: '100%',
      }}
      testID="carte-annonce-du-canal"
    >
      <View
        style={{
          backgroundColor: withAlpha(Colors.primary800, 0.6),
          borderColor: withAlpha(Colors.primary500, 0.24),
          borderRadius: 16,
          borderWidth: 1,
          gap: 4,
          maxWidth: 320,
          padding: 14,
          width: '100%',
        }}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 6 }}>
          <GlyphIcon color={Colors.primary200} name="users" size={14} />
          <Text style={[Fonts.p3Bold, Fonts.primary200, { letterSpacing: 0.5 }]}>
            {t('complexeCanal.annonce.titre', 'Partie à compléter').toUpperCase()}
          </Text>
        </View>
        {carte.complexe ? (
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{carte.complexe}</Text>
        ) : null}
        {quand ? <Text style={[Fonts.p2, Fonts.neutral00]}>{quand}</Text> : null}
        {carte.terrain ? <Text style={[Fonts.p3, Fonts.neutral200]}>{carte.terrain}</Text> : null}
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>{carte.places}</Text>
        <TouchableOpacity
          accessibilityLabel={carte.libelle}
          accessibilityRole="button"
          onPress={onOuvrir}
          style={{
            alignItems: 'center',
            backgroundColor: Colors.primary500,
            borderRadius: 12,
            justifyContent: 'center',
            marginTop: 8,
            minHeight: 44,
            paddingHorizontal: 16,
          }}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {t('complexeCanal.annonce.voir', 'Voir l’annonce')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default CarteAnnonceDuCanal;
