import { minutesAParis } from '@/domains/complexe/complexeReservation';
import {
  etendue,
  heureDe,
  prixDuCreneau,
  texteDuree,
} from '@/domains/complexe/complexeTerrain';

// DT-2 (12/11/2026) — DUREES-TARIFS, écrans du gérant (maquette validée le 12/11, « 280-
// validée »). La règle du serveur DT-1 (`admin/src/api/facility/utils/slot-plan.ts` :
// `durationsOf`, `startsOf`, `slotPrice`, `overlapInWeek`) redite ici, sans état, pour que
// l'écran montre AVANT l'envoi ce que le serveur jugera : la semaine en bandes (ligne 09), les
// départs, les prix par durée.
// Le serveur reste juge : chaque geste passe encore par son aperçu (`dryRun`).

const JOUR = 24 * 60;
const SEMAINE = 7 * JOUR;

/**
 * @typedef {{ days: number[], durationMinutes: number, durations?: number[], from: string,
 *   starts?: string[], to: string }} Plage
 */

/**
 * Les durées d'une plage, de la plus courte à la plus longue : `durations`, sinon
 * `durationMinutes`.
 * @param {Partial<Plage> | null | undefined} plage - La plage.
 * @returns {number[]} Les durées, en minutes.
 */
export const dureesDe = (plage) => {
  const plusieurs = plage?.durations;
  const liste = Array.isArray(plusieurs) && plusieurs.length ? plusieurs : [plage?.durationMinutes];
  return [...new Set(liste.map(Number).filter((duree) => duree > 0))].sort((a, b) => a - b);
};

/**
 * Toutes les durées d'un terrain (ses plages), triées.
 * @param {{ ranges?: any[] } | null | undefined} plan - Le modèle.
 * @returns {number[]} Les durées.
 */
export const dureesDuPlan = (plan) => [...new Set((plan?.ranges || []).flatMap(dureesDe))]
  .sort((a, b) => a - b);

/**
 * Les départs d'UNE plage pour UNE durée, en minutes du jour de la plage (1440 et plus = après
 * minuit) : ceux du gérant qui laissent tenir la durée, sinon l'ouverture puis toutes les « durée »
 * (le serveur, `startsOf`).
 * @param {Partial<Plage>} plage - La plage.
 * @param {number} duree - La durée.
 * @returns {number[]} Les départs.
 */
export const departsDe = (plage, duree) => {
  const { debut, fin } = etendue(plage);
  if (debut === null || fin === null || !(duree > 0)) return [];
  if (Array.isArray(plage.starts) && plage.starts.length) {
    return plage.starts
      .map((heure) => {
        const { debut: depart } = etendue({ from: heure, to: heure });
        if (depart === null) return null;
        return depart < debut ? depart + JOUR : depart;
      })
      .filter((depart) => depart !== null && depart + duree <= fin)
      .map(Number)
      .sort((a, b) => a - b);
  }
  const departs = [];
  for (let depart = debut; depart + duree <= fin; depart += duree) departs.push(depart);
  return departs;
};

/**
 * Les départs réguliers d'une plage (« toutes les heures », « toutes les 30 min », les puces de
 * « Je choisis ») : de l'ouverture, tant que la plus courte des durées tient.
 * @param {{ from: string, to: string }} plage - Les heures de la plage.
 * @param {number} pas - L'écart entre deux départs.
 * @param {number} plusCourte - La plus courte durée.
 * @returns {string[]} Les départs « HH:MM ».
 */
export const departsReguliers = (plage, pas, plusCourte) => {
  const { debut, fin } = etendue(plage);
  if (debut === null || fin === null || fin === debut || !(pas > 0) || !(plusCourte > 0)) return [];
  const departs = [];
  for (let depart = debut; depart + plusCourte <= fin; depart += pas) {
    departs.push(heureDe(depart % JOUR));
  }
  return departs;
};

