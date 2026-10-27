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
 *    carte modele EXEMPLE puis la sienne, "Plus tard, continuer" -> params.nextRoute
 *    (etape suivante du tunnel, posee par UserClubSearch), sinon home.
 *
 * Export image : capture hors-ecran a 992×1262 (taille native de la maquette).
 */
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';

import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import { CARD_COMPLETION_STEP, listMissingCardSteps } from '@/domains/playerCard/cardCompletion';
import { getCardConsentState } from '@/domains/playerCard/cardConsent';
import { buildCardDisclosure, buildCardShareMessage } from '@/domains/playerCard/cardMessages';
import { buildPlayerCardModel, computeNextRarityStep } from '@/domains/playerCard/cardModel';
import { buildPlayerCardProps } from '@/domains/playerCard/cardProps';
import useShareCard from '@/domains/playerCard/useShareCard';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import GlyphIcon from '@/components/atoms/glyphIcon/GlyphIcon';
import ParentalDeclarationCard from '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard';
import CardDisclosureSheet from '@/components/organisms/playerCard/CardDisclosureSheet';
import CardSheen from '@/components/organisms/playerCard/CardSheen';
import PlayerCard, { CARD_EXPORT_HEIGHT, CARD_EXPORT_WIDTH } from '@/components/organisms/playerCard/PlayerCard';
import ShareCardModal from '@/components/organisms/shareCardModal/ShareCardModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import CardCompletionFlow from '@/views/profile/CardCompletionFlow';

import { RouteNames } from '@/navigation/routeNames';

import { useGetPersonalStats } from '@/services/matchStats/matchStatsQueries';
import { buildCardQrTarget } from '@/services/playerCard/cardQrTarget';
import { uploadCardImage } from '@/services/playerCard/uploadCardImage';
import { useGetMyHistories } from '@/services/userHistory/userHistoryQueries';

import { formatHeight } from '@/utils/heightCentimeters';
import { getImageUrl } from '@/utils/imageUrl';

import { FILE_SHARE_FAILURES, FILE_SHARE_OUTCOMES } from '@/platform/share/fileShareContract';

