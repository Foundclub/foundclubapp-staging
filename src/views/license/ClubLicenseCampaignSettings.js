/* eslint-disable perfectionist/sort-objects */
// Y06 — `perfectionist/sort-imports` et `import/order` se CONTREDISENT sur les
// alias `@/platform/*` et `@/utils/*` : l un les veut avant les imports
// relatifs, l autre apres. Le fichier voisin (ClubLicenseMemberDetail.js:1)
// tranche de la meme facon depuis W02 — on suit `import/order`, la regle qui
// decrit la structure du depot, et on tait la seconde POUR CE FICHIER.
/* eslint-disable perfectionist/sort-imports */
import { useQueryClient } from '@tanstack/react-query';
import { format, isValid, parse } from 'date-fns';
import i18next from 'i18next';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Pressable, Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey, USER_ROLES } from '@/domains/auth/authUseCases';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';
import InputStepper from '@/components/molecules/inputStepper/InputStepper';
import SubscriptionPaywallSheet from '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet';
import WizardStepLayout from '@/components/molecules/wizardStepLayout/WizardStepLayout';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetCategories } from '@/services/category/categoryQueries';
import { compareCategories } from '@/services/category/categoryService';
import { useGetClub } from '@/services/club/clubQueries';
import { useGetLevels } from '@/services/level/levelQueries';
import {
  createLicenseCampaign,
  deleteLicenseDocumentRequest,
  deleteLicensePricingRule,
  updateLicenseCampaign,
  uploadLicenseDocumentRequestTemplate,
  upsertLicenseDocumentRequest,
  upsertLicensePricingRule,
  useCurrentLicenseCampaign,
  useLicenseCampaign,
  useLicenseMutation,
} from '@/services/license/licenseQueries';
import { useGetSections } from '@/services/section/sectionQueries';
// Y06 — `@/platform/links` et `@/utils/mediaUrl` ouvrent le modele deja
// enregistre, par le MEME chemin que le membre (`MyLicense.js`).
import { resolveMediaUrl } from '@/utils/mediaUrl';
import LinksPlatform from '@/platform/links';
import MediaPlatform from '@/platform/media';
// U06 — la MEME liste de formats sur les trois ecrans de depot, et dans la
// langue de la plateforme (UTI sur iOS, type MIME sur Android).
import { getDocumentPickerOptions } from '@/platform/media/documentUploadFormats';

import {
  buildEventCampaignDefaults,
  buildEventTargetConfig,
} from './eventCampaignDefaults';
import {
  describeHelloAssoReadiness,
  formatLicenseMoney,
  getHelloAssoSnapshot,
  isHelloAssoReadyForCampaign,
  LicenseEmptyState,
  licenseRadius,
  LicenseSelectionChip,
  licenseSpacing,
  normalizePaymentModes,
  paymentModeLabels,
} from './licenseDesignSystem';

const euroToCents = (value) => Math.round(Number(String(value || '0').replace(',', '.')) * 100);
const centsToEuro = (value) => String(((value || 0) / 100).toFixed(2)).replace('.', ',');
const parseIsoDateValue = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const parsed = parse(normalized.slice(0, 10), 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : null;
};
const isoToPickerDateValue = (value) => {
  const parsed = parseIsoDateValue(value);
  return parsed ? format(parsed, 'dd/MM/yyyy') : '';
};
const getTodayIsoDateValue = () => format(new Date(), 'yyyy-MM-dd');
const clampDateToBounds = (date, minimumDate, maximumDate) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const minimum = minimumDate instanceof Date && !Number.isNaN(minimumDate.getTime()) ? minimumDate : null;
  const maximum = maximumDate instanceof Date && !Number.isNaN(maximumDate.getTime()) ? maximumDate : null;
  if (minimum && date.getTime() < minimum.getTime()) return minimum;
  if (maximum && date.getTime() > maximum.getTime()) return maximum;
  return date;
};
// ⛔ Les CLES sont les chaines deja en base : elles ne bougent pas. Seuls les
// libelles changent, et uniquement pour porter leurs accents (defaut de recette
// du 2026-08-07 : le recapitulatif affichait « pending, partial, overdue »).
const reminderStatusOptions = [
  {
    key: 'pending',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.reminderStatus.pending', 'À payer');
    },
  },
  {
    key: 'partial',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.reminderStatus.partial', 'Partiel');
    },
  },
  {
    key: 'overdue',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.reminderStatus.overdue', 'En retard');
    },
  },
  {
    key: 'manual_review',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.reminderStatus.manualReview', 'À valider');
    },
  },
];
const installmentFrequencyOptions = [
  {
    key: 'weekly',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.installmentFrequency.weekly', 'Hebdomadaire');
    },
  },
  {
    key: 'monthly',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.installmentFrequency.monthly', 'Mensuelle');
    },
  },
  {
    key: 'quarterly',
    get label() {
      return i18next.t(
        'clubLicenseCampaignSettings.installmentFrequency.quarterly',
        'Trimestrielle',
      );
    },
  },
  {
    key: 'custom',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.installmentFrequency.custom', 'Libre');
    },
  },
];
const installmentFrequencyMonthStep = {
  custom: 1, monthly: 1, quarterly: 3, weekly: 0,
};

/**
 * Repartit un montant en N echeances SANS jamais perdre ni inventer un centime.
 *
 * 100 € en 3 fois donne 33,34 + 33,33 + 33,33 : le reste de la division entiere
 * est verse sur les PREMIERES echeances, jamais lisse. La somme des lignes est
 * donc egale au montant, par construction et pas par chance.
 * @param {number} totalCents - Montant total de la campagne, en centimes.
 * @param {number} count - Nombre d'echeances voulu.
 * @returns {number[]} Les montants, en centimes, dans l'ordre.
 */
const splitAmountIntoInstallments = (totalCents, count) => {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  const safeTotal = Math.max(0, Math.round(Number(totalCents) || 0));
  const base = Math.floor(safeTotal / safeCount);
  const remainder = safeTotal - (base * safeCount);
  return Array.from({ length: safeCount }, (_, index) => base + (index < remainder ? 1 : 0));
};

/**
 * Decale une date ISO de N periodes, selon la frequence choisie.
 * @param {string} isoDate - Date de depart, format `yyyy-MM-dd`.
 * @param {string} frequency - Cle de `installmentFrequencyOptions`.
 * @param {number} periodIndex - Rang de l'echeance, a partir de 0.
 * @returns {string} La date decalee, ou une chaine vide si la date de depart est invalide.
 */
const shiftDateByFrequency = (isoDate, frequency, periodIndex) => {
  const parsed = parseIsoDateValue(isoDate);
  if (!parsed) return '';
  const shifted = new Date(parsed.getTime());
  if (frequency === 'weekly') {
    shifted.setDate(shifted.getDate() + (7 * periodIndex));
  } else {
    const monthStep = installmentFrequencyMonthStep[frequency] ?? 1;
    shifted.setMonth(shifted.getMonth() + (monthStep * periodIndex));
  }
  return format(shifted, 'yyyy-MM-dd');
};

/**
 * Fabrique l'echeancier COMPLET a partir du montant, du nombre et de la frequence.
 *
 * D26 : le dirigeant ne resaisit plus « 1, 2, 3 » a la main. Il donne un nombre,
 * l'app produit les lignes. La saisie manuelle reste possible dans la feuille
 * « Ajuster » — mais elle part d'un echeancier deja juste.
 * @param {object} root0
 * @param {number} root0.totalCents
 * @param {number} root0.count
 * @param {string} root0.frequency
 * @param {string} root0.startDate
 * @returns {{amount: string, dueDate: string, frequency: string, label: string, localId: string}[]}
 */
const generateInstallmentSchedule = ({
  count, frequency, startDate, totalCents,
}) => {
  const safeCount = Math.max(1, Math.floor(Number(count) || 1));
  return splitAmountIntoInstallments(totalCents, safeCount).map((amountCents, index) => ({
    amount: centsToEuro(amountCents),
    dueDate: shiftDateByFrequency(startDate, frequency, index),
    frequency,
    label: `${index + 1}/${safeCount}`,
    localId: `generated-${index + 1}`,
  }));
};
const currencyOptions = [
  { key: 'EUR', label: 'EUR €' },
  { key: 'USD', label: 'USD $' },
  { key: 'GBP', label: 'GBP £' },
  { key: 'CHF', label: 'CHF' },
];
const campaignTypeOptions = [
  {
    key: 'license',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.campaignType.license', 'Licence');
    },
  },
  {
    key: 'membership',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.campaignType.membership', 'Adhésion');
    },
  },
  {
    key: 'equipment',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.campaignType.equipment', 'Équipement');
    },
  },
  {
    key: 'internship',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.campaignType.internship', 'Stage');
    },
  },
  {
    key: 'tournament',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.campaignType.tournament', 'Tournoi');
    },
  },
  {
    key: 'other',
    get label() {
      return i18next.t('clubLicenseCampaignSettings.campaignType.other', 'Autre');
    },
  },
];
const licenseRoleFilterKeys = ['player', 'coach', 'president'];
/**
 * Les 6 etapes du tunnel de campagne — lot D26.
 *
 * ⚠️ CE TABLEAU EST UNE CONSTANTE, ET C'EST TOUT LE LOT.
 * Avant D26 il etait construit par empilements conditionnels : le DENOMINATEUR
 * du « Étape n/N » changeait sous les yeux du dirigeant des qu'il basculait un
 * interrupteur situe DANS le tunnel (mesure du filet D18 : 13 au minimum, 17 sur
 * une campagne neuve, 22 au maximum — « 8/16 » devenait « 8/19 » sans reculer).
 * Une longueur constante ne peut plus mentir.
 *
 * Les 16 anciennes etapes qui sortent de la barre ne sont PAS supprimees : elles
 * deviennent une feuille ou une ligne d'« Options avancées ». Une etape retiree
 * sans destination, c'est du reglage devenu injoignable — le motif exact de la
 * regression la plus chere du projet.
 * @type {{key: string, subtitle: string, title: string}[]}
 */
const licenseCampaignWizardSteps = [
  {
    key: 'identity',
    get subtitle() {
      return i18next.t(
        'clubLicenseCampaignSettings.steps.identity.subtitle',
        'Nom, type et saison — le reste a des défauts sûrs.',
      );
    },
    get title() {
      return i18next.t('clubLicenseCampaignSettings.steps.identity.title', 'Identité');
    },
  },
  {
    key: 'audience',
    get subtitle() {
      return i18next.t(
        'clubLicenseCampaignSettings.steps.audience.subtitle',
        'Qui paie, et combien. Le montant est obligatoire.',
      );
    },
    get title() {
      return i18next.t('clubLicenseCampaignSettings.steps.audience.title', 'Public & tarif');
    },
  },
  {
    key: 'payment',
    get subtitle() {
      return i18next.t(
        'clubLicenseCampaignSettings.steps.payment.subtitle',
        'Comment les membres peuvent régler.',
      );
    },
    get title() {
      return i18next.t('clubLicenseCampaignSettings.steps.payment.title', 'Paiement');
    },
  },
  {
    key: 'documents',
    get subtitle() {
      return i18next.t(
        'clubLicenseCampaignSettings.steps.documents.subtitle',
        'Les pièces à fournir. Étape facultative.',
      );
    },
    get title() {
      return i18next.t('clubLicenseCampaignSettings.steps.documents.title', 'Documents');
    },
  },
  {
    key: 'reminders',
    get subtitle() {
      return i18next.t(
        'clubLicenseCampaignSettings.steps.reminders.subtitle',
        'On relance tant que ce n est pas payé.',
      );
    },
    get title() {
      return i18next.t('clubLicenseCampaignSettings.steps.reminders.title', 'Relances');
    },
  },
  {
    key: 'review',
    get subtitle() {
      return i18next.t(
        'clubLicenseCampaignSettings.steps.review.subtitle',
        'Relis, corrige, puis ouvre — tout reste modifiable après.',
      );
    },
    get title() {
      return i18next.t('clubLicenseCampaignSettings.steps.review.title', 'Récapitulatif');
    },
  },
];
const licenseCampaignWizardStepIndex = licenseCampaignWizardSteps
  .reduce((accumulator, step, index) => ({ ...accumulator, [step.key]: index }), {});
const normalizeReminderAutomation = (campaign) => {
  const automation = campaign?.reminderAutomation || {};
  return {
    afterDueDays: automation.afterDueDays === null || automation.afterDueDays === undefined ? '' : String(automation.afterDueDays),
    beforeDueDays: automation.beforeDueDays === null || automation.beforeDueDays === undefined ? '' : String(automation.beforeDueDays),
    enabled: automation.enabled !== undefined ? Boolean(automation.enabled) : true,
    frequencyDays: String(automation.frequencyDays || 14),
    maxCount: String(automation.maxCount || 5),
    onDueDate: automation.onDueDate !== undefined ? Boolean(automation.onDueDate) : true,
    startDate: automation.startDate || '',
    targetStatuses: Array.isArray(automation.targetStatuses) && automation.targetStatuses.length
      ? automation.targetStatuses
      : ['pending', 'partial', 'overdue'],
  };
};
const defaultPaymentModes = {
  bank_transfer: true,
  card_physical: false,
  cash: true,
  check: true,
  external_link: false,
  helloasso: false,
  stripe: false,
};
const isPickerCancelError = (error) => String(error?.code || error?.message || '')
  .toLowerCase()
  .includes('cancel');
