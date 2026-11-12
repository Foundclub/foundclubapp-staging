import { lirePrix } from '@/domains/complexe/complexeGerant';
import { formatEuros } from '@/domains/complexe/complexeTerrain';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * RESA-OPTIONS (12/11/2026) — LES OPTIONS D'UN TERRAIN (demande d'Adel D61, « 233- oui » ;
 * maquette RESA-JOUEUR, section 4 bis). Chasubles, ballon, arbitre… : un nom, un prix, une unité
 * (« par unité » ou « par réservation »), obligatoire ou non. Le catalogue appartient au complexe
 * (serveur `complexe.options`), chaque terrain active les siennes (`optionIds`), la réservation
 * fige le choix du joueur. Rien n'est payé dans l'app : tout se règle sur place.
 * Témoin : `__tests__/optionsTerrain.RESAOPTIONS.test.js`.
 */

/** @typedef {(cle: string, repli: string, vars?: Record<string, unknown>) => string} Traduire */
/**
 * @typedef {{ id?: string, name: string, price: number, required?: boolean, unit: string }} Option
 */
/** @typedef {Option & { quantity: number }} OptionChoisie */

export const NOM_OPTION_MIN = 2;
export const NOM_OPTION_MAX = 60;
const PRIX_OPTION_MAX = 999;
const QUANTITE_MAX = 9;

/**
 * Le prix d'une option : « 5 € par réservation », « 3 € par unité » (+ « · obligatoire »).
 * @param {Traduire} t - Traduction.
 * @param {Option} option - L'option.
 * @returns {string} La ligne sous son nom.
 */
export const texteDUneOption = (t, option) => {
  const prix = formatEuros(Number(option?.price) || 0);
  const texte = option?.unit === 'unite'
    ? t('complexeOptions.parUnite', '{{prix}} par unité', { prix, ...SANS_ECHAPPEMENT })
    : t('complexeOptions.parReservation', '{{prix}} par réservation', {
      prix, ...SANS_ECHAPPEMENT,
    });
  return option?.required
    ? `${texte} · ${t('complexeOptions.obligatoire', 'obligatoire')}`
    : texte;
};

/**
 * Les erreurs de la feuille « Nouvelle option » (les mêmes bornes que le serveur).
 * @param {{ nom?: string, prix?: string }} saisie - Ce qui est saisi.
 * @returns {{ nom?: boolean, prix?: boolean }} Les champs faux.
 */
export const erreursDOption = (saisie) => {
  const erreurs = /** @type {{ nom?: boolean, prix?: boolean }} */ ({});
  const nom = String(saisie?.nom || '').replace(/\s+/g, ' ').trim();
  if (nom.length < NOM_OPTION_MIN || nom.length > NOM_OPTION_MAX) erreurs.nom = true;
  const prix = lirePrix(saisie?.prix);
  if (prix === null || prix === undefined || prix > PRIX_OPTION_MAX) erreurs.prix = true;
  return erreurs;
};

/**
 * Le catalogue avec cette option : remplacée si elle a l'identifiant d'une option existante,
 * ajoutée à la fin sinon (le serveur pose l'identifiant d'une neuve).
 * @param {Option[]} catalogue - Le catalogue du complexe.
 * @param {Option} option - L'option créée ou modifiée.
 * @returns {Option[]} Le catalogue à envoyer ENTIER.
 */
export const catalogueAvec = (catalogue, option) => {
  const liste = Array.isArray(catalogue) ? catalogue : [];
  return option.id && liste.some((existante) => existante.id === option.id)
    ? liste.map((existante) => (existante.id === option.id ? option : existante))
    : [...liste, option];
};

/**
 * Le catalogue sans cette option (elle sort de tous les terrains ; les réservations la gardent).
 * @param {Option[]} catalogue - Le catalogue du complexe.
 * @param {string} id - L'option retirée.
 * @returns {Option[]} Le catalogue à envoyer ENTIER.
 */
export const catalogueSans = (catalogue, id) => (
  (Array.isArray(catalogue) ? catalogue : []).filter((option) => option.id !== id)
);

