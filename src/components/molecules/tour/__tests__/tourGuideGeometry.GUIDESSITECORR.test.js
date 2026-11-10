import { planSiteReveal } from '@/components/molecules/tour/tourGuideGeometry';

// GUIDES-SITE-CORR (tournée du site du 09/11) : ce que le défilement automatique du site ramène,
// et vers quel bord. Zone utile 0 → 844 (390), puis 0 → 900 (1360).

describe('planSiteReveal', () => {
  test('S10 : une longue liste dont le haut est visible ne défile pas (avant : son milieu)', () => {
    expect(planSiteReveal([{ box: { height: 2400, y: 120 }, id: 'teamWizard.field' }], 0, 844))
      .toBeNull();
  });

  test('une longue liste dont le haut est sous l écran : son haut sous l en-tête', () => {
    expect(planSiteReveal([{ box: { height: 2400, y: 1200 }, id: 'list' }], 60, 844))
      .toEqual({ block: 'start', id: 'list' });
  });

  test('S14 : « Suivant » juste sous le bas, au plus court', () => {
    expect(planSiteReveal([
      { box: { height: 112, y: 160 }, id: 'tour.bubbleSlot' },
      { box: { height: 560, y: 310 }, id: 'teamWizard.field' },
      { box: { height: 48, y: 900 }, id: 'teamWizard.next' },
    ], 0, 900)).toEqual({ block: 'nearest', id: 'teamWizard.next' });
  });

  test('S26 : jamais au prix de la place de la bulle déjà visible', () => {
    expect(planSiteReveal([
      { box: { height: 112, y: 40 }, id: 'tour.bubbleSlot' },
      { box: { height: 48, y: 1600 }, id: 'teamWizard.next' },
    ], 0, 844)).toBeNull();
  });

  test('S20 : la place de la bulle à moitié au-dessus de la fenêtre revient la première', () => {
    expect(planSiteReveal([
      { box: { height: 112, y: -60 }, id: 'tour.bubbleSlot' },
      { box: { height: 900, y: 60 }, id: 'teamWizard.field' },
    ], 0, 900)).toEqual({ block: 'nearest', id: 'tour.bubbleSlot' });
  });

  test('tout est à l écran : rien', () => {
    expect(planSiteReveal([{ box: { height: 48, y: 400 }, id: 'b' }], 0, 844)).toBeNull();
  });
});
