import { useEffect, useRef, useState } from "preact/hooks";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

type Preset = "bexar" | "texas" | "national";

export interface AbuseIncidentPin {
  id: string;
  title: string;
  agency?: string;
  actor: string;
  summary: string;
  outcome?: string;
  category: string;
  sources: { url: string; outlet: string }[];
  lat: number;
  lng: number;
}

export interface WinPin {
  id: string;
  city: string;
  state: string;
  date: string;
  lat: number;
  lng: number;
  sourceUrl?: string;
}

interface Props {
  abuseIncidents: AbuseIncidentPin[];
  wins: WinPin[];
  defaultPreset?: Preset;
}

const PRESETS: Record<Preset, { center: [number, number]; zoom: number }> = {
  bexar: { center: [29.4241, -98.4936], zoom: 10 },
  texas: { center: [31.0, -99.0], zoom: 6 },
  national: { center: [39.8, -98.6], zoom: 4 },
};

// OSM tags are publicly editable, so any value could contain markup — never
// interpolate them into popup HTML unescaped.
function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

function cameraPopupHtml(props: Record<string, unknown>): string {
  const rows: string[] = ["<strong>ALPR camera</strong>"];
  const operator = props.operator ?? props["operator:en"];
  if (operator) rows.push(`Operator: ${escapeHtml(operator)}`);
  if (props.manufacturer) rows.push(`Manufacturer: ${escapeHtml(props.manufacturer)}`);
  if (props["camera:type"]) rows.push(`Type: ${escapeHtml(props["camera:type"])}`);
  if (props.osm_id) {
    rows.push(
      `<a href="https://www.openstreetmap.org/node/${encodeURIComponent(
        String(props.osm_id)
      )}" target="_blank" rel="noopener">View on OpenStreetMap →</a>`
    );
  }
  return rows.join("<br/>");
}

function abuseIncidentPopupHtml(incident: AbuseIncidentPin): string {
  const rows = [
    `<strong>${escapeHtml(incident.title)}</strong>`,
    escapeHtml(incident.summary),
  ];
  if (incident.outcome) rows.push(`<em>Outcome:</em> ${escapeHtml(incident.outcome)}`);
  for (const s of incident.sources) {
    rows.push(
      `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.outlet)} →</a>`
    );
  }
  return rows.join("<br/>");
}

function winPopupHtml(win: WinPin): string {
  const rows = [
    `<strong>${escapeHtml(win.city)}, ${escapeHtml(win.state)}</strong>`,
    `Flock contract canceled/rejected — ${escapeHtml(win.date)}`,
  ];
  if (win.sourceUrl) {
    rows.push(`<a href="${escapeHtml(win.sourceUrl)}" target="_blank" rel="noopener">Source →</a>`);
  }
  return rows.join("<br/>");
}

function pickNearestZoom(zoomLevels: number[], current: number): number {
  return zoomLevels.reduce((prev, z) =>
    Math.abs(z - current) < Math.abs(prev - current) ? z : prev
  );
}

function buildRawCameraClusterGroup(geojson: GeoJSON.FeatureCollection): L.MarkerClusterGroup {
  const group = L.markerClusterGroup({ chunkedLoading: true });
  const layer = L.geoJSON(geojson, {
    pointToLayer: (_feature, latlng) => L.circleMarker(latlng, { radius: 6, color: "#ff3b30", weight: 1, fillOpacity: 0.8 }),
    onEachFeature: (feature, layer) => {
      layer.bindPopup(cameraPopupHtml(feature.properties ?? {}));
    },
  });
  group.addLayer(layer);
  return group;
}

function buildNationalClusterLayer(features: GeoJSON.Feature[]): L.GeoJSON {
  return L.geoJSON(
    { type: "FeatureCollection", features } as GeoJSON.FeatureCollection,
    {
      pointToLayer: (feature, latlng) => {
        const isCluster = feature.properties?.cluster === true;
        if (isCluster) {
          const count = feature.properties.point_count as number;
          const radius = Math.min(10 + Math.log10(count) * 6, 28);
          return L.circleMarker(latlng, {
            radius,
            color: "#ff3b30",
            weight: 1,
            fillOpacity: 0.6,
          }).bindTooltip(String(feature.properties.point_count_abbreviated ?? count), {
            permanent: true,
            direction: "center",
            className: "cluster-count-label",
          });
        }
        return L.circleMarker(latlng, { radius: 5, color: "#ff3b30", weight: 1, fillOpacity: 0.8 });
      },
      onEachFeature: (feature, layer) => {
        if (feature.properties?.cluster !== true) {
          layer.bindPopup(cameraPopupHtml(feature.properties ?? {}));
        }
      },
    }
  );
}

