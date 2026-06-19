import { TimeSeriesChart, type TimeSeriesChartData } from './components/TimeSeriesChart';

const demoData: TimeSeriesChartData = {
  labels: ['10.06.2026', '11.06.2026', '12.06.2026', '13.06.2026', '14.06.2026'],
  area: [2.04, 28.6, 43.1, 55.65, 64.8],
  spline: [610.78, 180.1, 174.4, 56.33, 352.2],
  line: [3, 29, 34, 70, 88],
  bar: [0.68, 0.74, 0.81, 0.79, 0.72],
};

export function App() {
  return (
    <main className="page-shell">
      <section className="demo-panel">
        <div className="chart-heading">
          <h1>Mixed Time-Series Chart</h1>
          <p>Custom SVG implementation, 5 demo points.</p>
        </div>
        <TimeSeriesChart data={demoData} />
      </section>
    </main>
  );
}
