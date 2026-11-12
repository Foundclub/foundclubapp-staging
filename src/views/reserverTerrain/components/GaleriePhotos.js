import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Modal, ScrollView, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

const RATIO = 16 / 10;
const MARGE = 32;

/**
 * La page lue d'un défilement horizontal (0, 1, 2…).
 * @param {any} evenement - L'événement de défilement.
 * @param {number} largeur - La largeur d'une page.
 * @param {number} total - Le nombre de pages.
 * @returns {number} L'indice.
 */
const pageLue = (evenement, largeur, total) => {
  const x = Number(evenement?.nativeEvent?.contentOffset?.x) || 0;
  if (!largeur) return 0;
  return Math.max(0, Math.min(total - 1, Math.round(x / largeur)));
};

/**
 * RESA-JOUEUR (11/11/2026, maquette « 232- ok », E-P03 et D48 « il manque les photos de
 * l'installation ») — les photos d'un terrain en tête de l'écran : elles défilent du doigt, le
 * compteur dit « 1 / 5 », un appui les ouvre en grand ; en grand, on fait défiler et la croix
 * ferme. Sans photo : rien (l'écran commence à ses infos).
 * @param {object} props - Les propriétés.
 * @param {string[]} props.photos - Les adresses des photos.
 * @param {string} [props.legende] - La légende en grand (« Terrain 1 · Le Five de Montrivage »).
 * @param {string} props.testID - La racine des repères (`<racine>-galerie`, `-galerie-agrandir`,
 *   `-photos-plein-ecran`, `-photos-fermer`).
 * @returns {import('react').ReactElement | null} La galerie.
 */
function GaleriePhotos({ legende = '', photos, testID }) {
  const { t } = useTranslation();
  const { Colors, Fonts } = useTheme();
  const fenetre = useWindowDimensions();
  const [largeurLue, setLargeurLue] = useState(0);
  const [indice, setIndice] = useState(0);
  const [enGrand, setEnGrand] = useState(false);
  const liste = (Array.isArray(photos) ? photos : []).filter(Boolean).map(String);
  if (!liste.length) return null;
  const largeur = largeurLue || Math.max(0, fenetre.width - MARGE);
  const compteur = t('reserverTerrain.creneau.compteurPhotos', '{{indice}} / {{total}}', {
    indice: indice + 1,
    total: liste.length,
  });

  return (
    <View
      onLayout={(evenement) => setLargeurLue(Number(evenement?.nativeEvent?.layout?.width) || 0)}
      style={{ borderRadius: 16, overflow: 'hidden' }}
      testID={`${testID}-galerie`}
    >
      <ScrollView
        horizontal
        onMomentumScrollEnd={(evenement) => setIndice(pageLue(evenement, largeur, liste.length))}
        pagingEnabled
        showsHorizontalScrollIndicator={false}
      >
        {liste.map((photo, rang) => (
          <TouchableOpacity
            accessibilityLabel={t('reserverTerrain.creneau.agrandirPhotos', 'Agrandir les photos')}
            accessibilityRole="imagebutton"
            activeOpacity={0.9}
            key={photo}
            onPress={() => {
              setIndice(rang);
              setEnGrand(true);
            }}
            testID={rang === 0 ? `${testID}-galerie-agrandir` : `${testID}-galerie-photo-${rang}`}
          >
            <Image
              accessibilityIgnoresInvertColors
              resizeMode="cover"
              source={{ uri: photo }}
              style={{ height: largeur / RATIO, width: largeur }}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
      {liste.length > 1 ? (
        <View
          pointerEvents="none"
          style={{
            backgroundColor: withAlpha(Colors.primary900, 0.7),
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
            position: 'absolute',
            right: 10,
            top: 10,
          }}
        >
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>{compteur}</Text>
        </View>
      ) : null}
      <Modal
        animationType="fade"
        onRequestClose={() => setEnGrand(false)}
        supportedOrientations={['portrait', 'landscape']}
        visible={enGrand}
      >
        <View
          style={{ backgroundColor: Colors.primary900, flex: 1, justifyContent: 'center' }}
          testID={`${testID}-photos-plein-ecran`}
        >
          <ScrollView
            contentOffset={{ x: indice * fenetre.width, y: 0 }}
            horizontal
            onMomentumScrollEnd={(evenement) => (
              setIndice(pageLue(evenement, fenetre.width, liste.length))
            )}
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {liste.map((photo) => (
              <Image
                accessibilityIgnoresInvertColors
                key={photo}
                resizeMode="contain"
                source={{ uri: photo }}
                style={{ height: fenetre.height * 0.7, width: fenetre.width }}
              />
            ))}
          </ScrollView>
          <View style={{ alignItems: 'center', gap: 4, paddingTop: 16 }}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{compteur}</Text>
            {legende ? <Text style={[Fonts.p3, Fonts.neutral200]}>{legende}</Text> : null}
          </View>
          <TouchableOpacity
            accessibilityLabel={t('reserverTerrain.creneau.fermerPhotos', 'Fermer les photos')}
            accessibilityRole="button"
            hitSlop={{
              bottom: 12, left: 12, right: 12, top: 12,
            }}
            onPress={() => setEnGrand(false)}
            style={{
              alignItems: 'center',
              backgroundColor: withAlpha(Colors.neutral00, 0.12),
              borderRadius: 22,
              height: 44,
              justifyContent: 'center',
              position: 'absolute',
              right: 16,
              top: 48,
              width: 44,
            }}
            testID={`${testID}-photos-fermer`}
          >
            <SvgIcon color={Colors.neutral00} height={20} name="close" width={20} />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

export default GaleriePhotos;