export default function MapIsland({ abuseIncidents, wins, defaultPreset = "bexar" }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const cameraLayerRef = useRef<L.Layer | null>(null);
  const abuseLayerRef = useRef<L.LayerGroup | null>(null);
  const winsLayerRef = useRef<L.LayerGroup | null>(null);
  const nationalDataRef = useRef<{ zoomLevels: number[]; byZoom: Record<number, GeoJSON.Feature[]> } | null>(null);

  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [layersOn, setLayersOn] = useState({ cameras: true, abuse: true, wins: true });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      center: PRESETS[defaultPreset].center,
      zoom: PRESETS[defaultPreset].zoom,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map);

    const abuseLayer = L.layerGroup();
    const winsLayer = L.layerGroup();
    abuseLayerRef.current = abuseLayer;
    winsLayerRef.current = winsLayer;

    for (const incident of abuseIncidents) {
      L.circleMarker([incident.lat, incident.lng], {
        radius: 7,
        color: "#ffb300",
        weight: 2,
        fillOpacity: 0.7,
      })
        .bindPopup(abuseIncidentPopupHtml(incident))
        .addTo(abuseLayer);
    }
    for (const win of wins) {
      L.circleMarker([win.lat, win.lng], {
        radius: 7,
        color: "#34c759",
        weight: 2,
        fillOpacity: 0.7,
      })
        .bindPopup(winPopupHtml(win))
        .addTo(winsLayer);
    }
    abuseLayer.addTo(map);
    winsLayer.addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // abuseIncidents/wins are build-time props that don't change after mount
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const { center, zoom } = PRESETS[preset];
    map.setView(center, zoom);
  }, [preset]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    setStatus("loading");

    if (cameraLayerRef.current) {
      map.removeLayer(cameraLayerRef.current);
      cameraLayerRef.current = null;
    }

    async function load() {
      try {
        if (preset === "national") {
          const res = await fetch("/geo/cameras/national.clusters.json");
          const data = await res.json();
          if (cancelled) return;
          nationalDataRef.current = data;
          const nearestZoom = pickNearestZoom(data.zoomLevels, map!.getZoom());
          const layer = buildNationalClusterLayer(data.byZoom[nearestZoom]);
          if (layersOn.cameras) layer.addTo(map!);
          cameraLayerRef.current = layer;
        } else {
          const res = await fetch(`/geo/cameras/${preset}.geojson`);
          const geojson = await res.json();
          if (cancelled) return;
          const layer = buildRawCameraClusterGroup(geojson);
          if (layersOn.cameras) layer.addTo(map!);
          cameraLayerRef.current = layer;
        }
        if (!cancelled) setStatus("ready");
      } catch (err) {
        if (!cancelled) setStatus("error");
        console.error("Failed to load camera data", err);
      }
    }
    load();

    return () => {
      cancelled = true;
    };
    // layersOn.cameras is read only to decide initial visibility on (re)load
  }, [preset]);

  // re-render national clusters at the nearest precomputed zoom on zoomend
  useEffect(() => {
    const map = mapRef.current;
    if (!map || preset !== "national") return;
    function onZoomEnd() {
      const data = nationalDataRef.current;
      if (!data || !map) return;
      const nearestZoom = pickNearestZoom(data.zoomLevels, map.getZoom());
      if (cameraLayerRef.current) map.removeLayer(cameraLayerRef.current);
      const layer = buildNationalClusterLayer(data.byZoom[nearestZoom]);
      if (layersOn.cameras) layer.addTo(map);
      cameraLayerRef.current = layer;
    }
    map.on("zoomend", onZoomEnd);
    return () => {
      map.off("zoomend", onZoomEnd);
    };
  }, [preset, layersOn.cameras]);

  function toggleLayer(name: "cameras" | "abuse" | "wins") {
    const map = mapRef.current;
    if (!map) return;
    const nextOn = !layersOn[name];
    setLayersOn((prev) => ({ ...prev, [name]: nextOn }));

    const layerRef =
      name === "cameras" ? cameraLayerRef.current : name === "abuse" ? abuseLayerRef.current : winsLayerRef.current;
    if (!layerRef) return;
    if (nextOn) {
      layerRef.addTo(map);
    } else {
      map.removeLayer(layerRef);
    }
  }

  return (
    <div class="map-island">
      <div class="map-controls" role="group" aria-label="Map region presets">
        {(Object.keys(PRESETS) as Preset[]).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={preset === p}
            class={preset === p ? "preset-btn active" : "preset-btn"}
            onClick={() => setPreset(p)}
          >
            {p === "bexar" ? "Bexar County" : p === "texas" ? "Texas" : "National"}
          </button>
        ))}
      </div>

      <div class="map-layers" role="group" aria-label="Map layers">
        <label>
          <input type="checkbox" checked={layersOn.cameras} onChange={() => toggleLayer("cameras")} />
          Cameras
        </label>
        <label>
          <input type="checkbox" checked={layersOn.abuse} onChange={() => toggleLayer("abuse")} />
          Abuse incidents
        </label>
        <label>
          <input type="checkbox" checked={layersOn.wins} onChange={() => toggleLayer("wins")} />
          Canceled/rejected cities
        </label>
      </div>

      {status === "error" && (
        <p role="alert" class="map-error">
          Couldn't load camera data. Try refreshing the page.
        </p>
      )}

      <div
        ref={mapEl}
        class="map-canvas"
        aria-label="Interactive map of ALPR camera locations, abuse incidents, and cities that canceled Flock contracts"
      />

      <p class="map-attribution">
        Camera data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>, ODbL. Crowdsourced via{" "}
        <a href="https://www.deflock.me" target="_blank" rel="noopener">DeFlock.me</a>.{" "}
        <a href="https://wiki.openstreetmap.org/wiki/Key:man_made" target="_blank" rel="noopener">
          Report a camera →
        </a>
      </p>
    </div>
  );
}
