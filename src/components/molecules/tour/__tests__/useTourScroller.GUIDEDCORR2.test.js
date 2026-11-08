import { readFileSync } from 'fs';
import { join } from 'path';

import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import { getActiveTourScroller, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import useTourScroller from '../useTourScroller';

// GUIDE-D-CORR-2 (décision d'Adel, 08/11) : le défilement du guide est automatique. Chaque écran
// du guide Dirigeant qui défile branche sa liste ici ; la couche du guide s'en sert.

jest.mock('@/domains/tour/guideSupport', () => ({ __esModule: true, default: () => true }));

let sortie;
/**
 * Sonde : un écran qui branche une fausse ScrollView.
 * @param {{ node: any }} props - Nœud qui défile.
 * @returns {null} Rien.
 */
function Ecran({ node }) {
  sortie = useTourScroller({ current: node });
  return null;
}

beforeEach(() => resetTourTargetsForTests());

describe('useTourScroller', () => {
  it('l’écran se signale ; le guide le fait défiler depuis la position lue', () => {
    const node = {
      measureInWindow: (cb) => cb(0, 80, 360, 500),
      scrollTo: jest.fn(),
    };
    let tree;
    act(() => { tree = renderer.create(createElement(Ecran, { node })); });
    const scroller = getActiveTourScroller();
    expect(scroller).not.toBeNull();
    act(() => { sortie.onScroll({ nativeEvent: { contentOffset: { y: 120 } } }); });
    scroller.scrollBy(300);
    expect(node.scrollTo).toHaveBeenCalledWith({ animated: true, y: 420 });
    let zone;
    scroller.measure((rect) => { zone = rect; });
    expect(zone).toEqual({
      height: 500, width: 360, x: 0, y: 80,
    });
    act(() => tree.unmount());
    expect(getActiveTourScroller()).toBeNull();
  });

  it('une FlatList passe par sa ScrollView ; jamais au-dessus du haut', () => {
    const inner = { scrollTo: jest.fn() };
    const node = { getNativeScrollRef: () => inner };
    act(() => { renderer.create(createElement(Ecran, { node })); });
    getActiveTourScroller().scrollBy(-50);
    expect(inner.scrollTo).toHaveBeenCalledWith({ animated: true, y: 0 });
  });
});

describe('les écrans du guide Dirigeant qui défilent sont branchés', () => {
  it.each([
    'views/club/ClubDetails.js',
    'views/club/ClubEdit.js',
    'views/club/AddSponsor.js',
    'views/club/AddCoach.js',
    'views/facility/FacilityList.js',
    'views/facility/FacilityForm.js',
    'views/event/EventPublishedShowcase.js',
    'views/home/HomeHub.js',
  ])('%s', (chemin) => {
    const source = readFileSync(join(__dirname, '..', '..', '..', '..', chemin), 'utf8');
    expect(source).toMatch(/useTourScroller\(/);
    expect(source).toMatch(/onScroll=\{tourScroll\.onScroll\}/);
  });
});
