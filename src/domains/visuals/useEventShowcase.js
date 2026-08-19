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
 *   - `react-native-blob-util` (déjà utilisé par eventService) pour écrire le fichier
 *   - `@/platform/share` pour le partage natif
 *
 * D20 (2026-08-07) : la requête `/events/:id` a été retirée. Elle n'alimentait que
 * `ShareEventModal`, qui a quitté cet écran — le geste « envoyer dans une
 * conversation » vit sur EventDetails, qui charge l'événement lui-même.
 * ⇒ une requête réseau de moins au montage, au moment précis où l'écran fabrique
 * son affiche et où la bande passante est la ressource rare.
 *
 * NOTE : les imports `@/...` sont résolus dans app/. Fichier non exécuté ici (câblage app).
 */

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';

import { createLogger } from '@/utils/logger/logger';

import { downloadAndShareRender, fetchRenderBase64 } from '@/platform/visualRender';

const logger = createLogger('visual-showcase');

/**
 * D20 (⑥) — POURQUOI UN CACHE D'APERÇU, avec les chiffres qui l'ont décidé.
 *
 * Une affiche n'est pas un dessin local : le serveur ouvre une page Chromium sans
 * écran, y charge le gabarit, et en fait une capture 2160 × 2700. Mesuré le
 * 2026-08-07 en rejouant `admin/src/api/visual-asset/services/visual-renderer.ts`
 * (format post 4:5, Chromium déjà chaud) : composer le HTML 3-5 ms · ouvrir la
 * page 40-95 ms · charger la page 990 ms · **la capture 540 à 1 300 ms** ⇒
 * **1,6 à 2,3 s par affiche**, pour **0,5 à 1,7 Mo** à rapatrier ensuite.
 *
 * Sans cache, revenir sur un style DÉJÀ AFFICHÉ repayait tout : l'aller-retour
 * réseau et le mégaoctet. Le serveur, lui, a bien un cache (X-Visual-Cache) —
 * il évite le Chromium, pas le transport.
 *
 * ⚠️ Une entrée PÈSE ce que pèse l'image (0,5 à 1,7 Mo de base64 en mémoire) :
 * le cache est donc borné à 3 entrées, soit l'aller-retour entre deux styles
 * plus celui d'origine. Au-delà, la plus ancienne est libérée.
 */
const PREVIEW_CACHE_MAX = 3;

/**
 * Tout ce qui change l'image, et rien d'autre. Les clés des surcharges sont
 * triées : deux mêmes textes saisis dans un ordre différent doivent donner la
 * MÊME clé, sinon le cache raterait sans raison.
 * @param {object} params
 * @param {string} params.format
 * @param {Record<string, string>} [params.overrides]
 * @param {string|number} params.subjectId
 * @param {string} params.subjectType
 * @param {string} params.template
 * @param {string} [params.variant]
 * @returns {string}
 */
const renderKey = ({
  format, overrides, subjectId, subjectType, template, variant,
}) => JSON.stringify([
  subjectType,
  subjectId,
  template,
  variant,
  format,
  Object.keys(overrides || {}).sort().map((key) => [key, overrides[key]]),
]);

/**
 * Sépare une entrée du cache d'aperçu (`data:image/png;base64,…`) en ce que la
 * couche plateforme sait consommer. Le cache est le SEUL à connaître cet
 * emballage : la plateforme, elle, reçoit des octets et un type, rien de plus.
 * @param {string} dataUri
 * @returns {{ cachedBase64: string, cachedContentType: string }|null}
 */
const splitDataUri = (dataUri) => {
  const found = /^data:([^;]+);base64,(.*)$/s.exec(String(dataUri || ''));
  return found ? { cachedBase64: found[2], cachedContentType: found[1] } : null;
};

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
 * Champs texte editables des 3 gabarits d'evenement (X01).
 *
 * 🎯 POURQUOI `titre` EST EDITABLE, ET CE QUE CA REPARE : mesure du 2026-08-19,
 * `event.name` est REECRIT a chaque enregistrement par le serveur sous la forme
 * machine « Type - jj/mm/aaaa - Equipe », et le tunnel de creation ne propose
 * AUCUN champ titre. Le serveur ne peut donc pas connaitre le titre d'un
 * evenement. Le gabarit porte un titre neutre qui n'affirme rien de faux, et
 * c'est ICI que l'organisateur le remplace mot pour mot.
 *
 * ⛔ `adversaire` n'est pas editable : un adversaire saisi a la main sur une
 * affiche publique serait exactement l'affirmation inventee que D94 a retiree.
 */
