// S9, vague S — LE MODELE DU PARCOURS MEMBRE « MES COTISATIONS ».
//
// 🧭 POURQUOI CE FICHIER EXISTE, ET POURQUOI IL N EST PAS DANS
// `licenseDesignSystem.js` : ce voisin est PARTAGE avec les ecrans du club.
// Mesure du 2026-08-25 — `licenseStatusLabels` n a aucun lecteur hors de son
// propre fichier, mais `LicenseStatusChip` en a HUIT, dont six cote
// club/admin (`ClubLicenses`, `ClubLicenseMemberDetail`, `ClubLicensePayments`,
// `CMLicensesDashboard`, `SuperAdminLicensesDashboard`, `PublicLicensePayment`).
// Renommer « A valider » en « Declaree » EN PLACE aurait donc change le mot
// sous les yeux des dirigeants, qui ne parlent pas la meme langue que le
// membre. ⇒ Le vocabulaire du pack vit ici, et NULLE PART ailleurs.
//
// ⛔ CE FICHIER NE DESSINE RIEN. Il ne connait ni `useTheme`, ni React : c est
// ce qui le rend mesurable par un test sans monter un ecran.

import { formatLicenseMoney } from './licenseDesignSystem';

// ── Les six statuts que le pack dessine, et les trois qu il masque ──────────
//
// 🚨 LE STATUT VIENT TOUJOURS DU SERVEUR (`license.ts`, enum de
// `license-assignment/schema.json`). L app ne compare JAMAIS une date avec
// l horloge du telephone : un telephone mal regle afficherait un faux retard.
// C est l ouverture S2 du pack, et c est la meme regle que « match fini » du
// pack evenement.
//
// Deux noms de l enum serveur ne sont pas ceux du pack, et la traduction se
// fait ICI, une seule fois :
//   · `overdue`       (serveur) = « late »   (pack) → EN RETARD
//   · `manual_review` (serveur) = declaration en attente → DECLAREE
/**
 * Les six statuts que le pack MEMBRE sait nommer.
 * @typedef {'cancelled' | 'manual_review' | 'overdue' | 'paid' | 'partial'
 *   | 'pending' | 'waived'} MemberLicenseStatus
 */

/** @type {Record<string, string>} */
export const MEMBER_STATUS_LABELS = {
  cancelled: 'Annulée',
  manual_review: 'Déclarée',
  overdue: 'En retard',
  paid: 'Payée',
  partial: 'Partielle',
  pending: 'En attente',
  waived: 'Exemptée',
};

// Le surtitre de la carte de montant change avec le statut (planche 02).
// « RESTE A PAYER » sur zero euro serait absurde ; un libelle faux coute plus
// cher qu un libelle long.
/** @type {Record<string, string>} */
export const MEMBER_STATUS_OVERLINES = {
  cancelled: 'MONTANT ANNULÉ',
  manual_review: 'RESTE À PAYER',
  overdue: 'RESTE À PAYER',
  paid: 'COTISATION RÉGLÉE',
  partial: 'RESTE À PAYER',
  pending: 'RESTE À PAYER',
  waived: 'RIEN À PAYER',
};

// ⛔ `not_due`, `refunded` et `disputed` NE SONT PAS DESSINES (decision du chef
// d orchestre, 25/08). Ce ne sont pas des oublis : le pack ne les montre pas,
// et inventer un mot pour eux serait inventer une information.
// 🔎 `getMine` (admin `license.ts:3381`) filtre deja `status != cancelled` :
// une cotisation annulee n arrive donc jamais dans la LISTE. Elle reste
// atteignable par `/licenses/me/:id` — d ou son maintien dans le mapping.
const DRAWN_STATUSES = new Set(Object.keys(MEMBER_STATUS_LABELS));

/**
 * Le statut est-il un de ceux que le pack dessine ?
 * @param {string} status le statut rendu par le serveur
 * @returns {boolean} vrai si l ecran sait le nommer
 */
export const isDrawnMemberStatus = (status) => DRAWN_STATUSES.has(String(status || ''));

/**
 * Le mot du statut, dans la langue du membre.
 * @param {string} status le statut rendu par le serveur
 * @returns {string} le libelle a afficher
 */
