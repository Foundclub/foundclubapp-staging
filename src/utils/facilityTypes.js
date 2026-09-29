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
 * @type {{ label: string, value: string }[]}
 */
export const FACILITY_TYPES = [
  {
    get label() {
      return i18next.t('facilityForm.types.pitch', 'Terrain');
    },
    value: 'Terrain',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.gym', 'Gymnase');
    },
    value: 'Gymnase',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.videoRoom', 'Salle vidéo');
    },
    value: 'Salle vidéo',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.changingRoom', 'Vestiaire');
    },
    value: 'Vestiaire',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.clubHouse', 'Club House');
    },
    value: 'Club House',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.dojo', 'Dojo');
    },
    value: 'Dojo',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.athleticsTrack', 'Piste d’athlétisme');
    },
    value: "Piste d'athlétisme",
  },
  {
    get label() {
      return i18next.t('facilityForm.types.rugbyPitch', 'Terrain de rugby');
    },
    value: 'Terrain de rugby',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.pool', 'Piscine');
    },
    value: 'Piscine',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.tennisCourt', 'Court de tennis');
    },
    value: 'Court de tennis',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.sportsHall', 'Salle de sport');
    },
    value: 'Salle de sport',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.multisportPitch', 'Terrain multisport');
    },
    value: 'Terrain multisport',
  },
  {
    get label() {
      return i18next.t('facilityForm.types.skatepark', 'Skatepark');
    },
    value: 'Skatepark',
  },
];

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
