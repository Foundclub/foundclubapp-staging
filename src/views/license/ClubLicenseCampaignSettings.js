/* eslint-disable perfectionist/sort-objects */
import { useQueryClient } from '@tanstack/react-query';
import { format, isValid, parse } from 'date-fns';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert, Pressable, Switch, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey, USER_ROLES } from '@/domains/auth/authUseCases';
import { extractSubscriptionDecisionFromError } from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DateTimeSelector from '@/components/molecules/dateTimeSelector/DateTimeSelector';
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
  upsertLicenseDocumentRequest,
  upsertLicensePricingRule,
  useCurrentLicenseCampaign,
  useLicenseCampaign,
  useLicenseMutation,
} from '@/services/license/licenseQueries';
import { connectLicenseHelloAsso } from '@/services/license/licenseService';
import { useGetSections } from '@/services/section/sectionQueries';

import {
  buildEventCampaignDefaults,
  buildEventTargetConfig,
} from './eventCampaignDefaults';
import {
  LicenseCard,
  LicenseEmptyState,
  licenseRadius,
  licenseSpacing,
  LicenseStatusChip,
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
const reminderStatusOptions = [
  { key: 'pending', label: 'A payer' },
  { key: 'partial', label: 'Paiement partiel' },
  { key: 'overdue', label: 'En retard' },
  { key: 'manual_review', label: 'En attente de validation' },
];
const installmentFrequencyOptions = [
  { key: 'weekly', label: 'Hebdo' },
  { key: 'monthly', label: 'Mensuelle' },
  { key: 'quarterly', label: 'Trimestrielle' },
  { key: 'custom', label: 'Libre' },
];
const currencyOptions = [
  { key: 'EUR', label: 'EUR €' },
  { key: 'USD', label: 'USD $' },
  { key: 'GBP', label: 'GBP £' },
  { key: 'CHF', label: 'CHF' },
];
const campaignTypeOptions = [
  { key: 'license', label: 'Licence' },
  { key: 'membership', label: 'Adhesion' },
  { key: 'equipment', label: 'Equipement' },
  { key: 'internship', label: 'Stage' },
  { key: 'tournament', label: 'Tournoi' },
  { key: 'other', label: 'Autre' },
];
const licenseRoleFilterKeys = ['player', 'coach', 'president'];
const licenseCampaignWizardStepCatalog = {
  amount: {
    key: 'amount',
    subtitle: 'Definis le prix par defaut applique aux membres concernes.',
    title: 'Prix',
  },
  description: {
    key: 'description',
    subtitle: 'Redige le texte visible par les membres dans leur espace cotisation.',
    title: 'Description',
  },
  documents: {
    key: 'documents',
    subtitle: 'Ajoute les pieces a fournir pour completer le dossier.',
    title: 'Documents',
  },
  endDate: {
    key: 'endDate',
    subtitle: 'Choisis la date de fin de la campagne.',
    title: 'Date de fin',
  },
  installmentsOptions: {
    key: 'installmentsOptions',
    subtitle: 'Ajuste les options avancees du paiement fractionne.',
    title: 'Options d echeancier',
  },
  installmentsSchedule: {
    key: 'installmentsSchedule',
    subtitle: 'Renseigne chaque echeance avec son libelle, son montant et sa date limite.',
    title: 'Echeances',
  },
  installmentsSetup: {
    key: 'installmentsSetup',
    subtitle: 'Choisis le nombre d echeances et leur frequence.',
    title: 'Nombre d echeances',
  },
  installmentsToggle: {
    key: 'installmentsToggle',
    subtitle: 'Decide si la campagne autorise le paiement en plusieurs fois.',
    title: 'Paiement fractionne',
  },
  internalNote: {
    key: 'internalNote',
    subtitle: 'Ajoute si besoin une note uniquement visible en gestion.',
    title: 'Note interne',
  },
  name: {
    key: 'name',
    subtitle: 'Donne un nom clair a la campagne de cotisation.',
    title: 'Nom',
  },
  overdueDate: {
    key: 'overdueDate',
    subtitle: 'Choisis a partir de quand un dossier passe officiellement en retard.',
    title: 'Retard',
  },
  paymentInstructions: {
    key: 'paymentInstructions',
    subtitle: 'Precise les consignes liees aux moyens de paiement actives.',
    title: 'Consignes',
  },
  paymentMethods: {
    key: 'paymentMethods',
    subtitle: 'Active les moyens de paiement proposes aux membres.',
    title: 'Moyens de paiement',
  },
  paymentOnline: {
    key: 'paymentOnline',
    subtitle: 'Configure le lien externe du club ou la connexion HelloAsso.',
    title: 'Paiement en ligne',
  },
  paymentOwner: {
    key: 'paymentOwner',
    subtitle: 'Choisis qui encaisse les paiements en ligne.',
    title: 'Encaissement',
  },
  period: {
    key: 'period',
    subtitle: 'Definis la periode de la campagne puis confirme la saison detectee pour ton club.',
    title: 'Periode',
  },
  pricingRules: {
    key: 'pricingRules',
    subtitle: 'Ajoute les exceptions de tarif par role, equipe, categorie, section ou niveau.',
    title: 'Tarifs speciaux',
  },
  reminderMessage: {
    key: 'reminderMessage',
    subtitle: 'Redige le message utilise dans les relances automatiques.',
    title: 'Message',
  },
  reminderStatuses: {
    key: 'reminderStatuses',
    subtitle: 'Choisis quels dossiers doivent recevoir des relances.',
    title: 'Statuts a relancer',
  },
  reminderTiming: {
    key: 'reminderTiming',
    subtitle: 'Regle la cadence des relances avant et apres l echeance.',
    title: 'Cadence de relance',
  },
  reminderToggle: {
    key: 'reminderToggle',
    subtitle: 'Active ou non les relances automatiques sur la campagne.',
    title: 'Relances auto',
  },
  review: {
    key: 'review',
    subtitle: 'Verifie l ensemble avant d enregistrer, programmer ou ouvrir la campagne.',
    title: 'Recap',
  },
  season: {
    key: 'season',
    subtitle: 'On detecte une saison a partir des dates, puis tu peux la confirmer ou l ajuster selon le fonctionnement du club.',
    title: 'Saison',
  },
  startDate: {
    key: 'startDate',
    subtitle: 'Choisis la date de debut de la campagne.',
    title: 'Date de debut',
  },
  targetCategories: {
    key: 'targetCategories',
    subtitle: 'Filtre la campagne par categorie si besoin.',
    title: 'Categories',
  },
  targetLevels: {
    key: 'targetLevels',
    subtitle: 'Ajoute un filtre par niveau si necessaire.',
    title: 'Niveaux',
  },
  targetMode: {
    key: 'targetMode',
    subtitle: 'Decide si la campagne concerne tout le club ou selectionne directement les profils vises.',
    title: 'Public concerne',
  },
  targetRoles: {
    key: 'targetRoles',
    subtitle: 'Filtre les membres par role.',
    title: 'Roles',
  },
  targetSections: {
    key: 'targetSections',
    subtitle: 'Filtre les membres par section.',
    title: 'Sections',
  },
  targetTeams: {
    key: 'targetTeams',
    subtitle: 'Filtre les membres par equipe.',
    title: 'Equipes',
  },
  type: {
    key: 'type',
    subtitle: 'Choisis le type de campagne: licence, adhesion, equipement ou autre.',
    title: 'Type',
  },
};
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
const helloAssoReadyStates = new Set(['ready', 'webhook_pending', 'webhook_stale']);
const getHelloAssoSnapshot = (campaign) => campaign?.paymentProviderSnapshot?.helloasso || null;
const createHelloAssoDraft = (campaign) => {
  const snapshot = getHelloAssoSnapshot(campaign);
  return {
    clientId: '',
    clientSecret: '',
    environment: snapshot?.environment || 'production',
    organizationSlug: snapshot?.organizationSlug || '',
  };
};
const isHelloAssoReadyForCampaign = (snapshot) => helloAssoReadyStates.has(String(snapshot?.readiness || '').trim());
const describeHelloAssoReadiness = (snapshot) => {
  const readiness = String(snapshot?.readiness || '').trim();
  if (!readiness) {
    return 'La connexion HelloAsso n est pas encore configuree pour cette campagne.';
  }
  if (readiness === 'ready') {
    return 'Connexion HelloAsso validee. La campagne peut utiliser le paiement in-app.';
  }
  if (readiness === 'webhook_pending') {
    return 'Connexion validee. Le premier paiement doit encore confirmer le webhook.';
  }
  if (readiness === 'webhook_stale') {
    return 'Connexion validee, mais aucun webhook recent n a ete vu. Un test de paiement est recommande.';
  }
  if (readiness === 'oauth_failed') {
    return 'OAuth HelloAsso en erreur. Verifie le client id et le client secret.';
  }
  if (readiness === 'checkout_failed') {
    return 'Le test de checkout HelloAsso a echoue. Verifie le slug organisation et les droits API.';
  }
  if (readiness === 'credentials_missing') {
    return 'Renseigne le slug, le client id et le client secret avant publication.';
  }
  if (readiness === 'disabled') {
    return 'HelloAsso est desactive pour ce scope.';
  }
  if (readiness === 'pending') {
    return 'La configuration HelloAsso existe, mais elle n a pas encore ete verifiee.';
  }
  return 'La configuration HelloAsso demande une verification supplementaire.';
};
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
  required: documentRequest.required !== false,
  requiresManualValidation: documentRequest.requiresManualValidation !== false,
  requiresSignature: documentRequest.requiresSignature === true,
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
  const hasStoredIncludeAllMembers = typeof config.includeAllMembers === 'boolean';
  let includeAllMembers = false;

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
const buildSeasonLabelSuggestions = ({ detectedSeasonLabel, seasonLabel }) => {
  const baseLabel = String(detectedSeasonLabel || seasonLabel || '').trim();
  const match = baseLabel.match(/^(\d{4})\D+(\d{4})$/);
  if (!match) {
    return [...new Set([seasonLabel, detectedSeasonLabel].filter(Boolean).map((value) => String(value).trim()))];
  }
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  return [...new Set([
    formatSeasonLabel(startYear - 1, endYear - 1),
    formatSeasonLabel(startYear, endYear),
    formatSeasonLabel(startYear + 1, endYear + 1),
    String(seasonLabel || '').trim(),
  ].filter(Boolean))];
};
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
      `Cotisation equipements ${season}`,
      `Campagne equipements ${season}`,
      `Equipements ${season}`,
    ],
    internship: [
      `Participation stage ${season}`,
      `Campagne stage ${season}`,
      `Stage ${season}`,
    ],
    license: [
      `Cotisation licences ${season}`,
      `Campagne licences ${season}`,
      `Licences ${season}`,
    ],
    membership: [
      `Cotisation adhesions ${season}`,
      `Campagne adhesion ${season}`,
      `Adhesions ${season}`,
    ],
    other: [
      `Cotisation ${season}`,
      `Campagne ${season}`,
      `Paiement ${season}`,
    ],
    tournament: [
      `Participation tournoi ${season}`,
      `Campagne tournoi ${season}`,
      `Tournoi ${season}`,
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
      `Cette campagne concerne les equipements pour la saison ${season}. Merci de finaliser votre reglement dans les delais indiques par le club.`,
      `Retrouvez ici les informations de paiement liees aux equipements de la saison ${season}.`,
      `Cette cotisation couvre les equipements prevus pour la saison ${season}.`,
    ],
    internship: [
      `Cette campagne concerne la participation au stage ${season}. Merci de suivre les modalites de paiement indiquees par le club.`,
      `Retrouvez ici les informations de reglement pour le stage de la saison ${season}.`,
      `Cette cotisation permet de confirmer l inscription au stage ${season}.`,
    ],
    license: [
      `Cette campagne concerne les licences pour la saison ${season}. Merci de completer votre dossier et votre paiement dans les delais.`,
      `Retrouvez ici les informations de paiement et les documents a fournir pour la licence ${season}.`,
      `Cette cotisation permet de finaliser la licence pour la saison ${season}.`,
    ],
    membership: [
      `Cette campagne concerne les adhesions pour la saison ${season}. Merci de completer votre dossier et votre reglement.`,
      `Retrouvez ici les informations necessaires pour regler votre adhesion ${season}.`,
      `Cette cotisation permet de valider l'adhesion a la saison ${season}.`,
    ],
    other: [
      `Merci de retrouver ici toutes les informations utiles pour cette campagne ${season}.`,
      'Cette campagne regroupe les modalites de paiement et les informations visibles par les membres.',
      'Merci de completer votre reglement selon les consignes indiquees par le club.',
    ],
    tournament: [
      `Cette campagne concerne la participation au tournoi ${season}. Merci de suivre les modalites indiquees pour valider votre inscription.`,
      `Retrouvez ici les informations de reglement pour le tournoi ${season}.`,
      `Cette cotisation permet de confirmer la participation au tournoi ${season}.`,
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
      `Suivi interne ${season} : verifier les tailles, les stocks et les reglements avant de lancer la commande equipement.`,
      `Campagne equipement ${season} : valider les paiements recus avant remise des articles.`,
      'Note staff : centraliser ici les cas particuliers, remises et commandes a confirmer.',
    ],
    internship: [
      `Suivi stage ${season} : verifier les dossiers complets, les paiements recus et les places restantes.`,
      `Campagne stage ${season} : relancer les familles en attente avant validation finale.`,
      'Note equipe : suivre ici les exemptions, paiements manuels et confirmations de participation.',
    ],
    license: [
      `Suivi licences ${season} : verifier les documents manquants et relancer avant validation finale.`,
      `Campagne licences ${season} : rapprocher les paiements manuels chaque semaine et signaler les dossiers incomplets.`,
      'Note dirigeants : utiliser cet espace pour les cas particuliers, exemptions et relances prioritaires.',
    ],
    membership: [
      `Suivi adhesions ${season} : verifier les paiements recus et les demandes en attente de validation.`,
      `Campagne adhesions ${season} : noter ici les cas particuliers, remises et suivis a faire avec les familles.`,
      'Note gestion : confirmer chaque adhesion apres reception du reglement complet.',
    ],
    other: [
      `Suivi interne ${season} : centraliser ici les points de vigilance et les relances a effectuer.`,
      'Note staff : utiliser cet espace pour les exceptions, paiements manuels et commentaires de suivi.',
      'Rappel gestion : verifier les dossiers incomplets avant cloture de la campagne.',
    ],
    tournament: [
      `Suivi tournoi ${season} : verifier les inscriptions, paiements recus et confirmations avant cloture.`,
      `Campagne tournoi ${season} : noter ici les equipes a relancer et les cas particuliers a traiter.`,
      'Note organisation : centraliser les suivis de paiement et de validation dans cet espace.',
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
  category: 'Categorie',
  level: 'Niveau',
  role: 'Role',
  section: 'Section',
  team: 'Equipe',
};
const renderReminderPreview = ({
  campaignName,
  dueDate,
  message,
  totalLabel,
}) => {
  const template = String(message || '').trim()
    || 'Bonjour {{firstname}}, il vous reste {{amountRemaining}} a regler pour {{campaignName}} avant le {{dueDate}}.';
  return template
    .replace(/\{\{\s*firstname\s*\}\}/g, 'Lucas')
    .replace(/\{\{\s*lastname\s*\}\}/g, 'Martin')
    .replace(/\{\{\s*campaignName\s*\}\}/g, campaignName || 'Cotisation FoundClub')
    .replace(/\{\{\s*amountTotal\s*\}\}/g, totalLabel || '180,00 EUR')
    .replace(/\{\{\s*amountPaid\s*\}\}/g, '60,00 EUR')
    .replace(/\{\{\s*amountRemaining\s*\}\}/g, '120,00 EUR')
    .replace(/\{\{\s*dueDate\s*\}\}/g, dueDate || '2026-09-15')
    .replace(/\{\{\s*paymentLink\s*\}\}/g, 'https://foundclub.app/licenses/pay/demo');
};

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.onChangeText
 * @param root0.placeholder
 * @param root0.value
 * @param root0.multiline
 */
