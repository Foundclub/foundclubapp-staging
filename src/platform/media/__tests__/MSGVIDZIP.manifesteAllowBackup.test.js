import { readFileSync } from 'fs';
import { join } from 'path';

// MSGVIDZIP (30/10) — mesuré à la construction native : `react-native-compressor` 1.19.4 tire
// `com.github.kaushik-naik:TAndroidLame`, dont le manifeste déclare android:allowBackup="true".
// Le nôtre dit "false" (aucune sauvegarde Google des données de l'app) : la fusion des
// manifestes ÉCHOUE (« Manifest merger failed : Attribute application@allowBackup »), donc
// aucune construction Android ne passe. On garde NOTRE valeur, en le disant à la fusion.
const MANIFESTE = readFileSync(
  join(__dirname, '..', '..', '..', '..', 'android/app/src/main/AndroidManifest.xml'),
  'utf8',
);
const APPLICATION = (/<application\b[^>]*>/.exec(MANIFESTE) || [''])[0];

describe('MSGVIDZIP — le manifeste garde allowBackup="false" face à TAndroidLame', () => {
  test('la sauvegarde reste coupée', () => {
    expect(APPLICATION).toContain('android:allowBackup="false"');
  });

  test('la fusion des manifestes garde notre valeur (tools:replace)', () => {
    expect(APPLICATION).toMatch(/tools:replace="[^"]*android:allowBackup[^"]*"/);
  });
});
