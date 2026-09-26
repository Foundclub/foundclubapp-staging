const fs = require('fs');
const path = require('path');

// CONVOC (demande d'Adel du 26/09) — LES DECLARATIONS SANS LESQUELLES LE CHOIX
// D'APPLI GPS NE PEUT PAS EXISTER SUR UN TELEPHONE.
//
// `Linking.canOpenURL` ne voit une appli que si l'app l'a DECLAREE :
//  · iOS : `LSApplicationQueriesSchemes` dans `Info.plist` (sinon faux, toujours) ;
//  · Android 11+ : `<queries>` dans le manifeste (sinon l'appli est invisible).
// Aucun autre temoin ne lit ces fichiers : ce controle est le seul qui dira si
// une declaration disparait. Il ne prouve PAS qu'un vrai telephone propose le
// choix — ca, seul un appareil le dit.

const racine = path.resolve(__dirname, '../../..');
const lire = (/** @type {string} */ chemin) => fs.readFileSync(path.join(racine, chemin), 'utf8');

describe('CONVOC — déclarations natives des applis GPS', () => {
  it('iOS — Info.plist déclare les schémas de Google Maps et de Waze', () => {
    const plist = lire('ios/foundclub/Info.plist');
    const bloc = plist.match(
      /<key>LSApplicationQueriesSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/,
    );

    expect(bloc).not.toBeNull();
    const schemas = [...String(bloc?.[1]).matchAll(/<string>([^<]+)<\/string>/g)]
      .map((correspondance) => correspondance[1]);
    expect(schemas).toEqual(expect.arrayContaining(['comgooglemaps', 'waze']));
  });

  it('Android — le manifeste rend visibles Google Maps, Waze et les applis `geo:`', () => {
    const manifeste = lire('android/app/src/main/AndroidManifest.xml');
    const queries = manifeste.match(/<queries>([\s\S]*?)<\/queries>/)?.[1] || '';

    expect(queries).toContain('<package android:name="com.google.android.apps.maps" />');
    expect(queries).toContain('<package android:name="com.waze" />');
    expect(queries).toMatch(/<data android:scheme="geo" \/>/);
    // Ce qui y etait avant ce lot reste la : le partage de texte.
    expect(queries).toContain('<action android:name="android.intent.action.SEND" />');
  });
});
