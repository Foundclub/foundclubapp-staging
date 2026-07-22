// @ts-nocheck
/**
 * app/src/views/event/EventPublishedShowcase.js
 *
 * Écran « Ton événement est en ligne, fais-le voir » affiché juste après publication
 * d'une détection / séance d'essai (câblé dans EventWizardRecap — voir diffs/app-EventWizardRecap.patch).
 *
 * Réutilise les patterns EXISTANTS de l'app :
 *   - useTheme (Colors.primary500 / Colors.primary700) — comme ShareEventModal
 *   - ShareEventModal (envoi dans une conversation) + SharePlatform (partage natif)
 *   - buildShareMessageWithUrl / buildPublicEventUrl (@/utils/shareLinks)
 *   - celebrate() pour rejouer la célébration de création
 * L'aperçu + les téléchargements passent par useEventShowcase (endpoint render serveur).
 *
 * NOTE : imports `@/...` résolus dans app/. Non exécuté ici (câblage app).
 */

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useVisualShowcase, { SHOWCASE_TEMPLATES } from '@/domains/visuals/useEventShowcase';
import useTheme from '@/theme/themeContext';

import Input from '@/components/molecules/input/Input';
import ShareEventModal from '@/components/organisms/shareEventModal/ShareEventModal';

import { celebrate } from '@/services/celebrations/celebrationRuntime';

import { buildPublicEventUrl, buildShareMessageWithUrl } from '@/utils/shareLinks';

