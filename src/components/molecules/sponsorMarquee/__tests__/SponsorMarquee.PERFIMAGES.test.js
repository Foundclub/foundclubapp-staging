import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SponsorMarquee from '../SponsorMarquee';

// PERFIMAGES (03/11) — LE TEMOIN ROUGE, SANS CORRECTIF.
// Le journal d'acces de la prod montre deux logos demandes presque le meme nombre de
// fois (6 295 et 6 268 en 4 jours), et un seul reseau qui en demande 2 106 en 21 secondes.
// Le serveur envoie `Cache-Control: max-age=0` : rien n'autorise le telephone a reutiliser
// une reponse. Or une seule ligne de sponsors demande la taille du meme logo a chaque
// tuile : la liste est repetee jusqu'a 4 elements, puis dupliquee pour la boucle.
// Ce temoin compte les demandes de la carte elle-meme. Le nombre de telechargements
// reels sur un iPhone n'est pas mesure ici.

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

const compterLesDemandes = (sponsors) => {
  const getSize = jest.spyOn(Image, 'getSize').mockImplementation(() => {});
  let tree;
  act(() => {
    tree = renderer.create(<SponsorMarquee sponsors={sponsors} />);
  });
  const parLogo = {};
  getSize.mock.calls.forEach(([uri]) => {
    parLogo[uri] = (parLogo[uri] || 0) + 1;
  });
  act(() => {
    tree.unmount();
  });
  getSize.mockRestore();
  return parLogo;
};

describe('PERFIMAGES : une ligne de sponsors demande chaque logo une seule fois', () => {
  it('un seul sponsor : une seule demande de taille', () => {
    const parLogo = compterLesDemandes([
      { documentId: 'sp-1', logo: { url: '/uploads/a.png' }, title: 'Boulangerie Paul' },
    ]);
    expect(parLogo).toEqual({ '/uploads/a.png': 1 });
  });

  it('deux sponsors : une seule demande de taille par logo', () => {
    const parLogo = compterLesDemandes([
      { documentId: 'sp-1', logo: { url: '/uploads/a.png' }, title: 'Boulangerie Paul' },
      { documentId: 'sp-2', logo: { url: '/uploads/b.jpg' }, title: 'Garage Central' },
    ]);
    expect(parLogo).toEqual({ '/uploads/a.png': 1, '/uploads/b.jpg': 1 });
  });
});
