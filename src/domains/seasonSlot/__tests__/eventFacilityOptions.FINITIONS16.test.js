import { eventFacilityOptions } from '../clubInstallations';

// FINITIONS16 · POINT 4 (T15) — LES INSTALLATIONS PROPOSEES A UNE SEANCE : une seule liste pour
// le telephone (`FacilitySelector`) et le site (`EventEdit.web.js`). La regle est celle que le
// telephone appliquait seul depuis COLL-C2C et FINITIONS13-COLL. ROUGE avant : la fonction
// n'existait pas, le site n'avait que les installations du club.

const CLUB_HOUSE = { documentId: 'club-house', name: 'Club-house' };
const STADE_OMNI = { documentId: 'stade-omni', name: 'Stade de l omnisport' };
const GYMNASE = { documentId: 'gymnase-ville', name: 'Gymnase municipal' };

describe('FINITIONS16 4 — eventFacilityOptions', () => {
  test('🔴 club, puis omnisport (partagee), puis Ville (creneau), dans cet ordre', () => {
    expect(eventFacilityOptions({
      clubFacilities: [CLUB_HOUSE],
      cmFacilities: [STADE_OMNI],
      villeFacilities: [GYMNASE],
    })).toEqual([
      CLUB_HOUSE,
      { ...STADE_OMNI, isShared: true },
      { ...GYMNASE, isVilleSlot: true },
    ]);
  });

  test('🔴 une installation deja listee ne revient pas une seconde fois', () => {
    expect(eventFacilityOptions({
      clubFacilities: [CLUB_HOUSE, GYMNASE],
      cmFacilities: [CLUB_HOUSE],
      currentFacility: GYMNASE,
      villeFacilities: [GYMNASE],
    })).toEqual([CLUB_HOUSE, GYMNASE]);
  });

  test('🔴 l installation ACTUELLE de la seance est toujours proposee, en dernier', () => {
    expect(eventFacilityOptions({ clubFacilities: [CLUB_HOUSE], currentFacility: GYMNASE }))
      .toEqual([CLUB_HOUSE, GYMNASE]);
  });

  test('🔴 des listes absentes (pas encore lues) ne cassent rien', () => {
    expect(eventFacilityOptions({
      clubFacilities: undefined, cmFacilities: null, currentFacility: null, villeFacilities: undefined,
    })).toEqual([]);
  });
});
