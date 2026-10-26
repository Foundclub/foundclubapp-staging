// @ts-nocheck
/**
 * CARTECODE-PARCOURS (planche v2, partie 8) — les questions de « Compléter ma carte » :
 * seulement ce qui manque, la date EN PREMIER, puis poste, taille et poids, ville, numéro.
 */
import {
  CARD_COMPLETION_STEP as E,
  listMissingCardSteps,
} from '@/domains/playerCard/cardCompletion';

const COMPLET = {
  address: { city: 'Aix-en-Provence', postcode: '13090' },
  birthdate: '1998-03-14',
  height: '181',
  jerseyNumber: 5,
  position: 'Défenseur central',
  preferredSport: 'football',
  weight: '77',
};

describe('CARTECODE-PARCOURS — ce que le parcours demande', () => {
  it('tout manque : la date d abord, puis poste, taille et poids, ville, numéro', () => {
    expect(listMissingCardSteps({ preferredSport: 'football' }))
      .toEqual([E.BIRTHDATE, E.POSITION, E.PHYSIQUE, E.CITY, E.NUMBER]);
  });

  it('une carte remplie : aucune question', () => {
    expect(listMissingCardSteps(COMPLET)).toEqual([]);
  });

  it('un sport sans poste, ou aucun sport : l étape du poste saute', () => {
    expect(listMissingCardSteps({ ...COMPLET, position: '', preferredSport: 'tennis' }))
      .toEqual([]);
    expect(listMissingCardSteps({ ...COMPLET, position: '', preferredSport: '' })).toEqual([]);
  });

  it('la taille OU le poids manque : l étape revient ; le numéro 0 est un numéro', () => {
    expect(listMissingCardSteps({ ...COMPLET, weight: null })).toEqual([E.PHYSIQUE]);
    expect(listMissingCardSteps({ ...COMPLET, jerseyNumber: 0 })).toEqual([]);
    expect(listMissingCardSteps({ ...COMPLET, jerseyNumber: '' })).toEqual([E.NUMBER]);
  });

  it('une adresse sans ville compte comme une ville manquante', () => {
    expect(listMissingCardSteps({ ...COMPLET, address: { postcode: '13090' } })).toEqual([E.CITY]);
  });
});
