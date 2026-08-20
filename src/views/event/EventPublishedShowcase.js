// @ts-nocheck
/**
 * app/src/views/event/EventPublishedShowcase.js
 *
 * Écran « Ton événement est en ligne, fais-le voir » affiché juste après publication
 * d'une détection / séance d'essai (câblé dans EventWizardRecap — voir diffs/app-EventWizardRecap.patch).
 *
 * Réutilise les patterns EXISTANTS de l'app :
 *   - useTheme (Colors.primary500 / Colors.primary700)
 *   - BottomModal (le gabarit maison des feuilles) pour le choix de format
 *   - useSafeAreaInsets, comme ScreenContainer : l'écran est `headerShown: false`
 *   - buildShareMessageWithUrl / buildPublicEventUrl (@/utils/shareLinks)
 *   - celebrate() pour rejouer la célébration de création
 * L'aperçu + les téléchargements passent par useEventShowcase (endpoint render serveur).
 *
 * D20 (2026-08-07) — TROIS gestes, décidés par Adel : « Enregistrer l'image »
 * (qui ouvre le choix de format, photos du téléphone en premier), « Partager
 * l'affiche » (partage système), « Plus tard ».
 * ⚠️ `ShareEventModal` a quitté cet écran : il y était une IMPASSE (l'écran
 * passait un `onSelectChat` qui ne faisait que refermer la fenêtre, alors que
 * ShareEventModal délègue l'envoi au parent). Le geste qui MARCHE vit sur
 * EventDetails — et « Plus tard » y ramène.
 *
 * NOTE : imports `@/...` résolus dans app/. Non exécuté ici (câblage app).
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo, ActivityIndicator, Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getEventShowcaseShareIntro } from '@/domains/visuals/eventShowcaseTemplate';
import { isLongWait } from '@/domains/visuals/renderProgress';
import useVisualShowcase, { SHOWCASE_TEMPLATES } from '@/domains/visuals/useEventShowcase';
import useTheme from '@/theme/themeContext';

import SkeletonLoader from '@/components/atoms/skeletonLoader/SkeletonLoader';
import Input from '@/components/molecules/input/Input';

import { celebrate } from '@/services/celebrations/celebrationRuntime';

import { buildPublicEventUrl, buildShareMessageWithUrl } from '@/utils/shareLinks';

import {
  FILE_SHARE_CAPABILITIES, FILE_SHARE_FAILURES, FILE_SHARE_OUTCOMES, getFileShareCapability,
} from '@/platform/share/fileShareContract';

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
export default function EventPublishedShowcase({ navigation, route }) {
  const { ApplicationStyle, Colors } = useTheme();
  const { t } = useTranslation();
  const params = route?.params || {};
  const {
    creationCelebration,
    editableFields: editableFieldsParam,
    eventId,
    eventTypeName,
    shareIntro: shareIntroParam,
    shareLinkLabel: shareLinkLabelParam,
    shareUrl: shareUrlParam,
    subtitleText: subtitleTextParam,
    titleText: titleTextParam,
    variants: variantsParam,
  } = params;

  // Résolution de la config : params d'entrée (A/B) complétés par le catalogue du
  // gabarit. DÉFAUTS = 'affiche-detection' (comportement événement inchangé).
  const template = params.template || 'affiche-detection';
  const templateConfig = SHOWCASE_TEMPLATES[template] || SHOWCASE_TEMPLATES['affiche-detection'];
  const subjectType = params.subjectType || templateConfig.subjectType;
  const subjectId = params.subjectId ?? eventId;
  const editableFields = editableFieldsParam || templateConfig.editableFields;

  // AA08 (2026-08-20) — LA FEUILLE DE FORMAT TOMBE AVEC SA PORTE.
  // 🧨 Constat d'Adel : « l'affiche propose “enregistrer l'image”, qui ne sert
  // pas ». Il avait raison deux fois. « Dans mes photos » — la PREMIÈRE entrée
  // de la feuille — appelait `shareVisual(undefined)`, EXACTEMENT le geste du
  // bouton « Partager » d'à côté, au message près : sur iOS les deux ouvraient
  // la même feuille système, sur Android les deux enregistraient le même
  // fichier. Un bouton principal qui ouvre un panneau dont la première ligne
  // double le bouton suivant : deux appuis pour rien.
  // ⇒ La feuille tombe, mais PAS ce qu'elle contenait de vrai : story et A4
  //   remontent à l'écran. Sans ça, le PDF qu'Adel demande de réparer
  //   deviendrait INATTEIGNABLE.
  // Il reste 'story' · 'poster' · 'share' — il n'y a plus de 'save'.
  const [busyAction, setBusyAction] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const reduceMotion = useReduceMotion();

  // D20 (⑦) : l'écran est enregistré `headerShown: false` (EventStack.js,
  // PrivateNavigator.js) — rien au-dessus de lui ne réserve la barre d'état, il
  // doit donc le faire lui-même. Même motif que ScreenContainer (le gabarit
  // maison) : `headerHeightNative || insets.top`, ici sans en-tête natif possible.
  // Un nombre en dur casserait d'un modèle de téléphone à l'autre.
  const insets = useSafeAreaInsets();

  // CE QUI VA SE PASSER quand on presse, décidé une seule fois dans la couche
  // plateforme (fileShareContract). L'écran n'interroge PAS Platform.OS pour ça :
  // c'est un Platform.OS dispersé qui a produit le défaut L20 (sur Android, le
  // fichier était confié à une feuille de partage qui le jetait).
  const saveThenOpen = getFileShareCapability() === FILE_SHARE_CAPABILITIES.SAVE_THEN_OPEN;

  // L'aperçu est un visuel PORTRAIT (4:5) rendu à sa taille réelle : sur un grand écran
  // (web/desktop) il déborde et masque les boutons d'action. On plafonne sa largeur par la
  // hauteur visible (≈ 50 %) pour que l'affiche ENTIÈRE et les boutons tiennent ensemble,
  // sans dépasser la largeur dispo sur mobile.
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const previewWidth = Math.max(200, Math.min(windowWidth - 40, Math.round(windowHeight * 0.5)));

  const {
    downloadPoster, downloadStory, error, isLoading, overrides, previewUri,
    resetOverrides, retry, setOverride, setVariant, shareVisual, variant, variants,
  } = useVisualShowcase({
    eventId, subjectId, subjectType, template, variants: variantsParam,
  });

  const { texts } = templateConfig;
  const titleText = titleTextParam || t(texts.title.key, texts.title.default);
  const subtitleText = subtitleTextParam || t(texts.subtitle.key, texts.subtitle.default);

  // URL publique cible du partage natif : passée par l'appelant (club/annonce) ou
  // dérivée pour l'événement (retro-compat buildPublicEventUrl).
  const shareUrl = useMemo(() => {
    if (shareUrlParam) return shareUrlParam;
    if (subjectType === 'event') return buildPublicEventUrl({ eventId: subjectId });
    return null;
  }, [shareUrlParam, subjectType, subjectId]);

  // Rejoue la célébration de création (confettis) à l'ouverture.
  useEffect(() => {
    if (creationCelebration?.actionKey) {
      const id = setTimeout(() => {
        celebrate(creationCelebration.actionKey, creationCelebration.payload);
      }, 220);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [creationCelebration]);

  // Texte qui ACCOMPAGNE l'affiche dans le partage. Le lien ne la remplace plus :
  // buildShareMessageWithUrl rend l'intro seule quand `url` est absent, donc un
  // appelant sans shareUrl envoie quand même l'affiche — plus de bouton muet.
  // D94/C2 : pour un ÉVÉNEMENT, l'intro suit le TYPE — un match ne propose plus
  // de venir essayer. Le gabarit garde son texte pour le club et l'annonce, et
  // un lien profond sans type reçoit la phrase neutre plutôt qu'un mensonge.
  //
  // S05 (2026-08-16) — ET POUR UN ÉVÉNEMENT, LE TYPE GAGNE CONTRE LE PARAMÈTRE.
  // 🧨 `intro: shareIntroParam || …` faisait passer le paramètre AVANT le type :
  // un appelant qui aurait passé `shareIntro` aurait fait mentir un match sans
  // aucune erreur, et aucune porte de qualité ne l'aurait vu. Mesuré le
  // 2026-08-16 : les 4 portes de cet écran (EventDetails, EventWizardRecap,
  // ClubDetails, RecruitmentAdDetails) n'en passent AUCUN — c'est un piège armé,
  // pas un défaut vivant. ⛔ On ne le supprime pas pour autant : le club et
  // l'annonce n'ont aucun type d'où dériver une phrase, le paramètre reste leur
  // seule personnalisation possible. Il perd seulement là où une source plus
  // sûre existe. Le filet : `EventShowcaseShareIntroPortes.test.js` (témoin ⑤).
  const isSubjectEvent = subjectType === 'event';
  const introTexts = isSubjectEvent
    ? getEventShowcaseShareIntro(eventTypeName)
    : texts.shareIntro;
  const shareMessage = useMemo(() => buildShareMessageWithUrl({
    intro: (!isSubjectEvent && shareIntroParam)
      || t(introTexts.key, introTexts.default),
    linkLabel: shareLinkLabelParam || t(texts.shareLinkLabel.key, texts.shareLinkLabel.default),
    url: shareUrl,
  }), [introTexts, isSubjectEvent, shareIntroParam, shareLinkLabelParam, shareUrl, t, texts]);

  // Titre du sélecteur d'application Android. Sans lui, le système ouvre
  // directement l'application par défaut : l'utilisateur ne CHOISIT plus.
  const chooserTitle = t('showcase.openWith', 'Ouvrir l’affiche avec…');

  // Un fichier rangé hors de l'écran (galerie, téléchargements) sans un mot est
  // indiscernable d'un échec : l'écran dit OÙ il est parti.
  // R05 : sur Android, l'affiche part par « ouvrir avec », qui ne transporte
  // AUCUN texte — la phrase de partage est donc mise dans le presse-papiers
  // (shareLocalFile.native.js). Une phrase copiée sans le dire est un geste
  // invisible : l'écran l'annonce, sinon personne ne pense à coller.
  const savedNotice = (outcome, messageCopied) => {
    const collable = messageCopied
      ? ` ${t('showcase.messageCopied', 'Le texte est copié : colle-le avec l’image.')}`
      : '';
    if (outcome === FILE_SHARE_OUTCOMES.GALLERY) {
      return `${t('showcase.savedGallery', 'C’est enregistré dans ta galerie photo.')}${collable}`;
    }
    if (outcome === FILE_SHARE_OUTCOMES.DOWNLOADS) {
      return `${t('showcase.savedDownloads', 'C’est enregistré dans tes téléchargements.')}${collable}`;
    }
    // Feuille de partage (iOS) ou téléchargement navigateur (web) : le système a
    // déjà montré ce qu'il faisait, un message de plus serait du bruit.
    return null;
  };

  // L'erreur porte sa cause (`reason`, posé par shareLocalFile) : un refus de
  // permission n'est pas une panne de réseau, et le message générique enverrait
  // l'utilisateur regarder sa connexion pour rien.
  const downloadErrorText = (failure) => {
    if (failure?.reason === FILE_SHARE_FAILURES.PERMISSION_DENIED) {
      return t(
        'showcase.savePermissionError',
        'FoundClub n’a pas le droit d’enregistrer dans ton téléphone. '
        + 'Autorise-le dans les réglages, puis réessaie.',
      );
    }
    // AA08 : le serveur de rendu a refusé de fabriquer le fichier. L'aperçu
    // vient d'arriver par le MÊME réseau et le MÊME jeton — parler de connexion
    // ici enverrait l'utilisateur regarder son wifi pendant que la panne est
    // ailleurs. C'est le cas de l'A4, seul PDF de l'écran, et le seul format
    // que l'aperçu n'a jamais fabriqué avant qu'on le demande.
    if (failure?.reason === FILE_SHARE_FAILURES.RENDER_FAILED) {
      return t(
        'showcase.renderError',
        'L’affiche n’a pas pu être fabriquée par le serveur. Réessaie dans un instant.',
      );
    }
    if (failure?.reason === FILE_SHARE_FAILURES.SAVE_FAILED) {
      return t(
        'showcase.saveError',
        'L’enregistrement a échoué. Il reste peut-être trop peu de place sur ton téléphone.',
      );
    }
    return t(
      'showcase.downloadError',
      'Le téléchargement a échoué. Vérifie ta connexion et réessaie.',
    );
  };

  // useEventShowcase.shareFile journalise puis RE-LEVE l'erreur : sans ce catch, un
  // telechargement echoue en silence (spinner qui s'arrete, aucun retour a l'ecran).
  const runDownload = async (key, fn) => {
    setBusyAction(key);
    setDownloadError(null);
    setDownloadNotice(null);
    try {
      // Le web résout l'URL objet du téléchargement (une chaîne) : `outcome` y est
      // absent, et savedNotice retombe alors sur null. Rien à changer côté web.
      const result = await fn();
      setDownloadNotice(savedNotice(result?.outcome, result?.messageCopied));
    } catch (e) {
      setDownloadError(downloadErrorText(e));
    } finally {
      setBusyAction(null);
    }
  };

  // CE QU'ON ATTEND — et T04 (2026-08-17) a réduit la liste. Il restait deux
  // attentes muettes : fabriquer l'aperçu (`isLoading`) et retélécharger un
  // format (`busyAction`). Partager et « dans mes photos » ne retéléchargent
  // PLUS RIEN : ils partent avec les octets affichés (useEventShowcase, T04 ⑧).
  // Ce qui attend encore, ce sont les formats qui sont VRAIMENT d'autres images
  // — `story` (8,3 Mpx contre 5,8) et l'A4 en PDF — et l'écran le dit avec ses
  // mots, au lieu de laisser croire à une régénération inutile.
  const formats = templateConfig.formats || {};
  const waitingFormat = isLoading
    ? formats.preview
    : formats[BUSY_ACTION_FORMAT_SLOTS[busyAction]];
  const elapsedMs = useElapsedMs(waitingFormat);
  // ⛔ Aucune durée annoncée : la mesure du 2026-08-17 va de 3,1 s à 22,9 s selon
  // la charge du serveur (renderProgress.js). Seul le temps DÉJÀ écoulé est su.
  const longWait = isLongWait(elapsedMs);
  // Un AUTRE format que celui à l'écran : l'attente est légitime, on la nomme.
  const preparingOtherFormat = !isLoading && (busyAction === 'story' || busyAction === 'poster');

  // Tant qu'aucune affiche n'existe (première génération, ou génération en échec),
  // le bouton principal n'aurait rien à envoyer : il est GRISÉ, pas muet. En
  // régénération l'aperçu précédent est toujours là, donc il reste actif.
  const posterUnavailable = !previewUri && (isLoading || !!error);
  // AA08 — LA SORTIE, nommée UNE fois : la croix et « Plus tard » font le même
  // geste. La pile posée après publication est [EventDetails,
  // EventPublishedShowcase] (EventWizardRecap) ⇒ reculer découvre le détail,
  // déjà préchargé, de l'événement qu'on vient de créer.
  const closeScreen = () => navigation.goBack();
  const styles = makeStyles(Colors);

  // Champs texte éditables du gabarit courant (résolus depuis editableFields). Les
  // placeholders reflètent les défauts serveur (variante-dépendants — cf. visualModel.ts) :
  // un champ laissé vide est retiré côté client et le serveur retombe sur son défaut.
  const textFields = editableFields.map((field) => {
    const rawPlaceholder = typeof field.placeholder === 'function'
      ? field.placeholder(variant)
      : field.placeholder;
    return {
      key: field.key,
      label: t(field.labelKey, field.labelDefault),
      maxLength: field.maxLength,
      placeholder: rawPlaceholder ? t(rawPlaceholder.key, rawPlaceholder.default) : undefined,
    };
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={[styles.container, {
          paddingBottom: SCREEN_PADDING + insets.bottom,
          paddingTop: SCREEN_PADDING + insets.top,
        }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.subtitle}>{subtitleText}</Text>

        <View style={styles.variantRow}>
          {variants.map(({ key, label }) => {
            const active = key === variant;
            return (
              <TouchableOpacity
                accessibilityLabel={t('showcase.variantHint', 'Choisir le style {{label}}', { label })}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                activeOpacity={0.85}
                hitSlop={ApplicationStyle.hitSlop.min44From32}
                key={key}
                onPress={() => setVariant(key)}
                style={[styles.variantChip, active && styles.variantChipActive]}
              >
                <Text style={[styles.variantChipText, active && styles.variantChipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={[styles.preview, { width: previewWidth }]}>
          {previewUri ? (
            <Image resizeMode="contain" source={{ uri: previewUri }} style={styles.previewImage} />
          ) : null}
          {isLoading && !previewUri ? (
            // PREMIER rendu : squelette plein cadre, aux proportions de l'affiche —
            // l'utilisateur voit la FORME de ce qui arrive, pas un rond qui tourne.
            // « Réduire les animations » (réglage système) coupe le balayage :
            // SkeletonLoader rend alors les mêmes blocs, figés (isActive=false).
            <View style={styles.previewSkeleton} testID="showcase-skeleton">
              <SkeletonLoader isActive={!reduceMotion} wrapperStyle={[styles.skeletonBody]}>
                <View style={styles.skeletonBadge} />
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonTitleShort} />
                <View style={styles.skeletonMeta} />
                <View style={styles.skeletonQr} />
                <View style={styles.skeletonFooter} />
              </SkeletonLoader>
              <GenerationNotice
                color={Colors.primary500}
                longWait={longWait}
                reduceMotion={reduceMotion}
                styles={styles}
                t={t}
              />
            </View>
          ) : null}
          {isLoading && previewUri ? (
            // RÉGÉNÉRATION (changement de style ou de texte) : simple voile au-dessus
            // de l'aperçu existant → il ne disparaît pas (pas de clignotement).
            <View
              style={[styles.previewLoading, styles.previewOverlay]}
              testID="showcase-preview-veil"
            >
              <GenerationNotice
                color={Colors.primary500}
                longWait={longWait}
                reduceMotion={reduceMotion}
                styles={styles}
                t={t}
              />
            </View>
          ) : null}
          {!isLoading && !previewUri && error ? (
            <View style={styles.previewLoading}>
              <Text style={styles.previewErrorText}>
                {t('showcase.error', 'Le visuel n’a pas pu être généré.')}
              </Text>
              <TouchableOpacity
                accessibilityLabel={t('showcase.retry', 'Réessayer')}
                accessibilityRole="button"
                activeOpacity={0.85}
                hitSlop={ApplicationStyle.hitSlop.min44From32}
                onPress={retry}
                style={styles.retryBtn}
              >
                <Text style={styles.retryBtnText}>{t('showcase.retry', 'Réessayer')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.editor}>
          <TouchableOpacity
            accessibilityLabel={t('showcase.customize', 'Personnaliser le texte')}
            accessibilityRole="button"
            accessibilityState={{ expanded: editorOpen }}
            activeOpacity={0.85}
            hitSlop={ApplicationStyle.hitSlop.min44From40}
            onPress={() => setEditorOpen((open) => !open)}
            style={styles.editorToggle}
          >
            <Text style={styles.editorToggleText}>
              {t('showcase.customize', 'Personnaliser le texte')}
            </Text>
            <Text style={styles.editorToggleChevron}>{editorOpen ? '−' : '+'}</Text>
          </TouchableOpacity>

          {editorOpen ? (
            <View style={styles.editorBody}>
              <Text style={styles.editorHint}>
                {t(
                  'showcase.customizeHint',
                  'Modifie les textes avant de télécharger. Laisse vide pour garder le texte proposé.',
                )}
              </Text>
              {textFields.map((field) => (
                <View key={field.key} style={styles.editorField}>
                  <Input
                    density="compact"
                    label={field.label}
                    labelStyle={styles.editorInputLabel}
                    maxLength={field.maxLength}
                    onChangeText={(value) => setOverride(field.key, value)}
                    placeholder={field.placeholder}
                    style={styles.editorInput}
                    value={overrides[field.key] ?? ''}
                  />
                </View>
              ))}
              <TouchableOpacity
                accessibilityLabel={t('showcase.reset', 'Réinitialiser')}
                accessibilityRole="button"
                activeOpacity={0.85}
                hitSlop={ApplicationStyle.hitSlop.min44From32}
                onPress={resetOverrides}
                style={styles.resetBtn}
              >
                <Text style={styles.resetBtnText}>{t('showcase.reset', 'Réinitialiser')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {/* AA08 (2026-08-20) — LES TROIS FORMATS À PLAT, plus aucune feuille.
              L'ordre suit ce qu'on fait d'une affiche : on la montre (partager),
              on la poste (story), on l'imprime (A4).
              ⚠️ « Partager » garde son libellé ET son rang de geste principal :
              c'est le seul qu'Adel a demandé de garder tel quel. Sa ligne
              d'explication dit ce que la plateforme fait VRAIMENT (leçon L20 :
              sur Android le fichier est enregistré puis ouvert, pas envoyé). */}
          <ShowcaseAction
            busy={busyAction === 'share'}
            busyColor={Colors.primary900}
            disabled={busyAction != null || posterUnavailable}
            hint={saveThenOpen
              ? t(
                'showcase.saveHint',
                'Elle part dans ta galerie photo, telle que tu la vois. '
                + 'Tu choisis ensuite l’application qui l’ouvre.',
              )
              : t(
                'showcase.shareHint',
                'L’image part telle que tu la vois. Dans la fenêtre de partage, '
                + 'tu peux aussi l’enregistrer dans ton téléphone.',
              )}
            label={t('showcase.sharePoster', 'Partager l’affiche')}
            onPress={() => runDownload('share', () => shareVisual(shareMessage, chooserTitle))}
            styles={styles}
            variant="primary"
          />

          {/* Les deux AUTRES images — celles que la feuille cachait. Elles sont
              désormais à UN appui, dont l'affiche A4, seul PDF de l'écran. */}
          <ShowcaseAction
            busy={busyAction === 'story'}
            busyColor={Colors.primary500}
            disabled={busyAction != null || posterUnavailable}
            hint={saveThenOpen
              ? t(
                'showcase.storyHintSave',
                'Image verticale plein écran, enregistrée dans ta galerie, '
                + 'pour Instagram, WhatsApp ou Snap.',
              )
              : t(
                'showcase.storyHint',
                'Image verticale plein écran, pour Instagram, WhatsApp ou Snap.',
              )}
            label={t('showcase.story', 'Version story 9:16')}
            onPress={() => runDownload('story', () => downloadStory(chooserTitle))}
            styles={styles}
            variant="secondary"
          />
          <ShowcaseAction
            busy={busyAction === 'poster'}
            busyColor={Colors.primary500}
            disabled={busyAction != null || posterUnavailable}
            hint={saveThenOpen
              ? t(
                'showcase.posterHintSave',
                'Fichier PDF enregistré dans tes téléchargements, '
                + 'prêt pour l’imprimante du club.',
              )
              : t('showcase.posterHint', 'Fichier PDF, prêt pour l’imprimante du club.')}
            label={t('showcase.poster', 'Affiche A4 à imprimer')}
            onPress={() => runDownload('poster', () => downloadPoster(chooserTitle))}
            styles={styles}
            variant="secondary"
          />

          {/* T04 : ce repère ne s'allume plus que pour ce qui TRAVAILLE VRAIMENT.
              Partager et « dans mes photos » partent avec l'image affichée : le
              geste est immédiat, il n'a plus rien à annoncer. Restent story et
              A4, d'autres images — et là, l'écran dit qu'il les PRÉPARE, au lieu
              de laisser croire qu'il refait ce qu'on a déjà sous les yeux. Il
              vit ICI, sous les boutons, là où se lisent déjà le résultat
              (« C'est enregistré… ») et l'échec — et il disparaît avec
              `busyAction`, y compris quand ça rate. */}
          {preparingOtherFormat ? (
            <GenerationNotice
              color={Colors.primary500}
              longWait={longWait}
              otherFormat
              reduceMotion={reduceMotion}
              styles={styles}
              t={t}
            />
          ) : null}

          {downloadNotice ? (
            <Text accessibilityLiveRegion="polite" style={styles.downloadNoticeText}>
              {downloadNotice}
            </Text>
          ) : null}

          {downloadError ? (
            <Text
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={styles.downloadErrorText}
            >
              {downloadError}
            </Text>
          ) : null}

          {/* AA08 : le MÊME geste que la croix — une seule façon de sortir,
              deux endroits où la trouver. */}
          <TouchableOpacity
            accessibilityLabel={t('showcase.later', 'Plus tard')}
            accessibilityRole="button"
            hitSlop={ApplicationStyle.hitSlop.min44From32}
            onPress={closeScreen}
          >
            <Text style={styles.later}>{t('showcase.later', 'Plus tard')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* AA08 — LA SORTIE, ET ELLE EST HORS DU DÉFILEMENT.
          🧨 Le défaut d'Adel (« on ne peut pas quitter la page ») n'est PAS une
          sortie absente : « Plus tard » existait. Elle était INTROUVABLE.
          L'écran est enregistré `headerShown: false` (EventStack.js,
          PrivateNavigator.js) — donc aucune flèche de retour au-dessus de lui —
          et la seule sortie vivait tout en bas d'un ScrollView, sous l'aperçu,
          l'éditeur de textes et les boutons.
          ⇒ FRÈRE du ScrollView, jamais son contenu : elle ne défile pas.
          ⇒ JAMAIS grisée, contrairement aux trois gestes d'envoi : une affiche
            qui ne se fabrique pas ne doit pas retenir l'utilisateur dedans. */}
      <TouchableOpacity
        accessibilityLabel={t('showcase.close', 'Fermer')}
        accessibilityRole="button"
        activeOpacity={0.7}
        hitSlop={ApplicationStyle.hitSlop.min44From32}
        onPress={closeScreen}
        style={[styles.closeBtn, { right: SCREEN_PADDING, top: insets.top + 8 }]}
      >
        <Text style={styles.closeBtnText}>×</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

