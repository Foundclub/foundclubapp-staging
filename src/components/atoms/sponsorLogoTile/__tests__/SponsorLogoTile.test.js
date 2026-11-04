import { createElement } from 'react';
import { Image } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SponsorLogoTile from '../SponsorLogoTile';

// PERFIMAGES (03/11) — ce que la tuile fait de la taille d'un logo. Chaque cas prend une adresse
// neuve : la taille d'un logo reste connue d'une tuile a l'autre.

jest.mock('@/utils/imageUrl', () => ({
  getImageUrl: (url) => url,
}));

jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({ Fonts: { p2Bold: {} } }),
}));

const monter = async (props) => {
  let tree;
  await act(async () => {
    tree = renderer.create(createElement(SponsorLogoTile, props));
  });
  return tree;
};

const cadreDuLogo = (tree) => {
  const image = tree.root.findByType(Image);
  const styles = [image.parent.props.style].flat();
  return styles[styles.length - 1];
};

describe('SponsorLogoTile : la taille du logo', () => {
  let getSize;

  beforeEach(() => {
    getSize = jest.spyOn(Image, 'getSize');
  });

  afterEach(() => {
    getSize.mockRestore();
  });

  it('un logo large garde sa forme dans la tuile', async () => {
    getSize.mockImplementation((_uri, reussite) => reussite(200, 50));
    const tree = await monter({ height: 55, imageUrl: '/uploads/large.png', width: 110 });
    expect(cadreDuLogo(tree)).toMatchObject({ height: 27.5, width: 110 });
  });

  it('un logo haut garde sa forme dans la tuile', async () => {
    getSize.mockImplementation((_uri, reussite) => reussite(50, 100));
    const tree = await monter({ height: 55, imageUrl: '/uploads/haut.png', width: 110 });
    expect(cadreDuLogo(tree)).toMatchObject({ height: 55, width: 27.5 });
  });

  it('une taille illisible laisse le logo a la taille de la tuile', async () => {
    getSize.mockImplementation((_uri, _reussite, echec) => echec(new Error('illisible')));
    const tree = await monter({ height: 55, imageUrl: '/uploads/casse.png', width: 110 });
    expect(cadreDuLogo(tree)).toMatchObject({ height: 55, width: 110 });
  });

  it('une taille nulle laisse le logo a la taille de la tuile', async () => {
    getSize.mockImplementation((_uri, reussite) => reussite(0, 0));
    const tree = await monter({ height: 55, imageUrl: '/uploads/nul.png', width: 110 });
    expect(cadreDuLogo(tree)).toMatchObject({ height: 55, width: 110 });
  });

  it('sans logo, la tuile montre la premiere lettre et ne demande rien', async () => {
    const tree = await monter({ showTitle: false, title: 'garage' });
    expect(getSize).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(Image)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('"G"');
  });

  it('une tuile retiree avant la reponse ne se met pas a jour', async () => {
    let repondre;
    getSize.mockImplementation((_uri, reussite) => { repondre = reussite; });
    const erreur = jest.spyOn(console, 'error').mockImplementation(() => {});
    const tree = await monter({ imageUrl: '/uploads/tardif.png' });
    await act(async () => { tree.unmount(); });
    await act(async () => { repondre(200, 50); });
    expect(erreur).not.toHaveBeenCalled();
    erreur.mockRestore();
  });
});
