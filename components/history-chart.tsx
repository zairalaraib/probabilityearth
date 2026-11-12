"use client";
import {dataUrl} from "@/lib/urls";
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { ChartNoAxesCombined } from "lucide-react";
export default function HistoryChart({ token }: { token: string | undefined }) {
  const [interval, setInterval] = useState("1w"),
    [data, setData] = useState<{ t: number; p: number }[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    setData([]);
    setError(false);
    if (!token) return;
    const controller = new AbortController();
    setLoading(true);
    fetch(
      dataUrl(`history?token=${encodeURIComponent(token)}&interval=${interval}`),
      { signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((v) =>
        setData(
          (v.history ?? [])
            .filter((x: any) => Number.isFinite(x.t) && Number.isFinite(x.p))
            .map((x: any) => ({ t: x.t * 1000, p: x.p * 100 })),
        ),
      )
      .catch((e) => {
        if (e.name !== "AbortError") setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, interval]);
  return (
    <div className="history">
      <div className="chart-heading">
        <span>PROBABILITY HISTORY</span>
        <div>
          {[
            ["1d", "1D"],
            ["1w", "1W"],
            ["1m", "1M"],
            ["max", "ALL"],
          ].map(([v, l]) => (
            <button
              className={interval === v ? "selected" : ""}
              key={v}
              onClick={() => setInterval(v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="chart-body">
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 12, right: 0, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#ff69c5" stopOpacity={0.3} />
                  <stop offset="1" stopColor="#ff69c5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                stroke="#243036"
                strokeDasharray="3 5"
              />
              <XAxis
                dataKey="t"
                minTickGap={45}
                tickFormatter={(v) =>
                  new Date(v).toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                  })
                }
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#73848a", fontSize: 9 }}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: "#73848a", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#101d23",
                  border: "1px solid #33464c",
                  fontSize: 11,
                }}
                labelFormatter={(v) => new Date(Number(v)).toUTCString()}
                formatter={(v) => [`${Number(v).toFixed(1)}%`, "Probability"]}
              />
              <Area
                type="stepAfter"
                dataKey="p"
                stroke="#ff7bcf"
                strokeWidth={1.7}
                fill="url(#area)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="chart-empty">
            <ChartNoAxesCombined size={29} />
            <span>
              {loading
                ? "Fetching price history…"
                : error
                  ? "Historical data unavailable"
                  : token
                    ? "Insufficient historical data"
                    : "Select a market to explore its history"}
            </span>
            <small>Actual outcome prices · Polymarket CLOB</small>
          </div>
        )}
      </div>
    </div>
  );
}