/**
 * Suit le réglage système « réduire les animations ».
 * Un balayage de squelette est décoratif : quand l'utilisateur demande moins de
 * mouvement, on garde la FORME (les blocs) et on coupe l'animation.
 * @returns {boolean} - true si le système demande de réduire les animations.
 */
const useReduceMotion = () => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .then((enabled) => { if (!cancelled) setReduceMotion(!!enabled); })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      (enabled) => setReduceMotion(!!enabled),
    );
    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  return reduceMotion;
};

/** Cadence du repère d'attente : 4 pas par seconde — assez fin pour ne pas saccader. */
const PROGRESS_TICK_MS = 250;

/**
 * Quel format chaque geste retélécharge. Les clés sont celles de `busyAction`,
 * les valeurs celles de `templateConfig.formats` (useEventShowcase.js) — pas des
 * formats serveur en dur, sinon un gabarit qui change ses formats mentirait ici.
 */
const BUSY_ACTION_FORMAT_SLOTS = {
  poster: 'poster', share: 'preview', story: 'story',
};

/**
 * Millisecondes écoulées depuis le début de l'attente en cours.
 * `activeKey` dit CE QU'ON ATTEND (le format demandé) : il change, le compteur
 * repart de zéro ; il devient vide, tout s'arrête — aucun minuteur ne survit à
 * l'attente qu'il mesurait.
 * @param {string} [activeKey] - Format attendu, ou rien si l'écran n'attend pas.
 * @returns {number}
 */
