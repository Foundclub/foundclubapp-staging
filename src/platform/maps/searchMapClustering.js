import Supercluster from 'supercluster';

const DEFAULT_CLUSTER_RADIUS = 64;
const DEFAULT_MAX_ZOOM = 16;
const DEFAULT_MIN_POINTS = 2;
const FALLBACK_MARKER_LIMIT = 60;
// ~13 m : écarte visuellement les pins qui partagent exactement les mêmes
// coordonnées (géocodage au centroïde de commune) une fois le clustering dépassé.
const COLOCATED_SPREAD_RADIUS_DEG = 0.00012;

const clampZoom = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 11;
  }

  return Math.max(1, Math.min(20, Math.round(parsed)));
};

const hasFiniteViewportBounds = (viewport) => (
  Number.isFinite(Number(viewport?.north))
  && Number.isFinite(Number(viewport?.south))
  && Number.isFinite(Number(viewport?.east))
  && Number.isFinite(Number(viewport?.west))
);

const resolveViewportZoom = (viewport) => {
  const zoom = Number(viewport?.zoom);
  if (Number.isFinite(zoom)) {
    return clampZoom(zoom);
  }

  const longitudeDelta = Number(viewport?.longitudeDelta);
  if (Number.isFinite(longitudeDelta) && longitudeDelta > 0) {
    return clampZoom(Math.log2(360 / longitudeDelta));
  }

  return 11;
};

const buildFallbackBounds = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      east: 6,
      north: 44,
      south: 43,
      west: 5,
    };
  }

  const latitudes = items.map((item) => Number(item?.lat)).filter(Number.isFinite);
  const longitudes = items.map((item) => Number(item?.lng)).filter(Number.isFinite);
  const north = Math.max(...latitudes);
  const south = Math.min(...latitudes);
  const east = Math.max(...longitudes);
  const west = Math.min(...longitudes);

  return {
    east,
    north,
    south,
    west,
  };
};

const splitBoundsForQuery = (bounds) => {
  if (!hasFiniteViewportBounds(bounds)) {
    return [];
  }

  if (bounds.east >= bounds.west) {
    return [[bounds.west, bounds.south, bounds.east, bounds.north]];
  }

  return [
    [bounds.west, bounds.south, 180, bounds.north],
    [-180, bounds.south, bounds.east, bounds.north],
  ];
};

const buildFeature = (item, index) => ({
  geometry: {
    coordinates: [Number(item.lng), Number(item.lat)],
    type: 'Point',
  },
  properties: {
    fcIndex: index,
    itemId: item.id,
    order: index + 1,
  },
  type: 'Feature',
});

