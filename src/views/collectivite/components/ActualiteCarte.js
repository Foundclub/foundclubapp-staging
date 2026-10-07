import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  attachmentBadge,
  categoryLabel,
  categoryTone,
  isImageAttachment,
  photoUrl,
  photosEtDocuments,
  publicationDateLabel,
  recipientsLine,
} from '@/domains/collectivite/collectiviteActualites';
import { withAlpha } from '@/theme/colors';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { resolveMediaUrl } from '@/utils/mediaUrl';

// 📷 VILLE-T18D (07/10) — la vignette d'une carte occupe toute sa largeur (environ 300 points,
// soit 900 pixels à l'écran) ; une petite photo (ligne du formulaire, bandeau) 40 points, soit
// 120 pixels. La hauteur reprend le gabarit `.photo` de la planche P3b-actu (coins de 12).
const LARGEUR_VIGNETTE = 900;
const LARGEUR_PETITE = 120;
const HAUTEUR_VIGNETTE = 180;

/**
 * Une petite photo carrée (ligne d'une pièce jointe, bandeau de l'accueil) : la photo elle-même,
 * jamais l'étiquette « IMG ». Décorative : le libellé est porté par le lien qui la contient.
 * @param {{ fichier: any, taille: number, testID: string }} props
 * @returns {import('react').ReactElement | null} La photo, ou rien sans adresse.
 */
export function PetitePhoto({ fichier, taille, testID }) {
  const { Colors } = useTheme();
  const uri = resolveMediaUrl(photoUrl(fichier, LARGEUR_PETITE));
  if (!uri) return null;
  return (
    <Image
      accessibilityIgnoresInvertColors
      importantForAccessibility="no"
      resizeMode="cover"
      source={{ uri }}
      style={{
        backgroundColor: withAlpha(Colors.primary500, 0.18),
        borderRadius: 8,
        height: taille,
        width: taille,
      }}
      testID={testID}
    />
  );
}

/**
 * La photo en plein écran : fond sombre, la photo ENTIÈRE (l'original), une croix pour fermer.
 * Monté seulement à l'ouverture (les marges de l'encoche ne se lisent qu'ici).
 * @param {{ fichier: any, onFermer: () => void }} props
 * @returns {import('react').ReactElement} La fenêtre.
 */
function PhotoPleinEcran({ fichier, onFermer }) {
  const { t } = useTranslation();
  const { ApplicationStyle, Colors, Images } = useTheme();
  const { top } = useSafeAreaInsets();
  const uri = resolveMediaUrl(fichier?.url) || resolveMediaUrl(photoUrl(fichier, LARGEUR_VIGNETTE));
  return (
    <Modal
      animationType="fade"
      onRequestClose={onFermer}
      supportedOrientations={['portrait', 'landscape']}
      transparent={false}
      visible
    >
      <View style={{ backgroundColor: Colors.neutral900, flex: 1 }}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={{ uri }}
          style={{ flex: 1, width: '100%' }}
          testID="actualite-photo-plein-ecran"
        />
        <TouchableOpacity
          accessibilityLabel={t('collectiviteActualites.photo.fermer', 'Fermer la photo')}
          accessibilityRole="button"
          onPress={onFermer}
          style={{
            alignItems: 'center',
            backgroundColor: withAlpha(Colors.neutral900, 0.6),
            borderRadius: 22,
            height: 44,
            justifyContent: 'center',
            left: 12,
            position: 'absolute',
            top: top + 8,
            width: 44,
          }}
          testID="actualite-photo-fermer"
        >
          <Image
            source={Images.close}
            style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral00]}
          />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/**
 * 📷 VILLE-T18D — une photo jointe, EN PHOTO : la vignette de la carte ; le toucher l'agrandit.
 * @param {{ fichier: any }} props
 * @returns {import('react').ReactElement | null} La vignette, ou rien sans adresse.
 */
export function PhotoActualite({ fichier }) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
  const [ouverte, setOuverte] = useState(false);
  const uri = resolveMediaUrl(photoUrl(fichier, LARGEUR_VIGNETTE));
  if (!uri) return null;
  return (
    <>
      <TouchableOpacity
        accessibilityLabel={t('collectiviteActualites.photo.agrandir', 'Agrandir la photo')}
        accessibilityRole="imagebutton"
        activeOpacity={0.85}
        onPress={() => setOuverte(true)}
        testID="actualite-photo"
      >
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="cover"
          source={{ uri }}
          style={{
            backgroundColor: withAlpha(Colors.neutral00, 0.06),
            borderRadius: 12,
            height: HAUTEUR_VIGNETTE,
            width: '100%',
          }}
        />
      </TouchableOpacity>
      {ouverte ? <PhotoPleinEcran fichier={fichier} onFermer={() => setOuverte(false)} /> : null}
    </>
  );
}