const useElapsedMs = (activeKey) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    setElapsedMs(0);
    if (!activeKey) return undefined;
    const startedAt = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), PROGRESS_TICK_MS);
    return () => clearInterval(id);
  }, [activeKey]);

  return elapsedMs;
};

/**
 * LE REPÈRE D'ATTENTE — il dit qu'on travaille, il ne dit PAS combien de temps.
 *
 * S07 (2026-08-16) y annonçait « encore N s environ ». T04 (2026-08-17) a mesuré :
 * de 3,1 s à 22,9 s selon la charge du serveur (les chiffres sont dans
 * `renderProgress.js`). Adel, recette du 17/08 : « ça finit TOUJOURS avec le
 * message [de dépassement] ». Un garde-fou qui se déclenche à tous les coups
 * n'est plus un garde-fou, c'est le comportement normal — et un compteur qui se
 * trompe toujours apprend à ne plus être lu.
 *
 * ⛔ CE QU'IL N'Y A PLUS, ET IL NE FAUT PAS LE REMETTRE :
 *   · aucun compte à rebours — on ne connaît pas la durée, donc on ne l'annonce
 *     pas ;
 *   · aucune barre qui se remplit — une barre qui avance pendant qu'on ne sait
 *     rien de l'avancement est une fausse progression, exactement le défaut
 *     qu'on répare ailleurs. `ActivityIndicator` (le repère de toute l'app) ne
 *     promet rien : il tourne tant que ça travaille.
 * ✅ CE QUI RESTE VRAI, et se mesure :
 *   · le temps DÉJÀ écoulé — au-delà du pire cas observé, la phrase change ;
 *   · « réduire les animations » retire le mouvement et GARDE le texte : c'est
 *     l'information qui compte.
 * @param {object} props
 * @param {string} props.color - Encre de l'indicateur (le thème vit dans l'écran,
 *   pas ici : même motif que `ShowcaseAction.busyColor`).
 * @param {boolean} props.longWait - L'attente a dépassé tout ce qui a été mesuré.
 * @param {boolean} [props.otherFormat] - On prépare une AUTRE image que l'aperçu.
 * @param {boolean} props.reduceMotion - Réglage système « réduire les animations ».
 * @param {Record<string, object>} props.styles
 * @param {(key: string, fallback: string, vars?: object) => string} props.t
 * @returns {import('react').ReactElement}
 */
