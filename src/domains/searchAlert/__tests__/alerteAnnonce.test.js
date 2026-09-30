import {
  filtresDeLAlerteAnnonce,
  libelleDeLAlerteAnnonce,
  resumeDeLAlerteAnnonce,
} from '../alerteAnnonce';
import { signatureDeLAlerte } from '../alerteEvenement';

// ALERTES-ANNONCES (30/09) — CE QU'UNE ALERTE « ANNONCES » GARDE DE RECHERCHER › RECRUTEMENT.
//
// Décision d'Adel : « je veux que les joueurs soient prévenus [des annonces], même les
// entraîneurs ». Le serveur lit d'une alerte d'annonces la ville (en TEXTE, comme la
// recherche d'annonces), le public, le sport, la catégorie et le niveau
// (`admin/.../filter-normalizer.ts`, `sanitizeRecruitmentFilters`), et il refuse une
// alerte sans ville. Ces fonctions pures décident AVANT l'appel.

describe('filtresDeLAlerteAnnonce — les filtres du recrutement deviennent ceux de l alerte', () => {
  it('SANS VILLE, pas d alerte possible : le serveur la refuserait', () => {
    expect(filtresDeLAlerteAnnonce({ sport: 'Football' }, 'player')).toBeNull();
    expect(filtresDeLAlerteAnnonce({ city: '   ' }, 'all')).toBeNull();
    expect(filtresDeLAlerteAnnonce(undefined, 'all')).toBeNull();
  });

  it('garde la ville en texte, le public, le sport, la catégorie et le niveau', () => {
    expect(filtresDeLAlerteAnnonce({
      category: ['c-u17'],
      city: ' Lyon ',
      level: ['n-1'],
      q: 'gardien',
      section: 's-1',
      sport: 'Football',
    }, 'player')).toEqual({
      audienceType: 'player',
      category: ['c-u17'],
      city: { label: 'Lyon', value: 'Lyon' },
      level: ['n-1'],
      sport: 'Football',
    });
  });

  it('« Joueur·se·s et coachs » ne garde aucun public : l alerte prend les deux', () => {
    const alerte = filtresDeLAlerteAnnonce({ city: 'Lyon' }, 'all');
    expect(alerte).toEqual({
      category: [], city: { label: 'Lyon', value: 'Lyon' }, level: [], sport: '',
    });
    expect(filtresDeLAlerteAnnonce({ city: 'Lyon' }, 'coach')?.audienceType).toBe('coach');
  });

  it('deux recherches identiques donnent la même signature (pour « Alerte créée »)', () => {
    const a = filtresDeLAlerteAnnonce({ city: 'Lyon', sport: 'Football' }, 'player');
    const b = filtresDeLAlerteAnnonce({ city: 'Lyon', sport: 'Football' }, 'player');
    const c = filtresDeLAlerteAnnonce({ city: 'Lyon', sport: 'Football' }, 'coach');
    expect(signatureDeLAlerte(a)).toBe(signatureDeLAlerte(b));
    expect(signatureDeLAlerte(a)).not.toBe(signatureDeLAlerte(c));
  });
});

describe('resumeDeLAlerteAnnonce — la ligne lue sous « Me prévenir »', () => {
  it('sport, public, ville', () => {
    const alerte = filtresDeLAlerteAnnonce({ city: 'Lyon', sport: 'Football' }, 'player');
    expect(resumeDeLAlerteAnnonce(alerte, 'Tous les sports', 'Joueur·se·s'))
      .toBe('Football · Joueur·se·s · Lyon');
  });

  it('sans sport : « Tous les sports » ; sans alerte possible : vide', () => {
    const alerte = filtresDeLAlerteAnnonce({ city: 'Lyon' }, 'all');
    expect(resumeDeLAlerteAnnonce(alerte, 'Tous les sports', '')).toBe('Tous les sports · Lyon');
    expect(resumeDeLAlerteAnnonce(null, 'Tous les sports', '')).toBe('');
  });
});

describe('libelleDeLAlerteAnnonce — le nom rangé dans « Mes alertes »', () => {
  const alerte = /** @type {any} */ (
    filtresDeLAlerteAnnonce({ city: 'Lyon', sport: 'Football' }, 'player')
  );

  it('« Annonces · Football · Lyon »', () => {
    expect(libelleDeLAlerteAnnonce(alerte, [], 'Annonces')).toBe('Annonces · Football · Lyon');
  });

  it('un nom déjà pris reçoit un numéro, comme les alertes d événements', () => {
    expect(libelleDeLAlerteAnnonce(alerte, [
      { label: 'Annonces · Football · Lyon' },
      { label: 'Annonces · Football · Lyon (2)' },
    ], 'Annonces')).toBe('Annonces · Football · Lyon (3)');
  });
});