export const getMemberStatusLabel = (status) => MEMBER_STATUS_LABELS[status] || '';

/**
 * Le surtitre de la carte de montant.
 * @param {string} status le statut rendu par le serveur
 * @returns {string} le surtitre en majuscules
 */
export const getMemberStatusOverline = (status) => MEMBER_STATUS_OVERLINES[status]
  || 'RESTE À PAYER';

/**
 * La couleur du statut (D6 du pack : six statuts, quatre couleurs).
 *
 * ⛔ Cette couleur ne touche JAMAIS un fond de bouton : elle habille la
 * pastille, la tuile, la bordure de carte et l encre du sous-titre. Le cyan
 * des boutons reste la couleur d ACTION de l app, pas une couleur d etat.
 * @param {any} Colors la palette du theme
 * @param {string} status le statut rendu par le serveur
 * @returns {string} un jeton de couleur
 */
export const getMemberStatusTone = (Colors, status) => ({
  cancelled: Colors.neutral400,
  manual_review: Colors.warning500,
  overdue: Colors.error500,
  paid: Colors.success500,
  partial: Colors.primary500,
  pending: Colors.primary500,
  waived: Colors.neutral300,
}[status] || Colors.primary500);

// ── Ce qui vaut « il n y a plus rien a payer ici » ──────────────────────────
const SETTLED_STATUSES = new Set(['cancelled', 'paid', 'waived']);

/**
 * La cotisation est-elle close ? (Aucune barre d action : plutot aucun bouton
 * qu un bouton desactive — regle 2I du pack.)
 * @param {any} assignment une affectation de cotisation
 * @returns {boolean} vrai si plus rien n est du
 */
export const isSettledAssignment = (assignment) => SETTLED_STATUSES
  .has(String(assignment?.status || ''));

/**
 * L identifiant stable d une cotisation, tel que l app le manipule partout.
 * @param {any} entity une affectation, une echeance, un paiement...
 * @returns {string} l identifiant, ou une chaine vide
 */
export const licenseKeyOf = (entity) => String(entity?.documentId || entity?.id || '');

/**
 * Le nom du club qui reclame la cotisation.
 * @param {any} assignment une affectation de cotisation
 * @returns {string} le nom du club
 */
export const clubNameOf = (assignment) => assignment?.club?.name
  || assignment?.campaign?.club?.name
  || 'Ton club';

/**
 * LE TITRE D UNE CARTE EST LA CAMPAGNE, JAMAIS LE CLUB.
 *
 * 🧨 Defaut 2 du pack : sur les captures du 21/08, deux cartes portent le meme
 * nom de club, la meme saison, et deux statuts opposes. Le joueur n a aucun
 * moyen de savoir laquelle il doit payer. Ce qui les separe, c est la campagne.
 * @param {any} assignment une affectation de cotisation
 * @returns {string} le titre de la carte
 */
export const campaignTitleOf = (assignment) => assignment?.campaign?.name || 'Cotisation';

/**
 * LE DISCRIMINANT — ce qui distingue deux cotisations du MEME club.
 *
 * ⚠️ OUVERTURE S7 DU PACK, NON COMBLEE COTE SERVEUR. Il n existe pas de champ
 * `section` sur l affectation ; ce qui s en approche le plus et qui EXISTE
 * vraiment est `team.name` puis `categoryLabel` (schema
 * `license-assignment`). On prend ce qu on a, et on ne fabrique rien : sans
 * aucun des deux, le sous-titre porte le club seul.
 * @param {any} assignment une affectation de cotisation
 * @returns {string} le sous-titre, club compris
 */
export const cardSubtitleOf = (assignment) => {
  const club = clubNameOf(assignment);
  const discriminant = assignment?.team?.name || assignment?.categoryLabel || '';
  return discriminant ? `${club} · ${discriminant}` : club;
};

