import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import TourTarget from '@/components/molecules/tour/TourTarget';
import ScreenContainer from '@/components/templates/ScreenContainer';

import {
  getClubCertificationLabel,
  getClubCertificationPalette,
  isVerifiedClub,
} from '@/utils/clubCertification';
import { getImageUrl } from '@/utils/imageUrl';
import { formatRecruitmentAdExpiryDate } from '@/utils/recruitmentAdRenewal';

import CARD_MATCH from '@/assets/background-card-event/card-match.png';

const ScreenContainerView = /** @type {any} */ (ScreenContainer);
const TagView = /** @type {any} */ (Tag);
const NEUTRAL_LABEL = '—';
// Une annonce vit 30 jours (`recruitmentAdRenewal`).
const AD_LIFE_DAYS = 30;
const noop = () => {};

/**
 * Guide Dirigeant·e, fin de B4 (décision « 80- B », captures `12-recruter/14` et `15`) : l'annonce
 * qu'on vient de remplir, comme en ligne, sans candidature. Elle remplace le récap de
 * `AdWizardRecap` le temps de l'étape, qui se lit sans toucher. Aucun service n'est importé ici, et
 * ses 3 boutons ne font rien.
 *
 * ponytail: pas la vraie fiche (`RecruitmentAdDetails`, 2 160 lignes qui lisent et écrivent) ; ce
 * rendu en reprend les mesures. Sortie : extraire son en-tête.
 * ponytail: un retour pris à l'étape quitte l'écran et le guide propose de passer. Sortie : bloquer
 * le retour si la recette le demande.
 * @param {{
 *   address?: string, categoryName?: string, club?: any, description?: string, levelName?: string,
 *   now?: Date, positionLabel?: string, sectionName?: string, teamName?: string,
 * }} props - Ce que le tunnel a saisi.
 * @returns {import('react').ReactElement} Écran.
 */
