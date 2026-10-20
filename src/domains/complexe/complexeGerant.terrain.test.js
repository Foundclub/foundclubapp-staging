import {
  erreursDuTerrain,
  lirePrix,
  payloadDuTerrain,
  prixEnSaisie,
} from './complexeGerant';

// RESA-L5A1 (13/10/2026) — E-G08 « La fiche d'un terrain » (planches EG08, RA3) : le prix saisi,
// les erreurs sous les champs, et ce que « Enregistrer » envoie (la liste blanche du serveur).

describe('RESA-L5A1 E-G08 — le prix indicatif saisi', () => {
  it('« 60 », « 6,50 », « 6.5 » ; vide = pas de prix ; faux = undefined', () => {
    expect(lirePrix('60')).toBe(60);
    expect(lirePrix('6,50')).toBe(6.5);
    expect(lirePrix(' 6.5 € ')).toBe(6.5);
    expect(lirePrix('')).toBeNull();
    expect(lirePrix('6,555')).toBeUndefined();
    expect(lirePrix('soixante')).toBeUndefined();
    expect(lirePrix('20000')).toBeUndefined();
  });

  it('le montant revient dans le champ : 6.5 ⇒ « 6,50 »', () => {
    expect(prixEnSaisie(6.5)).toBe('6,50');
    expect(prixEnSaisie(60)).toBe('60');
    expect(prixEnSaisie(null)).toBe('');
  });
});

describe('RESA-L5A1 E-G08 — les erreurs sous les champs', () => {
  it('nom, sport, intérieur / extérieur, prix', () => {
    expect(erreursDuTerrain({
      lieu: 'exterieur', nom: 'Terrain 1', prix: '60', sport: 'a-five',
    })).toEqual({});
    expect(erreursDuTerrain({
      lieu: null, nom: ' T ', prix: '6,555', sport: null,
    })).toEqual({
      lieu: true, nom: true, prix: true, sport: true,
    });
  });
});

describe('RESA-L5A1 E-G08 — ce que « Enregistrer » envoie', () => {
  const fiche = {
    joueurs: 10,
    lieu: 'exterieur',
    mode: 'automatique',
    nom: '  Terrain   1 ',
    photos: [{ id: 41, url: 'https://exemple.test/a.jpg' }],
    prix: '60',
    sport: 'a-five',
    telephone: '+33639981234',
    texteTelephone: 'Ce terrain ne peut être réservé que par appel au',
    unite: 'creneau',
  };

  it('la liste blanche du serveur ; le téléphone ne part pas hors du mode « téléphone »', () => {
    expect(payloadDuTerrain(fiche)).toEqual({
      basePrice: 60,
      bookingMode: 'automatique',
      capacity: 10,
      name: 'Terrain 1',
      photos: [41],
      priceUnit: 'creneau',
      setting: 'exterieur',
      sport: 'a-five',
    });
  });

  it('« téléphone seulement » : le numéro et le texte partent avec', () => {
    const corps = payloadDuTerrain({ ...fiche, mode: 'telephone', prix: '' });
    expect(corps).toEqual(expect.objectContaining({
      basePrice: null,
      bookingMode: 'telephone',
      bookingPhone: '+33639981234',
      bookingPhoneText: 'Ce terrain ne peut être réservé que par appel au',
    }));
  });
});
