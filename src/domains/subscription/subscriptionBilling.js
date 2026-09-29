import { format } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import i18next from 'i18next';

import {
  formatSubscriptionPlanLabel,
  getClubCoverage,
  getClubDisplayName,
} from '@/domains/subscription/subscriptionDecision';
import localeDesFormats from '@/theme/strings/localeDesFormats';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { SUPPORT_CONTACT_EMAIL, SUPPORT_CONTACT_MAILTO } from '@/config/legalUrls';

const TEAM_SCOPE = 'TEAM';

// A/B palier preselectionne (handoff item 13) : OFF par defaut — tout le monde
// voit le palier 2. Passer a true pour activer le test (bucket B = palier 1).
export const SUBSCRIPTION_TIER_AB_TEST_ENABLED = false;

/**
 * Bucket A/B stable derive de l'identifiant utilisateur (pas de hasard runtime).
 * @param {string | null | undefined} userDocumentId
 * @returns {'A' | 'B'}
 */
export const getSubscriptionTierAbBucket = (userDocumentId) => {
  const raw = String(userDocumentId || '');
  if (!raw) return 'A';
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = ((hash * 31) + raw.charCodeAt(index)) % 997;
  }
  return hash % 2 === 0 ? 'A' : 'B';
};

/**
 * Palier preselectionne dans la sheet quota selon le bucket.
 * @param {'A' | 'B'} bucket
 * @returns {number}
 */
export const getSubscriptionPreselectedSlotCount = (bucket) => {
  if (!SUBSCRIPTION_TIER_AB_TEST_ENABLED) return 2;
  return bucket === 'B' ? 1 : 2;
};

/**
 * @param {string | undefined | null} runtimeEnv
 * @returns {boolean}
 */
export const isSubscriptionBillingTestModeEnabled = (runtimeEnv) => {
  const normalizedRuntimeEnv = String(runtimeEnv || '').trim().toLowerCase();
  return normalizedRuntimeEnv === 'local' || normalizedRuntimeEnv === 'staging';
};

/**
 * @param {string | undefined | null} platform
 * @returns {'apple' | 'google'}
 */
export const getSubscriptionTestProvider = (platform) => (
  String(platform || '').trim().toLowerCase() === 'ios' ? 'apple' : 'google'
);

/**
 * Entrees du catalogue, quelle que soit la forme rendue par le serveur
 * (`{ data: [...] }` ou un tableau nu).
 *
 * L33 — cette lecture etait recopiee a l'identique dans TROIS surfaces de vente
 * (SubscriptionOverview, GuideOffersRecap, SubscriptionPaywallSheet). Elle vit
 * desormais ici, avec les trois lectures d'entree ci-dessous.
 * @param {any} payload
 * @returns {any[]}
 */
export const getSubscriptionCatalogEntries = (payload) => {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

/**
 * @param {any} entry
 * @returns {string} 'TEAM', 'CLUB' ou ''.
 */
export const getSubscriptionEntryScope = (entry) => (
  String(entry?.scopeType || '').trim().toUpperCase()
);

/**
 * @param {any} entry
 * @returns {string} 'monthly', 'yearly' ou ''.
 */
export const getSubscriptionEntryPeriod = (entry) => (
  String(entry?.billingPeriod || '').trim().toLowerCase()
);

// S12-B — L'OFFRE AU LICENCIE, ET POURQUOI ELLE NE PASSE PAS PAR LES PALIERS.
//
// Le catalogue serveur porte desormais DEUX modeles de prix
// (admin/src/api/subscription/services/subscription-catalog.ts:8-11) :
//   `flat`         : le prix affiche EST le prix paye (les 3 paliers Club, les 3 Equipe) ;
//   `per_licensee` : le prix est UNITAIRE et se multiplie par le nombre de
//                    licencies saisi a la souscription.
//
// ⚠️ C'est `pricingModel` qui fait foi, JAMAIS le code de plan. Les sept regex
// `tier_(\d+)` de l'app restent intactes : `fc_club_licensee_*` ne les traverse
// pas (son rang de palier vaut donc 0, ce qui l'ecarte tout seul des rangees de
// paliers S/M/L, et c'est voulu — ce n'est pas un palier).
const PER_LICENSEE_PRICING_MODEL = 'per_licensee';

// Bornes de la saisie. Le serveur exige un entier >= 1 sans plafond
// (subscription-billing.ts:37-41) ; le plafond ci-dessous n'est pas une regle
// metier mais un GARDE-FOU DE FRAPPE : le plus gros club francais compte
// quelques milliers de licencies, et « 2500000 » tape par erreur engagerait des
// milliers d'euros. Un plafond qui laisse passer tous les vrais clubs et arrete
// les fautes de frappe.
export const SUBSCRIPTION_LICENSEE_COUNT_MIN = 1;
export const SUBSCRIPTION_LICENSEE_COUNT_MAX = 20000;

/**
 * @param {any} entry
 * @returns {string} 'per_licensee', 'flat' ou ''.
 */
export const getSubscriptionEntryPricingModel = (entry) => (
  String(entry?.pricingModel || '').trim().toLowerCase()
);

/**
 * Cette offre se facture-t-elle AU LICENCIE ?
 * @param {any} entry
 * @returns {boolean}
 */
export const isPerLicenseeSubscriptionEntry = (entry) => (
  getSubscriptionEntryPricingModel(entry) === PER_LICENSEE_PRICING_MODEL
);

/**
 * Prix UNITAIRE par licencie, en centimes, ou null.
 *
 * Le serveur pose la meme valeur dans `unitPriceEurCents` ET dans
 * `referencePriceEurCents` (subscription-catalog.ts:118-124) : on lit le champ
 * qui porte le sens, et on se replie sur l'autre plutot que de rendre null pour
 * un catalogue un peu plus ancien.
 * @param {any} entry
 * @returns {number | null}
 */
export const getSubscriptionEntryUnitPriceEurCents = (entry) => {
  if (!isPerLicenseeSubscriptionEntry(entry)) return null;
  const declared = Number(entry?.unitPriceEurCents);
  if (Number.isFinite(declared) && declared > 0) return declared;
  const reference = Number(entry?.referencePriceEurCents);
  return Number.isFinite(reference) && reference > 0 ? reference : null;
};

/**
 * Nombre de licencies ramene dans les bornes, ou null si ce n'est pas un nombre.
 * @param {any} value
 * @returns {number | null}
 */
export const clampSubscriptionLicenseeCount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(
    SUBSCRIPTION_LICENSEE_COUNT_MAX,
    Math.max(SUBSCRIPTION_LICENSEE_COUNT_MIN, Math.floor(parsed)),
  );
};

/**
 * Ce que le doigt vient de taper, ramene a des chiffres.
 *
 * Un champ de saisie doit pouvoir etre VIDE le temps qu'on efface pour
 * retaper : on rend donc la chaine, jamais un nombre force. Le clavier
 * numerique d'Android laisse passer des separateurs sur certains modeles, d'ou
 * le filtrage plutot qu'une confiance aveugle au `keyboardType`.
 * @param {string} value
 * @returns {string}
 */
export const sanitizeSubscriptionLicenseeCountInput = (value) => String(value ?? '')
  .replace(/[^0-9]/g, '')
  .replace(/^0+(?=\d)/, '')
  .slice(0, String(SUBSCRIPTION_LICENSEE_COUNT_MAX).length);

/**
 * Prix unitaire tel qu'il se lit sur une carte : « 2,50 € par licencié ».
 * @param {number | null | undefined} unitPriceEurCents
 * @returns {string}
 */
export const formatSubscriptionUnitPriceLabel = (unitPriceEurCents) => {
  // ⛔ `formatSubscriptionPriceLabel` accepte ZERO, volontairement : c'est la
  // carte « Gratuit » qui en a besoin (SubscriptionOffers.js:969). Un prix
  // UNITAIRE a zero, lui, annoncerait une offre gratuite a quelqu'un qui va
  // payer — on rend '' plutot qu'un « 0,00 EUR par licencie ».
  const cents = Number(unitPriceEurCents);
  if (!Number.isFinite(cents) || cents <= 0) return '';
  const amountLabel = formatSubscriptionPriceLabel(cents, '');
  return amountLabel ? i18next.t(
    'subscriptionBilling.unitPrice',
    '{{amountLabel}} par licencié',
    { amountLabel, ...SANS_ECHAPPEMENT },
  ) : '';
};

/**
 * LE CALCUL SOUS LES YEUX (decision D3 du 2026-08-25) :
 * « 250 licencies x 2,50 EUR = 625,00 EUR/an ».
 *
 * Il vit ICI, et pas dans les ecrans, parce que TROIS surfaces en ont besoin
 * (la carte Club du carrousel, la feuille de vente, la feuille « augmenter ») —
 * c'est la meme regle L33/L38 qui a fait descendre `findSubscriptionMonthlySibling
 * Entry` et la lecture d'enveloppe dans ce fichier. Un calcul recopie trois fois
 * finit toujours par diverger d'un centime quelque part, et c'est de l'ARGENT.
 *
 * Rend '' des qu'un des deux termes manque : on n'affiche jamais un total invente.
 * @param {number | null | undefined} unitPriceEurCents - Prix unitaire en centimes.
 * @param {number | null | undefined} licenseeCount - Nombre de licencies saisi.
 * @param {'monthly' | 'yearly' | string} [billingPeriod] - Periode, pour le suffixe.
 * @returns {string}
 */
