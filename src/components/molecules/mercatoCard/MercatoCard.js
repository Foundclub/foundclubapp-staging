import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

// Carte annonce du handoff « Cartes Rechercher » (tour 5b), adaptée aux
// données réelles du flux mercato : des PROFILS de joueurs ouverts au
// recrutement (pas des annonces de clubs). Le cadre poste, les chips verre
// et le conteneur dégradé viennent du design ; l'événement lié, l'adresse et
// « Postuler » n'existent pas dans ce payload — masqués, CTA = voir le profil.

/**
 * MercatoCard component
 * @param {object} props
 * @param {{
 *   avatar?: { url?: string } | null,
 *   category?: string | null,
 *   club?: { name?: string } | null,
 *   firstname?: string,
 *   lastname?: string,
 *   position?: string | null,
 *   preferredSport?: string | null,
 *   section?: { name?: string } | null,
 * } & Record<string, any>} props.user
 * @param {Function} [props.onPress]
 * @returns {React.ReactElement}
 */
function MercatoCard({ onPress, user }) {
  const { Colors } = useTheme();

  // Data for badges
  const position = user.position || 'Joueur';
  const category = user.category || user.section?.name;
  const preferredSport = user.preferredSport || null;
  const currentClubName = user.club?.name || '';
  const headerSubtitle = currentClubName || 'Ouvert au recrutement';

  const criteriaChips = [category, preferredSport].filter(Boolean);
  const glassChipStyle = {
    backgroundColor: withAlpha(Colors.neutral00, 0.08),
    borderColor: withAlpha(Colors.neutral00, 0.16),
  };

  const handlePress = () => onPress && onPress(user);

  return (
    <TouchableOpacity
      accessibilityLabel={[
        `${user.firstname || ''} ${user.lastname || ''}`.trim(),
        position,
        headerSubtitle,
      ].filter(Boolean).join(', ')}
      accessibilityRole="button"
      activeOpacity={0.85}
      onPress={handlePress}
    >
      <LinearGradient
        colors={[withAlpha(Colors.primary700, 0.9), withAlpha(Colors.primary900, 0.96)]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.container, { borderColor: withAlpha(Colors.primary500, 0.3) }]}
      >
        {/* Cadre poste — la signature de la carte 5b */}
        <View style={[styles.positionFrame, { borderColor: Colors.primary500 }]}>
          <Text
            numberOfLines={1}
            style={[styles.positionText, { color: Colors.primary500 }]}
          >
            {position}
          </Text>
        </View>

        {/* Rangée profil : photo réelle, repli = les INITIALES du joueur (L14) */}
        <View style={styles.profileRow}>
          {/* Pas de `imageStyle` avec un fond ici : il s'applique AUSSI au
              medaillon d'initiales et ecraserait sa couleur commune. */}
          <ProfileAvatar
            enablePreview={false}
            imageUrl={user.avatar?.url}
            name={`${user.firstname || ''} ${user.lastname || ''}`.trim()}
            size={styles.avatar.width}
          />
          <View style={styles.profileTextContainer}>
            {/* MARQUEE — le nom du joueur se lit en entier. */}
            <MarqueeText
              style={[styles.userName, { color: Colors.neutral00 }]}
              text={[user.firstname, user.lastname].filter(Boolean).join(' ')}
            />
            <View
              style={[styles.clubBadge, { backgroundColor: withAlpha(Colors.primary500, 0.12) }]}
            >
              <Text
                numberOfLines={1}
                style={[styles.clubBadgeText, { color: Colors.primary500 }]}
              >
                {headerSubtitle}
              </Text>
            </View>
          </View>
        </View>

        {/* Chips critères (catégorie, sport) */}
        {criteriaChips.length > 0 ? (
          <View style={styles.chipsRow}>
            {criteriaChips.map((label) => (
              <View key={label} style={[styles.criteriaChip, glassChipStyle]}>
                <Text style={[styles.criteriaChipText, { color: Colors.neutral100 }]}>
                  {label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* CTA — le flux mercato ouvre le profil du joueur */}
        <View style={[styles.ctaButton, { backgroundColor: Colors.primary500 }]}>
          <Text style={[styles.ctaText, { color: Colors.primary900 }]}>
            Voir le profil
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  clubBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  clubBadgeText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  container: {
    borderRadius: 20,
    borderWidth: 1,
    gap: 11,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  criteriaChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  criteriaChipText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 11,
    fontWeight: '700',
  },
  // ponytail: hauteur 44 (au lieu des 40 du mock) — cible tactile minimale
  // 44pt, décision Adel du 2026-07-20 (arbitrage n°2). Voie de sortie : NON.
  ctaButton: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
  },
  ctaText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 13,
    fontWeight: '800',
  },
  positionFrame: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  positionText: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  profileRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  profileTextContainer: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  userName: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default MercatoCard;
