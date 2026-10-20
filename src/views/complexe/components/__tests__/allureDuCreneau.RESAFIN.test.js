import genererCouleurs from '@/theme/colors';
import { ETATS_DU_CRENEAU, styleDuCreneau } from '@/views/complexe/components/allureDuCreneau';

// RESA-FIN-APP (20/10/2026) — tournée 2, E-G02 / E-G03 : « la légende ne correspond pas aux couleurs de la
// frise » (la réservation à l'extérieur était MARRON comme « Fermé », une réservation de l'app ORANGE plein —
// couleur absente de la légende —, violet-bleu ailleurs). Cause : les cases « app » et « extérieur »
// prenaient la couleur du TERRAIN (palette du planning de la Ville, dont l'orange `#FFA115` = `warning500`,
// la couleur de « En attente » et de « Fermé »), la légende toujours le cyan. Le plan fixe la couleur par
// SOURCE (:118-119 « App primary500, Extérieur liseré neutral200 ») : la case dit l'état, la ligne (ou la
// colonne) dit le terrain. Une case et sa pastille de légende se dessinent donc à l'identique.
const Colors = genererCouleurs();
const COULEURS_DE_TERRAIN = ['#FFA115', '#4D79FF', '#9D4DFF', Colors.primary500];

describe('RESA-FIN-APP (4) — la case d’un créneau a la couleur de sa légende', () => {
  it.each(ETATS_DU_CRENEAU)('« %s » ne dépend pas de la couleur du terrain', (etat) => {
    const legende = styleDuCreneau(Colors, etat, Colors.primary500);
    COULEURS_DE_TERRAIN.forEach((couleur) => {
      expect(styleDuCreneau(Colors, etat, couleur)).toEqual(legende);
    });
  });

  it('« Réservé dans l’app » cyan, « Réservé à l’extérieur » liseré gris : jamais l’orange de « Fermé »', () => {
    const app = styleDuCreneau(Colors, 'app', '#FFA115');
    const exterieur = styleDuCreneau(Colors, 'exterieur', '#FFA115');
    const ferme = styleDuCreneau(Colors, 'ferme', '#FFA115');
    expect(app.borderColor).toBe(Colors.primary500);
    expect(exterieur.borderColor).toBe(Colors.neutral200);
    [app, exterieur].forEach((style) => {
      expect(style.borderColor).not.toBe(ferme.borderColor);
      expect(style.backgroundColor).not.toBe(ferme.backgroundColor);
    });
  });
});
