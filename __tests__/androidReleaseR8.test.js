const fs = require('fs');
const path = require('path');

/**
 * Garde-fou du lot ANDROID-R8 (2026-09-26).
 *
 * Google Play a signale sur la 2.6.65 : « L'optimisation du code DEX est
 * inferieure a notre seuil — Obscurcissement (4 %) », a corriger avant
 * fevrier 2027, et « Aucun fichier de desobscurcissement n'est associe a cet
 * App Bundle ». Les deux causes etaient dans la configuration, pas dans le code :
 *  - R8 eteint en release (enableProguardInReleaseBuilds = false) ;
 *  - des -keep qui gardaient en clair des paquets entiers de Google.
 *
 * Aucune porte ne voit ces fichiers : un retour en arriere passerait vert
 * partout et ne se verrait que dans la Play Console, des semaines plus tard.
 */
const racine = path.join(__dirname, '..');
const lire = (relatif) => fs.readFileSync(path.join(racine, relatif), 'utf8').replace(/\r\n/g, '\n');

describe('release Android — R8 compacte et obscurcit', () => {
  const gradle = lire('android/app/build.gradle');
  const blocRelease = () => {
    const debut = gradle.indexOf('buildTypes {');
    const release = gradle.indexOf('release {', debut);
    return gradle.slice(release, gradle.indexOf('}', release));
  };

  it('R8 est allume pour la release', () => {
    expect(gradle).toMatch(/^def enableProguardInReleaseBuilds = true$/m);
    expect(blocRelease()).toMatch(/minifyEnabled enableProguardInReleaseBuilds/);
  });

  it('les ressources inutilisees sont retirees avec le code', () => {
    expect(blocRelease()).toMatch(/shrinkResources enableProguardInReleaseBuilds/);
  });

  it('aucune regle ne garde en clair un paquet entier de Google', () => {
    // Chaque bibliotheque Google apporte deja ses propres regles. Un
    // « -keep class com.google.xxx.** { *; } » empeche R8 de renommer tout le
    // paquet et fait redescendre le score d'obscurcissement de Play.
    const regles = lire('android/app/proguard-rules.pro')
      .split('\n')
      .filter((ligne) => !ligne.trim().startsWith('#'));
    const larges = regles.filter((ligne) => /-keep\s+class\s+com\.google\.[\w.]*\*\*/.test(ligne));
    expect(larges).toEqual([]);
  });
});

describe('workflow Play — le fichier de correspondance part avec l AAB', () => {
  const workflow = lire('.github/workflows/android-play-release.yml');

  it('construit la variante productionRelease', () => {
    expect(workflow).toMatch(/gradlew bundleProductionRelease/);
  });

  it('joint le mapping.txt de CETTE variante a l envoi Google Play', () => {
    const envoi = workflow.slice(
      workflow.indexOf('uses: r0adkll/upload-google-play'),
    );
    expect(envoi).toMatch(
      /mappingFile: android\/app\/build\/outputs\/mapping\/productionRelease\/mapping\.txt/,
    );
  });

  it('refuse de partir sans fichier de correspondance', () => {
    expect(workflow).toMatch(
      /test -s android\/app\/build\/outputs\/mapping\/productionRelease\/mapping\.txt/,
    );
  });
});