const spreadColocatedEntries = (entries) => {
  const groups = new Map();
  entries.forEach((entry) => {
    if (entry.isCluster) {
      return;
    }

    const key = `${entry.lat},${entry.lng}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(entry);
  });

  groups.forEach((group) => {
    if (group.length < 2) {
      return;
    }

    const sortedGroup = [...group].sort((left, right) => (
      String(left.itemId).localeCompare(String(right.itemId))
    ));
    const latRadians = (Number(sortedGroup[0].lat) * Math.PI) / 180;
    const lngScale = Math.max(Math.cos(latRadians), 0.2);
    sortedGroup.forEach((entry, index) => {
      const angle = (2 * Math.PI * index) / sortedGroup.length;
      entry.isSpread = true;
      entry.lat += COLOCATED_SPREAD_RADIUS_DEG * Math.cos(angle);
      entry.lng += (COLOCATED_SPREAD_RADIUS_DEG * Math.sin(angle)) / lngScale;
    });
  });

  return entries;
};

const buildFallbackEntries = (items) => items.slice(0, FALLBACK_MARKER_LIMIT).map((item, index) => ({
  isCluster: false,
  item,
  itemId: item.id,
  key: item.id || `fallback-${index}`,
  lat: Number(item.lat),
  lng: Number(item.lng),
  order: index + 1,
}));

export const buildSearchMapRenderableModel = ({
  aggregates = null,
  items = [],
  viewport = null,
} = {}) => {
  const zoom = resolveViewportZoom(viewport);
  const safeAggregates = (Array.isArray(aggregates) ? aggregates : []).filter((cell) => (
    cell
    && Number(cell.count) > 0
    && Number.isFinite(Number(cell.lat))
    && Number.isFinite(Number(cell.lng))
  ));

  // Agrégats serveur (vue large) : rendus tels quels comme clusters avec le
  // compte réel — le clustering local ne s'applique pas.
  if (safeAggregates.length) {
    const entries = safeAggregates.map((cell) => ({
      count: Number(cell.count),
      // Un clic rapproche vers le niveau de détail suivant (agrégats plus fins,
      // puis vrais clubs à partir du zoom 9).
      expansionZoom: Math.min(zoom + 3, 10),
      isCluster: true,
      key: `aggregate:${cell.lat}:${cell.lng}`,
      lat: Number(cell.lat),
      lng: Number(cell.lng),
    }));

    return {
      entries,
      stats: {
        aggregated: true,
        clusterCount: entries.length,
        dataCount: entries.reduce((total, entry) => total + entry.count, 0),
        fallbackActive: false,
        markerCount: 0,
        renderableCount: entries.length,
      },
      zoom,
    };
  }

  const safeItems = (Array.isArray(items) ? items : []).filter((item) => (
    item
    && Number.isFinite(Number(item?.lat))
    && Number.isFinite(Number(item?.lng))
  ));

  if (!safeItems.length) {
    return {
      entries: [],
      stats: {
        clusterCount: 0,
        dataCount: 0,
        fallbackActive: false,
        markerCount: 0,
        renderableCount: 0,
      },
      zoom,
    };
  }

  const clusterIndex = new Supercluster({
    maxZoom: DEFAULT_MAX_ZOOM,
    minPoints: DEFAULT_MIN_POINTS,
    radius: DEFAULT_CLUSTER_RADIUS,
  });

  clusterIndex.load(safeItems.map((item, index) => buildFeature(item, index)));

  const bounds = hasFiniteViewportBounds(viewport) ? viewport : buildFallbackBounds(safeItems);
  // Au-delà du maxZoom de clustering (17+), interroger à maxZoom+1 renvoie les
  // points bruts : les groupes aux coordonnées identiques deviennent séparables.
  const rawClusters = splitBoundsForQuery(bounds)
    .flatMap((bbox) => clusterIndex.getClusters(bbox, Math.min(zoom, DEFAULT_MAX_ZOOM + 1)));

  const entriesByKey = new Map();
  rawClusters.forEach((feature) => {
    const [lng, lat] = feature?.geometry?.coordinates || [];
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
      return;
    }

    if (feature?.properties?.cluster) {
      const clusterId = Number(feature.properties.cluster_id);
      const key = `cluster:${clusterId}`;
      if (entriesByKey.has(key)) {
        return;
      }

      entriesByKey.set(key, {
        count: Number(feature.properties.point_count || 0),
        expansionZoom: clusterIndex.getClusterExpansionZoom(clusterId),
        isCluster: true,
        key,
        lat: Number(lat),
        lng: Number(lng),
      });
      return;
    }

    const itemIndex = Number(feature?.properties?.fcIndex);
    const item = safeItems[itemIndex];
    if (!item) {
      return;
    }

    entriesByKey.set(`item:${item.id}`, {
      isCluster: false,
      item,
      itemId: item.id,
      key: item.id,
      lat: Number(item.lat),
      lng: Number(item.lng),
      order: Number(feature?.properties?.order || (itemIndex + 1)),
    });
  });

  let entries = Array.from(entriesByKey.values());
  let fallbackActive = false;

  if (!entries.length) {
    fallbackActive = true;
    entries = buildFallbackEntries(safeItems);
  }

  if (zoom > DEFAULT_MAX_ZOOM) {
    spreadColocatedEntries(entries);
  }

  const markerCount = entries.filter((entry) => !entry.isCluster).length;
  const clusterCount = entries.filter((entry) => entry.isCluster).length;

  return {
    entries,
    stats: {
      clusterCount,
      dataCount: safeItems.length,
      fallbackActive,
      markerCount,
      renderableCount: entries.length,
    },
    zoom,
  };
};

export default {
  buildSearchMapRenderableModel,
};