/**
 * Comment les départs d'une plage se relisent dans la feuille : « suite » (aucun départ choisi, la
 * règle d'avant), « heure », « demi » (départs réguliers), sinon « choix ».
 * @param {Partial<Plage>} plage - La plage.
 * @returns {'choix' | 'demi' | 'heure' | 'suite'} Le mode.
 */
export const modeDesDeparts = (plage) => {
  if (!Array.isArray(plage?.starts) || !plage.starts.length) return 'suite';
  const plusCourte = dureesDe(plage)[0];
  const memes = (/** @type {string[]} */ autres) => autres.length === plage.starts?.length
    && autres.every((heure, index) => heure === plage.starts?.[index]);
  const heures = { from: String(plage.from), to: String(plage.to) };
  if (memes(departsReguliers(heures, 60, plusCourte))) return 'heure';
  if (memes(departsReguliers(heures, 30, plusCourte))) return 'demi';
  return 'choix';
};

/**
 * Une heure du jour ; au-delà de minuit, celle du lendemain (1500 ⇒ « 01:00 »).
 * @param {number} minutes - Minutes, éventuellement au-delà de 24 h.
 * @returns {string} L'heure « HH:MM ».
 */
const heure = (minutes) => heureDe(minutes > JOUR ? minutes - JOUR : minutes);

/**
 * « Ce que verront les joueurs » (G2) : pour chaque durée, le nombre de créneaux, le premier et le
 * dernier ; une durée sans créneau n'y est pas.
 * @param {Partial<Plage>} plage - La plage.
 * @returns {Array<{ dernier: { a: string, de: string }, duree: number, nombre: number,
 *   premier: { a: string, de: string } }>} Les offres.
 */
export const offresDeLaPlage = (plage) => dureesDe(plage).flatMap((duree) => {
  const departs = departsDe(plage, duree);
  if (!departs.length) return [];
  const bornes = (/** @type {number} */ depart) => ({
    a: heure(depart + duree), de: heureDe(depart % JOUR),
  });
  return [{
    dernier: bornes(departs[departs.length - 1]),
    duree,
    nombre: departs.length,
    premier: bornes(departs[0]),
  }];
});

/**
 * Les morceaux d'une plage sur la semaine (minutes depuis lundi 0 h ; un dimanche après minuit
 * revient sur le lundi).
 * @param {Partial<Plage>} plage - La plage.
 * @returns {Array<[number, number, number]>} [début, fin, jour de la plage].
 */
const morceaux = (plage) => {
  const { debut, fin } = etendue(plage);
  if (debut === null || fin === null || fin === debut) return [];
  return (plage.days || []).flatMap((jour) => {
    const depart = (jour - 1) * JOUR + debut;
    const arrivee = (jour - 1) * JOUR + fin;
    if (arrivee <= SEMAINE) return [[depart, arrivee, jour]];
    return [[depart, SEMAINE, jour], [0, arrivee - SEMAINE, jour]];
  });
};

/**
 * Les deux plages se chevauchent-elles sur la semaine ? (le serveur, `overlapInWeek`)
 * @param {Partial<Plage>} une - Une plage.
 * @param {Partial<Plage>} autre - L'autre.
 * @returns {number | null} Le jour (de `autre`) où ça commence à chevaucher, ou null.
 */
const jourDuChevauchement = (une, autre) => {
  const deUne = morceaux(une);
  const trouve = morceaux(autre).find(([de, a]) => deUne.some(([d, f]) => de < f && d < a));
  return trouve ? trouve[2] : null;
};

/**
 * La première plage enregistrée que la plage en cours chevauche (G2 bis) ; la plage qu'on modifie
 * (`rangIgnore`) ne compte pas.
 * @param {Partial<Plage>[]} plages - Les plages du terrain.
 * @param {Partial<Plage>} enCours - La plage saisie.
 * @param {number | null} [rangIgnore] - Le rang de la plage modifiée.
 * @returns {{ jour: number, rang: number } | null} Le jour (de la plage en cours) et la plage.
 */