// ── Les dates, ecrites en francais ─────────────────────────────────────────
const MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * « 2026-10-20 » devient « 20 octobre 2026 ».
 *
 * ⛔ NE JAMAIS RENDRE « Non définie ». Une donnee absente n est pas une
 * information : l appelant doit tester le vide et dire ce que ca change pour
 * le joueur, ou se taire (regle D3 / cadre 3E du pack).
 * @param {string} value une date ISO, ou un debut de date
 * @param {object} [options] mise en forme
 * @param {boolean} [options.withYear] garder l annee (defaut : oui)
 * @returns {string} la date en toutes lettres, ou une chaine vide
 */
export const formatMemberDate = (value, options = {}) => {
  const raw = String(value || '').slice(0, 10);
  const parts = raw.split('-');
  if (parts.length !== 3) return '';
  const [year, month, day] = parts;
  const monthLabel = MONTHS[Number(month) - 1];
  if (!monthLabel || !Number(day)) return '';
  const dayLabel = Number(day);
  const withYear = options.withYear !== false;
  return withYear
    ? `${dayLabel} ${monthLabel} ${year}`
    : `${dayLabel} ${monthLabel}`;
};

// ── L echeancier ───────────────────────────────────────────────────────────

/**
 * Le rang d une echeance.
 * @param {any} installment une echeance
 * @returns {number} son numero d ordre
 */
export const installmentOrderOf = (installment) => Number(
  installment?.installmentOrder || installment?.order || 1,
);

/**
 * LES CINQ ETATS D UNE LIGNE D ECHEANCE (planche 03).
 *
 * 🚨 « Declaree » NE SE LIT PAS SUR L ECHEANCE : `/licenses/me` peuple
 * `payments` mais PAS `payments.installment` (admin `license.ts:3381`), donc
 * rien ne rattache une declaration en attente a une ligne precise. Ce qu on
 * sait, en revanche, c est que l AFFECTATION passe en `manual_review` tant que
 * le club n a pas valide. ⇒ La declaration se pose sur la PROCHAINE echeance
 * a payer, et sur elle seule. C est ce que montre le cadre 3C du pack.
 * @param {any} installment une echeance
 * @param {object} context ce que l affectation sait
 * @param {string} context.assignmentStatus le statut de l affectation
 * @param {boolean} [context.isNextDue] cette echeance est-elle la prochaine due
 * @returns {'paid' | 'due' | 'upcoming' | 'late' | 'declared'} l etat de la ligne
 */
export const getInstallmentState = (installment, context) => {
  const status = String(installment?.status || '');
  if (status === 'paid') return 'paid';
  if (status === 'overdue') return 'late';
  if (context?.isNextDue && context?.assignmentStatus === 'manual_review') return 'declared';
  if (status === 'not_due') return 'upcoming';
  return 'due';
};

/**
 * LA PROCHAINE ECHEANCE A PAYER — celle que porte le pied de la carte de
 * montant. Le pied ne montre QUE cette ligne : l echeancier complet est la
 * section suivante (regle 4 de la planche 02).
 * @param {any} assignment une affectation de cotisation
 * @returns {any} l echeance, ou null
 */
export const getNextInstallment = (assignment) => {
  /** @type {any[]} */
  const list = assignment?.installments || [];
  const open = list.filter((item) => !['cancelled', 'paid'].includes(String(item?.status || '')));
  if (!open.length) return null;
  const late = open.filter((item) => String(item?.status || '') === 'overdue');
  const pool = late.length ? late : open;
  return [...pool].sort((a, b) => {
    const byDate = String(a?.dueDate || '9999').localeCompare(String(b?.dueDate || '9999'));
    return byDate !== 0 ? byDate : installmentOrderOf(a) - installmentOrderOf(b);
  })[0] || null;
};

/**
 * L echeancier merite-t-il sa section ?
 *
 * ⛔ Un montant unique ne merite pas un « Echeancier » d une ligne — l ecran
 * actuel en affiche un, « Echeance 1 · Date non definie ». Deux echeances au
 * moins, et une cotisation encore active (regle d existence du pack).
 * @param {any} assignment une affectation de cotisation
 * @returns {boolean} vrai si la section se dessine
 */
export const hasInstallmentPlan = (assignment) => (assignment?.installments || []).length >= 2
  && !isSettledAssignment(assignment);

// ── Les totaux ─────────────────────────────────────────────────────────────

