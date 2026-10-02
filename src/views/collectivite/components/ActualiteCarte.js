import { useTranslation } from 'react-i18next';
import {
  Image,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  attachmentBadge,
  categoryLabel,
  categoryTone,
  publicationDateLabel,
  recipientsLine,
} from '@/domains/collectivite/collectiviteActualites';
import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { resolveMediaUrl } from '@/utils/mediaUrl';

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
 * Une pièce jointe : son étiquette (PDF, IMG…), son nom ; l'appui l'ouvre.
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
        })}
        accessibilityRole="link"
        disabled={!url}
        onPress={ouvrir}
        style={[Alignments.row, Alignments.alignCenter, { flex: 1, gap: 10, minHeight: 44 }]}
      >
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
  const pieces = Array.isArray(actualite?.attachments) ? actualite.attachments : [];
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
      {compact ? null : pieces.map((/** @type {any} */ fichier) => (
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