export const plageQuiChevauche = (plages, enCours, rangIgnore = null) => {
  for (let rang = 0; rang < plages.length; rang += 1) {
    if (rang !== rangIgnore) {
      const jour = jourDuChevauchement(plages[rang], enCours);
      if (jour !== null) return { jour, rang };
    }
  }
  return null;
};

/**
 * « 17:00 » ⇒ « 17 », « 17:30 » ⇒ « 17 h 30 », 1500 ⇒ « 1 » (le texte court d'une bande).
 * @param {number} minutes - Minutes, éventuellement au-delà de 24 h.
 * @returns {string} Le texte.
 */
const court = (minutes) => {
  const leJour = minutes > JOUR ? minutes - JOUR : minutes;
  const reste = leJour % 60;
  return `${Math.floor(leJour / 60)}${reste ? ` h ${String(reste).padStart(2, '0')}` : ''}`;
};

/**
 * @typedef {{ conflit: boolean, debut: number, fantome: boolean, fin: number, rang: number | null,
 *   texte: string }} Bande
 */

/**
 * LA SEMAINE EN BANDES (G1, G2, G2 bis ; ligne 09 de la recette du 12/11 : « on ne voit pas la
 * première ») : pour chaque jour, une bande par plage, sur un axe commun (8 h – 24 h, élargi aux
 * plages plus tôt ou après minuit). Pendant la saisie, la plage en cours s'ajoute en pointillé
 * (`fantome`) et une plage qu'elle chevauche ce jour-là passe en rouge (`conflit`).
 * @param {Partial<Plage>[]} plages - Les plages enregistrées.
 * @param {{ enCours?: Partial<Plage> | null, rangEnCours?: number | null }} [saisie] - La saisie.
 * @returns {{ axe: { debut: number, fin: number },
 *   jours: Array<{ bandes: Bande[], jour: number }> }} La semaine.
 */
export const bandesDeLaSemaine = (plages, { enCours = null, rangEnCours = null } = {}) => {
  const visibles = plages.map((plage, rang) => ({ plage, rang }))
    .filter(({ rang }) => rang !== rangEnCours);
  const tout = [...visibles.map(({ plage }) => plage), ...(enCours ? [enCours] : [])]
    .map((plage) => etendue(plage))
    .filter(({ debut, fin }) => debut !== null && fin !== null && fin !== debut);
  const debuts = tout.map(({ debut }) => Number(debut));
  const fins = tout.map(({ fin }) => Number(fin));
  const axe = {
    debut: Math.min(8 * 60, ...debuts.map((d) => Math.floor(d / 60) * 60)),
    fin: Math.max(JOUR, ...fins.map((f) => Math.ceil(f / 60) * 60)),
  };
  const enCoursMorceaux = enCours ? morceaux(enCours) : [];
  const jours = [1, 2, 3, 4, 5, 6, 7].map((jour) => {
    /** @type {Bande[]} */
    const bandes = [];
    visibles.forEach(({ plage, rang }) => {
      if (!(plage.days || []).includes(jour)) return;
      const { debut, fin } = /** @type {{ debut: number, fin: number }} */ (etendue(plage));
      if (debut === null || fin === null || fin === debut) return;
      const conflit = enCoursMorceaux.some(([d, f]) => morceaux({ ...plage, days: [jour] })
        .some(([de, a]) => de < f && d < a));
      bandes.push({
        conflit,
        debut,
        fantome: false,
        fin,
        rang,
        texte: `${court(debut)}–${court(fin)} · ${dureesDe(plage).map(texteDuree).join(', ')}`,
      });
    });
    if (enCours && (enCours.days || []).includes(jour)) {
      const { debut, fin } = etendue(enCours);
      if (debut !== null && fin !== null && fin !== debut) {
        bandes.push({
          conflit: false,
          debut,
          fantome: true,
          fin,
          rang: null,
          texte: `${court(debut)}–${court(fin)}`,
        });
      }
    }
    return { bandes, jour };
  });
  return { axe, jours };
};