function GenerationNotice({
  color, longWait, otherFormat, reduceMotion, styles, t,
}) {
  let message;
  if (longWait) {
    message = t(
      'showcase.generatingLonger',
      'Ton affiche se fabrique toujours — c’est plus long que d’habitude.',
    );
  } else if (otherFormat) {
    // Ici l'attente est LÉGITIME : ce format est une autre image que celle à
    // l'écran. Le dire évite de faire passer un vrai travail pour un bug.
    message = t(
      'showcase.preparingOtherFormat',
      'On prépare la version à partager — c’est une autre image que celle à l’écran.',
    );
  } else {
    message = t('showcase.generating', 'Ton affiche se fabrique…');
  }

  return (
    <View style={styles.progressBlock} testID="showcase-working">
      {reduceMotion ? null : <ActivityIndicator color={color} size="small" />}
      {/* La zone vive n'est ARMÉE qu'au dépassement : c'est le seul moment où le
          texte change, et donc le seul qui mérite d'interrompre un lecteur
          d'écran. Ainsi, une seule annonce — celle qui compte. */}
      <Text
        accessibilityLiveRegion={longWait ? 'polite' : 'none'}
        style={styles.progressText}
      >
        {message}
      </Text>
    </View>
  );
}

/** Clés de style par niveau de hiérarchie : un seul `primary` par écran. */
const ACTION_STYLE_KEYS = {
  ghost: { button: 'ghostBtn', hint: 'ghostBtnHint', label: 'ghostBtnText' },
  primary: { button: 'primaryBtn', hint: 'primaryBtnHint', label: 'primaryBtnText' },
  secondary: { button: 'secondaryBtn', hint: 'secondaryBtnHint', label: 'secondaryBtnText' },
};

