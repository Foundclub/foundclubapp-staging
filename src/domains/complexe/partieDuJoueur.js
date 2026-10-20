import { texteHeure } from '@/domains/complexe/complexeTerrain';
import {
  dateEtHeureDeParis,
  texteJourCourt,
} from '@/domains/complexe/reserverTerrain';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * @typedef {any} Traduire - La traduction (TFunction d'i18next ; comme reserverTerrain.js).
 */

/**
 * JOUER À PLUSIEURS ET LA COMMUNAUTÉ, CÔTÉ JOUEUR — RESA-L6B-2 (20/10/2026), chantier Réservation.
 *
 * Les règles PURES des écrans qui lisent les serveurs RESA-L3 (le groupe d'une réservation : la
 * collecte, les participants, le lien, l'annonce) et RESA-L4 (la fidélité) : plan E-P04, E-P05,
 * E-P07, E-P09, E-P10 ; planches EP04 (état 3), EP07 (états 1-4), EP09, EP13 (variantes 1, 2, 7).
 * Le serveur reste le SEUL juge (RG-SECU) : il borne la collecte, compte les présents, ouvre ou
 * ferme l'annonce ; l'app ne fait que dire ce qu'il a décidé.
 *
 * Témoin : `partieDuJoueur.test.js`.
 */

const HEURE_MS = 60 * 60 * 1000;
const JOUR_MS = 24 * HEURE_MS;

/** Les états d'une réservation où la partie se joue encore (on peut y chercher des joueurs). */
const PARTIE_EN_COURS = Object.freeze(['confirmee', 'en_attente', 'en_collecte']);

// « lundi 18 h » vit avec les variantes de E-P13 qui l'emploient (reserverTerrain.js).
export { jourEtHeure } from '@/domains/complexe/reserverTerrain';

/**
 * « Lundi 12/10, 18 h » : une échéance lisible (planche EP04 état 3, « Date limite »).
 * @param {Traduire} t - Traduction.
 * @param {unknown} instant - L'instant (ISO).
 * @returns {string} Le texte, ou ''.
 */
export const texteEcheance = (t, instant) => {
  const lu = dateEtHeureDeParis(instant);
  if (!lu) return '';
  return t('reserverTerrain.collecte.echeance', '{{jour}}, {{heure}}', {
    heure: texteHeure(lu.heure),
    jour: texteJourCourt(t, lu.date),
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * Les dates limites proposées pour une collecte (RG-QUORUM, Q3) : la plus tardive que le complexe
 * permet (`latestDeadline` du récapitulatif), puis un et deux jours avant — seulement celles qui
 * laissent au moins une heure devant soi.
 * ponytail: trois choix fixes plutôt qu'un sélecteur de jour et d'heure ; plafond : on ne choisit
 * pas « mardi 9 h » ; voie de sortie : la feuille de date de l'app (`DatePicker`) bornée par
 * `latestDeadline`, si un complexe le demande.
 * @param {unknown} plusTard - La date limite la plus tardive (ISO).
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {string[]} Les échéances (ISO), de la plus tardive à la plus proche.
 */
export const echeancesDeCollecte = (plusTard, maintenant = new Date()) => {
  const fin = new Date(String(plusTard || '')).getTime();
  if (!Number.isFinite(fin)) return [];
  return [0, 1, 2]
    .map((jours) => fin - jours * JOUR_MS)
    .filter((instant) => instant - maintenant.getTime() >= HEURE_MS)
    .map((instant) => new Date(instant).toISOString());
};

/** Les onglets de « Participants » (E-P07 bloc 3). */
export const ONGLETS_DES_PARTICIPANTS = Object.freeze([
  'tous', 'presents', 'absents', 'sansReponse',
]);

/** La réponse du serveur que garde chaque onglet. */
const REPONSE_DE_L_ONGLET = Object.freeze({
  absents: 'absent',
  presents: 'present',
  sansReponse: 'sans_reponse',
});

/**
 * Les participants d'un onglet (Tous · Présents · Absents · Sans réponse).
 * @param {Array<{ response?: string }> | null | undefined} participants - Ceux du groupe.
 * @param {string} onglet - L'onglet.
 * @returns {any[]} Ceux de l'onglet, dans l'ordre du serveur (le réserveur d'abord).
 */
export const participantsDeLOnglet = (participants, onglet) => {
  const tous = Array.isArray(participants) ? participants : [];
  const reponse = /** @type {Record<string, string>} */ (REPONSE_DE_L_ONGLET)[onglet];
  return reponse ? tous.filter((participant) => participant?.response === reponse) : tous;
};

/**
 * « Il me manque des joueurs » (E-P07 bloc 4, A-P09) : seulement le RÉSERVEUR (lecture du plan,
 * `SUPPOSÉ` validé par la planche EP07 état 3), s'il manque du monde et que le créneau est à
 * venir, sur une partie qui se joue encore.
 * @param {{ counts?: { presents?: number }, places?: number, role?: string,
 *   status?: string } | null | undefined} groupe - Le groupe (`GET …/groupe`).
 * @param {{ startsAt?: string | null } | null | undefined} reservation - La réservation.
 * @param {Date} [maintenant] - L'instant de référence.
 * @returns {boolean} Vrai si la carte s'affiche.
 */
export const peutChercherDesJoueurs = (groupe, reservation, maintenant = new Date()) => {
  if (!groupe || groupe.role !== 'reserveur') return false;
  if (!PARTIE_EN_COURS.includes(String(groupe.status))) return false;
  const debut = new Date(String(reservation?.startsAt || '')).getTime();
  if (!Number.isFinite(debut) || debut <= maintenant.getTime()) return false;
  return Number(groupe.counts?.presents) < Number(groupe.places);
};

/**
 * Le message du lien (planche EP07 état 4, RG-LIEN) : « Football à 5, mardi 14/10 à 18 h, Le Five
 * de Montrivage. Réponds ici : https://foundclub.app/r/K7Q2M9 ». Le lien est celui du serveur
 * (`lien.url`), jamais fabriqué ici.
 * @param {Traduire} t - Traduction.
 * @param {{ complexe?: string | null, date?: string | null, from?: string | null,
 *   sport?: string | null, url: string }} partie - La partie.
 * @returns {string} Le message.
 */
export const messageDInvitation = (t, partie) => {
  const jour = texteJourCourt(t, String(partie?.date || ''));
  const quand = t('reserverTerrain.lien.quand', '{{jour}} à {{heure}}', {
    heure: texteHeure(partie?.from),
    jour: jour.toLocaleLowerCase(),
    ...SANS_ECHAPPEMENT,
  });
  const sport = String(partie?.sport || '').trim();
  const debut = sport
    ? `${sport}, ${quand}`
    : `${quand.charAt(0).toLocaleUpperCase()}${quand.slice(1)}`;
  return t('reserverTerrain.lien.message', '{{partie}}, {{complexe}}. Réponds ici : {{url}}', {
    complexe: String(partie?.complexe || '').trim(),
    partie: debut,
    url: String(partie?.url || ''),
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * La fidélité vue par le JOUEUR (RG-FIDELITE, RC-G10 ; E-P02 bloc 5, E-P07 bloc 5, E-P10 « MA
 * FIDÉLITÉ ») : n sur x et ce qui reste, avec la récompense du complexe — le MÊME texte que
 * l'aperçu « Ce que voit le joueur » du gérant (E-G14, `apercuDuJoueur`) ; arrivé au bout, la
 * récompense se valide sur place (l'app ne calcule aucun prix).
 * @param {Traduire} t - Traduction.
 * @param {{ count?: number, disponible?: boolean, restant?: number, reward?: string | null,
 *   threshold?: number } | null | undefined} fidelite - Ce que rend le serveur RESA-L4.
 * @returns {{ compte: number, disponible: boolean, seuil: number, texte: string } | null} L'aperçu,
 *   ou null sans programme actif.
 */
export const apercuDeLaFidelite = (t, fidelite) => {
  if (!fidelite || !Number(fidelite.threshold)) return null;
  const seuil = Number(fidelite.threshold);
  const compte = Math.min(seuil, Math.max(0, Number(fidelite.count) || 0));
  const recompense = String(fidelite.reward || '').trim();
  if (fidelite.disponible) {
    return {
      compte,
      disponible: true,
      seuil,
      texte: recompense
        ? t(
          'reserverTerrain.fidelite.disponible',
          '« {{recompense}} » t’attend : présente-toi à l’accueil.',
          { recompense, ...SANS_ECHAPPEMENT },
        )
        : t(
          'reserverTerrain.fidelite.disponibleSansRecompense',
          'Ta récompense t’attend : présente-toi à l’accueil.',
        ),
    };
  }
  // Les clefs de l'aperçu du gérant (« Ce que voit le joueur », `apercuDuJoueur`), vrai reste.
  const restant = Math.max(1, Number(fidelite.restant) || seuil - compte);
  const texte = recompense
    ? t('complexeFidelite.apercu.encore', {
      count: restant,
      defaultValue_one: 'Encore {{count}} réservation avant « {{recompense}} »',
      defaultValue_other: 'Encore {{count}} réservations avant « {{recompense}} »',
      recompense,
      ...SANS_ECHAPPEMENT,
    })
    : t('complexeFidelite.apercu.encoreSansRecompense', {
      count: restant,
      defaultValue_one: 'Encore {{count}} réservation avant ta récompense',
      defaultValue_other: 'Encore {{count}} réservations avant ta récompense',
    });
  return {
    compte, disponible: false, seuil, texte,
  };
};
