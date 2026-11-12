import { nomCourt } from '@/domains/complexe/complexeReservation';
import { formatEuros } from '@/domains/complexe/complexeTerrain';
import { montantDuTerrain } from '@/domains/complexe/optionsTerrain';
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
/**
 * @typedef {{ active: boolean, counts: string, percent?: number, reward?: string,
 *   rewardType?: string, rewardUses?: number, scope?: string, threshold: number }} Programme
 */

/** « Au bout de » : de 2 à 50 réservations (`SEUIL_MIN`, `SEUIL_MAX` du serveur). */
export const SEUIL_MIN = 2;
export const SEUIL_MAX = 50;

/**
 * FIDELITE (12/11/2026, D63, maquette « 237- ok ») : trois types. « partie » et « remise »
 * s'appliquent tout seuls au prix (le serveur calcule et FIGE la remise) ; « libre » est le texte
 * d'avant, remis sur place. « Sur n parties » : de 1 à 10 (`UTILISATIONS_MAX` du serveur).
 */
export const TYPES_DE_RECOMPENSE = ['partie', 'remise', 'libre'];
export const UTILISATIONS_MAX = 10;
/**
 * Un type qui s'applique tout seul au prix.
 * @param {unknown} type - Le type.
 * @returns {boolean} « partie » ou « remise ».
 */
export const estAutomatique = (type) => type === 'partie' || type === 'remise';
/**
 * Un nombre entier ramené entre deux bornes.
 * @param {unknown} valeur - La saisie.
 * @param {number} min - Le plus petit.
 * @param {number} max - Le plus grand.
 * @param {number} defaut - Sans saisie.
 * @returns {number} Le nombre.
 */
const borne = (valeur, min, max, defaut) => (
  Math.min(max, Math.max(min, Math.round(Number(valeur) || defaut)))
);

/** La récompense : 40 caractères au plus (`RECOMPENSE_MAX` du serveur). */
export const RECOMPENSE_MAX = 40;

/** L'aperçu du joueur (RC-G10) le montre à 2 réservations de sa récompense (`BIENTOT_ECART`). */
const ECART_DE_L_APERCU = 2;

/**
 * « Créer mon programme » : actif, au bout de 10, réserveur ET participants (Q2, défaut) ;
 * FIDELITE-2 (12/11/2026, maquette 237) : « Partie offerte », 1 partie, la part du joueur.
 */
