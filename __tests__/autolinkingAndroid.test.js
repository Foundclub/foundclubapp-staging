const fs = require('fs');
const path = require('path');

const rnConfig = require('../react-native.config.js');

/**
 * Garde-fou du correctif D67.
 *
 * `react-native.config.js` code EN DUR le package natif Android de
 * @react-native-community/datetimepicker, parce que l'autolinking du CLI 15 ne
 * sait pas lire `extends BaseReactPackage` en Java et rendait platforms.android
 * = null (le module n'etait alors compile nulle part, et l'app mourait sur
 * « TurboModuleRegistry.getEnforcing(...): 'RNCDatePicker' could not be found »).
 *
 * Une valeur en dur se perime en silence : ces tests la reconfrontent aux
 * sources du module a chaque execution.
 */
describe('autolinking Android — @react-native-community/datetimepicker', () => {
  const androidConfig =
    rnConfig.dependencies['@react-native-community/datetimepicker'].platforms
      .android;

  // 'import com.reactcommunity.rndatetimepicker.RNDateTimePickerPackage;'
  const importe = androidConfig.packageImportPath.match(
    /^import\s+([\w.]+)\.(\w+);$/,
  );
  const cheminClasse = () => {
    const [, paquetJava, nomClasse] = importe;
    return {
      nomClasse,
      fichier: path.join(
        androidConfig.sourceDir,
        'src/main/java',
        paquetJava.split('.').join(path.sep),
        `${nomClasse}.java`,
      ),
    };
  };

  it('pointe un dossier Android qui existe et porte un build.gradle', () => {
    expect(fs.existsSync(androidConfig.sourceDir)).toBe(true);
    expect(
      fs.existsSync(path.join(androidConfig.sourceDir, 'build.gradle')),
    ).toBe(true);
  });

  it('nomme une classe Java qui existe vraiment', () => {
    expect(importe).not.toBeNull();
    const { nomClasse, fichier } = cheminClasse();
    expect(fs.existsSync(fichier)).toBe(true);
    expect(fs.readFileSync(fichier, 'utf8')).toContain(`class ${nomClasse}`);
    expect(androidConfig.packageInstance).toBe(`new ${nomClasse}()`);
  });

  // Si celui-ci devient ROUGE, c'est une bonne nouvelle : le module a change sa
  // declaration, le CLI sait peut-etre la lire seul. Relancer
  // `npx react-native config` — si platforms.android n'est plus null sans notre
  // entree, supprimer le correctif de react-native.config.js.
  it('le module reste invisible pour le CLI, donc le correctif reste utile', () => {
    const { nomClasse, fichier } = cheminClasse();
    const declaration = fs
      .readFileSync(fichier, 'utf8')
      .match(new RegExp(`class\\s+${nomClasse}[^{]*`))[0];

    expect(declaration).toContain('extends BaseReactPackage');
    // Les deux seules formes que findPackageClassName.js sait reconnaitre.
    expect(declaration).not.toContain('implements');
    expect(declaration).not.toContain('TurboReactPackage');
  });
});
