import { readFileSync } from 'fs';
import { join } from 'path';

// 🏛️ R17-CANAUX (19/10/2026, REC17-004) — « PUBLIER UNE ACTUALITÉ » QUITTE « MESSAGES », PAS
// L'APP. Adel : « pour publier une actualité on a déjà d'autres endroits ». Le gros bouton du haut
// de « Messages » de la Ville part ; ce témoin garde les QUATRE autres places, pour qu'aucun lot
// ne retire la dernière porte sans le voir (RET-VILLE 21, 02/11, Adel « A » : la carte de « Vos
// actions » part à son tour, il en reste trois) :
//   1. les premiers pas de l'accueil, l'étape « actualite » et son bouton ;
//   2. le bloc « Actualités de la Ville » de l'accueil (`collectivite-home-actualites-publier`) ;
//   3. l'écran « Actualités » de la Ville (son témoin à l'écran : COLLC4A.actualites.test.js).
// Lecture des sources : les quatre écrans tirent chacun un graphe d'imports que ce témoin n'a pas
// à doubler ; le contrat est « la porte existe et mène au formulaire ».

const VUES = join(__dirname, '..');
const lire = (/** @type {string} */ chemin) => readFileSync(join(VUES, chemin), 'utf8');

describe('R17-CANAUX — « Publier une actualité » reste à ses trois autres places', () => {
  it('1 : l’accueil de la Ville (premiers pas), plus dans « Vos actions »', () => {
    const accueil = lire('CollectiviteHome.js');
    expect(accueil).not.toContain("case 'publishNews':");
    expect(accueil).toContain("if (cle === 'actualite') {");
    expect(accueil).toContain("bouton: t('collectiviteActualites.publier', 'Publier");
    // Le bouton d'une étape : `collectivite-home-pas-<clé>-bouton` (sans gabarit dans la chaîne).
    expect(accueil).toContain(['collectivite-home-pas-$', '{etape.key}-bouton'].join(''));
  });

  it('2 : le bloc « Actualités de la Ville » de l’accueil', () => {
    const bloc = lire(join('components', 'ActualitesDeLaVille.js'));
    expect(bloc).toContain('testID="collectivite-home-actualites-publier"');
    expect(bloc).toContain('RouteNames.CollectiviteActualiteForm');
  });

  it('3 : l’écran « Actualités » de la Ville', () => {
    const ecran = lire('CollectiviteActualites.js');
    expect(ecran).toContain('testID="collectivite-actualites-publier"');
    expect(ecran).toContain('navigation.navigate(RouteNames.CollectiviteActualiteForm');
  });

  it('et plus dans « Messages » de la Ville', () => {
    const canaux = lire(join('components', 'CanauxDeLaVille.js'));
    expect(canaux).not.toContain('canaux-publier');
    expect(canaux).not.toContain('CollectiviteActualiteForm');
  });
});
