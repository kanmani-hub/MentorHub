import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApp } from '../../store/AppStore';

/** muted chart colours that hold up on both white and deep-slate backgrounds */
export const SERIES = { navy: '#5f7cc4', royal: '#7f98d0', purple: '#8578c4', green: '#5aa67c', orange: '#d0a253', red: '#c9786f', grey: '#98a2b3', teal: '#5ea39a' };

const useAxis = () => {
  const { dark } = useApp();
  return {
    tick: { fill: dark ? '#9aa3b2' : '#626d7f', fontSize: 12 },
    grid: dark ? '#2b323e' : '#eef0f3',
    tooltip: {
      contentStyle: { background: dark ? '#2b323e' : '#fff', border: `1px solid ${dark ? '#3a4352' : '#e1e5ea'}`, borderRadius: 8, fontSize: 12.5, color: dark ? '#e4e7ec' : '#1d222b' },
      labelStyle: { fontWeight: 600, color: dark ? '#e4e7ec' : '#1d222b' },
      cursor: { fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(74,103,177,0.05)' },
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
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: a.tick.fill }} iconType="circle" iconSize={8} />}
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
              <div className="text-xs text-ink-500">{center.label}</div>
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