/**
 * Le prix d'un tarif parmi certains seulement (jour et heure, puis jour) ; null sans tarif.
 * @param {any[]} tarifs - Les tarifs retenus.
 * @param {number} jour - 1 = lundi … 7 = dimanche.
 * @param {number} minutes - L'heure, en minutes (au-delà de 24 h = le lendemain).
 * @returns {number | null} Le prix.
 */
const tarifParmi = (tarifs, jour, minutes) => prixDuCreneau({ rates: tarifs }, null, jour, minutes);

/**
 * Le prix « au créneau » d'une durée, la règle du serveur (`resolvePrice` avec durée) : un tarif de
 * CETTE durée, sinon un tarif sans durée, sinon le prix de base ; jamais le tarif d'une autre
 * durée.
 * @param {any[]} tarifs - Les tarifs du terrain.
 * @param {number | null | undefined} prixDeBase - Le prix de base.
 * @param {number} jour - Le jour.
 * @param {number} minutes - L'heure.
 * @param {number} duree - La durée.
 * @returns {number | null} Le prix.
 */
const prixDeLaDuree = (tarifs, prixDeBase, jour, minutes, duree) => {
  const deLaDuree = tarifs.filter((tarif) => tarif.durationMinutes === duree);
  const propre = tarifParmi(deLaDuree, jour, minutes);
  if (propre !== null) return propre;
  const commun = tarifParmi(
    tarifs.filter((tarif) => typeof tarif.durationMinutes !== 'number'),
    jour,
    minutes,
  );
  if (commun !== null) return commun;
  return typeof prixDeBase === 'number' && Number.isFinite(prixDeBase) ? prixDeBase : null;
};

/**
 * « LES PRIX DE LA SEMAINE » POUR UNE DURÉE (G3, décision 281 A) : jours × tranches, comme la
 * grille d'avant ; un jour n'est ouvert que si sa plage propose cette durée. Sans tarif de cette
 * durée, une
 * durée plus longue que la plus courte de sa plage vaut « au temps » (2 h = 2 × le prix d'1 h, au
 * centime) : la case est `calcule`, l'écran l'écrit en italique et le gérant peut la remplacer.
 * @param {{ ranges?: any[], rates?: any[] } | null | undefined} plan - Le modèle.
 * @param {number | null | undefined} prixDeBase - Le prix de base.
 * @param {number | null} duree - La durée de l'onglet ; null = sans onglet (un terrain dont aucune
 *   plage n'a plusieurs durées) : chaque jour au prix de la durée de SA plage, la grille d'avant.
 * @returns {Array<{ a: string, cases: Array<{ calcule: boolean, prix: number | null } | null>,
 *   de: string }>} La grille.
 */