/**
 * Le plus petit compteur : 1 pour une option obligatoire, sinon 0.
 * @param {Option} option - L'option.
 * @returns {number} Le minimum.
 */
export const minDeLOption = (option) => (option?.required ? 1 : 0);
/**
 * Le plus grand compteur : 9 par unité, 1 par réservation (pas de stock, décision c).
 * @param {Option} option - L'option.
 * @returns {number} Le maximum.
 */
export const maxDeLOption = (option) => (option?.unit === 'unite' ? QUANTITE_MAX : 1);

/**
 * Les compteurs au départ du récapitulatif : 0, ou 1 pour une option obligatoire.
 * @param {Option[]} offertes - Les options proposées par le terrain.
 * @returns {Record<string, number>} La quantité par option.
 */
export const quantitesInitiales = (offertes) => Object.fromEntries(
  (Array.isArray(offertes) ? offertes : []).map((option) => [option.id, minDeLOption(option)]),
);

/**
 * Le choix envoyé à « Réserver » : les options à 1 ou plus.
 * @param {Option[]} offertes - Les options proposées par le terrain.
 * @param {Record<string, number>} quantites - Les compteurs.
 * @returns {Array<{ id: string, quantity: number }>} Le choix, `[]` sans option.
 */
export const choixDesOptions = (offertes, quantites) => (
  Array.isArray(offertes) ? offertes : []
).flatMap((option) => {
  const quantity = Number(quantites?.[String(option.id)]) || 0;
  return quantity > 0 ? [{ id: String(option.id), quantity }] : [];
});

/**
 * Ce que coûte le terrain au groupe : au créneau, le prix ; par joueur, le prix × le nombre
 * requis (comme « Le groupe paie… »).
 * @param {{ amount?: number | null, unit?: string | null } | null | undefined} prix - Le prix.
 * @param {number} requis - Le nombre de joueurs fixé par le complexe.
 * @returns {number | null} Le montant, ou null sans prix.
 */
export const montantDuTerrain = (prix, requis) => {
  if (!prix || prix.amount === null || prix.amount === undefined) return null;
  const montant = Number(prix.amount);
  if (!Number.isFinite(montant)) return null;
  return prix.unit === 'joueur' ? montant * (Number(requis) || 1) : montant;
};

/**
 * Le bloc « À régler sur place » : le terrain, une ligne par option choisie, le total des
 * options et le total. Sans option choisie : null (l'écran reste celui d'avant).
 * @param {Traduire} t - Traduction.
 * @param {{ amount?: number | null, unit?: string | null } | null | undefined} prix - Le prix.
 * @param {number} requis - Le nombre de joueurs.
 * @param {OptionChoisie[]} choisies - Les options choisies (quantité ≥ 1).
 * @returns {{ lignes: Array<{ cle: string, libelle: string, montant: string }>,
 *   options: string, total: string } | null} Le bloc.
 */
export const lignesAReglerSurPlace = (t, prix, requis, choisies) => {
  const options = (Array.isArray(choisies) ? choisies : [])
    .filter((option) => Number(option?.quantity) > 0);
  if (!options.length) return null;
  const terrain = montantDuTerrain(prix, requis);
  const montants = options.map((option) => (Number(option.price) || 0) * Number(option.quantity));
  const sommeOptions = montants.reduce((somme, montant) => somme + montant, 0);
  const lignes = [
    ...(terrain === null ? [] : [{
      cle: 'terrain',
      libelle: t('complexeOptions.ligneTerrain', 'Terrain · {{nombre}} joueurs', {
        nombre: requis,
      }),
      montant: formatEuros(terrain),
    }]),
    ...options.map((option, rang) => ({
      cle: String(option.id),
      libelle: `${option.name} × ${option.quantity}`,
      montant: formatEuros(montants[rang]),
    })),
  ];
  return {
    lignes,
    options: formatEuros(sommeOptions),
    total: formatEuros((terrain || 0) + sommeOptions),
  };
};
