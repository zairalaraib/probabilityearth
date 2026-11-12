"use client";
import {assetUrl} from "@/lib/urls";
import { useEffect, useRef, useState } from "react";
import maplibregl, { Map as GLMap, Popup } from "maplibre-gl";
import { Plus, Minus, LocateFixed, Globe2, Maximize2 } from "lucide-react";
import { countries, countryByIso } from "@/lib/countries";
import type { Market } from "@/lib/types";
export type MapMode = "activity" | "movements" | "categories";
export default function WorldMap({
  markets,
  selected,
  onSelect,
  mode,
  changed,
}: {
  markets: Market[];
  selected: string | null;
  onSelect: (s: string) => void;
  mode: MapMode;
  changed: string[];
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<GLMap | null>(null),
    props = useRef({ markets, selected, onSelect, mode });
  props.current = { markets, selected, onSelect, mode };
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    setLoaded(false);
    let m: GLMap;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style: {
          version: 8,
          sources: {
            countries: {
              type: "geojson",
              data: assetUrl("countries.geojson"),
              promoteId: "ISO3166-1-Alpha-2",
            },
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#09162d" },
            },
            {
              id: "land",
              type: "fill",
              source: "countries",
              paint: { "fill-color": "#1b3152", "fill-opacity": 0.95 },
            },
            {
              id: "borders",
              type: "line",
              source: "countries",
              paint: {
                "line-color": "#3e5b83",
                "line-width": 0.65,
                "line-opacity": 0.7,
              },
            },
            {
              id: "selected",
              type: "line",
              source: "countries",
              filter: ["==", ["get", "ISO3166-1-Alpha-2"], ""],
              paint: { "line-color": "#ff8ed1", "line-width": 1.7 },
            },
          ],
        },
        center: [16, 23],
        zoom: 0.65,
        minZoom: 0.3,
        maxZoom: 7,
        attributionControl: false,
        renderWorldCopies: false,
      });
      map.current = m;
      m.on("load", () => {
        setLoaded(true);
        m.resize();
      });
      m.on("error", () => setError(true));
      const popup = new Popup({
        closeButton: false,
        closeOnClick: false,
        className: "country-tooltip",
      });
      m.on("mousemove", "land", (e) => {
        m.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0];
        if (!f) return;
        const iso = String(f.properties?.["ISO3166-1-Alpha-2"]),
          p = props.current,
          items = p.markets.filter((x) => x.countries.includes(iso));
        const node = document.createElement("div");
        node.textContent = `${f.properties?.name} · ${items.length ? `${items.length} markets` : "NO DATA"}`;
        popup.setLngLat(e.lngLat).setDOMContent(node).addTo(m);
      });
      m.on("mouseleave", "land", () => {
        m.getCanvas().style.cursor = "";
        popup.remove();
      });
      m.on("click", "land", (e) => {
        const iso = e.features?.[0]?.properties?.["ISO3166-1-Alpha-2"];
        if (iso && iso !== "-99") props.current.onSelect(iso);
      });
      const resize = new ResizeObserver(() => m.resize());
      resize.observe(container.current);
      return () => {
        resize.disconnect();
        popup.remove();
        m.remove();
        map.current = null;
      };
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    const m = map.current;
    if (!m || !loaded || !m.isStyleLoaded()) return;
    const counts = new Map<string, number>();
    for (const market of markets)
      for (const iso of market.countries) {
        if (mode === "movements" && market.change24h === null) continue;
        const v =
          mode === "movements" ? Math.abs(market.change24h ?? 0) * 100 : 1;
        counts.set(
          iso,
          mode === "movements"
            ? Math.max(counts.get(iso) ?? 0, v)
            : (counts.get(iso) ?? 0) + v,
        );
      }
    const colors: any[] = ["match", ["get", "ISO3166-1-Alpha-2"]];
    for (const [iso, n] of counts)
      colors.push(
        iso,
        mode === "movements"
          ? n > 10
            ? "#ffad61"
            : n > 3
              ? "#e36bb0"
              : "#654a7e"
          : n > 20
            ? "#65bfea"
            : n > 5
              ? "#3475a7"
              : "#254b77",
      );
    colors.push("#1b3152");
    m.setPaintProperty("land", "fill-color", counts.size ? colors : "#1b3152");
    m.setFilter("selected", [
      "==",
      ["get", "ISO3166-1-Alpha-2"],
      selected ?? "",
    ]);
    const markers: countriesMarker[] = [];
    for (const c of countries) {
      const n = counts.get(c.iso);
      if (!n) continue;
      const el = document.createElement("button");
      el.className = `map-marker ${changed.includes(c.iso) ? "updated" : ""} ${selected === c.iso ? "active" : ""}`;
      el.setAttribute(
        "aria-label",
        `${c.name}, ${n} ${mode === "movements" ? "percentage point movement" : "markets"}`,
      );
      el.innerHTML = `<span class="marker-core"></span><span class="marker-label">${c.name.toUpperCase()} <b>${mode === "movements" ? n.toFixed(1) + "pp" : n}</b></span>`;
      el.onclick = () => onSelect(c.iso);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(c.center)
        .addTo(m);
      markers.push(marker);
    }
    return () => markers.forEach((v) => v.remove());
  }, [markets, selected, mode, loaded, onSelect, changed]);
  useEffect(() => {
    if (!selected) return;
    const c = countries.find(c=>c.iso===selected);
    if (c) map.current?.flyTo({ center: c.center, zoom: 2.3, duration: 1100 });
  }, [selected]);
  return (
    <div className={`world-map mode-${mode}`}>
      <div ref={container} className="map-canvas" />
      {error && !loaded && (
        <div className="map-error">
          Map renderer unavailable. Explore countries using the country
          selector.
        </div>
      )}
      <div className="map-grid" />
      <div className="map-caption">
        <span className="tiny-dot" /> GLOBAL COVERAGE{" "}
        <span className="muted">/ MERCATOR</span>
      </div>
      <div className="map-controls">
        <button aria-label="Zoom in" onClick={() => map.current?.zoomIn()}>
          <Plus size={16} />
        </button>
        <button aria-label="Zoom out" onClick={() => map.current?.zoomOut()}>
          <Minus size={16} />
        </button>
        <span />
        <button
          aria-label="Reset world view"
          onClick={() => map.current?.flyTo({ center: [16, 23], zoom: 0.65 })}
        >
          <LocateFixed size={16} />
        </button>
        <button
          aria-label="Fullscreen map"
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen();
            else void container.current?.parentElement?.requestFullscreen();
          }}
        >
          <Maximize2 size={15} />
        </button>
      </div>
      <div className="map-coordinate">
        <Globe2 size={12} /> COUNTRY BOUNDARIES · NATURAL EARTH
      </div>
      <div className="map-legend">
        <span>
          {mode === "movements" ? "LARGEST 24H MOVE" : "ACTIVE MARKETS"}
        </span>
        <div className="legend-scale">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <span>{mode === "movements" ? "0 — 10+ pp" : "1 — 20+"}</span>
        <em>■ No data</em>
      </div>
      <a
        className="map-attribution"
        href="https://www.naturalearthdata.com/"
        target="_blank"
        rel="noreferrer"
      >
        Natural Earth · MapLibre
      </a>
    </div>
  );
}
type countriesMarker = maplibregl.Marker;
