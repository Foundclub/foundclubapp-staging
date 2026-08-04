// @ts-nocheck
/**
 * app/src/domains/visuals/useEventShowcase.js
 *
 * Hook de l'écran « Ton événement est en ligne, fais-le voir ».
 * Encapsule les appels au moteur de visuels serveur (POST /api/visual-assets/render) :
 *   - previewUri : aperçu PNG (template post-story-detection, format post 4:5) en data URI
 *   - downloadPoster / downloadStory : téléchargent le fichier (PDF A4 / PNG story) puis
 *     déclenchent le partage natif (réutilise SharePlatform).
 *
 * Réutilise les patterns EXISTANTS de l'app :
 *   - `@/services/client` (axios, Authorization auto)  — pour le rendu base64 léger
 *   - `react-native-blob-util` (déjà utilisé par eventService) pour écrire le fichier
 *   - `@/platform/share` pour le partage natif
 *   - `@/services/event/eventService` (getEventById) pour alimenter ShareEventModal
 *
 * NOTE : les imports `@/...` sont résolus dans app/. Fichier non exécuté ici (câblage app).
 */

import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import client from '@/services/client';

import { createLogger } from '@/utils/logger/logger';

import { downloadAndShareRender, fetchRenderBase64 } from '@/platform/visualRender';

const logger = createLogger('visual-showcase');

// Référence vide partagée pour l'état initial des surcharges : `overrides` et son miroir
// temporisé démarrent sur le MÊME objet, si bien que le premier tick du debounce appelle
// setDebouncedOverrides avec la même référence — React court-circuite (pas de re-rendu,
// donc pas de re-génération d'aperçu inutile juste après le montage).
const EMPTY_OVERRIDES = {};

/**
 * Nettoie la map de surcharges texte : retire les valeurs vides / espaces uniquement
 * (le serveur retomberait de toute façon sur son défaut) pour éviter des cache-miss inutiles.
 * @param {Record<string, string>} [overrides]
 * @returns {Record<string, string>}
 */
const cleanOverrides = (overrides) => Object.keys(overrides || {}).reduce((acc, key) => {
  const value = typeof overrides[key] === 'string' ? overrides[key].trim() : overrides[key];
  if (value) acc[key] = value;
  return acc;
}, {});

// Les appels de rendu (aperçu base64) et le téléchargement/partage du visuel
// sont délégués à la couche plateforme `@/platform/visualRender` :
//   - natif : react-native-blob-util (fetch + écriture cache) + partage système ;
//   - web   : fetch() du navigateur (Blob) + <a download>.
// Voir visualRender.native.js / visualRender.web.js.

/** Formats de rendu (identiques pour les 3 gabarits) : aperçu post 4:5, story 9:16, affiche A4. */
const DEFAULT_FORMATS = { poster: 'a4', preview: 'post', story: 'story' };

/** Styles (variantes) du gabarit détection — libellés design validés. */
export const DETECTION_VARIANTS = [
  { key: 'projecteurs', label: 'Projecteurs' },
  { key: 'laissez-passer', label: 'Laissez-passer' },
  { key: 'decouverte', label: 'Découverte' },
];

/** Styles (variantes) du gabarit affiche-club « Rejoindre » — libellés design validés. */
export const CLUB_VARIANTS = [
  { key: 'ecusson', label: 'Écusson' },
  { key: 'famille', label: 'Famille' },
];

/**
 * Styles (variantes) du gabarit avis-de-recherche — 5 slugs serveur
 * (VISUAL_TEMPLATES['avis-de-recherche'].variants, visualModel.ts).
 */
export const RECHERCHE_VARIANTS = [
  { key: 'far-west', label: 'Far-west' },
  { key: 'viseur', label: 'Viseur' },
  { key: 'club-recherche', label: 'Club recherché' },
  { key: 'western', label: 'Western' },
  { key: 'club-recherche-western', label: 'Club recherché — Western' },
];

/**
 * Champs texte éditables du gabarit détection (clés = content de visualModel).
 * `placeholder` peut être une fonction (variant) => { key, default } quand le défaut
 * serveur dépend de la variante (ex. « decouverte »).
 */
