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

// RESA-CARTE (20/10/2026) — l'épingle d'un complexe porte son nombre de créneaux libres
// (`markerLabel`, planche EP01 état 2). La page Leaflet ne tourne que dans une WebView ou une
// iframe : le témoin du site (web, tests/components/resa-carte.spec.ts) lit l'épingle dessinée ;
// celui-ci garde, dans le texte de la page, les trois règles qui la font.
describe('RESA-CARTE — le mot de l’épingle', () => {
  it('passe avant le numéro d’ordre, échappé, et redessine l’épingle quand il change', () => {
    const html = buildHtml();

    expect(html).toContain('var markerLabel = itemLabel || (showSequenceLabel');
    expect(html).toContain('String(entry.item.markerLabel).replace(/[&<>"\']/g');
    expect(html).toContain("+ ':' + (item.markerLabel || '');");
  });
});

// RESA-CARTE (20/10/2026, branche intégrée) — à chaque appui, le clavier de Leaflet donne le
// FOCUS à la carte (container.focus()) et ne rétablit que le défilement de l'iframe. Si la carte
// dépasse du bas de l'écran, la page HÔTE défile pendant l'appui (180 px mesurés), le relâchement
// tombe ailleurs, le toucher est perdu (témoin web resa-carte.spec.ts, 1 360 px). Même focus (le
// clavier de la carte reste actif), mais SANS défilement.
describe('RESA-CARTE — l’appui sur la carte ne fait pas défiler la page', () => {
  it('le focus de l’appui est donné sans défilement', () => {
    const html = buildHtml();

    // Le clavier de Leaflet focalisait la carte à chaque appui, avec défilement.
    expect(html).toContain('this._map._container.focus({ preventScroll: true })');
  });
});