/**
 * LE TOTAL DU, SOMME DES RESTES — jamais une constante, jamais un champ
 * denormalise. Il doit rester juste apres un paiement (regle du pack).
 * @param {any[]} assignments les cotisations affichees
 * @returns {number} le total restant, en centimes
 */
export const sumRemainingCents = (assignments = []) => (assignments || [])
  .reduce((total, item) => total + (Number(item?.amountRemainingCents) || 0), 0);

/**
 * La devise d une cotisation.
 * @param {any} assignment une affectation de cotisation
 * @returns {string} le code ISO de la devise
 */
export const currencyOf = (assignment) => assignment?.currency
  || assignment?.campaign?.currency
  || 'EUR';

/**
 * LES GROUPES PAR CLUB de l ecran de liste.
 *
 * Un joueur peut cumuler plusieurs cotisations dans un meme club (licence,
 * stage, tournoi) : le groupe porte le club, les cartes portent les campagnes.
 * @param {any[]} assignments les cotisations a grouper
 * @returns {{clubName: string, clubId: string, club: any, items: any[], remainingCents: number}[]}
 * les groupes
 */
export const groupAssignmentsByClub = (assignments = []) => {
  /** @type {Map<string, any>} */
  const groups = new Map();
  (assignments || []).forEach((assignment) => {
    const club = assignment?.club || assignment?.campaign?.club || null;
    const clubName = clubNameOf(assignment);
    const clubId = licenseKeyOf(club) || clubName;
    if (!groups.has(clubId)) {
      groups.set(clubId, {
        club, clubId, clubName, items: [], remainingCents: 0,
      });
    }
    const group = groups.get(clubId);
    group.items.push(assignment);
    group.remainingCents += Number(assignment?.amountRemainingCents) || 0;
  });
  return [...groups.values()];
};

/**
 * LE SOUS-TITRE DE LA CARTE DE TOTAL : « 4 cotisations · 2 clubs · saison
 * 2026-2027 ». La saison n est ecrite que si TOUTES les cotisations partagent
 * la meme — sinon elle serait fausse.
 * @param {any[]} assignments les cotisations affichees
 * @returns {string} la sous-ligne
 */
export const describeTotalsLine = (assignments = []) => {
  const count = (assignments || []).length;
  const clubs = groupAssignmentsByClub(assignments).length;
  const seasons = [...new Set(
    (assignments || []).map((item) => String(item?.campaign?.seasonLabel || '')).filter(Boolean),
  )];
  const parts = [
    `${count} cotisation${count > 1 ? 's' : ''}`,
    `${clubs} club${clubs > 1 ? 's' : ''}`,
  ];
  if (seasons.length === 1) parts.push(`saison ${seasons[0]}`);
  return parts.join(' · ');
};

/**
 * LE CONTEXTE SOUS LE MONTANT D UNE CARTE DE LISTE.
 *
 * 🕐 « en retard depuis N jours » est ecrit SANS le compteur de jours : le
 * champ `daysLate` de l ouverture S2 n existe pas encore cote serveur, et
 * l app n a pas le droit de le calculer avec l horloge du telephone. On dit
 * donc le fait — le retard — sans inventer sa duree.
 * @param {any} assignment une affectation de cotisation
 * @returns {string} la ligne de contexte
 */
export const describeAssignmentContext = (assignment) => {
  const currency = currencyOf(assignment);
  const status = String(assignment?.status || '');
  const due = Number(assignment?.amountDueCents) || 0;
  const paid = Number(assignment?.amountPaidCents) || 0;

  if (status === 'waived') {
    return `${formatLicenseMoney(due, currency)} offerts par le club`;
  }
  if (status === 'cancelled') return 'Annulée par le club';
  if (status === 'paid') return 'soldée';
  if (status === 'manual_review') return 'paiement déclaré · le club vérifie';
  if (status === 'overdue') return 'en retard';
  if (paid > 0) {
    return `${formatLicenseMoney(paid, currency)} payés sur ${formatLicenseMoney(due, currency)}`;
  }

  const next = getNextInstallment(assignment);
  const dueDate = formatMemberDate(next?.dueDate || assignment?.dueDate);
  if (dueDate) return `à payer avant le ${dueDate}`;
  return 'aucune date fixée';
};

