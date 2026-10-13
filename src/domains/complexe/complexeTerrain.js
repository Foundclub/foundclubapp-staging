/**
 * LE TERRAIN D'UN COMPLEXE, EN MOTS — RESA-L5A1 (13/10/2026), chantier Réservation.
 *
 * Les règles PURES que les écrans du gérant partagent (planche P00 « langage visuel », RA3 « sport
 * et prix », RA4 « créneaux et tarifs », E-G07 « mes installations ») : le prix tel qu'il
 * s'affiche, les trois modes, la plage découpée en créneaux, la semaine des prix.
 *
 * Le serveur (admin `src/api/facility/utils/slot-plan.ts`, RESA-L1B) reste le SEUL juge du modèle
 * de créneaux : l'app ne fait ici que l'APERÇU immédiat (« 4 créneaux de 1 h 15 », « il reste
 * 1 h sans créneau ») et la lecture ; l'enregistrement passe par `PUT …/creneaux` qui refuse et
 * nomme ce qui ne va pas. Mêmes règles que lui, pour que l'aperçu ne dise jamais autre chose :
 * le tarif le plus précis l'emporte (jour et heure, puis jour, puis prix de base), le prix par
 * joueur s'arrondit au centime.
 *
 * Témoin : `complexeTerrain.test.js`.
 */

const NBSP = ' ';
const JOUR_MINUTES = 24 * 60;
const HEURE_RE = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const JOURS_COURTS = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'];
const JOURS_MINUSCULES = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

/** Les trois modes de réservation d'un terrain (D2, A-G15, A-G16), dans l'ordre de la fiche. */
export const MODES_DE_RESERVATION = Object.freeze(['automatique', 'manuel', 'telephone']);

/**
 * Les trois sports en tête (A-G27, RA3) : leur nom dans la liste de l'app (`GET /activities`), le
 * mot de l'écran, et le nombre de joueurs proposé (RA3 : « pré-rempli par sport »).
 * ponytail: la capacité vient d'ici, pas du serveur (aucune capacité standard sur une activité) ;
 * plafond : trois sports ; voie de sortie : un champ de l'activité si d'autres sports la demandent.
 */
const SPORTS_EN_TETE = Object.freeze([
  { capacite: 10, label: 'Foot à 5', nom: 'football à 5' },
  { capacite: 4, label: 'Padel', nom: 'padel' },
  { capacite: 4, label: 'Tennis', nom: 'tennis' },
]);

/** RA3 (SUPPOSÉ de la planche) : un sport de « + de sports » sans capacité connue part à 2. */
export const CAPACITE_PAR_DEFAUT = 2;

/**
 * Un nom de sport comparable : minuscules, espaces simples.
 * @param {unknown} nom - Le nom.
 * @returns {string} Le nom normalisé.
 */
