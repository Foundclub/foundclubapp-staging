import { reduirePhotoDuNavigateur, televerserLaPiece } from '../collectiviteActualiteService';

// ⏱️ VILLE-T18D (07/10/2026) — T18 point 2 (G71) : une photo de 534 Ko a mis 10,8 s à partir
// (POST /api/upload 201, relais de la T18), sans rien dire pendant ce temps.
//
// Ce que la mesure a établi (banc local, chaîne réelle de @strapi/upload 5.38, voir le commit) :
//   - au TÉLÉPHONE, la photo est déjà réduite avant l'envoi (react-native-image-picker,
//     PHOTO_PICKER_LIMITS : 2048 px, 0,8) — la capture de 1080×2424 est partie en 912×2048 ;
//   - au SERVEUR, sharp fabrique 5 images (l'original optimisé et 4 versions) : 1,2 à 1,8 s
//     sur un PC de bureau, avant d'en envoyer 515 Ko à R2 ;
//   - le reste est le TRANSFERT : rien ne le mesurait côté app.
//   - au SITE, rien ne réduisait la photo : elle partait telle que choisie (4 à 8 Mo pour une
//     photo d'appareil).
//
// Ce que ce témoin fige (ROUGE avant le lot) :
//   E1 l'envoi dit où il en est (fraction envoyée, de 0 à 1) ;
//   E2 il chronomètre le transfert et la réponse du serveur, dans le journal de l'écran ;
//   E3 le site réduit une photo avec les règles du téléphone (2048 px de côté, JPEG 0,8) ;
//   E4 une photo déjà légère, un document, un format illisible (HEIC) ou un échec : l'original.

const mockInfo = jest.fn();
jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(), error: jest.fn(), info: (...args) => mockInfo(...args), warn: jest.fn(),
  }),
}));

const URL_UPLOAD = 'https://api-staging.example/api/upload';
const PHOTO = { name: '113.png', type: 'image/png', uri: 'file:///cache/113.png' };
const REPONSE = JSON.stringify([{ id: 71, mime: 'image/png', name: '113.png' }]);

/** @type {any[]} */
let envois = [];

// Le XMLHttpRequest de React Native : la progression de l'ENVOI passe par `upload.onprogress`.
class FauxXhr {
  constructor() {
    this.entetes = {};
    this.responseText = '';
    this.status = 0;
    this.upload = {};
    envois.push(this);
  }

  open(methode, url) { this.methode = methode; this.url = url; }

  send(corps) {
    this.corps = corps;
    setTimeout(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 267000, total: 534000 });
      this.upload.onprogress?.({ lengthComputable: true, loaded: 534000, total: 534000 });
      setTimeout(() => {
        this.status = 201;
        this.responseText = REPONSE;
        this.onload?.();
      }, 30);
    }, 20);
  }

  setRequestHeader(nom, valeur) { this.entetes[nom] = valeur; }
}

const FormDataNative = jest.requireActual('react-native/Libraries/Network/FormData').default;

beforeEach(() => {
  envois = [];
  mockInfo.mockReset();
  global.XMLHttpRequest = /** @type {any} */ (FauxXhr);
  global.FormData = /** @type {any} */ (FormDataNative);
});

describe('VILLE-T18D — l envoi dit où il en est, et se chronomètre', () => {
  it('E1 la fraction envoyée remonte à l écran, jusqu à 1', async () => {
    const progression = jest.fn();
    const fichier = await televerserLaPiece({
      fichier: PHOTO, onProgress: progression, token: 'jeton', url: URL_UPLOAD,
    });
    expect(fichier).toEqual(expect.objectContaining({ id: 71 }));
    expect(progression.mock.calls.map(([fraction]) => fraction)).toEqual([0.5, 1]);
  });

  it('E2 le journal dit la durée du transfert et celle de la réponse', async () => {
    await televerserLaPiece({
      fichier: PHOTO, octets: 534000, token: 'jeton', url: URL_UPLOAD,
    });
    expect(mockInfo).toHaveBeenCalledWith('Piece jointe envoyee', expect.objectContaining({
      octets: 534000,
      statut: 201,
    }));
    const [, mesure] = mockInfo.mock.calls[0];
    expect(mesure.envoiMs).toBeGreaterThanOrEqual(15);
    expect(mesure.reponseMs).toBeGreaterThanOrEqual(25);
    expect(mesure.totalMs).toBe(mesure.envoiMs + mesure.reponseMs);
  });
});

/**
 * Le navigateur, doublé : une image de `largeur`×`hauteur`, une toile qui note ce qu'on y dessine,
 * et un JPEG de `octetsJpeg` octets.
 * @param {{ largeur: number, hauteur: number, octetsJpeg?: number, illisible?: boolean }} image
 * @returns {{ env: any, dessins: any[], encodages: any[] }} Le navigateur et ses traces.
 */
