import i18next from 'i18next';

/**
 * LES TYPES D'INSTALLATION — une seule liste, lue par le formulaire (club ET mairie)
 * et par les cartes (fiche du club, liste des installations).
 *
 * COLL1D (2026-09-29, SPEC Collectivites D28) : aux 5 types d'avant s'ajoutent les
 * 8 des mairies. La VALEUR est le contrat du serveur (admin
 * `facility/schema.json`, enumeration `type`) : les 5 d'avant restent EN TETE et a
 * l'identique — des lignes existent, un renommage les rendrait illisibles.
 * Seul le LIBELLE suit la langue (accesseur, I18N-4).
 *
 * FINITIONS-AUDIT (30/09) — les valeurs sont ecrites en NOMS DE PROPRIETE : ce sont des
 * identifiants du contrat serveur, pas du texte affiche. Ecrites en chaines, la porte
 * `francais-en-dur` les comptait comme du francais a traduire (5 lignes) ; les passer par
 * `t()` aurait envoye « Video room » au serveur. L'ordre d'insertion d'un objet est garanti
 * pour des cles non numeriques : c'est l'ordre des pastilles.
 */
/* eslint-disable perfectionist/sort-objects -- l'ordre EST l'ordre des pastilles */
const LIBELLE_PAR_VALEUR = {
  Terrain: () => i18next.t('facilityForm.types.pitch', 'Terrain'),
  Gymnase: () => i18next.t('facilityForm.types.gym', 'Gymnase'),
  'Salle vidéo': () => i18next.t('facilityForm.types.videoRoom', 'Salle vidéo'),
  Vestiaire: () => i18next.t('facilityForm.types.changingRoom', 'Vestiaire'),
  'Club House': () => i18next.t('facilityForm.types.clubHouse', 'Club House'),
  Dojo: () => i18next.t('facilityForm.types.dojo', 'Dojo'),
  "Piste d'athlétisme": () => i18next.t('facilityForm.types.athleticsTrack', 'Piste d’athlétisme'),
  'Terrain de rugby': () => i18next.t('facilityForm.types.rugbyPitch', 'Terrain de rugby'),
  Piscine: () => i18next.t('facilityForm.types.pool', 'Piscine'),
  'Court de tennis': () => i18next.t('facilityForm.types.tennisCourt', 'Court de tennis'),
  'Salle de sport': () => i18next.t('facilityForm.types.sportsHall', 'Salle de sport'),
  'Terrain multisport': () => i18next.t('facilityForm.types.multisportPitch', 'Terrain multisport'),
  Skatepark: () => i18next.t('facilityForm.types.skatepark', 'Skatepark'),
};
/* eslint-enable perfectionist/sort-objects */

/** @type {{ label: string, value: string }[]} */
export const FACILITY_TYPES = Object.keys(LIBELLE_PAR_VALEUR).map((value) => ({
  get label() {
    return LIBELLE_PAR_VALEUR[value]();
  },
  value,
}));

/**
 * Le libelle d'un type d'installation, dans la langue de l'ecran ; une valeur que
 * l'app ne connait pas (serveur plus recent) s'affiche telle quelle, '' si absente.
 * @param {string | null | undefined} value - La valeur du serveur (`facility.type`).
 * @returns {string} Le libelle.
 */
export const getFacilityTypeLabel = (value) => {
  const type = FACILITY_TYPES.find((entry) => entry.value === value);
  return type ? type.label : String(value || '').trim();
};
