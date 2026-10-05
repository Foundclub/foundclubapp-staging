import {
  Modal,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

// Au-dela de cette largeur (site, tablette), la feuille devient une fenetre centree.
const LARGEUR_FENETRE = 768;

/**
 * @typedef {{ disabled?: boolean, isLoading?: boolean, label: string, onPress: () => void,
 *   variant?: 'Primary' | 'Danger' }} BoutonFeuille
 */

/**
 * 🏛️ LA FENÊTRE DE CONFIRMATION DE LA CONSOLE — COLL-CONSOLE (02/10/2026), planche P2-fenetres
 * (design HY521H1, page 2, écran 5).
 *
 * Elle remplace la fenêtre système (Alert.alert à deux boutons en capitales) : une feuille de
 * l'app sur téléphone, une fenêtre centrée de 680 points sur le site. Elle peut EXPLIQUER —
 * club par club, ce qui change — et son bouton dit le résultat (« Offrir l'offre Club à 2
 * clubs »). Règles de la planche :
 *   - DEUX boutons, jamais plus de trois (Android) ; sur téléphone ils sont empilés, libellés
 *     entiers, jamais rétrécis ;
 *   - ce qui retire est en ROUGE (`variant: 'Danger'`) ;
 *   - pendant l'envoi, les deux boutons sont inertes et le bouton porte la roue ;
 *   - l'erreur du serveur s'écrit au-dessus des boutons, et on peut réessayer ;
 *   - une fenêtre nommée : son titre est un en-tête, elle se déclare modale.
 * @param {{ children?: import('react').ReactNode, error?: string | null, onClose: () => void,
 *   primary: BoutonFeuille, secondary: { label: string, onPress?: () => void,
 *   variant?: 'Secondary' | 'Danger' },
 *   subtitle?: string | null, testID?: string, title: string, visible: boolean }} props
 *   - La fenêtre.
 * @returns {import('react').ReactElement | null} La fenêtre, ou rien si elle est fermée.
 */
function ConsoleSheet({
  children = null,
  error = null,
  onClose,
  primary,
  secondary,
  subtitle = null,
  testID = 'console-feuille',
  title,
  visible,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { width } = useWindowDimensions();
  if (!visible) return null;
  const fenetre = width >= LARGEUR_FENETRE;
  const enCours = Boolean(primary.isLoading);
  const fermer = () => {
    if (!enCours) onClose();
  };

  const boutonSecondaire = (
    <Button
      disabled={enCours}
      onPress={secondary.onPress || fermer}
      title={secondary.label}
      variant={secondary.variant || 'Secondary'}
    />
  );
  const boutonPrincipal = (
    <Button
      disabled={enCours || primary.disabled}
      isLoading={enCours}
      onPress={primary.onPress}
      title={primary.label}
      // FINITIONS14 (T13-bis, planche 16, états B, C, D) — le geste principal qui RETIRE est
      // rouge PLEIN (« Retirer l'offre à 2 clubs », « Détacher », « Retirer Karim Benali ») ;
      // il était en contour. Le second bouton garde son contour.
      variant={primary.variant === 'Danger' ? 'DangerFilled' : primary.variant || 'Primary'}
    />
  );

  return (
    <Modal animationType="fade" onRequestClose={fermer} transparent visible>
      <View
        style={[
          Alignments.fill,
          fenetre ? Alignments.justifyCenter : Alignments.justifyEnd,
          fenetre ? Alignments.alignCenter : null,
          fenetre ? Spaces.padding[24] : null,
          { backgroundColor: withAlpha(Colors.neutral900, 0.7) },
        ]}
      >
        <View
          accessibilityLabel={title}
          accessibilityViewIsModal
          style={[
            ApplicationStyle.backgroundColor.primary700,
            ApplicationStyle.borderWidth1,
            Spaces.gap[16],
            {
              borderColor: withAlpha(Colors.primary500, 0.4),
              maxHeight: '90%',
              padding: 24,
              width: fenetre ? 680 : '100%',
            },
            fenetre
              ? ApplicationStyle.borderRadius16
              : { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
          ]}
          testID={testID}
        >
          {fenetre ? null : (
            <View
              style={[
                Alignments.selfCenter,
                {
                  backgroundColor: Colors.neutral500, borderRadius: 2, height: 4, width: 40,
                },
              ]}
            />
          )}
          <View style={{ gap: 6 }}>
            <Text accessibilityRole="header" style={[Fonts.h4Bold, Fonts.neutral00]}>{title}</Text>
            {subtitle ? <Text style={[Fonts.p2, Fonts.neutral200]}>{subtitle}</Text> : null}
          </View>
          {children ? (
            <ScrollView contentContainerStyle={{ gap: 12 }}>{children}</ScrollView>
          ) : null}
          {error ? (
            <Text accessibilityRole="alert" style={[Fonts.p3Bold, Fonts.error300]}>{error}</Text>
          ) : null}
          {fenetre ? (
            <View style={[Alignments.row, Alignments.justifyEnd, { gap: 12 }]}>
              {boutonSecondaire}
              {boutonPrincipal}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {boutonPrincipal}
              {boutonSecondaire}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default ConsoleSheet;
