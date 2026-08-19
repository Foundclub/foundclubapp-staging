import { Platform } from 'react-native';

import {
  DOCUMENT_UPLOAD_MIME_TYPES,
  getDocumentPickerOptions,
  getDocumentPickerTypes,
} from '../documentUploadFormats';

/**
 * U06 — TEMOIN 4 : « les formats acceptes couvrent la liste retenue, et rien de plus ».
 *
 * 🧨 Le defaut mesure : les trois ecrans de depot passaient la chaine passe-partout
 * d'Android (etoile-slash-etoile) a un selecteur iOS qui attend des **UTI**. Ce test
 * verrouille les deux langues, et surtout : ⛔ AUCUNE des deux ne dit « tout ».
 */

describe('U06 — les formats de depot d un document', () => {
  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('temoin 4 — la liste retenue couvre photo, capture, PDF et bureautique', () => {
    expect(DOCUMENT_UPLOAD_MIME_TYPES).toEqual(expect.arrayContaining([
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/heic',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]));
  });

  it('⛔ et RIEN DE PLUS — ni archive, ni executable, ni video, ni « tout »', () => {
    const passePartout = ['*', '*'].join('/');
    const interdits = DOCUMENT_UPLOAD_MIME_TYPES.filter((mime) => (
      mime === passePartout
      || mime.startsWith('video/')
      || mime.startsWith('audio/')
      || mime.includes('zip')
      || mime.includes('executable')
      || mime.includes('msdownload')
    ));

    expect(interdits).toEqual([]);
  });

  it('iOS recoit des UTI, jamais des types MIME', () => {
    Platform.OS = 'ios';

    const types = getDocumentPickerTypes();

    expect(types).toContain('com.adobe.pdf');
    expect(types).toContain('public.image');
    expect(types.filter((type) => type.includes('/'))).toEqual([]);
  });

  it('Android recoit des types MIME, jamais des UTI', () => {
    Platform.OS = 'android';

    const types = getDocumentPickerTypes();

    expect(types).toContain('application/pdf');
    expect(types).toContain('image/*');
    expect(types.every((type) => type.includes('/'))).toBe(true);
  });

  it('les options du selecteur ne portent JAMAIS la chaine passe-partout', () => {
    const passePartout = ['*', '*'].join('/');
    const options = getDocumentPickerOptions();

    expect(options.type).not.toContain(passePartout);
    expect(options.accept).not.toBe(passePartout);
    expect(options.accept).toContain('application/pdf');
  });
});