const createDocumentRequestDraft = (documentRequest = {}) => ({
  acceptedMimeTypesText: Array.isArray(documentRequest.acceptedMimeTypes)
    ? documentRequest.acceptedMimeTypes.join(', ')
    : '',
  description: documentRequest.description || '',
  documentId: documentRequest.documentId || documentRequest.id || null,
  dueDate: documentRequest.dueDate || '',
  localId: String(
    documentRequest.documentId
    || documentRequest.id
    || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ),
  name: documentRequest.name || '',
  // T03 — LE MODELE PARTAGE, celui que les membres telechargent.
  // `pickedTemplateFile` est le fichier choisi mais PAS ENCORE envoye : une
  // demande neuve n a pas d identifiant tant que la campagne n est pas
  // enregistree, on ne peut donc rien y accrocher avant. `templateRemoved` porte
  // le geste inverse.
  pickedTemplateFile: null,
  removedTemplate: false,
  required: documentRequest.required !== false,
  requiresManualValidation: documentRequest.requiresManualValidation !== false,
  requiresSignature: documentRequest.requiresSignature === true,
  templateFileName: documentRequest.templateFile?.name || '',
  // Y06 — L ADRESSE du modele deja enregistre. Sans elle, le createur voyait le
  // NOM de son fichier sans pouvoir l ouvrir : « visible et telechargeable par
  // tous les membres », sauf par celui qui l a depose.
  // ⛔ Elle ne concerne QUE le fichier deja parti : `pickedTemplateFile` n a
  // aucune adresse tant que la campagne n est pas enregistree.
  templateFileUrl: documentRequest.templateFile?.url || '',
});
const referenceKey = (value) => String(value?.documentId || value?.id || value || '');
const createPricingRuleDraft = (pricingRule = {}) => ({
  amount: centsToEuro(pricingRule.amountCents || 0),
  categoryKey: referenceKey(pricingRule.category),
  isWaiver: pricingRule.isWaiver === true,
  label: pricingRule.label || '',
  levelKey: referenceKey(pricingRule.level),
  localId: String(
    pricingRule.documentId
    || pricingRule.id
    || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ),
  priority: String(pricingRule.priority || 0),
  roleName: pricingRule.roleName || '',
  ruleId: pricingRule.documentId || pricingRule.id || null,
  ruleType: pricingRule.ruleType || 'role',
  sectionKey: referenceKey(pricingRule.section),
  teamKey: referenceKey(pricingRule.team),
});
const normalizeDocumentRequests = (campaign) => {
  const items = campaign?.documentRequests || [];
  if (!items.length) return [createDocumentRequestDraft()];
  return [...items]
    .sort((left, right) => (Number(left?.sortOrder) || 0) - (Number(right?.sortOrder) || 0))
    .map((item) => createDocumentRequestDraft(item));
};
const normalizePricingRules = (campaign) => {
  const items = campaign?.pricingRules || [];
  return [...items]
    .sort((left, right) => Number(right?.priority || 0) - Number(left?.priority || 0))
    .map((item) => createPricingRuleDraft(item));
};
const createTargetConfigDraft = (campaign) => {
  const config = campaign?.targetConfig || {};
  if (String(config.source || '').toLowerCase() === 'event_participants') {
    return buildEventTargetConfig(String(config.eventId || '').trim());
  }
  const categoryIds = Array.isArray(config.categoryIds || config.categories)
    ? (config.categoryIds || config.categories).map(referenceKey).filter(Boolean)
    : [];
  const levelIds = Array.isArray(config.levelIds || config.levels)
    ? (config.levelIds || config.levels).map(referenceKey).filter(Boolean)
    : [];
  const roles = Array.isArray(config.roles || config.roleNames)
    ? (config.roles || config.roleNames).map((value) => String(value?.name || value?.label || value || '')).filter(Boolean)
    : [];
  const sectionIds = Array.isArray(config.sectionIds || config.sections)
    ? (config.sectionIds || config.sections).map(referenceKey).filter(Boolean)
    : [];
  const teamIds = Array.isArray(config.teamIds || config.teams)
    ? (config.teamIds || config.teams).map(referenceKey).filter(Boolean)
    : [];
  // T03 — « QUAND ON CREE UNE CAMPAGNE, TOUT LE CLUB DOIT ETRE COCHE DE BASE »
  // (Adel, recette du 2026-08-17).
  //
  // Ce n etait pas un oubli, c etait une INCOHERENCE : le serveur recoit deja
  // « tout le club » des qu aucun filtre n est choisi — `normalizeTargetConfigPayload`
  // (l. 596) et `buildTargetSummaryPayload` (l. 569) envoient l un comme l autre
  // `includeAllMembers: !hasScopedFilters`. Seul CE brouillon disait le
  // contraire, en posant `false` en dur. L interrupteur affichait donc « non »
  // pendant que la charge utile envoyee disait « oui ».
  //
  // 🔒 ET RIEN NE S ELARGIT — c est le point sensible, parce que cocher engage
  // de l argent pour tout le monde : la valeur STOCKEE gagne toujours, et une
  // campagne qui porte des filtres (roles, equipes, categories, sections,
  // niveaux) garde exactement les siens. Le defaut a `true` ne s applique qu a
  // une cible VIDE — c est-a-dire a une campagne neuve, ou a une campagne dont
  // le serveur considere deja que tout le club est concerne.
  const hasStoredIncludeAllMembers = typeof config.includeAllMembers === 'boolean';
  const hasScopedFilters = Boolean(
    roles.length
    || teamIds.length
    || categoryIds.length
    || sectionIds.length
    || levelIds.length,
  );
  let includeAllMembers = !hasScopedFilters;

  if (hasStoredIncludeAllMembers) {
    includeAllMembers = config.includeAllMembers;
  }

  return {
    categoryIds,
    includeAllMembers,
    levelIds,
    roles,
    sectionIds,
    teamIds,
  };
};
const createInstallmentDraft = (installment = {}, index = 0) => ({
  amount: installment.amountCents || installment.amountDueCents
    ? centsToEuro(installment.amountCents || installment.amountDueCents)
    : '',
  dueDate: installment.dueDate || '',
  frequency: installment.frequency || 'monthly',
  label: installment.label || `${index + 1}`,
  localId: String(
    installment.documentId
    || installment.id
    || `installment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ),
});
const normalizeInstallmentSchedule = (campaign) => {
  const count = Math.max(1, Number(campaign?.installmentCount || 1));
  const rawSchedule = Array.isArray(campaign?.installmentSchedule) ? campaign.installmentSchedule : [];
  return Array.from({ length: count }, (_, index) => createInstallmentDraft(rawSchedule[index], index));
};
const optionalNumberOrNull = (value) => {
  if (value === undefined || value === null) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  return Math.max(0, Number(normalized) || 0);
};
const normalizeAmountInput = (value) => {
  const cleaned = String(value || '')
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, ',');
  const firstCommaIndex = cleaned.indexOf(',');
  if (firstCommaIndex === -1) return cleaned;
  const integerPart = cleaned.slice(0, firstCommaIndex + 1);
  const decimals = cleaned.slice(firstCommaIndex + 1).replace(/,/g, '').slice(0, 2);
  return `${integerPart}${decimals}`;
};
// AA07 / K3 — LES NOMBRES ENTIERS SAISIS AU CLAVIER (priorite, delais de relance).
//
// 🧨 Pourquoi nettoyer EN PLUS de poser le bon clavier : un clavier de chiffres
// est une SUGGESTION, pas une barriere. Un clavier materiel, un copier-coller
// ou une dictee vocale laissent passer des lettres — et `Number('abc')` vaut
// NaN, que `JSON.stringify` envoie au serveur en `null`.
const normalizeWholeNumberInput = (value) => String(value ?? '').replace(/[^0-9]/g, '');
const seasonStartMonthIndex = 7;
const formatSeasonLabel = (startYear, endYear) => `${startYear}-${endYear}`;
const getSeasonRangeFromDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = date.getMonth();
  return month >= seasonStartMonthIndex
    ? { endYear: year + 1, startYear: year }
    : { endYear: year, startYear: year - 1 };
};
const detectSeasonLabelFromDates = ({ endDate, startDate }) => {
  const parsedStartDate = parseIsoDateValue(startDate);
  const parsedEndDate = parseIsoDateValue(endDate);
  if (parsedStartDate && parsedEndDate) {
    const midpoint = new Date((parsedStartDate.getTime() + parsedEndDate.getTime()) / 2);
    const midpointSeason = getSeasonRangeFromDate(midpoint);
    return midpointSeason
      ? formatSeasonLabel(midpointSeason.startYear, midpointSeason.endYear)
      : '';
  }
  const fallbackSeason = getSeasonRangeFromDate(parsedStartDate || parsedEndDate || new Date());
  return fallbackSeason
    ? formatSeasonLabel(fallbackSeason.startYear, fallbackSeason.endYear)
    : '';
};
/**
 * La saison EN COURS, celle que le tunnel propose par defaut (capture `01`).
 *
 * Le brief est explicite : « pas d'autre saison proposée ». On ne montre donc
 * plus une liste de saisons voisines, on montre celle-ci ou des dates libres.
 * @returns {{endDate: string, label: string, startDate: string}}
 */
const getCurrentSeasonRange = () => {
  const range = getSeasonRangeFromDate(new Date()) || { endYear: 0, startYear: 0 };
  return {
    endDate: `${range.endYear}-07-31`,
    label: formatSeasonLabel(range.startYear, range.endYear),
    startDate: `${range.startYear}-08-01`,
  };
};
// ⛔ `buildSeasonLabelSuggestions` (saison precedente / suivante) est retire :
// le brief est explicite, « pas d'autre saison proposée ». La saison en cours ou
// des dates libres — rien entre les deux.
const formatSeasonLabelForSuggestion = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    const currentYear = new Date().getFullYear();
    return `${currentYear}/${currentYear + 1}`;
  }
  return normalized
    .replace(/\s+/g, '')
    .replace(/-/g, '/');
};
const buildCampaignNameSuggestions = ({ seasonLabel, type }) => {
  const season = formatSeasonLabelForSuggestion(seasonLabel);
  const suggestionsByType = {
    equipment: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.equipment.one',
        'Cotisation équipements {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.equipment.two',
        'Campagne équipements {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.equipment.three',
        'Équipements {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
    internship: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.internship.one',
        'Participation stage {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.internship.two',
        'Campagne stage {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.internship.three',
        'Stage {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
    license: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.license.one',
        'Cotisation licences {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.license.two',
        'Campagne licences {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.license.three',
        'Licences {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
    membership: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.membership.one',
        'Cotisation adhésions {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.membership.two',
        'Campagne adhésion {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.membership.three',
        'Adhésions {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
    other: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.other.one',
        'Cotisation {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.other.two',
        'Campagne {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.other.three',
        'Paiement {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
    tournament: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.tournament.one',
        'Participation tournoi {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.tournament.two',
        'Campagne tournoi {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.names.tournament.three',
        'Tournoi {{season}}',
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
  };
  const typeKey = String(type || 'license').trim().toLowerCase();
  const suggestions = suggestionsByType[typeKey] || suggestionsByType.other;
  return [...new Set(suggestions.map((value) => String(value || '').trim()).filter(Boolean))];
};
const buildCampaignDescriptionSuggestions = ({ seasonLabel, type }) => {
  const season = formatSeasonLabelForSuggestion(seasonLabel);
  const suggestionsByType = {
    equipment: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.equipment.one',
        'Cette campagne concerne les équipements pour la saison {{season}}. Merci de '
          + 'finaliser ton règlement dans les délais indiques par le club.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.equipment.two',
        'Retrouve ici les informations de paiement liées aux équipements de la saison {{season}}.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.equipment.three',
        'Cette cotisation couvre les équipements prévus pour la saison {{season}}.',
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
    internship: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.internship.one',
        'Cette campagne concerne la participation au stage {{season}}. Merci de suivre les '
          + 'modalités de paiement indiquées par le club.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.internship.two',
        'Retrouve ici les informations de règlement pour le stage de la saison {{season}}.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.internship.three',
        'Cette cotisation permet de confirmer l inscription au stage {{season}}.',
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
    license: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.license.one',
        'Cette campagne concerne les licences pour la saison {{season}}. Merci de compléter '
          + 'ton dossier et ton paiement dans les délais.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.license.two',
        'Retrouve ici les informations de paiement et les documents à fournir pour la '
          + 'licence {{season}}.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.license.three',
        'Cette cotisation permet de finaliser la licence pour la saison {{season}}.',
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
    membership: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.membership.one',
        'Cette campagne concerne les adhésions pour la saison {{season}}. Merci de compléter '
          + 'ton dossier et ton règlement.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.membership.two',
        'Retrouve ici les informations nécessaires pour régler ton adhésion {{season}}.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.membership.three',
        "Cette cotisation permet de valider l'adhésion à la saison {{season}}.",
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
    other: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.other.one',
        'Merci de retrouver ici toutes les informations utiles pour cette campagne {{season}}.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.other.two',
        'Cette campagne regroupe les modalités de paiement et les informations visibles par '
          + 'les membres.',
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.other.three',
        'Merci de compléter ton règlement selon les consignes indiquées par le club.',
      ),
    ],
    tournament: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.tournament.one',
        'Cette campagne concerne la participation au tournoi {{season}}. Merci de suivre les '
          + 'modalités indiquées pour valider ton inscription.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.tournament.two',
        'Retrouve ici les informations de règlement pour le tournoi {{season}}.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.descriptions.tournament.three',
        'Cette cotisation permet de confirmer la participation au tournoi {{season}}.',
        { season, ...SANS_ECHAPPEMENT },
      ),
    ],
  };
  const typeKey = String(type || 'license').trim().toLowerCase();
  const suggestions = suggestionsByType[typeKey] || suggestionsByType.other;
  return [...new Set(suggestions.map((value) => String(value || '').trim()).filter(Boolean))];
};
const buildInternalNoteSuggestions = ({ seasonLabel, type }) => {
  const season = formatSeasonLabelForSuggestion(seasonLabel);
  const suggestionsByType = {
    equipment: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.equipment.one',
        'Suivi interne {{season}} : vérifier les tailles, les stocks et les règlements avant '
          + 'de lancer la commande équipement.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.equipment.two',
        'Campagne équipement {{season}} : valider les paiements reçus avant remise des articles.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.equipment.three',
        'Note staff : centraliser ici les cas particuliers, remises et commandes à confirmer.',
      ),
    ],
    internship: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.internship.one',
        'Suivi stage {{season}} : vérifier les dossiers complets, les paiements reçus et les '
          + 'places restantes.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.internship.two',
        'Campagne stage {{season}} : relancer les familles en attente avant validation finale.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.internship.three',
        'Note équipe : suivre ici les exemptions, paiements manuels et confirmations de '
          + 'participation.',
      ),
    ],
    license: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.license.one',
        'Suivi licences {{season}} : vérifier les documents manquants et relancer avant '
          + 'validation finale.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.license.two',
        'Campagne licences {{season}} : rapprocher les paiements manuels chaque semaine et '
          + 'signaler les dossiers incomplets.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.license.three',
        'Note dirigeants : utiliser cet espace pour les cas particuliers, exemptions et '
          + 'relances prioritaires.',
      ),
    ],
    membership: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.membership.one',
        'Suivi adhésions {{season}} : vérifier les paiements reçus et les demandes en '
          + 'attente de validation.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.membership.two',
        'Campagne adhésions {{season}} : noter ici les cas particuliers, remises et suivis à '
          + 'faire avec les familles.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.membership.three',
        'Note gestion : confirmer chaque adhésion après reception du règlement complet.',
      ),
    ],
    other: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.other.one',
        'Suivi interne {{season}} : centraliser ici les points de vigilance et les relances '
          + 'à effectuer.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.other.two',
        'Note staff : utiliser cet espace pour les exceptions, paiements manuels et '
          + 'commentaires de suivi.',
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.other.three',
        'Rappel gestion : vérifier les dossiers incomplets avant clôture de la campagne.',
      ),
    ],
    tournament: [
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.tournament.one',
        'Suivi tournoi {{season}} : vérifier les inscriptions, paiements reçus et '
          + 'confirmations avant clôture.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.tournament.two',
        'Campagne tournoi {{season}} : noter ici les équipes à relancer et les cas '
          + 'particuliers à traiter.',
        { season, ...SANS_ECHAPPEMENT },
      ),
      i18next.t(
        'clubLicenseCampaignSettings.suggestions.notes.tournament.three',
        'Note organisation : centraliser les suivis de paiement et de validation dans cet espace.',
      ),
    ],
  };
  const typeKey = String(type || 'license').trim().toLowerCase();
  const suggestions = suggestionsByType[typeKey] || suggestionsByType.other;
  return [...new Set(suggestions.map((value) => String(value || '').trim()).filter(Boolean))];
};
const parseAcceptedMimeTypes = (value) => String(value || '')
  .split(',')
  .map((chunk) => chunk.trim())
  .filter(Boolean);
const toggleKey = (items, value) => {
  const key = String(value || '');
  if (!key) return items;
  return items.includes(key)
    ? items.filter((item) => item !== key)
    : [...items, key];
};
const toggleRole = (items, value) => {
  const key = String(value || '');
  if (!key) return items;
  return items.includes(key)
    ? items.filter((item) => item !== key)
    : [...items, key];
};
const buildTargetSummaryPayload = (targetConfig) => {
  const config = /** @type {any} */ (targetConfig);
  const isEventTarget = config.source === 'event_participants';
  const hasScopedFilters = Boolean(
    targetConfig.roles.length
    || targetConfig.teamIds.length
    || targetConfig.categoryIds.length
    || targetConfig.sectionIds.length
    || targetConfig.levelIds.length,
  );
  return {
    categoryCount: isEventTarget ? 0 : targetConfig.categoryIds.length,
    eventId: isEventTarget ? config.eventId : undefined,
    hasScopedFilters: isEventTarget ? true : hasScopedFilters,
    includeAllMembers: isEventTarget ? false : !hasScopedFilters,
    includeExternalParticipants: isEventTarget ? true : undefined,
    levelCount: targetConfig.levelIds.length,
    participantStatuses: isEventTarget ? ['accepted'] : undefined,
    roleCount: targetConfig.roles.length,
    roles: targetConfig.roles,
    sectionCount: targetConfig.sectionIds.length,
    source: config.source,
    teamCount: targetConfig.teamIds.length,
  };
};
const normalizeTargetConfigPayload = (targetConfig) => {
  const config = /** @type {any} */ (targetConfig);
  if (config.source === 'event_participants') {
    return {
      ...buildEventTargetConfig(config.eventId),
      eventId: config.eventId,
    };
  }
  const roles = targetConfig.roles.filter(Boolean);
  const teamIds = targetConfig.teamIds.filter(Boolean);
  const categoryIds = targetConfig.categoryIds.filter(Boolean);
  const sectionIds = targetConfig.sectionIds.filter(Boolean);
  const levelIds = targetConfig.levelIds.filter(Boolean);
  const hasScopedFilters = Boolean(roles.length || teamIds.length || categoryIds.length || sectionIds.length || levelIds.length);
  return {
    categoryIds,
    includeAllMembers: !hasScopedFilters,
    levelIds,
    roles,
    sectionIds,
    teamIds,
  };
};
const pricingRuleLabels = {
  get category() {
    return i18next.t('clubLicenseCampaignSettings.pricingRuleType.category', 'Categorie');
  },
  get level() {
    return i18next.t('clubLicenseCampaignSettings.pricingRuleType.level', 'Niveau');
  },
  get role() {
    return i18next.t('clubLicenseCampaignSettings.pricingRuleType.role', 'Role');
  },
  get section() {
    return i18next.t('clubLicenseCampaignSettings.pricingRuleType.section', 'Section');
  },
  get team() {
    return i18next.t('clubLicenseCampaignSettings.pricingRuleType.team', 'Equipe');
  },
};
// ⛔ Les CLES sont les valeurs de `USER_ROLES`, celles qui partent en base dans
// `targetConfig.roles`. Seul le libelle affiche porte l'accent et le pluriel.
const licenseTargetRolePills = [
  {
    key: USER_ROLES.president,
    get label() {
      return i18next.t('clubLicenseCampaignSettings.targetRoles.clubManagers', 'Dirigeants');
    },
  },
  {
    key: USER_ROLES.coach,
    get label() {
      return i18next.t('clubLicenseCampaignSettings.targetRoles.coaches', 'Entraîneurs');
    },
  },
  {
    key: USER_ROLES.player,
    get label() {
      return i18next.t('clubLicenseCampaignSettings.targetRoles.players', 'Joueurs');
    },
  },
];

/**
 * Resume une piece demandee en une ligne : « Obligatoire · validation manuelle ·
 * avant le 30 sept. ». Les formats acceptes n'y figurent plus — ils sont geres
 * automatiquement, les afficher n'aidait personne.
 * @param {any} documentRequest
 * @returns {string} La ligne de resume.
 */
const describeDocumentRequest = (documentRequest) => [
  documentRequest.required !== false ? i18next.t(
    'clubLicenseCampaignSettings.documentSummary.required',
    'Obligatoire',
  ) : i18next.t(
    'clubLicenseCampaignSettings.documentSummary.optional',
    'Facultatif',
  ),
  documentRequest.requiresManualValidation !== false ? i18next.t(
    'clubLicenseCampaignSettings.documentSummary.manualApproval',
    'validation manuelle',
  ) : null,
  documentRequest.requiresSignature === true ? i18next.t(
    'clubLicenseCampaignSettings.documentSummary.signature',
    'signature',
  ) : null,
  documentRequest.dueDate?.trim()
    ? i18next.t(
      'clubLicenseCampaignSettings.documentSummary.beforeDate',
      'avant le {{date}}',
      { date: isoToPickerDateValue(documentRequest.dueDate), ...SANS_ECHAPPEMENT },
    )
    : null,
].filter(Boolean).join(' · ');
const renderReminderPreview = ({
  campaignName,
  dueDate,
  message,
  totalLabel,
}) => {
  // I18N-1 : les {{jetons}} du modele sont remplaces PLUS BAS ; chacun est passe comme sa propre
  // valeur pour qu'i18next les laisse intacts (mesure : sortie identique au texte d'origine).
  const template = String(message || '').trim()
    || i18next.t(
      'clubLicenseCampaignSettings.reminderPreview.defaultTemplate',
      'Bonjour {{firstname}}, il te reste {{amountRemaining}} à régler pour {{campaignName}} '
        + 'avant le {{dueDate}}.',
      {
        amountRemaining: '{{amountRemaining}}',
        campaignName: '{{campaignName}}',
        dueDate: '{{dueDate}}',
        firstname: '{{firstname}}',
        ...SANS_ECHAPPEMENT,
      },
    );
  return template
    .replace(/\{\{\s*firstname\s*\}\}/g, 'Lucas')
    .replace(/\{\{\s*lastname\s*\}\}/g, 'Martin')
    .replace(/\{\{\s*campaignName\s*\}\}/g, campaignName || i18next.t(
      'clubLicenseCampaignSettings.reminderPreview.sampleCampaignName',
      'Cotisation FoundClub',
    ))
    .replace(/\{\{\s*amountTotal\s*\}\}/g, totalLabel || '180,00 EUR')
    .replace(/\{\{\s*amountPaid\s*\}\}/g, '60,00 EUR')
    .replace(/\{\{\s*amountRemaining\s*\}\}/g, '120,00 EUR')
    .replace(/\{\{\s*dueDate\s*\}\}/g, dueDate || '2026-09-15')
    .replace(/\{\{\s*paymentLink\s*\}\}/g, 'https://foundclub.app/licenses/pay/demo');
};

/**
 * AA07 / K3 — `Field` sait desormais annoncer un clavier.
 *
 * 🎯 C EST ICI QUE VIVAIT LE DEFAUT D ADEL. Cette enveloppe n exposait aucun
 * `keyboardType` : les quatre champs de l ecran qui attendent un NOMBRE
 * ouvraient donc le clavier de lettres. Une recherche de `<TextInput>` ne
 * pouvait pas le voir — c est l enveloppe qui masquait le probleme, pas le
 * champ. ⇒ On corrige l enveloppe UNE fois plutot que chaque appelant.
 * ⚠️ TOUTES les etiquettes sont typees, et les facultatives entre crochets.
 * Mesure : les laisser sans type, ou n en typer qu une partie, rend le contrat
 * authoritatif pour TypeScript sans lui dire ce qui est optionnel — il exige
 * alors `multiline` a chacun des 18 appels (+21 erreurs mesurees).
 * @param {object} root0 les proprietes du champ
 * @param {import('react-native').InputModeOptions} [root0.inputMode] mode de saisie
 * @param {import('react-native').KeyboardTypeOptions} [root0.keyboardType] clavier a ouvrir
 * @param {string} root0.label le libelle affiche au-dessus
 * @param {boolean} [root0.multiline] vrai pour un champ de plusieurs lignes
 * @param {(value: string) => void} root0.onChangeText appele a chaque frappe
 * @param {string} [root0.placeholder] l invite affichee a vide
 * @param {string} root0.value la valeur courante
 */
function Field({
  inputMode, keyboardType, label, multiline = false, onChangeText, placeholder, value,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
      <TextInput
        inputMode={inputMode}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.neutral400}
        style={{
          borderBottomColor: Colors.neutral200, borderBottomWidth: 1, color: Colors.neutral00, minHeight: 48, paddingVertical: 14,
        }}
        value={value}
      />
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.maximumDate
 * @param root0.minimumDate
 * @param root0.onChange
 * @param root0.placeholder
 * @param root0.value
 */
function DateField({
  label,
  maximumDate,
  minimumDate,
  onChange,
  value,
}) {
  const parsedValue = parseIsoDateValue(value) || undefined;
  return (
    <DateTimeSelector
      buttonStyle={{
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}
      buttonTextStyle={{
        textTransform: 'none',
      }}
      display="modal"
      label={label}
      mode="date"
      onChange={(nextDate) => {
        const boundedDate = clampDateToBounds(nextDate, minimumDate, maximumDate);
        if (!boundedDate) return;
        onChange(format(boundedDate, 'yyyy-MM-dd'));
      }}
      value={parsedValue}
    />
  );
}

/**
 *
 * @param root0
 * @param root0.amount
 * @param root0.currency
 * @param root0.onAmountChange
 * @param root0.onCurrencyChange
 */
function AmountField({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
}) {
  const { t } = useTranslation();
  const {
    Colors, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={Spaces.gap[16]}>
      <View style={Spaces.gap[8]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('clubLicenseCampaignSettings.amountField.currency', 'Devise')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {currencyOptions.map((option) => (
            <SelectionChip
              key={option.key}
              label={option.label}
              onPress={() => onCurrencyChange(option.key)}
              selected={currency === option.key}
            />
          ))}
        </View>
      </View>

      <View style={Spaces.gap[8]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t(
            'clubLicenseCampaignSettings.amountField.defaultPrice',
            'Prix par défaut ({{currency}})',
            { currency, ...SANS_ECHAPPEMENT },
          )}
        </Text>
        <TextInput
          inputMode="decimal"
          keyboardType="decimal-pad"
          onChangeText={(value) => onAmountChange(normalizeAmountInput(value))}
          placeholder="0,00"
          placeholderTextColor={Colors.neutral400}
          style={{
            borderBottomColor: Colors.neutral200,
            borderBottomWidth: 1,
            color: Colors.neutral00,
            fontFamily: Fonts.h2?.fontFamily,
            fontSize: 28,
            minHeight: 56,
            paddingVertical: 14,
          }}
          value={amount}
        />
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'clubLicenseCampaignSettings.amountField.hint',
            'Saisis simplement un montant, par exemple `250` ou `250,00`.',
          )}
        </Text>
      </View>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.enabled
 * @param root0.label
 * @param root0.onChange
 */
function PaymentModeToggle({ enabled, label, onChange }) {
  const {
    Alignments, Fonts,
  } = useTheme();

  return (
    <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1 }]}>{label}</Text>
      <Switch onValueChange={onChange} value={enabled} />
    </View>
  );
}

/**
 * Interrupteur avec sa ligne d'explication — grammaire des captures D26
 * (`03-paiement`, `05-relances`). Cible tactile portee par le `Switch` lui-meme.
 * @param {object} root0
 * @param {boolean} root0.enabled
 * @param {string} root0.label
 * @param {string} [root0.hint] - Ligne grise sous le libelle.
 * @param {(value: boolean) => void} root0.onChange
 * @returns {import('react').ReactElement}
 */
function SwitchRow({
  enabled, hint, label, onChange,
}) {
  const { Alignments, Fonts, Spaces } = useTheme();

  return (
    <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
      <View style={[Spaces.gap[4], { flex: 1, paddingRight: 16 }]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
        {hint ? <Text style={[Fonts.p3, Fonts.neutral200]}>{hint}</Text> : null}
      </View>
      <Switch onValueChange={onChange} value={enabled} />
    </View>
  );
}

/**
 * Rangee-valeur de 56 pt qui ouvre une feuille — c'est ce qui remplace les 16
 * etapes retirees de la barre de progression. La valeur de droite dit ce qui est
 * deja rempli, pour qu'on sache s'il faut l'ouvrir SANS l'ouvrir.
 * @param {object} root0
 * @param {string} root0.label
 * @param {string} root0.value
 * @param {() => void} root0.onPress
 * @returns {import('react').ReactElement}
 */
function ValueRow({ label, onPress, value }) {
  const {
    Alignments, Colors, Fonts,
  } = useTheme();

  return (
    <Pressable
      accessibilityHint={value}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, {
        borderColor: `${Colors.primary500}33`,
        borderRadius: licenseRadius.card,
        borderWidth: 1,
        minHeight: 56,
        paddingHorizontal: licenseSpacing.cardPadding,
        paddingVertical: 12,
      }]}
    >
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1, paddingRight: 12 }]}>{label}</Text>
      <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral300, { maxWidth: 150 }]}>{value}</Text>
      <Text style={[Fonts.p2Bold, { color: Colors.primary500, paddingLeft: 8 }]}>›</Text>
    </Pressable>
  );
}

/**
 * Rangee a cocher, bord 1,5 px en selection — grammaire des captures `02b`/`02c`.
 * @param {object} root0
 * @param {string} root0.label
 * @param {string} [root0.hint]
 * @param {boolean} root0.selected
 * @param {() => void} root0.onPress
 * @returns {import('react').ReactElement}
 */
function CheckRow({
  hint, label, onPress, selected,
}) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, {
        borderColor: selected ? Colors.primary500 : `${Colors.primary500}33`,
        borderRadius: licenseRadius.card,
        borderWidth: selected ? 1.5 : 1,
        minHeight: 52,
        paddingHorizontal: licenseSpacing.cardPadding,
        paddingVertical: 12,
      }]}
    >
      <View style={[Spaces.gap[4], { flex: 1, paddingRight: 12 }]}>
        <Text style={[Fonts.p2Bold, selected ? Fonts.neutral00 : Fonts.neutral100]}>{label}</Text>
        {hint ? <Text style={[Fonts.p3, Fonts.neutral300]}>{hint}</Text> : null}
      </View>
      <Text style={[Fonts.p2Bold, { color: selected ? Colors.primary500 : Colors.neutral300 }]}>
        {selected ? '✓' : ''}
      </Text>
    </Pressable>
  );
}

/**
 * Bascule a deux choix, style « Saison 2026-2027 / Dates libres » (capture `01`).
 * @param {object} root0
 * @param {{key: string, label: string}[]} root0.options
 * @param {string} root0.selectedKey
 * @param {(key: string) => void} root0.onSelect
 * @returns {import('react').ReactElement}
 */
function SegmentedPair({ onSelect, options, selectedKey }) {
  const { Alignments, Colors, Fonts } = useTheme();

  return (
    <View style={[Alignments.row, {
      backgroundColor: Colors.primary800,
      borderColor: `${Colors.primary500}33`,
      borderRadius: licenseRadius.pill,
      borderWidth: 1,
      padding: 4,
    }]}
    >
      {options.map((option) => {
        const selected = option.key === selectedKey;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={option.key}
            onPress={() => onSelect(option.key)}
            style={{
              alignItems: 'center',
              backgroundColor: selected ? Colors.primary500 : 'transparent',
              borderRadius: licenseRadius.pill,
              flex: 1,
              justifyContent: 'center',
              minHeight: 44,
              paddingHorizontal: 12,
            }}
          >
            <Text
              numberOfLines={1}
              style={[Fonts.p3Bold, selected ? Fonts.neutral900 : Fonts.neutral200]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Ligne « libelle a gauche, valeur a droite » du recapitulatif (capture `06`).
 * @param {object} root0
 * @param {string} root0.label
 * @param {string} root0.value
 * @returns {import('react').ReactElement}
 */
function SummaryLine({ label, value }) {
  const { Alignments, Fonts } = useTheme();

  return (
    <View style={[Alignments.row, Alignments.justifySpaceBetween, { alignItems: 'flex-start' }]}>
      <Text style={[Fonts.p3, Fonts.neutral200, { paddingRight: 12 }]}>{label}</Text>
      <Text style={[Fonts.p3Bold, Fonts.neutral00, Fonts.textRight, { flex: 1 }]}>{value}</Text>
    </View>
  );
}

/**
 * Entete de section du recapitulatif, avec son lien « Modifier » qui RENVOIE a
 * l'etape concernee. C'est ce qui rend acceptable un tunnel court : on relit
 * tout au meme endroit et on repart corriger d'un geste.
 * @param {object} root0
 * @param {string} root0.title
 * @param {() => void} root0.onEdit
 * @returns {import('react').ReactElement}
 */
function ReviewSectionHeader({ onEdit, title }) {
  const { t } = useTranslation();
  const { Alignments, Colors, Fonts } = useTheme();

  return (
    <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00, { flex: 1, paddingRight: 12 }]}>{title}</Text>
      <Pressable
        accessibilityLabel={t(
          'clubLicenseCampaignSettings.reviewSection.editA11y',
          'Modifier {{title}}',
          { title, ...SANS_ECHAPPEMENT },
        )}
        accessibilityRole="button"
        hitSlop={{
          bottom: 12, left: 12, right: 12, top: 12,
        }}
        onPress={onEdit}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
          {t('clubLicenseCampaignSettings.actions.edit', 'Modifier')}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Feuille standard du lot : poignee, titre 18/900, contenu, CTA plein +
 * « Annuler » en texte. C'est la SEULE forme de feuille du tunnel — les 8 du
 * pack de design passent toutes par ici.
 * @param {object} root0
 * @param {import('react').ReactNode} root0.children
 * @param {() => void} root0.close
 * @param {boolean} root0.isVisible
 * @param {string} root0.title
 * @param {string} [root0.confirmLabel]
 * @param {string} [root0.snapPoint]
 * @returns {import('react').ReactElement}
 */
function WizardSheet({
  children,
  close,
  confirmLabel = /** @type {string | undefined} */ (undefined),
  isVisible,
  snapPoint = '70%',
  title,
}) {
  const { t } = useTranslation();
  const shownConfirmLabel = confirmLabel === undefined
    ? t('clubLicenseCampaignSettings.sheet.done', 'Terminé')
    : confirmLabel;
  const { Fonts, Spaces } = useTheme();

  return (
    <BottomModal close={close} isVisible={isVisible} snapPoints={[snapPoint]}>
      <View style={Spaces.gap[16]}>
        <Text style={[Fonts.h4Black, Fonts.neutral00]}>{title}</Text>
        {children}
        <View style={Spaces.gap[8]}>
          <Button onPress={close} title={shownConfirmLabel} />
          <Pressable
            accessibilityRole="button"
            onPress={close}
            style={{ alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral300]}>
              {t('clubLicenseCampaignSettings.sheet.cancel', 'Annuler')}
            </Text>
          </Pressable>
        </View>
      </View>
    </BottomModal>
  );
}

// T03 — LA QUATRIEME COPIE DE LA MEME PASTILLE.
//
// Elle etait identique a celles du hub (palette, 12/8 de marge, `Fonts.p3Bold`)
// et souffrait du meme defaut : aucun centrage, aucune cible tactile de 44 pt.
// Elle pointe desormais sur la brique partagee, dans `licenseDesignSystem.js` —
// un centrage corrige une fois vaut pour les quatre. Le nom local reste : c est
// lui que lisent les 3 endroits de ce tunnel (roles cibles, statuts a relancer,
// et les pastilles de la feuille de cadence).
const SelectionChip = LicenseSelectionChip;

/**
 *
 * @param root0
 * @param root0.description
 * @param root0.onPress
 * @param root0.selected
 * @param root0.title
 */
function SuggestionCard({
  description,
  onPress,
  selected,
  title,
}) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts,
  } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[ApplicationStyle.card, {
        backgroundColor: selected ? Colors.primary700 : Colors.primary800,
        borderColor: selected ? `${Colors.primary500}88` : `${Colors.primary500}44`,
        borderRadius: licenseRadius.card,
        borderWidth: 1,
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }]}
    >
      <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{title}</Text>
        {selected ? (
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>
            {t('clubLicenseCampaignSettings.suggestionCard.selected', 'Sélectionnée')}
          </Text>
        ) : null}
      </View>
      <Text style={[Fonts.p2, selected ? Fonts.neutral00 : Fonts.neutral200, { lineHeight: 28 }]}>
        {description}
      </Text>
    </Pressable>
  );
}

/**
 *
 * @param root0
 * @param root0.description
 * @param root0.items
 * @param root0.label
 * @param root0.onToggle
 * @param root0.selectedKeys
 */
function SelectionGroup({
  description,
  items,
  label,
  onToggle,
  selectedKeys,
}) {
  const { t } = useTranslation();
  const { Fonts, Spaces } = useTheme();
  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
      {description ? <Text style={[Fonts.p3, Fonts.neutral200]}>{description}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(items || []).map((item) => (
          <SelectionChip
            key={item.key}
            label={item.label}
            onPress={() => onToggle(item.key)}
            selected={selectedKeys.includes(item.key)}
          />
        ))}
      </View>
      {!items?.length ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {t(
            'clubLicenseCampaignSettings.selectionGroup.empty',
            'Aucune option disponible pour ce filtre.',
          )}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * T03 — L ESPACE « MODELE A TELECHARGER » d un document demande.
 *
 * 🔒 Le fichier depose ici est visible par TOUS les membres du club. Il ne doit
 * donc jamais pouvoir etre confondu avec la piece qu un joueur depose : c est
 * pourquoi il vit dans les REGLAGES du document (ici), et pas dans la liste des
 * depots — et pourquoi le libelle rappelle, a l ecran, qui va le voir.
 *
 * Le fichier choisi est GARDE ici tant que la campagne n est pas enregistree :
 * une demande neuve n a pas encore d identifiant cote serveur, on ne peut donc
 * rien y accrocher. `persistCampaign` l envoie juste apres, en le disant.
 * @param {object} root0
 * @param {any} root0.item - Le brouillon du document demande.
 * @param {(patch: any) => void} root0.onChange
 * @returns {import('react').ReactElement}
 */
function TemplateFileRow({ item, onChange }) {
  const { t } = useTranslation();
  const { Colors, Fonts, Spaces } = useTheme();
  const nomDuModele = item.pickedTemplateFile?.name
    || (item.removedTemplate ? '' : item.templateFileName);

  // Y06 — ON N OUVRE QUE CE QUI EST ENREGISTRE.
  // Un fichier choisi (`pickedTemplateFile`) n est pas encore parti : il n a pas
  // d adresse, et un modele retire non plus. Dans ces deux cas, aucun bouton —
  // ⛔ un bouton qui ouvrirait le vide est pire que pas de bouton.
  const adresseDuModeleEnregistre = (!item.pickedTemplateFile && !item.removedTemplate)
    ? resolveMediaUrl(item.templateFileUrl || '')
    : '';

  const ouvrirLeModele = useCallback(async () => {
    if (!adresseDuModeleEnregistre) return;
    await LinksPlatform.openUrl(adresseDuModeleEnregistre);
  }, [adresseDuModeleEnregistre]);

  const choisirLeModele = useCallback(async () => {
    try {
      const picked = await MediaPlatform.pickDocument(getDocumentPickerOptions());
      const file = Array.isArray(picked) ? picked[0] : picked;
      if (!file) return;
      onChange({ pickedTemplateFile: file, removedTemplate: false });
    } catch (error) {
      if (isPickerCancelError(error)) return;
      Alert.alert(t(
        'clubLicenseCampaignSettings.template.unavailable.title',
        'Modèle indisponible',
      ), error?.message || t(
        'clubLicenseCampaignSettings.template.unavailable.message',
        'Ce fichier n a pas pu être lu.',
      ));
    }
  }, [onChange, t]);

  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
        {t('clubLicenseCampaignSettings.template.heading', 'MODÈLE À TÉLÉCHARGER')}
      </Text>
      <Text style={[Fonts.p3, Fonts.neutral300]}>
        {t(
          'clubLicenseCampaignSettings.template.notice',
          'Facultatif. Ce fichier est visible et téléchargeable par tous les membres '
            + 'concernés par la campagne — n y mets aucune pièce personnelle.',
        )}
      </Text>
      <Text
        style={[Fonts.p3, nomDuModele ? { color: Colors.primary500 } : Fonts.neutral300]}
        testID="license-modele-nom"
      >
        {nomDuModele || t('clubLicenseCampaignSettings.template.none', 'Aucun modèle')}
      </Text>
      {adresseDuModeleEnregistre ? (
        <Button
          onPress={ouvrirLeModele}
          title={t('clubLicenseCampaignSettings.template.view', 'Voir le modèle')}
          variant="Secondary"
        />
      ) : null}
      <Button
        onPress={choisirLeModele}
        title={nomDuModele ? t(
          'clubLicenseCampaignSettings.template.replace',
          'Remplacer le modèle',
        ) : t(
          'clubLicenseCampaignSettings.template.add',
          'Ajouter un modèle',
        )}
        variant="Secondary"
      />
      {nomDuModele ? (
        <Button
          onPress={() => onChange({ pickedTemplateFile: null, removedTemplate: true })}
          title={t('clubLicenseCampaignSettings.template.remove', 'Retirer le modèle')}
          variant="Secondary"
        />
      ) : null}
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.canRemove
 * @param root0.item
 * @param root0.onChange
 * @param root0.onRemove
 */
function DocumentRequestEditor({
  canRemove,
  item,
  onChange,
  onRemove,
}) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Spaces,
  } = useTheme();

  return (
    <View style={[ApplicationStyle.card, Spaces.gap[16], {
      backgroundColor: Colors.primary800,
      borderColor: `${Colors.primary500}33`,
      borderRadius: licenseRadius.card,
      paddingHorizontal: licenseSpacing.cardPadding,
      paddingVertical: licenseSpacing.cardPadding,
    }]}
    >
      <Field
        label={t('clubLicenseCampaignSettings.documentEditor.name', 'Nom du document')}
        onChangeText={(value) => onChange({ name: value })}
        placeholder={t(
          'clubLicenseCampaignSettings.documentEditor.namePlaceholder',
          'Certificat medical',
        )}
        value={item.name}
      />
      <Field
        label={t(
          'clubLicenseCampaignSettings.documentEditor.description',
          'Description / consigne',
        )}
        multiline
        onChangeText={(value) => onChange({ description: value })}
        placeholder={t(
          'clubLicenseCampaignSettings.documentEditor.descriptionPlaceholder',
          'Document officiel, date de moins de 12 mois...',
        )}
        value={item.description}
      />
      <DateField
        label={t('clubLicenseCampaignSettings.documentEditor.dueDate', 'Date limite de dépôt')}
        onChange={(value) => onChange({ dueDate: value })}
        placeholder={t(
          'clubLicenseCampaignSettings.documentEditor.dueDatePlaceholder',
          'Sélectionner une date',
        )}
        value={item.dueDate}
      />
      <Field
        label={t('clubLicenseCampaignSettings.documentEditor.formats', 'Formats acceptes')}
        onChangeText={(value) => onChange({ acceptedMimeTypesText: value })}
        placeholder="application/pdf, image/jpeg, image/png"
        value={item.acceptedMimeTypesText}
      />
      <PaymentModeToggle
        enabled={item.required}
        label={t('clubLicenseCampaignSettings.documentEditor.required', 'Document obligatoire')}
        onChange={(value) => onChange({ required: value })}
      />
      <PaymentModeToggle
        enabled={item.requiresManualValidation}
        label={t(
          'clubLicenseCampaignSettings.documentEditor.manualApproval',
          'Validation manuelle',
        )}
        onChange={(value) => onChange({ requiresManualValidation: value })}
      />
      <PaymentModeToggle
        enabled={item.requiresSignature}
        label={t('clubLicenseCampaignSettings.documentEditor.signature', 'Signature demandée')}
        onChange={(value) => onChange({ requiresSignature: value })}
      />
      {/*
        T03 — « UN ESPACE TELECHARGER LE MODELE » (Adel, recette du 2026-08-17).
        🔒 Ce fichier est vu par TOUS les membres du club : le libelle le dit, et
        il est pose sous les reglages du document, jamais a cote d un depot de
        joueur. Cote serveur, il vit sur une AUTRE table que les pieces
        personnelles (voir uploadDocumentRequestTemplate).
      */}
      <TemplateFileRow
        item={item}
        onChange={onChange}
      />
      {canRemove ? (
        <Button
          onPress={onRemove}
          title={t(
            'clubLicenseCampaignSettings.documentEditor.remove',
            'Retirer ce document',
          )}
          variant="Secondary"
        />
      ) : null}
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.categoryOptions
 * @param root0.item
 * @param root0.levelOptions
 * @param root0.onChange
 * @param root0.onRemove
 * @param root0.roleOptions
 * @param root0.sectionOptions
 * @param root0.teamOptions
 */
function PricingRuleEditor({
  categoryOptions,
  item,
  levelOptions,
  onChange,
  onRemove,
  roleOptions,
  sectionOptions,
  teamOptions,
}) {
  const { t } = useTranslation();
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const selectedMode = item.ruleType || 'role';
  const showRole = selectedMode === 'role';
  const showTeam = selectedMode === 'team';
  const showCategory = selectedMode === 'category';
  const showSection = selectedMode === 'section';
  const showLevel = selectedMode === 'level';

  return (
    <View style={[ApplicationStyle.card, Spaces.gap[16], {
      backgroundColor: Colors.primary800,
      borderColor: `${Colors.primary500}33`,
      borderRadius: licenseRadius.card,
      paddingHorizontal: licenseSpacing.cardPadding,
      paddingVertical: licenseSpacing.cardPadding,
    }]}
    >
      <Field
        label={t('clubLicenseCampaignSettings.pricingRuleEditor.label', 'Libellé interne')}
        onChangeText={(value) => onChange({ label: value })}
        placeholder={t(
          'clubLicenseCampaignSettings.pricingRuleEditor.labelPlaceholder',
          'Tarif joueurs seniors',
        )}
        value={item.label}
      />
      <View style={Spaces.gap[8]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
          {t('clubLicenseCampaignSettings.pricingRuleEditor.ruleType', 'Type de règle')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(pricingRuleLabels).map(([ruleType, label]) => (
            <SelectionChip
              key={ruleType}
              label={label}
              onPress={() => onChange({ ruleType })}
              selected={selectedMode === ruleType}
            />
          ))}
        </View>
      </View>
      {showRole ? (
        <SelectionGroup
          items={roleOptions.map((option) => ({ key: option.key, label: option.label }))}
          label={t('clubLicenseCampaignSettings.pricingRuleEditor.roles', 'Rôles concernés')}
          onToggle={(value) => onChange({ roleName: item.roleName === value ? '' : value })}
          selectedKeys={item.roleName ? [item.roleName] : []}
        />
      ) : null}
      {showTeam ? (
        <SelectionGroup
          items={teamOptions}
          label={t('clubLicenseCampaignSettings.pricingRuleEditor.team', 'Équipe concernee')}
          onToggle={(value) => onChange({ teamKey: item.teamKey === value ? '' : value })}
          selectedKeys={item.teamKey ? [item.teamKey] : []}
        />
      ) : null}
      {showCategory ? (
        <SelectionGroup
          items={categoryOptions}
          label={t('clubLicenseCampaignSettings.pricingRuleEditor.category', 'Catégorie concernee')}
          onToggle={(value) => onChange({ categoryKey: item.categoryKey === value ? '' : value })}
          selectedKeys={item.categoryKey ? [item.categoryKey] : []}
        />
      ) : null}
      {showSection ? (
        <SelectionGroup
          items={sectionOptions}
          label={t('clubLicenseCampaignSettings.pricingRuleEditor.section', 'Section concernee')}
          onToggle={(value) => onChange({ sectionKey: item.sectionKey === value ? '' : value })}
          selectedKeys={item.sectionKey ? [item.sectionKey] : []}
        />
      ) : null}
      {showLevel ? (
        <SelectionGroup
          items={levelOptions}
          label={t('clubLicenseCampaignSettings.pricingRuleEditor.level', 'Niveau concerne')}
          onToggle={(value) => onChange({ levelKey: item.levelKey === value ? '' : value })}
          selectedKeys={item.levelKey ? [item.levelKey] : []}
        />
      ) : null}
      <Field
        inputMode="decimal"
        keyboardType="decimal-pad"
        label={t('clubLicenseCampaignSettings.pricingRuleEditor.amount', 'Montant (EUR)')}
        onChangeText={(value) => onChange({ amount: normalizeAmountInput(value) })}
        placeholder="180"
        value={item.amount}
      />
      <Field
        inputMode="numeric"
        keyboardType="number-pad"
        label={t('clubLicenseCampaignSettings.pricingRuleEditor.priority', 'Priorite')}
        onChangeText={(value) => onChange({ priority: normalizeWholeNumberInput(value) })}
        placeholder="10"
        value={item.priority}
      />
      <PaymentModeToggle
        enabled={item.isWaiver}
        label={t('clubLicenseCampaignSettings.pricingRuleEditor.waiver', 'Exoneration automatique')}
        onChange={(value) => onChange({ isWaiver: value })}
      />
      <Button
        onPress={onRemove}
        title={t(
          'clubLicenseCampaignSettings.pricingRuleEditor.remove',
          'Retirer cette règle',
        )}
        variant="Secondary"
      />
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function ClubLicenseCampaignSettings({ navigation, route }) {
  const { t } = useTranslation();
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const clubId = route?.params?.clubId;
  const routeCampaignId = route?.params?.campaignId;
  const routeCampaign = route?.params?.campaign;
  const routeEventId = String(route?.params?.eventId || '').trim();
  const routeEvent = route?.params?.event || null;
  const [subscriptionPaywallDecision, setSubscriptionPaywallDecision] = useState(null);
  // R01 — LA CAMPAGNE MODIFIEE VIENT DE LA ROUTE, ELLE NE SE DEDUIT JAMAIS.
  //
  // Avant le 2026-08-13, l intention se lisait sur `createNew` : sans lui, cet
  // ecran allait chercher LA CAMPAGNE COURANTE du club et enregistrait par-dessus
  // (l. 1895). Le hub club ne l a jamais passe (ClubLicenses.js:2190) : « + Nouvelle
  // campagne » ECRASAIT donc la campagne en cours au lieu d en creer une. Constate
  // par Adel en recette — il l a vu comme une suppression.
  // `createNew` reste accepte par compatibilite avec les appelants qui le passent
  // deja (EventDetails.js:2584), mais il ne decide plus rien : seule l absence de
  // `campaignId` dans la route decide, et elle veut dire « on cree ».
  const createNewCampaign = !routeCampaignId;
  const todayIsoDateValue = useMemo(() => getTodayIsoDateValue(), []);
  const eventCampaignDefaults = useMemo(() => buildEventCampaignDefaults({
    event: routeEvent,
    eventId: routeEventId,
    todayIsoDateValue,
  }), [routeEvent, routeEventId, todayIsoDateValue]);
  const campaignQuery = useCurrentLicenseCampaign(useMemo(() => ({ clubId, includeDraft: true }), [clubId]), { enabled: Boolean(clubId && !routeCampaignId && !createNewCampaign) });
  const campaignByIdQuery = useLicenseCampaign(routeCampaignId, { enabled: Boolean(routeCampaignId) });
  const currentCampaign = createNewCampaign ? routeCampaign : campaignQuery.data;
  const campaign = routeCampaignId ? (campaignByIdQuery.data || routeCampaign) : currentCampaign;
  const clubQuery = useGetClub(clubId, { enabled: Boolean(clubId) });
  const sectionsQuery = useGetSections();
  const categoriesQuery = useGetCategories();
  const levelsQuery = useGetLevels();
  const campaignIsLoading = routeCampaignId ? !campaign && campaignByIdQuery.isLoading : (!createNewCampaign && campaignQuery.isLoading);
  const campaignHasError = routeCampaignId ? !campaign && campaignByIdQuery.isError : (!createNewCampaign && campaignQuery.isError);
  // R01 — LA CIBLE DE L ENREGISTREMENT, elle aussi, ne vient que de la route.
  // Un `campaign` passe en parametre sans `campaignId` sert alors de PRE-REMPLISSAGE
  // et rien de plus : on part de ses valeurs, on enregistre une campagne NEUVE.
  const campaignId = routeCampaignId || null;
  const club = clubQuery.data;
  const clubMembers = useMemo(() => [...(club?.members || [])].sort((left, right) => (
    `${left?.firstname || ''} ${left?.lastname || ''}`.localeCompare(`${right?.firstname || ''} ${right?.lastname || ''}`, 'fr', {
      sensitivity: 'base',
    })
  )), [club?.members]);
  const roleOptions = useMemo(() => {
    const canonicalOptions = licenseRoleFilterKeys.map((roleKey) => ({
      key: USER_ROLES[roleKey],
      label: USER_ROLES[roleKey],
      sortLabel: USER_ROLES[roleKey],
    }));
    const extraOptions = [];
    const seenKeys = new Set(canonicalOptions.map((option) => option.key));

    clubMembers.forEach((member) => {
      const rawRoleName = String(member?.role?.name || member?.role?.type || '').trim();
      if (!rawRoleName) return;

      const normalizedRoleKey = getUserRoleKey(rawRoleName);
      if (normalizedRoleKey === 'superAdmin' || normalizedRoleKey === 'new') {
        return;
      }

      const canonicalRoleLabel = USER_ROLES[normalizedRoleKey];
      const nextKey = canonicalRoleLabel || rawRoleName;
      if (seenKeys.has(nextKey)) return;
      seenKeys.add(nextKey);
      extraOptions.push({
        key: nextKey,
        label: nextKey,
        sortLabel: rawRoleName,
      });
    });

    return [...canonicalOptions, ...extraOptions]
      .sort((left, right) => left.sortLabel.localeCompare(right.sortLabel, 'fr', { sensitivity: 'base' }))
      .map(({ key, label }) => ({ key, label }));
  }, [clubMembers]);
  const teamOptions = useMemo(() => [...(club?.teams || [])]
    .filter((team) => referenceKey(team))
    .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''), 'fr', { sensitivity: 'base' }))
    .map((team) => ({ key: referenceKey(team), label: team?.name || 'Equipe' })), [club?.teams]);
  const sectionOptions = useMemo(() => [...(sectionsQuery.data || [])]
    .filter((section) => referenceKey(section))
    .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''), 'fr', { sensitivity: 'base' }))
    .map((section) => ({ key: referenceKey(section), label: section?.name || 'Section' })), [sectionsQuery.data]);
  const categoryOptions = useMemo(() => [...(categoriesQuery.data || [])]
    .filter((category) => referenceKey(category))
    .sort(compareCategories)
    .map((category) => ({ key: referenceKey(category), label: category?.name || 'Categorie' })), [categoriesQuery.data]);
  const levelOptions = useMemo(() => [...(levelsQuery.data || [])]
    .filter((level) => referenceKey(level))
    .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''), 'fr', { sensitivity: 'base' }))
    .map((level) => ({ key: referenceKey(level), label: level?.name || 'Niveau' })), [levelsQuery.data]);
  const initialCampaignName = String(campaign?.name || eventCampaignDefaults?.name || '').trim();
  const [seasonLabel, setSeasonLabel] = useState(campaign?.seasonLabel || detectSeasonLabelFromDates({
    endDate: campaign?.endDate || eventCampaignDefaults?.endDate,
    startDate: campaign?.startDate || eventCampaignDefaults?.startDate,
  }));
  const [seasonLabelManuallyEdited, setSeasonLabelManuallyEdited] = useState(Boolean(campaign?.seasonLabel));
  const [name, setName] = useState(initialCampaignName);
  const [nameAutoManaged, setNameAutoManaged] = useState(!initialCampaignName);
  const [type, setType] = useState(campaign?.type || eventCampaignDefaults?.type || 'license');
  const [description, setDescription] = useState(campaign?.description || eventCampaignDefaults?.description || '');
  const [startDate, setStartDate] = useState(campaign?.startDate || eventCampaignDefaults?.startDate || todayIsoDateValue);
  const [endDate, setEndDate] = useState(campaign?.endDate || eventCampaignDefaults?.endDate || todayIsoDateValue);
  const [internalNote, setInternalNote] = useState(campaign?.internalNote || '');
  const [currency, setCurrency] = useState(String(campaign?.currency || 'EUR').toUpperCase());
  const [amount, setAmount] = useState(campaign?.defaultAmountCents ? centsToEuro(campaign.defaultAmountCents) : (eventCampaignDefaults?.amount || centsToEuro(0)));
  const [overdueAfterDate, setOverdueAfterDate] = useState(campaign?.dueDate || '');
  const [allowInstallments, setAllowInstallments] = useState(Boolean(campaign?.allowInstallments));
  const [installmentCount, setInstallmentCount] = useState(String(campaign?.installmentCount || 3));
  const [installmentFrequency, setInstallmentFrequency] = useState(campaign?.installmentFrequency || 'monthly');
  const [memberInstallmentChoiceAllowed, setMemberInstallmentChoiceAllowed] = useState(Boolean(campaign?.memberInstallmentChoiceAllowed));
  const [onlineInstallmentsEnabled, setOnlineInstallmentsEnabled] = useState(Boolean(campaign?.onlineInstallmentsEnabled));
  const [onlinePaymentRequired, setOnlinePaymentRequired] = useState(Boolean(campaign?.onlinePaymentRequired));
  const [installmentSchedule, setInstallmentSchedule] = useState(() => normalizeInstallmentSchedule(campaign));
  const [externalUrl, setExternalUrl] = useState(campaign?.externalPaymentUrl || '');
  const [paymentModes, setPaymentModes] = useState({ ...defaultPaymentModes, ...normalizePaymentModes(campaign?.paymentModes) });
  const [paymentOwner, setPaymentOwner] = useState(campaign?.paymentOwner || 'section');
  const [helloAssoSnapshot, setHelloAssoSnapshot] = useState(() => getHelloAssoSnapshot(campaign));
  const [bankTransferInstructions, setBankTransferInstructions] = useState(campaign?.bankTransferInstructions || '');
  const [cashInstructions, setCashInstructions] = useState(campaign?.cashInstructions || '');
  const [checkInstructions, setCheckInstructions] = useState(campaign?.checkInstructions || '');
  const [cardPhysicalInstructions, setCardPhysicalInstructions] = useState(campaign?.cardPhysicalInstructions || '');
  const [reminderMessage, setReminderMessage] = useState(campaign?.reminderMessage || '');
  const [documentRequests, setDocumentRequests] = useState(() => normalizeDocumentRequests(campaign));
  const [removedDocumentRequestIds, setRemovedDocumentRequestIds] = useState([]);
  const [pricingRules, setPricingRules] = useState(() => normalizePricingRules(campaign));
  const [removedPricingRuleIds, setRemovedPricingRuleIds] = useState([]);
  const [targetConfig, setTargetConfig] = useState(() => (
    /** @type {any} */ (eventCampaignDefaults?.targetConfig || createTargetConfigDraft(campaign))
  ));
  const initialAutomation = normalizeReminderAutomation(campaign);
  const [autoReminderEnabled, setAutoReminderEnabled] = useState(initialAutomation.enabled);
  const [reminderBeforeDueDays, setReminderBeforeDueDays] = useState(initialAutomation.beforeDueDays);
  const [reminderAfterDueDays, setReminderAfterDueDays] = useState(initialAutomation.afterDueDays);
  const [reminderFrequencyDays, setReminderFrequencyDays] = useState(initialAutomation.frequencyDays);
  const [reminderMaxCount, setReminderMaxCount] = useState(initialAutomation.maxCount);
  const [reminderOnDueDate, setReminderOnDueDate] = useState(initialAutomation.onDueDate);
  const [reminderStartDate, setReminderStartDate] = useState(initialAutomation.startDate);
  const [reminderTargetStatuses, setReminderTargetStatuses] = useState(initialAutomation.targetStatuses);
  const [wizardStepIndex, setWizardStepIndex] = useState(0);
  // Une seule feuille ouverte a la fois : `null`, ou la cle de la feuille.
  // Les 8 feuilles du pack de design remplacent les 16 etapes retirees.
  const [openSheet, setOpenSheet] = useState(/** @type {string | null} */ (null));
  const [editedPricingRuleId, setEditedPricingRuleId] = useState(/** @type {string | null} */ (null));
  const [editedDocumentRequestId, setEditedDocumentRequestId] = useState(
    /** @type {string | null} */ (null),
  );
  const currentSeason = useMemo(() => getCurrentSeasonRange(), []);
  // « Saison en cours » ou « Dates libres » : deduit des dates DEJA enregistrees,
  // pour qu'une campagne existante rouvre sur le bon choix sans rien deviner.
  const [periodMode, setPeriodMode] = useState(() => (
    !campaign || (campaign.startDate === currentSeason.startDate
      && campaign.endDate === currentSeason.endDate)
      ? 'season'
      : 'custom'
  ));
  const allowScreenExitRef = useRef(false);
  const isEventParticipantTarget = /** @type {any} */ (targetConfig).source === 'event_participants';

  useEffect(() => {
    if (!campaign) {
      if (!eventCampaignDefaults) return;
      setName(eventCampaignDefaults.name || '');
      setNameAutoManaged(!String(eventCampaignDefaults.name || '').trim());
      setType(eventCampaignDefaults.type || 'other');
      setDescription(eventCampaignDefaults.description || '');
      setSeasonLabel(detectSeasonLabelFromDates({
        endDate: eventCampaignDefaults.endDate,
        startDate: eventCampaignDefaults.startDate,
      }));
      setSeasonLabelManuallyEdited(false);
      setStartDate(eventCampaignDefaults.startDate || todayIsoDateValue);
      setEndDate(eventCampaignDefaults.endDate || todayIsoDateValue);
      setAmount(eventCampaignDefaults.amount || centsToEuro(0));
      setTargetConfig(eventCampaignDefaults.targetConfig);
      return;
    }
    const automation = normalizeReminderAutomation(campaign);
    setName(campaign.name || '');
    setNameAutoManaged(!String(campaign.name || '').trim());
    setType(campaign.type || 'license');
    setDescription(campaign.description || '');
    setSeasonLabel(campaign.seasonLabel || detectSeasonLabelFromDates({
      endDate: campaign.endDate,
      startDate: campaign.startDate,
    }));
    setSeasonLabelManuallyEdited(Boolean(campaign.seasonLabel));
    setStartDate(campaign.startDate || todayIsoDateValue);
    setEndDate(campaign.endDate || todayIsoDateValue);
    setInternalNote(campaign.internalNote || '');
    setCurrency(String(campaign.currency || 'EUR').toUpperCase());
    setAmount(centsToEuro(campaign.defaultAmountCents || 0));
    setOverdueAfterDate(campaign.dueDate || '');
    setAllowInstallments(Boolean(campaign.allowInstallments));
    setInstallmentCount(String(campaign.installmentCount || 3));
    setInstallmentFrequency(campaign.installmentFrequency || 'monthly');
    setMemberInstallmentChoiceAllowed(Boolean(campaign.memberInstallmentChoiceAllowed));
    setOnlineInstallmentsEnabled(Boolean(campaign.onlineInstallmentsEnabled));
    setOnlinePaymentRequired(Boolean(campaign.onlinePaymentRequired));
    setInstallmentSchedule(normalizeInstallmentSchedule(campaign));
    setExternalUrl(campaign.externalPaymentUrl || '');
    setPaymentModes({ ...defaultPaymentModes, ...normalizePaymentModes(campaign.paymentModes) });
    setPaymentOwner(campaign.paymentOwner || 'section');
    setHelloAssoSnapshot(getHelloAssoSnapshot(campaign));
    setBankTransferInstructions(campaign.bankTransferInstructions || '');
    setCashInstructions(campaign.cashInstructions || '');
    setCheckInstructions(campaign.checkInstructions || '');
    setCardPhysicalInstructions(campaign.cardPhysicalInstructions || '');
    setReminderMessage(campaign.reminderMessage || '');
    setDocumentRequests(normalizeDocumentRequests(campaign));
    setRemovedDocumentRequestIds([]);
    setPricingRules(normalizePricingRules(campaign));
    setRemovedPricingRuleIds([]);
    setTargetConfig(createTargetConfigDraft(campaign));
    setAutoReminderEnabled(automation.enabled);
    setReminderBeforeDueDays(automation.beforeDueDays);
    setReminderAfterDueDays(automation.afterDueDays);
    setReminderFrequencyDays(automation.frequencyDays);
    setReminderMaxCount(automation.maxCount);
    setReminderOnDueDate(automation.onDueDate);
    setReminderStartDate(automation.startDate);
    setReminderTargetStatuses(automation.targetStatuses);
  }, [campaign, eventCampaignDefaults, todayIsoDateValue]);

  const updateDocumentRequest = useCallback((localId, patch) => {
    setDocumentRequests((currentItems) => currentItems.map((item) => (
      item.localId === localId ? { ...item, ...patch } : item
    )));
  }, []);

  const removeDocumentRequest = useCallback((localId) => {
    setDocumentRequests((currentItems) => {
      const target = currentItems.find((item) => item.localId === localId);
      if (target?.documentId) {
        setRemovedDocumentRequestIds((currentIds) => (
          currentIds.includes(target.documentId)
            ? currentIds
            : [...currentIds, target.documentId]
        ));
      }
      const nextItems = currentItems.filter((item) => item.localId !== localId);
      return nextItems.length ? nextItems : [createDocumentRequestDraft()];
    });
  }, []);

  const updatePricingRule = useCallback((localId, patch) => {
    setPricingRules((currentItems) => currentItems.map((item) => (
      item.localId === localId ? { ...item, ...patch } : item
    )));
  }, []);

  const removePricingRule = useCallback((localId) => {
    setPricingRules((currentItems) => {
      const target = currentItems.find((item) => item.localId === localId);
      if (target?.ruleId) {
        setRemovedPricingRuleIds((currentIds) => (
          currentIds.includes(target.ruleId)
            ? currentIds
            : [...currentIds, target.ruleId]
        ));
      }
      return currentItems.filter((item) => item.localId !== localId);
    });
  }, []);

  const toggleTargetValue = useCallback((field, value, isRole = false) => {
    setTargetConfig((current) => ({
      ...current,
      [field]: isRole ? toggleRole(current[field], value) : toggleKey(current[field], value),
    }));
  }, []);

  // ⛔ L'effet qui completait l'echeancier avec des lignes VIDES libellees « 1 »,
  // « 2 », « 3 » est retire : c'est exactement la resaisie manuelle que D26
  // supprime. Le nombre d'echeances passe desormais par
  // `handleInstallmentCountChange`, qui REGENERE les lignes avec leurs montants.
  //
  // Ce qui reste ici soigne l'HERITAGE : les campagnes deja en base portent
  // justement ces lignes vides, creees par l'ancien effet. Sans montant, elles
  // partent au serveur avec `amountCents: null`. On ne les remplit qu'a cette
  // condition — un echeancier saisi a la main n'est jamais ecrase.
  useEffect(() => {
    if (!allowInstallments) return;
    setInstallmentSchedule((currentItems) => {
      const expectedCount = Math.max(1, Number(installmentCount) || 1);
      const isIncomplete = currentItems.length < expectedCount
        || currentItems.slice(0, expectedCount).some((item) => !item.amount?.trim());
      if (!isIncomplete) return currentItems;
      return generateInstallmentSchedule({
        count: expectedCount,
        frequency: installmentFrequency,
        startDate,
        totalCents: euroToCents(amount),
      });
    });
  }, [allowInstallments, amount, installmentCount, installmentFrequency, startDate]);

  const enabledPaymentModeLabels = useMemo(() => Object.entries(paymentModes)
    .filter(([, enabled]) => enabled)
    .map(([mode]) => paymentModeLabels[mode] || mode), [paymentModes]);

  const normalizedInstallmentSchedule = useMemo(() => {
    if (!allowInstallments) return [];
    const desiredCount = Math.max(1, Number(installmentCount) || 1);
    return installmentSchedule.slice(0, desiredCount).map((item, index) => ({
      amountCents: item.amount.trim() ? euroToCents(item.amount) : null,
      dueDate: item.dueDate.trim() || null,
      frequency: item.frequency || installmentFrequency || 'monthly',
      label: item.label.trim() || `${index + 1}/${desiredCount}`,
    }));
  }, [allowInstallments, installmentCount, installmentFrequency, installmentSchedule]);
  // L'echeancier GENERE : montant divise par N, arrondi au centime, somme exacte.
  // Il est recalcule a chaque changement de montant / nombre / frequence tant que
  // le dirigeant n'a pas repris la main dans la feuille « Ajuster ».
  const generatedInstallmentSchedule = useMemo(() => generateInstallmentSchedule({
    count: installmentCount,
    frequency: installmentFrequency,
    startDate,
    totalCents: euroToCents(amount),
  }), [amount, installmentCount, installmentFrequency, startDate]);
  // Ce que le dirigeant VOIT dans la feuille : l'echeancier reellement enregistre,
  // jamais un apercu theorique. Une campagne ancienne peut porter des montants
  // saisis a la main — les remplacer d'office par le calcul serait un mensonge.
  const visibleInstallmentSchedule = useMemo(() => (
    installmentSchedule.slice(0, Math.max(1, Number(installmentCount) || 1))
  ), [installmentCount, installmentSchedule]);
  const installmentSummaryText = useMemo(() => {
    if (!allowInstallments) {
      return t(
        'clubLicenseCampaignSettings.installments.singlePayment',
        'Paiement en une fois',
      );
    }
    const firstAmountCents = euroToCents(visibleInstallmentSchedule[0]?.amount || '0');
    const frequencyLabel = installmentFrequencyOptions
      .find((option) => option.key === installmentFrequency)?.label || t(
      'clubLicenseCampaignSettings.installmentFrequency.monthly',
      'Mensuelle',
    );
    return [
      `${visibleInstallmentSchedule.length} × ${formatLicenseMoney(firstAmountCents, currency)}`,
      String(frequencyLabel).toLowerCase(),
      t('clubLicenseCampaignSettings.installments.autoGenerated', 'généré automatiquement'),
    ].join(' · ');
  }, [allowInstallments, currency, installmentFrequency, visibleInstallmentSchedule, t]);
  const filledPaymentInstructionCount = useMemo(() => [
    paymentModes.bank_transfer && bankTransferInstructions.trim(),
    paymentModes.cash && cashInstructions.trim(),
    paymentModes.check && checkInstructions.trim(),
    paymentModes.card_physical && cardPhysicalInstructions.trim(),
  ].filter(Boolean).length, [
    bankTransferInstructions,
    cardPhysicalInstructions,
    cashInstructions,
    checkInstructions,
    paymentModes.bank_transfer,
    paymentModes.card_physical,
    paymentModes.cash,
    paymentModes.check,
  ]);
  // Les statuts EN FRANCAIS, jamais « pending, partial, overdue » : c'est le
  // libelle qui est traduit, la cle enregistree ne bouge pas d'un caractere.
  const reminderStatusSummary = useMemo(() => (
    reminderStatusOptions
      .filter((option) => reminderTargetStatuses.includes(option.key))
      .map((option) => option.label)
      .join(' · ') || t('clubLicenseCampaignSettings.reminders.noStatus', 'Aucun statut')
  ), [reminderTargetStatuses, t]);
  // Les personnes reellement touchees, comptees sur la liste du club — pas une
  // estimation. Le compteur de la maquette (« 2 personnes concernées ») exige un
  // chiffre vrai, sinon il ne vaut pas mieux que le « 0 rôle(s), 0 équipe(s) »
  // qu'il remplace.
  const countMembersForRoles = useCallback((roleLabels) => {
    if (!roleLabels.length) return 0;
    return clubMembers.filter((member) => {
      const rawRoleName = String(member?.role?.name || member?.role?.type || '').trim();
      if (!rawRoleName) return false;
      const canonicalRoleLabel = USER_ROLES[getUserRoleKey(rawRoleName)] || rawRoleName;
      return roleLabels.includes(canonicalRoleLabel);
    }).length;
  }, [clubMembers]);
  const concernedMemberCount = useMemo(() => {
    if (targetConfig.includeAllMembers) return clubMembers.length;
    return countMembersForRoles(targetConfig.roles);
  }, [clubMembers.length, countMembersForRoles, targetConfig.includeAllMembers, targetConfig.roles]);
  // Un filtre par categorie / section / niveau ne figure dans AUCUNE des 16
  // captures. On ne le retire pas pour autant : une campagne qui en porte un
  // deja doit pouvoir le modifier, sinon l'ecran ment sur ce qui est enregistre.
  const hasLegacyTargetFilters = Boolean(
    targetConfig.categoryIds.length
    || targetConfig.sectionIds.length
    || targetConfig.levelIds.length,
  );
  const campaignStartDateValue = useMemo(() => parseIsoDateValue(startDate), [startDate]);
  const maximumCampaignStartDate = useMemo(() => parseIsoDateValue(endDate), [endDate]);
  const minimumCampaignEndDate = useMemo(() => parseIsoDateValue(startDate), [startDate]);
  const detectedSeasonLabel = useMemo(() => detectSeasonLabelFromDates({
    endDate,
    startDate,
  }), [endDate, startDate]);

  useEffect(() => {
    if (!seasonLabelManuallyEdited && detectedSeasonLabel) {
      setSeasonLabel(detectedSeasonLabel);
    }
  }, [detectedSeasonLabel, seasonLabelManuallyEdited]);

  const reminderPreviewMessage = useMemo(() => renderReminderPreview({
    campaignName: name,
    dueDate: isoToPickerDateValue(overdueAfterDate) || overdueAfterDate,
    message: reminderMessage,
    totalLabel: `${String(amount || '180').trim().replace(',', '.')} ${currency}`,
  }), [amount, currency, name, overdueAfterDate, reminderMessage]);
  const campaignNameSuggestions = useMemo(() => buildCampaignNameSuggestions({
    seasonLabel,
    type,
  }), [seasonLabel, type]);
  const campaignDescriptionSuggestions = useMemo(() => buildCampaignDescriptionSuggestions({
    seasonLabel,
    type,
  }), [seasonLabel, type]);
  const internalNoteSuggestions = useMemo(() => buildInternalNoteSuggestions({
    seasonLabel,
    type,
  }), [seasonLabel, type]);

  useEffect(() => {
    if (!nameAutoManaged) return;
    const nextSuggestedName = campaignNameSuggestions[0] || '';
    if (!nextSuggestedName) return;
    if (String(name || '').trim() === nextSuggestedName) return;
    setName(nextSuggestedName);
  }, [campaignNameSuggestions, name, nameAutoManaged]);

  const hasOfflineInstructions = Boolean(
    paymentModes.bank_transfer
    || paymentModes.cash
    || paymentModes.check
    || paymentModes.card_physical,
  );
  const canPublishFromWizard = !campaign?.status || campaign?.status === 'draft';
  const publishTargetStatus = useMemo(
    () => (startDate && startDate > todayIsoDateValue ? 'scheduled' : 'active'),
    [startDate, todayIsoDateValue],
  );
  const activeWizardStep = licenseCampaignWizardSteps[wizardStepIndex]
    || licenseCampaignWizardSteps[0];
  const wizardStepCount = licenseCampaignWizardSteps.length;
  // La maquette titre la premiere etape « Nouvelle campagne » : c'est vrai a la
  // creation, faux quand le dirigeant revient modifier une campagne existante.
  const activeWizardStepTitle = activeWizardStep.key === 'identity' && !campaignId
    ? t('clubLicenseCampaignSettings.wizard.newCampaign', 'Nouvelle campagne')
    : activeWizardStep.title;
  const isOnLastWizardStep = wizardStepIndex >= wizardStepCount - 1;
  // Sur la derniere etape, le bouton du bas OUVRE la campagne et le lien texte
  // sous lui l'enregistre en brouillon (capture `06`). Avant D26, la seule action
  // du bas etait « Enregistrer le brouillon » et « Ouvrir » etait un bouton perdu
  // dans le contenu, au-dessus du pli.
  const finalSaveLabel = useMemo(() => {
    if (!isOnLastWizardStep) return t('clubLicenseCampaignSettings.wizard.next', 'Suivant');
    if (!canPublishFromWizard) return t('clubLicenseCampaignSettings.wizard.save', 'Enregistrer');
    return publishTargetStatus === 'scheduled' ? t(
      'clubLicenseCampaignSettings.wizard.schedule',
      'Programmer la campagne',
    ) : t(
      'clubLicenseCampaignSettings.wizard.open',
      'Ouvrir la campagne',
    );
  }, [canPublishFromWizard, isOnLastWizardStep, publishTargetStatus, t]);
  const wizardSkipLabel = useMemo(() => {
    if (isOnLastWizardStep) {
      return canPublishFromWizard ? t(
        'clubLicenseCampaignSettings.wizard.saveDraft',
        'Enregistrer en brouillon',
      ) : '';
    }
    return activeWizardStep.key === 'documents' ? t(
      'clubLicenseCampaignSettings.wizard.skipStep',
      'Passer cette étape',
    ) : '';
  }, [activeWizardStep.key, canPublishFromWizard, isOnLastWizardStep, t]);
  // Le tunnel ne fait plus que LIRE l'etat de la connexion HelloAsso du club.
  // Le formulaire (slug, client id, client secret) vit dans le hub — D26,
  // decision 4 : ce reglage porte un `clubId`, jamais un `campaignId`.
  const effectiveHelloAssoSnapshot = helloAssoSnapshot || getHelloAssoSnapshot(campaign);
  const helloAssoIsPublishReady = isHelloAssoReadyForCampaign(effectiveHelloAssoSnapshot);
  const helloAssoStatusMessage = describeHelloAssoReadiness(effectiveHelloAssoSnapshot);

  const saveMutation = useLicenseMutation(async (persistOptions = {}) => {
    const frequencyDays = Math.max(3, Number(reminderFrequencyDays) || 14);
    const maxCount = Math.max(1, Number(reminderMaxCount) || 5);
    const normalizedTargetConfig = normalizeTargetConfigPayload(targetConfig);
    const activeDocumentRequests = documentRequests
      .map((item, index) => ({
        acceptedMimeTypes: parseAcceptedMimeTypes(item.acceptedMimeTypesText),
        description: item.description.trim(),
        documentId: item.documentId,
        dueDate: item.dueDate.trim(),
        name: item.name.trim(),
        required: item.required !== false,
        requiresManualValidation: item.requiresManualValidation !== false,
        requiresSignature: item.requiresSignature === true,
        sortOrder: index + 1,
      }))
      .filter((item) => item.name);
    const payload = {
      allowInstallments,
      bankTransferInstructions,
      cardPhysicalInstructions,
      cashInstructions,
      checkInstructions,
      clubId,
      currency,
      defaultAmountCents: euroToCents(amount),
      description,
      documentConfig: activeDocumentRequests.length
        ? {
          items: activeDocumentRequests.map((item) => ({
            acceptedMimeTypes: item.acceptedMimeTypes,
            description: item.description || null,
            dueDate: item.dueDate || null,
            name: item.name,
            required: item.required,
            requiresManualValidation: item.requiresManualValidation,
            requiresSignature: item.requiresSignature,
            sortOrder: item.sortOrder,
          })),
          requiredCount: activeDocumentRequests.filter((item) => item.required).length,
        }
        : null,
      endDate: endDate.trim() || null,
      dueDate: overdueAfterDate.trim() || null,
      eventId: isEventParticipantTarget
        ? (/** @type {any} */ (targetConfig).eventId || routeEventId)
        : undefined,
      externalPaymentUrl: externalUrl,
      internalNote,
      installmentCount: Number(installmentCount) || 1,
      installmentFrequency,
      installmentSchedule: allowInstallments ? normalizedInstallmentSchedule : null,
      memberInstallmentChoiceAllowed,
      name,
      onlineInstallmentsEnabled,
      onlinePaymentRequired,
      paymentModes: {
        ...paymentModes,
        external_link: paymentModes.external_link && Boolean(externalUrl),
        helloasso: paymentModes.helloasso,
      },
      paymentOwner,
      reminderAutomation: {
        afterDueDays: optionalNumberOrNull(reminderAfterDueDays),
        beforeDueDays: optionalNumberOrNull(reminderBeforeDueDays),
        enabled: autoReminderEnabled,
        frequencyDays,
        maxCount,
        minIntervalDays: 3,
        onDueDate: reminderOnDueDate,
        startDate: reminderStartDate.trim() || null,
        targetStatuses: reminderTargetStatuses,
      },
      reminderMessage,
      seasonLabel,
      startDate: startDate.trim() || null,
      status: persistOptions.status || campaign?.status || 'draft',
      targetConfig: normalizedTargetConfig,
      targetSummary: buildTargetSummaryPayload(normalizedTargetConfig),
      type,
    };
    if (campaignId) return updateLicenseCampaign(campaignId, payload);
    return createLicenseCampaign(payload);
  }, campaignId);

  const togglePaymentMode = useCallback((mode) => {
    setPaymentModes((currentModes) => ({
      ...currentModes,
      [mode]: !currentModes[mode],
    }));
  }, []);

  const providerMutation = useLicenseMutation(async () => true, campaignId);

  // S06 — LE VERROU DU BOUTON FINAL, ET IL NE COUVRE PAS SEULEMENT L APPEL.
  //
  // Adel en recette de la `2.6.19` (point 10) : « j'ai du appuyer DEUX FOIS sur
  // le bouton "creer la campagne" ». Le premier appui PARTAIT — `isNextLoading`
  // recevait deja `saveMutation.isPending` et `Button` rend son touchable inerte
  // quand il charge (Button.js:75, 98). Ce qui manquait, c'est la SUITE :
  // `@tanstack/query-core` remet `isPending` a `false` AVANT de jouer le
  // `onSuccess` passe a `mutate(...)` (mutationObserver.js:43-46 puis 81), et
  // c'est dans ce `onSuccess` que l'ecran enchaine jusqu'a cinq allers-retours
  // de plus (documents, regles tarifaires, provider) sans rien afficher.
  // ⇒ le bouton redevenait vivant pendant une fenetre muette, et un second
  //   appui repartait en `createLicenseCampaign` — `campaignId` etant encore
  //   vide. Deux campagnes.
  //
  // Le motif est celui des tunnels voisins qui portent le meme gabarit
  // (`ClubWizardRecap`, `EventWizardRecap`, `FriendlyMatchWizardRecap`) : un
  // `isSubmitting` pose avant la chaine, rendu au bouton par `isNextLoading`.
  // Le `ref` s'y ajoute pour une seule raison : deux appuis dans la MEME image
  // passeraient tous les deux avant le re-rendu qui desactive le bouton.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  // T03 — CE QUE L ECRAN DIT PENDANT QU IL TRAVAILLE.
  //
  // Adel, recette du 2026-08-17 (point 7) : « qu'est-ce que c'est LONG pour se
  // creer ». S06 avait ferme le bouton ; il restait la fenetre MUETTE. Un geste
  // qui met une seconde sans rien dire fait appuyer une seconde fois — c est
  // exactement ce qui creait les doublons.
  // ⛔ Ce n est PAS une animation posee sur une lenteur evitable : la file a
  //    d abord ete supprimee (voir `persistCampaign`). Ce qui reste annonce est
  //    du reseau irreductible — deux allers-retours mesures a ~305 ms piece.
  const [etapeEnvoi, setEtapeEnvoi] = useState('');
  const finirEnvoi = useCallback(() => {
    isSubmittingRef.current = false;
    setIsSubmitting(false);
    setEtapeEnvoi('');
  }, []);

  const syncSavedCampaignParams = useCallback((savedCampaignId) => {
    if (!savedCampaignId) return;
    navigation.setParams({
      campaign: undefined,
      campaignId: savedCampaignId,
    });
  }, [navigation]);
  const goToCampaignOperations = useCallback((savedCampaignId) => {
    if (!savedCampaignId) return;
    // D81 — LE LAISSEZ-PASSER, ET IL N'EST PAS COSMETIQUE. Le garde
    // `beforeRemove` plus bas recule d'une etape des que l'ecran quitte la
    // pile, et le routeur emet cet evenement sur TOUT retrait de route,
    // `replace` compris. Sans cette ligne il ANNULE la sortie : le dirigeant
    // qui vient de publier est redepose DANS son formulaire, bouton
    // « Publier » sous le doigt — donc une campagne envoyee deux fois.
    allowScreenExitRef.current = true;
    navigation.replace(RouteNames.ClubLicenseCampaignDetail, {
      campaign: undefined,
      campaignId: savedCampaignId,
      clubId,
    });
  }, [clubId, navigation]);

  const persistCampaign = useCallback((options = {}) => {
    // S06 — un envoi deja en vol ne se relance pas. Le `ref` tranche AVANT tout
    // rendu : c'est lui qui rend le double appui inoffensif quel que soit le
    // rythme.
    if (isSubmittingRef.current) return;
    const requestedStatus = options.status || campaign?.status || 'draft';
    if (requestedStatus !== 'draft' && paymentModes.external_link && !String(externalUrl || '').trim()) {
      Alert.alert(t('clubLicenseCampaignSettings.errors.missingLink.title', 'Lien manquant'), t(
        'clubLicenseCampaignSettings.errors.missingLink.beforePublish',
        'Ajoute le lien externe du club avant publication.',
      ));
      return;
    }
    if (requestedStatus !== 'draft' && paymentModes.helloasso && !helloAssoIsPublishReady) {
      Alert.alert(t(
        'clubLicenseCampaignSettings.errors.helloAssoNotReady',
        'HelloAsso non prêt',
      ), helloAssoStatusMessage);
      return;
    }
    const persistedDocumentWithEmptyName = documentRequests.find((item) => item.documentId && !item.name.trim());
    if (persistedDocumentWithEmptyName) {
      Alert.alert(t(
        'clubLicenseCampaignSettings.errors.incompleteDocument.title',
        'Document incomplet',
      ), t(
        'clubLicenseCampaignSettings.errors.incompleteDocument.existingNames',
        'Renseigne le nom des documents existants avant d enregistrer.',
      ));
      return;
    }
    const invalidPricingRule = pricingRules.find((item) => (
      (!item.isWaiver && !item.amount.trim())
      || (item.ruleType === 'role' && !item.roleName)
      || (item.ruleType === 'team' && !item.teamKey)
      || (item.ruleType === 'category' && !item.categoryKey)
      || (item.ruleType === 'section' && !item.sectionKey)
      || (item.ruleType === 'level' && !item.levelKey)
    ));
    if (invalidPricingRule) {
      Alert.alert(t(
        'clubLicenseCampaignSettings.errors.incompletePricingRule.title',
        'Règle tarifaire incomplète',
      ), t(
        'clubLicenseCampaignSettings.errors.incompletePricingRule.message',
        'Complète chaque règle de prix avant de sauvegarder la campagne.',
      ));
      return;
    }
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setEtapeEnvoi(t(
      'clubLicenseCampaignSettings.save.progress.campaign',
      'Enregistrement de la campagne...',
    ));
    saveMutation.mutate({ status: requestedStatus }, {
      onError: (error) => {
        finirEnvoi();
        const subscriptionDecision = extractSubscriptionDecisionFromError(error);
        if (subscriptionDecision) {
          setSubscriptionPaywallDecision(subscriptionDecision);
          return;
        }
        Alert.alert(
          t('clubLicenseCampaignSettings.save.failed.title', 'Campagne impossible'),
          error?.message || t(
            'clubLicenseCampaignSettings.save.failed.message',
            'Impossible de sauvegarder cette campagne pour le moment.',
          ),
        );
      },
      onSuccess: async (saved) => {
        const savedCampaignId = saved?.documentId || saved?.id || campaignId;
        // T03 — le MODELE voyage a cote de la charge utile, jamais dedans : c est
        // un fichier, la remontee du document est du JSON. Les deux restent
        // alignes parce qu ils sortent du MEME filtre.
        const documentsAEnvoyer = documentRequests
          .map((item, index) => ({
            modele: item.pickedTemplateFile || null,
            modeleRetire: item.removedTemplate === true,
            payload: {
              acceptedMimeTypes: parseAcceptedMimeTypes(item.acceptedMimeTypesText),
              description: item.description.trim(),
              dueDate: item.dueDate.trim() || null,
              id: item.documentId,
              name: item.name.trim(),
              required: item.required !== false,
              requiresManualValidation: item.requiresManualValidation !== false,
              requiresSignature: item.requiresSignature === true,
              sortOrder: index + 1,
            },
          }))
          .filter((item) => item.payload.name);
        const activeDocumentRequests = documentsAEnvoyer.map((item) => item.payload);
        const activePricingRules = pricingRules
          .map((item) => ({
            amountCents: euroToCents(item.amount),
            category: item.categoryKey || null,
            id: item.ruleId,
            isWaiver: item.isWaiver === true,
            label: item.label.trim(),
            level: item.levelKey || null,
            priority: Number(item.priority) || 0,
            roleName: item.roleName || null,
            ruleType: item.ruleType || 'role',
            section: item.sectionKey || null,
            team: item.teamKey || null,
          }))
          .filter((item) => (
            ['category', 'level', 'role', 'section', 'team'].includes(item.ruleType)
            && (
              item.roleName
              || item.team
              || item.category
              || item.section
              || item.level
            )
          ));

        try {
          if (savedCampaignId) {
            setEtapeEnvoi(t(
              'clubLicenseCampaignSettings.save.progress.attachments',
              'Documents et tarifs en cours d envoi...',
            ));
            // T03 — LA FILE ETAIT GRATUITE, ON LA SUPPRIME AVANT DE PARLER
            // D ANIMATION.
            //
            // 📏 Mesure (ClubLicenseCampaignSettings.attenteCreation.test.js) :
            // ces quatre lots partaient l un APRES l autre. Profondeur relevee
            // **3 vagues** dans le cas courant (creation, puis documents, puis
            // regles), **5** quand un document ET une regle avaient ete retires.
            // A ~305 ms l aller-retour (`curl -w` sur `api-staging`, 12 tirs,
            // mediane 305 ms), c est 0,9 s a 1,5 s de silence apres que la
            // campagne a deja repondu.
            //
            // Or aucun de ces quatre lots ne lit le resultat d un autre :
            // `removedDocumentRequestIds` et `activeDocumentRequests` sont
            // DISJOINTS par construction (`removeDocumentRequest`, l. 1589-1602 :
            // l identifiant sort de la liste au moment ou il entre dans les
            // retires), et les regles tarifaires sont une autre collection.
            // ⇒ un seul lot, une seule vague : profondeur **2**, quoi qu il
            //   arrive. Ce qui reste est le minimum incompressible — il faut
            //   l identifiant de la campagne pour y accrocher ses annexes.
            // Les `Promise.all` imbriques partent TOUS dans la meme vague : le
            // niveau du dessus ne fait que garder les documents remontes a part,
            // parce que ce sont eux qui portent l identifiant auquel accrocher un
            // modele.
            const [documentsRemontes] = await Promise.all([
              Promise.all(activeDocumentRequests.map((item) => upsertLicenseDocumentRequest(savedCampaignId, item))),
              Promise.all(removedDocumentRequestIds.map((documentRequestId) => deleteLicenseDocumentRequest(documentRequestId))),
              Promise.all(removedPricingRuleIds.map((pricingRuleId) => deleteLicensePricingRule(pricingRuleId))),
              Promise.all(activePricingRules.map((item) => upsertLicensePricingRule(savedCampaignId, item))),
            ]);

            // T03 — LE MODELE PARTAGE, en DERNIER et seulement s il y en a un.
            //
            // Cette vague-la est INCOMPRESSIBLE, pas de la file gratuite : une
            // demande neuve n a pas d identifiant tant qu elle n est pas
            // remontee, on ne peut donc rien y accrocher avant. Elle ne part que
            // si un modele a ete choisi ou retire — une campagne sans modele
            // garde exactement sa profondeur 2.
            const modeles = documentsAEnvoyer
              .map((item, index) => ({
                fichier: item.modele,
                identifiant: documentsRemontes[index]?.documentId
                  || documentsRemontes[index]?.id
                  || item.payload.id,
                retire: item.modeleRetire,
              }))
              .filter((item) => item.identifiant && (item.fichier || item.retire));
            if (modeles.length) {
              setEtapeEnvoi(t(
                'clubLicenseCampaignSettings.save.progress.template',
                'Envoi du modèle à télécharger...',
              ));
              await Promise.all(modeles.map((item) => uploadLicenseDocumentRequestTemplate(
                item.identifiant,
                item.fichier ? { file: item.fichier } : {},
              )));
            }
          }
          await providerMutation.mutateAsync();
        } catch (error) {
          // Le bouton reste ferme (la campagne EXISTE) ; seule l annonce d etape
          // s efface, parce qu il n y a plus d etape en cours.
          setEtapeEnvoi('');
          goToCampaignOperations(savedCampaignId);
          Alert.alert(
            t(
              'clubLicenseCampaignSettings.save.partial.title',
              'Campagne enregistrée partiellement',
            ),
            error?.message || t(
              'clubLicenseCampaignSettings.save.partial.message',
              'La campagne est sauvee, mais certains documents ou providers demandent une '
                + 'vérification.',
            ),
          );
          return;
        }
        syncSavedCampaignParams(savedCampaignId);
        if (routeEventId) {
          queryClient.invalidateQueries({ queryKey: ['event', routeEventId] });
          queryClient.invalidateQueries({ queryKey: ['licenses', 'campaigns'] });
        }
        const isDraftSave = requestedStatus === 'draft';
        const isScheduledSave = requestedStatus === 'scheduled';
        let successTitle = t('clubLicenseCampaignSettings.save.opened.title', 'Campagne ouverte');
        let successMessage = t(
          'clubLicenseCampaignSettings.save.opened.message',
          'La campagne est ouverte et les membres concernés sont synchronises automatiquement.',
        );
        if (isDraftSave) {
          successTitle = t('clubLicenseCampaignSettings.save.draft.title', 'Brouillon enregistre');
          successMessage = t(
            'clubLicenseCampaignSettings.save.draft.message',
            'Le brouillon est sauvegarde. Tu pourras le reprendre avant publication.',
          );
        } else if (isScheduledSave) {
          successTitle = t(
            'clubLicenseCampaignSettings.save.scheduled.title',
            'Campagne programmee',
          );
          successMessage = t(
            'clubLicenseCampaignSettings.save.scheduled.message',
            'La campagne est publiée et s ouvrira automatiquement à sa date de début.',
          );
        }
        // ⛔ ON NE REND PAS LE BOUTON : la campagne EXISTE desormais, un appui de
        // plus n'aurait rien de bon a faire. `cancelable: false` supprime le seul
        // cas ou l'utilisateur pourrait rester devant un formulaire verrouille —
        // le rejet de la fenetre par un appui a cote sur Android. Meme reglage
        // que `ClubWizardRecap`.
        setEtapeEnvoi('');
        Alert.alert(successTitle, successMessage, [
          {
            onPress: () => goToCampaignOperations(savedCampaignId),
            text: 'OK',
          },
        ], { cancelable: false });
      },
    });
  }, [
    campaign?.status,
    campaignId,
    documentRequests,
    externalUrl,
    finirEnvoi,
    goToCampaignOperations,
    helloAssoIsPublishReady,
    helloAssoStatusMessage,
    paymentModes.external_link,
    paymentModes.helloasso,
    pricingRules,
    providerMutation,
    queryClient,
    removedDocumentRequestIds,
    removedPricingRuleIds,
    routeEventId,
    saveMutation,
    syncSavedCampaignParams,
    t,
  ]);

  const save = useCallback(() => {
    persistCampaign({ status: canPublishFromWizard ? 'draft' : (campaign?.status || 'draft') });
  }, [campaign?.status, canPublishFromWizard, persistCampaign]);

  const publishCampaign = useCallback(() => {
    persistCampaign({ status: publishTargetStatus });
  }, [persistCampaign, publishTargetStatus]);

  const retryCampaign = useCallback(() => {
    if (routeCampaignId) campaignByIdQuery.refetch();
    else campaignQuery.refetch();
  }, [campaignByIdQuery, campaignQuery, routeCampaignId]);

  const handleNameChange = useCallback((value) => {
    setNameAutoManaged(false);
    setName(value);
  }, []);

  const handleCampaignTypePress = useCallback((nextType) => {
    const trimmedName = String(name || '').trim();
    const shouldKeepSuggestedName = !trimmedName
      || nameAutoManaged
      || campaignNameSuggestions.includes(trimmedName);

    setType(nextType);
    if (shouldKeepSuggestedName) {
      setNameAutoManaged(true);
    }
  }, [campaignNameSuggestions, name, nameAutoManaged]);

  const handleDescriptionSuggestionPress = useCallback((suggestion) => {
    const trimmedDescription = String(description || '').trim();
    const trimmedSuggestion = String(suggestion || '').trim();
    setDescription(trimmedDescription === trimmedSuggestion ? '' : suggestion);
  }, [description]);

  const handleInternalNoteSuggestionPress = useCallback((suggestion) => {
    const trimmedInternalNote = String(internalNote || '').trim();
    const trimmedSuggestion = String(suggestion || '').trim();
    setInternalNote(trimmedInternalNote === trimmedSuggestion ? '' : suggestion);
  }, [internalNote]);
  const handleReminderStatusToggle = useCallback((statusKey) => {
    setReminderTargetStatuses((currentStatuses) => toggleKey(currentStatuses, statusKey));
  }, []);

  const exitWizardScreen = useCallback(() => {
    allowScreenExitRef.current = true;
    navigation.goBack();
  }, [navigation]);

  // D26 : les memes controles qu'avant, regroupes sous les 6 nouvelles cles.
  // AUCUN n'est retire — c'est ce qui garantit qu'un tunnel plus court n'est pas
  // un tunnel plus permissif. `review` les rejoue tous : une regle cassee dans
  // une feuille ne peut pas se faufiler jusqu'a l'ouverture de la campagne.
  const getWizardStepError = useCallback((stepKey) => {
    const checksIdentity = stepKey === 'identity' || stepKey === 'review';
    const checksAudience = stepKey === 'audience' || stepKey === 'review';
    const checksPayment = stepKey === 'payment' || stepKey === 'review';
    const checksDocuments = stepKey === 'documents' || stepKey === 'review';
    const checksReminders = stepKey === 'reminders' || stepKey === 'review';

    if (checksIdentity) {
      if (!String(name || '').trim()) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.missingName.message',
            'Donne un nom à la campagne avant de continuer.',
          ),
          title: t(
            'clubLicenseCampaignSettings.errors.missingName.title',
            'Nom manquant',
          ),
        };
      }
      if (!startDate) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.missingDate.start',
            'Sélectionne une date de début.',
          ),
          title: t(
            'clubLicenseCampaignSettings.errors.missingDate.title',
            'Date manquante',
          ),
        };
      }
      if (!endDate) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.missingDate.end',
            'Sélectionne une date de fin.',
          ),
          title: t(
            'clubLicenseCampaignSettings.errors.missingDate.title',
            'Date manquante',
          ),
        };
      }
      const parsedStartDate = parseIsoDateValue(startDate);
      const parsedEndDate = parseIsoDateValue(endDate);
      if (parsedStartDate && parsedEndDate && parsedStartDate.getTime() > parsedEndDate.getTime()) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.invalidPeriod.message',
            'La date de fin doit être égale ou postérieure à la date de début.',
          ),
          title: t(
            'clubLicenseCampaignSettings.errors.invalidPeriod.title',
            'Période invalide',
          ),
        };
      }
      if (!String(seasonLabel || '').trim()) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.missingSeason.message',
            'Renseigne la saison de la campagne.',
          ),
          title: t(
            'clubLicenseCampaignSettings.errors.missingSeason.title',
            'Saison manquante',
          ),
        };
      }
    }

    if (checksAudience) {
      if (euroToCents(amount) <= 0) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.amountRequired.message',
            'Le montant par membre doit être supérieur à 0.',
          ),
          title: t(
            'clubLicenseCampaignSettings.errors.amountRequired.title',
            'Montant obligatoire',
          ),
        };
      }
      if (!targetConfig.includeAllMembers && !isEventParticipantTarget) {
        const hasAtLeastOneFilter = Boolean(
          targetConfig.roles.length
          || targetConfig.teamIds.length
          || targetConfig.categoryIds.length
          || targetConfig.sectionIds.length
          || targetConfig.levelIds.length,
        );
        if (!hasAtLeastOneFilter) {
          return {
            message: t(
              'clubLicenseCampaignSettings.errors.incompleteTarget.message',
              'Choisis au moins un rôle ou une équipe, ou repasse la campagne sur tout le club.',
            ),
            title: t(
              'clubLicenseCampaignSettings.errors.incompleteTarget.title',
              'Cible incomplète',
            ),
          };
        }
      }
      const invalidPricingRule = pricingRules.find((item) => (
        (!item.isWaiver && !item.amount.trim())
        || (item.ruleType === 'role' && !item.roleName)
        || (item.ruleType === 'team' && !item.teamKey)
        || (item.ruleType === 'category' && !item.categoryKey)
        || (item.ruleType === 'section' && !item.sectionKey)
        || (item.ruleType === 'level' && !item.levelKey)
      ));
      if (invalidPricingRule) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.incompleteSpecialRate.message',
            'Complète ou retire chaque tarif spécial avant de continuer.',
          ),
          title: t(
            'clubLicenseCampaignSettings.errors.incompleteSpecialRate.title',
            'Tarif spécial incomplet',
          ),
        };
      }
    }

    if (checksPayment) {
      if (enabledPaymentModeLabels.length === 0) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.missingPayment.message',
            'Active au moins un moyen de paiement avant de terminer le tunnel.',
          ),
          title: t('clubLicenseCampaignSettings.errors.missingPayment.title', 'Paiement manquant'),
        };
      }
      if (allowInstallments && (Number(installmentCount) || 0) < 1) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.invalidInstallments.message',
            'Le nombre d échéances doit être supérieur ou égal à 1.',
          ),
          title: t(
            'clubLicenseCampaignSettings.errors.invalidInstallments.title',
            'Échéancier invalide',
          ),
        };
      }
      if (paymentModes.external_link && !String(externalUrl || '').trim()) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.missingLink.beforeContinue',
            'Ajoute le lien externe du club avant de continuer.',
          ),
          title: t('clubLicenseCampaignSettings.errors.missingLink.title', 'Lien manquant'),
        };
      }
      if (paymentModes.helloasso && !helloAssoIsPublishReady) {
        return {
          message: helloAssoStatusMessage,
          title: t('clubLicenseCampaignSettings.errors.helloAssoNotReady', 'HelloAsso non prêt'),
        };
      }
    }

    if (checksDocuments) {
      const invalidDocumentRequest = documentRequests.find((item) => (
        !item.name.trim()
        && (
          item.description.trim()
          || item.dueDate.trim()
          || item.acceptedMimeTypesText.trim()
          || item.required !== true
          || item.requiresManualValidation !== true
          || item.requiresSignature === true
        )
      ));
      if (invalidDocumentRequest) {
        return {
          message: t(
            'clubLicenseCampaignSettings.errors.incompleteDocument.draftNames',
            'Chaque document commence par un nom. Vide complètement les brouillons '
              + 'inutilisés ou renseigne leur nom.',
          ),
          title: t(
            'clubLicenseCampaignSettings.errors.incompleteDocument.title',
            'Document incomplet',
          ),
        };
      }
    }

    if (checksReminders && autoReminderEnabled && reminderTargetStatuses.length === 0) {
      return {
        message: t(
          'clubLicenseCampaignSettings.errors.incompleteReminders.message',
          'Choisis au moins un statut à relancer automatiquement.',
        ),
        title: t(
          'clubLicenseCampaignSettings.errors.incompleteReminders.title',
          'Relances incomplètes',
        ),
      };
    }

    return null;
  }, [
    allowInstallments,
    amount,
    autoReminderEnabled,
    documentRequests,
    enabledPaymentModeLabels.length,
    endDate,
    externalUrl,
    helloAssoIsPublishReady,
    helloAssoStatusMessage,
    installmentCount,
    isEventParticipantTarget,
    name,
    paymentModes.external_link,
    paymentModes.helloasso,
    pricingRules,
    reminderTargetStatuses.length,
    seasonLabel,
    startDate,
    targetConfig.categoryIds.length,
    targetConfig.includeAllMembers,
    targetConfig.levelIds.length,
    targetConfig.roles.length,
    targetConfig.sectionIds.length,
    targetConfig.teamIds.length,
    t,
  ]);

  const handleWizardBack = useCallback(() => {
    if (wizardStepIndex === 0) {
      exitWizardScreen();
      return;
    }
    setWizardStepIndex((currentIndex) => Math.max(0, currentIndex - 1));
  }, [exitWizardScreen, wizardStepIndex]);

  const handleWizardNext = useCallback(() => {
    const validationError = getWizardStepError(activeWizardStep.key);
    if (validationError) {
      Alert.alert(validationError.title, validationError.message);
      return;
    }
    if (wizardStepIndex >= wizardStepCount - 1) {
      if (canPublishFromWizard) publishCampaign();
      else save();
      return;
    }
    setWizardStepIndex((currentIndex) => Math.min(wizardStepCount - 1, currentIndex + 1));
  }, [
    activeWizardStep.key,
    canPublishFromWizard,
    getWizardStepError,
    publishCampaign,
    save,
    wizardStepCount,
    wizardStepIndex,
  ]);

  // Le lien texte sous le bouton principal : « Enregistrer en brouillon » a la
  // derniere etape, « Passer cette étape » sur les Documents (etape facultative).
  const handleWizardSkip = useCallback(() => {
    if (wizardStepIndex >= wizardStepCount - 1) {
      save();
      return;
    }
    setWizardStepIndex((currentIndex) => Math.min(wizardStepCount - 1, currentIndex + 1));
  }, [save, wizardStepCount, wizardStepIndex]);

  const isWizardNextDisabled = activeWizardStep.key === 'identity' && !String(name || '').trim();
  const goToWizardStep = useCallback((stepKey) => {
    const nextIndex = licenseCampaignWizardStepIndex[stepKey];
    if (nextIndex === undefined) return;
    setWizardStepIndex(nextIndex);
  }, []);
  const applyPeriodMode = useCallback((mode) => {
    setPeriodMode(mode);
    if (mode !== 'season') return;
    setStartDate(currentSeason.startDate);
    setEndDate(currentSeason.endDate);
    setSeasonLabel(currentSeason.label);
    setSeasonLabelManuallyEdited(false);
  }, [currentSeason.endDate, currentSeason.label, currentSeason.startDate]);
  // Le role cible : une pilule a la fois dans la maquette, mais `targetConfig.roles`
  // reste un TABLEAU en base. On ne change pas la donnee, on change la saisie.
  const selectedTargetRole = targetConfig.roles[0] || '';
  const applyTargetRole = useCallback((roleLabel) => {
    setTargetConfig((current) => ({
      ...current,
      includeAllMembers: false,
      roles: [roleLabel],
      teamIds: roleLabel === USER_ROLES.player ? current.teamIds : [],
    }));
  }, []);
  // L'echeancier genere remplace la saisie manuelle « 1, 2, 3 » : on le pose en
  // etat des que le dirigeant ouvre le fractionnement ou change un parametre.
  const applyGeneratedInstallments = useCallback(() => {
    setInstallmentSchedule(generatedInstallmentSchedule.map((item) => ({ ...item })));
  }, [generatedInstallmentSchedule]);
  // Creer PUIS ouvrir la feuille sur l'element cree : sans le brouillon en main,
  // la feuille s'ouvrirait sur `undefined` et le dirigeant taperait dans le vide.
  const addPricingRuleAndEdit = useCallback(() => {
    const draft = createPricingRuleDraft();
    setPricingRules((currentItems) => [...currentItems, draft]);
    setEditedPricingRuleId(draft.localId);
    setOpenSheet('pricingRule');
  }, []);
  const addDocumentRequestAndEdit = useCallback(() => {
    const draft = createDocumentRequestDraft();
    setDocumentRequests((currentItems) => [...currentItems, draft]);
    setEditedDocumentRequestId(draft.localId);
    setOpenSheet('documentRequest');
  }, []);
  const closeSheet = useCallback(() => {
    setOpenSheet(null);
    setEditedPricingRuleId(null);
    setEditedDocumentRequestId(null);
  }, []);
  // Le nombre d'echeances et la frequence REGENERENT l'echeancier : c'est tout
  // l'objet du lot. Sans ce rappel, changer « 3 » en « 4 » laisserait la 4e ligne
  // vide et la somme ne ferait plus le montant.
  const handleInstallmentCountChange = useCallback((delta) => {
    setInstallmentCount((current) => {
      const nextCount = Math.min(12, Math.max(1, (Number(current) || 1) + delta));
      setInstallmentSchedule(generateInstallmentSchedule({
        count: nextCount,
        frequency: installmentFrequency,
        startDate,
        totalCents: euroToCents(amount),
      }));
      return String(nextCount);
    });
  }, [amount, installmentFrequency, startDate]);
  const handleInstallmentFrequencyChange = useCallback((nextFrequency) => {
    setInstallmentFrequency(nextFrequency);
    setInstallmentSchedule(generateInstallmentSchedule({
      count: installmentCount,
      frequency: nextFrequency,
      startDate,
      totalCents: euroToCents(amount),
    }));
  }, [amount, installmentCount, startDate]);
  const shiftReminderFrequency = useCallback((delta) => {
    setReminderFrequencyDays((current) => (
      String(Math.min(90, Math.max(3, (Number(current) || 14) + delta)))
    ));
  }, []);
  const shiftReminderMaxCount = useCallback((delta) => {
    setReminderMaxCount((current) => (
      String(Math.min(20, Math.max(1, (Number(current) || 5) + delta)))
    ));
  }, []);
  const campaignTypeLabel = campaignTypeOptions
    .find((option) => option.key === type)?.label || t(
    'clubLicenseCampaignSettings.campaignType.other',
    'Autre',
  );
  const reviewAudienceLabel = useMemo(() => {
    if (isEventParticipantTarget) {
      return t(
        'clubLicenseCampaignSettings.review.audience.eventParticipants',
        'Participants de l événement',
      );
    }
    const suffix = concernedMemberCount > 1
      ? t('clubLicenseCampaignSettings.review.audience.memberCount', {
        count: concernedMemberCount,
        defaultValue_one: '{{count}} membre',
        defaultValue_other: '{{count}} membres',
      })
      : t('clubLicenseCampaignSettings.review.audience.memberCount', {
        count: concernedMemberCount,
        defaultValue_one: '{{count}} membre',
        defaultValue_other: '{{count}} membres',
      });
    if (targetConfig.includeAllMembers) {
      return t(
        'clubLicenseCampaignSettings.review.audience.wholeClub',
        'Tout le club · {{suffix}}',
        { suffix, ...SANS_ECHAPPEMENT },
      );
    }
    const rolePill = licenseTargetRolePills.find((pill) => pill.key === selectedTargetRole);
    if (selectedTargetRole === USER_ROLES.player) {
      return t(
        'clubLicenseCampaignSettings.review.audience.players',
        'Joueurs · {{teamCount}} équipe(s)',
        { teamCount: targetConfig.teamIds.length, ...SANS_ECHAPPEMENT },
      );
    }
    return `${rolePill?.label || t(
      'clubLicenseCampaignSettings.review.audience.selection',
      'Sélection',
    )} · ${suffix}`;
  }, [
    concernedMemberCount,
    isEventParticipantTarget,
    selectedTargetRole,
    targetConfig.includeAllMembers,
    targetConfig.teamIds.length,
    t,
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowScreenExitRef.current) {
        allowScreenExitRef.current = false;
        return;
      }

      if (wizardStepIndex <= 0) {
        return;
      }

      event.preventDefault();
      setWizardStepIndex((currentIndex) => Math.max(0, currentIndex - 1));
    });

    return unsubscribe;
  }, [navigation, wizardStepIndex]);

  if (campaignIsLoading) {
    return (
      <ScreenContainer bottomInsetMode="none" withHeaderPadding>
        <LicenseEmptyState
          description={t(
            'clubLicenseCampaignSettings.loading.description',
            'On récupère la campagne avant d afficher le formulaire.',
          )}
          title={t('clubLicenseCampaignSettings.loading.title', 'Chargement des paramètres')}
        />
      </ScreenContainer>
    );
  }

  if (campaignHasError) {
    return (
      <ScreenContainer bottomInsetMode="none" withHeaderPadding>
        <LicenseEmptyState
          action={(
            <Button
              onPress={retryCampaign}
              title={t(
                'clubLicenseCampaignSettings.loadError.retry',
                'Réessayer',
              )}
              variant="Secondary"
            />
)}
          description={t(
            'clubLicenseCampaignSettings.loadError.description',
            'Impossible de charger la campagne. Le formulaire n est pas ouvert pour éviter d '
              + 'ecraser ses paramètres.',
          )}
          title={t('clubLicenseCampaignSettings.loadError.title', 'Paramètres indisponibles')}
        />
      </ScreenContainer>
    );
  }

  const primaryStepCardStyle = [ApplicationStyle.card, Spaces.gap[16], {
    backgroundColor: Colors.primary700,
    borderColor: `${Colors.primary500}55`,
    borderRadius: licenseRadius.hero,
    paddingHorizontal: licenseSpacing.heroPadding,
    paddingVertical: licenseSpacing.heroPadding,
  }];
  const secondaryStepCardStyle = [ApplicationStyle.card, Spaces.gap[16], {
    backgroundColor: Colors.primary800,
    borderColor: `${Colors.primary500}33`,
    borderRadius: licenseRadius.card,
    paddingHorizontal: licenseSpacing.cardPadding,
    paddingVertical: licenseSpacing.cardPadding,
  }];
  // Ne subsiste que la phrase du ciblage verrouille sur un evenement : les
  // « 0 rôle(s), 0 équipe(s), 0 catégorie(s)… » sont remplaces par un compte de
  // personnes reel (`concernedMemberCount`), lisible sans decodeur.
  const targetModeSummaryText = isEventParticipantTarget
    ? t(
      'clubLicenseCampaignSettings.audience.targetLocked',
      'Cible verrouillée sur les participants acceptés de l événement.',
    )
    : t(
      'clubLicenseCampaignSettings.audience.wholeClubSummary',
      'La campagne concernera tout le club.',
    );

  const dashedTileStyle = {
    alignItems: 'center',
    borderColor: `${Colors.primary500}66`,
    borderRadius: licenseRadius.card,
    borderStyle: /** @type {any} */ ('dashed'),
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: licenseSpacing.cardPadding,
  };
  const editedPricingRule = pricingRules.find((item) => item.localId === editedPricingRuleId);
  const editedDocumentRequest = documentRequests
    .find((item) => item.localId === editedDocumentRequestId);
  const currentSeasonOptionLabel = t(
    'clubLicenseCampaignSettings.identity.seasonOption',
    'Saison {{season}}',
    { season: currentSeason.label, ...SANS_ECHAPPEMENT },
  );
  const describePricingRule = (rule) => {
    const scopeLabel = rule.roleName || rule.teamKey || rule.categoryKey
      || rule.sectionKey || rule.levelKey || pricingRuleLabels[rule.ruleType] || t(
      'clubLicenseCampaignSettings.specialRate.defaultScope',
      'Cible',
    );
    return `${rule.label?.trim() || t(
      'clubLicenseCampaignSettings.specialRate.defaultLabel',
      'Tarif spécial',
    )} · ${scopeLabel}`;
  };

  let stepContent = null;

  if (activeWizardStep.key === 'identity') {
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        <View style={primaryStepCardStyle}>
          <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
            {t('clubLicenseCampaignSettings.identity.type', 'TYPE')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {campaignTypeOptions.map((option) => (
              <SelectionChip
                key={option.key}
                label={option.label}
                onPress={() => handleCampaignTypePress(option.key)}
                selected={type === option.key}
              />
            ))}
          </View>
          <Field
            label={t('clubLicenseCampaignSettings.identity.name', 'Nom')}
            onChangeText={handleNameChange}
            placeholder={campaignNameSuggestions[0] || t(
              'clubLicenseCampaignSettings.identity.namePlaceholder',
              'Cotisation licences 2026/2027',
            )}
            value={name}
          />
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'clubLicenseCampaignSettings.identity.nameHint',
              'Pré-rempli selon le type — modifiable librement.',
            )}
          </Text>
        </View>

        <View style={primaryStepCardStyle}>
          <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
            {t('clubLicenseCampaignSettings.identity.period', 'PÉRIODE')}
          </Text>
          <SegmentedPair
            onSelect={applyPeriodMode}
            options={[
              { key: 'season', label: currentSeasonOptionLabel },
              {
                key: 'custom',
                label: t(
                  'clubLicenseCampaignSettings.identity.customDates',
                  'Dates libres',
                ),
              },
            ]}
            selectedKey={periodMode}
          />
          {periodMode === 'season' ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'clubLicenseCampaignSettings.identity.seasonDetected',
                'Saison actuelle détectée — proposée par défaut.',
              )}
            </Text>
          ) : (
            <>
              <DateField
                label={t('clubLicenseCampaignSettings.identity.startDate', 'Date de début')}
                maximumDate={maximumCampaignStartDate}
                onChange={setStartDate}
                value={startDate}
              />
              <DateField
                label={t('clubLicenseCampaignSettings.identity.endDate', 'Date de fin')}
                minimumDate={minimumCampaignEndDate}
                onChange={setEndDate}
                value={endDate}
              />
              <Field
                label={t('clubLicenseCampaignSettings.identity.seasonToKeep', 'Saison à conserver')}
                onChangeText={(value) => {
                  setSeasonLabelManuallyEdited(true);
                  setSeasonLabel(value);
                }}
                placeholder={detectedSeasonLabel || currentSeason.label}
                value={seasonLabel}
              />
            </>
          )}
        </View>

        <ValueRow
          label={t('clubLicenseCampaignSettings.identity.description', 'Description visible')}
          onPress={() => setOpenSheet('description')}
          value={description.trim() ? t(
            'clubLicenseCampaignSettings.status.filled',
            'Renseignée',
          ) : t(
            'clubLicenseCampaignSettings.status.toFill',
            'À remplir',
          )}
        />
      </View>
    );
  } else if (activeWizardStep.key === 'audience') {
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        <View style={primaryStepCardStyle}>
          <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
            {t(
              'clubLicenseCampaignSettings.audience.amountPerMember',
              'MONTANT PAR MEMBRE ({{currency}})',
              { currency, ...SANS_ECHAPPEMENT },
            )}
          </Text>
          <AmountField
            amount={amount}
            currency={currency}
            onAmountChange={setAmount}
            onCurrencyChange={setCurrency}
          />
        </View>

        {isEventParticipantTarget ? (
          <View style={primaryStepCardStyle}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t(
                'clubLicenseCampaignSettings.audience.acceptedParticipants',
                'Participants acceptés de l événement',
              )}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>{targetModeSummaryText}</Text>
          </View>
        ) : (
          <View style={primaryStepCardStyle}>
            <SwitchRow
              enabled={targetConfig.includeAllMembers}
              hint={concernedMemberCount > 1
                ? t('clubLicenseCampaignSettings.audience.concernedToday', {
                  count: concernedMemberCount,
                  defaultValue_one: '{{count}} membre concerné aujourd hui',
                  defaultValue_other: '{{count}} membres concernés aujourd hui',
                })
                : t('clubLicenseCampaignSettings.audience.concernedToday', {
                  count: concernedMemberCount,
                  defaultValue_one: '{{count}} membre concerné aujourd hui',
                  defaultValue_other: '{{count}} membres concernés aujourd hui',
                })}
              label={t('clubLicenseCampaignSettings.audience.wholeClub', 'Tout le club')}
              onChange={(enabled) => setTargetConfig((current) => ({
                ...current,
                categoryIds: enabled ? [] : current.categoryIds,
                includeAllMembers: enabled,
                levelIds: enabled ? [] : current.levelIds,
                roles: enabled ? [] : current.roles,
                sectionIds: enabled ? [] : current.sectionIds,
                teamIds: enabled ? [] : current.teamIds,
              }))}
            />
            <Text style={[Fonts.p3, Fonts.neutral300]}>
              {t(
                'clubLicenseCampaignSettings.audience.wholeClubHint',
                'Désactive pour cibler un rôle : dirigeants, entraîneurs, ou joueurs par équipes.',
              )}
            </Text>

            {!targetConfig.includeAllMembers ? (
              <>
                <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
                  {t('clubLicenseCampaignSettings.audience.role', 'RÔLE CONCERNÉ')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {licenseTargetRolePills.map((pill) => (
                    <SelectionChip
                      key={pill.key}
                      label={pill.label}
                      onPress={() => applyTargetRole(pill.key)}
                      selected={selectedTargetRole === pill.key}
                    />
                  ))}
                </View>

                {selectedTargetRole === USER_ROLES.player ? (
                  <>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {t(
                        'clubLicenseCampaignSettings.audience.teamsChecked',
                        '{{teamCount}} équipe(s) cochée(s).',
                        { teamCount: targetConfig.teamIds.length, ...SANS_ECHAPPEMENT },
                      )}
                    </Text>
                    {teamOptions.map((team) => (
                      <CheckRow
                        key={team.key}
                        label={team.label}
                        onPress={() => toggleTargetValue('teamIds', team.key)}
                        selected={targetConfig.teamIds.includes(team.key)}
                      />
                    ))}
                    {!teamOptions.length ? (
                      <Text style={[Fonts.p3, Fonts.neutral300]}>
                        {t(
                          'clubLicenseCampaignSettings.audience.noTeams',
                          'Aucune équipe dans ce club pour le moment.',
                        )}
                      </Text>
                    ) : null}
                  </>
                ) : null}

                {selectedTargetRole && selectedTargetRole !== USER_ROLES.player ? (
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {concernedMemberCount > 1
                      ? t('clubLicenseCampaignSettings.audience.peopleConcerned', {
                        count: concernedMemberCount,
                        defaultValue_one: '{{count}} personne concernée.',
                        defaultValue_other: '{{count}} personnes concernées.',
                      })
                      : t('clubLicenseCampaignSettings.audience.peopleConcerned', {
                        count: concernedMemberCount,
                        defaultValue_one: '{{count}} personne concernée.',
                        defaultValue_other: '{{count}} personnes concernées.',
                      })}
                    {' '}
                    {t(
                      'clubLicenseCampaignSettings.audience.perPersonNotice',
                      'La sélection personne par personne demande une évolution du serveur : '
                        + 'tout le rôle est concerné pour l instant.',
                    )}
                  </Text>
                ) : null}

                {hasLegacyTargetFilters ? (
                  <View style={secondaryStepCardStyle}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                      {t(
                        'clubLicenseCampaignSettings.audience.advancedFilters.title',
                        'Filtres avancés',
                      )}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {t(
                        'clubLicenseCampaignSettings.audience.advancedFilters.description',
                        'Cette campagne utilise des filtres qui ne sont plus proposés aux '
                          + 'nouvelles campagnes. Ils restent modifiables ici.',
                      )}
                    </Text>
                    <SelectionGroup
                      items={categoryOptions}
                      label={t(
                        'clubLicenseCampaignSettings.audience.advancedFilters.categories',
                        'Categories',
                      )}
                      onToggle={(value) => toggleTargetValue('categoryIds', value)}
                      selectedKeys={targetConfig.categoryIds}
                    />
                    <SelectionGroup
                      items={sectionOptions}
                      label={t(
                        'clubLicenseCampaignSettings.audience.advancedFilters.sections',
                        'Sections',
                      )}
                      onToggle={(value) => toggleTargetValue('sectionIds', value)}
                      selectedKeys={targetConfig.sectionIds}
                    />
                    <SelectionGroup
                      items={levelOptions}
                      label={t(
                        'clubLicenseCampaignSettings.audience.advancedFilters.levels',
                        'Niveaux',
                      )}
                      onToggle={(value) => toggleTargetValue('levelIds', value)}
                      selectedKeys={targetConfig.levelIds}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        )}

        <View style={primaryStepCardStyle}>
          <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
            {pricingRules.length === 1
              ? t('clubLicenseCampaignSettings.audience.specialRatesHeader', {
                count: pricingRules.length,
                defaultValue_one: 'TARIFS SPÉCIAUX · {{count}} RÈGLE',
                defaultValue_other: 'TARIFS SPÉCIAUX · {{count}} RÈGLES',
              })
              : t('clubLicenseCampaignSettings.audience.specialRatesHeader', {
                count: pricingRules.length,
                defaultValue_one: 'TARIFS SPÉCIAUX · {{count}} RÈGLE',
                defaultValue_other: 'TARIFS SPÉCIAUX · {{count}} RÈGLES',
              })}
          </Text>
          {pricingRules.map((rule) => (
            <ValueRow
              key={rule.localId}
              label={describePricingRule(rule)}
              onPress={() => {
                setEditedPricingRuleId(rule.localId);
                setOpenSheet('pricingRule');
              }}
              value={rule.isWaiver
                ? t('clubLicenseCampaignSettings.audience.exemption', 'Exemption')
                : `${rule.amount || '0'} ${currency}`}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={addPricingRuleAndEdit}
            style={dashedTileStyle}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
              {t('clubLicenseCampaignSettings.audience.addRule', '+ Ajouter une règle')}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  } else if (activeWizardStep.key === 'payment') {
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        <View style={primaryStepCardStyle}>
          <SwitchRow
            enabled={paymentModes.helloasso}
            hint={helloAssoIsPublishReady
              ? t(
                'clubLicenseCampaignSettings.payment.helloAsso.connected',
                'Compte du club connecté ✓ — géré dans Réglages du club',
              )
              : t(
                'clubLicenseCampaignSettings.payment.helloAsso.toConnect',
                'À connecter dans Réglages du club, depuis l écran Cotisations',
              )}
            label={t('clubLicenseCampaignSettings.payment.helloAsso.label', 'HelloAsso (en ligne)')}
            onChange={() => togglePaymentMode('helloasso')}
          />
          <SwitchRow
            enabled={paymentModes.bank_transfer}
            label={paymentModeLabels.bank_transfer}
            onChange={() => togglePaymentMode('bank_transfer')}
          />
          <SwitchRow
            enabled={paymentModes.cash}
            label={t('clubLicenseCampaignSettings.payment.cash', 'Espèces')}
            onChange={() => togglePaymentMode('cash')}
          />
          <SwitchRow
            enabled={paymentModes.check}
            label={t('clubLicenseCampaignSettings.payment.cheque', 'Chèque')}
            onChange={() => togglePaymentMode('check')}
          />
          <SwitchRow
            enabled={paymentModes.card_physical}
            label={paymentModeLabels.card_physical}
            onChange={() => togglePaymentMode('card_physical')}
          />
          <SwitchRow
            enabled={paymentModes.external_link}
            hint={t(
              'clubLicenseCampaignSettings.payment.externalLink.hint',
              'Le club encaisse sur sa propre page de paiement.',
            )}
            label={t(
              'clubLicenseCampaignSettings.payment.externalLink.label',
              'Lien externe du club',
            )}
            onChange={() => togglePaymentMode('external_link')}
          />
          {paymentModes.external_link ? (
            <Field
              label={t(
                'clubLicenseCampaignSettings.payment.externalLink.label',
                'Lien externe du club',
              )}
              onChangeText={setExternalUrl}
              placeholder="https://..."
              value={externalUrl}
            />
          ) : null}
        </View>

        {hasOfflineInstructions ? (
          <ValueRow
            label={t('clubLicenseCampaignSettings.payment.instructions', 'Consignes de paiement')}
            onPress={() => setOpenSheet('paymentInstructions')}
            value={filledPaymentInstructionCount
              ? t(
                'clubLicenseCampaignSettings.payment.filledCount',
                '{{filledCount}} renseignée(s)',
                { filledCount: filledPaymentInstructionCount, ...SANS_ECHAPPEMENT },
              )
              : t('clubLicenseCampaignSettings.status.toFill', 'À remplir')}
          />
        ) : null}

        <View style={primaryStepCardStyle}>
          <SwitchRow
            enabled={allowInstallments}
            hint={allowInstallments ? installmentSummaryText : undefined}
            label={t(
              'clubLicenseCampaignSettings.payment.installments.label',
              'Paiement en plusieurs fois',
            )}
            onChange={(enabled) => {
              setAllowInstallments(enabled);
              if (enabled) applyGeneratedInstallments();
            }}
          />
        </View>

        {allowInstallments ? (
          <ValueRow
            label={t(
              'clubLicenseCampaignSettings.payment.installments.adjust',
              'Ajuster l échéancier',
            )}
            onPress={() => setOpenSheet('installments')}
            value={visibleInstallmentSchedule.length === 1
              ? t('clubLicenseCampaignSettings.payment.installments.count', {
                count: visibleInstallmentSchedule.length,
                defaultValue_one: '{{count}} échéance',
                defaultValue_other: '{{count}} échéances',
              })
              : t('clubLicenseCampaignSettings.payment.installments.count', {
                count: visibleInstallmentSchedule.length,
                defaultValue_one: '{{count}} échéance',
                defaultValue_other: '{{count}} échéances',
              })}
          />
        ) : null}
      </View>
    );
  } else if (activeWizardStep.key === 'documents') {
    const namedDocumentRequests = documentRequests.filter((item) => item.name.trim());
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        {namedDocumentRequests.map((item) => (
          <ValueRow
            key={item.localId}
            label={item.name}
            onPress={() => {
              setEditedDocumentRequestId(item.localId);
              setOpenSheet('documentRequest');
            }}
            value={describeDocumentRequest(item)}
          />
        ))}
        {!namedDocumentRequests.length ? (
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            {t(
              'clubLicenseCampaignSettings.documents.empty',
              'Aucun document demandé. Cette étape est facultative.',
            )}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={addDocumentRequestAndEdit}
          style={dashedTileStyle}
        >
          <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
            {t('clubLicenseCampaignSettings.documents.add', '+ Demander un document')}
          </Text>
        </Pressable>
      </View>
    );
  } else if (activeWizardStep.key === 'reminders') {
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        <View style={primaryStepCardStyle}>
          <SwitchRow
            enabled={autoReminderEnabled}
            hint={t('clubLicenseCampaignSettings.reminders.stopHint', 'Arrêt dès que c est payé.')}
            label={t('clubLicenseCampaignSettings.reminders.auto', 'Relancer automatiquement')}
            onChange={setAutoReminderEnabled}
          />
        </View>

        {autoReminderEnabled ? (
          <>
            <View style={primaryStepCardStyle}>
              <SummaryLine
                label={t('clubLicenseCampaignSettings.reminders.frequency', 'Cadence')}
                value={t(
                  'clubLicenseCampaignSettings.reminders.frequencySummary',
                  'Tous les {{days}} jours · {{max}} max',
                  {
                    days: reminderFrequencyDays || 14,
                    max: reminderMaxCount || 5,
                    ...SANS_ECHAPPEMENT,
                  },
                )}
              />
              <SummaryLine
                label={t(
                  'clubLicenseCampaignSettings.reminders.statuses',
                  'Statuts',
                )}
                value={reminderStatusSummary}
              />
              <SummaryLine
                label={t('clubLicenseCampaignSettings.reminders.first', 'Première')}
                value={reminderBeforeDueDays
                  ? t(
                    'clubLicenseCampaignSettings.reminders.daysBefore',
                    '{{days}} jours avant l échéance',
                    { days: reminderBeforeDueDays, ...SANS_ECHAPPEMENT },
                  )
                  : t('clubLicenseCampaignSettings.reminders.onDueDate', 'Le jour de l échéance')}
              />
            </View>

            <ValueRow
              label={t(
                'clubLicenseCampaignSettings.reminders.adjustFrequency',
                'Ajuster la cadence',
              )}
              onPress={() => setOpenSheet('reminderTiming')}
              value={t('clubLicenseCampaignSettings.actions.edit', 'Modifier')}
            />

            <View style={primaryStepCardStyle}>
              <Field
                label={t('clubLicenseCampaignSettings.reminders.message', 'Message de relance')}
                multiline
                onChangeText={setReminderMessage}
                placeholder={t(
                  'clubLicenseCampaignSettings.reminders.messagePlaceholder',
                  'Rappel: ta cotisation reste à régler.',
                )}
                value={reminderMessage}
              />
            </View>
            <View style={secondaryStepCardStyle}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('clubLicenseCampaignSettings.reminders.preview', 'Aperçu du message')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>{reminderPreviewMessage}</Text>
            </View>
          </>
        ) : null}
      </View>
    );
  } else if (activeWizardStep.key === 'review') {
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        <View style={primaryStepCardStyle}>
          <ReviewSectionHeader
            onEdit={() => goToWizardStep('identity')}
            title={t(
              'clubLicenseCampaignSettings.steps.identity.title',
              'Identité',
            )}
          />
          <SummaryLine
            label={t(
              'clubLicenseCampaignSettings.identity.name',
              'Nom',
            )}
            value={name || t(
              'clubLicenseCampaignSettings.review.toFill',
              'À renseigner',
            )}
          />
          <SummaryLine
            label={t(
              'clubLicenseCampaignSettings.review.type',
              'Type',
            )}
            value={campaignTypeLabel}
          />
          <SummaryLine
            label={t('clubLicenseCampaignSettings.review.period', 'Période')}
            value={periodMode === 'season'
              ? currentSeasonOptionLabel
              : `${isoToPickerDateValue(startDate)} → ${isoToPickerDateValue(endDate)}`}
          />
        </View>

        <View style={primaryStepCardStyle}>
          <ReviewSectionHeader
            onEdit={() => goToWizardStep('audience')}
            title={t(
              'clubLicenseCampaignSettings.steps.audience.title',
              'Public & tarif',
            )}
          />
          <SummaryLine
            label={t(
              'clubLicenseCampaignSettings.review.audience.label',
              'Public',
            )}
            value={reviewAudienceLabel}
          />
          <SummaryLine
            label={t('clubLicenseCampaignSettings.review.amount', 'Montant')}
            value={t(
              'clubLicenseCampaignSettings.review.amountPerMember',
              '{{amount}} par membre',
              { amount: formatLicenseMoney(euroToCents(amount), currency), ...SANS_ECHAPPEMENT },
            )}
          />
          <SummaryLine
            label={t('clubLicenseCampaignSettings.review.specialRates', 'Tarifs spéciaux')}
            value={pricingRules.length
              ? t(
                'clubLicenseCampaignSettings.review.ruleCount',
                '{{ruleCount}} règle(s)',
                { ruleCount: pricingRules.length, ...SANS_ECHAPPEMENT },
              )
              : t('clubLicenseCampaignSettings.review.singlePrice', 'Prix unique')}
          />
        </View>

        <View style={primaryStepCardStyle}>
          <ReviewSectionHeader
            onEdit={() => goToWizardStep('payment')}
            title={t(
              'clubLicenseCampaignSettings.steps.payment.title',
              'Paiement',
            )}
          />
          <SummaryLine
            label={t('clubLicenseCampaignSettings.review.methods', 'Moyens')}
            value={enabledPaymentModeLabels.join(' · ') || t(
              'clubLicenseCampaignSettings.review.noMethod',
              'Aucun moyen actif',
            )}
          />
          <SummaryLine
            label={t(
              'clubLicenseCampaignSettings.review.installmentPlan',
              'Échéancier',
            )}
            value={installmentSummaryText}
          />
          <SummaryLine
            label={t('clubLicenseCampaignSettings.review.instructions', 'Consignes')}
            value={filledPaymentInstructionCount
              ? t(
                'clubLicenseCampaignSettings.payment.filledCount',
                '{{filledCount}} renseignée(s)',
                { filledCount: filledPaymentInstructionCount, ...SANS_ECHAPPEMENT },
              )
              : t('clubLicenseCampaignSettings.review.none', 'Aucune')}
          />
        </View>

        <View style={primaryStepCardStyle}>
          <ReviewSectionHeader
            onEdit={() => goToWizardStep('documents')}
            title={t(
              'clubLicenseCampaignSettings.steps.documents.title',
              'Documents',
            )}
          />
          <SummaryLine
            label={t('clubLicenseCampaignSettings.review.requestedDocuments', 'Pièces demandées')}
            value={documentRequests.filter((item) => item.name.trim()).length
              ? t(
                'clubLicenseCampaignSettings.review.documentCount',
                '{{documentCount}} document(s)',
                {
                  documentCount: documentRequests.filter((item) => item.name.trim()).length,
                  ...SANS_ECHAPPEMENT,
                },
              )
              : t('clubLicenseCampaignSettings.review.noDocuments', 'Aucun')}
          />
        </View>

        <View style={primaryStepCardStyle}>
          <ReviewSectionHeader
            onEdit={() => goToWizardStep('reminders')}
            title={t(
              'clubLicenseCampaignSettings.steps.reminders.title',
              'Relances',
            )}
          />
          <SummaryLine
            label={t('clubLicenseCampaignSettings.review.autoReminders', 'Relances auto')}
            value={autoReminderEnabled ? t(
              'clubLicenseCampaignSettings.review.enabled',
              'Activées',
            ) : t(
              'clubLicenseCampaignSettings.review.disabled',
              'Désactivées',
            )}
          />
          {autoReminderEnabled ? (
            <SummaryLine
              label={t(
                'clubLicenseCampaignSettings.reminders.statuses',
                'Statuts',
              )}
              value={reminderStatusSummary}
            />
          ) : null}
        </View>

        <View style={secondaryStepCardStyle}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('clubLicenseCampaignSettings.review.advancedOptions', 'Options avancées')}
          </Text>
          <ValueRow
            label={t('clubLicenseCampaignSettings.review.internalNote', 'Note interne')}
            onPress={() => setOpenSheet('internalNote')}
            value={internalNote.trim() ? t(
              'clubLicenseCampaignSettings.status.filled',
              'Renseignée',
            ) : t(
              'clubLicenseCampaignSettings.review.none',
              'Aucune',
            )}
          />
          <SwitchRow
            enabled={paymentOwner === 'multisport'}
            hint={t(
              'clubLicenseCampaignSettings.review.multisportHint',
              'Les paiements en ligne passent par le compte central du multisport.',
            )}
            label={t(
              'clubLicenseCampaignSettings.review.multisportCollection',
              'Encaissement multisport',
            )}
            onChange={(enabled) => setPaymentOwner(enabled ? 'multisport' : 'section')}
          />
          {paymentOwner === 'multisport' && !club?.parentMultisport ? (
            <Text style={[Fonts.p3, { color: Colors.warning500 }]}>
              {t(
                'clubLicenseCampaignSettings.review.noParentMultisport',
                'Aucun multisport parent n est rattaché à ce club. Le paiement central ne '
                  + 'pourra pas être validé.',
              )}
            </Text>
          ) : null}
          <DateField
            label={t(
              'clubLicenseCampaignSettings.review.scheduleOpening',
              'Programmer l ouverture (optionnel)',
            )}
            onChange={setStartDate}
            value={startDate}
          />
          <DateField
            label={t(
              'clubLicenseCampaignSettings.review.overdueAfter',
              'Marquer en retard après le (optionnel)',
            )}
            minimumDate={campaignStartDateValue}
            onChange={setOverdueAfterDate}
            value={overdueAfterDate}
          />
        </View>
      </View>
    );
  }

  return (
    <>
      <WizardStepLayout
        collapsibleHeader
        headerVariant="focus"
        isNextDisabled={isWizardNextDisabled}
        isNextLoading={saveMutation.isPending || isSubmitting}
        nextLabel={finalSaveLabel}
        onBack={handleWizardBack}
        onNext={handleWizardNext}
        onSkip={handleWizardSkip}
        showSkip={Boolean(wizardSkipLabel)}
        skipLabel={wizardSkipLabel}
        stepCount={wizardStepCount}
        stepIndex={wizardStepIndex + 1}
        subtitle={activeWizardStep.subtitle}
        title={activeWizardStepTitle}
      >
        <View style={Spaces.gap[licenseSpacing.sectionGap]}>
          {/*
            T03 — L ATTENTE PORTE UN NOM. Le bouton, lui, ne montre qu un
            tourniquet : `Button` remplace son titre par le `Loader` des que
            `isLoading` est vrai (Button.js:111). Sans cette ligne, la seule
            chose visible pendant la chaine serait un rond qui tourne — et un
            rond ne dit pas si ca a marche.
            `accessibilityLiveRegion` la fait annoncer a voix haute au moment ou
            elle change : l attente est aussi longue pour qui ne voit pas l ecran.
          */}
          {etapeEnvoi ? (
            <View style={secondaryStepCardStyle}>
              <Text
                accessibilityLiveRegion="polite"
                style={[Fonts.p3Bold, { color: Colors.primary500 }]}
                testID="license-campagne-etape-envoi"
              >
                {etapeEnvoi}
              </Text>
            </View>
          ) : null}
          {stepContent}

          <View style={{ paddingBottom: Math.max(insets.bottom + 8, 16) }} />
        </View>
      </WizardStepLayout>

      <WizardSheet
        close={closeSheet}
        isVisible={openSheet === 'description'}
        title={t('clubLicenseCampaignSettings.identity.description', 'Description visible')}
      >
        <Field
          label={t(
            'clubLicenseCampaignSettings.sheets.description.label',
            'Texte visible par les membres',
          )}
          multiline
          onChangeText={setDescription}
          placeholder={t(
            'clubLicenseCampaignSettings.sheets.description.placeholder',
            'Informations visibles par les membres',
          )}
          value={description}
        />
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          {t(
            'clubLicenseCampaignSettings.sheets.description.hint',
            'Choisis un modèle pour pré-remplir le texte, puis ajuste-le. Appuie une '
              + 'deuxième fois pour le retirer.',
          )}
        </Text>
        {campaignDescriptionSuggestions.map((suggestion, index) => (
          <SuggestionCard
            description={suggestion}
            key={suggestion}
            onPress={() => handleDescriptionSuggestionPress(suggestion)}
            selected={String(description || '').trim() === suggestion}
            title={t(
              'clubLicenseCampaignSettings.sheets.description.template',
              'Modèle {{number}}',
              { number: index + 1, ...SANS_ECHAPPEMENT },
            )}
          />
        ))}
      </WizardSheet>

      <WizardSheet
        close={closeSheet}
        isVisible={openSheet === 'pricingRule'}
        snapPoint="86%"
        title={t('clubLicenseCampaignSettings.specialRate.defaultLabel', 'Tarif spécial')}
      >
        {editedPricingRule ? (
          <PricingRuleEditor
            categoryOptions={categoryOptions}
            item={editedPricingRule}
            levelOptions={levelOptions}
            onChange={(patch) => updatePricingRule(editedPricingRule.localId, patch)}
            onRemove={() => {
              removePricingRule(editedPricingRule.localId);
              closeSheet();
            }}
            roleOptions={roleOptions}
            sectionOptions={sectionOptions}
            teamOptions={teamOptions}
          />
        ) : null}
      </WizardSheet>

      <WizardSheet
        close={closeSheet}
        isVisible={openSheet === 'paymentInstructions'}
        snapPoint="86%"
        title={t('clubLicenseCampaignSettings.payment.instructions', 'Consignes de paiement')}
      >
        {paymentModes.bank_transfer ? (
          <Field
            label={t(
              'clubLicenseCampaignSettings.sheets.paymentInstructions.bankTransfer',
              'Virement',
            )}
            multiline
            onChangeText={setBankTransferInstructions}
            placeholder={t(
              'clubLicenseCampaignSettings.sheets.paymentInstructions.bankTransferPlaceholder',
              'IBAN, référence à indiquer...',
            )}
            value={bankTransferInstructions}
          />
        ) : null}
        {paymentModes.cash ? (
          <Field
            label={t('clubLicenseCampaignSettings.payment.cash', 'Espèces')}
            multiline
            onChangeText={setCashInstructions}
            placeholder={t(
              'clubLicenseCampaignSettings.sheets.paymentInstructions.cashPlaceholder',
              'Lieu, horaires, personne à contacter...',
            )}
            value={cashInstructions}
          />
        ) : null}
        {paymentModes.check ? (
          <Field
            label={t('clubLicenseCampaignSettings.payment.cheque', 'Chèque')}
            multiline
            onChangeText={setCheckInstructions}
            placeholder={t(
              'clubLicenseCampaignSettings.sheets.paymentInstructions.chequePlaceholder',
              'Ordre, dépôt, référence...',
            )}
            value={checkInstructions}
          />
        ) : null}
        {paymentModes.card_physical ? (
          <Field
            label={t(
              'clubLicenseCampaignSettings.sheets.paymentInstructions.card',
              'Carte au club',
            )}
            multiline
            onChangeText={setCardPhysicalInstructions}
            placeholder={t(
              'clubLicenseCampaignSettings.sheets.paymentInstructions.cardPlaceholder',
              'Terminal, permanences...',
            )}
            value={cardPhysicalInstructions}
          />
        ) : null}
      </WizardSheet>

      <WizardSheet
        close={closeSheet}
        isVisible={openSheet === 'installments'}
        snapPoint="86%"
        title={t('clubLicenseCampaignSettings.payment.installments.adjust', 'Ajuster l échéancier')}
      >
        <InputStepper
          label={t('clubLicenseCampaignSettings.sheets.installments.count', 'Nombre d échéances')}
          max={12}
          min={1}
          onDecrement={() => handleInstallmentCountChange(-1)}
          onIncrement={() => handleInstallmentCountChange(1)}
          value={Number(installmentCount) || 1}
        />
        <SelectionGroup
          items={installmentFrequencyOptions}
          label={t('clubLicenseCampaignSettings.sheets.installments.frequency', 'Fréquence')}
          onToggle={handleInstallmentFrequencyChange}
          selectedKeys={[installmentFrequency]}
        />
        <View style={secondaryStepCardStyle}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
            {t('clubLicenseCampaignSettings.sheets.installments.preview', 'Aperçu de l échéancier')}
          </Text>
          {visibleInstallmentSchedule.map((line, index) => (
            <SummaryLine
              key={line.localId || `installment-${index}`}
              label={`${line.label || `${index + 1}`}${line.dueDate ? ` · ${isoToPickerDateValue(line.dueDate)}` : ''}`}
              value={`${line.amount || '0,00'} ${currency}`}
            />
          ))}
          <SummaryLine
            label={t('clubLicenseCampaignSettings.sheets.installments.total', 'Total')}
            value={formatLicenseMoney(euroToCents(amount), currency)}
          />
          <Button
            onPress={applyGeneratedInstallments}
            title={t(
              'clubLicenseCampaignSettings.sheets.installments.regenerate',
              'Régénérer depuis le montant',
            )}
            variant="Secondary"
          />
        </View>
        <PaymentModeToggle
          enabled={memberInstallmentChoiceAllowed}
          label={t(
            'clubLicenseCampaignSettings.sheets.installments.memberChooses',
            'Le membre choisit son nombre d échéances',
          )}
          onChange={setMemberInstallmentChoiceAllowed}
        />
        <PaymentModeToggle
          enabled={onlineInstallmentsEnabled}
          label={t(
            'clubLicenseCampaignSettings.sheets.installments.allowOnlineSplit',
            'Autoriser le fractionnement en ligne',
          )}
          onChange={setOnlineInstallmentsEnabled}
        />
        <PaymentModeToggle
          enabled={onlinePaymentRequired}
          label={t(
            'clubLicenseCampaignSettings.sheets.installments.onlineRequired',
            'Paiement en ligne obligatoire',
          )}
          onChange={setOnlinePaymentRequired}
        />
      </WizardSheet>

      <WizardSheet
        close={closeSheet}
        isVisible={openSheet === 'documentRequest'}
        snapPoint="86%"
        title={t('clubLicenseCampaignSettings.sheets.documentRequest.title', 'Document demandé')}
      >
        {editedDocumentRequest ? (
          <DocumentRequestEditor
            canRemove
            item={editedDocumentRequest}
            onChange={(patch) => updateDocumentRequest(editedDocumentRequest.localId, patch)}
            onRemove={() => {
              removeDocumentRequest(editedDocumentRequest.localId);
              closeSheet();
            }}
          />
        ) : null}
      </WizardSheet>

      <WizardSheet
        close={closeSheet}
        isVisible={openSheet === 'reminderTiming'}
        snapPoint="86%"
        title={t('clubLicenseCampaignSettings.reminders.adjustFrequency', 'Ajuster la cadence')}
      >
        <View style={[Alignments.row, Spaces.gap[12]]}>
          <View style={{ flex: 1 }}>
            <InputStepper
              label={t(
                'clubLicenseCampaignSettings.sheets.reminderTiming.everyDays',
                'Tous les (jours)',
              )}
              max={90}
              min={3}
              onDecrement={() => shiftReminderFrequency(-1)}
              onIncrement={() => shiftReminderFrequency(1)}
              value={Number(reminderFrequencyDays) || 14}
            />
          </View>
          <View style={{ flex: 1 }}>
            <InputStepper
              label={t('clubLicenseCampaignSettings.sheets.reminderTiming.maximum', 'Maximum')}
              max={20}
              min={1}
              onDecrement={() => shiftReminderMaxCount(-1)}
              onIncrement={() => shiftReminderMaxCount(1)}
              value={Number(reminderMaxCount) || 5}
            />
          </View>
        </View>
        <Text style={[Fonts.p3Bold, Fonts.neutral200]}>
          {t('clubLicenseCampaignSettings.sheets.reminderTiming.statuses', 'STATUTS À RELANCER')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {reminderStatusOptions.map((item) => (
            <SelectionChip
              key={item.key}
              label={item.label}
              onPress={() => handleReminderStatusToggle(item.key)}
              selected={reminderTargetStatuses.includes(item.key)}
            />
          ))}
        </View>
        <Field
          inputMode="numeric"
          keyboardType="number-pad"
          label={t(
            'clubLicenseCampaignSettings.sheets.reminderTiming.startBefore',
            'Commencer X jours avant l échéance',
          )}
          onChangeText={(value) => setReminderBeforeDueDays(normalizeWholeNumberInput(value))}
          placeholder="5"
          value={reminderBeforeDueDays}
        />
        <Field
          inputMode="numeric"
          keyboardType="number-pad"
          label={t(
            'clubLicenseCampaignSettings.sheets.reminderTiming.resumeAfter',
            'Reprendre X jours après l échéance',
          )}
          onChangeText={(value) => setReminderAfterDueDays(normalizeWholeNumberInput(value))}
          placeholder="7"
          value={reminderAfterDueDays}
        />
        <PaymentModeToggle
          enabled={reminderOnDueDate}
          label={t(
            'clubLicenseCampaignSettings.sheets.reminderTiming.onDueDate',
            'Relance le jour de l échéance',
          )}
          onChange={setReminderOnDueDate}
        />
        <DateField
          label={t(
            'clubLicenseCampaignSettings.sheets.reminderTiming.firstReminderFrom',
            'Première relance à partir du (optionnel)',
          )}
          minimumDate={campaignStartDateValue}
          onChange={setReminderStartDate}
          value={reminderStartDate}
        />
      </WizardSheet>

      <WizardSheet
        close={closeSheet}
        isVisible={openSheet === 'internalNote'}
        title={t('clubLicenseCampaignSettings.review.internalNote', 'Note interne')}
      >
        <Field
          label={t(
            'clubLicenseCampaignSettings.sheets.internalNote.visibility',
            'Visible uniquement en gestion',
          )}
          multiline
          onChangeText={setInternalNote}
          placeholder={t(
            'clubLicenseCampaignSettings.sheets.internalNote.visibility',
            'Visible uniquement en gestion',
          )}
          value={internalNote}
        />
        {internalNoteSuggestions.map((suggestion, index) => (
          <SuggestionCard
            description={suggestion}
            key={suggestion}
            onPress={() => handleInternalNoteSuggestionPress(suggestion)}
            selected={String(internalNote || '').trim() === suggestion}
            title={t(
              'clubLicenseCampaignSettings.sheets.internalNote.note',
              'Note {{number}}',
              { number: index + 1, ...SANS_ECHAPPEMENT },
            )}
          />
        ))}
      </WizardSheet>

      <SubscriptionPaywallSheet
        close={() => setSubscriptionPaywallDecision(null)}
        clubDocumentId={clubId || club?.documentId || null}
        decision={subscriptionPaywallDecision}
        isVisible={Boolean(subscriptionPaywallDecision)}
        navigation={navigation}
      />
    </>
  );
}

export default ClubLicenseCampaignSettings;