/**
 * La pastille d'un type d'actualité (planche : « Subventions » cyan, « Fermeture » orange).
 * @param {{ categorie: unknown }} props
 * @returns {import('react').ReactElement} La pastille.
 */
export function PastilleActualite({ categorie }) {
  const { t } = useTranslation();
  const { ApplicationStyle, Colors, Fonts } = useTheme();
  const ton = categoryTone(categorie);
  const couleurs = {
    neutral: { fond: Colors.neutral00, texte: Colors.neutral100 },
    primary: { fond: Colors.primary500, texte: Colors.primary200 },
    success: { fond: Colors.success500, texte: Colors.success200 },
    warning: { fond: Colors.warning500, texte: Colors.warning400 },
  }[ton];
  return (
    <View
      style={[
        ApplicationStyle.borderRadius12,
        {
          alignSelf: 'flex-start',
          backgroundColor: withAlpha(couleurs.fond, 0.14),
          borderColor: withAlpha(couleurs.fond, 0.5),
          borderWidth: 1,
          paddingHorizontal: 8,
          paddingVertical: 2,
        },
      ]}
      testID={`actualite-pastille-${String(categorie)}`}
    >
      <Text style={[Fonts.p3Bold, { color: couleurs.texte }]}>{categoryLabel(t, categorie)}</Text>
    </View>
  );
}

/**
 * Une pièce jointe : son étiquette (PDF, DOC…) ou, pour une photo, la photo elle-même ; son nom ;
 * l'appui l'ouvre. La carte n'en montre plus que les documents (VILLE-T18D) ; le formulaire, toutes.
 * @param {{ fichier: any, onRetirer?: () => void, sousTitre?: string }} props
 * @returns {import('react').ReactElement} La ligne.
 */
