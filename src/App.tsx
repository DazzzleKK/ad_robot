import { useEffect, useState } from 'react';
import { TimeSeriesChart, type TimeSeriesChartData } from './components/TimeSeriesChart';

const fallbackData: TimeSeriesChartData = {
  area: [
    { date: '10.06.2026', value: 28.6 },
    { date: '11.06.2026', value: 28.6 },
    { date: '12.06.2026', value: 43.1 },
    { date: '14.06.2026', value: 64.8 },
  ],
  spline: [
    { date: '10.06.2026', value: 610.78 },
    { date: '11.06.2026', value: 180.1 },
    { date: '12.06.2026', value: 174.4 },
    { date: '13.06.2026', value: 56.33 },
    { date: '14.06.2026', value: 352.2 },
  ],
  line: [
    { date: '10.06.2026', value: 3 },
    { date: '11.06.2026', value: 29 },
    { date: '12.06.2026', value: 34 },
    { date: '13.06.2026', value: 70 },
    { date: '14.06.2026', value: 88 },
  ],
  bar: [
    { date: '10.06.2026', value: 0.68 },
    { date: '11.06.2026', value: 0.74 },
    { date: '12.06.2026', value: 0.81 },
    { date: '13.06.2026', value: 0.79 },
    { date: '14.06.2026', value: 0.72 },
  ],
};

const isChartData = (value: unknown): value is TimeSeriesChartData => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeData = value as Record<string, unknown>;
  const seriesNames = ['area', 'spline', 'line', 'bar'];

  return seriesNames.every((seriesName) => {
    const series = maybeData[seriesName];

    return Array.isArray(series) && series.every((point) => (
      point &&
      typeof point === 'object' &&
      typeof (point as { date?: unknown }).date === 'string' &&
      typeof (point as { value?: unknown }).value === 'number'
    ));
  });
};

export function App() {
  const [data, setData] = useState<TimeSeriesChartData>(fallbackData);
  const [jsonInput, setJsonInput] = useState(() => JSON.stringify(fallbackData, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/data.json');

        if (!response.ok) {
          throw new Error(`Failed to load /data.json: ${response.status}`);
        }

        const nextData: unknown = await response.json();

        if (!isChartData(nextData)) {
          throw new Error('/data.json does not match TimeSeriesChartData.');
        }

        setData(nextData);
        setJsonInput(JSON.stringify(nextData, null, 2));
        setError(null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load /data.json.');
      }
    };

    void loadData();
  }, []);

  const applyJson = () => {
    try {
      const nextData: unknown = JSON.parse(jsonInput);

      if (!isChartData(nextData)) {
        throw new Error('JSON must contain area, spline, line and bar arrays with { date, value } points.');
      }

      setData(nextData);
      setError(null);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Invalid JSON.');
    }
  };

  return (
    <main className="page-shell">
      <section className="demo-panel">
        <div className="chart-heading">
          <h1>Mixed Time-Series Chart</h1>
          <p>Custom SVG implementation, JSON-configurable data.</p>
        </div>
        <TimeSeriesChart data={data} />

        <details className="data-editor">
          <summary>Data JSON</summary>
          <textarea
            className="data-editor__textarea"
            value={jsonInput}
            spellCheck={false}
            onChange={(event) => setJsonInput(event.target.value)}
          />
          <div className="data-editor__footer">
            <button className="data-editor__button" type="button" onClick={applyJson}>
              Apply
            </button>
            {error && <span className="data-editor__error">{error}</span>}
          </div>
        </details>
      </section>
    </main>
  );
}