function Field({
  label, multiline = false, onChangeText, placeholder, value,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  return (
    <View style={Spaces.gap[8]}>
      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{label}</Text>
      <TextInput
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
  const {
    Colors, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={Spaces.gap[16]}>
      <View style={Spaces.gap[8]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Devise</Text>
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
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{`Prix par defaut (${currency})`}</Text>
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
          Saisis simplement un montant, par exemple `250` ou `250,00`.
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
 *
 * @param root0
 * @param root0.label
 * @param root0.onPress
 * @param root0.selected
 */
function SelectionChip({ label, onPress, selected }) {
  const {
    Colors, Fonts,
  } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: selected ? Colors.primary500 : Colors.primary800,
        borderColor: selected ? Colors.primary500 : `${Colors.primary500}44`,
        borderRadius: licenseRadius.pill,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <Text style={[Fonts.p3Bold, selected ? Fonts.neutral900 : Fonts.neutral200]}>{label}</Text>
    </Pressable>
  );
}

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
          <Text style={[Fonts.p3Bold, Fonts.primary500]}>Selectionnee</Text>
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
      {!items?.length ? <Text style={[Fonts.p3, Fonts.neutral300]}>Aucune option disponible pour ce filtre.</Text> : null}
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
        label="Nom du document"
        onChangeText={(value) => onChange({ name: value })}
        placeholder="Certificat medical"
        value={item.name}
      />
      <Field
        label="Description / consigne"
        multiline
        onChangeText={(value) => onChange({ description: value })}
        placeholder="Document officiel, date de moins de 12 mois..."
        value={item.description}
      />
      <DateField
        label="Date limite de depot"
        onChange={(value) => onChange({ dueDate: value })}
        placeholder="Selectionner une date"
        value={item.dueDate}
      />
      <Field
        label="Formats acceptes"
        onChangeText={(value) => onChange({ acceptedMimeTypesText: value })}
        placeholder="application/pdf, image/jpeg, image/png"
        value={item.acceptedMimeTypesText}
      />
      <PaymentModeToggle
        enabled={item.required}
        label="Document obligatoire"
        onChange={(value) => onChange({ required: value })}
      />
      <PaymentModeToggle
        enabled={item.requiresManualValidation}
        label="Validation manuelle"
        onChange={(value) => onChange({ requiresManualValidation: value })}
      />
      <PaymentModeToggle
        enabled={item.requiresSignature}
        label="Signature demandee"
        onChange={(value) => onChange({ requiresSignature: value })}
      />
      {canRemove ? <Button onPress={onRemove} title="Retirer ce document" variant="Secondary" /> : null}
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
        label="Libelle interne"
        onChangeText={(value) => onChange({ label: value })}
        placeholder="Tarif joueurs seniors"
        value={item.label}
      />
      <View style={Spaces.gap[8]}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Type de regle</Text>
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
          label="Roles concernes"
          onToggle={(value) => onChange({ roleName: item.roleName === value ? '' : value })}
          selectedKeys={item.roleName ? [item.roleName] : []}
        />
      ) : null}
      {showTeam ? (
        <SelectionGroup
          items={teamOptions}
          label="Equipe concernee"
          onToggle={(value) => onChange({ teamKey: item.teamKey === value ? '' : value })}
          selectedKeys={item.teamKey ? [item.teamKey] : []}
        />
      ) : null}
      {showCategory ? (
        <SelectionGroup
          items={categoryOptions}
          label="Categorie concernee"
          onToggle={(value) => onChange({ categoryKey: item.categoryKey === value ? '' : value })}
          selectedKeys={item.categoryKey ? [item.categoryKey] : []}
        />
      ) : null}
      {showSection ? (
        <SelectionGroup
          items={sectionOptions}
          label="Section concernee"
          onToggle={(value) => onChange({ sectionKey: item.sectionKey === value ? '' : value })}
          selectedKeys={item.sectionKey ? [item.sectionKey] : []}
        />
      ) : null}
      {showLevel ? (
        <SelectionGroup
          items={levelOptions}
          label="Niveau concerne"
          onToggle={(value) => onChange({ levelKey: item.levelKey === value ? '' : value })}
          selectedKeys={item.levelKey ? [item.levelKey] : []}
        />
      ) : null}
      <Field
        label="Montant (EUR)"
        onChangeText={(value) => onChange({ amount: value })}
        placeholder="180"
        value={item.amount}
      />
      <Field
        label="Priorite"
        onChangeText={(value) => onChange({ priority: value })}
        placeholder="10"
        value={item.priority}
      />
      <PaymentModeToggle
        enabled={item.isWaiver}
        label="Exoneration automatique"
        onChange={(value) => onChange({ isWaiver: value })}
      />
      <Button onPress={onRemove} title="Retirer cette regle" variant="Secondary" />
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
  const createNewCampaign = Boolean(route?.params?.createNew || (routeEventId && !routeCampaignId));
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
  const campaignId = routeCampaignId || campaign?.documentId || campaign?.id;
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
  const [helloAssoConfig, setHelloAssoConfig] = useState(() => createHelloAssoDraft(campaign));
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
    setHelloAssoConfig(createHelloAssoDraft(campaign));
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

  const addDocumentRequest = useCallback(() => {
    setDocumentRequests((currentItems) => [...currentItems, createDocumentRequestDraft()]);
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

  const addPricingRule = useCallback(() => {
    setPricingRules((currentItems) => [...currentItems, createPricingRuleDraft()]);
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

  const updateInstallment = useCallback((localId, patch) => {
    setInstallmentSchedule((currentItems) => currentItems.map((item) => (
      item.localId === localId ? { ...item, ...patch } : item
    )));
  }, []);

  useEffect(() => {
    if (!allowInstallments) return;
    const desiredCount = Math.max(1, Number(installmentCount) || 1);
    setInstallmentSchedule((currentItems) => {
      const nextItems = currentItems.slice(0, desiredCount);
      while (nextItems.length < desiredCount) {
        nextItems.push(createInstallmentDraft({}, nextItems.length));
      }
      return nextItems.map((item, index) => ({
        ...item,
        frequency: item.frequency || installmentFrequency || 'monthly',
        label: item.label || `${index + 1}`,
      }));
    });
  }, [allowInstallments, installmentCount, installmentFrequency]);

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
  const campaignStartDateValue = useMemo(() => parseIsoDateValue(startDate), [startDate]);
  const maximumCampaignStartDate = useMemo(() => parseIsoDateValue(endDate), [endDate]);
  const minimumCampaignEndDate = useMemo(() => parseIsoDateValue(startDate), [startDate]);
  const detectedSeasonLabel = useMemo(() => detectSeasonLabelFromDates({
    endDate,
    startDate,
  }), [endDate, startDate]);
  const seasonLabelSuggestions = useMemo(() => buildSeasonLabelSuggestions({
    detectedSeasonLabel,
    seasonLabel,
  }), [detectedSeasonLabel, seasonLabel]);

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
  const selectedReminderStatusOptions = useMemo(
    () => reminderStatusOptions.filter((option) => reminderTargetStatuses.includes(option.key)),
    [reminderTargetStatuses],
  );
  const availableReminderStatusOptions = useMemo(
    () => reminderStatusOptions.filter((option) => !reminderTargetStatuses.includes(option.key)),
    [reminderTargetStatuses],
  );

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
  const hasOnlinePaymentStep = Boolean(
    paymentModes.external_link
    || paymentModes.helloasso,
  );
  const licenseCampaignWizardSteps = useMemo(() => {
    const steps = [
      licenseCampaignWizardStepCatalog.name,
      licenseCampaignWizardStepCatalog.description,
      licenseCampaignWizardStepCatalog.period,
      licenseCampaignWizardStepCatalog.targetMode,
      licenseCampaignWizardStepCatalog.amount,
      licenseCampaignWizardStepCatalog.pricingRules,
      licenseCampaignWizardStepCatalog.installmentsToggle,
    ];

    if (allowInstallments) {
      steps.push(
        licenseCampaignWizardStepCatalog.installmentsSetup,
        licenseCampaignWizardStepCatalog.installmentsOptions,
        licenseCampaignWizardStepCatalog.installmentsSchedule,
      );
    }

    steps.push(
      licenseCampaignWizardStepCatalog.paymentMethods,
    );

    if (hasOfflineInstructions) {
      steps.push(licenseCampaignWizardStepCatalog.paymentInstructions);
    }

    if (hasOnlinePaymentStep) {
      steps.push(
        licenseCampaignWizardStepCatalog.paymentOwner,
        licenseCampaignWizardStepCatalog.paymentOnline,
      );
    }

    steps.push(
      licenseCampaignWizardStepCatalog.documents,
      licenseCampaignWizardStepCatalog.overdueDate,
      licenseCampaignWizardStepCatalog.reminderToggle,
    );

    if (autoReminderEnabled) {
      steps.push(
        licenseCampaignWizardStepCatalog.reminderStatuses,
        licenseCampaignWizardStepCatalog.reminderTiming,
        licenseCampaignWizardStepCatalog.reminderMessage,
      );
    }

    steps.push(
      licenseCampaignWizardStepCatalog.internalNote,
      licenseCampaignWizardStepCatalog.review,
    );
    return steps;
  }, [
    allowInstallments,
    autoReminderEnabled,
    hasOfflineInstructions,
    hasOnlinePaymentStep,
  ]);
  const canPublishFromWizard = !campaign?.status || campaign?.status === 'draft';
  const publishTargetStatus = useMemo(
    () => (startDate && startDate > todayIsoDateValue ? 'scheduled' : 'active'),
    [startDate, todayIsoDateValue],
  );
  const publishActionLabel = publishTargetStatus === 'scheduled' ? 'Programmer' : 'Ouvrir maintenant';
  const activeWizardStep = licenseCampaignWizardSteps[wizardStepIndex] || licenseCampaignWizardSteps[0];
  const wizardStepCount = licenseCampaignWizardSteps.length;
  const finalSaveLabel = useMemo(() => {
    if (wizardStepIndex < wizardStepCount - 1) return 'Suivant';
    return canPublishFromWizard ? 'Enregistrer le brouillon' : 'Enregistrer';
  }, [canPublishFromWizard, wizardStepCount, wizardStepIndex]);
  const effectiveHelloAssoSnapshot = helloAssoSnapshot || getHelloAssoSnapshot(campaign);
  const helloAssoScopePayload = useMemo(() => {
    if (paymentOwner === 'multisport') {
      const multisportClubId = club?.parentMultisport?.documentId || club?.parentMultisport?.id || null;
      return multisportClubId ? { multisportClubId } : null;
    }
    return clubId ? { clubId } : null;
  }, [club?.parentMultisport?.documentId, club?.parentMultisport?.id, clubId, paymentOwner]);
  const helloAssoIsPublishReady = isHelloAssoReadyForCampaign(effectiveHelloAssoSnapshot);
  const helloAssoStatusMessage = describeHelloAssoReadiness(effectiveHelloAssoSnapshot);

  useEffect(() => {
    setWizardStepIndex((currentIndex) => Math.min(currentIndex, Math.max(licenseCampaignWizardSteps.length - 1, 0)));
  }, [licenseCampaignWizardSteps.length]);

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
  const helloAssoMutation = useLicenseMutation(async () => {
    if (!helloAssoScopePayload) {
      throw new Error('Le scope HelloAsso est incomplet. Verifie le club ou le multisport choisi.');
    }
    return connectLicenseHelloAsso({
      ...helloAssoScopePayload,
      clientId: helloAssoConfig.clientId,
      clientSecret: helloAssoConfig.clientSecret,
      environment: helloAssoConfig.environment,
      organizationSlug: helloAssoConfig.organizationSlug,
    });
  }, campaignId);
  const handleHelloAssoFieldChange = useCallback((key, value) => {
    setHelloAssoConfig((currentConfig) => ({
      ...currentConfig,
      [key]: value,
    }));
  }, []);
  const verifyHelloAssoConnection = useCallback(() => {
    if (paymentOwner === 'multisport' && !club?.parentMultisport) {
      Alert.alert('Multisport requis', 'Ce club n est rattache a aucun multisport. Garde un encaissement section ou configure le multisport d abord.');
      return;
    }
    helloAssoMutation.mutate(undefined, {
      onError: (error) => {
        Alert.alert('Verification HelloAsso impossible', error?.message || 'La verification HelloAsso a echoue.');
      },
      onSuccess: (result) => {
        setHelloAssoSnapshot(result?.snapshot || null);
        setHelloAssoConfig((currentConfig) => ({
          ...currentConfig,
          clientId: '',
          clientSecret: '',
          environment: result?.snapshot?.environment || currentConfig.environment,
          organizationSlug: result?.snapshot?.organizationSlug || currentConfig.organizationSlug,
        }));
        Alert.alert(
          result?.readiness === 'ready' || result?.readiness === 'webhook_pending' || result?.readiness === 'webhook_stale'
            ? 'HelloAsso pret'
            : 'HelloAsso a verifier',
          describeHelloAssoReadiness(result?.snapshot),
        );
      },
    });
  }, [club?.parentMultisport, helloAssoMutation, paymentOwner]);
  const syncSavedCampaignParams = useCallback((savedCampaignId) => {
    if (!savedCampaignId) return;
    navigation.setParams({
      campaign: undefined,
      campaignId: savedCampaignId,
    });
  }, [navigation]);
  const goToCampaignOperations = useCallback((savedCampaignId) => {
    if (!savedCampaignId) return;
    navigation.replace(RouteNames.ClubLicenseCampaignDetail, {
      campaign: undefined,
      campaignId: savedCampaignId,
      clubId,
    });
  }, [clubId, navigation]);

  const persistCampaign = useCallback((options = {}) => {
    const requestedStatus = options.status || campaign?.status || 'draft';
    if (requestedStatus !== 'draft' && paymentModes.external_link && !String(externalUrl || '').trim()) {
      Alert.alert('Lien manquant', 'Ajoute le lien externe du club avant publication.');
      return;
    }
    if (requestedStatus !== 'draft' && paymentModes.helloasso && !helloAssoIsPublishReady) {
      Alert.alert('HelloAsso non pret', helloAssoStatusMessage);
      return;
    }
    const persistedDocumentWithEmptyName = documentRequests.find((item) => item.documentId && !item.name.trim());
    if (persistedDocumentWithEmptyName) {
      Alert.alert('Document incomplet', 'Renseigne le nom des documents existants avant d enregistrer.');
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
      Alert.alert('Regle tarifaire incomplete', 'Complete chaque regle de prix avant de sauvegarder la campagne.');
      return;
    }
    saveMutation.mutate({ status: requestedStatus }, {
      onError: (error) => {
        const subscriptionDecision = extractSubscriptionDecisionFromError(error);
        if (subscriptionDecision) {
          setSubscriptionPaywallDecision(subscriptionDecision);
          return;
        }
        Alert.alert(
          'Campagne impossible',
          error?.message || 'Impossible de sauvegarder cette campagne pour le moment.',
        );
      },
      onSuccess: async (saved) => {
        const savedCampaignId = saved?.documentId || saved?.id || campaignId;
        const activeDocumentRequests = documentRequests
          .map((item, index) => ({
            acceptedMimeTypes: parseAcceptedMimeTypes(item.acceptedMimeTypesText),
            description: item.description.trim(),
            dueDate: item.dueDate.trim() || null,
            id: item.documentId,
            name: item.name.trim(),
            required: item.required !== false,
            requiresManualValidation: item.requiresManualValidation !== false,
            requiresSignature: item.requiresSignature === true,
            sortOrder: index + 1,
          }))
          .filter((item) => item.name);
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
            await Promise.all(removedDocumentRequestIds.map((documentRequestId) => deleteLicenseDocumentRequest(documentRequestId)));
            await Promise.all(activeDocumentRequests.map((item) => upsertLicenseDocumentRequest(savedCampaignId, item)));
            await Promise.all(removedPricingRuleIds.map((pricingRuleId) => deleteLicensePricingRule(pricingRuleId)));
            await Promise.all(activePricingRules.map((item) => upsertLicensePricingRule(savedCampaignId, item)));
          }
          await providerMutation.mutateAsync();
        } catch (error) {
          goToCampaignOperations(savedCampaignId);
          Alert.alert(
            'Campagne enregistree partiellement',
            error?.message || 'La campagne est sauvee, mais certains documents ou providers demandent une verification.',
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
        let successTitle = 'Campagne ouverte';
        let successMessage = 'La campagne est ouverte et les membres concernes sont synchronises automatiquement.';
        if (isDraftSave) {
          successTitle = 'Brouillon enregistre';
          successMessage = 'Le brouillon est sauvegarde. Tu pourras le reprendre avant publication.';
        } else if (isScheduledSave) {
          successTitle = 'Campagne programmee';
          successMessage = 'La campagne est publiee et s ouvrira automatiquement a sa date de debut.';
        }
        Alert.alert(successTitle, successMessage, [
          {
            onPress: () => goToCampaignOperations(savedCampaignId),
            text: 'OK',
          },
        ]);
      },
    });
  }, [campaign?.status, campaignId, documentRequests, externalUrl, goToCampaignOperations, helloAssoIsPublishReady, helloAssoStatusMessage, paymentModes.external_link, paymentModes.helloasso, pricingRules, providerMutation, queryClient, removedDocumentRequestIds, removedPricingRuleIds, routeEventId, saveMutation, syncSavedCampaignParams]);

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

  const handleSuggestedNamePress = useCallback((suggestion) => {
    setName(suggestion);
    setNameAutoManaged(true);
  }, []);

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

  const getWizardStepError = useCallback((stepKey) => {
    if (stepKey === 'name' && !String(name || '').trim()) {
      return { message: 'Donne un nom a la campagne avant de continuer.', title: 'Nom manquant' };
    }

    if (stepKey === 'period') {
      if (!startDate) {
        return { message: 'Selectionne une date de debut.', title: 'Date manquante' };
      }
      if (!endDate) {
        return { message: 'Selectionne une date de fin.', title: 'Date manquante' };
      }
      const parsedStartDate = parseIsoDateValue(startDate);
      const parsedEndDate = parseIsoDateValue(endDate);
      if (parsedStartDate && parsedEndDate && parsedStartDate.getTime() > parsedEndDate.getTime()) {
        return { message: 'La date de fin doit etre egale ou posterieure a la date de debut.', title: 'Periode invalide' };
      }
      if (!String(seasonLabel || '').trim()) {
        return { message: 'Renseigne la saison de la campagne.', title: 'Saison manquante' };
      }
    }

    if (stepKey === 'amount' && euroToCents(amount) <= 0) {
      return { message: 'Le prix par defaut doit etre superieur a 0 EUR.', title: 'Montant invalide' };
    }

    if (stepKey === 'targetMode' && !targetConfig.includeAllMembers && !isEventParticipantTarget) {
      const hasAtLeastOneFilter = Boolean(
        targetConfig.roles.length
        || targetConfig.teamIds.length
        || targetConfig.categoryIds.length
        || targetConfig.sectionIds.length
        || targetConfig.levelIds.length,
      );
      if (!hasAtLeastOneFilter) {
        return {
          message: 'Choisis au moins un filtre ou repasse la campagne sur tout le club.',
          title: 'Cible incomplete',
        };
      }
    }

    if (stepKey === 'pricingRules' || stepKey === 'review') {
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
          message: 'Complete ou retire chaque regle tarifaire avant de continuer.',
          title: 'Regle tarifaire incomplete',
        };
      }
    }

    if (stepKey === 'documents' || stepKey === 'review') {
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
          message: 'Chaque document commence par un nom. Vide completement les brouillons inutilises ou renseigne leur nom.',
          title: 'Document incomplet',
        };
      }
      if ((stepKey === 'reminderStatuses' || stepKey === 'review') && autoReminderEnabled && reminderTargetStatuses.length === 0) {
        return {
          message: 'Choisis au moins un statut a relancer automatiquement.',
          title: 'Relances incomplètes',
        };
      }
    }

    if ((stepKey === 'reminderStatuses' || stepKey === 'review') && autoReminderEnabled && reminderTargetStatuses.length === 0) {
      return {
        message: 'Choisis au moins un statut a relancer automatiquement.',
        title: 'Relances incompletes',
      };
    }

    if ((stepKey === 'installmentsSetup' || stepKey === 'review') && allowInstallments) {
      if ((Number(installmentCount) || 0) < 1) {
        return {
          message: 'Le nombre d echeances doit etre superieur ou egal a 1.',
          title: 'Echeancier invalide',
        };
      }
    }

    if ((stepKey === 'paymentMethods' || stepKey === 'review') && enabledPaymentModeLabels.length === 0) {
      return {
        message: 'Active au moins un moyen de paiement avant de terminer le tunnel.',
        title: 'Paiement manquant',
      };
    }

    if ((stepKey === 'paymentOnline' || stepKey === 'review') && paymentModes.external_link && !String(externalUrl || '').trim()) {
      return {
        message: 'Ajoute le lien externe du club avant de continuer.',
        title: 'Lien manquant',
      };
    }

    if ((stepKey === 'paymentOnline' || stepKey === 'review') && paymentModes.helloasso && !helloAssoIsPublishReady) {
      return {
        message: helloAssoStatusMessage,
        title: 'HelloAsso non pret',
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
      save();
      return;
    }
    setWizardStepIndex((currentIndex) => Math.min(wizardStepCount - 1, currentIndex + 1));
  }, [activeWizardStep.key, getWizardStepError, save, wizardStepCount, wizardStepIndex]);

  const isWizardNextDisabled = activeWizardStep.key === 'name' && !String(name || '').trim();

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
          description="On recupere la campagne avant d afficher le formulaire."
          title="Chargement des parametres"
        />
      </ScreenContainer>
    );
  }

  if (campaignHasError) {
    return (
      <ScreenContainer bottomInsetMode="none" withHeaderPadding>
        <LicenseEmptyState
          action={<Button onPress={retryCampaign} title="Reessayer" variant="Secondary" />}
          description="Impossible de charger la campagne. Le formulaire n est pas ouvert pour eviter d ecraser ses parametres."
          title="Parametres indisponibles"
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
  const targetFilterParts = [
    `${targetConfig.roles.length} role(s)`,
    `${targetConfig.teamIds.length} equipe(s)`,
    `${targetConfig.categoryIds.length} categorie(s)`,
    `${targetConfig.sectionIds.length} section(s)`,
    `${targetConfig.levelIds.length} niveau(x)`,
  ];
  const filteredTargetSummary = `${targetFilterParts.join(', ')} filtres.`;
  const reviewFilteredTargetSummary = `${targetFilterParts.join(', ')}.`;
  let targetModeSummaryText = filteredTargetSummary;
  if (isEventParticipantTarget) {
    targetModeSummaryText = [
      'Cible verrouillee sur les participants acceptes',
      'de l evenement.',
    ].join(' ');
  } else if (targetConfig.includeAllMembers) {
    targetModeSummaryText = 'La campagne concernera tout le club.';
  }
  let reviewTargetSummaryText = reviewFilteredTargetSummary;
  if (isEventParticipantTarget) {
    reviewTargetSummaryText = [
      'Les participants acceptes de l evenement recevront',
      'cette cotisation.',
    ].join(' ');
  } else if (targetConfig.includeAllMembers) {
    reviewTargetSummaryText = 'Tous les membres du club seront pris en compte.';
  }

  let stepContent = null;

  if (activeWizardStep.key === 'name') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <Field
          label="Nom de la campagne"
          onChangeText={handleNameChange}
          placeholder={campaignNameSuggestions[0] || 'Cotisation licences 2026/2027'}
          value={name}
        />
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p3, Fonts.neutral200]}>Type de campagne</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            Le nom se remplit automatiquement selon le type choisi. Tu peux ensuite le modifier.
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
        </View>
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p3, Fonts.neutral200]}>Noms proposes</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {campaignNameSuggestions.map((suggestion) => (
              <SelectionChip
                key={suggestion}
                label={suggestion}
                onPress={() => handleSuggestedNamePress(suggestion)}
                selected={String(name || '').trim() === suggestion}
              />
            ))}
          </View>
        </View>
      </View>
    );
  } else if (activeWizardStep.key === 'description') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <Field label="Description visible" multiline onChangeText={setDescription} placeholder="Informations visibles par les membres" value={description} />
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Modeles proposes</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Choisis un modele pour pre-remplir le texte, puis ajuste-le si besoin. Appuie une deuxieme fois pour le retirer.
          </Text>
          <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
            {campaignDescriptionSuggestions.map((suggestion, index) => (
              <SuggestionCard
                description={suggestion}
                key={suggestion}
                onPress={() => handleDescriptionSuggestionPress(suggestion)}
                selected={String(description || '').trim() === suggestion}
                title={`Modele ${index + 1}`}
              />
            ))}
          </View>
        </View>
      </View>
    );
  } else if (activeWizardStep.key === 'period') {
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        <View style={primaryStepCardStyle}>
          <DateField
            label="Date de debut"
            maximumDate={maximumCampaignStartDate}
            onChange={setStartDate}
            value={startDate}
          />
          <DateField
            label="Date de fin"
            minimumDate={minimumCampaignEndDate}
            onChange={setEndDate}
            value={endDate}
          />
        </View>
        <View style={secondaryStepCardStyle}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Saison detectee</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {detectedSeasonLabel
              ? `A partir des dates, on detecte plutot la saison ${detectedSeasonLabel}.`
              : 'Choisis d abord les dates, puis confirme la saison detectee.'}
          </Text>
          <Field
            label="Saison a conserver"
            onChangeText={(value) => {
              setSeasonLabelManuallyEdited(true);
              setSeasonLabel(value);
            }}
            placeholder={detectedSeasonLabel || '2026-2027'}
            value={seasonLabel}
          />
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            Tu peux garder la saison detectee ou la modifier si ton club bascule plutot en aout, septembre ou selon une logique interne.
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {seasonLabelSuggestions.map((suggestion) => (
              <SelectionChip
                key={suggestion}
                label={suggestion}
                onPress={() => {
                  setSeasonLabel(suggestion);
                  setSeasonLabelManuallyEdited(suggestion !== detectedSeasonLabel);
                }}
                selected={String(seasonLabel || '').trim() === suggestion}
              />
            ))}
          </View>
          {detectedSeasonLabel ? (
            <Button
              onPress={() => {
                setSeasonLabel(detectedSeasonLabel);
                setSeasonLabelManuallyEdited(false);
              }}
              title={`Utiliser ${detectedSeasonLabel}`}
              variant="Secondary"
            />
          ) : null}
        </View>
      </View>
    );
  } else if (activeWizardStep.key === 'amount') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <AmountField
          amount={amount}
          currency={currency}
          onAmountChange={setAmount}
          onCurrencyChange={setCurrency}
        />
      </View>
    );
  } else if (activeWizardStep.key === 'internalNote') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <Field label="Note interne dirigeants" multiline onChangeText={setInternalNote} placeholder="Visible uniquement en gestion" value={internalNote} />
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Notes internes proposees</Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            Choisis une base utile pour le suivi staff. Appuie une deuxieme fois pour la retirer.
          </Text>
          <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
            {internalNoteSuggestions.map((suggestion, index) => (
              <SuggestionCard
                description={suggestion}
                key={suggestion}
                onPress={() => handleInternalNoteSuggestionPress(suggestion)}
                selected={String(internalNote || '').trim() === suggestion}
                title={`Note ${index + 1}`}
              />
            ))}
          </View>
        </View>
      </View>
    );
  } else if (activeWizardStep.key === 'targetMode') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        {isEventParticipantTarget ? (
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Participants acceptes de l evenement</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Cette campagne est rattachee a un evenement. Les affectations seront generees pour les participants acceptes, y compris les participants externes.
            </Text>
          </View>
        ) : (
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
            <View style={[Spaces.gap[4], { flex: 1, paddingRight: 16 }]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Tous les membres du club</Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Active ce choix si la campagne concerne tout le club. Sinon, selectionne directement les profils vises.
              </Text>
            </View>
            <Switch
              onValueChange={(enabled) => setTargetConfig((current) => ({
                ...current,
                categoryIds: enabled ? [] : current.categoryIds,
                includeAllMembers: enabled,
                levelIds: enabled ? [] : current.levelIds,
                roles: enabled ? [] : current.roles,
                sectionIds: enabled ? [] : current.sectionIds,
                teamIds: enabled ? [] : current.teamIds,
              }))}
              value={targetConfig.includeAllMembers}
            />
          </View>
        )}
        {!targetConfig.includeAllMembers && !isEventParticipantTarget ? (
          <>
            <SelectionGroup
              description="Laisse vide si tu ne veux pas filtrer par role."
              items={roleOptions}
              label="Roles"
              onToggle={(value) => toggleTargetValue('roles', value, true)}
              selectedKeys={targetConfig.roles}
            />
            <SelectionGroup
              items={teamOptions}
              label="Equipes"
              onToggle={(value) => toggleTargetValue('teamIds', value)}
              selectedKeys={targetConfig.teamIds}
            />
            <SelectionGroup
              items={categoryOptions}
              label="Categories"
              onToggle={(value) => toggleTargetValue('categoryIds', value)}
              selectedKeys={targetConfig.categoryIds}
            />
            <SelectionGroup
              items={sectionOptions}
              label="Sections"
              onToggle={(value) => toggleTargetValue('sectionIds', value)}
              selectedKeys={targetConfig.sectionIds}
            />
            <SelectionGroup
              items={levelOptions}
              label="Niveaux"
              onToggle={(value) => toggleTargetValue('levelIds', value)}
              selectedKeys={targetConfig.levelIds}
            />
          </>
        ) : null}
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {targetModeSummaryText}
        </Text>
      </View>
    );
  } else if (activeWizardStep.key === 'pricingRules') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Regles de prix</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          Le prix par defaut reste la base. Ajoute ici les exceptions par role, equipe, categorie, section ou niveau.
        </Text>
        {pricingRules.length ? pricingRules.map((item) => (
          <PricingRuleEditor
            categoryOptions={categoryOptions}
            item={item}
            key={item.localId}
            levelOptions={levelOptions}
            onChange={(patch) => updatePricingRule(item.localId, patch)}
            onRemove={() => removePricingRule(item.localId)}
            roleOptions={roleOptions}
            sectionOptions={sectionOptions}
            teamOptions={teamOptions}
          />
        )) : <Text style={[Fonts.p3, Fonts.neutral300]}>Aucune regle supplementaire. Le prix par defaut sera applique a tous.</Text>}
        <Button onPress={addPricingRule} title="Ajouter une regle tarifaire" variant="Secondary" />
      </View>
    );
  } else if (activeWizardStep.key === 'reminderToggle') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <View style={[Spaces.gap[4], { flex: 1, paddingRight: 16 }]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Activer les relances automatiques</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>Relance les membres tant que leur cotisation reste a payer.</Text>
          </View>
          <Switch onValueChange={setAutoReminderEnabled} value={autoReminderEnabled} />
        </View>
      </View>
    );
  } else if (activeWizardStep.key === 'reminderTiming') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <Field label="Frequence de relance (jours)" onChangeText={setReminderFrequencyDays} placeholder="14" value={reminderFrequencyDays} />
        <Field label="Nombre maximum de relances" onChangeText={setReminderMaxCount} placeholder="5" value={reminderMaxCount} />
        <DateField
          label="Premiere relance a partir du (optionnel)"
          minimumDate={campaignStartDateValue}
          onChange={setReminderStartDate}
          value={reminderStartDate}
        />
        <Field label="Commencer X jours avant l echeance" onChangeText={setReminderBeforeDueDays} placeholder="5" value={reminderBeforeDueDays} />
        <Field label="Reprendre X jours apres l echeance" onChangeText={setReminderAfterDueDays} placeholder="7" value={reminderAfterDueDays} />
        <PaymentModeToggle enabled={reminderOnDueDate} label="Relance le jour de l echeance" onChange={setReminderOnDueDate} />
      </View>
    );
  } else if (activeWizardStep.key === 'reminderStatuses') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <View style={Spaces.gap[12]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Statuts cibles</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            Choisis les dossiers a relancer automatiquement. Appuie sur un statut ajoute pour le retirer.
          </Text>
        </View>
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Statuts ajoutes</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {selectedReminderStatusOptions.map((item) => (
              <SelectionChip
                key={item.key}
                label={item.label}
                onPress={() => handleReminderStatusToggle(item.key)}
                selected
              />
            ))}
          </View>
          {!selectedReminderStatusOptions.length ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>Aucun statut ajoute pour le moment.</Text>
          ) : null}
        </View>
        <View style={Spaces.gap[8]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Ajouter un statut</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {availableReminderStatusOptions.map((item) => (
              <SelectionChip
                key={item.key}
                label={`+ ${item.label}`}
                onPress={() => handleReminderStatusToggle(item.key)}
                selected={false}
              />
            ))}
          </View>
          {!availableReminderStatusOptions.length ? (
            <Text style={[Fonts.p3, Fonts.neutral300]}>Tous les statuts disponibles sont deja ajoutes.</Text>
          ) : null}
        </View>
      </View>
    );
  } else if (activeWizardStep.key === 'reminderMessage') {
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        <View style={primaryStepCardStyle}>
          <Field label="Message de relance" onChangeText={setReminderMessage} placeholder="Rappel: votre cotisation reste a regler." value={reminderMessage} />
        </View>
        <View style={secondaryStepCardStyle}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Apercu du message</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>{reminderPreviewMessage}</Text>
        </View>
      </View>
    );
  } else if (activeWizardStep.key === 'overdueDate') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <DateField
          label="Marquer en retard apres le (optionnel)"
          minimumDate={campaignStartDateValue}
          onChange={setOverdueAfterDate}
          value={overdueAfterDate}
        />
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          Sans date, les membres restent en attente et peuvent quand meme etre relances.
        </Text>
      </View>
    );
  } else if (activeWizardStep.key === 'documents') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Documents a fournir</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>
          Ajoute chaque piece demandee aux membres avec ses propres regles.
        </Text>
        {documentRequests.map((item) => (
          <DocumentRequestEditor
            canRemove={documentRequests.length > 1 || Boolean(item.documentId)}
            item={item}
            key={item.localId}
            onChange={(patch) => updateDocumentRequest(item.localId, patch)}
            onRemove={() => removeDocumentRequest(item.localId)}
          />
        ))}
        <Button onPress={addDocumentRequest} title="Ajouter un document" variant="Secondary" />
      </View>
    );
  } else if (activeWizardStep.key === 'installmentsToggle') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <View style={[Spaces.gap[4], { flex: 1, paddingRight: 16 }]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Autoriser le paiement en plusieurs fois</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>Genere automatiquement des echeances pour la campagne.</Text>
          </View>
          <Switch onValueChange={setAllowInstallments} value={allowInstallments} />
        </View>
      </View>
    );
  } else if (activeWizardStep.key === 'installmentsSetup') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <Field label="Nombre d'echeances" onChangeText={setInstallmentCount} placeholder="3" value={installmentCount} />
        <SelectionGroup
          items={installmentFrequencyOptions}
          label="Frequence"
          onToggle={(value) => setInstallmentFrequency(value)}
          selectedKeys={[installmentFrequency]}
        />
      </View>
    );
  } else if (activeWizardStep.key === 'installmentsOptions') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <PaymentModeToggle
          enabled={memberInstallmentChoiceAllowed}
          label="Le membre choisit son nombre d echeances"
          onChange={setMemberInstallmentChoiceAllowed}
        />
        <PaymentModeToggle
          enabled={onlineInstallmentsEnabled}
          label="Autoriser le fractionnement en ligne"
          onChange={setOnlineInstallmentsEnabled}
        />
        <PaymentModeToggle
          enabled={onlinePaymentRequired}
          label="Paiement en ligne obligatoire"
          onChange={setOnlinePaymentRequired}
        />
      </View>
    );
  } else if (activeWizardStep.key === 'installmentsSchedule') {
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        {normalizedInstallmentSchedule.map((item, index) => (
          <View
            key={installmentSchedule[index]?.localId || `installment-${index}`}
            style={secondaryStepCardStyle}
          >
            <Field
              label={`Libelle echeance ${index + 1}`}
              onChangeText={(value) => updateInstallment(installmentSchedule[index]?.localId, { label: value })}
              placeholder={`Paiement ${index + 1}`}
              value={installmentSchedule[index]?.label || ''}
            />
            <Field
              label="Montant cible (EUR)"
              onChangeText={(value) => updateInstallment(installmentSchedule[index]?.localId, { amount: value })}
              placeholder="60"
              value={installmentSchedule[index]?.amount || ''}
            />
            <DateField
              label="Date limite"
              minimumDate={campaignStartDateValue}
              onChange={(value) => updateInstallment(installmentSchedule[index]?.localId, { dueDate: value })}
              value={installmentSchedule[index]?.dueDate || ''}
            />
          </View>
        ))}
      </View>
    );
  } else if (activeWizardStep.key === 'paymentOwner') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <View style={[Spaces.gap[4], { flex: 1, paddingRight: 16 }]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Encaissement multisport</Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Active si les paiements en ligne doivent utiliser le compte central du club multisport.
            </Text>
          </View>
          <Switch
            onValueChange={(enabled) => setPaymentOwner(enabled ? 'multisport' : 'section')}
            value={paymentOwner === 'multisport'}
          />
        </View>
        {paymentOwner === 'multisport' && !club?.parentMultisport ? (
          <Text style={[Fonts.p3, { color: Colors.warning500 }]}>
            Aucun multisport parent n est rattache a ce club. Le paiement central ne pourra pas etre valide.
          </Text>
        ) : null}
      </View>
    );
  } else if (activeWizardStep.key === 'paymentMethods') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        <PaymentModeToggle enabled={paymentModes.bank_transfer} label={paymentModeLabels.bank_transfer} onChange={() => togglePaymentMode('bank_transfer')} />
        <PaymentModeToggle enabled={paymentModes.cash} label={paymentModeLabels.cash} onChange={() => togglePaymentMode('cash')} />
        <PaymentModeToggle enabled={paymentModes.check} label={paymentModeLabels.check} onChange={() => togglePaymentMode('check')} />
        <PaymentModeToggle enabled={paymentModes.card_physical} label={paymentModeLabels.card_physical} onChange={() => togglePaymentMode('card_physical')} />
        <PaymentModeToggle enabled={paymentModes.external_link} label={paymentModeLabels.external_link} onChange={() => togglePaymentMode('external_link')} />
        <PaymentModeToggle enabled={paymentModes.helloasso} label={paymentModeLabels.helloasso} onChange={() => togglePaymentMode('helloasso')} />
      </View>
    );
  } else if (activeWizardStep.key === 'paymentInstructions') {
    stepContent = (
      <View style={primaryStepCardStyle}>
        {paymentModes.bank_transfer ? <Field label="Instructions virement" multiline onChangeText={setBankTransferInstructions} placeholder="IBAN, reference a indiquer..." value={bankTransferInstructions} /> : null}
        {paymentModes.cash ? <Field label="Instructions especes" multiline onChangeText={setCashInstructions} placeholder="Lieu, horaires, personne a contacter..." value={cashInstructions} /> : null}
        {paymentModes.check ? <Field label="Instructions cheque" multiline onChangeText={setCheckInstructions} placeholder="Ordre, depot, reference..." value={checkInstructions} /> : null}
        {paymentModes.card_physical ? <Field label="Instructions carte au club" multiline onChangeText={setCardPhysicalInstructions} placeholder="Terminal, permanences..." value={cardPhysicalInstructions} /> : null}
      </View>
    );
  } else if (activeWizardStep.key === 'paymentOnline') {
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        {paymentModes.external_link ? (
          <View style={primaryStepCardStyle}>
            <Field label="Lien externe du club" onChangeText={setExternalUrl} placeholder="https://..." value={externalUrl} />
          </View>
        ) : null}
        {paymentModes.helloasso ? (
          <LicenseCard>
            <View style={Spaces.gap[12]}>
              <View style={Spaces.gap[4]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>HelloAsso integre</Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Le club configure directement son organisation HelloAsso. Aucun lien manuel n est demande pour ce mode.
                </Text>
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Checklist: choisis le scope, renseigne le slug organisation, ajoute le client id et le client secret, verifie la connexion, puis fais un paiement test avant publication.
                </Text>
              </View>
              <LicenseStatusChip status={effectiveHelloAssoSnapshot?.readiness || 'not_configured'} />
              <Text style={[Fonts.p3, Fonts.neutral200]}>{helloAssoStatusMessage}</Text>
              <Field
                label="Slug organisation"
                onChangeText={(value) => handleHelloAssoFieldChange('organizationSlug', value)}
                placeholder="mon-club"
                value={helloAssoConfig.organizationSlug}
              />
              <Field
                label="Environnement"
                onChangeText={(value) => handleHelloAssoFieldChange('environment', value)}
                placeholder="production ou sandbox"
                value={helloAssoConfig.environment}
              />
              <Field
                label="Client id"
                onChangeText={(value) => handleHelloAssoFieldChange('clientId', value)}
                placeholder={effectiveHelloAssoSnapshot?.clientIdConfigured ? 'Laisser vide pour conserver l identifiant actuel' : 'Renseigne le client id'}
                value={helloAssoConfig.clientId}
              />
              <Field
                label="Client secret"
                onChangeText={(value) => handleHelloAssoFieldChange('clientSecret', value)}
                placeholder={effectiveHelloAssoSnapshot?.clientSecretConfigured ? 'Laisser vide pour conserver le secret actuel' : 'Renseigne le client secret'}
                value={helloAssoConfig.clientSecret}
              />
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                Scope actif:
                {' '}
                {paymentOwner === 'multisport' ? 'multisport' : 'section'}
              </Text>
              {effectiveHelloAssoSnapshot?.validation?.checkoutValidatedAt ? (
                <Text style={[Fonts.p3, Fonts.neutral200]}>
                  Derniere verification:
                  {' '}
                  {effectiveHelloAssoSnapshot.validation.checkoutValidatedAt.slice(0, 19).replace('T', ' ')}
                </Text>
              ) : null}
              <Button
                isLoading={helloAssoMutation.isPending}
                onPress={verifyHelloAssoConnection}
                title="Verifier la connexion"
                variant="Secondary"
              />
            </View>
          </LicenseCard>
        ) : null}
      </View>
    );
  } else if (activeWizardStep.key === 'review') {
    stepContent = (
      <View style={Spaces.gap[licenseSpacing.sectionGap]}>
        <View style={primaryStepCardStyle}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Verification avant lancement</Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {reviewTargetSummaryText}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {enabledPaymentModeLabels.length
              ? `Paiements actives: ${enabledPaymentModeLabels.join(', ')}.`
              : 'Aucun moyen de paiement active.'}
          </Text>
          {paymentModes.helloasso ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              HelloAsso:
              {' '}
              {helloAssoStatusMessage}
            </Text>
          ) : null}
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {allowInstallments
              ? `${normalizedInstallmentSchedule.length} echeance(s) configuree(s) en mode ${installmentFrequency}.`
              : 'Paiement en une seule fois.'}
          </Text>
          <Text style={[Fonts.p3, Fonts.neutral200]}>
            {(documentRequests.filter((item) => item.name.trim()).length)}
            {' document(s) demandes et '}
            {pricingRules.length}
            {' regle(s) tarifaire(s) supplementaire(s).'}
          </Text>
          {autoReminderEnabled ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Relances auto: tous les
              {' '}
              {reminderFrequencyDays}
              {' '}
              jour(s), max
              {' '}
              {reminderMaxCount}
              , statuts
              {' '}
              {reminderTargetStatuses.join(', ')}
              .
            </Text>
          ) : (
            <Text style={[Fonts.p3, Fonts.neutral200]}>Relances automatiques desactivees.</Text>
          )}
        </View>

        {canPublishFromWizard ? (
          <Button
            isLoading={saveMutation.isPending}
            onPress={publishCampaign}
            title={publishActionLabel}
          />
        ) : null}
      </View>
    );
  }

  return (
    <>
      <WizardStepLayout
        collapsibleHeader
        isNextDisabled={isWizardNextDisabled}
        isNextLoading={saveMutation.isPending}
        nextLabel={finalSaveLabel}
        onBack={handleWizardBack}
        onClose={exitWizardScreen}
        onNext={handleWizardNext}
        stepCount={wizardStepCount}
        stepIndex={wizardStepIndex + 1}
        subtitle={activeWizardStep.subtitle}
        title={activeWizardStep.title}
      >
        <View style={Spaces.gap[licenseSpacing.sectionGap]}>
          {stepContent}

          <View style={{ paddingBottom: Math.max(insets.bottom + 8, 16) }} />
        </View>
      </WizardStepLayout>

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