/**
 * @typedef {{ done?: boolean, mode: 'full' | 'share', startRarity?: string, steps: string[] }}
 *   ParcoursCarte
 */

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
    getPostOnboardingHomeRoute, refetchUserData, userData,
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
  // CARTECODE-PARCOURS — « Compléter ma carte » : ses étapes, et ce que la personne a répondu
  // (le brouillon remplit la carte en direct, avant même que le profil soit relu).
  const [parcours, setParcours] = useState(
    /** @type {ParcoursCarte | null} */ (null),
  );
  const [draft, setDraft] = useState({});
  const draftRef = useRef({});
  // Fin d'inscription (planche, partie 9) : d'abord la carte modèle, puis la sienne.
  const [hasSeenExample, setHasSeenExample] = useState(false);

  const isCelebration = Boolean(route?.params?.celebration);
  // Audience explicite via params, sinon deduite du role (coach = entraineur).
  const audience = route?.params?.audience
    || (userData?.role?.type === 'entraineur' ? 'coach' : 'player');

  const consent = useMemo(() => getCardConsentState(userData || {}), [userData]);
  const cardUser = useMemo(() => ({ ...(userData || {}), ...draft }), [userData, draft]);
  const missingSteps = useMemo(() => listMissingCardSteps(cardUser), [cardUser]);
  // L'etat redessine par PAR-L14 (E31) : ni verrouille, ni celebration.
  const isNormal = !isCelebration && !consent.isLockedPreview;

  const qrTarget = useMemo(() => buildCardQrTarget({ audience, user: userData || {} }), [userData, audience]);
  const matchCount = Number(personalStats?.overall?.matches || 0);

  const model = useMemo(() => buildPlayerCardModel({
    audience,
    histories,
    matchCount,
    qrUrl: qrTarget.url,
    user: cardUser,
  }), [cardUser, histories, matchCount, qrTarget.url, audience]);

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
    // CARTECODE-PARCOURS : venue du tunnel (« Ouvert au recrutement ? »), la carte rend la main
    // a l'etape suivante ; sinon, l'accueil.
    navigation.navigate(route?.params?.nextRoute || getPostOnboardingHomeRoute());
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
    // CARTECODE Q6 B — âge inconnu : l'étape « date » du parcours d'abord, puis la règle de
    // son âge.
    if (getCardConsentState(cardUser).mustAskBirthdate) {
      setParcours({ mode: 'share', steps: [CARD_COMPLETION_STEP.BIRTHDATE] });
      return;
    }
    setParcours(null);
    setIsDisclosureVisible(true);
  };

  const openCompletion = () => {
    // CARTEFIN : la rareté du départ, pour dire à la fin « Commune, puis Rare ».
    if (!missingSteps.length) return;
    setParcours({ mode: 'full', startRarity: model.rarity, steps: missingSteps });
  };

  const handleDraft = (patch) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
  };

  const handleCompletionFinish = () => {
    if (parcours?.mode !== 'share') {
      setParcours({ ...parcours, done: true });
      return;
    }
    // Date donnée ou passée : personne n'est bloqué, la règle de l'âge (connu ou non) s'applique.
    setParcours(null);
    if (getCardConsentState({ ...(userData || {}), ...draftRef.current }).canShare) {
      setIsDisclosureVisible(true);
    }
  };

  const confirmDisclosure = () => {
    setIsDisclosureVisible(false);
    setIsShareVisible(true);
  };

  // Carte visible : pleine largeur ecran moins les marges. Les glows debordent
  // volontairement -> marge laterale genereuse.
  const visibleCardWidth = Math.min(windowWidth - 48, 560);
  const cardHeight = (width) => width * (CARD_EXPORT_HEIGHT / CARD_EXPORT_WIDTH);
  const miniCard = (
    <View style={[Alignments.alignCenter]}>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <PlayerCard {...cardProps} mode="ecran" width={visibleCardWidth * 0.5} />
    </View>
  );

  const missingNames = missingSteps.map((step) => t(`playerCard.completion.items.${step}`));
  const missingBanner = missingSteps.length && !consent.isLockedPreview ? (
    <View style={[styles.banner, Spaces.gap[8], { borderColor: Colors.primary500 }]}>
      <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
        {t('playerCard.completion.bannerTitle', {
          count: missingSteps.length,
          defaultValue: 'Il manque {{count}} informations à ta carte',
        })}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {`${missingNames.join(', ').replace(/^./, (c) => c.toUpperCase())}.`}
      </Text>
      <Button
        onPress={openCompletion}
        title={t('playerCard.completion.cta', 'Compléter ma carte')}
        variant="Secondary"
      />
    </View>
  ) : null;

  // CARTEFIN (planche v2, partie 8, écran 7) — fin du parcours : la rareté gagnée (« Commune »,
  // chevron, « Rare » : pas de flèche typographique, SANS-EMOJI), puis la marche suivante la
  // plus simple (barème de computeCardRarity).
  const nomRarete = (rarity) => t(`playerCard.rarity.${rarity}`).toLowerCase();
  const capitale = (mot) => mot.replace(/^./, (c) => c.toUpperCase());
  const marche = parcours?.done ? computeNextRarityStep({
    clubCount: model.historyClubCount,
    fill: model.fill,
    isTeamMember: Array.isArray(cardUser.myTeams) && cardUser.myTeams.length > 0,
    matchCount,
  }) : null;
  const gestes = (marche?.actions || []).map(({ count, kind }) => {
    if (kind !== 'matches') return t(`playerCard.completion.nextStep.${kind}`, { count });
    return matchCount > 0
      ? t('playerCard.completion.nextStep.matchesMore', { count })
      : t('playerCard.completion.nextStep.matches', { count });
  });
  const aMonte = Boolean(marche && parcours.startRarity && parcours.startRarity !== marche.rarity);
  const et = t('playerCard.completion.nextStep.and');
  const listeGestes = gestes.length > 1
    ? `${gestes.slice(0, -1).join(', ')} ${et} ${gestes[gestes.length - 1]}`
    : gestes[0];
  const nextStepBanner = marche ? (
    <View style={[styles.banner, Spaces.gap[8], { borderColor: Colors.primary500 }]}>
      <View
        accessibilityLabel={aMonte ? t('playerCard.completion.nextStep.climb', {
          from: nomRarete(parcours.startRarity), to: nomRarete(marche.rarity),
        }) : undefined}
        accessible
        style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}
      >
        {aMonte ? (
          <>
            <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
              {capitale(nomRarete(parcours.startRarity))}
            </Text>
            <GlyphIcon color={Colors.primary500} name="chevronRight" size={16} />
          </>
        ) : null}
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{capitale(nomRarete(marche.rarity))}</Text>
      </View>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {marche.next && gestes.length
          ? t('playerCard.completion.nextStep.goal', {
            actions: listeGestes, rarity: nomRarete(marche.next),
          })
          : t('playerCard.completion.nextStep.top')}
      </Text>
    </View>
  ) : null;

  // ponytail: carte modèle FICTIVE (aucun compte derrière) ; ses mots passent par la traduction,
  // les noms propres restent. Sortie : la tirer du serveur si un jour elle doit changer seule.
  const exampleCardProps = {
    age: `22 ${t('playerCard.field.yearsUnit', 'ans')}`,
    categorie: t('playerCard.example.category', 'Seniors'),
    club: t('playerCard.example.club', 'Basket Club Exemple'),
    equipe: t('playerCard.example.team', 'Seniors filles'),
    historique: [],
    nationalite: t('playerCard.example.nationality', 'Française'),
    niveau: t('playerCard.example.level', 'Régional'),
    nom: 'MARTIN',
    numero: '7',
    poids: '62 kg',
    poste: t('playerCard.example.position', 'Meneuse'),
    prenom: 'Léa',
    qrLabel: 'foundclub.app',
    qrValue: '',
    rarity: 'EPIC',
    section: '',
    sport: 'basketball',
    statut: 'DISPONIBLE',
    taille: formatHeight(172),
    ville: 'Lyon 69007',
  };
  const showExample = isCelebration && !hasSeenExample && !parcours;

  if (parcours) {
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen" keyboardAvoiding>
        <ScrollView
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingVertical[16]]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {parcours.done ? (
            <View style={[Spaces.gap[16]]}>
              <Text style={[Fonts.h2Black, Fonts.neutral00, styles.centre]}>
                {missingSteps.length
                  ? t('playerCard.completion.done.partialTitle', 'Ta carte est à jour')
                  : t('playerCard.completion.done.title', 'Ta carte est complète')}
              </Text>
              {miniCard}
              {nextStepBanner}
              {missingSteps.length ? (
                <Text style={[Fonts.p2, Fonts.neutral300, styles.centre]}>
                  {t(
                    'playerCard.completion.done.partialHint',
                    'Tu pourras ajouter le reste quand tu veux.',
                  )}
                </Text>
              ) : null}
              {consent.canShare ? (
                <Button
                  icon="share"
                  onPress={openShare}
                  title={t('playerCard.shareCta', 'Partager ma carte')}
                  variant="Primary"
                />
              ) : null}
              <Button
                onPress={() => setParcours(null)}
                title={t('playerCard.completion.done.later', 'Plus tard')}
                variant="Ghost"
              />
            </View>
          ) : (
            <CardCompletionFlow
              card={miniCard}
              onDraft={handleDraft}
              onFinish={handleCompletionFinish}
              onSaved={() => refetchUserData?.()}
              steps={parcours.steps}
              user={userData || {}}
            />
          )}
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (showExample) {
    const exampleWidth = Math.min(windowWidth - 96, 420);
    return (
      <ScreenContainer bgImage="bg2" bottomInsetMode="screen">
        <ScrollView
          contentContainerStyle={[Spaces.gap[16], Spaces.paddingVertical[16]]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[Spaces.gap[8], Alignments.alignCenter]}>
            <Text style={[Fonts.h2Black, Fonts.neutral00, styles.centre]}>
              {t('playerCard.example.title', 'Voici une carte FoundClub')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral200, styles.centre, styles.accroche]}>
              {t(
                'playerCard.example.subtitle',
                'Photo, poste, niveau, club, parcours : plus elle est remplie, plus elle est rare.',
              )}
            </Text>
          </View>
          <View style={[Alignments.alignCenter]}>
            <View style={{ height: cardHeight(exampleWidth), width: exampleWidth }}>
              {/* eslint-disable-next-line react/jsx-props-no-spreading */}
              <PlayerCard {...exampleCardProps} mode="image" width={exampleWidth} />
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, Alignments.alignCenter, styles.filigraneBloc]}
              >
                <Text style={[Fonts.h1Black, styles.filigrane, { color: Colors.neutral00 }]}>
                  {t('playerCard.example.watermark', 'EXEMPLE')}
                </Text>
              </View>
            </View>
          </View>
          <Button
            onPress={() => setHasSeenExample(true)}
            title={t('playerCard.example.cta', 'Découvrir ma carte')}
            variant="Primary"
          />
        </ScrollView>
      </ScreenContainer>
    );
  }

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
            height={cardHeight(visibleCardWidth)}
            width={visibleCardWidth}
          >
            {/* CARTECODE-PARCOURS : il manque des infos ? toucher sa carte ouvre le parcours. */}
            <Pressable
              accessibilityLabel={missingBanner
                ? t('playerCard.completion.cta', 'Compléter ma carte')
                : undefined}
              accessibilityRole={missingBanner ? 'button' : undefined}
              disabled={!missingBanner}
              onPress={openCompletion}
            >
              {/* eslint-disable-next-line react/jsx-props-no-spreading */}
              <PlayerCard {...cardProps} mode="ecran" width={visibleCardWidth} />
            </Pressable>
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

        {missingBanner}

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
  accroche: { maxWidth: 320 },
  banner: { borderRadius: 16, borderWidth: 1, padding: 16 },
  cardSlot: { paddingVertical: 8 },
  centre: { textAlign: 'center' },
  filigrane: {
    fontSize: 44, letterSpacing: 8, opacity: 0.22, transform: [{ rotate: '-24deg' }],
  },
  filigraneBloc: { justifyContent: 'center' },
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
