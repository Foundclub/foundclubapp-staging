import { formatSubscriptionPlanLabel } from './subscriptionDecision';

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
  return amountLabel ? `${amountLabel} par licencié` : '';
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

  return `${count} licencié${count > 1 ? 's' : ''} × ${unitLabel} = ${totalLabel}`;
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
  return licenseeCap === null ? 'illim.' : String(licenseeCap);
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
    ? 'un nombre illimité de licenciés'
    : `jusqu'à ${licenseeCap} licenciés du club`;
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
 * @param {{ serverEntries: any[]; storePricesEurCents?: Record<string, number> | null }} params
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
export const resolveSubscriptionCatalogPrices = ({ serverEntries, storePricesEurCents }) => {
  const entries = Array.isArray(serverEntries) ? serverEntries : [];
  const storePrices = storePricesEurCents && typeof storePricesEurCents === 'object'
    ? storePricesEurCents
    : null;

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
 * @param {number | null | undefined} priceEurCents
 * @param {'monthly' | 'yearly' | string} billingPeriod
 * @returns {string}
 */
export const formatSubscriptionPriceLabel = (priceEurCents, billingPeriod) => {
  const cents = Number(priceEurCents);
  if (!Number.isFinite(cents) || cents < 0) {
    return '';
  }
  const amount = (cents / 100).toFixed(2).replace('.', ',');
  const normalizedPeriod = String(billingPeriod || '').trim().toLowerCase();
  let periodSuffix = '';
  if (normalizedPeriod === 'yearly') {
    periodSuffix = '/an';
  } else if (normalizedPeriod === 'monthly') {
    periodSuffix = '/mois';
  }
  return `${amount} €${periodSuffix}`;
};

/**
 * Equivalence mensuelle exacte d'un prix annuel (« soit 5,00 €/mois »).
 * Une seule ancre prix par surface : ce libelle accompagne toujours l'ancre annuelle,
 * jamais les segments de palier ni le sous-texte d'un CTA.
 * @param {number | null | undefined} yearlyPriceEurCents
 * @returns {string}
 */
export const formatSubscriptionMonthlyEquivalentLabel = (yearlyPriceEurCents) => {
  const cents = Number(yearlyPriceEurCents);
  if (!Number.isFinite(cents) || cents <= 0) {
    return '';
  }
  return `soit ${(cents / 12 / 100).toFixed(2).replace('.', ',')} €/mois`;
};

/**
 * @param {any} entry
 * @returns {{ description: string; label: string; priceLabel: string; secondaryLabel: string }}
 */
export const getSubscriptionCatalogEntryMeta = (entry) => {
  const scopeType = String(entry?.scopeType || '').trim().toUpperCase();
  const billingPeriod = String(entry?.billingPeriod || '').trim().toLowerCase();
  const slotCount = Number(entry?.slotCount || 0);
  const periodLabel = billingPeriod === 'yearly' ? 'Annuel' : 'Mensuel';
  const displayName = String(entry?.displayName || '').trim();
  const priceLabel = formatSubscriptionPriceLabel(entry?.referencePriceEurCents, billingPeriod);

  if (scopeType === TEAM_SCOPE) {
    const slotsLabel = `${slotCount} équipe${slotCount > 1 ? 's' : ''} couverte${slotCount > 1 ? 's' : ''}`;
    return {
      description: 'Publie et gère les équipes couvertes par ton offre Équipe.',
      label: displayName || formatSubscriptionPlanLabel(entry?.planCode),
      priceLabel,
      secondaryLabel: [slotsLabel, periodLabel, priceLabel].filter(Boolean).join(' - '),
    };
  }

  return {
    // R10 — l'argumentaire posait une condition qui n'existe plus depuis la
    // decision produit du 2026-07-17 : l'offre ouvre les droits immediatement,
    // club certifie ou pas. On supprime l'affirmation au lieu de la reformuler.
    description: 'Débloque les droits club sur tout ton club.',
    label: displayName || formatSubscriptionPlanLabel(entry?.planCode),
    priceLabel,
    secondaryLabel: ['Droits Club', periodLabel, priceLabel].filter(Boolean).join(' - '),
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
 * @param {object} params
 * @param {any[]} params.availableTeams
 * @param {string[]} [params.coveredTeamDocumentIds]
 * @param {number} params.slotCount
 * @returns {string[]}
 */
export const getInitialTeamSelection = ({
  availableTeams,
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

  return teamOptions
    .map((team) => String(team?.documentId || '').trim())
    .filter(Boolean)
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
    return 'Une même équipe ne peut pas être attribuée deux fois à la même offre Équipe.';
  }

  if (message === 'TEAM_SLOT_COUNT_EXCEEDED') {
    return 'Cette offre n a pas assez de places pour couvrir autant d équipes. Ajuste la sélection avant de continuer.';
  }

  if (message === 'CLUB_ALREADY_COVERED') {
    return 'Ce club est déjà couvert par une offre Club active (souscrite par un autre membre). Inutile de payer deux fois : les droits sont partages.';
  }

  if (message === 'TEAM_ALREADY_COVERED') {
    return 'Cette équipe est déjà couverte par une autre offre active. Choisis une équipe non couverte ou libere sa place actuelle.';
  }

  if (message === 'clubDocumentId obligatoire pour une offre CLUB.' || message === 'Club introuvable pour entitlement CLUB.') {
    return 'Rattache d abord le bon club avant de prendre une offre Club.';
  }

  if (message === 'Le checkout web public n est pas disponible en production tant qu un provider web n a pas été choisi.') {
    return 'Le changement d offre web public n est pas encore ouvert sur cet environnement.';
  }

  if (message) {
    return message;
  }

  return 'Impossible de mettre à jour ton abonnement pour le moment.';
};
