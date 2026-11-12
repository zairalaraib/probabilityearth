"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {mergeSnapshot} from "@/lib/snapshot";
import {dataUrl, basePath} from "@/lib/urls";
import {
  Globe2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Activity,
  Radio,
  Shield,
  ArrowRight,
  SlidersHorizontal,
  ExternalLink,
  Bookmark,
  PanelLeftClose,
  Info,
  Satellite,
  WifiOff,
  TrendingUp,
  Compass,
  Layers3,
  X,
  Clock3,
  ChevronDown,
} from "lucide-react";
import type { Category, Market, Snapshot } from "@/lib/types";
import { primary } from "@/lib/types";
import { countries, countryByIso } from "@/lib/countries";
import type { MapMode } from "@/components/world-map";
import HistoryChart from "@/components/history-chart";
const WorldMap = dynamic(() => import("@/components/world-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <Globe2 size={40} />
      <span>INITIALIZING WORLD ATLAS</span>
    </div>
  ),
});
const initial: Snapshot = {
  markets: [],
  feed: [],
  status: "CONNECTING",
  error: null,
  discoveredAt: null,
  discoveryComplete: false,
  pages: 0,
  lastMessageAt: null,
};
const cats: ("All markets" | Category)[] = [
  "All markets",
  "Conflict",
  "Elections",
  "Diplomacy",
  "Policy",
  "Sanctions",
  "Trade",
  "Leadership",
];
const money = (v: number) =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
const pct = (v: number | null | undefined) =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;
function Change({ v }: { v: number | null }) {
  return (
    <span
      className={`change ${v === null ? "muted" : v >= 0 ? "positive" : "negative"}`}
    >
      {v === null ? (
        "—"
      ) : (
        <>
          {v >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{" "}
          {Math.abs(v * 100).toFixed(1)} pp
        </>
      )}
    </span>
  );
}
function Empty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="empty-state">
      <Activity size={22} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}
