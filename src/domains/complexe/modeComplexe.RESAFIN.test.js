import { rouvrirSurLeComplexe } from './modeComplexe';

// RESA-FIN-APP (20/10/2026) — tournée 2 (RB-03) : après « Changer de compte », l'app ROUVRAIT le compte de Julien
// en « mode complexe » sur un complexe RETIRÉ par FoundClub (« Ce complexe a été retiré de FoundClub. »). L'espace
// du complexe remet le mode complexe à chaque ouverture (planche RB, état 4) ; il ne le fait plus pour un complexe
// retiré, et l'efface : au lancement suivant, l'app s'ouvre sur l'accueil du compte. Un complexe suspendu, lui,
// reste celui du gérant (bandeau « suspendu », « Écrire à FoundClub »).
describe('RESA-FIN-APP (5) RB — l’app ne se rouvre pas sur un complexe retiré', () => {
  it.each([
    [{ status: 'actif' }, true],
    [{ status: 'suspendu' }, true],
    [{ status: 'retire' }, false],
    [null, true], // pas encore lu : on ne touche à rien
  ])('%j ⇒ %s', (complexe, attendu) => {
    expect(rouvrirSurLeComplexe(complexe)).toBe(attendu);
  });
});