function TourAnnonceExemple({
  address = '',
  categoryName = '',
  club = null,
  description = '',
  levelName = '',
  now = new Date(),
  positionLabel = '',
  sectionName = '',
  teamName = '',
}) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const scrollRef = useRef(/** @type {any} */ (null));
  const palette = getClubCertificationPalette(club, Colors);
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + AD_LIFE_DAYS);
  const infos = [
    [
      t('recruitmentAdDetails.info.publishedOn', 'Publiée le'),
      formatRecruitmentAdExpiryDate(now, now),
    ],
    [t('recruitmentAdDetails.info.level', 'Niveau'), levelName || NEUTRAL_LABEL],
    [t('recruitmentAdDetails.info.category', 'Catégorie'), categoryName || NEUTRAL_LABEL],
  ];

  return (
    <ScreenContainerView
      bgImage="bg2"
      contentContainerStyle={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={Spaces.paddingBottom[16]}
        // La bulle parle des candidatures : elles sont à l'écran dès l'arrivée (capture 15).
        onContentSizeChange={() => scrollRef.current?.scrollToEnd?.({ animated: false })}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
      >
        <ImageBackground
          resizeMode="cover"
          source={/** @type {import('react-native').ImageSourcePropType} */ (CARD_MATCH)}
          style={[styles.hero, { borderColor: Colors.primary500 }]}
        >
          <LinearGradient
            colors={['transparent', withAlpha(Colors.neutral900, 0.9)]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.heroContent}>
            <ClubLogoMark
              club={club}
              logoUrl={getImageUrl(club?.logo?.url)}
              name={club?.name || ''}
              size={100}
            />
            <Text style={[Fonts.h1, styles.position, { color: Colors.neutral00 }]}>
              {positionLabel || t('tourExamples.ad.position', 'Ailier gauche')}
            </Text>
            <Text style={[Fonts.caption, styles.centered, { color: Colors.neutral300 }]}>
              {t('recruitmentAdDetails.renewal.expiresOn', 'Expire le {{date}}', {
                date: formatRecruitmentAdExpiryDate(expiresAt, now), ...SANS_ECHAPPEMENT,
              })}
            </Text>
            <Text style={[Fonts.h3, styles.centered, { color: Colors.primary500 }]}>
              {club?.name || teamName}
            </Text>
            <TagView
              style={{
                backgroundColor: palette.backgroundColor,
                borderColor: palette.borderColor,
                marginTop: 8,
              }}
              text={getClubCertificationLabel(club)}
              textColor={isVerifiedClub(club) ? 'success500' : 'neutral100'}
              textStyle={{ fontWeight: '700' }}
            />
            {teamName ? (
              <Text style={[Fonts.p1, styles.centered, { color: Colors.neutral300 }]}>
                {sectionName ? `${teamName} - ${sectionName}` : teamName}
              </Text>
            ) : null}
            <View style={[styles.badges]}>
              <View style={[styles.badge, {
                backgroundColor: withAlpha(Colors.primary500, 0.2),
                borderColor: Colors.primary500,
              }]}
              >
                <Text style={[Fonts.captionBold, { color: Colors.primary500 }]}>
                  {t('tourExamples.ad.online', 'EN LIGNE')}
                </Text>
              </View>
              <View style={[styles.badge, { borderColor: Colors.neutral300 }]}>
                <Text style={[Fonts.captionBold, { color: Colors.neutral100 }]}>
                  {t('tourExamples.ad.example', 'Exemple')}
                </Text>
              </View>
            </View>
          </View>
        </ImageBackground>

        <View style={[styles.infoBar, {
          backgroundColor: Colors.neutral900,
          borderColor: Colors.primary500,
        }]}
        >
          {infos.map(([label, value]) => (
            <View key={label} style={styles.infoItem}>
              <Text style={[Fonts.caption, { color: Colors.neutral300, marginBottom: 4 }]}>
                {label}
              </Text>
              {/* Recette L11 : sur 2 lignes, « Départemental » se coupait en plein mot. */}
              <Text
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                numberOfLines={1}
                style={[Fonts.p2Bold, styles.centered, { color: Colors.neutral100 }]}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>

        <View style={[Spaces.paddingHorizontal[16], Spaces.paddingTop[24], Spaces.gap[16]]}>
          {address ? (
            <View style={[styles.addressTag, {
              backgroundColor: withAlpha(Colors.neutral00, 0.1),
            }]}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>{address}</Text>
            </View>
          ) : null}

          <TourTarget id="ad-cand">
            <View style={Spaces.gap[16]}>
              <Text style={[Fonts.h3, { color: Colors.neutral100 }]}>
                {t('tourExamples.ad.candidates', 'Candidatures (0)')}
              </Text>
              <View style={[styles.emptyBox, {
                backgroundColor: withAlpha(Colors.neutral00, 0.05),
              }]}
              >
                <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>
                  {t('recruitmentAdDetails.candidates.empty', 'Aucune candidature pour le moment.')}
                </Text>
              </View>
            </View>
          </TourTarget>

          <Text style={[Fonts.h3, { color: Colors.neutral100 }]}>
            {t('recruitmentAdDetails.description.title', 'Description')}
          </Text>
          <Text style={[Fonts.p1, { color: Colors.neutral300 }]}>
            {description || t(
              'recruitmentAdDetails.description.empty',
              'Aucune description fournie pour cette annonce.',
            )}
          </Text>
        </View>
      </ScrollView>

      <View style={[Spaces.padding[16], Spaces.gap[12]]}>
        <Button
          onPress={noop}
          title={t('recruitmentAdDetails.actions.edit', 'Modifier')}
          variant="Primary"
        />
        <TourTarget id="ad-poster">
          <Button
            onPress={noop}
            title={t('recruitmentAdDetails.owner.posterCta', 'Créer l’affiche à partager')}
            variant="Secondary"
          />
        </TourTarget>
        <Button
          onPress={noop}
          style={{ backgroundColor: 'transparent', borderColor: Colors.error500, borderWidth: 2 }}
          textStyle={{ color: Colors.error500 }}
          title={t('recruitmentAdDetails.actions.delete', 'Supprimer')}
          variant="Secondary"
        />
      </View>
    </ScreenContainerView>
  );
}

const styles = StyleSheet.create({
  addressTag: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badge: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  centered: {
    marginTop: 4,
    textAlign: 'center',
  },
  emptyBox: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
  },
  hero: {
    borderRadius: 32,
    borderWidth: 1.5,
    height: 380,
    justifyContent: 'flex-end',
    marginTop: 4,
    overflow: 'hidden',
    width: '100%',
  },
  heroContent: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  infoBar: {
    borderRadius: 24,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginHorizontal: 16,
    marginTop: -30,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-start',
  },
  position: {
    letterSpacing: 1,
    marginTop: 12,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});

export default TourAnnonceExemple;