export function PieceJointeActualite({ fichier, onRetirer, sousTitre }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const url = resolveMediaUrl(fichier?.url);
  const ouvrir = () => {
    if (url) Linking.openURL(url).catch(() => {});
  };
  return (
    <View
      style={[
        ApplicationStyle.borderRadius12,
        Alignments.row,
        Alignments.alignCenter,
        Spaces.padding[8],
        { backgroundColor: withAlpha(Colors.neutral00, 0.06), gap: 10 },
      ]}
      testID="actualite-piece-jointe"
    >
      <TouchableOpacity
        accessibilityLabel={t('collectiviteActualites.pieceJointe.ouvrir', 'Ouvrir {{nom}}', {
          nom: fichier?.name || '',
          ...SANS_ECHAPPEMENT,
        })}
        accessibilityRole="link"
        disabled={!url}
        onPress={ouvrir}
        style={[Alignments.row, Alignments.alignCenter, { flex: 1, gap: 10, minHeight: 44 }]}
      >
        {/* VILLE-T18D : une photo se montre elle-même, un document garde son étiquette. */}
        {isImageAttachment(fichier) && url ? (
          <PetitePhoto fichier={fichier} taille={36} testID="actualite-piece-jointe-vignette" />
        ) : (
          <View
            style={[
              ApplicationStyle.borderRadius8,
              Alignments.alignCenter,
              Alignments.justifyCenter,
              { backgroundColor: withAlpha(Colors.primary500, 0.18), height: 36, width: 36 },
            ]}
          >
            <Text style={[Fonts.p4Bold, Fonts.primary200]}>{attachmentBadge(fichier)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[Fonts.p3Bold, Fonts.neutral00]}>{fichier?.name}</Text>
          {sousTitre ? <Text style={[Fonts.p4, Fonts.neutral300]}>{sousTitre}</Text> : null}
        </View>
      </TouchableOpacity>
      {onRetirer ? (
        <TouchableOpacity
          accessibilityLabel={t(
            'collectiviteActualites.pieceJointe.retirer',
            'Retirer la pièce jointe',
          )}
          accessibilityRole="button"
          hitSlop={{
            bottom: 8, left: 8, right: 8, top: 8,
          }}
          onPress={onRetirer}
          style={[Alignments.alignCenter, Alignments.justifyCenter, { height: 44, width: 44 }]}
          testID="actualite-piece-jointe-retirer"
        >
          <Image
            source={Images.close}
            style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.neutral200]}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * 📰 UNE ACTUALITÉ DE LA VILLE, telle que la mairie la relit (planche P3b-actu-tel, écran 3) :
 * le type et la date, le titre, le texte, les pièces jointes, à qui elle est partie (en NOMBRES),
 * et deux gestes, « Modifier » et « Retirer ». Sans les gestes, c'est la carte que lisent les
 * membres (P3b-actu-ordi, aperçu ; P3b-actu-tel écran 5).
 * @param {{
 *   actualite: any, compact?: boolean, onModifier?: () => void, onRetirer?: () => void,
 *   retraitEnCours?: boolean, signature?: string, testID?: string, voirDestinataires?: boolean,
 * }} props
 * @returns {import('react').ReactElement} La carte.
 */
function ActualiteCarte({
  actualite,
  compact = false,
  onModifier,
  onRetirer,
  retraitEnCours = false,
  signature,
  testID = 'actualite-carte',
  voirDestinataires = false,
}) {
  const { t } = useTranslation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  // VILLE-T18D : une photo s'affiche en photo ; un document garde sa ligne « Ouvrir ».
  const { documents, photos } = photosEtDocuments(actualite?.attachments);
  return (
    <View
      style={[
        Spaces.padding[16],
        {
          backgroundColor: withAlpha(Colors.neutral00, 0.04),
          borderColor: withAlpha(Colors.neutral00, 0.09),
          borderRadius: 16,
          borderWidth: 1,
          gap: 8,
        },
      ]}
      testID={testID}
    >
      {signature ? (
        <Text style={[Fonts.p2Bold, Fonts.primary200]}>{signature}</Text>
      ) : null}
      <View
        style={[Alignments.row, Alignments.alignCenter, Alignments.scrollSpaceBetween, { gap: 8 }]}
      >
        <PastilleActualite categorie={actualite?.category} />
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {publicationDateLabel(t, actualite?.publishedAt)}
        </Text>
      </View>
      <Text style={[compact ? Fonts.p2Bold : Fonts.p1Bold, Fonts.neutral00]}>
        {actualite?.title}
      </Text>
      {actualite?.body ? (
        <Text
          numberOfLines={compact ? 2 : undefined}
          style={[compact ? Fonts.p3 : Fonts.p2, Fonts.neutral200]}
        >
          {actualite.body}
        </Text>
      ) : null}
      {compact ? null : photos.map((/** @type {any} */ fichier) => (
        <PhotoActualite fichier={fichier} key={String(fichier?.id || fichier?.url)} />
      ))}
      {compact ? null : documents.map((/** @type {any} */ fichier) => (
        <PieceJointeActualite fichier={fichier} key={String(fichier?.id || fichier?.url)} />
      ))}
      {actualite?.editedAt ? (
        <Text style={[Fonts.p4, Fonts.neutral300]}>
          {t('collectiviteActualites.modifiee', 'Modifiée')}
        </Text>
      ) : null}
      {voirDestinataires ? (
        <Text style={[Fonts.p3, Fonts.neutral300]} testID={`${testID}-destinataires`}>
          {recipientsLine(t, {
            audience: actualite?.audience,
            clubsCount: actualite?.recipients?.clubsCount,
          })}
        </Text>
      ) : null}
      {onModifier || onRetirer ? (
        <View style={[Alignments.row, { gap: 8 }]}>
          {onModifier ? (
            <View style={{ flex: 1 }}>
              <Button
                isOption
                onPress={onModifier}
                size="sm"
                testID={`${testID}-modifier`}
                title={t('collectiviteActualites.modifier', 'Modifier')}
                variant="SecondaryLight"
              />
            </View>
          ) : null}
          {onRetirer ? (
            <View style={{ flex: 1 }}>
              <Button
                disabled={retraitEnCours}
                isLoading={retraitEnCours}
                isOption
                onPress={onRetirer}
                size="sm"
                testID={`${testID}-retirer`}
                title={t('collectiviteActualites.retirer', 'Retirer')}
                variant="Danger"
              />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default ActualiteCarte;
