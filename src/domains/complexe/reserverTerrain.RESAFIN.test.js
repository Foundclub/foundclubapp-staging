import { contenuDEchec } from '@/domains/complexe/reserverTerrain';

// RESA-FIN-APP (20/10/2026) — tournée 2 (E-P07) : la variante d'après le retrait d'une DEMANDE. Elle ne parle
// pas d'une réservation annulée : il n'y en avait pas.
const t = (/** @type {string} */ _cle, /** @type {any} */ defaut, /** @type {any} */ valeurs) => (
  String(defaut).replace(/\{\{(\w+)\}\}/g, (_m, nom) => String(valeurs?.[nom] ?? ''))
);

describe('RESA-FIN-APP (2) — « Ta demande est retirée »', () => {
  it('le titre, le texte, « Réserver ailleurs »', () => {
    expect(contenuDEchec(t, 'demandeRetiree')).toEqual(expect.objectContaining({
      actions: ['ailleurs'],
      texte: 'Le complexe est prévenu : le créneau est de nouveau libre.',
      titre: 'Ta demande est retirée',
    }));
  });
});
