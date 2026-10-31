import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, View,
} from 'react-native';

import {
  lieuLabel, placesLabel, quandLabel, repetitionLabel,
} from '@/domains/collectivite/evenementDeLaVille';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import { resolveMediaUrl } from '@/utils/mediaUrl';
import { buildPublicWebUrl } from '@/utils/shareLinks';

import SharePlatform from '@/platform/share';

/**
 * Le texte partagé : le nom, le quand (et le rythme d'une série), le lieu, les places.
 * @param {any} t - i18next.
 * @param {any} evenement - La vue publiée (`POST /collectivites/:id/evenements`).
 * @returns {string[]} Les lignes.
 */
export const lignesDeLaVitrine = (t, evenement) => {
  const serie = evenement?.serie;
  const dates = Array.isArray(serie?.dates) ? serie.dates.length : 0;
  return [
    quandLabel(t, evenement),
    repetitionLabel(t, serie?.regle),
    dates > 1
      ? t('collectiviteEvenement.vitrine.dates', '{{nombre}} dates', { nombre: dates })
      : '',
    lieuLabel(t, {
      address: evenement?.address,
      facilityName: evenement?.facility?.name || null,
      takesPlace: evenement?.takesPlace,
    }),
    placesLabel(t, evenement?.capacity),
  ].filter(Boolean);
};

/**
 * 🎉 VILLEEVT-CODE (4B, décision d'Adel du 25/10) — LA VITRINE APRÈS LA PUBLICATION, comme celle
 * de l'entraîneur : l'événement mis en avant (son affiche, ou son nom sur un aplat), et
 * « Partager » (le partage du téléphone ; sur le site, celui du navigateur, ou le texte copié).
 * ponytail: l'entraîneur partage une IMAGE fabriquée par le moteur de visuels du serveur
 * (`EventPublishedShowcase`) ; ce moteur ne connaît pas l'événement de la Ville (ni son sujet,
 * ni ses droits). Ici : l'affiche de la Ville et un texte. Sortie : un sujet `ville-event` dans
 * `visual-asset` (gabarit + règle de droits), puis cet écran passe à `EventPublishedShowcase`.
 * @param {{ evenement: any, onVoirLaFiche: () => void }} props - L'événement publié.
 * @returns {import('react').ReactElement} La vitrine.
 */
function VitrineEvenementVille({ evenement, onVoirLaFiche }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();
  const [partage, setPartage] = useState({ enCours: false, etat: '' });
  const lignes = lignesDeLaVitrine(t, evenement);
  const lien = evenement?.documentId
    // Les autres réglages (origine du site) se lisent dans la configuration.
    ? buildPublicWebUrl(/** @type {any} */ ({ path: `/evenements-de-la-ville/${evenement.documentId}` }))
    : null;

  const partager = async () => {
    setPartage({ enCours: true, etat: '' });
    try {
      await SharePlatform.share({
        message: [evenement?.name, ...lignes].filter(Boolean).join('\n'),
        title: evenement?.name || '',
        ...(lien ? { url: lien } : {}),
      });
      setPartage({ enCours: false, etat: 'partage' });
    } catch {
      setPartage({ enCours: false, etat: 'echec' });
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{
        alignSelf: 'center', gap: 16, maxWidth: 460, padding: 20, width: '100%',
      }}
      testID="evenement-vitrine"
    >
      <View style={[Alignments.row, Alignments.alignCenter, { gap: 8 }]}>
        <SvgIcon color={Colors.success500} height={20} name="check" width={20} />
        <Text accessibilityRole="header" style={[Fonts.h3Bold, Fonts.neutral00, { flex: 1 }]}>
          {t('collectiviteEvenement.vitrine.publie', 'C’est publié')}
        </Text>
      </View>
      <Text style={[Fonts.p2, Fonts.neutral200]}>
        {/* CORR-COLLECTIVITES 98 (31/10, Adel A) : « habitants » seulement au niveau 3 (public). */}
        {evenement?.visibility === 'public'
          ? t(
            'collectiviteEvenement.vitrine.sousTitre',
            'Faites-le savoir : partagez-le aux clubs et aux habitants.',
          )
          : t('collectiviteEvenement.vitrine.sousTitreClubs', 'Faites-le savoir : partagez-le aux clubs.')}
      </Text>
      <View
        style={{
          backgroundColor: withAlpha(Colors.primary500, 0.12),
          borderColor: withAlpha(Colors.primary500, 0.4),
          borderRadius: 20,
          borderWidth: 1,
          gap: 8,
          overflow: 'hidden',
          paddingBottom: 16,
        }}
        testID="evenement-vitrine-carte"
      >
        {evenement?.poster?.url ? (
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="cover"
            source={{
              uri: resolveMediaUrl(evenement.poster.formats?.medium?.url || evenement.poster.url),
            }}
            style={{ aspectRatio: 4 / 3, width: '100%' }}
            testID="evenement-vitrine-affiche"
          />
        ) : (
          <View style={{ backgroundColor: Colors.primary500, height: 8, width: '100%' }} />
        )}
        <View style={{ gap: 6, paddingHorizontal: 16, paddingTop: 8 }}>
          <Text style={[Fonts.p4Bold, Fonts.primary200, { textTransform: 'uppercase' }]}>
            {evenement?.collectivite?.name
              || t('collectiviteEvenement.fiche.etiquette', 'Événement de la Ville')}
          </Text>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{evenement?.name}</Text>
          {lignes.map((ligne) => (
            <Text key={ligne} style={[Fonts.p2, Fonts.neutral100]}>{ligne}</Text>
          ))}
        </View>
      </View>
      <Button
        disabled={partage.enCours}
        isLoading={partage.enCours}
        onPress={partager}
        title={t('collectiviteEvenement.vitrine.partager', 'Partager')}
        variant="Primary"
      />
      {partage.etat ? (
        <Text
          accessibilityRole="alert"
          style={[Fonts.p3, { color: partage.etat === 'echec' ? Colors.error300 : Colors.neutral200 }]}
          testID="evenement-vitrine-etat"
        >
          {partage.etat === 'echec'
            ? t('collectiviteEvenement.vitrine.partageEchec', 'Le partage n’a pas pu s’ouvrir.')
            : t('collectiviteEvenement.vitrine.partage', 'C’est prêt à être collé où vous voulez.')}
        </Text>
      ) : null}
      <Button
        onPress={onVoirLaFiche}
        title={t('collectiviteEvenement.vitrine.voirFiche', 'Voir la fiche')}
        variant="Secondary"
      />
    </ScrollView>
  );
}

export default VitrineEvenementVille;
