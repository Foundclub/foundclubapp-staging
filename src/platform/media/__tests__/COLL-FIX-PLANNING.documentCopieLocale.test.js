import { keepLocalCopy, pick } from '@react-native-documents/picker';

import { pickDocument } from '../media.native';

// 🐞 COLL-FIX-PLANNING (02/10/2026), defaut de la tournee T9 (T9_DEFAUT_C18) : une piece jointe
// d actualite par « Document » echouait sans requete. La messagerie, elle, envoie des documents :
// elle COPIE d abord le fichier choisi dans le cache de l app (`keepLocalCopy`, Conversation.js
// handlePickFile) et envoie la copie (`file://`), jamais l adresse `content://` du selecteur.
//
// Ce que ce temoin fige (ROUGE avant : `pickDocument` ne savait pas copier) :
//   - `localCopy: true` rend le meme fichier, dont l adresse est celle de la COPIE ;
//   - une copie ratee garde l adresse d origine (meme repli que la messagerie) ;
//   - sans `localCopy`, rien ne change pour les autres appelants (cotisations) ;
//   - l option `localCopy` n est jamais transmise au selecteur natif.

jest.mock('@react-native-documents/picker', () => ({
  keepLocalCopy: jest.fn(),
  pick: jest.fn(),
}));
jest.mock('react-native-blob-util', () => ({ fs: { stat: jest.fn() } }));
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

const CHOISI = {
  name: 'règlement intérieur.pdf',
  size: 2048,
  type: 'application/pdf',
  uri: 'content://com.android.providers.downloads.documents/document/42',
};
const OPTIONS = { mode: 'open', type: ['application/pdf'] };

beforeEach(() => {
  jest.clearAllMocks();
  /** @type {any} */ (pick).mockResolvedValue([CHOISI]);
});

describe('COLL-FIX-PLANNING — pickDocument({ localCopy })', () => {
  it('localCopy : le meme fichier, dont l adresse est la copie du cache', async () => {
    /** @type {any} */ (keepLocalCopy).mockResolvedValue([{
      localUri: 'file:///data/user/0/app/cache/r.pdf', sourceUri: CHOISI.uri, status: 'success',
    }]);
    const choisis = await pickDocument({ ...OPTIONS, localCopy: true });
    expect(pick).toHaveBeenCalledWith(OPTIONS);
    expect(keepLocalCopy).toHaveBeenCalledWith({
      destination: 'cachesDirectory',
      files: [{ fileName: CHOISI.name, uri: CHOISI.uri }],
    });
    expect(choisis).toEqual([{ ...CHOISI, uri: 'file:///data/user/0/app/cache/r.pdf' }]);
  });

  it('une copie ratee garde l adresse d origine', async () => {
    /** @type {any} */ (keepLocalCopy).mockResolvedValue([{
      copyError: 'disque plein', sourceUri: CHOISI.uri, status: 'error',
    }]);
    expect(await pickDocument({ ...OPTIONS, localCopy: true })).toEqual([CHOISI]);
  });

  it('sans localCopy : rien ne change pour les autres appelants', async () => {
    expect(await pickDocument(OPTIONS)).toEqual([CHOISI]);
    expect(keepLocalCopy).not.toHaveBeenCalled();
    expect(pick).toHaveBeenCalledWith(OPTIONS);
  });
});
