import {
  apercuDuJoueur,
  avertissementsDuProgramme,
  corpsDuProgramme,
  ligneValidee,
  PROGRAMME_PAR_DEFAUT,
  RECOMPENSE_MAX,
  SEUIL_MAX,
  SEUIL_MIN,
} from '@/domains/complexe/fideliteDuComplexe';

// RESA-L5B-2 (20/10/2026) — E-G14 « Fidélité » (planche EG14 ; plan :933-969 ; RG-FIDELITE, Q2,
// RC-G10, RC-G11) sur le serveur RESA-L4 : `GET|PUT /complexes/:id/fidelite`, la liste blanche du
// programme (actif, x de 2 à 50, la récompense de 40 caractères au plus, qui compte).

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

describe('E-G14 — les règles pures de la fidélité', () => {
  it('les bornes du serveur : x de 2 à 50, la récompense en 40 caractères', () => {
    expect([SEUIL_MIN, SEUIL_MAX, RECOMPENSE_MAX]).toEqual([2, 50, 40]);
  });

  it('« Créer mon programme » : actif, au bout de 10, réserveur et participants', () => {
    expect(PROGRAMME_PAR_DEFAUT).toEqual({
      active: true, counts: 'participants', reward: '', threshold: 10,
    });
  });

  it('le corps de « Enregistrer » : la liste blanche, la récompense nette, 40 au plus', () => {
    expect(corpsDuProgramme({
      active: true,
      autre: 'ignoré',
      counts: 'reserveur',
      reward: '  1   partie offerte ',
      threshold: 12,
    })).toEqual({
      active: true, counts: 'reserveur', reward: '1 partie offerte', threshold: 12,
    });
    expect(corpsDuProgramme({
      active: false, counts: 'participants', reward: 'x'.repeat(60), threshold: 99,
    })).toEqual({
      active: false, counts: 'participants', reward: 'x'.repeat(40), threshold: 50,
    });
  });

  it('changer x ou « qui compte » : compteurs gardés ; couper : gardés aussi', () => {
    const enregistre = {
      active: true, counts: 'participants', reward: '1 partie offerte', threshold: 10,
    };
    expect(avertissementsDuProgramme(enregistre, { ...enregistre }))
      .toEqual({ compteursGardes: false, coupee: false });
    expect(avertissementsDuProgramme(enregistre, { ...enregistre, threshold: 8 }))
      .toEqual({ compteursGardes: true, coupee: false });
    expect(avertissementsDuProgramme(enregistre, { ...enregistre, counts: 'reserveur' }))
      .toEqual({ compteursGardes: true, coupee: false });
    expect(avertissementsDuProgramme(enregistre, { ...enregistre, active: false }))
      .toEqual({ compteursGardes: false, coupee: true });
    // Rien n'est encore enregistré : aucun compteur à garder.
    expect(avertissementsDuProgramme(null, { ...enregistre, threshold: 8 }))
      .toEqual({ compteursGardes: false, coupee: false });
  });

  it('l’aperçu du joueur (RC-G10) : à x − 2, « Encore 2 réservations avant … »', () => {
    expect(apercuDuJoueur(t, { reward: '1 partie offerte', threshold: 10 })).toEqual({
      compte: 8,
      seuil: 10,
      texte: 'Encore 2 réservations avant « 1 partie offerte »',
    });
    expect(apercuDuJoueur(t, { reward: '', threshold: 2 }).texte)
      .toBe('Encore 2 réservations avant ta récompense');
  });

  it('« Dernières validées » : « … validée le 02/10 par toi », ou par un autre gérant', () => {
    expect(ligneValidee(t, {
      joueur: { firstname: 'Julien', lastname: 'Marchal' },
      parMoi: true,
      validatedAt: '2026-10-02T15:00:00.000Z',
      validePar: 'Sofia L.',
    })).toBe('Julien M. · validée le 02/10 par toi');
    expect(ligneValidee(t, {
      joueur: { firstname: 'Mathis', lastname: 'Renaud' },
      parMoi: false,
      validatedAt: '2026-09-28T15:00:00.000Z',
      validePar: 'Sofia L.',
    })).toBe('Mathis R. · validée le 28/09 par Sofia L.');
  });
});
