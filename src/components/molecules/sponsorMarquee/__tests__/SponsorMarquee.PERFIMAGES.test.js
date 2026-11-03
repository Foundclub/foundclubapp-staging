import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SponsorMarquee from '../SponsorMarquee';

// PERFIMAGES (03/11) — le journal d'acces de la prod montre un seul reseau qui demande 2 106 images
// en 21 secondes, dont deux logos 991 fois chacun. Le serveur envoie `Cache-Control: max-age=0` :
// rien n'autorise le telephone a reutiliser une reponse. Or une ligne de sponsors demandait la taille
// du meme logo a chaque tuile : la liste est repetee jusqu'a 4 elements, puis dupliquee pour la boucle.
// Ce temoin compte les demandes de la carte. Les telechargements reels sur un iPhone ne sont pas
// mesures ici.

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
}));

jest.mock('@/theme/themeContext', () => {
  const styleLeaf = {};
  const makeRamp = () => new Proxy({}, { get: () => styleLeaf });
  return {
    __esModule: true,
    default: () => ({
      Alignments: makeRamp(),
      ApplicationStyle: new Proxy({}, { get: () => makeRamp() }),
      Colors: new Proxy({}, { get: (_target, key) => `couleur-${String(key)}` }),
      Fonts: makeRamp(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => makeRamp() }),
    }),
  };
});

const sponsor = (cle, url) => ({ documentId: cle, logo: { url }, title: cle });

describe('PERFIMAGES : une ligne de sponsors demande chaque logo une seule fois', () => {
  let getSize;

  const demandesParLogo = () => {
    const parLogo = {};
    getSize.mock.calls.forEach(([uri]) => {
      parLogo[uri] = (parLogo[uri] || 0) + 1;
    });
    return parLogo;
  };

  const monter = async (sponsors) => {
    let tree;
    await act(async () => {
      tree = renderer.create(<SponsorMarquee sponsors={sponsors} />);
    });
    return tree;
  };

  beforeEach(() => {
    getSize = jest.spyOn(Image, 'getSize').mockImplementation((_uri, reussite) => reussite(200, 50));
  });

  afterEach(() => {
    getSize.mockRestore();
  });

  it('un seul sponsor : une seule demande de taille', async () => {
    const tree = await monter([sponsor('sp-1', '/uploads/seul.png')]);
    expect(demandesParLogo()).toEqual({ '/uploads/seul.png': 1 });
    await act(async () => { tree.unmount(); });
  });

  it('deux sponsors : une seule demande de taille par logo', async () => {
    const tree = await monter([
      sponsor('sp-1', '/uploads/a.png'),
      sponsor('sp-2', '/uploads/b.jpg'),
    ]);
    expect(demandesParLogo()).toEqual({ '/uploads/a.png': 1, '/uploads/b.jpg': 1 });
    await act(async () => { tree.unmount(); });
  });

  it('la carte suivante du meme club ne redemande rien', async () => {
    const sponsors = [sponsor('sp-1', '/uploads/club.png')];
    const premiere = await monter(sponsors);
    const seconde = await monter(sponsors);
    expect(demandesParLogo()).toEqual({ '/uploads/club.png': 1 });
    await act(async () => {
      premiere.unmount();
      seconde.unmount();
    });
  });

  it('une demande ratee se retente a la carte suivante', async () => {
    getSize.mockImplementation((_uri, _reussite, echec) => echec(new Error('coupure')));
    const sponsors = [sponsor('sp-1', '/uploads/coupure.png')];
    const premiere = await monter(sponsors);
    expect(demandesParLogo()).toEqual({ '/uploads/coupure.png': 1 });
    await act(async () => { premiere.unmount(); });
    const seconde = await monter(sponsors);
    expect(demandesParLogo()).toEqual({ '/uploads/coupure.png': 2 });
    await act(async () => { seconde.unmount(); });
  });
});
