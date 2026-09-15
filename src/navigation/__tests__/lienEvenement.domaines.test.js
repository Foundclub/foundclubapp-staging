import fs from 'fs';
import path from 'path';

/**
 * LIENS-EVENEMENT (2026-09-15, decision Q2 = B d Adel) -- un lien d evenement
 * partage ouvre l app si elle est installee, la page web sinon.
 *
 * L adresse partagee est `https://foundclub.app/events/<id>` (shareLinks.js,
 * buildPublicEventUrl). Pour que le TELEPHONE la donne a l app, il faut que
 * l app la RECLAME :
 *   - Android : un filtre d intention `autoVerify` qui declare le chemin. Le
 *     fichier assetlinks.json du site ne liste pas de chemins : c est le
 *     manifeste, et lui seul, qui decide (build natif obligatoire).
 *   - iPhone : l app declare le DOMAINE (entitlements, deja la depuis Y03) ; les
 *     CHEMINS vivent dans le fichier apple-app-site-association servi par le site
 *     (depot web, temoin tests/smoke/event-link.spec.ts).
 *
 * Mesure du 15/09 avant le lot : le filtre ne declarait que /i/ et /install.html.
 */

const RACINE = path.join(__dirname, '..', '..', '..');
const MANIFESTE = path.join(RACINE, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
const ENTITLEMENTS = path.join(RACINE, 'ios', 'foundclub', 'foundclub.entitlements');

/**
 * Les filtres d intention verifies (autoVerify) du manifeste, en texte brut.
 * @returns {string[]} un bloc par filtre
 */
const filtresVerifies = () => [
  ...fs.readFileSync(MANIFESTE, 'utf8')
    .matchAll(/<intent-filter android:autoVerify="true">([\s\S]*?)<\/intent-filter>/g),
].map((m) => m[1]);

/**
 * Les valeurs d un attribut `android:<nom>` dans un bloc.
 * @param {string} bloc le texte du filtre
 * @param {string} nom le nom de l attribut
 * @returns {string[]} les valeurs
 */
const valeurs = (bloc, nom) => [...bloc.matchAll(new RegExp(`android:${nom}="([^"]+)"`, 'g'))]
  .map((m) => m[1]);

describe('LIENS-EVENEMENT -- l app reclame le lien d evenement', () => {
  it('Android : le filtre verifie de foundclub.app declare /events/', () => {
    const filtre = filtresVerifies()
      .find((bloc) => valeurs(bloc, 'host').includes('foundclub.app'));

    expect(filtre).toBeDefined();
    expect({
      chemins: valeurs(filtre || '', 'pathPrefix'),
      hotes: valeurs(filtre || '', 'host'),
    }).toEqual({
      // /i/ et /install.html : invitations (Y03, INVIT2), a garder.
      chemins: expect.arrayContaining(['/events/', '/i/', '/install.html']),
      hotes: expect.arrayContaining(
        ['foundclub.app', 'www.foundclub.app', 'staging.foundclub.app'],
      ),
    });
  });

  it('iPhone : l app declare les domaines du site (les chemins vivent cote web)', () => {
    const domaines = [...fs.readFileSync(ENTITLEMENTS, 'utf8').matchAll(/<string>applinks:([^<]+)<\/string>/g)]
      .map((m) => m[1]);

    expect(domaines).toEqual(expect.arrayContaining(
      ['foundclub.app', 'www.foundclub.app', 'staging.foundclub.app'],
    ));
  });
});
