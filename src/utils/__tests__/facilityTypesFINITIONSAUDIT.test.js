import { readFileSync } from 'fs';
import { join } from 'path';

import '@/theme/strings';

import i18next from 'i18next';

import { FACILITY_TYPES, getFacilityTypeLabel } from '../facilityTypes';

// FINITIONS-AUDIT, point 1 (30/09) — la porte `francais-en-dur` etait ROUGE sur staging :
// `src/utils/facilityTypes.js : 0 -> 5 (lignes 31, 55, 61, 73, 79)`, arrivees avec COLL1D
// `2aba1252`. Mesure : ces 5 lignes ne sont PAS des libelles (les 13 libelles passent deja
// par `i18next.t`, cles `facilityForm.types.*` presentes en fr ET en en) — ce sont les
// VALEURS du serveur (admin `facility/schema.json`, enumeration `type`) : « Salle vidéo »,
// « Piste d'athlétisme »… Les traduire casserait le contrat (400, lignes illisibles).
//
// Ce temoin tient donc les deux bouts :
//   · CARACTERISATION (vert avant, vert apres) : les 13 valeurs du serveur, dans l ordre et
//     a l identique ; les libelles en francais ET en anglais ;
//   · ROUGE avant : la porte, appliquee a ce seul fichier, n y trouve plus aucun francais
//     hors `t()`.

const { textesFrancais } = require('../../../scripts/i18n/francais-en-dur');

const FICHIER = join(__dirname, '..', 'facilityTypes.js');

// Le contrat du serveur, recopie de admin `src/api/facility/content-types/facility/schema.json`.
const VALEURS_DU_SERVEUR = [
  'Terrain',
  'Gymnase',
  'Salle vidéo',
  'Vestiaire',
  'Club House',
  'Dojo',
  "Piste d'athlétisme",
  'Terrain de rugby',
  'Piscine',
  'Court de tennis',
  'Salle de sport',
  'Terrain multisport',
  'Skatepark',
];

afterAll(async () => {
  await i18next.changeLanguage('fr');
});

describe('FINITIONS-AUDIT (1) — les types d installation', () => {
  it('garde les 13 valeurs du serveur, dans l ordre et a l identique', () => {
    expect(FACILITY_TYPES.map((type) => type.value)).toEqual(VALEURS_DU_SERVEUR);
  });

  it('traduit les libelles, en francais puis en anglais', async () => {
    await i18next.changeLanguage('fr');
    expect(getFacilityTypeLabel('Salle vidéo')).toBe('Salle vidéo');
    expect(getFacilityTypeLabel("Piste d'athlétisme")).toBe('Piste d’athlétisme');
    expect(FACILITY_TYPES.map((type) => type.label)).toHaveLength(13);

    await i18next.changeLanguage('en');
    expect(getFacilityTypeLabel('Salle vidéo')).toBe('Video room');
    expect(getFacilityTypeLabel("Piste d'athlétisme")).toBe('Athletics track');
    expect(getFacilityTypeLabel('Court de tennis')).toBe('Tennis court');
  });

  it('rend telle quelle une valeur inconnue, et rien pour une valeur absente', () => {
    expect(getFacilityTypeLabel('Patinoire')).toBe('Patinoire');
    expect(getFacilityTypeLabel(null)).toBe('');
  });

  it('ne laisse aucun francais hors t() pour la porte francais-en-dur', () => {
    expect(textesFrancais(FICHIER, readFileSync(FICHIER, 'utf8'))).toEqual([]);
  });
});
