import {
  filtresDeLAlerte,
  libelleDeLAlerte,
  RAYON_ALERTE_PAR_DEFAUT,
  resumeDeLAlerte,
  signatureDeLAlerte,
  StatutAlerte,
} from '../alerteEvenement';

// ALERTES (audit V1, A20) — CE QU'UNE ALERTE « ÉVÉNEMENTS » GARDE DE LA RECHERCHE.
//
// Le serveur ne retient d'une alerte que la ville, le rayon, la zone, le sport, la
// catégorie, le niveau, le type et le club (`admin/.../filter-normalizer.ts:62-91`), et
// il REFUSE une alerte sans ville ou sans rayon (`filter-normalizer.ts:127-135`). Ces
// fonctions pures décident, AVANT tout appel, si les filtres affichés font une alerte.

const MONTRIVAGE = { label: 'Montrivage', value: '5.37|43.29' };
const SPORTS = [
  { documentId: 'a-foot', name: 'Football' },
  { documentId: 'a-hand', name: 'Handball' },
];

describe('filtresDeLAlerte — les filtres de la recherche deviennent ceux de l alerte', () => {
  it('SANS VILLE, pas d alerte possible : le serveur la refuserait', () => {
    expect(filtresDeLAlerte({ activity: ['a-foot'] })).toBeNull();
    expect(filtresDeLAlerte({ city: { label: '', value: '' } })).toBeNull();
    expect(filtresDeLAlerte(undefined)).toBeNull();
  });

  it('garde les critères que le serveur sait lire, en tableaux', () => {
    expect(filtresDeLAlerte({
      activity: ['a-foot'],
      category: 'c-u13',
      city: MONTRIVAGE,
      club: { label: 'OM', value: 'cl-1' },
      level: ['n-1'],
      radius: 30,
      type: ['t-match'],
    })).toEqual({
      activity: ['a-foot'],
      category: ['c-u13'],
      city: MONTRIVAGE,
      club: { label: 'OM', value: 'cl-1' },
      level: ['n-1'],
      radius: 30,
      type: ['t-match'],
    });
  });

  it('laisse de côté ce qu une alerte ne sait pas filtrer (texte, dates, équipe, carte)', () => {
    const alerte = filtresDeLAlerte({
      city: MONTRIVAGE,
      lat: 43.29,
      lon: 5.37,
      q: 'tournoi',
      radius: 20,
      startDateAfter: '2026-10-01T00:00:00.000Z',
      team: { label: 'U13 A', value: 'eq-1' },
      teamIds: ['eq-1'],
    });

    expect(Object.keys(alerte).sort()).toEqual(
      ['activity', 'category', 'city', 'level', 'radius', 'type'],
    );
  });

  it('un rayon absent prend celui des filtres par défaut (20 km)', () => {
    expect(RAYON_ALERTE_PAR_DEFAUT).toBe(20);
    expect(filtresDeLAlerte({ city: MONTRIVAGE }).radius).toBe(20);
    expect(filtresDeLAlerte({ city: MONTRIVAGE, radius: 0 }).radius).toBe(20);
  });
});

describe('resumeDeLAlerte — la ligne lue sous « Me prévenir »', () => {
  it('sport · ville · rayon, comme sur la maquette de l audit', () => {
    const alerte = filtresDeLAlerte({ activity: ['a-foot'], city: MONTRIVAGE, radius: 20 });
    expect(resumeDeLAlerte(alerte, SPORTS, 'Tous les sports'))
      .toBe('Football · Montrivage · 20 km');
  });

  it('sans sport choisi, il le DIT au lieu de le taire', () => {
    const alerte = filtresDeLAlerte({ city: MONTRIVAGE, radius: 25 });
    expect(resumeDeLAlerte(alerte, SPORTS, 'Tous les sports'))
      .toBe('Tous les sports · Montrivage · 25 km');
  });

  it('sans alerte possible, rien à résumer', () => {
    expect(resumeDeLAlerte(null, SPORTS, 'Tous les sports')).toBe('');
  });
});

describe('libelleDeLAlerte — le nom rangé dans « Mes alertes »', () => {
  it('les sports et la ville', () => {
    const alerte = filtresDeLAlerte({ activity: ['a-foot', 'a-hand'], city: MONTRIVAGE });
    expect(libelleDeLAlerte(alerte, SPORTS, [], 'Événement · Montrivage'))
      .toBe('Football, Handball · Montrivage');
  });

  it('sans sport, le gabarit de l écran d alertes (« Événement · Ville »)', () => {
    const alerte = filtresDeLAlerte({ city: MONTRIVAGE });
    expect(libelleDeLAlerte(alerte, SPORTS, [], 'Événement · Montrivage'))
      .toBe('Événement · Montrivage');
  });

  it('un nom déjà pris reçoit un numéro, comme dans l écran plein', () => {
    const alerte = filtresDeLAlerte({ activity: ['a-foot'], city: MONTRIVAGE });
    const existantes = [{ label: 'Football · Montrivage' }, { label: 'Football · Montrivage (2)' }];
    expect(libelleDeLAlerte(alerte, SPORTS, existantes, 'Événement · Montrivage'))
      .toBe('Football · Montrivage (3)');
  });
});

describe('signatureDeLAlerte — deux fois la même recherche, une seule alerte créée', () => {
  it('même filtres, même signature ; autre sport, autre signature', () => {
    const a = filtresDeLAlerte({ activity: ['a-foot'], city: MONTRIVAGE, q: 'x' });
    const b = filtresDeLAlerte({ activity: ['a-foot'], city: MONTRIVAGE, q: 'y' });
    const c = filtresDeLAlerte({ activity: ['a-hand'], city: MONTRIVAGE });
    expect(signatureDeLAlerte(a)).toBe(signatureDeLAlerte(b));
    expect(signatureDeLAlerte(a)).not.toBe(signatureDeLAlerte(c));
    expect(signatureDeLAlerte(null)).toBe('');
  });

  it('les trois issues possibles d une création sont nommées', () => {
    expect(StatutAlerte).toEqual({
      creee: 'creee',
      erreur: 'erreur',
      villeManquante: 'ville-manquante',
    });
  });
});