const DETECTION_FIELDS = [
  {
    key: 'titre',
    labelDefault: 'Titre',
    labelKey: 'showcase.fieldTitre',
    maxLength: 80,
    placeholder: (variant) => (variant === 'decouverte'
      ? { default: 'Viens essayer,', key: 'showcase.placeholderTitreDecouverte' }
      : { default: 'Viens montrer', key: 'showcase.placeholderTitre' }),
  },
  {
    key: 'titreAccent',
    labelDefault: 'Accroche',
    labelKey: 'showcase.fieldTitreAccent',
    maxLength: 80,
    placeholder: (variant) => (variant === 'decouverte'
      ? { default: 'tu vas aimer.', key: 'showcase.placeholderTitreAccentDecouverte' }
      : { default: 'ce que tu vaux.', key: 'showcase.placeholderTitreAccent' }),
  },
  {
    key: 'qrLabel',
    labelDefault: 'Texte sous le QR code',
    labelKey: 'showcase.fieldQrLabel',
    maxLength: 60,
    placeholder: (variant) => (variant === 'decouverte'
      ? { default: 'Scanne pour essayer', key: 'showcase.placeholderQrLabelDecouverte' }
      : { default: 'Scanne pour participer', key: 'showcase.placeholderQrLabel' }),
  },
  {
    key: 'equipe', labelDefault: 'Équipe', labelKey: 'showcase.fieldEquipe', maxLength: 80,
  },
  {
    key: 'niveau', labelDefault: 'Niveau', labelKey: 'showcase.fieldNiveau', maxLength: 80,
  },
  {
    key: 'lieu', labelDefault: 'Lieu', labelKey: 'showcase.fieldLieu', maxLength: 80,
  },
];

/** Champs texte éditables du gabarit affiche-club « Rejoindre » (clés content visualModel). */
const CLUB_FIELDS = [
  {
    key: 'titre',
    labelDefault: 'Titre',
    labelKey: 'showcase.club.fieldTitre',
    maxLength: 80,
    placeholder: { default: 'Ici, on joue', key: 'showcase.club.placeholderTitre' },
  },
  {
    key: 'titreAccent',
    labelDefault: 'Accroche',
    labelKey: 'showcase.club.fieldTitreAccent',
    maxLength: 80,
    placeholder: { default: 'ensemble.', key: 'showcase.club.placeholderTitreAccent' },
  },
  {
    key: 'sports',
    labelDefault: 'Sports (séparés par ·)',
    labelKey: 'showcase.club.fieldSports',
    maxLength: 120,
    placeholder: { default: 'Football · Rugby · Handball', key: 'showcase.club.placeholderSports' },
  },
  {
    key: 'qrLabel',
    labelDefault: 'Texte sous le QR code',
    labelKey: 'showcase.club.fieldQrLabel',
    maxLength: 60,
    placeholder: { default: 'Scanne pour nous rejoindre', key: 'showcase.club.placeholderQrLabel' },
  },
];

/** Champs texte éditables du gabarit avis-de-recherche (clés content visualModel). */
const RECHERCHE_FIELDS = [
  {
    key: 'cible',
    labelDefault: 'Cible',
    labelKey: 'showcase.ad.fieldCible',
    maxLength: 40,
    placeholder: (variant) => (variant === 'club-recherche' || variant === 'club-recherche-western'
      ? { default: 'Ce club est', key: 'showcase.ad.placeholderCibleClub' }
      : { default: 'Joueur·se', key: 'showcase.ad.placeholderCible' }),
  },
  {
    key: 'mention',
    labelDefault: 'Mention',
    labelKey: 'showcase.ad.fieldMention',
    maxLength: 40,
    placeholder: (variant) => (variant === 'club-recherche' || variant === 'club-recherche-western'
      ? { default: 'recherché.', key: 'showcase.ad.placeholderMentionClub' }
      : { default: 'recherché·e', key: 'showcase.ad.placeholderMention' }),
  },
  {
    key: 'poste',
    labelDefault: 'Poste',
    labelKey: 'showcase.ad.fieldPoste',
    maxLength: 60,
    placeholder: { default: 'Ailier · Meneur', key: 'showcase.ad.placeholderPoste' },
  },
  {
    key: 'niveau',
    labelDefault: 'Niveau',
    labelKey: 'showcase.ad.fieldNiveau',
    maxLength: 60,
    placeholder: { default: 'Tous niveaux', key: 'showcase.ad.placeholderNiveau' },
  },
  {
    key: 'recompense',
    labelDefault: 'Accroche',
    labelKey: 'showcase.ad.fieldRecompense',
    maxLength: 120,
    placeholder: (variant) => (variant === 'club-recherche' || variant === 'club-recherche-western'
      ? { default: 'Ton club, enfin géré en un seul endroit.', key: 'showcase.ad.placeholderRecompenseClub' }
      : { default: 'Une équipe qui compte sur toi, chaque week-end.', key: 'showcase.ad.placeholderRecompense' }),
  },
  {
    key: 'qrLabel',
    labelDefault: 'Texte sous le QR code',
    labelKey: 'showcase.ad.fieldQrLabel',
    maxLength: 60,
    placeholder: (variant) => (variant === 'club-recherche' || variant === 'club-recherche-western'
      ? { default: "Scanne si c'est ton club", key: 'showcase.ad.placeholderQrLabelClub' }
      : { default: "Scanne si c'est toi", key: 'showcase.ad.placeholderQrLabel' }),
  },
];