const navigateur = ({
  hauteur, illisible = false, largeur, octetsJpeg = 1000,
}) => {
  const dessins = [];
  const encodages = [];
  const env = {
    createImageBitmap: async () => {
      if (illisible) throw new Error('The source image could not be decoded.');
      return { close: jest.fn(), height: hauteur, width: largeur };
    },
    document: {
      createElement: () => {
        const toile = {
          getContext: () => ({
            drawImage: (_image, x, y, l, h) => dessins.push({
              h, l, toile: { height: toile.height, width: toile.width }, x, y,
            }),
            fillRect: jest.fn(),
          }),
          height: 0,
          toBlob: (rappel, type, qualite) => {
            encodages.push({ qualite, type });
            rappel(new Blob([new Uint8Array(octetsJpeg)], { type }));
          },
          width: 0,
        };
        return toile;
      },
    },
  };
  return { dessins, encodages, env };
};
/**
 * Un fichier du navigateur, de `octets` octets.
 * @param {number} octets - Son poids.
 * @param {string} nom - Son nom.
 * @param {string} type - Son type.
 * @returns {File} Le fichier.
 */
const fichierDe = (octets, nom, type) => new File([new Uint8Array(octets)], nom, { type });

describe('VILLE-T18D — le site réduit une photo avant de l envoyer', () => {
  it('E3 une photo d appareil (4032×3024, 3 Mo) part en 2048×1536, JPEG 0,8', async () => {
    const { dessins, encodages, env } = navigateur({
      hauteur: 3024, largeur: 4032, octetsJpeg: 450000,
    });
    const origine = fichierDe(3000000, 'IMG_2041.JPG', 'image/jpeg');
    const reduite = await reduirePhotoDuNavigateur(origine, env);
    expect(reduite).not.toBe(origine);
    expect(reduite.name).toBe('IMG_2041.jpg');
    expect(reduite.type).toBe('image/jpeg');
    expect(reduite.size).toBe(450000);
    expect(dessins).toEqual([{
      h: 1536, l: 2048, toile: { height: 1536, width: 2048 }, x: 0, y: 0,
    }]);
    expect(encodages).toEqual([{ qualite: 0.8, type: 'image/jpeg' }]);
  });

  it('E3 une capture PNG lourde (912×2048, 554 Ko) part en JPEG, à la même taille', async () => {
    const { dessins, env } = navigateur({ hauteur: 2048, largeur: 912, octetsJpeg: 99000 });
    const reduite = await reduirePhotoDuNavigateur(fichierDe(554000, '113.png', 'image/png'), env);
    expect(reduite.name).toBe('113.jpg');
    expect(reduite.size).toBe(99000);
    expect(dessins[0]).toEqual(expect.objectContaining({ h: 2048, l: 912 }));
  });

  it('E4 une photo déjà légère et petite part telle quelle', async () => {
    const { encodages, env } = navigateur({ hauteur: 300, largeur: 600 });
    const origine = fichierDe(20000, 'recette_t9.png', 'image/png');
    expect(await reduirePhotoDuNavigateur(origine, env)).toBe(origine);
    expect(encodages).toEqual([]);
  });

  it('E4 un document, une pièce du téléphone, un HEIC illisible : l original', async () => {
    const { env } = navigateur({ hauteur: 3024, largeur: 4032 });
    const pdf = fichierDe(900000, 'dossier.pdf', 'application/pdf');
    expect(await reduirePhotoDuNavigateur(pdf, env)).toBe(pdf);
    const duTelephone = { name: '113.png', type: 'image/png', uri: 'file:///cache/113.png' };
    expect(await reduirePhotoDuNavigateur(duTelephone, env)).toBe(duTelephone);
    const heic = fichierDe(2500000, 'IMG_1.HEIC', 'image/heic');
    expect(await reduirePhotoDuNavigateur(heic, env)).toBe(heic);
    const illisible = navigateur({ hauteur: 3024, illisible: true, largeur: 4032 });
    const jpeg = fichierDe(3000000, 'IMG_2.jpg', 'image/jpeg');
    expect(await reduirePhotoDuNavigateur(jpeg, illisible.env)).toBe(jpeg);
  });

  it('E4 un JPEG ré-encodé PLUS lourd que l original : l original', async () => {
    const { env } = navigateur({ hauteur: 1536, largeur: 2048, octetsJpeg: 700000 });
    const origine = fichierDe(600000, 'deja-compresse.jpg', 'image/jpeg');
    expect(await reduirePhotoDuNavigateur(origine, env)).toBe(origine);
  });
});
