import {
  buildSearchMapRuntimeHtml,
  buildTomTomTileUrl,
  LEGACY_TILE_PROVIDER,
  TOMTOM_TILE_PROVIDER,
} from '@/platform/maps/searchMapRuntime';

const buildHtml = (overrides = {}) => buildSearchMapRuntimeHtml({
  initialState: { items: [] },
  mapId: 'search-map-test-1',
  markerColor: '#ffd700',
  tileAttribution: overrides.tileAttribution ?? LEGACY_TILE_PROVIDER.attribution,
  tileProbeUrl: overrides.tileProbeUrl ?? '',
  tileUrl: overrides.tileUrl ?? LEGACY_TILE_PROVIDER.url,
});

describe('buildSearchMapRuntimeHtml', () => {
  it('renders OSM attribution as a copyright link with the a/b/c subdomains', () => {
    const html = buildHtml();

    expect(html).toContain('https://www.openstreetmap.org/copyright');
    expect(html).toContain('© OpenStreetMap contributors');
    expect(html).toContain('subdomains: ["a","b","c"],');
  });

  it('renders TomTom attribution as plain text with the a/b/c/d subdomains', () => {
    const html = buildHtml({
      tileAttribution: TOMTOM_TILE_PROVIDER.attribution,
      tileUrl: buildTomTomTileUrl('test-key'),
    });

    expect(html).toContain('© TomTom');
    expect(html).not.toContain('https://www.openstreetmap.org/copyright');
    expect(html).toContain('subdomains: ["a","b","c","d"],');
  });

  it('keeps the attribution badge visible in the generated document', () => {
    const html = buildHtml();

    expect(html).toContain('fc-provider-badge');
  });
});
