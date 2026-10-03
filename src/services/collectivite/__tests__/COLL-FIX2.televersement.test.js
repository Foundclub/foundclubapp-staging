import { televerserLaPiece } from '../collectiviteActualiteService';

// 🐞 COLL-FIX2 (03/10) — point 4, planche 18 : LA PIÈCE JOINTE « DOCUMENT » D'UNE ACTUALITÉ.
// Tournées T9 puis T10 (après la copie locale de COLL-FIX-PLANNING) : « La pièce jointe n'a pas pu
// être envoyée », AUCUN POST /upload au relais, journal `[TypeError: Network request failed]`.
// Une PHOTO passe par la même fonction et part (98.png, T9) : seul le fichier du sélecteur de
// documents échoue, AVANT le réseau.
//
// 🔎 Ce que dit le code natif installé (react-native 0.81.6, NetworkingModule.kt
// constructMultipartBody / RequestBodyUtil.getFileInputStream) : quand le corps ne peut pas être
// CONSTRUIT (fichier illisible, type manquant), la requête ne part pas et le module rend une raison
// (« Could not retrieve file for uri … »). `fetch` lit en `blob` et la jette : il ne reste que
// « Network request failed ». La cause exacte n'est donc LISIBLE nulle part — c'est ce que ce lot
// change, en plus d'aligner l'envoi sur la messagerie, qui envoie des documents.
//
// Ce témoin court sur le VRAI code d'envoi (`televerserLaPiece`) ; seul XMLHttpRequest est doublé,
// avec le comportement de React Native : en erreur, `responseText` porte la raison native.
// (`uploadActualiteFile` charge son client par `import()` à l'appel : jest ne l'exécute pas —
// mémoire piege-jest-import-dynamique ; d'où la fonction d'envoi séparée.)

const PIECE = { name: 'reglement-interieur.pdf', type: 'application/pdf', uri: 'file:///cache/x/reglement-interieur.pdf' };
const URL_UPLOAD = 'http://10.0.2.2:8788/api/upload';
const RAISON_NATIVE = 'Could not retrieve file for uri content://com.android.providers.media.documents/document/document%3A1000';

/** @type {{ status?: number, texte?: string, erreurNative?: string | null }} */
let scenario = {};
/** @type {any[]} */
let envois = [];

class FauxXhr {
  constructor() {
    this.entetes = {};
    this.responseText = '';
    this.status = 0;
    envois.push(this);
  }

  open(methode, url) { this.methode = methode; this.url = url; }

  send(corps) {
    this.corps = corps;
    setTimeout(() => {
      if (scenario.erreurNative !== undefined) {
        // React Native : la raison native est rendue comme « réponse » d'une requête en échec.
        this.responseText = scenario.erreurNative || '';
        this.onerror?.();
        return;
      }
      this.status = scenario.status ?? 201;
      this.responseText = scenario.texte ?? '';
      this.onload?.();
    }, 0);
  }

  setRequestHeader(nom, valeur) { this.entetes[nom] = valeur; }
}

// eslint-disable-next-line max-len
const partieEnvoyee = (/** @type {FormData} */ formData) => /** @type {any} */ (formData).getParts()[0];

// La FormData de React Native (celle de l'appareil), pas celle de Node : ses parties portent
// `uri`, `name`, `type` et les en-têtes que le module natif lit.
const FormDataNative = jest.requireActual('react-native/Libraries/Network/FormData').default;

beforeEach(() => {
  scenario = {};
  envois = [];
  global.XMLHttpRequest = /** @type {any} */ (FauxXhr);
  global.FormData = /** @type {any} */ (FormDataNative);
});

describe('COLL-FIX2 — envoyer la pièce jointe d’une actualité (planche 18)', () => {
  it('le fichier part en multipart, avec le jeton, et rend le fichier créé', async () => {
    // eslint-disable-next-line max-len
    scenario = { status: 201, texte: JSON.stringify([{ id: 41, mime: 'application/pdf', name: 'r.pdf' }]) };
    const fichier = await televerserLaPiece({ fichier: PIECE, token: 'jeton', url: URL_UPLOAD });
    expect(fichier).toEqual({ id: 41, mime: 'application/pdf', name: 'r.pdf' });
    expect(envois).toHaveLength(1);
    expect(envois[0].methode).toBe('POST');
    expect(envois[0].url).toBe(URL_UPLOAD);
    expect(envois[0].entetes).toEqual({ Authorization: 'Bearer jeton' });
    expect(envois[0].entetes['Content-Type']).toBeUndefined();
    expect(partieEnvoyee(envois[0].corps)).toEqual(expect.objectContaining({
      ...PIECE,
      fieldName: 'files',
      headers: {
        'content-disposition': 'form-data; name="files"; filename="reglement-interieur.pdf"',
        'content-type': 'application/pdf',
      },
    }));
  });

  // eslint-disable-next-line max-len
  it('la requête n’a pas pu partir : 2e envoi par le client HTTP, comme la messagerie', async () => {
    scenario = { erreurNative: RAISON_NATIVE };
    const secours = jest.fn().mockResolvedValue([{ id: 42, name: 'r.pdf' }]);
    const fichier = await televerserLaPiece({
      fichier: PIECE, secours, token: 'jeton', url: URL_UPLOAD,
    });
    expect(fichier).toEqual({ id: 42, name: 'r.pdf' });
    expect(secours).toHaveBeenCalledTimes(1);
    expect(partieEnvoyee(secours.mock.calls[0][0])).toEqual(expect.objectContaining(PIECE));
  });

  // eslint-disable-next-line max-len
  it('les deux échouent : l’erreur dit la RAISON NATIVE, plus seulement « Network request failed »', async () => {
    scenario = { erreurNative: RAISON_NATIVE };
    const secours = jest.fn().mockRejectedValue(new Error('Network Error'));
    const promesse = televerserLaPiece({
      fichier: PIECE, secours, token: 'jeton', url: URL_UPLOAD,
    });
    await expect(promesse).rejects.toThrow(`Network request failed : ${RAISON_NATIVE}`);
    await expect(promesse).rejects.toEqual(expect.objectContaining({ natif: RAISON_NATIVE }));
  });

  it('le serveur répond une erreur : elle remonte telle quelle, sans 2e envoi', async () => {
    scenario = { status: 413, texte: JSON.stringify({ error: { message: 'Fichier trop lourd' } }) };
    const secours = jest.fn();
    await expect(televerserLaPiece({
      fichier: PIECE, secours, token: 'jeton', url: URL_UPLOAD,
    })).rejects.toThrow('Fichier trop lourd');
    expect(secours).not.toHaveBeenCalled();
  });
});