import SharePlatform from '@/platform/share';

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
  // Partage « dans une conversation » (ShareEventModal) réservé à l'événement : pas
  // d'objet chat-partageable pour club/annonce en V1. Défaut = event ⇒ true.
  const chatShareEnabled = params.chatShareEnabled ?? (subjectType === 'event');

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(null); // 'story' | 'poster' | null
  const [editorOpen, setEditorOpen] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const {
    downloadPoster, downloadStory, error, event, isLoading, overrides,
    previewUri, resetOverrides, retry, setOverride, setVariant, variant, variants,
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

  const onNativeShare = async () => {
    if (!shareUrl) return;
    const message = buildShareMessageWithUrl({
      intro: shareIntroParam || t(texts.shareIntro.key, texts.shareIntro.default),
      linkLabel: shareLinkLabelParam || t(texts.shareLinkLabel.key, texts.shareLinkLabel.default),
      url: shareUrl,
    });
    await SharePlatform.share({ message, url: shareUrl });
  };

  // useEventShowcase.shareFile journalise puis RE-LEVE l'erreur : sans ce catch, un
  // telechargement echoue en silence (spinner qui s'arrete, aucun retour a l'ecran).
  const runDownload = async (key, fn) => {
    setBusyAction(key);
    setDownloadError(null);
    try {
      await fn();
    } catch (e) {
      setDownloadError(t(
        'showcase.downloadError',
        'Le téléchargement a échoué. Vérifie ta connexion et réessaie.',
      ));
    } finally {
      setBusyAction(null);
    }
  };

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
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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

        <View style={styles.preview}>
          {previewUri ? (
            <Image resizeMode="contain" source={{ uri: previewUri }} style={styles.previewImage} />
          ) : null}
          {isLoading ? (
            // Premier rendu : spinner plein cadre. Régénérations (édition/style) : simple
            // overlay au-dessus de l'aperçu existant → il ne disparaît pas (pas de clignotement).
            <View style={[styles.previewLoading, previewUri ? styles.previewOverlay : null]}>
              <ActivityIndicator color={Colors.primary500} />
              {!previewUri ? (
                <Text style={styles.previewLoadingText}>
                  {t('showcase.generating', 'Génération du visuel…')}
                </Text>
              ) : null}
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
          <TouchableOpacity
            accessibilityLabel={t('showcase.share', 'Partager')}
            accessibilityRole="button"
            activeOpacity={0.85}
            onPress={onNativeShare}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>{t('showcase.share', 'Partager')}</Text>
          </TouchableOpacity>

          {chatShareEnabled ? (
            <TouchableOpacity
              accessibilityLabel={t('showcase.sendInChat', 'Envoyer dans une conversation')}
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => setShareModalOpen(true)}
              style={styles.secondaryBtn}
            >
              <Text style={styles.secondaryBtnText}>
                {t('showcase.sendInChat', 'Envoyer dans une conversation')}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.row}>
            <TouchableOpacity
              accessibilityLabel={t('showcase.story', 'Story / Post')}
              accessibilityRole="button"
              accessibilityState={{ busy: busyAction === 'story', disabled: busyAction != null }}
              disabled={busyAction != null}
              onPress={() => runDownload('story', downloadStory)}
              style={styles.ghostBtn}
            >
              {busyAction === 'story'
                ? <ActivityIndicator color={Colors.primary700} />
                : <Text style={styles.ghostBtnText}>{t('showcase.story', 'Story / Post')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityLabel={t('showcase.poster', 'Affiche à imprimer')}
              accessibilityRole="button"
              accessibilityState={{ busy: busyAction === 'poster', disabled: busyAction != null }}
              disabled={busyAction != null}
              onPress={() => runDownload('poster', downloadPoster)}
              style={styles.ghostBtn}
            >
              {busyAction === 'poster'
                ? <ActivityIndicator color={Colors.primary700} />
                : <Text style={styles.ghostBtnText}>{t('showcase.poster', 'Affiche à imprimer')}</Text>}
            </TouchableOpacity>
          </View>

          {downloadError ? (
            <Text
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={styles.downloadErrorText}
            >
              {downloadError}
            </Text>
          ) : null}

          <TouchableOpacity
            accessibilityLabel={t('showcase.later', 'Plus tard')}
            accessibilityRole="button"
            hitSlop={ApplicationStyle.hitSlop.min44From32}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.later}>{t('showcase.later', 'Plus tard')}</Text>
          </TouchableOpacity>
        </View>

        {chatShareEnabled ? (
          <ShareEventModal
            event={event}
            isVisible={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            onSelectChat={() => setShareModalOpen(false)}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (Colors) => StyleSheet.create({
  actions: { gap: 10 },
  container: {
    backgroundColor: Colors.primary900, flexGrow: 1, gap: 16, padding: 20,
  },
  // error300 sur fond sombre primary900 : ~8:1 (AA).
  downloadErrorText: {
    color: Colors.error300, fontSize: 13, paddingHorizontal: 4, textAlign: 'center',
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
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 12,
  },
  ghostBtnText: { color: Colors.primary500, fontWeight: '600' },
  // Sur fond sombre primary900 : neutral300 = ~8,4:1.
  later: { color: Colors.neutral300, paddingVertical: 8, textAlign: 'center' },
  preview: {
    alignItems: 'center',
    aspectRatio: 4 / 5,
    backgroundColor: Colors.primary800,
    borderRadius: 16,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewErrorText: {
    color: Colors.neutral300, fontSize: 13, paddingHorizontal: 24, textAlign: 'center',
  },
  previewImage: { height: '100%', width: '100%' },
  previewLoading: { alignItems: 'center', gap: 8 },
  // Sur fond primary800 (cadre d'apercu sombre) : neutral300 = ~6,7:1.
  previewLoadingText: { color: Colors.neutral300, fontSize: 13 },
  previewOverlay: {
    backgroundColor: `${Colors.primary900}CC`,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  primaryBtn: {
    alignItems: 'center', backgroundColor: Colors.primary500, borderRadius: 12, paddingVertical: 14,
  },
  // Encre unique sur fond primary500 (THEME.md) : primary900 = 7,96:1.
  primaryBtnText: { color: Colors.primary900, fontSize: 16, fontWeight: '700' },
  resetBtn: { alignItems: 'center', paddingVertical: 8 },
  // Sur fond sombre primary900 : primary500 = ~7,3:1.
  resetBtnText: { color: Colors.primary500, fontWeight: '600' },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  // Sur fond primary800 (cadre d'apercu sombre) : primary500 = ~5,9:1.
  retryBtnText: { color: Colors.primary500, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    // Lisere du bouton : primary500 sur fond sombre primary900 = ~7,3:1 (au-dessus du seuil 3:1).
    alignItems: 'center', borderColor: Colors.primary500, borderRadius: 12, borderWidth: 1, paddingVertical: 12,
  },
  // Sur fond sombre primary900 : primary500 = ~7,3:1.
  secondaryBtnText: { color: Colors.primary500, fontWeight: '700' },
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