/**
 * Catalogue des gabarits d'affiche servis par le showcase généralisé.
 * Clé = slug de template serveur. Chaque entrée résout le sujet, les variantes
 * (chips de style), les champs éditables, les formats de rendu et les textes d'écran
 * (libellés FR par défaut). DÉFAUT du showcase = 'affiche-detection' (comportement event).
 */
export const SHOWCASE_TEMPLATES = {
  'affiche-club': {
    editableFields: CLUB_FIELDS,
    formats: DEFAULT_FORMATS,
    subjectType: 'club',
    texts: {
      shareIntro: { default: 'Viens nous rejoindre au club !', key: 'showcase.club.shareIntro' },
      shareLinkLabel: { default: 'Voir le club', key: 'showcase.club.shareLabel' },
      subtitle: { default: 'Fais-la voir. Plus elle est vue, plus on te rejoint.', key: 'showcase.club.subtitle' },
      title: { default: 'Ton affiche club est prête', key: 'showcase.club.title' },
    },
    variants: CLUB_VARIANTS,
  },
  'affiche-detection': {
    editableFields: DETECTION_FIELDS,
    formats: DEFAULT_FORMATS,
    subjectType: 'event',
    texts: {
      shareIntro: { default: 'Viens participer à notre détection / séance d’essai !', key: 'showcase.shareIntro' },
      shareLinkLabel: { default: 'Voir l’événement', key: 'showcase.shareLabel' },
      subtitle: { default: 'Fais-le voir. Plus il est vu, plus tu remplis.', key: 'showcase.subtitle' },
      title: { default: 'Ton événement est en ligne', key: 'showcase.title' },
    },
    variants: DETECTION_VARIANTS,
  },
  'avis-de-recherche': {
    editableFields: RECHERCHE_FIELDS,
    formats: DEFAULT_FORMATS,
    subjectType: 'recruitment-ad',
    texts: {
      shareIntro: { default: 'On recrute, rejoins l’équipe !', key: 'showcase.ad.shareIntro' },
      shareLinkLabel: { default: 'Voir l’annonce', key: 'showcase.ad.shareLabel' },
      subtitle: { default: 'Fais-le voir. Plus il est vu, plus vite tu trouves.', key: 'showcase.ad.subtitle' },
      title: { default: 'Ton avis de recherche est prêt', key: 'showcase.ad.title' },
    },
    variants: RECHERCHE_VARIANTS,
  },
};

/**
 * Hook du showcase d'affiches, généralisé pour les 3 sujets (event / club / recruitment-ad).
 * DÉFAUTS = comportement événement actuel (subjectType 'event', template 'affiche-detection',
 * variantes DETECTION_VARIANTS) ⇒ le flux post-publication événement reste identique.
 * @param {{
 *   subjectType?: string,
 *   subjectId?: string|number,
 *   eventId?: string|number,
 *   event?: object,
 *   template?: string,
 *   variants?: Array<{ key: string, label: string }>,
 * }} params
 */