export const formatSubscriptionPerMemberPriceLabel = (
  unitPriceEurCents,
  licenseeCount,
  billingPeriod = '',
) => {
  const unitCents = Number(unitPriceEurCents);
  const count = Number(licenseeCount);
  if (!Number.isFinite(unitCents) || unitCents <= 0) return '';
  if (!Number.isInteger(count) || count < SUBSCRIPTION_LICENSEE_COUNT_MIN) return '';

  const unitLabel = formatSubscriptionPriceLabel(unitCents, '');
  const totalLabel = formatSubscriptionPriceLabel(unitCents * count, billingPeriod);
  if (!unitLabel || !totalLabel) return '';

  return i18next.t('subscriptionBilling.perMemberTotal', {
    count,
    defaultValue_one: '{{count}} licencié × {{unitLabel}} = {{totalLabel}}',
    defaultValue_other: '{{count}} licenciés × {{unitLabel}} = {{totalLabel}}',
    totalLabel,
    unitLabel,
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * Rang du palier dans sa famille : nombre d'equipes couvertes cote Equipe,
 * numero de tier cote Club (`fc_club_tier_2_yearly` -> 2).
 * @param {any} entry
 * @returns {number}
 */
export const getSubscriptionEntryTierRank = (entry) => (
  getSubscriptionEntryScope(entry) === 'CLUB'
    ? Number(String(entry?.planCode || '').match(/tier_(\d+)/)?.[1] || 0)
    : Number(entry?.slotCount || 0)
);

/**
 * Plafond de LICENCIES d'une offre, ou null quand elle n'en borne aucun.
 *
 * LOT CATALOGUE (2026-08-28) — c'est le champ qui a remplace `maxTeams` comme
 * critere de choix cote Club. Le serveur le pose sur chaque entree
 * (subscription-catalog.ts, `licenseeCap`) ; rien ici ne code en dur
 * « Club 100 = 100 ».
 * @param {any} entry
 * @returns {number | null}
 */
export const getSubscriptionEntryLicenseeCap = (entry) => {
  const cap = Number(entry?.licenseeCap);
  return Number.isFinite(cap) && cap > 0 ? cap : null;
};

/**
 * Etiquette COURTE d'une tranche Club, pour une pilule de selection.
 *
 * Elle porte le nombre de licenciés couverts (« 100 », « 500 », « 1000 ») ou
 * « illim. ». C'est ce que remplacent les lettres S / M / L, qui ne disaient
 * rien de ce qu'on achetait.
 *
 * ⚠️ AUCUNE table de correspondance dans l'app : le nombre vient du catalogue
 * serveur. Les prix et les paliers ont change QUATRE fois le 28/08 — une table
 * recopiee serait fausse le lendemain.
 * @param {any} entry
 * @returns {string}
 */
export const formatSubscriptionClubTierShortLabel = (entry) => {
  const licenseeCap = getSubscriptionEntryLicenseeCap(entry);
  return licenseeCap === null ? i18next.t(
    'subscriptionBilling.clubTierShortUnlimited',
    'illim.',
  ) : String(licenseeCap);
};

/**
 * CE QUE COUVRE UNE OFFRE CLUB, en une phrase, pour TOUTES les surfaces de vente.
 *
 * Constat qui a cree ce helper : jusqu'au 27/08, les offres Club se
 * distinguaient par le nombre d'EQUIPES (« jusqu'a 3 equipes du club »). Depuis
 * le 28/08 les quatre tranches donnent des equipes illimitees — les quatre
 * cartes auraient donc affiche la MEME phrase, et le client n'aurait plus eu
 * aucun critere pour choisir entre 249,99 EUR et 939,99 EUR. Ce qui les separe
 * est le nombre de licencies : c'est lui que la phrase doit porter.
 *
 * ⚠️ Elle vit ici, pas dans un ecran : le carrousel, la feuille de vente et le
 * recap du tour guide la servent tous les trois, et deux surfaces de vente ne
 * doivent pas nommer la meme chose de deux facons.
 *
 * Rend une phrase EN MINUSCULES, faite pour s'inserer dans « pour … , plus : ».
 * Un appelant qui la pose seule sur sa ligne met la majuscule lui-meme.
 * @param {any} entry
 * @returns {string}
 */
export const formatSubscriptionClubCoverageLabel = (entry) => {
  if (!entry) return '';
  const licenseeCap = getSubscriptionEntryLicenseeCap(entry);
  return licenseeCap === null
    ? i18next.t('subscriptionBilling.clubCoverage.unlimited', 'un nombre illimité de licenciés')
    : i18next.t(
      'subscriptionBilling.clubCoverage.upTo',
      "jusqu'à {{licenseeCap}} licenciés du club",
      { licenseeCap, ...SANS_ECHAPPEMENT },
    );
};

/**
 * Remise reelle de l'annuel face a douze mensualites, arrondie a l'entier.
 *
 * L33 — pourquoi ce calcul plutot qu'un tag « 2 mois offerts » pose une fois
 * pour toutes sur la pilule Annuel : le catalogue porte DEUX grilles.
 * Club suit exactement x10 (remise 17 %) ; Equipe est a x7,5-x7,7 (remise 36 %).
 * Un tag unique sous-vend Equipe de plus de moitie OU surestime Club du double.
 * Le badge est donc calcule et porte PAR CARTE (decision d'Adel du 2026-08-05).
 *
 * Rend '' des qu'un des deux prix manque ou que l'annuel n'est pas avantageux :
 * on n'affiche jamais une remise inventee ni une remise negative.
 * @param {number | null | undefined} monthlyPriceEurCents
 * @param {number | null | undefined} yearlyPriceEurCents
 * @returns {string}
 */
export const formatSubscriptionYearlyDiscountLabel = (
  monthlyPriceEurCents,
  yearlyPriceEurCents,
) => {
  const monthlyCents = Number(monthlyPriceEurCents);
  const yearlyCents = Number(yearlyPriceEurCents);
  if (!Number.isFinite(monthlyCents) || monthlyCents <= 0) return '';
  if (!Number.isFinite(yearlyCents) || yearlyCents <= 0) return '';

  const discountRatio = 1 - (yearlyCents / (monthlyCents * 12));
  const discountPercent = Math.round(discountRatio * 100);
  if (discountPercent <= 0) return '';

  return `−${discountPercent} %`;
};

export const SUBSCRIPTION_PRICE_SOURCES = {
  SERVER: 'server',
  STORE: 'store',
};

/**
 * Famille d'un palier : c'est l'unite dans laquelle un prix se COMPARE a un
 * autre. `formatSubscriptionYearlyDiscountLabel` divise l'annuel par douze
 * mensualites du MEME palier — melanger un prix store et un prix serveur dans
 * ce calcul produirait une remise inventee.
 *
 * ⚠️ Cette cle DOIT rester alignee sur l'appariement de
 * `findSubscriptionMonthlySiblingEntry` (scope + rang de palier) : c'est lui qui
 * choisit les deux prix de la remise. Les desaccorder rouvrirait le melange que
 * la regle de famille interdit.
 * @param {any} entry
 * @returns {string}
 */
const getSubscriptionEntryFamilyKey = (entry) => (
  `${getSubscriptionEntryScope(entry)}:${getSubscriptionEntryTierRank(entry)}`
);

/**
 * Code de plan d'une entree, normalise.
 * @param {any} entry
 * @returns {string}
 */
const getSubscriptionEntryPlanCode = (entry) => String(entry?.planCode || '').trim();

/**
 * INTL1 — code ISO d'une devise AUTRE que l'euro, ou '' (euro, vide, invalide).
 * @param {unknown} currencyCode
 * @returns {string}
 */
const normalizeCurrencyCode = (currencyCode) => {
  const code = typeof currencyCode === 'string' ? currencyCode.trim().toUpperCase() : '';
  return /^[A-Z]{3}$/.test(code) && code !== 'EUR' ? code : '';
};

/**
 * Ce qui suit le montant : « € » en euros, le code ISO sinon (« CHF », « AED »).
 * @param {unknown} currencyCode
 * @returns {string}
 */
const getCurrencySymbol = (currencyCode) => normalizeCurrencyCode(currencyCode) || '€';

/**
 * Le prix AFFICHE devient celui du STORE, et l'ecart avec le catalogue serveur
 * est mesure (decision d'Adel du 2026-08-05 : « A, mais verifier quand meme
 * l'ecart »).
 *
 * Trois regles, dans cet ordre :
 * 1. **Repli** — sans prix store, le catalogue serveur est rendu tel quel.
 *    L'ecran reste vendable, toujours.
 * 2. **Coherence par famille** — un palier ne bascule sur les prix du store que
 *    si le store couvre TOUTES ses entrees. Sinon la famille entiere reste au
 *    serveur : les deux prix d'un meme calcul viennent toujours de la meme
 *    source.
 * 3. **Signalement** — tout ecart d'au moins un centime est remonte, meme
 *    quand c'est le bon prix qui s'affiche : un desaccord veut dire qu'une des
 *    deux configurations est fausse, et il faut le savoir.
 *
 * INTL1 — store dans une AUTRE devise que l'euro (Suisse, Emirats) : le prix
 * serveur en euros n'est jamais affiche. Chaque ligne porte `priceCurrencyCode`,
 * garde le prix du store quand il existe et PERD son prix sinon (champ absent,
 * pas `null` : `Number(null)` vaudrait « 0,00 »). Aucun ecart n'est calcule
 * entre deux devises.
 * ponytail: `referencePriceEurCents` porte alors des centimes de CHF/AED — le
 * renommer toucherait 72 lectures dans 9 fichiers. La devise de la ligne fait foi.
 * @param {{
 *   serverEntries: any[];
 *   storePricesEurCents?: Record<string, number> | null;
 *   storeCurrencyCode?: string | null;
 * }} params - `storePricesEurCents` : centimes dans la devise `storeCurrencyCode` (EUR par defaut).
 * @returns {{
 *   entries: any[];
 *   mismatches: Array<{
 *     planCode: string;
 *     serverPriceEurCents: number;
 *     storePriceEurCents: number;
 *     retainedSource: string;
 *   }>;
 *   missingFromStorePlanCodes: string[];
 * }}
 */
export const resolveSubscriptionCatalogPrices = ({
  serverEntries,
  storeCurrencyCode,
  storePricesEurCents,
}) => {
  const entries = Array.isArray(serverEntries) ? serverEntries : [];
  const storePrices = storePricesEurCents && typeof storePricesEurCents === 'object'
    ? storePricesEurCents
    : null;
  const foreignCurrencyCode = normalizeCurrencyCode(storeCurrencyCode);

  /**
   * Prix du store d'une entree, ou null s'il n'y en a pas.
   * @param {any} entry
   * @returns {number | null}
   */
  const readStorePrice = (entry) => {
    if (!storePrices) return null;
    const cents = Number(storePrices[getSubscriptionEntryPlanCode(entry)]);
    return Number.isFinite(cents) && cents > 0 ? cents : null;
  };

  /**
   * Une ligne sans prix vendable (essai, offre manuelle) n'a aucun package cote
   * store : elle ne doit donc ni empecher sa famille de basculer, ni etre
   * annoncee comme « absente du store ». `fc_trial_team` partage exactement la
   * famille de `fc_team_1` — sans cette garde, l'activer bloquerait en silence
   * les prix du store sur le palier le plus vendu.
   * @param {any} entry
   * @returns {boolean}
   */
  const hasSellableServerPrice = (entry) => {
    // S12-B — une offre AU LICENCIE n'a aucun package store, et ce n'est pas un
    // reglage de boutique oublie : les stores Apple/Google ne savent pas vendre
    // « N x 2,50 EUR » a l'unite (paliers fixes seulement), c'est precisement
    // pourquoi elle s'achete sur le web. Sans cette garde, `missingFromStore
    // PlanCodes` la signalait A CHAQUE RENDU DE CHAQUE SURFACE, pour toujours.
    if (isPerLicenseeSubscriptionEntry(entry)) return false;
    const cents = Number(entry?.referencePriceEurCents);
    return Number.isFinite(cents) && cents > 0;
  };

  if (foreignCurrencyCode && storePrices) {
    /** @type {string[]} */
    const missingInForeignStore = [];
    const foreignEntries = entries.map((entry) => {
      const withoutPrice = { ...entry };
      delete withoutPrice.referencePriceEurCents;
      const storeCents = readStorePrice(entry);
      if (storeCents !== null) {
        return {
          ...withoutPrice,
          priceCurrencyCode: foreignCurrencyCode,
          referencePriceEurCents: storeCents,
        };
      }
      if (!hasSellableServerPrice(entry)) {
        return entry;
      }
      missingInForeignStore.push(getSubscriptionEntryPlanCode(entry));
      return { ...withoutPrice, priceCurrencyCode: foreignCurrencyCode };
    });
    return {
      entries: foreignEntries,
      mismatches: [],
      missingFromStorePlanCodes: missingInForeignStore,
    };
  }

  if (!storePrices || Object.keys(storePrices).length === 0) {
    return { entries, mismatches: [], missingFromStorePlanCodes: [] };
  }

  /** @type {Set<string>} */
  const uncoveredFamilyKeys = new Set();
  entries.forEach((entry) => {
    if (hasSellableServerPrice(entry) && readStorePrice(entry) === null) {
      uncoveredFamilyKeys.add(getSubscriptionEntryFamilyKey(entry));
    }
  });

  /** @type {any[]} */
  const mismatches = [];
  /** @type {string[]} */
  const missingFromStorePlanCodes = [];

  const resolvedEntries = entries.map((entry) => {
    const storePriceEurCents = readStorePrice(entry);
    if (storePriceEurCents === null) {
      if (hasSellableServerPrice(entry)) {
        missingFromStorePlanCodes.push(getSubscriptionEntryPlanCode(entry));
      }
      return entry;
    }

    const isFamilyCovered = !uncoveredFamilyKeys.has(getSubscriptionEntryFamilyKey(entry));
    const retainedSource = isFamilyCovered
      ? SUBSCRIPTION_PRICE_SOURCES.STORE
      : SUBSCRIPTION_PRICE_SOURCES.SERVER;

    const serverPriceEurCents = Number(entry?.referencePriceEurCents);
    if (Number.isFinite(serverPriceEurCents) && serverPriceEurCents !== storePriceEurCents) {
      mismatches.push({
        planCode: getSubscriptionEntryPlanCode(entry),
        retainedSource,
        serverPriceEurCents,
        storePriceEurCents,
      });
    }

    return isFamilyCovered
      ? { ...entry, referencePriceEurCents: storePriceEurCents }
      : entry;
  });

  return { entries: resolvedEntries, mismatches, missingFromStorePlanCodes };
};

/**
 * Entree jumelle en mensuel d'une entree annuelle : meme portee, meme palier.
 *
 * C'est la seule facon d'obtenir les DEUX prix qu'exige
 * `formatSubscriptionYearlyDiscountLabel` — le catalogue serveur ne porte aucune
 * remise, il porte deux lignes par palier.
 *
 * L38 — cette lecture vivait dans le carrousel ; les deux autres surfaces de
 * vente en avaient besoin a l'identique, elle vit donc ici plutot qu'en trois
 * exemplaires.
 * @param {any[]} entries - Catalogue complet, TOUTES periodes confondues.
 * @param {any} entry
 * @returns {any | null}
 */
export const findSubscriptionMonthlySiblingEntry = (entries, entry) => {
  if (!entry) return null;

  const scopeType = getSubscriptionEntryScope(entry);
  const tierRank = getSubscriptionEntryTierRank(entry);
  return (Array.isArray(entries) ? entries : []).find(
    (candidate) => getSubscriptionEntryScope(candidate) === scopeType
      && getSubscriptionEntryPeriod(candidate) === 'monthly'
      && getSubscriptionEntryTierRank(candidate) === tierRank,
  ) || null;
};

/**
 * @param {any[]} entries
 * @returns {any[]}
 */
export const sortSubscriptionCatalogEntries = (entries) => {
  const safeEntries = Array.isArray(entries) ? [...entries] : [];
  return safeEntries.sort((left, right) => {
    const leftScope = String(left?.scopeType || '').trim().toUpperCase();
    const rightScope = String(right?.scopeType || '').trim().toUpperCase();
    if (leftScope !== rightScope) {
      return leftScope === TEAM_SCOPE ? -1 : 1;
    }

    if (leftScope === TEAM_SCOPE) {
      const leftSlotCount = Number(left?.slotCount || 0);
      const rightSlotCount = Number(right?.slotCount || 0);
      if (leftSlotCount !== rightSlotCount) {
        return leftSlotCount - rightSlotCount;
      }
    } else {
      const leftTier = Number(String(left?.planCode || '').match(/tier_(\d+)/)?.[1] || 0);
      const rightTier = Number(String(right?.planCode || '').match(/tier_(\d+)/)?.[1] || 0);
      if (leftTier !== rightTier) {
        return leftTier - rightTier;
      }
    }

    const leftBillingPeriod = String(left?.billingPeriod || '').trim().toLowerCase();
    const rightBillingPeriod = String(right?.billingPeriod || '').trim().toLowerCase();
    if (leftBillingPeriod !== rightBillingPeriod) {
      return leftBillingPeriod === 'monthly' ? -1 : 1;
    }

    return String(left?.planCode || '').localeCompare(String(right?.planCode || ''), 'fr');
  });
};

/**
 * Prix tel qu'il se lit : « 12,99 €/an », ou « 12,99 CHF/an » hors euro.
 * @param {number | null | undefined} priceEurCents - Centimes, dans la devise `currencyCode`.
 * @param {'monthly' | 'yearly' | string} billingPeriod
 * @param {string} [currencyCode] - INTL1 : devise du store (`entry.priceCurrencyCode`),
 *   euro par defaut.
 * @returns {string}
 */
export const formatSubscriptionPriceLabel = (priceEurCents, billingPeriod, currencyCode) => {
  const cents = Number(priceEurCents);
  if (!Number.isFinite(cents) || cents < 0) {
    return '';
  }
  const amount = (cents / 100).toFixed(2).replace('.', ',');
  const normalizedPeriod = String(billingPeriod || '').trim().toLowerCase();
  let periodSuffix = '';
  if (normalizedPeriod === 'yearly') {
    periodSuffix = i18next.t('subscriptionBilling.periodSuffix.yearly', '/an');
  } else if (normalizedPeriod === 'monthly') {
    periodSuffix = i18next.t('subscriptionBilling.periodSuffix.monthly', '/mois');
  }
  return `${amount} ${getCurrencySymbol(currencyCode)}${periodSuffix}`;
};

/**
 * Equivalence mensuelle exacte d'un prix annuel (« soit 5,00 €/mois »).
 * Une seule ancre prix par surface : ce libelle accompagne toujours l'ancre annuelle,
 * jamais les segments de palier ni le sous-texte d'un CTA.
 * @param {number | null | undefined} yearlyPriceEurCents
 * @param {string} [currencyCode] - INTL1 : devise du store, euro par defaut.
 * @returns {string}
 */
export const formatSubscriptionMonthlyEquivalentLabel = (yearlyPriceEurCents, currencyCode) => {
  const cents = Number(yearlyPriceEurCents);
  if (!Number.isFinite(cents) || cents <= 0) {
    return '';
  }
  const amount = (cents / 12 / 100).toFixed(2).replace('.', ',');
  return i18next.t(
    'subscriptionBilling.monthlyEquivalent',
    'soit {{amount}} {{currency}}/mois',
    { amount, currency: getCurrencySymbol(currencyCode), ...SANS_ECHAPPEMENT },
  );
};

/**
 * @param {any} entry
 * @returns {{ description: string; label: string; priceLabel: string; secondaryLabel: string }}
 */
export const getSubscriptionCatalogEntryMeta = (entry) => {
  const scopeType = String(entry?.scopeType || '').trim().toUpperCase();
  const billingPeriod = String(entry?.billingPeriod || '').trim().toLowerCase();
  const slotCount = Number(entry?.slotCount || 0);
  const periodLabel = billingPeriod === 'yearly' ? i18next.t(
    'subscriptionBilling.period.yearly',
    'Annuel',
  ) : i18next.t(
    'subscriptionBilling.period.monthly',
    'Mensuel',
  );
  const displayName = String(entry?.displayName || '').trim();
  const priceLabel = formatSubscriptionPriceLabel(
    entry?.referencePriceEurCents,
    billingPeriod,
    entry?.priceCurrencyCode,
  );

  if (scopeType === TEAM_SCOPE) {
    const slotsLabel = i18next.t('subscriptionBilling.teamSlotsCovered', {
      count: slotCount,
      defaultValue_one: '{{count}} équipe couverte',
      defaultValue_other: '{{count}} équipes couvertes',
    });
    return {
      description: i18next.t(
        'subscriptionBilling.teamOfferDescription',
        'Publie et gère les équipes couvertes par ton offre Équipe.',
      ),
      label: displayName || formatSubscriptionPlanLabel(entry?.planCode),
      priceLabel,
      secondaryLabel: [slotsLabel, periodLabel, priceLabel].filter(Boolean).join(' - '),
    };
  }

  return {
    // R10 — l'argumentaire posait une condition qui n'existe plus depuis la
    // decision produit du 2026-07-17 : l'offre ouvre les droits immediatement,
    // club certifie ou pas. On supprime l'affirmation au lieu de la reformuler.
    description: i18next.t(
      'subscriptionBilling.clubOfferDescription',
      'Débloque les droits club sur tout ton club.',
    ),
    label: displayName || formatSubscriptionPlanLabel(entry?.planCode),
    priceLabel,
    secondaryLabel: [i18next.t(
      'subscriptionBilling.clubRights',
      'Droits Club',
    ), periodLabel, priceLabel].filter(Boolean).join(' - '),
  };
};

/**
 * @param {any[]} teams
 * @returns {any[]}
 */
export const getSubscriptionSelectableTeams = (teams) => {
  const uniqueTeams = new Map();
  (Array.isArray(teams) ? teams : []).forEach((team) => {
    const teamDocumentId = String(team?.documentId || '').trim();
    if (!teamDocumentId || uniqueTeams.has(teamDocumentId)) {
      return;
    }
    uniqueTeams.set(teamDocumentId, team);
  });

  return Array.from(uniqueTeams.values()).sort((left, right) => (
    String(left?.name || '').localeCompare(String(right?.name || ''), 'fr', { sensitivity: 'base' })
  ));
};

/**
 * CLUBEQ / C3 — CE QU ON PEUT ENCORE COCHER, ET CE QUI EST DEJA PAYE PAR LE CLUB.
 *
 * Depuis la decision d Adel du 2026-09-04, le serveur REFUSE l achat d une offre
 * Equipe pour une equipe deja couverte par l offre Club de son club
 * (`TEAM_COVERED_BY_CLUB_PLAN`). Une modale qui la propose quand meme envoie
 * l utilisateur choisir puis payer pour se faire jeter : on la grise a la source.
 *
 * ⚠️ « COUVERTE » VEUT DIRE DEUX CHOSES, ET LES CONFONDRE INVERSE LE COMPORTEMENT :
 *  - couverte par MON offre Equipe  ⇒ elle reste COCHEE (je gere mes places) ;
 *  - couverte par L OFFRE DU CLUB   ⇒ elle est GRISEE et jamais cochee.
 * D ou deux entrees distinctes, jamais une seule liste.
 * @param {object} params - les equipes et ce qui les couvre.
 * @param {any[]} params.availableTeams - les equipes du compte.
 * @param {string[]} [params.clubCoveredTeamDocumentIds] - celles que le CLUB paie deja.
 * @returns {{ coverageNotice: string | null, isSelectable: boolean, team: any,
 *   teamDocumentId: string }[]} - les options a afficher.
 */
export const buildSubscriptionTeamOptions = ({
  availableTeams,
  clubCoveredTeamDocumentIds,
}) => {
  const clubCoveredIds = new Set(
    (Array.isArray(clubCoveredTeamDocumentIds) ? clubCoveredTeamDocumentIds : [])
      .map((teamDocumentId) => String(teamDocumentId || '').trim())
      .filter(Boolean),
  );

  return getSubscriptionSelectableTeams(availableTeams).map((team) => {
    const teamDocumentId = String(team?.documentId || '').trim();
    const isCoveredByClub = clubCoveredIds.has(teamDocumentId);

    return {
      coverageNotice: isCoveredByClub ? i18next.t(
        'subscriptionBilling.coveredByClub',
        'Déjà couverte par ton club',
      ) : null,
      isSelectable: !isCoveredByClub,
      team,
      teamDocumentId,
    };
  });
};

/**
 * UPGRADE / U5 — CE QUE VAUT UNE OFFRE CLUB, en un seul nombre comparable.
 *
 * Le critere est LE PLAFOND DE LICENCIES, jamais le prix ni la duree : c'est la
 * decision d'Adel du 2026-09-04, et c'est ce que le serveur applique
 * (admin/src/api/subscription/services/subscription-catalog.ts,
 * `getClubOfferRank`). Un Club 1000 mensuel bat un Club 100 annuel, meme s'il
 * coute trois fois moins cher a la souscription.
 *
 * 🧨 `licenseeCap: null` ne veut pas dire « zero », il veut dire LE SOMMET.
 * Une comparaison naive classerait « Club Illimite » DERNIER — donc griserait
 * la seule offre qui passe toujours. D'ou l'infini.
 *
 * ⚠️ AUCUN NOMBRE EN DUR ICI : le plafond vient de l'entree de catalogue rendue
 * par le serveur. Les paliers ont change quatre fois le 28/08.
 * @param {any} entry - une entree de catalogue.
 * @returns {number | null} - le rang, ou null quand ce n'est pas une offre CLUB.
 */
export const getSubscriptionClubOfferRank = (entry) => {
  if (!entry || getSubscriptionEntryScope(entry) !== 'CLUB') return null;
  const licenseeCap = getSubscriptionEntryLicenseeCap(entry);
  return licenseeCap === null ? Number.POSITIVE_INFINITY : licenseeCap;
};

/**
 * UPGRADE / U5 — LA COUVERTURE QUI EMPECHE VRAIMENT D'ACHETER, ou rien.
 *
 * Trois situations ressemblent a « mon club est deja couvert » et UNE SEULE
 * fait refuser un paiement par le serveur :
 *  - 💳 quelqu'un d'AUTRE paie une offre Club  ⇒ BLOQUE (sauf montee en gamme) ;
 *  - 🙋 c'est MOI qui paie                     ⇒ ne bloque pas : changer sa propre
 *    offre passe par `changePlan`, qui n'a jamais eu ce garde-fou ;
 *  - 🎁 un CADEAU couvre le club               ⇒ ne bloque pas (decision U4 du
 *    04/09 : un abonnement `manual` ne doit jamais faire refuser de l'argent).
 *
 * ⚠️ On lit `paidBy` et non `activePlanCodes` : cette liste-la porte TOUS les
 * droits actifs du compte, y compris ceux payes par quelqu'un d'autre — c'est
 * le piege VITRINE/W4 qui avait rendu un ecran entier inatteignable.
 *
 * ABOPARCLUB (2026-09-29) — `clubDocumentId` (le club pour lequel on achete) :
 * une couverture qui NOMME un autre club ne bloque rien ici. Depuis AIKI, le
 * Club de Demo paye par un autre membre grisait les tranches d'AIKI.
 * @param {object} params - ce que le serveur dit des droits du compte.
 * @param {string} [params.clubDocumentId] - le club vise par l'achat.
 * @param {any[]} [params.entitlementsSummary] - les droits actifs, avec leur payeur.
 * @param {string} [params.userDocumentId] - moi.
 * @returns {string} - le code de plan qui bloque, ou '' quand rien ne bloque.
 */
export const getBlockingClubCoveragePlanCode = ({ clubDocumentId, entitlementsSummary, userDocumentId }) => {
  const myDocumentId = String(userDocumentId || '').trim();
  const targetClubDocumentId = String(clubDocumentId || '').trim();
  const blocking = (Array.isArray(entitlementsSummary) ? entitlementsSummary : []).find((entry) => {
    if (String(entry?.scopeType || '').trim().toUpperCase() !== 'CLUB') return false;
    const entryClubDocumentId = String(entry?.scopeClubDocumentId || '').trim();
    if (targetClubDocumentId && entryClubDocumentId && entryClubDocumentId !== targetClubDocumentId) {
      return false;
    }
    const payerDocumentId = String(entry?.paidBy?.documentId || '').trim();
    // Payeur inconnu : on ne devine pas, et on ne grise rien sur une supposition.
    if (!payerDocumentId) return false;
    if (myDocumentId && payerDocumentId === myDocumentId) return false;
    const planCode = String(entry?.subscriptionPlanCode || '').trim();
    return planCode !== '' && !planCode.startsWith('fc_trial_');
  });

  return blocking ? String(blocking.subscriptionPlanCode || '').trim() : '';
};

const ACTIVE_PAYER_SUBSCRIPTION_STATUSES = ['active', 'grace_period'];

/**
 * @param {any} value - Un identifiant, peut-etre absent.
 * @returns {string} L'identifiant sans blanc, ou ''.
 */
const trimId = (value) => String(value || '').trim();

/**
 * Famille d'un code d'offre (`fc_club_tier_1_yearly` → `fc_club_tier_1`) : c'est
 * l'identifiant d'ABONNEMENT chez Google Play (les periodes en sont les « base
 * plans »). Meme regle que `getRevenueCatOfferingIdForPlanCode`, recopiee pour
 * ne pas tirer le module du SDK magasin dans ce module pur.
 * @param {any} planCode - Le code d'offre.
 * @returns {string} La famille.
 */
const getPlanFamily = (planCode) => trimId(planCode).replace(/_(monthly|yearly)$/, '');

/**
 * LES ABONNEMENTS QUE JE PAIE, CHACUN AVEC LE OU LES CLUBS QU'IL COUVRE —
 * ABOPARCLUB, 2026-09-29.
 *
 * Le serveur le dit depuis ce lot (`scopeClubDocumentIds`,
 * subscription-permission.ts). Un serveur plus ancien ne le dit pas : on le
 * deduit alors de MES droits (meme code d'offre, `paidBy` = moi), et deux
 * abonnements au meme code d'offre rendent `null` (inconnu) plutot qu'une
 * supposition — la meme reserve que `getActiveOfferDetails`.
 * @param {object} params
 * @param {any[]} [params.entitlementsSummary] - Les droits actifs du compte.
 * @param {any} [params.subscriptionSummary] - Le resume d'abonnement (bootstrap).
 * @param {string} [params.userDocumentId] - Moi.
 * @returns {Array<{ clubDocumentIds: string[] | null; documentId: string; planCode: string;
 *   provider: string }> | null} `null` quand le serveur ne rend pas le detail.
 */
export const getPayerSubscriptionsWithClubs = ({
  entitlementsSummary,
  subscriptionSummary,
  userDocumentId,
}) => {
  if (!Array.isArray(subscriptionSummary?.payerSubscriptionsSummary)) return null;
  const myDocumentId = trimId(userDocumentId);
  const subscriptions = subscriptionSummary.payerSubscriptionsSummary.filter((/** @type {any} */ entry) => {
    const status = trimId(entry?.status).toLowerCase();
    return trimId(entry?.documentId) && (!status || ACTIVE_PAYER_SUBSCRIPTION_STATUSES.includes(status));
  });
  const myEntitlements = (Array.isArray(entitlementsSummary) ? entitlementsSummary : [])
    .filter((entry) => myDocumentId && trimId(entry?.paidBy?.documentId) === myDocumentId);

  return subscriptions.map((/** @type {any} */ entry) => {
    const planCode = trimId(entry?.planCode);
    let clubDocumentIds = null;
    if (Array.isArray(entry?.scopeClubDocumentIds)) {
      clubDocumentIds = Array.from(new Set(entry.scopeClubDocumentIds.map(trimId).filter(Boolean)));
    } else if (subscriptions.filter((/** @type {any} */ other) => trimId(other?.planCode) === planCode)
      .length === 1) {
      const derived = Array.from(new Set(myEntitlements
        .filter((droit) => trimId(droit?.subscriptionPlanCode) === planCode)
        .map((droit) => trimId(droit?.scopeClubDocumentId))
        .filter(Boolean)));
      clubDocumentIds = derived.length > 0 ? derived : null;
    }
    return {
      clubDocumentIds,
      documentId: trimId(entry?.documentId),
      planCode,
      provider: trimId(entry?.provider).toLowerCase(),
    };
  });
};

/**
 * QUEL ABONNEMENT UN « CHANGER D'OFFRE » A-T-IL LE DROIT DE MODIFIER ? —
 * ABOPARCLUB, decision d'Adel « abo2 A » du 2026-09-29.
 *
 * 🧨 L'ecran des offres envoyait le PREMIER abonnement paye du compte
 * (`payerSubscriptionIds[0]`) avec le club AFFICHE : depuis AIKI, choisir un
 * autre palier modifiait le « Club 100 » paye pour FoundClub Demo et y
 * repointait la couverture. Desormais :
 *  - offre Club : SEUL l'abonnement qui couvre le club affiche se change ;
 *  - offre Equipe : mon abonnement Equipe (ses places se reattribuent, c'est son
 *    usage), sinon celui qui couvre le club affiche (retrogradation) ;
 *  - dans les deux cas, en dernier recours, un abonnement qui ne couvre RIEN ;
 *  - sinon `null` : c'est un NOUVEL abonnement pour ce club.
 * ⛔ Un abonnement pose A LA MAIN (cadeau, essai : `provider: 'manual'`) n'est
 * jamais une cible : aucun magasin ne le connait, donc « le changer » faisait
 * encaisser le magasin puis refuser le serveur (« abonnement source introuvable
 * chez le store »). L'achat neuf est la voie prevue : le serveur remplace le
 * cadeau (UPGRADE/U4, `assertClubNotAlreadyCovered`).
 * Un serveur qui ne rend pas le detail des abonnements garde l'ancienne regle,
 * sauf quand il affirme que le club affiche n'est pas couvert (offre Club).
 * @param {object} params
 * @param {any} params.catalogEntry - L'offre choisie.
 * @param {string} [params.clubDocumentId] - Le club affiche.
 * @param {any} [params.clubVerificationSummary] - Le resume du club ACTIF.
 * @param {any[]} [params.entitlementsSummary] - Les droits actifs du compte.
 * @param {any} [params.subscriptionSummary] - Le resume d'abonnement.
 * @param {string} [params.userDocumentId] - Moi.
 * @returns {{ currentPlanCode: string; provider?: string; subscriptionDocumentId: string } | null} La cible.
 */
export const resolveSubscriptionChangeTarget = ({
  catalogEntry,
  clubDocumentId,
  clubVerificationSummary,
  entitlementsSummary,
  subscriptionSummary,
  userDocumentId,
}) => {
  const isTeamOffer = getSubscriptionEntryScope(catalogEntry) === TEAM_SCOPE;
  const activeClubDocumentId = trimId(clubDocumentId);
  const subscriptions = getPayerSubscriptionsWithClubs({
    entitlementsSummary,
    subscriptionSummary,
    userDocumentId,
  });

  if (!subscriptions) {
    const primarySubscriptionDocumentId = trimId(
      Array.isArray(subscriptionSummary?.payerSubscriptionIds)
        ? subscriptionSummary.payerSubscriptionIds[0]
        : '',
    );
    if (!primarySubscriptionDocumentId) return null;
    if (!isTeamOffer && getClubCoverage({
      clubDocumentId: activeClubDocumentId,
      clubVerificationSummary,
      entitlementsSummary,
    }) === 'not-covered') {
      return null;
    }
    return {
      currentPlanCode: trimId(Array.isArray(subscriptionSummary?.activePlanCodes)
        ? subscriptionSummary.activePlanCodes[0]
        : ''),
      subscriptionDocumentId: primarySubscriptionDocumentId,
    };
  }

  const storeSubscriptions = subscriptions.filter((entry) => entry.provider !== 'manual');
  const coveringSubscription = activeClubDocumentId
    ? storeSubscriptions.find((entry) => entry.clubDocumentIds?.includes(activeClubDocumentId))
    : null;
  const unattachedSubscription = storeSubscriptions.find(
    (entry) => Array.isArray(entry.clubDocumentIds) && entry.clubDocumentIds.length === 0,
  );
  const teamSubscription = isTeamOffer
    ? storeSubscriptions.find((entry) => entry.planCode.startsWith('fc_team_'))
    : null;
  const target = teamSubscription || coveringSubscription || unattachedSubscription || null;

  return target
    ? {
      currentPlanCode: target.planCode,
      provider: target.provider,
      subscriptionDocumentId: target.documentId,
    }
    : null;
};

/**
 * UN ACHAT DEPUIS LE MUR PAYANT QUI EST EN FAIT UN CHANGEMENT D'OFFRE —
 * ABOPARCLUB-RAIL, 2026-09-29.
 *
 * La feuille « mur payant » et le recapitulatif du guide ne savaient qu'ACHETER.
 * Or un abonne Apple « Equipe » qui prend « Club » pour le MEME club n'ouvre pas
 * un second abonnement : Apple REMPLACE le premier (un seul par groupe). L'app
 * validait pourtant un achat neuf, et le serveur gardait DEUX enregistrements
 * pour un seul abonnement magasin (l'ancien, change par le webhook, et le neuf).
 * Chez Google, l'achat neuf ouvrait un second abonnement, facture en double.
 * Le bon geste est « changer d'offre » de CET abonnement — c'est ce que fait
 * deja l'ecran des offres (`resolveSubscriptionChangeTarget`).
 * Seulement si la cible est du magasin de CET achat : sinon (caisse web, rail de
 * test, cadeau, autre magasin), l'achat reste un achat, comme avant.
 * @param {Record<string, any> & { storeProvider?: 'apple' | 'google' | null }} params - Les
 *   entrees de `resolveSubscriptionChangeTarget`, plus `storeProvider` : le magasin de CET achat.
 * @returns {{ currentPlanCode: string; provider?: string; subscriptionDocumentId: string } | null}
 */
export const resolveStorePlanChangeTarget = ({ storeProvider, ...params }) => {
  if (!storeProvider) return null;
  const target = resolveSubscriptionChangeTarget(/** @type {any} */ (params));
  return target && target.provider === storeProvider ? target : null;
};

/**
 * LE MAGASIN DE CET ACHAT : Apple sur iPhone, Google sur Android — et aucun
 * hors du rail des magasins (caisse web, rail de test).
 * @param {object} params
 * @param {boolean} params.isStoreRail - Le rail actif est-il celui des magasins (RevenueCat) ?
 * @param {string} params.platformOS - `Platform.OS`.
 * @returns {'apple' | 'google' | null} Le magasin, ou `null`.
 */
export const getStoreProviderForPurchase = ({ isStoreRail, platformOS }) => {
  if (!isStoreRail) return null;
  return platformOS === 'ios' ? 'apple' : 'google';
};

/**
 * CE QUE LE MAGASIN INTERDIT POUR UN 2e CLUB — ABOPARCLUB, 2026-09-29.
 *
 * Mesure avant d'ecrire (compte rendu du lot) :
 *  - 🍎 Apple : les offres FoundClub sont dans UN seul groupe d'abonnements, et
 *    un compte Apple n'y a qu'UN abonnement actif. Acheter depuis AIKI, avec un
 *    abonnement Apple qui couvre Demo, ne cree pas un second abonnement : Apple
 *    REMPLACE celui de Demo. Bloque.
 *  - 🤖 Google Play : chaque famille d'offres est un abonnement a part. Un 2e
 *    abonnement d'une AUTRE famille est possible ; la MEME famille, non (Google
 *    refuse d'acheter deux fois ce qu'on possede deja). Bloque seulement ce cas.
 *  - 🌐 Caisse web (Stripe), rail de test, abonnement pose a la main : aucun
 *    magasin ne s'interpose. Rien ne bloque.
 * Seul un abonnement dont on SAIT qu'il couvre un AUTRE club bloque : sans
 * preuve, on laisse faire, comme avant.
 * @param {object} params
 * @param {any} params.catalogEntry - L'offre choisie.
 * @param {string} [params.changeSourceSubscriptionDocumentId] - L'abonnement qu'on
 *   CHANGE, quand c'en est un : il ne peut pas se bloquer lui-meme.
 * @param {string} [params.clubDocumentId] - Le club affiche.
 * @param {ReturnType<typeof getPayerSubscriptionsWithClubs>} params.payerSubscriptions - Mes abonnements.
 * @param {'apple' | 'google' | null} [params.storeProvider] - Le magasin de CET achat, `null` hors magasin.
 * @returns {{ coveredClubDocumentIds: string[]; reason: 'apple-single-group' | 'google-same-product' } | null}
 */
export const getStoreSubscriptionConflict = ({
  catalogEntry,
  changeSourceSubscriptionDocumentId,
  clubDocumentId,
  payerSubscriptions,
  storeProvider,
}) => {
  if (!storeProvider || !Array.isArray(payerSubscriptions)) return null;
  // L'offre au licencie passe par la caisse web, meme depuis un telephone.
  if (isPerLicenseeSubscriptionEntry(catalogEntry)) return null;

  const activeClubDocumentId = trimId(clubDocumentId);
  const changeSource = trimId(changeSourceSubscriptionDocumentId);
  const targetFamily = getPlanFamily(catalogEntry?.planCode);
  const conflicting = payerSubscriptions.find((entry) => {
    if (entry.provider !== storeProvider || entry.documentId === changeSource) return false;
    if (!Array.isArray(entry.clubDocumentIds) || entry.clubDocumentIds.length === 0) return false;
    if (activeClubDocumentId && entry.clubDocumentIds.includes(activeClubDocumentId)) return false;
    return storeProvider === 'apple' || getPlanFamily(entry.planCode) === targetFamily;
  });
  if (!conflicting) return null;

  return {
    coveredClubDocumentIds: conflicting.clubDocumentIds || [],
    reason: storeProvider === 'apple' ? 'apple-single-group' : 'google-same-product',
  };
};

/**
 * CE QUE L'ECRAN DIT QUAND LE MAGASIN INTERDIT L'ACHAT — franchement, et avec la
 * marche a suivre (decision « abo2 A » : on ne contourne pas).
 * @param {object} params
 * @param {string} [params.clubDocumentId] - Le club qu'on voulait couvrir.
 * @param {{ coveredClubDocumentIds: string[]; reason: string }} params.conflict - Le verdict.
 * @param {any[]} [params.entitlementsSummary] - Pour nommer les clubs.
 * @param {any} [params.userData] - Pour nommer les clubs.
 * @returns {{ closeLabel: string; contactLabel: string; mailto: string; message: string;
 *   title: string }} L'alerte : titre, texte, et le bouton qui ouvre le courriel.
 */
export const getStoreSubscriptionConflictNotice = ({
  clubDocumentId,
  conflict,
  entitlementsSummary,
  userData,
}) => {
  const clubName = getClubDisplayName(trimId(clubDocumentId), entitlementsSummary || [], userData)
    || i18next.t('subscriptionOffers.storeConflict.thisClub', 'ce club');
  const coveredClubs = (conflict?.coveredClubDocumentIds || [])
    .map((documentId) => getClubDisplayName(trimId(documentId), entitlementsSummary || [], userData))
    .filter(Boolean)
    .join(', ') || i18next.t('subscriptionOffers.storeConflict.otherClub', 'un autre club');
  const valeurs = {
    clubName, coveredClubs, email: SUPPORT_CONTACT_EMAIL, ...SANS_ECHAPPEMENT,
  };

  return {
    closeLabel: i18next.t('common.close', 'Fermer'),
    contactLabel: i18next.t('subscriptionOffers.storeConflict.contactUs', 'Nous écrire'),
    // Objet generique : aucune donnee personnelle dans l'adresse.
    mailto: `${SUPPORT_CONTACT_MAILTO}?subject=${encodeURIComponent(i18next.t(
      'subscriptionOffers.storeConflict.mailSubject',
      'Abonnement pour un autre club',
    ))}`,
    message: conflict?.reason === 'google-same-product'
      ? i18next.t(
        'subscriptionOffers.storeConflict.googleMessage',
        "Ton compte Google Play a déjà cette offre, pour {{coveredClubs}}. Google n'autorise pas "
          + 'deux fois la même : choisis une autre offre pour {{clubName}}, ou écris-nous à '
          + '{{email}}.',
        valeurs,
      )
      : i18next.t(
        'subscriptionOffers.storeConflict.appleMessage',
        "Ton compte Apple a déjà un abonnement FoundClub, pour {{coveredClubs}}. Apple n'en "
          + "autorise qu'un à la fois : un nouvel achat le remplacerait. Pour couvrir aussi "
          + "{{clubName}}, écris-nous à {{email}}, on s'en occupe.",
        valeurs,
      ),
    title: i18next.t('subscriptionOffers.storeConflict.title', 'Couvrir {{clubName}}', valeurs),
  };
};

/**
 * UPGRADE / U5 — UNE OFFRE EST-ELLE ENCORE ACHETABLE, ET SINON POURQUOI.
 *
 * Depuis le 2026-09-04 le serveur accepte l'argent quand l'offre achetee est
 * STRICTEMENT meilleure que la couverture en place, et le refuse sinon
 * (`CLUB_ALREADY_COVERED`). Une surface de vente qui propose quand meme les
 * quatre tranches envoie l'utilisateur payer PUIS se faire jeter — c'est le
 * scenario exact qui a coute de l'argent ce jour-la.
 *
 * ⚠️ REUTILISE LE MOTIF DE DESACTIVATION DE CLUBEQ (`isSelectable` + mention) :
 * les trois surfaces de vente le lisent deja pour les equipes.
 *
 * ⚠️ EN CAS DE DOUTE, ON PROPOSE. Un plan qu'on ne sait pas classer (cadeau,
 * offre historique) rend `isSelectable: true` : le serveur, lui, accepte ces
 * cas-la. Le mauvais cote de l'erreur serait de griser une offre qu'il aurait
 * prise — c'est-a-dire de perdre une vente en silence.
 * @param {object} params - l'offre et ce qui couvre deja le club.
 * @param {string} [params.blockingClubPlanCode] - la couverture qui bloque.
 *   Elle se lit avec `getBlockingClubCoveragePlanCode`.
 * @param {any[]} [params.catalogEntries] - le catalogue, pour classer la couverture en place.
 * @param {any} params.entry - l'offre a juger.
 * @returns {{ coverageNotice: string | null, isSelectable: boolean }} - le verdict.
 */
export const buildClubOfferAvailability = ({
  blockingClubPlanCode,
  catalogEntries,
  entry,
}) => {
  const AVAILABLE = { coverageNotice: null, isSelectable: true };
  const blockingPlanCode = String(blockingClubPlanCode || '').trim();
  if (!blockingPlanCode) return AVAILABLE;
  // La regle d'Adel porte sur les offres CLUB. Une offre EQUIPE a la sienne,
  // posee par CLUBEQ, et elle passe par une autre porte.
  if (getSubscriptionEntryScope(entry) !== 'CLUB') return AVAILABLE;

  const blockingEntry = (Array.isArray(catalogEntries) ? catalogEntries : [])
    .find((candidate) => String(candidate?.planCode || '').trim() === blockingPlanCode) || null;
  const blockingRank = getSubscriptionClubOfferRank(blockingEntry);
  const offerRank = getSubscriptionClubOfferRank(entry);
  if (blockingRank === null || offerRank === null) return AVAILABLE;
  if (offerRank > blockingRank) return AVAILABLE;

  return {
    coverageNotice: offerRank === blockingRank
      ? i18next.t(
        'subscriptionBilling.clubOfferAvailability.sameOffer',
        'Ton club a déjà cette offre',
      )
      : i18next.t(
        'subscriptionBilling.clubOfferAvailability.higherOffer',
        'Ton club a déjà une offre supérieure',
      ),
    isSelectable: false,
  };
};

/**
 * UPGRADE / U6 — CE QUI ARRIVE AU CADEAU DE 7 JOURS QUAND ON ACHETE.
 *
 * Constat d'Adel du 2026-09-03 (ligne 45 du suivi stores) : pendant le cadeau,
 * l'ecran des offres ne dit RIEN de ce qui se passe si on achete. On ne sait ni
 * quand on est debite, ni ce que devient le cadeau — donc on n'achete pas.
 *
 * ⚠️ LA PHRASE DIT LA VERITE DE LA CAISSE, PAS UNE VERITE CONFORTABLE. Le
 * magasin encaisse AU MOMENT DE L'ACHAT (mesure de production du 04/09 : Apple
 * a encaisse a 14:22:44, le serveur a ete prevenu 3 s plus tard). Ecrire « ton
 * abonnement prendra le relais a la fin du cadeau » serait faux : il prend le
 * relais tout de suite, et le cadeau se ferme (subscription-billing,
 * `closeSupersededClubCoverage`). On le dit tel quel — un client surpris par un
 * prelevement est un client perdu, et il a raison de l'etre.
 *
 * Rend '' quand aucun cadeau n'est en cours : une surface qui n'a rien a dire
 * n'affiche rien.
 * @param {any} subscriptionSummary - le resume d'abonnement rendu par le serveur.
 * @returns {string} - la phrase a afficher, ou ''.
 */
export const formatSubscriptionTrialHandoverNotice = (subscriptionSummary) => {
  const payerSubscriptions = Array.isArray(subscriptionSummary?.payerSubscriptionsSummary)
    ? subscriptionSummary.payerSubscriptionsSummary
    : [];
  const activeTrial = payerSubscriptions.find((entry) => entry?.isTrial === true
    && ['active', 'grace_period'].includes(String(entry?.status || '').trim().toLowerCase()));
  if (!activeTrial) return '';

  const endTime = new Date(String(activeTrial?.currentPeriodEnd || '')).getTime();
  // Une date illisible ne devient jamais « Invalid Date » a l'ecran : on dit la
  // meme chose sans elle.
  const deadline = Number.isFinite(endTime)
    ? i18next.t(
      'subscriptionBilling.trialHandover.deadline',
      " (il court jusqu'au {{date}})",
      { date: new Date(endTime).toLocaleDateString(localeDesFormats()), ...SANS_ECHAPPEMENT },
    )
    : '';

  return i18next.t(
    'subscriptionBilling.trialHandover.notice',
    "Ton essai gratuit est en cours{{deadline}}. L'offre que tu choisis est facturée "
      + 'tout de suite par ton magasin et prend le relais immédiatement : ton club garde ses '
      + 'droits sans coupure.',
    { deadline, ...SANS_ECHAPPEMENT },
  );
};

/**
 * @param {object} params
 * @param {any[]} params.availableTeams
 * @param {string[]} [params.clubCoveredTeamDocumentIds]
 * @param {string[]} [params.coveredTeamDocumentIds]
 * @param {number} params.slotCount
 * @returns {string[]}
 */
export const getInitialTeamSelection = ({
  availableTeams,
  clubCoveredTeamDocumentIds,
  coveredTeamDocumentIds,
  slotCount,
}) => {
  const normalizedSlotCount = Math.max(0, Number(slotCount || 0));
  const teamOptions = getSubscriptionSelectableTeams(availableTeams);
  const availableTeamIds = new Set(teamOptions.map((team) => String(team?.documentId || '').trim()).filter(Boolean));
  const normalizedCoveredTeamIds = Array.isArray(coveredTeamDocumentIds)
    ? coveredTeamDocumentIds
      .map((teamDocumentId) => String(teamDocumentId || '').trim())
      .filter((teamDocumentId) => availableTeamIds.has(teamDocumentId))
    : [];

  if (normalizedCoveredTeamIds.length > 0) {
    return normalizedCoveredTeamIds.slice(0, normalizedSlotCount);
  }

  // CLUBEQ / C3 : sans ce filtre, la pre-selection par defaut cocherait les
  // premieres equipes de la liste — y compris celles que le club paie deja, que
  // le serveur refusera. On pre-coche uniquement ce qui est achetable.
  const clubCoveredIds = new Set(
    (Array.isArray(clubCoveredTeamDocumentIds) ? clubCoveredTeamDocumentIds : [])
      .map((teamDocumentId) => String(teamDocumentId || '').trim())
      .filter(Boolean),
  );

  return teamOptions
    .map((team) => String(team?.documentId || '').trim())
    .filter(Boolean)
    .filter((teamDocumentId) => !clubCoveredIds.has(teamDocumentId))
    .slice(0, normalizedSlotCount);
};

/**
 * @param {'monthly' | 'yearly' | string | null | undefined} billingPeriod
 * @param {Date} [now]
 * @returns {{ currentPeriodEnd: string; currentPeriodStart: string }}
 */
export const buildSubscriptionBillingWindow = (billingPeriod, now = new Date()) => {
  const startDate = new Date(now);
  const endDate = new Date(now);
  if (String(billingPeriod || '').trim().toLowerCase() === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  return {
    currentPeriodEnd: endDate.toISOString(),
    currentPeriodStart: startDate.toISOString(),
  };
};

/**
 * @param {object} params
 * @param {any} params.catalogEntry
 * @param {string | null | undefined} [params.clubDocumentId]
 * @param {string[]} [params.teamDocumentIds]
 * @param {'apple' | 'google' | 'web'} params.provider
 * @param {boolean} [params.trustedValidation]
 * @param {Date} [params.now]
 * @returns {Record<string, any>}
 */
export const buildSubscriptionPurchasePayload = ({
  catalogEntry,
  clubDocumentId,
  now = new Date(),
  provider,
  teamDocumentIds,
  trustedValidation = false,
}) => {
  const planCode = String(catalogEntry?.planCode || '').trim();
  const providerProductId = String(catalogEntry?.providerProductId || '').trim() || planCode;
  const eventSeed = now.getTime();
  const windowPayload = buildSubscriptionBillingWindow(catalogEntry?.billingPeriod, now);

  return {
    ...windowPayload,
    autoRenew: true,
    billingPeriod: String(catalogEntry?.billingPeriod || '').trim().toLowerCase(),
    clubDocumentId: String(clubDocumentId || '').trim() || undefined,
    planCode,
    provider,
    providerEventId: `fc-test-purchase-${planCode}-${eventSeed}`,
    providerProductId,
    providerTransactionId: `fc-test-transaction-${planCode}-${eventSeed}`,
    status: 'active',
    teamDocumentIds: Array.isArray(teamDocumentIds) ? teamDocumentIds : [],
    trustedValidation,
  };
};

/**
 * @param {object} params
 * @param {any} params.catalogEntry
 * @param {string | null | undefined} params.subscriptionDocumentId
 * @param {string | null | undefined} [params.clubDocumentId]
 * @param {string[]} [params.teamDocumentIds]
 * @param {'apple' | 'google' | 'web'} params.provider
 * @param {boolean} [params.trustedValidation]
 * @param {Date} [params.now]
 * @returns {Record<string, any>}
 */
export const buildSubscriptionChangePlanPayload = ({
  catalogEntry,
  clubDocumentId,
  now = new Date(),
  provider,
  subscriptionDocumentId,
  teamDocumentIds,
  trustedValidation = false,
}) => {
  const planCode = String(catalogEntry?.planCode || '').trim();
  const providerProductId = String(catalogEntry?.providerProductId || '').trim() || planCode;
  const eventSeed = now.getTime();
  const windowPayload = buildSubscriptionBillingWindow(catalogEntry?.billingPeriod, now);

  return {
    ...windowPayload,
    autoRenew: true,
    billingPeriod: String(catalogEntry?.billingPeriod || '').trim().toLowerCase(),
    clubDocumentId: String(clubDocumentId || '').trim() || undefined,
    nextPlanCode: planCode,
    nextProviderProductId: providerProductId,
    provider,
    providerEventId: `fc-test-change-${planCode}-${eventSeed}`,
    status: 'active',
    subscriptionDocumentId: String(subscriptionDocumentId || '').trim(),
    teamDocumentIds: Array.isArray(teamDocumentIds) ? teamDocumentIds : [],
    trustedValidation,
  };
};

/**
 * @param {any} error
 * @returns {string}
 */
export const getSubscriptionBillingErrorMessage = (error) => {
  const message = String(
    error?.message
      || error?.error?.message
      || error?.response?.data?.error?.message
      || error?.response?.data?.message
      || '',
  ).trim();

  // T09 — « slot » est le mot du code ; celui du client est « place », qu'il lit
  // deja sur « Mon abonnement » (« 1/2 place attribuée »,
  // SubscriptionOverview.js:288). Et l'offre s'appelle « Équipe », jamais « Team ».
  if (message === 'TEAM_SLOT_DUPLICATE_TEAM') {
    return i18next.t(
      'subscriptionBilling.errors.teamSlotDuplicate',
      'Une même équipe ne peut pas être attribuée deux fois à la même offre Équipe.',
    );
  }

  if (message === 'TEAM_SLOT_COUNT_EXCEEDED') {
    return i18next.t(
      'subscriptionBilling.errors.teamSlotCountExceeded',
      'Cette offre n a pas assez de places pour couvrir autant d équipes. Ajuste la '
        + 'sélection avant de continuer.',
    );
  }

  if (message === 'CLUB_ALREADY_COVERED') {
    return i18next.t(
      'subscriptionBilling.errors.clubAlreadyCovered',
      'Ce club est déjà couvert par une offre Club active (souscrite par un autre membre). '
        + 'Inutile de payer deux fois : les droits sont partages.',
    );
  }

  // CLUBEQ (decision d Adel du 2026-09-04) : code DISTINCT de
  // `TEAM_ALREADY_COVERED`, et pas par gout du neuf. Le message generique
  // conseille « libere sa place actuelle » — un conseil IMPOSSIBLE a suivre ici :
  // une offre Club n a aucune place a liberer. Un mauvais conseil coute plus
  // cher qu un code de plus.
  if (message === 'TEAM_COVERED_BY_CLUB_PLAN') {
    return i18next.t(
      'subscriptionBilling.errors.teamCoveredByClubPlan',
      "Cette équipe est déjà couverte par l'offre Club de son club : tu as déjà ces droits, "
        + 'inutile de payer une offre Équipe pour elle.',
    );
  }

  // ABOPARCLUB (2026-09-29) — le serveur refuse un changement d'offre qui
  // viserait l'abonnement d'un AUTRE club (decision d'Adel « abo2 A »).
  if (message === 'SUBSCRIPTION_CHANGE_OTHER_CLUB') {
    return i18next.t(
      'subscriptionBilling.errors.subscriptionChangeOtherClub',
      'Cet abonnement couvre un autre club : il ne se modifie pas depuis ce club-ci. Pour '
        + 'couvrir ce club, prends-lui sa propre offre, ou écris-nous à {{email}}.',
      { email: SUPPORT_CONTACT_EMAIL, ...SANS_ECHAPPEMENT },
    );
  }

  if (message === 'TEAM_ALREADY_COVERED') {
    return i18next.t(
      'subscriptionBilling.errors.teamAlreadyCovered',
      'Cette équipe est déjà couverte par une autre offre active. Choisis une équipe non '
        + 'couverte ou libere sa place actuelle.',
    );
  }

  if (message === 'clubDocumentId obligatoire pour une offre CLUB.' || message === 'Club introuvable pour entitlement CLUB.') {
    return i18next.t(
      'subscriptionBilling.errors.clubRequired',
      'Rattache d abord le bon club avant de prendre une offre Club.',
    );
  }

  if (message === 'Le checkout web public n est pas disponible en production tant qu un provider web n a pas été choisi.') {
    return i18next.t(
      'subscriptionBilling.errors.webPlanChangeClosed',
      'Le changement d offre web public n est pas encore ouvert sur cet environnement.',
    );
  }

  // VITRINE (2026-09-04) — LES TROIS REFUS QUE L APP NE MONTRAIT JAMAIS.
  //
  // Ils existaient deja cote serveur, mot pour mot, et n arrivaient nulle part :
  // le rail avalait l erreur et l ecran felicitait. Maintenant qu ils remontent
  // (W1), ils doivent se lire comme une phrase, pas comme un nom de champ.
  // Chacun nomme AUSSI la sortie de secours — « Restaurer mes achats », le seul
  // geste par lequel quelqu un repare un compte dont le webhook n est pas arrive.
  if (message === 'Subscription source introuvable pour changement d offre.') {
    return i18next.t(
      'subscriptionBilling.errors.subscriptionSourceNotFound',
      'Nous n avons pas retrouvé l abonnement à changer sur ce compte. Ton achat est bien '
        + 'enregistré par le store : ouvre « Mon abonnement » puis « Restaurer mes achats ».',
    );
  }

  if (message === 'providerTransactionId obligatoire.'
    || message === 'providerTransactionId obligatoire pour traiter cet achat.') {
    return i18next.t(
      'subscriptionBilling.errors.missingTransactionId',
      'Le store ne nous a pas transmis le numéro de ta transaction. Ton paiement est bien '
        + 'enregistré chez lui : tes droits s ouvriront automatiquement, et « Restaurer mes '
        + 'achats » les débloque tout de suite.',
    );
  }

  const REFUS_SOURCE_STORE = 'Abonnement source introuvable chez le store pour ce compte :'
    + ' changement d offre refuse.';
  if (message === REFUS_SOURCE_STORE) {
    return i18next.t(
      'subscriptionBilling.errors.storeSourceUnknown',
      'Le store ne reconnaît pas cet abonnement sur ton compte. Vérifie que tu es connecté '
        + 'au même compte App Store ou Google Play qu au moment de l achat, puis réessaie.',
    );
  }

  if (message) {
    return message;
  }

  return i18next.t(
    'subscriptionBilling.errors.generic',
    'Impossible de mettre à jour ton abonnement pour le moment.',
  );
};

/**
 * VITRINE / W5 — CE QUE L ECRAN DE SUCCES A LE DROIT D ANNONCER SUR L ECHEANCE.
 *
 * 🧨 LA DATE ETAIT CALCULEE SUR L HORLOGE DU TELEPHONE (`new Date()` + 1 mois ou
 * + 1 an), et elle s affichait MEME quand le serveur n avait rien valide — donc
 * meme quand aucun abonnement n existait. Trois ecrans faisaient ce calcul, mot
 * pour mot ; il vit desormais ici, une seule fois, et il ne calcule plus rien :
 * il LIT ce que le serveur vient de rendre.
 *
 * Sans date connue, on n en invente aucune et on le dit : l abonnement est en
 * cours d activation (les droits arrivent par le webhook du store).
 * @param {any} result - Ce que rend le rail d achat.
 * @returns {{ pendingActivation: boolean, renewalDateLabel: string | undefined }}
 */
export const readSubscriptionRenewalAnnouncement = (result) => {
  const rawDate = String(result?.subscription?.currentPeriodEnd || '').trim();
  const serverDate = rawDate ? new Date(rawDate) : null;
  if (!serverDate || Number.isNaN(serverDate.getTime())) {
    return { pendingActivation: true, renewalDateLabel: undefined };
  }

  return {
    pendingActivation: false,
    renewalDateLabel: format(serverDate, 'd MMMM yyyy', { locale: frLocale }),
  };
};
