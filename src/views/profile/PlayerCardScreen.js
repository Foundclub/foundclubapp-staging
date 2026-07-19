// @ts-nocheck
/**
 * PlayerCardScreen — ecran de la carte joueur collectible (design final).
 *
 * Assemble : modele pur (buildPlayerCardModel) + QR (buildCardQrTarget) + carte
 * (PlayerCard nouvelle API, montee visible ET hors-ecran pour la capture) +
 * ShareCardModal + garde-fou mineurs (getCardConsentState).
 *
 * Deux modes :
 *  - normal (depuis Profil) : titre + carte + actions.
 *  - reveal (params.celebration=true, fin d'onboarding) : eyebrow "Bienvenue",
 *    carte inclinee, bouton "Plus tard, continuer" -> home.
 *
 * Export image : capture hors-ecran a 992×1262 (taille native de la maquette).
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import { getCardConsentState } from '@/domains/playerCard/cardConsent';
import { buildCardShareMessage } from '@/domains/playerCard/cardMessages';
import { buildPlayerCardModel } from '@/domains/playerCard/cardModel';
import useShareCard from '@/domains/playerCard/useShareCard';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ParentalDeclarationCard from '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard';
import PlayerCard, { CARD_EXPORT_WIDTH } from '@/components/organisms/playerCard/PlayerCard';
import ShareCardModal from '@/components/organisms/shareCardModal/ShareCardModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { buildCardQrTarget } from '@/services/playerCard/cardQrTarget';
import { uploadCardImage } from '@/services/playerCard/uploadCardImage';
import { useGetMyHistories } from '@/services/userHistory/userHistoryQueries';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * Rarete 5 niveaux du design final a partir du score deterministe (0..100).
 * Prolonge les paliers historiques de computeRarity (>=85 legendary) en
 * scindant le haut du spectre : >=95 MOST_RARE, >=85 ULTRA_RARE.
 * @param {number} score
 * @returns {'MOST_RARE'|'ULTRA_RARE'|'EPIC'|'RARE'|'COMMON'}
 */
const mapScoreToCardRarity = (score) => {
  if (score >= 95) return 'MOST_RARE';
  if (score >= 85) return 'ULTRA_RARE';
  if (score >= 65) return 'EPIC';
  if (score >= 40) return 'RARE';
  return 'COMMON';
};

/**
 * Periode "2023–AUJ." / "2019–2023" pour l'historique de la carte.
 * @param entry
 * @param nowLabel
 */
