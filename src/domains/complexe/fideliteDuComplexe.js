import { nomCourt } from '@/domains/complexe/complexeReservation';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

import { getZonedDateParts } from '@/utils/parisTime';

/**
 * LA FIDÉLITÉ D'UN COMPLEXE, CÔTÉ GÉRANT — RESA-L5B-2 (20/10/2026), chantier Réservation.
 *
 * Les règles PURES de E-G14 (planche EG14 ; plan :933-969 ; RG-FIDELITE, Q2, RC-G10, RC-G11) sur le
 * serveur RESA-L4 : `GET /complexes/:id/fidelite` rend `{ programme{ active, counts, reward,
 * threshold } | null, aValider[], bientot[], dernieresValidees[] }` ; `PUT` ne lit QUE la liste
 * blanche `{ active, threshold, reward, counts }` (x de 2 à 50, la récompense de 40 caractères au
 * plus, obligatoire quand le programme est actif). Le compteur d'un joueur est CALCULÉ par le
 * serveur (jamais stocké en double) : l'app ne compte rien. Aucun prix (RC-G11).
 *
 * Témoin : `fideliteDuComplexe.test.js`.
 */

/** @typedef {any} Traduire - La traduction (le TFunction d'i18next). */
/** @typedef {{ active: boolean, counts: string, reward: string, threshold: number }} Programme */

/** « Au bout de » : de 2 à 50 réservations (`SEUIL_MIN`, `SEUIL_MAX` du serveur). */
export const SEUIL_MIN = 2;
export const SEUIL_MAX = 50;

/** La récompense : 40 caractères au plus (`RECOMPENSE_MAX` du serveur). */
export const RECOMPENSE_MAX = 40;

/** L'aperçu du joueur (RC-G10) le montre à 2 réservations de sa récompense (`BIENTOT_ECART`). */
const ECART_DE_L_APERCU = 2;

/** « Créer mon programme » : actif, au bout de 10, réserveur ET participants (Q2, défaut). */
export const PROGRAMME_PAR_DEFAUT = Object.freeze({
  active: true, counts: 'participants', reward: '', threshold: 10,
});

/**
 * La récompense nettoyée (espaces), coupée à 40 caractères.
 * @param {unknown} texte - La saisie.
 * @returns {string} La récompense.
 */
const recompenseNette = (texte) => String(texte || '').replace(/\s+/g, ' ').trim()
  .slice(0, RECOMPENSE_MAX);

/**
 * Le corps de « Enregistrer » : la liste blanche du serveur, rien d'autre (RC-T01) ; x ramené
 * entre 2 et 50.
 * @param {{ active?: boolean, counts?: string, reward?: string, threshold?: number }} saisie - Le
 *   réglage de l'écran.
 * @returns {Programme} Le corps.
 */
export const corpsDuProgramme = (saisie) => ({
  active: saisie?.active === true,
  counts: saisie?.counts === 'reserveur' ? 'reserveur' : 'participants',
  reward: recompenseNette(saisie?.reward),
  threshold: Math.min(
    SEUIL_MAX,
    Math.max(SEUIL_MIN, Math.round(Number(saisie?.threshold) || PROGRAMME_PAR_DEFAUT.threshold)),
  ),
});

/**
 * Les deux avertissements de la planche (état 3), par rapport au programme ENREGISTRÉ : changer x
 * ou « qui compte » ⇒ « Les compteurs déjà commencés sont gardés. » ; couper la fidélité ⇒ « Les
 * compteurs sont gardés si tu la rallumes. ». Rien d'enregistré : rien à garder.
 * @param {Programme | null | undefined} enregistre - Le programme du serveur.
 * @param {Programme} saisie - Le réglage de l'écran.
 * @returns {{ compteursGardes: boolean, coupee: boolean }} Les avertissements.
 */
export const avertissementsDuProgramme = (enregistre, saisie) => {
  if (!enregistre) return { compteursGardes: false, coupee: false };
  return {
    compteursGardes: Number(enregistre.threshold) !== Number(saisie?.threshold)
      || String(enregistre.counts) !== String(saisie?.counts),
    coupee: enregistre.active === true && saisie?.active !== true,
  };
};

/**
 * « Ce que voit le joueur » (RC-G10) : un joueur à 2 réservations de sa récompense — « 8/10 » et
 * « Encore 2 réservations avant « 1 partie offerte » ».
 * @param {Traduire} t - Traduction.
 * @param {{ reward?: string, threshold?: number }} programme - Le réglage.
 * @returns {{ compte: number, seuil: number, texte: string }} L'aperçu.
 */
export const apercuDuJoueur = (t, programme) => {
  const seuil = corpsDuProgramme({ threshold: programme?.threshold }).threshold;
  const compte = Math.max(0, seuil - ECART_DE_L_APERCU);
  const recompense = recompenseNette(programme?.reward);
  const restant = seuil - compte;
  const avecRecompense = {
    count: restant,
    defaultValue_one: 'Encore {{count}} réservation avant « {{recompense}} »',
    defaultValue_other: 'Encore {{count}} réservations avant « {{recompense}} »',
    recompense,
    ...SANS_ECHAPPEMENT,
  };
  const sansRecompense = {
    count: restant,
    defaultValue_one: 'Encore {{count}} réservation avant ta récompense',
    defaultValue_other: 'Encore {{count}} réservations avant ta récompense',
  };
  const texte = recompense
    ? t('complexeFidelite.apercu.encore', avecRecompense)
    : t('complexeFidelite.apercu.encoreSansRecompense', sansRecompense);
  return { compte, seuil, texte };
};

/**
 * Une ligne de « Dernières validées » : « Julien M. · validée le 02/10 par toi » (ou par l'autre
 * gérant qui l'a validée), le jour de PARIS.
 * @param {Traduire} t - Traduction.
 * @param {{ joueur?: any, parMoi?: boolean, validatedAt?: string | null,
 *   validePar?: string | null }} validee - Une validation du serveur.
 * @returns {string} La ligne.
 */
export const ligneValidee = (t, validee) => {
  const instant = new Date(String(validee?.validatedAt || ''));
  let jour = '';
  if (!Number.isNaN(instant.getTime())) {
    const parts = getZonedDateParts(instant);
    jour = `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}`;
  }
  const nom = nomCourt(validee?.joueur);
  if (validee?.parMoi) {
    return t('complexeFidelite.validees.parToi', '{{nom}} · validée le {{jour}} par toi', {
      jour, nom, ...SANS_ECHAPPEMENT,
    });
  }
  return t('complexeFidelite.validees.parAutre', '{{nom}} · validée le {{jour}} par {{par}}', {
    jour, nom, par: String(validee?.validePar || ''), ...SANS_ECHAPPEMENT,
  });
};
