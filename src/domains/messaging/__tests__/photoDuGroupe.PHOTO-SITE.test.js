import { Platform } from 'react-native';

// Le selecteur, double plus bas (jest.mock).
import { pickImage } from '@/platform/media';

// Ce qu'on teste.
import { choisirLaPhotoDuGroupe } from '../photoDuGroupe';

// ==========================================================================
// PHOTO-SITE (12/11, D90) — LA PHOTO D'UN GROUPE OU D'UN ENFANT, CHOISIE.
// `choisirLaPhotoDuGroupe` sert trois ecrans : « Nouveau groupe » (NewConversation.js), « Infos
// du groupe » (Conversation.js) et la carte d'un enfant (ChildCardPage.js). Aucun ne l'entoure
// d'un `try` : si le selecteur manque ou se plaint, l'erreur n'etait attrapee par personne, et
// rien ne se passait a l'ecran (au site construit, le `require` du selecteur rendait `undefined`).
// Ces temoins fixent :
//   C1 a C4 (caracterisation, verts AVANT le lot) : galerie et camera au telephone, annulation,
//      site ;
//   E1 (ROUGE avant) : selecteur introuvable -> un message a l'ecran, et un avertissement le dit.
// ==========================================================================

jest.mock('@/platform/media', () => ({
  capturePhoto: jest.fn(),
  pickImage: jest.fn(),
}));

const t = (/** @type {string} */ _cle, /** @type {string} */ repli) => repli;
const osDOrigine = Platform.OS;

/** @type {jest.SpyInstance} */
let avertissements;
beforeEach(() => {
  pickImage.mockReset();
  avertissements = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  avertissements.mockRestore();
  Platform.OS = osDOrigine;
});

const avertissementsDeLaPhoto = () => avertissements.mock.calls
  .filter((appel) => String(appel[0]).includes('[photo-du-groupe]'));

test('C1 telephone, galerie : la photo reduite comme l avatar, prete a partir', async () => {
  Platform.OS = 'ios';
  pickImage.mockResolvedValue({
    assets: [{
      fileName: 'a.jpg', fileSize: 1000, type: 'image/jpeg', uri: 'file:///a.jpg',
    }],
  });
  await expect(choisirLaPhotoDuGroupe('galerie', t)).resolves.toEqual({
    apercu: 'file:///a.jpg',
    fichier: { name: 'a.jpg', type: 'image/jpeg', uri: 'file:///a.jpg' },
  });
  expect(pickImage).toHaveBeenCalledWith(expect.objectContaining({
    includeBase64: false, maxHeight: 1000, maxWidth: 1000, mediaType: 'photo', quality: 0.8,
  }));
});

test('C2 telephone : annuler rend null', async () => {
  Platform.OS = 'ios';
  pickImage.mockResolvedValue({ didCancel: true });
  await expect(choisirLaPhotoDuGroupe('galerie', t)).resolves.toBeNull();
});

test('C3 telephone : une erreur du selecteur se dit avec son message', async () => {
  Platform.OS = 'ios';
  pickImage.mockResolvedValue({ errorCode: 'others', errorMessage: 'Galerie fermee' });
  await expect(choisirLaPhotoDuGroupe('galerie', t)).resolves.toEqual({ erreur: 'Galerie fermee' });
});

test('C4 site : le File du navigateur part tel quel, l apercu est une adresse locale', async () => {
  Platform.OS = 'web';
  const fichier = { name: 'g.png', size: 2000, type: 'image/png' };
  pickImage.mockResolvedValue(fichier);
  const createObjectURL = jest.fn(() => 'blob:apercu');
  const urlDOrigine = global.URL.createObjectURL;
  global.URL.createObjectURL = createObjectURL;
  try {
    await expect(choisirLaPhotoDuGroupe('galerie', t)).resolves.toEqual({
      apercu: 'blob:apercu', fichier,
    });
  } finally {
    global.URL.createObjectURL = urlDOrigine;
  }
  expect(avertissementsDeLaPhoto()).toHaveLength(0);
});

test.each(['web', 'ios'])(
  'E1 (%s) selecteur introuvable : un message a l ecran, et un avertissement le dit',
  async (os) => {
    Platform.OS = /** @type {any} */ (os);
    pickImage.mockImplementation(() => { throw new TypeError('pickImage is not a function'); });
    await expect(choisirLaPhotoDuGroupe('galerie', t)).resolves.toEqual({
      erreur: 'La photo n\'a pas pu être récupérée. Réessaie.',
    });
    expect(avertissementsDeLaPhoto()).toHaveLength(1);
    expect(avertissementsDeLaPhoto()[0][1]).toEqual({
      erreur: 'pickImage is not a function', source: 'galerie',
    });
  },
);