export default function Home() {
  const [snapshot, setSnapshot] = useState(initial),
    [clock, setClock] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState<(typeof cats)[number]>("All markets"),
    [country, setCountry] = useState<string | null>(null),
    [mode, setMode] = useState<MapMode>("activity"),
    [marketId, setMarketId] = useState<string | null>(null),
    [tab, setTab] = useState("movers"),
    [direction, setDirection] = useState("all"),
    [period, setPeriod] = useState<"24h" | "1h">("24h"),
    [view, setView] = useState("Overview"),
    [saved, setSaved] = useState<string[]>([]),
    [showInfo, setShowInfo] = useState(false),
    [sidebar, setSidebar] = useState(true),
    [transportError, setTransportError] = useState(false),
    [countryFilter, setCountryFilter] = useState("");
  useEffect(() => {
    const s = localStorage.getItem("pe-watchlist");
    if (s)
      try {
        setSaved(JSON.parse(s));
      } catch {}
    const update = () => setClock(new Date().toISOString().slice(11, 19));
    update();
    const timer = window.setInterval(update, 1000);
    const source = new EventSource(dataUrl("stream"));
    source.onmessage = (e) => {
      try {
        setSnapshot(previous=>mergeSnapshot(previous,JSON.parse(e.data)));
        setTransportError(false);
      } catch {}
    };
    source.onerror = () => setTransportError(true);
    return () => {
      source.close();
      window.clearInterval(timer);
    };
  }, []);
  const save = (id: string) =>
    setSaved((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      localStorage.setItem("pe-watchlist", JSON.stringify(next));
      return next;
    });
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowInfo(false);
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        document
          .querySelector<HTMLInputElement>(
            '[aria-label="Search markets or countries"]',
          )
          ?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const markets = useMemo(
    () =>
      snapshot.markets.filter(
        (m) =>
          (category === "All markets" || m.category === category) &&
          (!query ||
            `${m.title} ${m.countries.map((c) => countryByIso(c)?.name).join(" ")}`
              .toLowerCase()
              .includes(query.toLowerCase())) &&
          (view !== "Watchlist" || saved.includes(m.id)) &&
          (!countryFilter || m.countries.includes(countryFilter)),
      ),
    [snapshot.markets, category, query, view, saved, countryFilter],
  );
  const selectedMarkets = country
    ? markets.filter((m) => m.countries.includes(country))
    : markets;
  const sorted = useMemo(
    () =>
      markets
        .filter((m) => {
          const v = period === "24h" ? m.change24h : m.change1h;
          return (
            tab === "volume" ||
            direction === "all" ||
            (v !== null && (direction === "up" ? v > 0 : v < 0))
          );
        })
        .sort((a, b) =>
          tab === "volume"
            ? b.volume24h - a.volume24h
            : Math.abs((period === "24h" ? b.change24h : b.change1h) ?? 0) -
              Math.abs((period === "24h" ? a.change24h : a.change1h) ?? 0),
        ),
    [markets, tab, period, direction],
  );
  const selectedMarket =
    selectedMarkets.find((m) => m.id === marketId) ?? selectedMarkets[0];
  const selectedCountry = country ? countryByIso(country) : null;
  const trackedCountries = new Set(
    snapshot.markets.flatMap((m) => m.countries),
  );
  const changed = useMemo(
    () =>
      snapshot.feed
        .filter((f) => Date.now() - Date.parse(f.at) < 8000)
        .flatMap((f) => f.countries),
    [snapshot.feed],
  );
  const chooseCountry = useCallback((iso: string) => {
    setCountry(iso);
    setMarketId(null);
  }, []);
  const status = transportError ? "STALE" : snapshot.status;
  const summary = [
    {
      label: "TRACKED MARKETS",
      value: snapshot.markets.length.toLocaleString(),
      sub: "Geopolitical contracts",
      icon: Activity,
    },
    {
      label: "24H TRADING VOLUME",
      value: snapshot.markets.length
        ? money(snapshot.markets.reduce((n, m) => n + m.volume24h, 0))
        : "—",
      sub: "Across tracked markets",
      icon: TrendingUp,
    },
    {
      label: "COUNTRIES IN FOCUS",
      value: trackedCountries.size.toString().padStart(2, "0"),
      sub: "With associated markets",
      icon: Globe2,
    },
    {
      label: "SIGNIFICANT MOVES",
      value: snapshot.markets.length
        ? snapshot.markets
            .filter((m) => Math.abs(m.change24h ?? 0) >= 0.05)
            .length.toString()
            .padStart(2, "0")
        : "—",
      sub: "≥ 5 percentage points / 24h",
      icon: Activity,
    },
  ];
  return (
    <main className="terminal">
      <header className="topbar">
        <a className="brand" href={`${basePath}/`} aria-label="Probability Earth home">
          <div className="brand-icon">
            <Globe2 size={27} strokeWidth={1.3} />
          </div>
          <div>
            PROBABILITY<span>EARTH</span>
          </div>
          <sup>BETA</sup>
        </a>
        <nav className="topnav">
          {["Overview", "Markets", "Watchlist"].map((t) => (
            <button
              key={t}
              onClick={() => setView(t)}
              className={view === t ? "active" : ""}
            >
              {t}
              {t === "Watchlist" && saved.length > 0 && <i>{saved.length}</i>}
            </button>
          ))}
        </nav>
        <div className="topbar-right">
          <span className={`connection ${status === "LIVE" ? "live" : ""}`}>
            <i />
            {status}
          </span>
          <span className="utc-clock">
            {clock || "--:--:--"} <small>UTC</small>
          </span>
          <button
            className="icon-button help"
            aria-label="About Probability Earth"
            onClick={() => setShowInfo(true)}
          >
            <Info size={17} />
          </button>
        </div>
      </header>
      <section className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> THE WORLD, IN PROBABILITIES
          </div>
          <h1>
            Global intelligence. <span>Market conviction.</span>
          </h1>
          <p>A real-time atlas of what the world thinks happens next.</p>
        </div>
        <div className="heading-aside">
          <div>
            <Radio size={14} />
            <span>POWERED BY POLYMARKET</span>
          </div>
          <small>Public markets. Collective intelligence.</small>
        </div>
      </section>
      <section className="summary-grid">
        {summary.map(({ label, value, sub, icon: Icon }) => (
          <div className="summary-card" key={label}>
            <div className="summary-top">
              {label}
              <Icon size={15} />
            </div>
            <div className="summary-value">
              {value}
              <span>
                {label === "TRACKED MARKETS" ? (
                  <>
                    <i className="tiny-dot" /> TRACKING
                  </>
                ) : label === "SIGNIFICANT MOVES" ? (
                  <span className="amber">24H ALERTS</span>
                ) : (
                  ""
                )}
              </span>
            </div>
            <div className="summary-sub">{sub}</div>
          </div>
        ))}
      </section>
      <div className="filterbar">
        <div className="category-filters">
          {cats.map((c, i) => (
            <button
              className={category === c ? "active" : ""}
              key={c}
              onClick={() => setCategory(c)}
            >
              {i === 0 ? (
                <Layers3 size={13} />
              ) : c === "Conflict" ? (
                <Shield size={12} />
              ) : null}
              {c}
            </button>
          ))}
        </div>
        <div className="filter-right">
          <label className="search-box">
            <Search size={14} />
            <input
              aria-label="Search markets or countries"
              placeholder="Search markets, countries…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>/</kbd>
          </label>
          <label className="country-filter">
            <SlidersHorizontal size={14} />
            <select
              aria-label="Filter countries"
              value={countryFilter}
              onChange={(e) => {
                setCountryFilter(e.target.value);
                if (e.target.value) chooseCountry(e.target.value);
              }}
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option value={c.iso} key={c.iso}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div
        className={`workspace ${!sidebar ? "sidebar-hidden" : ""} ${view === "Markets" ? "markets-view" : ""}`}
      >
        <aside className="intelligence panel">
          <div className="panel-header">
            <h2>
              <Activity size={15} /> Global intelligence
            </h2>
            <button
              className="icon-button"
              aria-label="Hide intelligence panel"
              onClick={() => setSidebar(false)}
            >
              <PanelLeftClose size={15} />
            </button>
          </div>
          <div className="sidebar-tabs">
            <button
              className={tab === "movers" ? "active" : ""}
              onClick={() => setTab("movers")}
            >
              Top movers
            </button>
            <button
              className={tab === "volume" ? "active" : ""}
              onClick={() => setTab("volume")}
            >
              Most active
            </button>
          </div>
          <div className="list-heading">
            <span>
              {tab === "volume" ? "VOLUME LEADERS" : "PROBABILITY MOVEMENT"}
            </span>
            <div className="period-toggle">
              {(["1h", "24h"] as const).map((p) => (
                <button
                  className={period === p ? "active" : ""}
                  key={p}
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="direction-filters">
            {[
              ["all", "All moves"],
              ["up", "↑ Rising"],
              ["down", "↓ Falling"],
            ].map(([v, l]) => (
              <button
                key={v}
                className={direction === v ? "active" : ""}
                onClick={() => {
                  setDirection(v);
                  setTab("movers");
                }}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="movers-list">
            {sorted.length ? (
              sorted.slice(0, 7).map((m, i) => (
                <button
                  key={m.id}
                  className={`mover ${selectedMarket?.id === m.id ? "chosen" : ""}`}
                  onClick={() => {
                    setMarketId(m.id);
                    if (m.countries[0]) setCountry(m.countries[0]);
                  }}
                >
                  <div className="mover-meta">
                    <span>
                      {countryByIso(m.countries[0])?.flag ?? "◎"}{" "}
                      {m.countries.map((c) => c).join(" / ") || "GLOBAL"}
                    </span>
                    <small
                      className={`category-label ${m.category.toLowerCase()}`}
                    >
                      {m.category}
                    </small>
                  </div>
                  <div className="mover-title">{m.title}</div>
                  <div className="mover-bottom">
                    <strong>{pct(primary(m)?.price)}</strong>
                    {tab === "volume" ? (
                      <span className="muted">{money(m.volume24h)} vol</span>
                    ) : (
                      <Change v={period === "24h" ? m.change24h : m.change1h} />
                    )}
                    <ChevronRight size={13} />
                  </div>
                </button>
              ))
            ) : (
              <Empty
                title={
                  view === "Watchlist"
                    ? "Your watchlist is empty"
                    : query
                      ? "No matching markets"
                      : "Awaiting market discovery"
                }
                detail={
                  view === "Watchlist"
                    ? "Bookmark a market to keep it in focus."
                    : query
                      ? "Try another country or search term."
                      : "Verified geopolitical contracts will appear here when the source connects."
                }
              />
            )}
          </div>
          <div className="intelligence-note">
            <div>
              <span className="tiny-dot" /> INTELLIGENCE NOTE
            </div>
            <p>
              Probabilities reflect market prices, not verified real-world
              likelihoods.
            </p>
            <button onClick={() => setShowInfo(true)}>
              How to read this terminal <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="sidebar-source">
            <span>DATA SOURCE</span>
            <a href="https://polymarket.com" target="_blank" rel="noreferrer">
              Polymarket <ExternalLink size={11} />
            </a>
          </div>
        </aside>
        <section className="map-panel panel">
          <div className="panel-header">
            <h2>
              <Globe2 size={15} /> World overview{" "}
              <span className="small-badge">{markets.length} MARKETS</span>
            </h2>
            <span className="map-status">
              <span className="tiny-dot" />
              {snapshot.discoveryComplete
                ? "DISCOVERY COMPLETE"
                : snapshot.pages
                  ? `SCANNING · PAGE ${snapshot.pages}`
                  : "PUBLIC MARKET DATA"}
            </span>
          </div>
          <div className="map-toolbar">
            <div className="map-mode-switch">
              {(
                [
                  ["activity", "Market activity"],
                  ["movements", "Probability moves"],
                  ["categories", "Category explorer"],
                ] as [MapMode, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setMode(v)}
                  className={mode === v ? "active" : ""}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === 'categories' && (<select className="explorer-select" aria-label="Explore market category" value={category} onChange={e=>setCategory(e.target.value as (typeof cats)[number])}>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>)}
            <button
              className="icon-button"
              aria-label="Show global intelligence"
              onClick={() => setSidebar(!sidebar)}
            >
              <Layers3 size={15} />
            </button>
          </div>
          <WorldMap
            markets={markets}
            selected={country}
            onSelect={chooseCountry}
            mode={mode}
            changed={changed}
          />
          <div className="map-bottom">
            <Compass size={13} />
            <span>
              Explore the map. Select a country to reveal its markets.
            </span>
            <span className="map-bottom-right">
              {trackedCountries.size} COUNTRIES TRACKED
            </span>
          </div>
        </section>
        <aside className="country-panel panel">
          <div className="panel-header">
            <h2>
              <Compass size={15} /> Country intelligence
            </h2>
            {country && (
              <button
                className="icon-button"
                aria-label="Clear country selection"
                onClick={() => setCountry(null)}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="country-heading">
            <span className="country-flag">
              {selectedCountry?.flag ?? <Globe2 size={32} strokeWidth={1} />}
            </span>
            <div>
              <div className="eyebrow">
                {country ? "COUNTRY IN FOCUS" : "YOUR GLOBAL PERSPECTIVE"}
              </div>
              <h3>
                {selectedCountry?.name ?? country ?? "The bigger picture"}
              </h3>
              <small>
                {country
                  ? `${selectedMarkets.length} active markets`
                  : "Select any country on the map"}{" "}
                <span>•</span> POLYMARKET
              </small>
            </div>
          </div>
          <div className="country-stats">
            <div>
              <span>24H VOLUME</span>
              <strong>
                {selectedMarkets.length
                  ? money(selectedMarkets.reduce((n, m) => n + m.volume24h, 0))
                  : "—"}
              </strong>
            </div>
            <div>
              <span>LIQUIDITY</span>
              <strong>
                {selectedMarkets.length
                  ? money(selectedMarkets.reduce((n, m) => n + m.liquidity, 0))
                  : "—"}
              </strong>
            </div>
          </div>
          <div className="section-label">
            {country ? "ASSOCIATED MARKETS" : "MARKETS IN FOCUS"}
            <span>{selectedMarkets.length.toString().padStart(2, "0")}</span>
          </div>
          <div className="country-markets">
            {selectedMarkets.map((m) => (
              <div
                className={`country-market ${selectedMarket?.id === m.id ? "selected" : ""}`}
                key={m.id}
              >
                <button
                  className="market-select"
                  onClick={() => setMarketId(m.id)}
                >
                  <span
                    className={`category-label ${m.category.toLowerCase()}`}
                  >
                    {m.category}
                  </span>
                  <h4>{m.title}</h4>
                  <div className="outcome-line">
                    <span>
                      {primary(m)?.label.toUpperCase()}{" "}
                      <b>{pct(primary(m)?.price)}</b>
                    </span>
                    <Change v={m.change24h} />
                  </div>
                  <div className="probability-bar">
                    <i
                      style={{ width: `${(primary(m)?.price ?? 0) * 100}%` }}
                    />
                  </div>
                </button>
                <div className="market-details">
                  <span>{money(m.volume24h)} vol / 24h</span>
                  <button
                    className={`icon-button ${saved.includes(m.id) ? "bookmarked" : ""}`}
                    onClick={() => save(m.id)}
                    aria-label={
                      saved.includes(m.id)
                        ? "Remove from watchlist"
                        : "Add to watchlist"
                    }
                  >
                    <Bookmark
                      size={12}
                      fill={saved.includes(m.id) ? "currentColor" : "none"}
                    />
                  </button>
                  <a
                    href={`https://polymarket.com/event/${m.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open original market"
                  >
                    <ArrowUpRight size={14} />
                  </a>
                </div>
                {selectedMarket?.id === m.id && (
                  <div className="market-extra">
                    <span>
                      1H <Change v={m.change1h} />
                    </span>
                    <span>
                      Ends{" "}
                      {m.endDate
                        ? new Date(m.endDate).toLocaleDateString("en", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "unavailable"}
                    </span>
                    <span>
                      {primary(m)?.source === "Midpoint"
                        ? "BID/ASK MIDPOINT"
                        : primary(m)?.source === "Trade"
                          ? "LAST EXECUTED TRADE"
                          : "GAMMA OUTCOME PRICE"}{" "}
                      ·{" "}
                      {new Date(
                        primary(m)?.updatedAt ?? m.updatedAt,
                      ).toLocaleTimeString("en-GB", { timeZone: "UTC" })}{" "}
                      UTC
                    </span>
                    {m.outcomes.length > 2 && (
                      <span>
                        {m.outcomes
                          .map((o) => `${o.label}: ${pct(o.price)}`)
                          .join(" · ")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!selectedMarkets.length && (
              <Empty
                title={
                  country ? "No associated markets" : "A world of possibilities"
                }
                detail={
                  country
                    ? "No verified country associations in the current discovery results."
                    : "Country-specific markets, probabilities, and liquidity will appear here."
                }
              />
            )}
          </div>
          <HistoryChart token={primary(selectedMarket)?.tokenId} />
        </aside>
      </div>
      <section className="event-panel panel">
        <div className="panel-header">
          <h2>
            <Radio size={15} />
            {view === "Watchlist" ? "Watchlist activity" : "Live event feed"}
            <span className="small-badge">{snapshot.feed.length} UPDATES</span>
          </h2>
          <span className="feed-status">
            <span className={`tiny-dot ${status !== "LIVE" ? "idle" : ""}`} />
            {status === "LIVE" ? "STREAMING" : "AWAITING CONNECTION"}
          </span>
        </div>
        <div className="feed-table">
          <div className="feed-row feed-labels">
            <span>TIME / UTC</span>
            <span>COUNTRY</span>
            <span>MARKET</span>
            <span>PROBABILITY</span>
            <span>CHANGE</span>
          </div>
          {snapshot.feed
            .filter((f) => markets.some((m) => m.id === f.marketId))
            .slice(0, 5)
            .map((f) => (
              <button
                className="feed-row"
                key={f.id}
                onClick={() => {
                  setMarketId(f.marketId);
                  if (f.countries[0]) setCountry(f.countries[0]);
                }}
              >
                <time>{f.at.slice(11, 19)}</time>
                <span>
                  {f.countries.map((c) => countryByIso(c)?.flag ?? c).join(" ")}{" "}
                  {f.countries.join(" / ") || "GLOBAL"}
                </span>
                <span className="feed-title">
                  {f.title}
                  <small>
                    {f.outcome} ·{" "}
                    {f.source === "Trade"
                      ? "EXECUTED TRADE"
                      : "MIDPOINT ESTIMATE"}
                  </small>
                </span>
                <span className="feed-prices">
                  {pct(f.old)} <ArrowRight size={12} /> <b>{pct(f.price)}</b>
                </span>
                <Change v={f.old === null ? null : f.price - f.old} />
              </button>
            ))}
          {!snapshot.feed.length && (
            <div className="feed-empty">
              <div className="radar-icon">
                <Radio size={18} />
              </div>
              <span>
                Listening for market movements
                <small>
                  New price updates will appear automatically. No simulated
                  activity.
                </small>
              </span>
              <div className="signal-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>
      </section>
      {(snapshot.error || transportError) && (
        <div className="error-banner">
          <WifiOff size={13} />
          <span>
            {transportError
              ? "Data service connection interrupted. Reconnecting automatically."
              : snapshot.error}
          </span>
          <span>Last known values retained</span>
        </div>
      )}
      <footer className="footer">
        <div>
          <span className="tiny-dot" /> PROBABILITY EARTH{" "}
          <span className="footer-divider">/</span> A SIGNAL IN THE NOISE.
        </div>
        <span>Market prices ≠ verified event probabilities.</span>
        <button onClick={() => setShowInfo(true)}>
          Methodology & sources <ArrowUpRight size={12} />
        </button>
      </footer>
      {showInfo && (
        <div className="modal-backdrop" onClick={() => setShowInfo(false)}>
          <section
            className="info-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              autoFocus
              className="modal-close icon-button"
              onClick={() => setShowInfo(false)}
              aria-label="Close methodology"
            >
              <X size={20} />
            </button>
            <Globe2 size={32} />
            <div className="eyebrow">TRANSPARENT BY DESIGN</div>
            <h2 id="about-title">The world, in probabilities.</h2>
            <p>
              Probability Earth maps public Polymarket contracts using explicit
              country-name and political-entity rules. Markets can belong to
              several countries. Unmatched countries show no data.
            </p>
            <p>
              Market activity counts associated contracts. Probability movements
              show the largest absolute 24-hour change, in percentage points.
              Neither metric is a geopolitical risk score.
            </p>
            <p>
              Gamma provides discovery and initial prices. WebSocket trades
              update executed prices; bid/ask changes provide clearly labeled
              midpoint estimates. Each outcome retains its own token ID. Missing
              histories and metrics stay unavailable.
            </p>
            <p>
              {snapshot.discoveryComplete
                ? "All discovery pages processed."
                : `Discovery incomplete${snapshot.pages ? ` · ${snapshot.pages} pages processed` : ""}.`}{" "}
              Last discovery:{" "}
              {snapshot.discoveredAt
                ? new Date(snapshot.discoveredAt).toUTCString()
                : "Unavailable"}
              .
            </p>
            <a
              href="https://docs.polymarket.com/market-data/realtime-data"
              target="_blank"
              rel="noreferrer"
            >
              Polymarket documentation <ExternalLink size={13} />
            </a>
          </section>
        </div>
      )}
    </main>
  );
}