const EVENEMENT_FIELDS = [
  {
    key: 'titre',
    labelDefault: 'Titre',
    labelKey: 'showcase.fieldTitre',
    maxLength: 80,
    placeholder: { default: 'Notre événement', key: 'showcase.evenement.placeholderTitre' },
  },
  {
    key: 'accroche',
    labelDefault: 'Accroche',
    labelKey: 'showcase.fieldTitreAccent',
    maxLength: 80,
  },
  {
    key: 'lieu', labelDefault: 'Lieu', labelKey: 'showcase.fieldLieu', maxLength: 80,
  },
  {
    key: 'niveau', labelDefault: 'Niveau', labelKey: 'showcase.fieldNiveau', maxLength: 80,
  },
  {
    key: 'qrLabel',
    labelDefault: 'Texte sous le QR code',
    labelKey: 'showcase.fieldQrLabel',
    maxLength: 60,
  },
];

/** G1 · Match : pas de titre heros (le heros est le duel), mais une accroche. */
const MATCH_FIELDS = EVENEMENT_FIELDS.filter((field) => field.key !== 'titre');

/**
 * Textes d'ecran communs aux 3 gabarits d'evenement : ce sont les MEMES que ceux
 * de la detection (« Ton evenement est en ligne »), qui parlent deja de
 * l'evenement et pas de son type. Le message de partage, lui, suit le type via
 * `getEventShowcaseShareIntro` (D94/C2) — l'ecran le prefere a `shareIntro`.
 */
const EVENEMENT_TEXTS = {
  shareIntro: {
    default: 'Voici notre prochain événement !',
    key: 'showcase.shareIntroByType.neutre',
  },
  shareLinkLabel: { default: 'Voir l’événement', key: 'showcase.shareLabel' },
  subtitle: { default: 'Fais-le voir. Plus il est vu, plus tu remplis.', key: 'showcase.subtitle' },
  title: { default: 'Ton événement est en ligne', key: 'showcase.title' },
};

/**
 * Catalogue des gabarits d'affiche servis par le showcase generalise.
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
  // X01 — les 3 gabarits d'evenement. ⚠️ `variants: []` est VOULU : le studio a
  // arrete « 3 gabarits x 1 style ». L'ecran n'affiche donc aucune puce de style,
  // et le serveur retombe sur l'unique variante du gabarit.
  'affiche-evenement': {
    editableFields: EVENEMENT_FIELDS,
    formats: DEFAULT_FORMATS,
    subjectType: 'event',
    texts: EVENEMENT_TEXTS,
    variants: [],
  },
  'affiche-match': {
    editableFields: MATCH_FIELDS,
    formats: DEFAULT_FORMATS,
    subjectType: 'event',
    texts: {
      ...EVENEMENT_TEXTS,
      shareIntro: { default: 'Viens nous encourager pour ce match !', key: 'showcase.shareIntroByType.match' },
    },
    variants: [],
  },
  'affiche-tournoi': {
    editableFields: EVENEMENT_FIELDS,
    formats: DEFAULT_FORMATS,
    subjectType: 'event',
    texts: {
      ...EVENEMENT_TEXTS,
      shareIntro: { default: 'Viens vivre notre tournoi !', key: 'showcase.shareIntroByType.tournoi' },
    },
    variants: [],
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
 *   template?: string,
 *   variants?: Array<{ key: string, label: string }>,
 * }} params
 */
