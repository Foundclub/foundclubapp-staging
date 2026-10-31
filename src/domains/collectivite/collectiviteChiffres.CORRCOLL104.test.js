import { phraseDemandes } from './collectiviteChiffres';

// CORR-COLLECTIVITES 104 (31/10/2026, décision d'Adel A) — « 2 reçues · 0 acceptée · 1 refusée » ne
// s'additionnait pas : une demande acceptée puis annulée par le club (serveur : `sansSuite`) et une
// demande restée sans réponse (serveur : `expirees`) se disent aussi.
const t = (/** @type {string} */ _cle, /** @type {any} */ repli, /** @type {any} */ autres) => {
  const options = typeof repli === 'object' && repli ? repli : (autres || {});
  let texte = typeof repli === 'string' ? repli : '';
  if (typeof options.count === 'number') {
    texte = options[`defaultValue_${options.count <= 1 ? 'one' : 'other'}`];
  }
  return texte.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(options?.[nom] ?? ''));
};

describe('CORR-COLLECTIVITES 104 — les chiffres des demandes s’additionnent', () => {
  it('une demande annulée par le club se compte', () => {
    expect(phraseDemandes(t, { acceptees: 0, enAttente: 0, recues: 2, refusees: 1, sansSuite: 1 }))
      .toBe('2 reçues · 0 acceptée · 1 refusée · 1 annulée par le club');
  });

  it('une demande expirée sans réponse se compte', () => {
    expect(phraseDemandes(t, { acceptees: 1, enAttente: 0, expirees: 2, recues: 3, refusees: 0, sansSuite: 0 }))
      .toBe('3 reçues · 1 acceptée · 0 refusée · 2 expirées sans réponse');
  });

  it('rien d’annulé ni d’expiré : la phrase d’avant', () => {
    expect(phraseDemandes(t, { acceptees: 1, enAttente: 1, recues: 3, refusees: 1, sansSuite: 0 }))
      .toBe('3 reçues · 1 acceptée · 1 refusée · 1 en attente');
  });
});