export default function useVisualShowcase({
  event: initialEvent,
  eventId,
  subjectId,
  subjectType = 'event',
  template = 'affiche-detection',
  variants,
} = {}) {
  // Config dérivée du gabarit (source de vérité = catalogue), surchargée par les params.
  const templateConfig = SHOWCASE_TEMPLATES[template] || SHOWCASE_TEMPLATES['affiche-detection'];
  const variantCatalog = variants || templateConfig.variants || DETECTION_VARIANTS;
  const { poster: posterFormat, preview: previewFormat, story: storyFormat } = templateConfig.formats
    || DEFAULT_FORMATS;
  // subjectId retombe sur eventId (retro-compat du flux événement qui ne passe qu'eventId).
  const resolvedSubjectId = subjectId ?? eventId;

  const [previewUri, setPreviewUri] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [event, setEvent] = useState(initialEvent || null);
  // Style (variante design) choisi par l'utilisateur — première variante du gabarit.
  const [variant, setVariant] = useState((variantCatalog[0] || {}).key);
  // Surcharges texte de l'atelier éditeur (édition libre des champs de l'affiche).
  // `overrides` = valeur vive (utilisée pour les téléchargements) ;
  // `debouncedOverrides` = miroir temporisé (utilisé pour re-générer l'aperçu).
  const [overrides, setOverrides] = useState(EMPTY_OVERRIDES);
  const [debouncedOverrides, setDebouncedOverrides] = useState(EMPTY_OVERRIDES);
  // Jeton de re-tentative : incrémenté par retry() pour relancer l'effet d'aperçu
  // après un échec (hors-ligne / timeout serveur) sans toucher aux autres entrées.
  const [retryToken, setRetryToken] = useState(0);

  const setOverride = useCallback(
    (key, value) => setOverrides((prev) => ({ ...prev, [key]: value })),
    [],
  );
  const resetOverrides = useCallback(() => setOverrides({}), []);
  const retry = useCallback(() => {
    setError(null);
    setRetryToken((n) => n + 1);
  }, []);

  // Temporise les surcharges (400 ms) pour ne pas déclencher un rendu à chaque frappe.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedOverrides(overrides), 400);
    return () => clearTimeout(id);
  }, [overrides]);

  const subject = useMemo(
    () => ({ subjectId: resolvedSubjectId, subjectType }),
    [resolvedSubjectId, subjectType],
  );

  // Aperçu : gabarit courant au format post (4:5), dans le style choisi,
  // avec les surcharges texte temporisées.
  useEffect(() => {
    let cancelled = false;
    if (!resolvedSubjectId) return undefined;
    setIsLoading(true);
    fetchRenderBase64({
      format: previewFormat,
      overrides: cleanOverrides(debouncedOverrides),
      template,
      variant,
      ...subject,
    })
      .then(({ base64, contentType }) => {
        if (cancelled) return;
        setPreviewUri(`data:${contentType};base64,${base64}`);
        setError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        logger.warn(`aperçu showcase échoué: ${e?.message}`);
        setError(e);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [resolvedSubjectId, subject, variant, debouncedOverrides, retryToken, template, previewFormat]);

  // Charge l'événement pour ShareEventModal (sujet 'event' uniquement) si non fourni.
  useEffect(() => {
    let cancelled = false;
    if (subjectType !== 'event' || initialEvent || !resolvedSubjectId) return undefined;
    client.get(`/events/${resolvedSubjectId}`)
      .then((res) => { if (!cancelled) setEvent(res?.data?.data || res?.data || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [subjectType, resolvedSubjectId, initialEvent]);

  const shareFile = useCallback(async ({
    dialogTitle, format, message, template: tpl, variant: v,
  }) => {
    try {
      // Téléchargements : on utilise les surcharges VIVES (le fichier reflète le texte
      // courant même si l'aperçu temporisé n'a pas encore rattrapé la dernière frappe).
      // Le téléchargement/partage réel est délégué à la couche plateforme :
      // natif = fichier cache + partage système ; web = fetch Blob + <a download>.
      // `message` (optionnel) accompagne le fichier dans le même partage, et
      // `dialogTitle` (optionnel) titre le sélecteur d'application Android — cf. le
      // constat iOS/Android consigné dans visualRender.native.js.
      return await downloadAndShareRender({
        dialogTitle,
        format,
        message,
        overrides: cleanOverrides(overrides),
        template: tpl,
        variant: v,
        ...subject,
      });
    } catch (e) {
      logger.warn(`partage fichier ${tpl}/${format} échoué: ${e?.message}`);
      throw e;
    }
  }, [subject, overrides]);

  const downloadStory = useCallback(
    (dialogTitle) => shareFile({
      dialogTitle, format: storyFormat, template, variant,
    }),
    [shareFile, storyFormat, template, variant],
  );
  const downloadPoster = useCallback(
    (dialogTitle) => shareFile({
      dialogTitle, format: posterFormat, template, variant,
    }),
    [shareFile, posterFormat, template, variant],
  );
  // Geste PRINCIPAL de l'écran : envoyer l'affiche TELLE QU'ELLE EST À L'ÉCRAN.
  // Même format que l'aperçu (post 4:5) ⇒ ce que l'utilisateur voit est ce qu'il
  // envoie, et les deux autres boutons restent des FORMATS alternatifs (story, A4).
  const shareVisual = useCallback(
    (message, dialogTitle) => shareFile({
      dialogTitle, format: previewFormat, message, template, variant,
    }),
    [shareFile, previewFormat, template, variant],
  );

  return {
    downloadPoster,
    downloadStory,
    error,
    event,
    isLoading,
    overrides,
    previewUri,
    resetOverrides,
    retry,
    setOverride,
    setVariant,
    shareVisual,
    variant,
    variants: variantCatalog,
  };
}