const formatHistoryPeriod = (entry, nowLabel) => {
  const end = entry.isCurrentlyActive ? nowLabel : (entry.endYear || '');
  return [entry.startYear, end].filter(Boolean).join('–');
};

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function PlayerCardScreen({ navigation, route }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const {
    getPostOnboardingHomeRoute, userData,
  } = useAuth();
  const { sendMessage } = useMessaging();
  const { data: histories = [] } = useGetMyHistories();

  const {
    captureToFile, cardRef, isBusy, saveCardToGallery, shareCard,
  } = useShareCard();

  const [isShareVisible, setIsShareVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const isCelebration = Boolean(route?.params?.celebration);
  // Audience explicite via params, sinon deduite du role (coach = entraineur).
  const audience = route?.params?.audience
    || (userData?.role?.type === 'entraineur' ? 'coach' : 'player');

  const consent = useMemo(() => getCardConsentState(userData || {}), [userData]);

  const qrTarget = useMemo(() => buildCardQrTarget({ audience, user: userData || {} }), [userData, audience]);

  const model = useMemo(() => buildPlayerCardModel({
    audience,
    histories,
    qrUrl: qrTarget.url,
    user: userData || {},
  }), [userData, histories, qrTarget.url, audience]);

  // Mapping modele pur -> props de la carte collectible (design final).
  const cardProps = useMemo(() => ({
    age: model.age != null ? `${model.age} ${t('playerCard.field.yearsUnit', 'ANS')}` : '—',
    club: model.hasClub ? model.clubName : t('playerCard.noClub', 'SANS CLUB'),
    historique: model.history.map((entry) => ({
      categorie: entry.level || entry.category || '',
      club: entry.clubName,
      periode: formatHistoryPeriod(entry, t('playerCard.nowShort', 'AUJ.')),
    })),
    historiqueEmptyLabel: t('playerCard.historyEmpty', 'Parcours à compléter'),
    locked: consent.isLockedPreview,
    nationalite: model.nationality || '—',
    nom: model.lastname || '—',
    numero: String(model.number),
    photo: model.photoUrl ? { uri: getImageUrl(model.photoUrl) } : undefined,
    poste: model.position || '—',
    prenom: model.firstname || '',
    qrValue: model.qrUrl,
    rarity: mapScoreToCardRarity(model.rarityScore),
    // Sport vide -> pill masquee par le composant (pas de moignon « — »).
    sport: model.sport || '',
    statut: model.isAvailable ? 'DISPONIBLE' : 'INDISPONIBLE',
    ville: model.city || '—',
  }), [model, consent.isLockedPreview, t]);

  const shareLabels = useMemo(() => ({
    availableSuffix: t('playerCard.shareAvailableSuffix', 'Je cherche un club !'),
    fallbackName: t('playerCard.shareFallbackName', 'Ma carte FoundClub'),
    intro: t('playerCard.shareIntro', 'Voici ma carte FoundClub.'),
    linkLabel: t('playerCard.shareLinkLabel', 'Retrouve-moi sur FoundClub'),
  }), [t]);

  const handleExternalShare = async () => {
    if (!consent.canShare) return;
    try {
      const { message, title } = buildCardShareMessage({ labels: shareLabels, model });
      await shareCard({ message, title });
      setIsShareVisible(false);
    } catch (err) {
      Alert.alert(
        t('common.error', 'Erreur'),
        t('playerCard.shareError', 'Impossible de générer l\'image pour le moment.'),
      );
    }
  };

  const handleSaveToGallery = async () => {
    if (!consent.canDownload) return;
    try {
      const saved = await saveCardToGallery();
      if (saved) {
        Alert.alert(
          t('playerCard.savedTitle', 'Image enregistrée'),
          t('playerCard.savedDescription', 'Ta carte a été ajoutée aux photos de ton téléphone (album FoundClub).'),
        );
      }
    } catch (err) {
      const permissionDenied = String(err?.message || '').includes('gallery_permission_denied');
      Alert.alert(
        t('common.error', 'Erreur'),
        permissionDenied
          ? t('playerCard.saveErrorPermission', 'Autorise l\'accès aux photos pour enregistrer ta carte.')
          : t('playerCard.saveError', 'Impossible d\'enregistrer l\'image pour le moment.'),
      );
    }
  };

  const handleSendInChat = async (chatId) => {
    if (!consent.canShare || !chatId || isSending) return;
    setIsSending(true);
    try {
      const uri = await captureToFile();
      const attachments = await uploadCardImage({ fileUri: uri });
      if (!attachments.length) {
        Alert.alert(t('common.error', 'Erreur'), t('playerCard.uploadError', 'L\'envoi de l\'image a échoué.'));
        return;
      }
      const { message } = buildCardShareMessage({ labels: shareLabels, model });
      const sentId = sendMessage(chatId, message || '', { attachments, sender: userData });
      if (!sentId) {
        // Socket indisponible : l'image est uploadée mais le message n'est pas parti.
        Alert.alert(t('common.error', 'Erreur'), t('playerCard.uploadError', 'L\'envoi de l\'image a échoué.'));
        return;
      }
      setIsShareVisible(false);
      setTimeout(() => {
        Alert.alert(
          t('playerCard.sentTitle', 'Carte envoyée'),
          t('playerCard.sentDescription', 'Ta carte a bien été partagée. Ouvrir la conversation ?'),
          [
            { style: 'cancel', text: t('common.later', 'Plus tard') },
            { onPress: () => navigation.navigate(RouteNames.Conversation, { chatId }), text: t('common.open', 'Ouvrir') },
          ],
        );
      }, 120);
    } catch (err) {
      Alert.alert(t('common.error', 'Erreur'), t('playerCard.uploadError', 'L\'envoi de l\'image a échoué.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleEditCard = () => {
    // Edite toutes les infos de la carte via l'editeur de profil (source de
    // verite unique : la sauvegarde met a jour le profil ET la carte).
    navigation.navigate(RouteNames.ProfileEdit, { source: 'player_card' });
  };

  const handleContinueOnboarding = () => {
    navigation.navigate(getPostOnboardingHomeRoute());
  };

  const handleRequestParentalConsent = () => {
    // Reutilise le flux parental existant (onboarding). Le consentement met a jour
    // parentalDeclarationAccepted / cardConsentAcceptedAt cote profil.
    navigation.navigate(RouteNames.UserParentalDeclaration, {
      returnRoute: RouteNames.PlayerCard,
      source: 'player_card',
    });
  };

  const openShare = () => {
    if (!consent.canShare) return;
    setIsShareVisible(true);
  };

  // Carte visible : pleine largeur ecran moins les marges. Les glows debordent
  // volontairement -> marge laterale genereuse.
  const visibleCardWidth = Math.min(windowWidth - 48, 560);

  return (
    <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
      <ScrollView contentContainerStyle={[Spaces.gap[16], Spaces.paddingVertical[16]]} showsVerticalScrollIndicator={false}>
        {/* En-tete */}
        <View style={[Spaces.gap[8], Alignments.alignCenter]}>
          {isCelebration ? (
            <Text style={[Fonts.label, { color: Colors.primary200, letterSpacing: 1, textTransform: 'uppercase' }]}>
              {t('playerCard.revealEyebrow', 'Bienvenue')}
            </Text>
          ) : null}
          <Text style={[Fonts.h2Black, Fonts.neutral00, { textAlign: 'center' }]}>
            {isCelebration
              ? t('playerCard.revealTitle', 'Voici ta carte de collection')
              : t('playerCard.screenTitle', 'Ma carte de collection')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200, { maxWidth: 320, textAlign: 'center' }]}>
            {t('playerCard.screenSubtitle', 'Partage ta carte, gagne en visibilité et fais-toi détecter.')}
          </Text>
          {/* Bouton d'edition de toutes les infos de la carte (au-dessus de la
              carte : toujours atteignable, jamais recouvert par le bandeau du
              tour). Ouvre l'editeur de profil -> met a jour carte ET profil. */}
          {!consent.isLockedPreview ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleEditCard}
              style={[styles.numberChip, { borderColor: `${Colors.primary500}66` }]}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.primary200 }]}>
                {t('playerCard.editCardCta', 'Modifier mes infos')}
              </Text>
              <Text style={[Fonts.p3Bold, { color: Colors.primary200 }]}>  ✎</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Carte (visible) */}
        <View style={[Alignments.alignCenter, isCelebration ? styles.tilted : null, styles.cardSlot]}>
          <PlayerCard
            age={cardProps.age}
            bottomPanel="historique"
            club={cardProps.club}
            historique={cardProps.historique}
            historiqueEmptyLabel={cardProps.historiqueEmptyLabel}
            locked={cardProps.locked}
            nationalite={cardProps.nationalite}
            nom={cardProps.nom}
            numero={cardProps.numero}
            photo={cardProps.photo}
            poste={cardProps.poste}
            prenom={cardProps.prenom}
            qrValue={cardProps.qrValue}
            rarity={cardProps.rarity}
            sport={cardProps.sport}
            statut={cardProps.statut}
            ville={cardProps.ville}
            width={visibleCardWidth}
          />
        </View>

        {/* Jauge de rarete (double usage : incite a completer le profil) */}
        <View style={[Spaces.gap[8]]}>
          <View style={styles.gaugeTrack}>
            <View style={[styles.gaugeFill, { backgroundColor: Colors.primary500, width: `${Math.min(100, model.rarityScore)}%` }]} />
          </View>
          <Text style={[Fonts.p4, Fonts.neutral300, { textAlign: 'center' }]}>
            {t('playerCard.rarityHint', 'Complète ton profil et ton parcours pour monter en rareté.')}
          </Text>
        </View>

        {/* Garde-fou mineurs : aperçu verrouille */}
        {consent.isLockedPreview ? (
          <View style={[Spaces.gap[12]]}>
            <ParentalDeclarationCard
              checked={false}
              description={t('playerCard.minorGuardDescription', 'Ce profil concerne un mineur. La publication de la carte nécessite l\'accord d\'un parent ou représentant légal.')}
              disabled
              onChange={() => {}}
              title={t('playerCard.minorGuardTitle', 'Accord parental requis')}
            />
            <Button
              onPress={handleRequestParentalConsent}
              title={t('playerCard.requestConsent', 'Demander l\'accord parental')}
              variant="Primary"
            />
          </View>
        ) : (
          <View style={[Spaces.gap[12]]}>
            <Button
              disabled={isBusy}
              icon="share"
              isLoading={isBusy}
              onPress={openShare}
              title={isBusy
                ? t('playerCard.generating', 'Génération de l\'image…')
                : t('playerCard.shareCta', 'Partager ma carte')}
              variant="Primary"
            />
            <Button
              disabled={isBusy}
              onPress={handleSaveToGallery}
              title={t('playerCard.saveCta', 'Enregistrer l\'image')}
              variant="Ghost"
            />
          </View>
        )}

        {isCelebration ? (
          <Button
            onPress={handleContinueOnboarding}
            title={t('playerCard.revealContinue', 'Plus tard, continuer')}
            variant="Ghost"
          />
        ) : null}
      </ScrollView>

      {/* Rendu HORS-ECRAN dedie a la capture (992×1262 a l'export, jamais voile) */}
      <View collapsable={false} pointerEvents="none" style={styles.offscreen}>
        <View collapsable={false} ref={cardRef}>
          <PlayerCard
            age={cardProps.age}
            bottomPanel="historique"
            club={cardProps.club}
            historique={cardProps.historique}
            historiqueEmptyLabel={cardProps.historiqueEmptyLabel}
            locked={false}
            nationalite={cardProps.nationalite}
            nom={cardProps.nom}
            numero={cardProps.numero}
            photo={cardProps.photo}
            poste={cardProps.poste}
            prenom={cardProps.prenom}
            qrValue={cardProps.qrValue}
            rarity={cardProps.rarity}
            sport={cardProps.sport}
            statut={cardProps.statut}
            ville={cardProps.ville}
            width={CARD_EXPORT_WIDTH / 2}
          />
        </View>
      </View>

      <ShareCardModal
        canShare={consent.canShare}
        isBusy={isBusy || isSending}
        isVisible={isShareVisible}
        onClose={() => setIsShareVisible(false)}
        onExternalShare={handleExternalShare}
        onSelectChat={handleSendInChat}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cardSlot: { paddingVertical: 8 },
  gaugeFill: { borderRadius: 999, height: 8 },
  gaugeTrack: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 8, overflow: 'hidden', width: '100%',
  },
  numberChip: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(1,179,244,0.08)',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  offscreen: {
    left: -9999, position: 'absolute', top: 0,
  },
  tilted: { transform: [{ rotate: '-3deg' }] },
});

export default PlayerCardScreen;
