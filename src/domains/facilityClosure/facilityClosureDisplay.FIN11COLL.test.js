/* eslint-disable max-len -- des phrases entieres, comparees telles quelles */
import '@/theme/strings';

import i18next from 'i18next';

import { FACILITY_TYPES, getFacilityTypeNoun } from '@/utils/facilityTypes';

import { closureBannerText } from './facilityClosureDisplay';

// 🧪 FINITIONS11-COLL (03/10/2026), point 1 — planche 25 du design HY521H1 (« P4v3-fermer-tel »
// ecrans 1 et 5) : « Fermer le gymnase ce jour-la », « Le gymnase est ferme ce jour-la ». Avant :
// « l installation » partout. Chaque type d installation porte un GENRE (le / la, ferme / fermee) ;
// un type inconnu, ou absent, garde le libelle generique. ROUGE avant le lot.

const t = (/** @type {any[]} */ ...args) => i18next.t(...args);
const UN_JOUR = {
  endDate: '2026-10-02', kind: 'closure', reason: 'travaux', startDate: '2026-10-02',
};
const VACANCES = {
  endDate: '2026-10-25', kind: 'closure', reason: 'vacances', startDate: '2026-10-17',
};

beforeEach(async () => {
  await i18next.changeLanguage('fr');
});

afterAll(async () => {
  await i18next.changeLanguage('fr');
});

describe('FINITIONS11-COLL (1) — le gymnase, pas l installation', () => {
  it('chaque type a un genre ; son nom se dit en minuscules', () => {
    expect(FACILITY_TYPES.filter((type) => !['feminin', 'masculin'].includes(type.genre))).toEqual([]);
    expect(getFacilityTypeNoun('Gymnase')).toEqual({ genre: 'masculin', nom: 'gymnase' });
    expect(getFacilityTypeNoun('Piscine')).toEqual({ genre: 'feminin', nom: 'piscine' });
    expect(getFacilityTypeNoun('Salle de sport')).toEqual({ genre: 'feminin', nom: 'salle de sport' });
    expect(getFacilityTypeNoun("Piste d'athlétisme")).toEqual({ genre: 'feminin', nom: 'piste d’athlétisme' });
    expect(getFacilityTypeNoun('Patinoire')).toBeNull();
    expect(getFacilityTypeNoun(null)).toBeNull();
  });

  it('le bandeau accorde le / la et ferme / fermee', () => {
    expect(closureBannerText(t, UN_JOUR, { facilityType: 'Gymnase' }).titre).toBe('Le gymnase est fermé ce jour-là');
    expect(closureBannerText(t, UN_JOUR, { facilityType: 'Piscine' }).titre).toBe('La piscine est fermée ce jour-là');
    expect(closureBannerText(t, UN_JOUR, { facilityType: 'Dojo', withDays: true }).titre).toBe('Le dojo est fermé le vendredi 2 octobre');
    expect(closureBannerText(t, VACANCES, { facilityType: 'Salle de sport' }).titre).toBe('La salle de sport est fermée du samedi 17 octobre au dimanche 25 octobre');
  });

  it('un type inconnu, ou absent, garde le libelle generique', () => {
    expect(closureBannerText(t, UN_JOUR, { facilityType: 'Patinoire' }).titre).toBe('L’installation est fermée ce jour-là');
    expect(closureBannerText(t, UN_JOUR).titre).toBe('L’installation est fermée ce jour-là');
    expect(closureBannerText(t, VACANCES).titre).toBe('L’installation est fermée du samedi 17 octobre au dimanche 25 octobre');
  });

  it('le dictionnaire anglais suit', async () => {
    await i18next.changeLanguage('en');
    expect(getFacilityTypeNoun('Gymnase')).toEqual({ genre: 'masculin', nom: 'sports hall' });
    expect(closureBannerText(t, UN_JOUR, { facilityType: 'Gymnase' }).titre).toBe('The sports hall is closed that day');
    expect(closureBannerText(t, UN_JOUR, { facilityType: 'Piscine', withDays: true }).titre).toBe('The swimming pool is closed on Friday 2 October');
    expect(closureBannerText(t, UN_JOUR, { facilityType: 'Patinoire' }).titre).toBe('The facility is closed that day');
  });
});
