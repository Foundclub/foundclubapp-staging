import { cleDeSport } from '@/domains/activity/cleDeSport';

// INSCRIPTION-CODE (19/11/2026) — LA FAMILLE D'UNE ACTIVITÉ, décidée par Adel sur les planches V2
// (v2_03 « ok » : les 132 activités de la recette rangées en 6 groupes, chacune dans UN groupe ;
// source : .local/bancs/INSCRIPTION-PAR-SPORT-1911/planches-v2/src/groupes.py). Dans un groupe,
// tout est pareil : les noms de rôle, les mots, les écrans de l'inscription.
//
// ponytail: la table vit dans l'app, pas en base (aucune colonne serveur, aucun geste sur les
// données). Limite : une activité ajoutée en base sans être ajoutée ici n'a pas de famille, et
// garde les mots et le parcours d'avant (famille `null`). Sortie : la colonne « groupe » sur
// l'activité (lot 2 de la V1), quand Adel la demandera.
// Les 6 activités de culture absentes de la liste aujourd'hui (Musique, Théâtre…) sont rangées
// d'avance (V2 : « À ajouter à la liste »).

/** @typedef {'equipe' | 'raquette' | 'combat' | 'individuel' | 'nature' | 'culture'} Famille */

/** @type {Record<Famille, string[]>} */
export const ACTIVITES_PAR_FAMILLE = Object.freeze({
  combat: [
    'Judo',
    'Judo jujitsu',
    'Karaté',
    'Taekwondo',
    'Aïkido',
    'Boxe',
    'Kickboxing',
    'Savate Boxe française',
    'Lutte',
    'Escrime',
    'Arts martiaux',
    'Arts énergétiques et martiaux chinois',
    'Autres arts martiaux et sports de combat (ex: Kendo,Sambo,Grappling Wushu,Krag-Maga)',
  ],
  culture: [
    'Danse',
    "Autres activités d'expression et de forme",
    'Échecs',
    'Modélisme',
    'Musique',
    'Théâtre',
    'Arts plastiques',
    'Cirque',
    'Chant',
    'Chorale',
  ],
  equipe: [
    'Football',
    'Basketball',
    'Handball',
    'Volleyball',
    'Rugby',
    'Football à 5',
    'Futsal',
    'Rugby à XIII',
    'Football américain',
    'Baseball /Softball',
    'Hockey',
    'Hockey sur glace',
    'Roller et Rink Hockey',
    'Cheerleading',
    'Autres sports collectifs',
  ],
  individuel: [
    'Natation',
    'Nage avec palmes',
    'Natation synchronisée',
    'Plongeon',
    'Sauvetage',
    'Athlétisme',
    'Triathlon',
    'Pentathlon moderne',
    'Cyclisme',
    'Cyclisme sur route',
    'Cyclisme sur piste',
    'VTT',
    'BMX',
    'Gymnastique',
    'Gymnastique artistique / rythmique',
    'Gymnastique : disciplines acrobatiques',
    'Twirling',
    'Haltérophilie',
    'Force athlétique',
    'Culturisme',
    'Golf',
    'Tir',
    "Tir à l'arc",
    'Ball-trap',
    'Aviron',
    'Canoë-kayak',
    'Voile',
    'Planche à voile',
    'Surf',
    'Ski',
    'Ski alpin',
    'Ski nordique / biathlon',
    'Ski freestyle',
    'Snowboard',
    'Ski nautique',
    'Wakeboard / wakeskate',
    'Patinage',
    'Patinage artistique/danse sur glace',
    'Patinage de vitesse sur glace',
    'Roller de vitesse',
    'Roller artistique',
    'Roller/skate',
    'Skateboard et freestyle',
    'Équitation',
    'Sport automobile',
    'Motocyclisme',
    'Motonautisme / jet ski',
    'Pétanque',
    'Sport boules',
    'Bowling',
    'Billard',
    'Joutes',
    'Course camarguaise/Course landaise',
    'Double Dutch',
    'Autres sports de précision',
    'Autres sports de glace',
    'Autres activités de force',
    'Autres sports',
  ],
  nature: [
    'Spéléologie',
    'Randonnée',
    'Randonnée pédestre',
    'Marche nordique',
    'Longe côte',
    'Escalade',
    'Canyonisme',
    'Montagne/alpinisme',
    'Ski alpinisme',
    "Course d'orientation",
    'Cyclotourisme',
    'Plongée',
    'Apnée',
    'Pêche en apnée',
    'Pêche sportive',
    'Stand up paddle',
    'Char à voile',
    'Cerf volant',
    'Glisse aérotractée',
    'Parapente',
    'Parachutisme',
    'Vol en planeur',
    'Vol en soufflerie',
    'ULM',
    'Aéronautique',
    'Sports aériens',
    'Autres sports aériens',
    'Attelage canin',
    'Parkour',
    'Yoga',
    'Musculation/fitness',
    'Cross training',
    'Multi activités physiques ou sportives',
    'Autres activités nautiques',
    'Autres sports de nature (ex :  canyonisme,saut à ski)',
  ],
  raquette: [
    'Tennis',
    'Padel',
    'Tennis de table',
    'Badminton',
    'Squash',
    'Pelote basque',
    'Autres sports de raquettes',
  ],
});

/** Les familles « de compétition » : section, catégorie, physique, recrutement, division. */
export const FAMILLES_DE_COMPETITION = Object.freeze([
  'equipe', 'raquette', 'combat', 'individuel',
]);

const FAMILLE_PAR_CLE = new Map(
  Object.entries(ACTIVITES_PAR_FAMILLE).flatMap(([famille, noms]) => noms
    .map((nom) => [cleDeSport(nom), /** @type {Famille} */ (famille)])),
);

/**
 * La famille d'une activité, par son nom (« Volley » et « Volleyball » ont la même).
 * @param {unknown} nom Le nom de l'activité (`preferredSport`).
 * @returns {Famille | null} La famille, ou `null` pour un nom inconnu ou vide.
 */
export const familleDuSport = (nom) => FAMILLE_PAR_CLE.get(cleDeSport(nom)) || null;

/**
 * L'activité est-elle de compétition ? Un nom inconnu répond OUI : il garde le parcours d'avant.
 * @param {unknown} nom Le nom de l'activité.
 * @returns {boolean} Vrai hors loisir, nature, culture.
 */
export const estDeCompetition = (nom) => {
  const famille = familleDuSport(nom);
  return famille === null || FAMILLES_DE_COMPETITION.includes(famille);
};
