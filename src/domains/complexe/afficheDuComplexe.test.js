import {
  corpsDeLAffiche,
  encartFidelite,
  MENTION_PROMOTION,
  prixDe,
  TEXTE_NEUTRE,
  textePromotion,
} from '@/domains/complexe/afficheDuComplexe';

// RESA-L5B-2 (20/10/2026) — E-G13 « Les affiches » (planches EG13, RA7 ; plan :890-932) sur le
// serveur RESA-L4 : `POST /complexes/:id/affiche`, liste blanche { texte, promotion{ prix, texte },
// style, format, fidelite, apercu }.

const { t } = jest.requireActual('@/theme/strings/__mocks__/doublureTraduction');

describe('E-G13 — les règles pures de l’affiche du complexe', () => {
  it('les deux textes et la mention de la promotion, mot pour mot', () => {
    expect(TEXTE_NEUTRE).toBe('Scannez et ajoutez le complexe à vos favoris.');
    expect(textePromotion(5)).toBe(
      'Scannez, rejoignez le complexe dans vos favoris et bénéficiez d\'une place '
      + 'de réservation à 5 €',
    );
    expect(textePromotion(5.5)).toMatch(/à 5,50 €$/);
    expect(MENTION_PROMOTION)
      .toBe('La promotion s\'applique sur place. L\'app ne l\'encaisse pas.');
  });

  it('le prix tapé : « 5 », « 5,50 », « 5 € » ; rien d’illisible ni au-delà de 999', () => {
    expect(prixDe('5')).toBe(5);
    expect(prixDe('5,50')).toBe(5.5);
    expect(prixDe(' 7 € ')).toBe(7);
    expect(prixDe('cinq')).toBeNull();
    expect(prixDe('1000')).toBeNull();
    expect(prixDe('')).toBeNull();
  });

  it('« Neutre » : la liste blanche, sans promotion', () => {
    expect(corpsDeLAffiche({
      apercu: true, fidelite: true, format: 'post', style: 'famille', texte: 'neutre',
    })).toEqual({
      data: {
        apercu: true, fidelite: true, format: 'post', style: 'famille', texte: 'neutre',
      },
    });
  });

  it('« Promotion » : le prix seul tant que le texte est intact ; le texte s’il change', () => {
    expect(corpsDeLAffiche({
      prix: '5', style: 'ecusson', texte: 'promotion', textePromo: 'ignoré',
    }).data.promotion).toEqual({ prix: 5 });
    expect(corpsDeLAffiche({
      format: 'a4',
      prix: '5',
      texte: 'promotion',
      texteModifie: true,
      textePromo: '  Une place à 5 €   le mardi ',
    }).data).toEqual({
      apercu: false,
      fidelite: true,
      format: 'a4',
      promotion: { prix: 5, texte: 'Une place à 5 € le mardi' },
      style: 'ecusson',
      texte: 'promotion',
    });
  });

  it('l’encart « Fidélité » : lu dans le programme actif, rien sinon (A-G31)', () => {
    expect(encartFidelite(t, { active: true, reward: '1 partie offerte', threshold: 10 }))
      .toBe('Au bout de 10 réservations, 1 partie offerte');
    expect(encartFidelite(t, { active: false, reward: '1 partie offerte', threshold: 10 }))
      .toBe('');
    expect(encartFidelite(t, null)).toBe('');
  });
});