const normaliser = (nom) => String(nom ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Des euros à la française : « 60 € », « 6,50 € » (espace insécable).
 * @param {unknown} montant - Le montant.
 * @returns {string} Le texte, ou '' si ce n'est pas un nombre.
 */
export const formatEuros = (montant) => {
  if (montant === null || montant === undefined || montant === '') return '';
  const valeur = Number(montant);
  if (!Number.isFinite(valeur)) return '';
  const texte = Number.isInteger(valeur) ? String(valeur) : valeur.toFixed(2).replace('.', ',');
  return `${texte}${NBSP}€`;
};

/**
 * La part d'un joueur, au centime (la règle du serveur, `roundCents`).
 * @param {number} montant - Le prix du créneau.
 * @param {number} joueurs - Le nombre de joueurs.
 * @returns {number} La part.
 */
const partParJoueur = (montant, joueurs) => Math.round((montant / joueurs) * 100) / 100;

/**
 * Le prix d'un terrain tel que le joueur le lit (RA3, bloc « Ce que voient les joueurs ») :
 * au créneau, « 60 € le créneau » puis « soit 6 € par joueur à 10 » ; par joueur, « 6 € par
 * joueur » puis « 24 € pour 4 joueurs ». Sans prix : null (« rien n'est inventé »).
 * @param {(cle: string, defaut: string, valeurs?: Record<string, any>) => string} t - Traduction.
 * @param {{ basePrice?: number | null, capacity?: number | null,
 *   priceUnit?: string | null }} terrain - Le prix de base, le nombre de joueurs, l'unité.
 * @returns {{ principal: string, secondaire: string | null } | null} Les deux lignes, ou null.
 */
export const lignesDePrix = (t, { basePrice, capacity, priceUnit }) => {
  if (basePrice === null || basePrice === undefined) return null;
  if (!Number.isFinite(Number(basePrice))) return null;
  const montant = Number(basePrice);
  const joueurs = Number(capacity) > 0 ? Number(capacity) : null;
  if (priceUnit === 'joueur') {
    return {
      principal: t('complexeGerant.prix.parJoueur', '{{prix}} par joueur', {
        prix: formatEuros(montant),
      }),
      secondaire: joueurs
        ? t('complexeGerant.prix.pourJoueurs', '{{prix}} pour {{joueurs}} joueurs', {
          joueurs,
          prix: formatEuros(Math.round(montant * joueurs * 100) / 100),
        })
        : null,
    };
  }
  return {
    principal: t('complexeGerant.prix.leCreneau', '{{prix}} le créneau', {
      prix: formatEuros(montant),
    }),
    secondaire: joueurs
      ? t('complexeGerant.prix.soitParJoueur', 'soit {{prix}} par joueur à {{joueurs}}', {
        joueurs,
        prix: formatEuros(partParJoueur(montant, joueurs)),
      })
      : null,
  };
};

/**
 * Le mode d'un terrain, côté gérant (P00 bloc 5).
 * @param {(cle: string, defaut: string) => string} t - Traduction.
 * @param {unknown} mode - `automatique | manuel | telephone`.
 * @returns {string} Le libellé, ou '' pour un mode inconnu.
 */
export const libelleMode = (t, mode) => {
  switch (mode) {
    case 'automatique':
      return t('complexeGerant.mode.automatique', 'Automatique');
    case 'manuel':
      return t('complexeGerant.mode.manuel', 'Validation manuelle');
    case 'telephone':
      return t('complexeGerant.mode.telephone', 'Téléphone seulement');
    default:
      return '';
  }
};

/**
 * Intérieur ou extérieur.
 * @param {(cle: string, defaut: string) => string} t - Traduction.
 * @param {unknown} lieu - `interieur | exterieur`.
 * @returns {string} Le libellé, ou ''.
 */
export const libelleLieu = (t, lieu) => {
  if (lieu === 'interieur') return t('complexeGerant.lieu.interieur', 'Intérieur');
  if (lieu === 'exterieur') return t('complexeGerant.lieu.exterieur', 'Extérieur');
  return '';
};

/**
 * Le nom d'un sport à l'écran : « Football à 5 » de l'app s'écrit « Foot à 5 » (plan §1.1).
 * @param {{ name?: string | null } | null | undefined} sport - Le sport.
 * @returns {string} Le nom affiché.
 */
export const libelleSport = (sport) => {
  const nom = String(sport?.name || '').trim();
  const enTete = SPORTS_EN_TETE.find((candidat) => candidat.nom === normaliser(nom));
  return enTete ? enTete.label : nom;
};

/**
 * La ligne d'une carte de terrain : « Foot à 5 · Extérieur · 10 joueurs » (E-G07).
 * @param {(cle: string, defaut: string, valeurs?: Record<string, any>) => string} t - Traduction.
 * @param {{ capacity?: number | null, setting?: string | null, sport?: any }} terrain - Le terrain.
 * @returns {string} La ligne.
 */
export const ligneTerrain = (t, terrain) => {
  const joueurs = Number(terrain?.capacity) > 0 ? Number(terrain?.capacity) : null;
  let texteJoueurs = '';
  if (joueurs === 1) texteJoueurs = t('complexeGerant.terrain.unJoueur', '1 joueur');
  else if (joueurs) {
    texteJoueurs = t('complexeGerant.terrain.joueurs', '{{nombre}} joueurs', { nombre: joueurs });
  }
  return [libelleSport(terrain?.sport), libelleLieu(t, terrain?.setting), texteJoueurs]
    .filter(Boolean)
    .join(' · ');
};

/**
 * Les trois sports en tête, retrouvés dans la liste de l'app par leur nom (RA3) ; un sport absent
 * de la liste ne s'invente pas.
 * @param {Array<{ documentId?: string, name?: string }> | null | undefined} activites - Les sports.
 * @returns {Array<{ capacite: number, documentId: string, label: string }>} Les puces de tête.
 */
export const sportsPopulaires = (activites) => {
  const liste = Array.isArray(activites) ? activites : [];
  return SPORTS_EN_TETE.flatMap((enTete) => {
    const trouve = liste.find((activite) => normaliser(activite?.name) === enTete.nom);
    return trouve?.documentId
      ? [{ capacite: enTete.capacite, documentId: String(trouve.documentId), label: enTete.label }]
      : [];
  });
};

/**
 * Le logo d'un complexe sans image : les initiales de ses deux premiers mots, « LF » pour « Le Five
 * de Montrivage » (planche P00, bloc 1).
 * @param {unknown} nom - Le nom du complexe.
 * @returns {string} Une ou deux lettres, ou « ? ».
 */
export const initialesDuComplexe = (nom) => {
  const mots = String(nom ?? '').trim().split(/[\s\-']+/u).filter((mot) => /\p{L}/u.test(mot));
  if (!mots.length) return '?';
  return mots.slice(0, 2).map((mot) => (mot.match(/\p{L}/u) || [''])[0].toUpperCase()).join('');
};

// ---------------------------------------------------------------------------------------------
// Heures, durées, jours
// ---------------------------------------------------------------------------------------------

/**
 * « 17:00 » (ou « 17:00:00.000 ») en minutes ; « 24:00 » = minuit (fin de plage).
 * @param {unknown} heure - L'heure.
 * @returns {number | null} Les minutes, ou null.
 */
export const minutesDe = (heure) => {
  const morceaux = HEURE_RE.exec(String(heure ?? '').trim());
  if (!morceaux) return null;
  const heures = Number(morceaux[1]);
  const minutes = Number(morceaux[2]);
  if (heures === 24 && minutes === 0) return JOUR_MINUTES;
  if (heures > 23 || minutes > 59) return null;
  return heures * 60 + minutes;
};

/**
 * 1095 minutes en « 18:15 » ; 1440 en « 24:00 ».
 * @param {number} minutes - Les minutes depuis minuit.
 * @returns {string} L'heure « HH:MM ».
 */
export const heureDe = (minutes) => {
  const heures = Math.floor(minutes / 60);
  return `${String(heures).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};

/**
 * « 17:00 » en « 17 h », « 18:15 » en « 18 h 15 » (comme le serveur, `clockText`).
 * @param {unknown} heure - L'heure « HH:MM ».
 * @returns {string} L'heure lisible, ou ''.
 */
export const texteHeure = (heure) => {
  const minutes = minutesDe(heure);
  if (minutes === null) return '';
  const reste = minutes % 60;
  return `${Math.floor(minutes / 60)} h${reste ? ` ${String(reste).padStart(2, '0')}` : ''}`;
};

/**
 * 60 en « 1 h », 75 en « 1 h 15 », 45 en « 45 min ».
 * @param {number} minutes - La durée.
 * @returns {string} La durée lisible.
 */
export const texteDuree = (minutes) => {
  const heures = Math.floor(minutes / 60);
  const reste = minutes % 60;
  if (!heures) return `${reste} min`;
  return `${heures} h${reste ? ` ${String(reste).padStart(2, '0')}` : ''}`;
};

/**
 * Des jours (1 = lundi … 7 = dimanche) comme le serveur les écrit : « Lun. au ven. »,
 * « Sam. · dim. », « Lun. · mar. · jeu. · ven. ».
 * @param {number[]} jours - Les jours, triés.
 * @returns {string} Le texte.
 */
export const joursTexte = (jours) => {
  const liste = Array.isArray(jours) ? jours : [];
  if (!liste.length) return '';
  const noms = liste.map((jour, index) => (
    index ? JOURS_COURTS[jour - 1].toLowerCase() : JOURS_COURTS[jour - 1]
  ));
  const seSuivent = liste.every((jour, index) => jour === liste[0] + index);
  if (liste.length >= 3 && seSuivent) return `${noms[0]} au ${noms[noms.length - 1]}`;
  return noms.join(' · ');
};

/**
 * Des jours en séries « lun-ven », « sam-dim », « mer » (la ligne « Ouvert : … » de E-G07).
 * @param {number[]} jours - Les jours, triés.
 * @returns {string} Le texte.
 */
const joursEnSeries = (jours) => {
  /** @type {number[][]} */
  const series = [];
  jours.forEach((jour) => {
    const derniere = series[series.length - 1];
    if (derniere && jour === derniere[derniere.length - 1] + 1) derniere.push(jour);
    else series.push([jour]);
  });
  return series.map((serie) => (serie.length === 1
    ? JOURS_MINUSCULES[serie[0] - 1]
    : `${JOURS_MINUSCULES[serie[0] - 1]}-${JOURS_MINUSCULES[serie[serie.length - 1] - 1]}`))
    .join(', ');
};

// ---------------------------------------------------------------------------------------------
// Plages, tarifs, semaine
// ---------------------------------------------------------------------------------------------

/**
 * Une plage découpée en créneaux (RA4, feuille « Nouvelle plage ») : les heures de début, leur
 * nombre, et ce qui ne rentre pas (« De 22 h à 23 h, il reste 1 h sans créneau. » : jamais coupé
 * en silence).
 * @param {{ durationMinutes: number, from: string, to: string }} plage - La plage.
 * @returns {{ debuts: string[], nombre: number,
 *   reste: { from: string, minutes: number, to: string } | null }} Le découpage.
 */
export const decoupagePlage = ({ durationMinutes, from, to }) => {
  const debut = minutesDe(from);
  const fin = minutesDe(to);
  const duree = Number(durationMinutes);
  if (debut === null || fin === null || fin <= debut || !(duree > 0)) {
    return { debuts: [], nombre: 0, reste: null };
  }
  const nombre = Math.floor((fin - debut) / duree);
  const debuts = Array.from({ length: nombre }, (_valeur, index) => heureDe(debut + index * duree));
  const minutesRestantes = (fin - debut) % duree;
  return {
    debuts,
    nombre,
    reste: minutesRestantes
      ? { from: heureDe(debut + nombre * duree), minutes: minutesRestantes, to: heureDe(fin) }
      : null,
  };
};

/**
 * Le résumé d'une plage : « 17 h – 23 h · créneaux de 1 h · 6 créneaux » (RA4, « Tes plages »).
 * @param {(cle: string, defaut: string, valeurs?: Record<string, any>) => string} t - Traduction.
 * @param {{ durationMinutes: number, from: string, to: string }} plage - La plage.
 * @returns {string} Le résumé.
 */
export const resumePlage = (t, plage) => {
  const { nombre } = decoupagePlage(plage);
  const creneaux = nombre === 1
    ? t('complexeGerant.creneaux.unCreneau', '1 créneau')
    : t('complexeGerant.creneaux.nCreneaux', '{{nombre}} créneaux', { nombre });
  return t(
    'complexeGerant.creneaux.resumePlage',
    '{{de}} – {{a}} · créneaux de {{duree}} · {{creneaux}}',
    {
      a: texteHeure(plage.to),
      creneaux,
      de: texteHeure(plage.from),
      duree: texteDuree(Number(plage.durationMinutes)),
    },
  );
};

/**
 * Les heures d'un tarif : « toute la journée » ou « de 18 h à 22 h » (RA4, « Tarifs »).
 * @param {(cle: string, defaut: string, valeurs?: Record<string, any>) => string} t - Traduction.
 * @param {{ from?: string, to?: string }} tarif - Le tarif.
 * @returns {string} Le texte.
 */
export const resumeTarif = (t, tarif) => (
  tarif?.from === undefined || tarif?.from === null
    ? t('complexeGerant.creneaux.touteLaJournee', 'toute la journée')
    : t('complexeGerant.creneaux.deA', 'de {{de}} à {{a}}', {
      a: texteHeure(tarif.to),
      de: texteHeure(tarif.from),
    })
);

/**
 * Le prix d'un créneau : le tarif le PLUS PRÉCIS qui couvre son heure de début (jour et heure,
 * puis jour, puis prix de base) ; null quand rien n'est fixé. La règle du serveur
 * (`resolvePrice`), pour que l'aperçu dise ce que le joueur lira.
 * @param {{ rates?: any[] } | null | undefined} plan - Le modèle de créneaux.
 * @param {number | null | undefined} prixDeBase - Le prix de base du terrain.
 * @param {number} jour - 1 = lundi … 7 = dimanche.
 * @param {number} minutes - L'heure de début, en minutes.
 * @returns {number | null} Le prix.
 */
export const prixDuCreneau = (plan, prixDeBase, jour, minutes) => {
  const tarifs = Array.isArray(plan?.rates) ? plan.rates : [];
  const parHeure = tarifs.find((tarif) => tarif.from !== undefined && tarif.from !== null
    && tarif.days.includes(jour)
    && minutes >= /** @type {number} */ (minutesDe(tarif.from))
    && minutes < /** @type {number} */ (minutesDe(tarif.to)));
  if (parHeure) return parHeure.price;
  const parJour = tarifs.find((tarif) => (tarif.from === undefined || tarif.from === null)
    && tarif.days.includes(jour));
  if (parJour) return parJour.price;
  return typeof prixDeBase === 'number' && Number.isFinite(prixDeBase) ? prixDeBase : null;
};

/**
 * « Les prix de la semaine » (RA4) : une ligne par tranche d'heures où rien ne change, un prix
 * (ou null, fermé) par jour. Les bornes sont celles des plages et des tarifs à heures ; deux
 * tranches voisines identiques se fondent.
 * @param {{ ranges?: any[], rates?: any[] } | null | undefined} plan - Le modèle de créneaux.
 * @param {number | null | undefined} prixDeBase - Le prix de base du terrain.
 * @returns {Array<{ a: string, de: string, prix: Array<number | null> }>} La grille.
 */
export const prixDeLaSemaine = (plan, prixDeBase) => {
  const plages = Array.isArray(plan?.ranges) ? plan.ranges : [];
  if (!plages.length) return [];
  const tarifs = Array.isArray(plan?.rates) ? plan.rates : [];
  const bornes = new Set();
  plages.forEach((plage) => {
    bornes.add(minutesDe(plage.from));
    bornes.add(minutesDe(plage.to));
  });
  tarifs.filter((tarif) => tarif.from !== undefined && tarif.from !== null).forEach((tarif) => {
    bornes.add(minutesDe(tarif.from));
    bornes.add(minutesDe(tarif.to));
  });
  const triees = [...bornes].filter((borne) => typeof borne === 'number').sort((a, b) => a - b);
  /** @type {Array<{ a: string, de: string, prix: Array<number | null> }>} */
  const lignes = [];
  for (let index = 0; index < triees.length - 1; index += 1) {
    const debut = triees[index];
    const fin = triees[index + 1];
    const prix = [1, 2, 3, 4, 5, 6, 7].map((jour) => {
      const ouvert = plages.some((plage) => plage.days.includes(jour)
        && /** @type {number} */ (minutesDe(plage.from)) <= debut
        && /** @type {number} */ (minutesDe(plage.to)) >= fin);
      return ouvert ? prixDuCreneau(plan, prixDeBase, jour, debut) : null;
    });
    const precedente = lignes[lignes.length - 1];
    if (precedente && precedente.a === heureDe(debut)
      && precedente.prix.every((valeur, jour) => valeur === prix[jour])) {
      precedente.a = heureDe(fin);
    } else if (prix.some((valeur) => valeur !== null)) {
      lignes.push({ a: heureDe(fin), de: heureDe(debut), prix });
    }
  }
  return lignes;
};

/**
 * Le jour de la semaine d'une date civile « AAAA-MM-JJ » (1 = lundi … 7 = dimanche).
 * @param {string} date - La date.
 * @returns {number} Le jour.
 */
const jourDeLaSemaine = (date) => {
  const [annee, mois, jour] = date.split('-').map(Number);
  const dimancheZero = new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay();
  return dimancheZero === 0 ? 7 : dimancheZero;
};

/**
 * Les créneaux d'UN jour civil (la frise de l'accueil, E-G02) : ceux des plages si le jour est dans
 * la période, et les créneaux ponctuels de ce jour, du premier au dernier. La règle du serveur
 * (`slotsForDay`), sans état : l'état d'un créneau (réservé, bloqué…) viendra du lot L2A.
 * @param {{ extraSlots?: any[], period?: { from: string, until: string | null } | null,
 *   ranges?: any[] } | null | undefined} plan - Le modèle de créneaux.
 * @param {string} date - « AAAA-MM-JJ ».
 * @returns {Array<{ from: string, to: string }>} Les créneaux du jour.
 */
export const creneauxDuJour = (plan, date) => {
  if (!plan) return [];
  /** @type {Array<{ debut: number, from: string, to: string }>} */
  const creneaux = [];
  const periode = plan.period;
  const dansLaPeriode = Boolean(periode)
    && date >= periode.from
    && (!periode.until || date <= periode.until);
  if (dansLaPeriode) {
    const jour = jourDeLaSemaine(date);
    (plan.ranges || []).filter((plage) => plage.days.includes(jour)).forEach((plage) => {
      const fin = /** @type {number} */ (minutesDe(plage.to));
      const duree = Number(plage.durationMinutes);
      const premier = Number(minutesDe(plage.from));
      for (let debut = premier; duree > 0 && debut + duree <= fin; debut += duree) {
        creneaux.push({ debut, from: heureDe(debut), to: heureDe(debut + duree) });
      }
    });
  }
  (plan.extraSlots || []).filter((ponctuel) => ponctuel.date === date).forEach((ponctuel) => {
    creneaux.push({
      debut: /** @type {number} */ (minutesDe(ponctuel.from)),
      from: ponctuel.from,
      to: ponctuel.to,
    });
  });
  return creneaux.sort((a, b) => a.debut - b.debut).map(({ from, to }) => ({ from, to }));
};

/**
 * La ligne « Ouvert : lun-ven 17 h – 23 h, sam-dim 9 h – 22 h » d'une carte de terrain (E-G07) :
 * les jours qui ont exactement les mêmes heures se regroupent ; deux plages un même jour
 * s'écrivent « 9 h – 12 h et 14 h – 23 h ». Aucune plage : null (« Aucun créneau ouvert »).
 * @param {(cle: string, defaut: string, valeurs?: Record<string, any>) => string} t - Traduction.
 * @param {{ ranges?: any[] } | null | undefined} plan - Le modèle de créneaux.
 * @returns {string | null} La ligne, ou null.
 */
export const resumeOuverture = (t, plan) => {
  const plages = Array.isArray(plan?.ranges) ? plan.ranges : [];
  if (!plages.length) return null;
  const heuresDuJour = [1, 2, 3, 4, 5, 6, 7].map((jour) => plages
    .filter((plage) => plage.days.includes(jour))
    .sort((a, b) => Number(minutesDe(a.from)) - Number(minutesDe(b.from)))
    .map((plage) => `${texteHeure(plage.from)} – ${texteHeure(plage.to)}`)
    .join(' et '));
  /** @type {Map<string, number[]>} */
  const groupes = new Map();
  heuresDuJour.forEach((heures, index) => {
    if (!heures) return;
    groupes.set(heures, [...(groupes.get(heures) || []), index + 1]);
  });
  const morceaux = [...groupes.entries()]
    .sort((a, b) => a[1][0] - b[1][0])
    .map(([heures, jours]) => `${joursEnSeries(jours)} ${heures}`);
  return t('complexeGerant.terrain.ouvert', 'Ouvert : {{heures}}', { heures: morceaux.join(', ') });
};
