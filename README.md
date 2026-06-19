# Time-Series Chart Test

React + Vite + TypeScript implementation of a mixed time-series chart rendered with custom SVG.

## Run

```bash
npm install
npm run dev
```

Open the URL printed by Vite.

## Build

```bash
npm run build
```

## Visual Check

```bash
npx playwright install chromium
npm run test:e2e
```

The test starts the Vite dev server, opens the chart in Chromium, checks hover behavior, and writes screenshots to `playwright-report-screens/`.

## Usage

```tsx
import { TimeSeriesChart, type TimeSeriesChartData } from './components/TimeSeriesChart';

const data: TimeSeriesChartData = {
  labels: ['10.06.2026', '11.06.2026', '12.06.2026', '13.06.2026'],
  area: [2.04, 28.6, 43.1, 55.65],
  spline: [610.78, 180.1, 174.4, 56.33],
  line: [3, 29, 34, 70],
  bar: [0.68, 0.74, 0.81, 0.79],
};

export function Example() {
  return <TimeSeriesChart data={data} width={1000} height={400} />;
}
```

All arrays must have the same non-zero length. The demo uses 5 points. The component supports more points; when there are more than 10 points, the chart canvas expands and the wrapper enables horizontal scrolling.

## Behavior

- `area`: yellow filled smooth area.
- `spline`: green smooth line.
- `line`: purple line with square markers.
- `bar`: blue short bars near the baseline.
- Hover inside the plot selects the nearest X point and shows a tooltip with smooth appear, move, data update, and disappear transitions.
- Hover markers are shown for `area`, `spline`, and `line`, but not for `bar`.
- Hovering the green spline path makes it thinner with a 0.5 second transition; leaving it restores the original thickness with the same transition.
