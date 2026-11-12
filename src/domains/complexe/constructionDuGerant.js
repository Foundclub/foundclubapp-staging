import { nomCourt, quand } from '@/domains/complexe/complexeReservation';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

/**
 * 🏗️ GERANT-CONSTRUCTION (11/11/2026, demande d'Adel D50) — LA RÉSERVATION « EN CONSTRUCTION »
 * VUE PAR LE GÉRANT : un groupe incomplet (une collecte, `en_collecte`) que le gérant voit, suit et
 * aide (« Écrire au client », « Partager l'annonce »). Le serveur (`gestion.ts`,
 * `lireConstructions`) envoie `construction` : `{ presents, quorum, manque, externalPlayers,
 * createdAt, collectDeadline, participants: [{ label, via, respondedAt }] }` (prénom + initiale
 * seulement).
 * Maquette validée : DESIGN-RESA-JOUEUR-1011 (gerant-accueil.png, gerant-fiche.png).
 */

/** @typedef {any} Traduire - La traduction (TFunction d'i18next). */

/**
 * « 7 sur 10 ».
 * @param {Traduire} t - Traduction.
 * @param {any} construction - Le bloc du serveur.
 * @returns {string} Le compteur.
 */
export const texteDuCompteur = (t, construction) => t(
  'complexeGerant.construction.compteur',
  '{{presents}} sur {{quorum}}',
  {
    presents: Number(construction?.presents) || 0,
    quorum: Number(construction?.quorum) || 0,
    ...SANS_ECHAPPEMENT,
  },
);

/**
 * « Ils cherchent 3 joueurs » ; rien s'il ne manque personne.
 * @param {Traduire} t - Traduction.
 * @param {any} construction - Le bloc du serveur.
 * @returns {string} Ce qui manque, ou ''.
 */
export const texteDuManque = (t, construction) => {
  const manque = Number(construction?.manque) || 0;
  if (manque <= 0) return '';
  return t('complexeGerant.construction.manque', {
    count: manque,
    defaultValue_one: 'Ils cherchent {{count}} joueur',
    defaultValue_other: 'Ils cherchent {{count}} joueurs',
    ...SANS_ECHAPPEMENT,
  });
};

/**
 * La part de la jauge, de 0 à 1.
 * @param {any} construction - Le bloc du serveur.
 * @returns {number} La part remplie.
 */
export const partDeLaJauge = (construction) => {
  const quorum = Number(construction?.quorum) || 0;
  if (quorum <= 0) return 0;
  return Math.min(1, Math.max(0, (Number(construction?.presents) || 0) / quorum));
};

/**
 * « par l'annonce », « par le lien », « avec l'équipe ».
 * @param {Traduire} t - Traduction.
 * @param {unknown} via - Par où il est entré.
 * @returns {string} Le chemin, ou ''.
 */
const parOu = (t, via) => {
  switch (via) {
    case 'annonce':
      return t('complexeGerant.construction.parAnnonce', 'par l’annonce');
    case 'equipe':
      return t('complexeGerant.construction.parEquipe', 'avec l’équipe');
    case 'lien':
      return t('complexeGerant.construction.parLien', 'par le lien');
    default:
      return '';
  }
};

/**
 * L'ÉVOLUTION de la fiche (maquette « Évolution »), la plus récente d'abord : qui vient et par où,
 * les joueurs trouvés hors de l'app (sans heure : le serveur ne garde que leur nombre), puis la
 * création.
 * ponytail: ni « Tu as partagé l'annonce dans ton canal » ni le compteur « 7/10 » de chaque ligne
 * (le serveur ne garde pas ces instants) ; sortie : un journal de la construction côté serveur.
 * @param {Traduire} t - Traduction.
 * @param {any} reservation - La fiche (`construction`, `booker`).
 * @returns {Array<{ cle: string, detail: string, titre: string }>} Les lignes.
 */
export const evolutionDeLaConstruction = (t, reservation) => {
  const construction = reservation?.construction;
  if (!construction) return [];
  const participants = (Array.isArray(construction.participants) ? construction.participants : [])
    .slice()
    .sort((/** @type {any} */ a, /** @type {any} */ b) => (
      String(b?.respondedAt || '').localeCompare(String(a?.respondedAt || ''))
    ))
    .map((/** @type {any} */ participant, /** @type {number} */ rang) => ({
      cle: `p-${rang}`,
      detail: [parOu(t, participant?.via), quand(participant?.respondedAt)]
        .filter(Boolean).join(' · '),
      titre: t('complexeGerant.construction.vient', '{{nom}} vient', {
        nom: String(participant?.label || ''),
        ...SANS_ECHAPPEMENT,
      }),
    }));
  const trouves = Number(construction.externalPlayers) || 0;
  const horsApp = trouves > 0 ? [{
    cle: 'hors-app',
    detail: '',
    titre: t('complexeGerant.construction.trouves', {
      count: trouves,
      defaultValue_one: '{{count}} joueur trouvé hors de l’app',
      defaultValue_other: '{{count}} joueurs trouvés hors de l’app',
      ...SANS_ECHAPPEMENT,
    }),
  }] : [];
  const par = nomCourt(reservation?.booker);
  const creation = {
    cle: 'creation',
    detail: [
      par
        ? t('complexeGerant.construction.par', 'par {{nom}}', { nom: par, ...SANS_ECHAPPEMENT })
        : '',
      quand(construction.createdAt),
    ].filter(Boolean).join(' · '),
    titre: t('complexeGerant.construction.creee', 'Réservation créée en construction'),
  };
  return [...participants, ...horsApp, creation];
};
