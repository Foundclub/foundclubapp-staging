import fs from 'fs';
import path from 'path';

import {
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  scrubUrl,
} from './sentryPrivacy';

/**
 * ACQ-SENTRY-SERVEUR, cote app.
 *
 * MESURE SUR 10 EVENEMENTS REELS DU PROJET react-native, 03/11/2026 : un numero de
 * telephone dans le fil d actions, 4 lignes de `/api/search/events?q=...` en production,
 * et le texte libre de la recherche en clair sur 50 lignes. La politique promet « ni
 * ton nom, ni ton telephone, ni ton e-mail ».
 */
// Numero de fiction reserve par l ARCEP (06 39 98), jamais attribue.
const TELEPHONE = '+33639980001';
const ENCODE = encodeURIComponent(TELEPHONE);
const EMAIL = 'temoin@exemple.invalid';
const RECHERCHE = 'Nom-Du-Temoin';
const API = 'https://api.foundclubpro.com/api/search/events';

const INTERDITS = [TELEPHONE, ENCODE, EMAIL, RECHERCHE];

/**
 * Exige qu aucune donnee personnelle ne reste.
 * @param {any} objet - Ce qui partirait.
 * @returns {void}
 */
const aucuneDonneePersonnelle = (objet) => {
  const texte = JSON.stringify(objet);
  INTERDITS.forEach((interdit) => expect(texte).not.toContain(interdit));
};

describe('ce qui part chez Sentry depuis l application', () => {
  it('une recherche par numero, le cas mesure en production, ne laisse rien', () => {
    const fil = scrubSentryBreadcrumb({
      category: 'xhr',
      data: {
        method: 'GET',
        status_code: 200,
        url: `${API}?q=${TELEPHONE}&pagination[page]=2`,
      },
      type: 'http',
    });
    aucuneDonneePersonnelle(fil);
    expect(fil.data.url).toBe(`${API}?q=[retire]&pagination[page]=2`);
    expect(fil.data.status_code).toBe(200);
  });

  it('une valeur encodee ne passe pas plus : le filtre lit le nom, pas la valeur', () => {
    const mail = encodeURIComponent(EMAIL);
    aucuneDonneePersonnelle(scrubUrl(`${API}?q=${ENCODE}&search=${RECHERCHE}&mail=${mail}`));
  });

  it('de quoi reparer reste : le chemin, les noms, la structure de la requete', () => {
    const structure = 'sort[name]=asc&populate%5Bclub%5D%5Bfields%5D%5B0%5D=name';
    const adresse = `${API}?${structure}&filters[type][name][$ne]=${RECHERCHE}`;
    expect(scrubUrl(adresse)).toBe(`${API}?${structure}&filters[type][name][$ne]=[retire]`);
  });

  it('un filtre glisse dans un populate ne passe pas pour de la structure', () => {
    const lisible = `populate[club][filters][email][$eq]=${EMAIL}`;
    const encode = `populate%5Bx%5D%5Bfilters%5D%5Bphone%5D=${ENCODE}`;
    aucuneDonneePersonnelle(scrubUrl(`${API}?${lisible}&${encode}`));
  });

  it('le fragment disparait, une adresse sans parametre ne bouge pas', () => {
    expect(scrubUrl(`${API}#tel=${TELEPHONE}`)).toBe(API);
    expect(scrubUrl(API)).toBe(API);
    expect(scrubUrl(undefined)).toBeUndefined();
  });

  it('un journal console : plus d arguments bruts, message nettoye', () => {
    const fil = scrubSentryBreadcrumb({
      category: 'console',
      data: { arguments: [{ phone: TELEPHONE }], logger: 'console' },
      message: `appel ${API}?q=${RECHERCHE} pour ${EMAIL} et ${TELEPHONE} refuse`,
    });
    aucuneDonneePersonnelle(fil);
    expect(fil.data.logger).toBe('console');
    expect(fil.message).toMatch(/^appel .+ refuse$/);
  });

  it('un evenement complet, fil venu du natif compris, part propre', () => {
    const evenement = scrubSentryEvent({
      breadcrumbs: [{
        category: 'http',
        data: { 'http.query': `q=${TELEPHONE}`, url: `${API}?q=${TELEPHONE}` },
      }],
      exception: { values: [{ type: 'Error', value: `refus pour ${EMAIL}` }] },
      message: `panne ${TELEPHONE}`,
      request: { url: `${API}?q=${TELEPHONE}` },
    });
    aucuneDonneePersonnelle(evenement);
    expect(evenement.exception.values[0].type).toBe('Error');
  });

  it('une trace : une partie des ouvertures en part, ses requetes aussi', () => {
    const trace = scrubSentryEvent({
      contexts: { trace: { data: { url: `${API}?q=${TELEPHONE}` } } },
      spans: [{
        data: {
          'http.fragment': `t=${TELEPHONE}`,
          'http.query': `q=${TELEPHONE}`,
          url: `${API}?q=${TELEPHONE}`,
        },
        description: `GET ${API}?q=${TELEPHONE}`,
      }],
      type: 'transaction',
    });
    aucuneDonneePersonnelle(trace);
    expect(trace.spans[0].description).toBe(`GET ${API}?q=[retire]`);
  });

  it('le corps d une erreur serveur, range par le SDK dans `extra`, est nettoye aussi', () => {
    const evenement = scrubSentryEvent({
      exception: { values: [{ type: 'Error', value: 'Object captured as exception' }] },
      extra: {
        __serialized__: {
          details: { champs: [`refus pour ${EMAIL}`], url: `${API}?q=${RECHERCHE}` },
          message: `numero ${TELEPHONE} refuse`,
          name: 'ApplicationError',
          status: 400,
        },
      },
    });
    aucuneDonneePersonnelle(evenement);
    const [corps] = Object.values(evenement.extra);
    expect(corps.name).toBe('ApplicationError');
    expect(corps.status).toBe(400);
  });

  it('si le nettoyage casse, la panne part sans fil plutot que perdue', () => {
    const evenement = scrubSentryEvent({
      breadcrumbs: { forEach() { throw new Error('piege'); } },
      exception: { values: [{ type: 'Error', value: 'boum' }] },
    });
    expect(evenement.exception.values[0].value).toBe('boum');
    expect(evenement.breadcrumbs).toBeUndefined();
  });

  it('src/App.js branche bien les trois sorties', () => {
    const app = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
    expect(app).toMatch(/beforeBreadcrumb: scrubSentryBreadcrumb/);
    expect(app).toMatch(/beforeSendTransaction: scrubSentryEvent/);
    expect(app).toMatch(/return scrubSentryEvent\(event\)/);
  });
});
