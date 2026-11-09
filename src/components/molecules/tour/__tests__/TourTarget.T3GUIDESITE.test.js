import { Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  measureTourTarget,
  resetTourTargetsForTests,
  revealTourTarget,
} from '@/domains/tour/tourTargetRegistry';

import TourTarget from '../TourTarget';

// T3-GUIDE-SITE : éteint, l'ancre ne laisse aucune boîte de plus dans la page du site ; allumé,
// elle se mesure comme sur le téléphone.

let mockFlag = false;
jest.mock('@/config/fonctionsMasquees', () => Object.defineProperty(
  { ...jest.requireActual('@/config/fonctionsMasquees') },
  'GUIDE_SUR_LE_SITE',
  { get: () => mockFlag },
));

let tree;
let plateforme;
const mount = () => {
  act(() => {
    tree = renderer.create(<TourTarget id="essai.cible"><Text>enfant</Text></TourTarget>);
  });
  const host = tree.root.findAll((node) => node.props.testID === 'tour.target.essai.cible'
    && typeof node.type !== 'string')[0];
  if (host) host.instance.measureInWindow = (done) => done(10, 20, 30, 40);
};

beforeEach(() => { plateforme = jest.replaceProperty(Platform, 'OS', 'web'); });
afterEach(() => {
  act(() => { tree?.unmount(); });
  plateforme.restore();
  resetTourTargetsForTests();
});

describe('TourTarget sur le site', () => {
  it('éteint : l enfant seul, rien d enregistré', async () => {
    mockFlag = false;
    mount();
    expect(tree.toJSON().type).toBe('Text');
    await expect(measureTourTarget('essai.cible')).resolves.toBeNull();
  });

  it('allumé : l ancre se mesure', async () => {
    mockFlag = true;
    mount();
    await expect(measureTourTarget('essai.cible')).resolves.toMatchObject({
      height: 40, width: 30, x: 10, y: 20,
    });
  });
});

describe('GUIDES-SITE : l ancre du site se ramène elle-même à l écran', () => {
  it('allumé : le navigateur la fait défiler au milieu (scrollIntoView)', () => {
    mockFlag = true;
    mount();
    const host = tree.root.findAll((node) => node.props.testID === 'tour.target.essai.cible'
      && typeof node.type !== 'string')[0];
    host.instance.scrollIntoView = jest.fn();
    expect(revealTourTarget('essai.cible')).toBe(true);
    expect(host.instance.scrollIntoView)
      .toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });
});