export const prixDeLaSemaineParDuree = (plan, prixDeBase, duree) => {
  const lues = plan?.ranges;
  const tarifsLus = plan?.rates;
  /** @type {any[]} */
  const plages = Array.isArray(lues) ? lues : [];
  /** @type {any[]} */
  const tarifs = Array.isArray(tarifsLus) ? tarifsLus : [];
  if (!plages.length) return [];
  const bornes = new Set();
  [...plages, ...tarifs.filter((tarif) => tarif.from !== undefined && tarif.from !== null)]
    .forEach((heures) => {
      const { debut, fin } = etendue(heures);
      bornes.add(debut);
      bornes.add(fin);
    });
  const triees = [...bornes].filter((borne) => typeof borne === 'number').sort((a, b) => a - b);
  /** @type {Array<{ a: number, cases: any[], de: number }>} */
  const lignes = [];
  for (let index = 0; index < triees.length - 1; index += 1) {
    const debut = triees[index];
    const fin = triees[index + 1];
    const cases = [1, 2, 3, 4, 5, 6, 7].map((jour) => {
      const plage = plages.find((candidate) => {
        const heures = etendue(candidate);
        return candidate.days.includes(jour)
          && (duree === null || dureesDe(candidate).includes(duree))
          && Number(heures.debut) <= debut && Number(heures.fin) >= fin;
      });
      if (!plage) return null;
      const base = dureesDe(plage)[0];
      if (duree === null || duree === base) {
        return { calcule: false, prix: prixDeLaDuree(tarifs, prixDeBase, jour, debut, base) };
      }
      const propre = tarifParmi(
        tarifs.filter((tarif) => tarif.durationMinutes === duree),
        jour,
        debut,
      );
      if (propre !== null) return { calcule: false, prix: propre };
      const unite = prixDeLaDuree(tarifs, prixDeBase, jour, debut, base);
      return {
        calcule: unite !== null,
        prix: unite === null ? null : Math.round(((unite * duree) / base) * 100) / 100,
      };
    });
    const memeCase = (/** @type {any} */ une, /** @type {any} */ autre) => (une === null
      ? autre === null
      : autre !== null && une.prix === autre.prix && une.calcule === autre.calcule);
    const precedente = lignes[lignes.length - 1];
    if (precedente && precedente.a === debut
      && precedente.cases.every((valeur, jour) => memeCase(valeur, cases[jour]))) {
      precedente.a = fin;
    } else if (cases.some((valeur) => valeur !== null)) {
      lignes.push({ a: fin, cases, de: debut });
    }
  }
  return lignes.map((ligne) => ({ ...ligne, a: heure(ligne.a), de: heure(ligne.de) }));
};

/**
 * D94 — un créneau qui porte une réservation prend ses vraies heures, quand le serveur les donne.
 * @param {any} creneau - Un créneau du planning (déjà fondu).
 * @returns {any} Le créneau, aux heures de sa réservation.
 */
const sesVraiesHeures = (creneau) => {
  const debut = new Date(creneau.reservation?.startsAt || '');
  const fin = new Date(creneau.reservation?.endsAt || '');
  if (!(fin.getTime() > debut.getTime())) return creneau;
  return {
    ...creneau,
    endsAt: fin.toISOString(),
    from: heureDe(minutesAParis(debut)),
    startsAt: debut.toISOString(),
    to: heureDe(minutesAParis(fin)),
  };
};

/**
 * G4 — LE PLANNING DU GÉRANT : le serveur rend la grille de la durée la plus courte
 * (`slotsForDay`, gestion.ts) ; une réservation de 2 h y arrive en DEUX créneaux d'1 h portant la
 * même réservation. Ils se fondent en UN bloc (du début du premier à la fin du dernier).
 * D94 (12/11) : le bloc prend les vraies heures de la réservation (`reservation.startsAt` /
 * `endsAt`, gestion.ts `reservationView`) : un 2 h décalé de la grille (17 h 30 – 19 h 30 sur des
 * créneaux d'1 h) se dessine 17 h 30 – 19 h 30. Serveur d'avant, sans ces clés : la grille.
 * @template {{ endsAt: string, reservation?: any, startsAt: string, to?: string | null }} C
 * @param {C[]} creneaux - Les créneaux d'un terrain, d'un jour, triés par début.
 * @returns {C[]} Les créneaux, une réservation = un bloc.
 */
export const fondreLesReservations = (creneaux) => creneaux.reduce((fondus, creneau) => {
  const precedent = fondus[fondus.length - 1];
  const meme = precedent?.reservation?.documentId
    && precedent.reservation.documentId === creneau.reservation?.documentId
    && precedent.endsAt === creneau.startsAt;
  if (!meme) return [...fondus, creneau];
  return [...fondus.slice(0, -1), { ...precedent, endsAt: creneau.endsAt, to: creneau.to }];
}, /** @type {C[]} */ ([])).map(sesVraiesHeures);