export default function useVisualShowcase({
  eventId,
  subjectId,
  subjectType = 'event',
  template = 'affiche-detection',
  variants,
} = {}) {
  // Config dérivée du gabarit (source de vérité = catalogue), surchargée par les params.
  const templateConfig = SHOWCASE_TEMPLATES[template] || SHOWCASE_TEMPLATES['affiche-detection'];
  const variantCatalog = variants || templateConfig.variants || DETECTION_VARIANTS;
  const {
    poster: posterFormat, preview: previewFormat, story: storyFormat,
  } = templateConfig.formats
    || DEFAULT_FORMATS;
  // subjectId retombe sur eventId (retro-compat du flux événement qui ne passe qu'eventId).
  const resolvedSubjectId = subjectId ?? eventId;

  const [previewUri, setPreviewUri] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // Aperçus déjà fabriqués, du plus ancien au plus récent (Map = ordre d'insertion).
  // Vit avec l'écran : quitter l'écran libère la mémoire, sans code de nettoyage.
  const previewCache = useRef(new Map());
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
    const params = {
      format: previewFormat,
      overrides: cleanOverrides(debouncedOverrides),
      template,
      variant,
      ...subject,
    };
    const key = renderKey(params);

    // Déjà fabriqué : on le remontre tel quel — aucun octet, aucune attente.
    const known = previewCache.current.get(key);
    if (known) {
      // Réinsérer = « vu à l'instant » : c'est ce qui décide qui sera libéré.
      previewCache.current.delete(key);
      previewCache.current.set(key, known);
      setPreviewUri(known);
      setError(null);
      setIsLoading(false);
      logger.info(`aperçu ${variant}/${previewFormat} servi du cache — 0 ms, 0 octet`);
      return undefined;
    }

    setIsLoading(true);
    const startedAt = Date.now();
    fetchRenderBase64(params)
      .then(({ base64, contentType }) => {
        if (cancelled) return;
        const uri = `data:${contentType};base64,${base64}`;
        previewCache.current.set(key, uri);
        while (previewCache.current.size > PREVIEW_CACHE_MAX) {
          previewCache.current.delete(previewCache.current.keys().next().value);
        }
        setPreviewUri(uri);
        setError(null);
        // Instrumentation D20 (⑥). Muette en production : `logger.info` n'écrit
        // que sous __DEV__ + APP_ENV=local (utils/logger/logger.js). C'est ce qui
        // donnera des millisecondes RÉELLES de téléphone, réseau compris.
        logger.info(
          `aperçu ${variant}/${previewFormat} fabriqué en ${Date.now() - startedAt} ms `
          + `— ${Math.round(base64.length / 1024)} Ko de base64`,
        );
      })
      .catch((e) => {
        if (cancelled) return;
        logger.warn(`aperçu showcase échoué après ${Date.now() - startedAt} ms: ${e?.message}`);
        setError(e);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [
    resolvedSubjectId, subject, variant, debouncedOverrides,
    retryToken, template, previewFormat,
  ]);

  const shareFile = useCallback(async ({
    dialogTitle, format, message, template: tpl, variant: v,
  }) => {
    // Téléchargements : on utilise les surcharges VIVES (le fichier reflète le texte
    // courant même si l'aperçu temporisé n'a pas encore rattrapé la dernière frappe).
    const params = {
      format,
      overrides: cleanOverrides(overrides),
      template: tpl,
      variant: v,
      ...subject,
    };
    // T04 (⑧) — L'AFFICHE QU'ON PARTAGE EST CELLE QU'ON REGARDE.
    // La MÊME clé que l'aperçu : si elle est là, ces octets SONT l'image
    // affichée. Partager les redemandait au serveur — mesuré le 2026-08-17 en
    // rejouant la chaîne de rendu : médiane 3,7 à 5,2 s et **1,29 Mo** repayés
    // pour un résultat identique au pixel près. Le format décide tout seul :
    // `story` et `a4` sont d'AUTRES images, leur clé n'est pas dans le cache,
    // et le serveur travaille — comme il le doit.
    const known = previewCache.current.get(renderKey(params));
    const dejaLa = known ? splitDataUri(known) : null;
    try {
      // Le téléchargement/partage réel est délégué à la couche plateforme :
      // natif = fichier cache + partage système ; web = fetch Blob + <a download>.
      // `message` (optionnel) accompagne le fichier dans le même partage, et
      // `dialogTitle` (optionnel) titre le sélecteur d'application Android — cf. le
      // constat iOS/Android consigné dans visualRender.native.js.
      return await downloadAndShareRender({
        dialogTitle,
        message,
        ...params,
        ...(dejaLa || {}),
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
