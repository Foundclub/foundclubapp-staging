import { nomDuFichierAfficheSaison } from './collectiviteChiffres';

// 🏛️ COLL-AFFICHE-2 (03/10) — le nom du PDF de l'affiche de la SAISON, le même que celui du serveur
// (admin `nomFichierAfficheSaison`) : la saison va du 1er septembre au 30 juin ; juillet et août
// préparent la suivante (contrat C2A §2, `finDeSaison`).

describe('COLL-AFFICHE-2 — le nom du PDF de la saison', () => {
  it('la saison qui contient le jour, sans accent ni espace', () => {
    expect(nomDuFichierAfficheSaison('Gymnase des Tilleuls', '2026-10-03'))
      .toBe('affiche-gymnase-des-tilleuls-saison-2026-2027.pdf');
    expect(nomDuFichierAfficheSaison('Salle Émile-Zola', '2027-06-30'))
      .toBe('affiche-salle-emile-zola-saison-2026-2027.pdf');
  });

  it('juillet et août préparent la saison qui vient', () => {
    expect(nomDuFichierAfficheSaison('Dojo municipal', '2027-07-01'))
      .toBe('affiche-dojo-municipal-saison-2027-2028.pdf');
  });

  it('sans nom, l’installation', () => {
    expect(nomDuFichierAfficheSaison('', '2026-10-03')).toBe('affiche-installation-saison-2026-2027.pdf');
  });
});
