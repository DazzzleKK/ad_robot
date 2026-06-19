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

## Initialize Data

The demo loads chart data from `public/data.json`. Edit that file and refresh the page to initialize the chart with your own data.

You can also use the controls under the chart:

- **Add point**: choose a date with the native browser date picker and enter values for any series. Empty fields are skipped, so leaving `CPA` empty means no `bar` point is created for that date.
- **Data JSON**: paste full JSON and click **Apply** without editing source files.

Expected JSON shape:

```json
{
  "area": [
    { "date": "10.06.2026", "value": 28.6 },
    { "date": "11.06.2026", "value": 28.6 },
    { "date": "12.06.2026", "value": 43.1 },
    { "date": "14.06.2026", "value": 64.8 }
  ],
  "spline": [
    { "date": "10.06.2026", "value": 610.78 },
    { "date": "13.06.2026", "value": 56.33 }
  ],
  "line": [
    { "date": "10.06.2026", "value": 3 },
    { "date": "13.06.2026", "value": 70 }
  ],
  "bar": [
    { "date": "10.06.2026", "value": 0.68 },
    { "date": "13.06.2026", "value": 0.79 }
  ]
}
```

## Component API

```tsx
import { TimeSeriesChart, type TimeSeriesChartData } from './components/TimeSeriesChart';

export function Example() {
  return <TimeSeriesChart data={data} width={1000} height={400} />;
}
```

Each chart series is an array of point DTOs:

```ts
type TimeSeriesChartPoint = {
  date: string;
  value: number;
};
```

To add a point, add an object to the series that has data for that date:

```ts
area.push({ date: '13.06.2026', value: 55.65 });
spline.push({ date: '13.06.2026', value: 56.33 });
line.push({ date: '13.06.2026', value: 70 });
bar.push({ date: '13.06.2026', value: 0.79 });
```

Dates may be skipped in any series. The component builds the chart from the union of all dates. If a series has no point for the hovered date, the tooltip shows `-` for that value and no hover marker is drawn for that series on that date.

JSON dates use the `DD.MM.YYYY` format. The add-point form converts browser date picker values to that format. Dates are sorted chronologically. The chart container stays `1000x450` by default. Use the scale slider and minimap under the plot to zoom into a date range and move the visible window.

## Behavior

- `area`: yellow filled smooth area.
- `spline`: green smooth line.
- `line`: purple line with square markers.
- `bar`: blue short bars near the baseline.
- Hover inside the plot selects the nearest X point and shows a tooltip with smooth appear, move, data update, and disappear transitions.
- Hover markers are shown for `area`, `spline`, and `line`, but not for `bar`.
- Hovering the green spline path makes it thinner with a 0.5 second transition; leaving it restores the original thickness with the same transition.
