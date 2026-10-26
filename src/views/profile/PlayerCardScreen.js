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
import { buildCardDisclosure, buildCardShareMessage } from '@/domains/playerCard/cardMessages';
import { buildPlayerCardModel } from '@/domains/playerCard/cardModel';
import { buildPlayerCardProps } from '@/domains/playerCard/cardProps';
import useShareCard from '@/domains/playerCard/useShareCard';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ParentalDeclarationCard from '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard';
import CardDisclosureSheet from '@/components/organisms/playerCard/CardDisclosureSheet';
import CardSheen from '@/components/organisms/playerCard/CardSheen';
import PlayerCard, { CARD_EXPORT_HEIGHT, CARD_EXPORT_WIDTH } from '@/components/organisms/playerCard/PlayerCard';
import ShareCardModal from '@/components/organisms/shareCardModal/ShareCardModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetPersonalStats } from '@/services/matchStats/matchStatsQueries';
import { buildCardQrTarget } from '@/services/playerCard/cardQrTarget';
import { uploadCardImage } from '@/services/playerCard/uploadCardImage';
import { useGetMyHistories } from '@/services/userHistory/userHistoryQueries';

import { getImageUrl } from '@/utils/imageUrl';

import { FILE_SHARE_FAILURES, FILE_SHARE_OUTCOMES } from '@/platform/share/fileShareContract';

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
  // CARTECODE Q5 B — « vie dans FoundClub » : le nombre de matchs joués, jamais présences ni notes.
  const userId = userData?.documentId || userData?.id;
  const { data: personalStats } = useGetPersonalStats(userId, { enabled: Boolean(userId) });

  const {
    captureToFile, cardRef, isBusy, saveCardToGallery, shareCard,
  } = useShareCard();

  const [isShareVisible, setIsShareVisible] = useState(false);
  // CARTECODE (ligne 41) : « ce qui part » s'ouvre AVANT le partage, pour tout le monde.
  const [isDisclosureVisible, setIsDisclosureVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const isCelebration = Boolean(route?.params?.celebration);
  // Audience explicite via params, sinon deduite du role (coach = entraineur).
  const audience = route?.params?.audience
    || (userData?.role?.type === 'entraineur' ? 'coach' : 'player');

  const consent = useMemo(() => getCardConsentState(userData || {}), [userData]);
  // L'etat redessine par PAR-L14 (E31) : ni verrouille, ni celebration.
  const isNormal = !isCelebration && !consent.isLockedPreview;

  const qrTarget = useMemo(() => buildCardQrTarget({ audience, user: userData || {} }), [userData, audience]);
  const matchCount = Number(personalStats?.overall?.matches || 0);

  const model = useMemo(() => buildPlayerCardModel({
    audience,
    histories,
    matchCount,
    qrUrl: qrTarget.url,
    user: userData || {},
  }), [userData, histories, matchCount, qrTarget.url, audience]);

  const cardProps = useMemo(() => buildPlayerCardProps({
    imageUrl: getImageUrl,
    labels: {
      now: t('playerCard.nowShort', 'AUJ.'),
      qrProfile: t('playerCard.qrProfile', 'mon profil'),
      yearsUnit: t('playerCard.field.yearsUnit', 'ans'),
    },
    locked: consent.isLockedPreview,
    model,
    qr: qrTarget,
  }), [model, consent.isLockedPreview, qrTarget, t]);
  const disclosure = useMemo(() => buildCardDisclosure({ model, qr: qrTarget }), [model, qrTarget]);

  const shareLabels = useMemo(() => ({
    availableSuffix: t('playerCard.shareAvailableSuffix', 'Je cherche un club !'),
    fallbackName: t('playerCard.shareFallbackName', 'Ma carte FoundClub'),
    intro: t('playerCard.shareIntro', 'Voici ma carte FoundClub.'),
    linkLabel: t('playerCard.shareLinkLabel', 'Retrouve-moi sur FoundClub'),
  }), [t]);

  // Sur Android le partage ENREGISTRE l'image puis propose une application pour
  // l'ouvrir : sans un mot, un fichier rangé hors de l'écran est indiscernable
  // d'un échec. Sur iOS et sur le web, le système a déjà montré ce qu'il faisait
  // — un message de plus serait du bruit.
  const sharedNotice = (outcome) => (outcome === FILE_SHARE_OUTCOMES.GALLERY
    ? t('playerCard.shareSavedGallery', 'Ta carte est enregistrée dans tes photos (album FoundClub). Choisis maintenant où la publier.')
    : null);

  // L'erreur porte sa cause (`reason`, posé par shareLocalFile) : un refus de
  // permission n'est pas un échec de génération, et le message générique
  // enverrait l'utilisateur chercher un problème qui n'existe pas.
  const shareErrorText = (failure) => {
    if (failure?.reason === FILE_SHARE_FAILURES.PERMISSION_DENIED) {
      return t(
        'playerCard.sharePermissionError',
        'FoundClub n\'a pas le droit d\'enregistrer dans ton téléphone. '
        + 'Autorise-le dans les réglages, puis réessaie.',
      );
    }
    if (failure?.reason === FILE_SHARE_FAILURES.SAVE_FAILED) {
      return t(
        'playerCard.shareSaveError',
        'L\'enregistrement a échoué. Il reste peut-être trop peu de place sur ton téléphone.',
      );
    }
    return t('playerCard.shareError', 'Impossible de générer l\'image pour le moment.');
  };

  const handleExternalShare = async () => {
    if (!consent.canShare) return;
    try {
      const { message, title } = buildCardShareMessage({ labels: shareLabels, model });
      // Titre du sélecteur d'application Android. Sans lui, le système ouvre
      // directement l'application par défaut : l'utilisateur ne CHOISIT plus.
      const result = await shareCard({
        dialogTitle: t('playerCard.shareOpenWith', 'Ouvrir ta carte avec…'),
        message,
        title,
      });
      setIsShareVisible(false);
      const notice = sharedNotice(result?.outcome);
      if (notice) {
        Alert.alert(t('playerCard.savedTitle', 'Image enregistrée'), notice);
      }
    } catch (err) {
      Alert.alert(t('common.error', 'Erreur'), shareErrorText(err));
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
    // CARTECODE Q6 B — âge inconnu : la date d'abord, puis la règle de son âge.
    if (consent.mustAskBirthdate) {
      navigation.navigate(RouteNames.ProfileEdit, { focus: 'birthdate', source: 'player_card' });
      return;
    }
    setIsDisclosureVisible(true);
  };

  const confirmDisclosure = () => {
    setIsDisclosureVisible(false);
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
              ? t('playerCard.revealTitle', 'Voici ta carte joueur')
              : t('playerCard.screenTitle', 'Ma carte joueur')}
          </Text>
          {/* PAR-L14 (E31) : dans l'etat NORMAL, l'accroche et « Modifier mes
              infos » quittent le haut de l'ecran — sur un iPhone SE, ils
              poussaient « Partager » sous le bas de l'ecran (723 px pour 667).
              Verrouille et celebration, non maquettes, restent a l'identique. */}
          {!isNormal ? (
            <Text style={[Fonts.p2, Fonts.neutral200, { maxWidth: 320, textAlign: 'center' }]}>
              {t('playerCard.screenSubtitle', 'Partage ta carte, gagne en visibilité et fais-toi détecter.')}
            </Text>
          ) : null}
          {/* Bouton d'edition de toutes les infos de la carte (au-dessus de la
              carte : toujours atteignable, jamais recouvert par le bandeau du
              tour). Ouvre l'editeur de profil -> met a jour carte ET profil. */}
          {isCelebration && !consent.isLockedPreview ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleEditCard}
              style={[styles.numberChip, { borderColor: `${Colors.primary500}66` }]}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.primary200 }]}>
                {t('playerCard.editCardCta', 'Modifier mes infos')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Carte (visible) */}
        <View style={[Alignments.alignCenter, isCelebration ? styles.tilted : null, styles.cardSlot]}>
          {/* Q10 B : le reflet glisse sous le doigt (écran seulement). */}
          <CardSheen
            height={visibleCardWidth * (CARD_EXPORT_HEIGHT / CARD_EXPORT_WIDTH)}
            width={visibleCardWidth}
          >
            {/* eslint-disable-next-line react/jsx-props-no-spreading */}
            <PlayerCard {...cardProps} mode="ecran" width={visibleCardWidth} />
          </CardSheen>
        </View>

        {/* PAR-L14 (E31) : les deux gestes, cote a cote, JUSTE SOUS la carte :
            visibles sans defiler sur un iPhone SE. Libelles courts a l'ecran,
            libelles complets pour le lecteur d'ecran. */}
        {isNormal ? (
          <View style={[Alignments.row, Spaces.gap[12]]}>
            <Button
              accessibilityLabel={t('playerCard.shareCta', 'Partager ma carte')}
              disabled={isBusy}
              icon="share"
              isLoading={isBusy}
              onPress={openShare}
              style={styles.geste}
              title={t('playerCard.shareShortCta', 'Partager')}
              variant="Primary"
            />
            <Button
              accessibilityLabel={t('playerCard.editCardCta', 'Modifier mes infos')}
              onPress={handleEditCard}
              style={styles.geste}
              title={t('common.edit', 'Modifier')}
              variant="Secondary"
            />
          </View>
        ) : null}

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
        ) : null}
        {isNormal ? (
          <Button
            disabled={isBusy}
            onPress={handleSaveToGallery}
            title={t('playerCard.saveCta', 'Enregistrer l\'image')}
            variant="Ghost"
          />
        ) : null}
        {isCelebration && !consent.isLockedPreview ? (
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
        ) : null}

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
          {/* L'image partagée : ce qui manque disparaît, le reflet est au repos. */}
          {/* eslint-disable-next-line react/jsx-props-no-spreading */}
          <PlayerCard {...cardProps} locked={false} mode="image" width={CARD_EXPORT_WIDTH / 2} />
        </View>
      </View>

      <CardDisclosureSheet
        disclosure={disclosure}
        isVisible={isDisclosureVisible}
        onClose={() => setIsDisclosureVisible(false)}
        onConfirm={confirmDisclosure}
        onEdit={() => {
          setIsDisclosureVisible(false);
          handleEditCard();
        }}
      />

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
  geste: { flex: 1 },
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