/**
 * Bouton d'action du showcase : un titre qui dit CE QU'ON OBTIENT, et une ligne
 * d'explication juste dessous (la ligne part aussi en accessibilityHint).
 * @param {object} props
 * @param {boolean} [props.busy] - Action en cours : indicateur à la place du texte.
 * @param {string} props.busyColor - Couleur de l'indicateur, lisible sur ce fond.
 * @param {boolean} [props.disabled]
 * @param {string} props.hint - Ce que le bouton produit, en une phrase.
 * @param {string} props.label
 * @param {() => void} props.onPress
 * @param {Record<string, object>} props.styles
 * @param {'ghost'|'primary'|'secondary'} [props.variant]
 * @returns {import('react').ReactElement}
 */
function ShowcaseAction({
  busy, busyColor, disabled, hint, label, onPress, styles, variant = 'ghost',
}) {
  const styleKeys = ACTION_STYLE_KEYS[variant] || ACTION_STYLE_KEYS.ghost;
  return (
    <TouchableOpacity
      accessibilityHint={hint}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: !!busy, disabled: !!disabled }}
      activeOpacity={0.85}
      disabled={!!disabled}
      onPress={onPress}
      style={[styles[styleKeys.button], disabled ? styles.btnDisabled : null]}
    >
      {busy ? <ActivityIndicator color={busyColor} /> : (
        <>
          <Text style={styles[styleKeys.label]}>{label}</Text>
          <Text style={styles[styleKeys.hint]}>{hint}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

/**
 * Marge de l'écran. Nommée parce qu'elle est utilisée DEUX fois : dans la feuille
 * de style, et additionnée aux retraits système (`insets`) au rendu.
 */
const SCREEN_PADDING = 20;

const makeStyles = (Colors) => StyleSheet.create({
  actions: { gap: 10 },
  // Opacité 0.5 : la cible reste lisible mais visiblement hors service (Material).
  btnDisabled: { opacity: 0.5 },
  // AA08 — la croix. Posée en absolu SUR le contenu (elle est frère du
  // ScrollView) ; `top` et `right` sont donnés au rendu, car `top` dépend du
  // retrait système de l'appareil. Pastille sombre translucide : l'aperçu de
  // l'affiche passe dessous et un × nu s'y perdrait selon la photo du club.
  closeBtn: {
    alignItems: 'center',
    backgroundColor: Colors.primary800,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    width: 36,
    zIndex: 2,
  },
  // neutral00 sur primary800 : ~14:1 (AAA). Hauteur de ligne alignée sur la
  // pastille pour que le × soit centré et non posé sur sa ligne de base.
  closeBtnText: {
    color: Colors.neutral00, fontSize: 24, lineHeight: 28, textAlign: 'center',
  },
  container: {
    backgroundColor: Colors.primary900, flexGrow: 1, gap: 16, padding: SCREEN_PADDING,
  },
  // error300 sur fond sombre primary900 : ~8:1 (AA).
  downloadErrorText: {
    color: Colors.error300, fontSize: 13, paddingHorizontal: 4, textAlign: 'center',
  },
  // success200 sur fond sombre primary900 : ~13:1 (AAA).
  downloadNoticeText: {
    color: Colors.success200, fontSize: 13, paddingHorizontal: 4, textAlign: 'center',
  },
  editor: { gap: 8 },
  editorBody: { gap: 14, marginTop: 4 },
  editorField: {
    backgroundColor: Colors.primary800,
    borderColor: `${Colors.primary500}3D`,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  editorHint: { color: Colors.neutral300, fontSize: 13, lineHeight: 18 },
  editorInput: { color: Colors.neutral00 },
  editorInputLabel: { color: Colors.neutral300 },
  editorToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  // Glyphe +/- porteur de l'etat plie/deplie : primary500 sur fond sombre primary900 = ~7,3:1.
  editorToggleChevron: { color: Colors.primary500, fontSize: 22, fontWeight: '700' },
  editorToggleText: { color: Colors.primary500, fontSize: 16, fontWeight: '700' },
  flex: { flex: 1 },
  ghostBtn: {
    alignItems: 'center',
    backgroundColor: Colors.primary800,
    borderRadius: 12,
    gap: 2,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  // Sur fond primary800 : neutral300 = ~7:1.
  ghostBtnHint: {
    color: Colors.neutral300, fontSize: 12, lineHeight: 16, textAlign: 'center',
  },
  ghostBtnText: { color: Colors.primary500, fontSize: 15, fontWeight: '600' },
  // Sur fond sombre primary900 : neutral300 = ~8,4:1.
  later: { color: Colors.neutral300, paddingVertical: 8, textAlign: 'center' },
  preview: {
    alignItems: 'center',
    alignSelf: 'center',
    aspectRatio: 4 / 5,
    backgroundColor: Colors.primary800,
    borderRadius: 16,
    justifyContent: 'center',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  previewErrorText: {
    color: Colors.neutral300, fontSize: 13, paddingHorizontal: 24, textAlign: 'center',
  },
  previewImage: { height: '100%', width: '100%' },
  previewLoading: { alignItems: 'center', gap: 8 },
  previewOverlay: {
    backgroundColor: `${Colors.primary900}CC`,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  previewSkeleton: {
    alignItems: 'center',
    bottom: 0,
    gap: 12,
    justifyContent: 'center',
    left: 0,
    padding: 20,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  primaryBtn: {
    alignItems: 'center',
    backgroundColor: Colors.primary500,
    borderRadius: 12,
    gap: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  // Encre unique sur fond primary500 (THEME.md) : primary900 = 7,96:1.
  primaryBtnHint: {
    color: Colors.primary900, fontSize: 12, lineHeight: 16, opacity: 0.8, textAlign: 'center',
  },
  primaryBtnText: { color: Colors.primary900, fontSize: 16, fontWeight: '700' },
  progressBlock: {
    alignItems: 'center', gap: 8, paddingHorizontal: 16, width: '100%',
  },
  // Sur fond primary800 (cadre d'apercu) comme sur primary900 (bas d'ecran) :
  // neutral300 reste au-dessus de 6,7:1.
  progressText: {
    color: Colors.neutral300, fontSize: 13, lineHeight: 18, textAlign: 'center',
  },
  resetBtn: { alignItems: 'center', paddingVertical: 8 },
  // Sur fond sombre primary900 : primary500 = ~7,3:1.
  resetBtnText: { color: Colors.primary500, fontWeight: '600' },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  // Sur fond primary800 (cadre d'apercu sombre) : primary500 = ~5,9:1.
  retryBtnText: { color: Colors.primary500, fontWeight: '600' },
  secondaryBtn: {
    // Lisere du bouton : primary500 sur fond sombre primary900 = ~7,3:1 (au-dessus du seuil 3:1).
    alignItems: 'center',
    borderColor: Colors.primary500,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  // Sur fond sombre primary900 : neutral300 = ~8,4:1.
  secondaryBtnHint: {
    color: Colors.neutral300, fontSize: 12, lineHeight: 16, textAlign: 'center',
  },
  // Sur fond sombre primary900 : primary500 = ~7,3:1.
  secondaryBtnText: { color: Colors.primary500, fontWeight: '700' },
  sheet: { gap: 12, paddingBottom: 8 },
  // Sur le fond de feuille (primary700, BottomModal.js l.261) : neutral00 = maximal.
  sheetTitle: {
    color: Colors.neutral00, fontSize: 18, fontWeight: '800', marginBottom: 4,
  },
  // Ossature de l'affiche : blocs primary700 sur le cadre primary800 — visibles
  // meme fige, quand « reduire les animations » coupe le balayage.
  skeletonBadge: {
    backgroundColor: Colors.primary700, borderRadius: 999, height: 44, width: 44,
  },
  skeletonBody: { alignItems: 'center', gap: 10, width: '100%' },
  skeletonFooter: {
    backgroundColor: Colors.primary700, borderRadius: 5, height: 9, width: '40%',
  },
  skeletonMeta: {
    backgroundColor: Colors.primary700, borderRadius: 5, height: 10, width: '64%',
  },
  skeletonQr: {
    backgroundColor: Colors.primary700, borderRadius: 8, height: 62, marginTop: 6, width: 62,
  },
  skeletonTitle: {
    backgroundColor: Colors.primary700, borderRadius: 6, height: 16, width: '78%',
  },
  skeletonTitleShort: {
    backgroundColor: Colors.primary700, borderRadius: 6, height: 16, width: '52%',
  },
  subtitle: { color: Colors.neutral300, fontSize: 15 },
  title: { color: Colors.neutral00, fontSize: 24, fontWeight: '800' },
  variantChip: {
    borderColor: Colors.neutral700,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  variantChipActive: {
    backgroundColor: `${Colors.primary500}24`,
    borderColor: Colors.primary500,
  },
  variantChipText: { color: Colors.neutral300, fontSize: 13, fontWeight: '600' },
  // Puce active (fond primary500 a ~14 % sur sombre) : primary500 = lisible (~6:1).
  variantChipTextActive: { color: Colors.primary500, fontWeight: '700' },
  variantRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12,
  },
});
