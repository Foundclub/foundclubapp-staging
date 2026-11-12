import { Image, Text, View } from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import TourTarget from '@/components/molecules/tour/TourTarget';

const TAILLE_PASTILLE = 40;
const TAILLE_ICONE = 20;

/**
 * RETOUCHES-DESIGN D4 (28/10) — la feuille qui suit une réussite (« Ajout réussi ! »,
 * « Bravo, ton événement est en ligne »). Calquée sur la proposition d'alerte
 * (`PropositionAlerte`, AlerteEvenements.js) : pastille, titre blanc, texte gris clair,
 * l'action puis « Plus tard ». Les couleurs sont posées ici : `Fonts.*` est NOIR par
 * défaut, et la feuille est sombre (`primary700`) — le texte de D4 y tombait à 1,69:1.
 *
 * Hauteur sur son contenu (`scrollable={false}`, sans `snapPoints`) : la zone ne
 * réserve que la barre de gestes, la marge est la même en haut et en bas (24).
 * Témoins : trainerInvitedModal/__tests__/TrainerInvitedModal.FEUILLES.test.js (D4-1, D4-2).
 * @param {object} props
 * @param {{ onPress: () => void, title: string }} props.actionPrincipale - Le bouton plein.
 * @param {{ onPress: () => void, title: string }} props.actionSecondaire - « Plus tard ».
 * @param {React.ReactNode} [props.children] - Ce qui s'intercale avant les boutons.
 * @param {() => void} props.close - Fermeture (fond touché, glissé vers le bas).
 * @param {boolean} props.isVisible - Feuille ouverte.
 * @param {() => void} [props.onDismissed] - Appelé quand la feuille a quitté l'écran.
 * @param {React.ReactNode} [props.pastille] - INVITE-STAFF-DESIGN (11/11) : remplace la coche
 *   verte (l'envoi d'une invitation, l'écusson du club qui invite). Sans elle, la coche.
 * @param {string} props.texte - La phrase sous le titre.
 * @param {string} props.titre - Le titre.
 * @param {string} [props.tourTargetId] - Ancre du guide sur le bouton plein.
 * @returns {import('react').ReactElement} La feuille.
 */
function FeuilleDeSucces({
  actionPrincipale,
  actionSecondaire,
  children,
  close,
  isVisible,
  onDismissed,
  pastille = undefined,
  texte,
  titre,
  tourTargetId = undefined,
}) {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const boutonPrincipal = (
    <Button
      onPress={actionPrincipale.onPress}
      title={actionPrincipale.title}
      variant="Primary"
    />
  );

  return (
    <BottomModal
      close={close}
      hideCloseButton
      isVisible={isVisible}
      onDismissed={onDismissed}
      scrollable={false}
    >
      {/* 12 sous le bord + 12 de la zone = 24 en haut ; 24 en bas, au-dessus de la barre de gestes. */}
      <View style={[Spaces.gap[16], Spaces.paddingTop[12], Spaces.paddingBottom[24]]}>
        {pastille || (
        <View
          style={[
            Alignments.alignCenter,
            Alignments.justifyCenter,
            {
              backgroundColor: withAlpha(Colors.success500, 0.15),
              borderRadius: TAILLE_PASTILLE / 2,
              height: TAILLE_PASTILLE,
              width: TAILLE_PASTILLE,
            },
          ]}
        >
          <Image
            accessibilityIgnoresInvertColors
            resizeMode="contain"
            source={Images.check}
            style={{ height: TAILLE_ICONE, tintColor: Colors.success500, width: TAILLE_ICONE }}
          />
        </View>
        )}
        <View accessibilityLiveRegion="polite" style={[Spaces.gap[8]]}>
          <Text accessibilityRole="header" style={[Fonts.h3Bold, Fonts.neutral00]}>
            {titre}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral200]}>
            {texte}
          </Text>
        </View>
        {children}
        <View style={[Spaces.gap[8]]}>
          {tourTargetId
            ? <TourTarget id={tourTargetId}>{boutonPrincipal}</TourTarget>
            : boutonPrincipal}
          <Button
            onPress={actionSecondaire.onPress}
            title={actionSecondaire.title}
            variant="Ghost"
          />
        </View>
      </View>
    </BottomModal>
  );
}

export default FeuilleDeSucces;
