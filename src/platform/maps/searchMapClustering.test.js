import { buildSearchMapRenderableModel } from '@/platform/maps/searchMapClustering';

const SHARED_COORDS = { lat: 46.192777, lng: 2.237416 };

const buildColocatedItems = (count) => Array.from({ length: count }, (_, index) => ({
  id: `club-${index + 1}`,
  lat: SHARED_COORDS.lat,
  lng: SHARED_COORDS.lng,
}));

const buildViewport = (zoom) => ({
  east: SHARED_COORDS.lng + 0.05,
  north: SHARED_COORDS.lat + 0.05,
  south: SHARED_COORDS.lat - 0.05,
  west: SHARED_COORDS.lng - 0.05,
  zoom,
});

describe('buildSearchMapRenderableModel', () => {
  it('keeps co-located items clustered below the clustering max zoom', () => {
    const model = buildSearchMapRenderableModel({
      items: buildColocatedItems(6),
      viewport: buildViewport(12),
    });

    expect(model.stats.clusterCount).toBe(1);
    expect(model.stats.markerCount).toBe(0);
    const cluster = model.entries.find((entry) => entry.isCluster);
    expect(cluster.count).toBe(6);
    expect(cluster.expansionZoom).toBe(17);
  });

  it('spreads co-located items into distinct positions past the clustering max zoom', () => {
    const model = buildSearchMapRenderableModel({
      items: buildColocatedItems(6),
      viewport: buildViewport(17),
    });

    expect(model.stats.clusterCount).toBe(0);
    expect(model.stats.markerCount).toBe(6);

    const positions = new Set(model.entries.map((entry) => `${entry.lat},${entry.lng}`));
    expect(positions.size).toBe(6);

    model.entries.forEach((entry) => {
      expect(entry.isSpread).toBe(true);
      expect(Math.abs(entry.lat - SHARED_COORDS.lat)).toBeLessThan(0.001);
      expect(Math.abs(entry.lng - SHARED_COORDS.lng)).toBeLessThan(0.001);
    });
  });

  it('does not offset items that already have distinct coordinates', () => {
    const items = [
      { id: 'club-a', lat: 46.1, lng: 2.1 },
      { id: 'club-b', lat: 46.2, lng: 2.3 },
    ];
    const model = buildSearchMapRenderableModel({
      items,
      viewport: {
        east: 2.5, north: 46.4, south: 45.9, west: 1.9, zoom: 18,
      },
    });

    const byId = new Map(model.entries.map((entry) => [entry.itemId, entry]));
    expect(byId.get('club-a').lat).toBe(46.1);
    expect(byId.get('club-b').lng).toBe(2.3);
    model.entries.forEach((entry) => {
      expect(entry.isSpread).toBeUndefined();
    });
  });

  it('renders server aggregates as clusters with real counts', () => {
    const model = buildSearchMapRenderableModel({
      aggregates: [
        { count: 3521, lat: 48.85, lng: 2.35 },
        { count: 12, lat: 43.6, lng: 1.44 },
        { count: 0, lat: 45.0, lng: 5.0 },
        { count: 7, lat: Number.NaN, lng: 3.0 },
      ],
      items: [],
      viewport: {
        east: 9, north: 51, south: 42, west: -4, zoom: 5,
      },
    });

    expect(model.stats.aggregated).toBe(true);
    expect(model.stats.clusterCount).toBe(2);
    expect(model.stats.markerCount).toBe(0);
    expect(model.stats.dataCount).toBe(3533);
    model.entries.forEach((entry) => {
      expect(entry.isCluster).toBe(true);
      expect(entry.expansionZoom).toBe(8);
    });
  });

  it('ignores aggregates when none are valid and falls back to item clustering', () => {
    const model = buildSearchMapRenderableModel({
      aggregates: [],
      items: buildColocatedItems(3),
      viewport: buildViewport(12),
    });

    expect(model.stats.aggregated).toBeUndefined();
    expect(model.stats.clusterCount).toBe(1);
  });

  it('keeps clustering intact at exactly the clustering max zoom', () => {
    const model = buildSearchMapRenderableModel({
      items: buildColocatedItems(3),
      viewport: buildViewport(16),
    });

    expect(model.stats.clusterCount).toBe(1);
    expect(model.stats.markerCount).toBe(0);
  });
});