export const PROGRAMME_PAR_DEFAUT = Object.freeze({
  active: true,
  counts: 'participants',
  reward: '',
  rewardType: 'partie',
  rewardUses: 1,
  scope: 'joueur',
  threshold: 10,
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
 * @param {{ active?: boolean, counts?: string, percent?: number, reward?: string,
 *   rewardType?: string, rewardUses?: number, scope?: string, threshold?: number }} saisie - Le
 *   réglage de l'écran.
 * @returns {Programme} Le corps.
 */
export const corpsDuProgramme = (saisie) => {
  const base = {
    active: saisie?.active === true,
    counts: saisie?.counts === 'reserveur' ? 'reserveur' : 'participants',
    threshold: borne(saisie?.threshold, SEUIL_MIN, SEUIL_MAX, PROGRAMME_PAR_DEFAUT.threshold),
  };
  // FIDELITE : un type automatique n'envoie pas de texte ; « libre » (ou un réglage d'avant, sans
  // type) envoie le corps d'avant.
  if (estAutomatique(saisie?.rewardType)) {
    return {
      ...base,
      ...(saisie?.rewardType === 'remise' ? { percent: borne(saisie?.percent, 1, 100, 10) } : {}),
      rewardType: saisie?.rewardType,
      rewardUses: borne(saisie?.rewardUses, 1, UTILISATIONS_MAX, 1),
      scope: saisie?.scope === 'terrain' ? 'terrain' : 'joueur',
    };
  }
  return {
    ...base,
    reward: recompenseNette(saisie?.reward),
    ...(saisie?.rewardType === 'libre' ? { rewardType: 'libre' } : {}),
  };
};

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
 * @param {{ percent?: number, reward?: string, rewardType?: string,
 *   threshold?: number }} programme - Le réglage.
 * @returns {{ compte: number, seuil: number, texte: string }} L'aperçu.
 */
export const apercuDuJoueur = (t, programme) => {
  const seuil = corpsDuProgramme({ threshold: programme?.threshold }).threshold;
  const compte = Math.max(0, seuil - ECART_DE_L_APERCU);
  const recompense = recompenseNette(programme?.reward);
  const restant = seuil - compte;
  // FIDELITE : « Encore 2 réservations avant ta partie offerte » / « avant 20 % de réduction ».
  if (estAutomatique(programme?.rewardType)) {
    const texte = programme?.rewardType === 'remise'
      ? t('complexeFidelite.apercu.encoreRemise', {
        count: restant,
        defaultValue_one: 'Encore {{count}} réservation avant {{pourcent}} % de réduction',
        defaultValue_other: 'Encore {{count}} réservations avant {{pourcent}} % de réduction',
        pourcent: borne(/** @type {any} */ (programme)?.percent, 1, 100, 10),
      })
      : t('complexeFidelite.apercu.encorePartie', {
        count: restant,
        defaultValue_one: 'Encore {{count}} réservation avant ta partie offerte',
        defaultValue_other: 'Encore {{count}} réservations avant ta partie offerte',
      });
    return { compte, seuil, texte };
  }
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

/**
 * FIDELITE — le libellé d'un bonus ou d'une remise figée : « Partie offerte (ta part) »,
 * « Réduction de 20 % (le terrain entier) ». Rien sans bonus.
 * @param {Traduire} t - Traduction.
 * @param {{ percent?: number | null, rewardType?: string, scope?: string }
 *   | null | undefined} bonus
 *   - Le bonus (ou la remise figée de la réservation).
 * @returns {string} Le libellé.
 */
export const libelleDuBonus = (t, bonus) => {
  if (!bonus || !estAutomatique(bonus.rewardType)) return '';
  const part = bonus.scope === 'terrain'
    ? t('fidelite.bonus.terrain', 'le terrain entier')
    : t('fidelite.bonus.taPart', 'ta part');
  if (bonus.rewardType === 'remise') {
    return t('fidelite.bonus.remise', 'Réduction de {{pourcent}} % ({{part}})', {
      part, pourcent: Number(bonus.percent) || 0, ...SANS_ECHAPPEMENT,
    });
  }
  return t('fidelite.bonus.partie', 'Partie offerte ({{part}})', { part, ...SANS_ECHAPPEMENT });
};

/**
 * FIDELITE-2 — la pastille d'une réservation remisée (maquette 237, « Ma réservation, avec son
 * bonus ») : « Partie offerte · ta part », « Réduction de 20 % · le terrain entier ». Rien sans
 * remise automatique.
 * @param {Traduire} t - Traduction.
 * @param {{ percent?: number | null, rewardType?: string, scope?: string }
 *   | null | undefined} bonus - La remise figée de la réservation.
 * @returns {string} Le libellé.
 */
export const pastilleDuBonus = (t, bonus) => {
  if (!bonus || !estAutomatique(bonus.rewardType)) return '';
  const part = bonus.scope === 'terrain'
    ? t('fidelite.bonus.terrain', 'le terrain entier')
    : t('fidelite.bonus.taPart', 'ta part');
  if (bonus.rewardType === 'remise') {
    return t('fidelite.pastille.remise', 'Réduction de {{pourcent}} % · {{part}}', {
      part, pourcent: Number(bonus.percent) || 0, ...SANS_ECHAPPEMENT,
    });
  }
  return t('fidelite.pastille.partie', 'Partie offerte · {{part}}', { part, ...SANS_ECHAPPEMENT });
};

/**
 * FIDELITE — « À régler sur place » avec la remise (maquette : récapitulatif, Ma réservation,
 * fiche du gérant) : le terrain, les options (jamais remisées), la ligne « − 15 € », le total
 * d'avant (barré) et le total remisé. Sans remise en euros : null (l'écran d'avant).
 * @param {Traduire} t - Traduction.
 * @param {{ amount?: number | null, unit?: string | null } | null | undefined} prix - Le prix figé.
 * @param {number} requis - Le nombre de joueurs.
 * @param {Array<{ id: string, name: string, price: number, quantity: number }>} choisies - Les
 *   options choisies.
 * @param {{ amount?: number | null, percent?: number | null, rewardType?: string,
 *   scope?: string } | null | undefined} remise - La remise (figée, ou calculée par le serveur).
 * @returns {{ avant: string, lignes: Array<{ cle: string, libelle: string, montant: string }>,
 *   options: string, total: string } | null} Le bloc.
 */
export const reglerSurPlaceAvecRemise = (t, prix, requis, choisies, remise) => {
  const moins = Number(remise?.amount);
  if (!remise || !Number.isFinite(moins)) return null;
  const terrain = montantDuTerrain(prix, requis) || 0;
  const options = (Array.isArray(choisies) ? choisies : [])
    .filter((option) => Number(option?.quantity) > 0);
  const montants = options.map((option) => (Number(option.price) || 0) * Number(option.quantity));
  const avant = terrain + montants.reduce((somme, montant) => somme + montant, 0);
  const sommeOptions = montants.reduce((somme, montant) => somme + montant, 0);
  return {
    avant: formatEuros(avant),
    lignes: [
      {
        cle: 'terrain',
        libelle: t('complexeOptions.ligneTerrain', 'Terrain · {{nombre}} joueurs', {
          nombre: requis,
        }),
        montant: formatEuros(terrain),
      },
      ...options.map((option, rang) => ({
        cle: String(option.id),
        libelle: `${option.name} × ${option.quantity}`,
        montant: formatEuros(montants[rang]),
      })),
      { cle: 'fidelite', libelle: libelleDuBonus(t, remise), montant: `− ${formatEuros(moins)}` },
    ],
    options: formatEuros(sommeOptions),
    total: formatEuros(Math.max(0, Math.round((avant - moins) * 100) / 100)),
  };
};