/**
 * LE RATIO DE LA BARRE DE PROGRESSION, borne a [0, 1].
 * @param {any} assignment une affectation de cotisation
 * @returns {number} la part deja payee
 */
export const getPaidRatio = (assignment) => {
  const due = Number(assignment?.amountDueCents) || 0;
  if (due <= 0) return 0;
  const paid = Number(assignment?.amountPaidCents) || 0;
  return Math.min(1, Math.max(0, paid / due));
};

// ── Saison en cours / saisons passees ──────────────────────────────────────

/**
 * LA SAISON EN COURS = la plus recente que le serveur ait rendue.
 *
 * ⛔ Pas de calcul de calendrier : « on est en aout, donc 2026-2027 » serait
 * encore une deduction d horloge locale. La saison en cours est celle que les
 * donnees portent, point.
 * @param {any[]} assignments les cotisations rendues par le serveur
 * @returns {string} le libelle de saison le plus recent, ou une chaine vide
 */
export const getCurrentSeasonLabel = (assignments = []) => (assignments || [])
  .map((item) => String(item?.campaign?.seasonLabel || ''))
  .filter(Boolean)
  .sort()
  .pop() || '';

/**
 * UNE COTISATION EST-ELLE ARCHIVEE ?
 *
 * Deux signaux, tous deux venus du serveur :
 *   1. la campagne est `closed` ou `archived` — le club a ferme le dossier ;
 *   2. sa saison est anterieure a la plus recente que le compte porte.
 * @param {any} assignment une affectation de cotisation
 * @param {string} currentSeason la saison en cours (cf. `getCurrentSeasonLabel`)
 * @returns {boolean} vrai si elle appartient aux saisons passees
 */
export const isArchivedAssignment = (assignment, currentSeason) => {
  const campaignStatus = String(assignment?.campaign?.status || '');
  if (campaignStatus === 'closed' || campaignStatus === 'archived') return true;
  const season = String(assignment?.campaign?.seasonLabel || '');
  return Boolean(season && currentSeason && season < currentSeason);
};

/**
 * Separe la saison en cours des saisons passees.
 * @param {any[]} assignments les cotisations rendues par le serveur
 * @returns {{active: any[], archived: any[], currentSeason: string}} les deux piles
 */
export const splitSeasons = (assignments = []) => {
  const drawn = (assignments || []).filter((item) => isDrawnMemberStatus(item?.status));
  const currentSeason = getCurrentSeasonLabel(drawn);
  return {
    active: drawn.filter((item) => !isArchivedAssignment(item, currentSeason)),
    archived: drawn.filter((item) => isArchivedAssignment(item, currentSeason)),
    currentSeason,
  };
};

/**
 * LES SAISONS PASSEES, groupees et triees de la plus recente a la plus
 * ancienne — l ordre dans lequel on cherche un vieux recu.
 * @param {any[]} archived les cotisations archivees
 * @returns {{season: string, items: any[]}[]} un groupe par saison
 */
export const groupBySeason = (archived = []) => {
  /** @type {Map<string, any>} */
  const groups = new Map();
  (archived || []).forEach((assignment) => {
    const season = String(assignment?.campaign?.seasonLabel || '') || 'Saison non précisée';
    if (!groups.has(season)) groups.set(season, { items: [], season });
    groups.get(season).items.push(assignment);
  });
  return [...groups.values()].sort((a, b) => b.season.localeCompare(a.season));
};

/**
 * LE MONTANT QUE LA CARTE DE MONTANT ECRIT EN GRAND (40 px).
 *
 * ⛔ Un seul chiffre a le droit d etre gros. Payee : le total regle. Exemptee :
 * zero. Annulee : le montant, barre. Sinon : le reste a payer.
 * @param {any} assignment une affectation de cotisation
 * @returns {number} le montant en centimes
 */
export const getHeadlineAmountCents = (assignment) => {
  const status = String(assignment?.status || '');
  if (status === 'paid') return Number(assignment?.amountDueCents) || 0;
  if (status === 'waived') return 0;
  if (status === 'cancelled') return Number(assignment?.amountDueCents) || 0;
  return Number(assignment?.amountRemainingCents) || 0;
};
