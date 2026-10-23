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

// RESA-FIN-APP-2 (23/10/2026) — T12, décision d'Adel « 1- A » (23/10 vers 11:05, relayée par le
// chef) : une fermeture touche UN terrain (le serveur ferme terrain par terrain) ; le titre dit son
// nom, « Padel A sera fermé », plus « Le complexe sera fermé ». Sans nom connu, l'ancien titre.
describe('RESA-FIN-APP-2 (T12) — « <Terrain> sera fermé »', () => {
  it('le nom du terrain dans le titre ; sans nom, « Le complexe sera fermé »', () => {
    const fermePadel = { fermeture: 'le 25/10 (travaux)', terrain: 'Padel A' };
    expect(contenuDEchec(t, 'fermeture', fermePadel).titre).toBe('Padel A sera fermé');
    expect(contenuDEchec(t, 'fermeture', { fermeture: 'le 25/10 (travaux)' }).titre)
      .toBe('Le complexe sera fermé');
  });
});
