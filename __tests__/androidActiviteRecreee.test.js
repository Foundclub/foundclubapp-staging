const fs = require('fs');
const path = require('path');

/**
 * Garde-fou du lot ANDROIDBAR-0 (2026-10-13).
 *
 * Reproduit a l'emulateur (API 36, 13/10 04:57) : basculer la navigation
 * gestes <-> 3 boutons, app ouverte, fait PLANTER l'app. Android recree
 * l'activite en lui rendant son etat sauvegarde ; react-native-screens refuse
 * de restaurer ses fragments (« Screen fragments should never be restored »)
 * et le processus meurt. Meme chemin quand Android a tue l'app en arriere-plan
 * et que l'utilisateur y revient.
 *
 * La regle vient du README de react-native-screens (section Installation >
 * Android) : l'activite principale doit surcharger onCreate et appeler
 * super.onCreate(null) pour jeter l'etat persiste.
 *
 * Temoin de TEXTE : c'est le seul controle possible sans construction native.
 * Il ne prouve pas que l'app ne plante plus ; il empeche que la surcharge
 * disparaisse sans que personne le voie.
 */
const racine = path.join(__dirname, '..');
const sources = path.join(racine, 'android/app/src');
const lire = (fichier) => fs.readFileSync(fichier, 'utf8').replace(/\r\n/g, '\n');
const sansCommentaires = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const fichiersNatifs = (dossier) => {
  const entrees = fs.readdirSync(dossier, { withFileTypes: true });
  return entrees.flatMap((entree) => {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      return fichiersNatifs(chemin);
    }
    return /\.(kt|java)$/.test(entree.name) ? [chemin] : [];
  });
};

// Toute activite React Native de l'app, quelle que soit la variante (main, debug...).
const activitesReact = fichiersNatifs(sources)
  .map((fichier) => ({
    code: sansCommentaires(lire(fichier)),
    fichier: path.relative(racine, fichier).replace(/\\/g, '/'),
  }))
  .filter(({ code }) => /:\s*ReactActivity\s*\(\s*\)|extends\s+ReactActivity\b/.test(code));

describe('Android — une activite recreee ne restaure pas les ecrans (react-native-screens)', () => {
  it('l app a bien son activite React Native principale', () => {
    expect(activitesReact.map(({ fichier }) => fichier)).toContain(
      'android/app/src/main/java/com/foundclub/MainActivity.kt',
    );
  });

  it.each(activitesReact.map(({ code, fichier }) => [fichier, code]))(
    '%s jette l etat sauvegarde : super.onCreate(null)',
    (_fichier, code) => {
      expect(code).toMatch(/^import android\.os\.Bundle$/m);
      expect(code).toMatch(
        /override fun onCreate\(\s*savedInstanceState:\s*Bundle\?\s*\)\s*\{\s*super\.onCreate\(\s*null\s*\)/,
      );
      // L'etat ne doit etre rendu a la classe parente nulle part.
      expect(code).not.toMatch(/super\.onCreate\(\s*savedInstanceState\s*\)/);
    },
  );
});
