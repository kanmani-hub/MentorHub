import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApp } from '../../store/AppStore';

export const SERIES = { navy: '#1e3a8a', royal: '#3b6cf6', purple: '#7c5cf0', green: '#16a34a', orange: '#f59e0b', red: '#dc2626', grey: '#94a3b8', teal: '#0d9488' };

const useAxis = () => {
  const { dark } = useApp();
  return {
    tick: { fill: dark ? '#a3abbd' : '#667085', fontSize: 11 },
    grid: dark ? '#262d3d' : '#eceef3',
    tooltip: {
      contentStyle: { background: dark ? '#1f2533' : '#fff', border: `1px solid ${dark ? '#343c4e' : '#dde1ea'}`, borderRadius: 8, fontSize: 12, color: dark ? '#eceef3' : '#141924' },
      labelStyle: { fontWeight: 600, color: dark ? '#eceef3' : '#141924' },
      cursor: { fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(30,58,138,0.05)' },
    },
    dark,
  };
};

export interface BarSeries { key: string; name: string; color: string; stack?: string }
export function Bars({ data, x, series, height = 240, unit = '', layout = 'horizontal', max }: { data: Record<string, unknown>[]; x: string; series: BarSeries[]; height?: number; unit?: string; layout?: 'horizontal' | 'vertical'; max?: number }) {
  const a = useAxis();
  const vertical = layout === 'vertical';
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer>
        <BarChart data={data} layout={vertical ? 'vertical' : 'horizontal'} margin={{ top: 6, right: 12, left: vertical ? 4 : -14, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={a.grid} vertical={vertical} horizontal={!vertical} />
          {vertical ? (
            <>
              <XAxis type="number" tick={a.tick} axisLine={false} tickLine={false} unit={unit} domain={max ? [0, max] : undefined} />
              <YAxis type="category" dataKey={x} tick={a.tick} axisLine={false} tickLine={false} width={118} />
            </>
          ) : (
            <>
              <XAxis dataKey={x} tick={a.tick} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={a.tick} axisLine={false} tickLine={false} unit={unit} allowDecimals={false} domain={max ? [0, max] : undefined} />
            </>
          )}
          <Tooltip {...a.tooltip} formatter={(v: number) => `${v}${unit}`} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: a.tick.fill }} iconType="circle" iconSize={8} />}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} stackId={s.stack} radius={s.stack && i < series.length - 1 ? 0 : vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={vertical ? 16 : 28} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Lines({ data, x, series, height = 240, unit = '' }: { data: Record<string, unknown>[]; x: string; series: BarSeries[]; height?: number; unit?: string }) {
  const a = useAxis();
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 6, right: 12, left: -14, bottom: 0 }}>
          <CartesianGrid stroke={a.grid} vertical={false} />
          <XAxis dataKey={x} tick={a.tick} axisLine={false} tickLine={false} />
          <YAxis tick={a.tick} axisLine={false} tickLine={false} unit={unit} allowDecimals={false} />
          <Tooltip {...a.tooltip} cursor={{ stroke: a.grid }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />}
          {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.2} dot={{ r: 3, strokeWidth: 0, fill: s.color }} activeDot={{ r: 5 }} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ data, height = 200, center }: { data: { name: string; value: number; color: string }[]; height?: number; center?: { value: string; label: string } }) {
  const a = useAxis();
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div style={{ height, width: height }} className="relative shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={total ? data : [{ name: 'None', value: 1, color: a.grid }]} dataKey="value" innerRadius="62%" outerRadius="92%" paddingAngle={total ? 2 : 0} stroke="none">
              {(total ? data : [{ color: a.grid }]).map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            {total > 0 && <Tooltip {...a.tooltip} />}
          </PieChart>
        </ResponsiveContainer>
        {center && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="font-display text-xl font-extrabold tabular-nums text-ink-900 dark:text-ink-50">{center.value}</div>
              <div className="text-[11px] text-ink-500">{center.label}</div>
            </div>
          </div>
        )}
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-ink-600 dark:text-ink-300"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} /><span className="truncate">{d.name}</span></span>
            <span className="font-medium tabular-nums text-ink-900 dark:text-ink-100">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
