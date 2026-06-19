import { useMemo, useRef, useState, type MouseEvent } from 'react';

export type TimeSeriesChartData = {
  labels: string[];
  area: number[];
  spline: number[];
  line: number[];
  bar: number[];
};

type Point = {
  x: number;
  y: number;
  value: number;
};

type ChartSeries = 'area' | 'spline' | 'line' | 'bar';

type Props = {
  data: TimeSeriesChartData;
  width?: number;
  height?: number;
  visiblePoints?: number;
};

const colors: Record<ChartSeries, string> = {
  area: '#fff27a',
  spline: '#0a8c00',
  line: '#b800f3',
  bar: '#2f70f3',
};

const labels: Record<ChartSeries, string> = {
  area: 'Cost',
  spline: 'ROI confirmed',
  line: 'Conversions',
  bar: 'CPA',
};

const seriesOrder: ChartSeries[] = ['area', 'bar', 'spline', 'line'];
const splineHoverRadius = 35;

const formatValue = (value: number) =>
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getRange = (values: number[]) => {
  const min = Math.min(0, ...values);
  const max = Math.max(...values);

  return {
    min,
    span: max - min || 1,
  };
};

const distanceToSegment = (x: number, y: number, start: Point, end: Point) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) {
    return Math.hypot(x - start.x, y - start.y);
  }

  const t = clamp(((x - start.x) * dx + (y - start.y) * dy) / lengthSquared, 0, 1);
  const projectionX = start.x + t * dx;
  const projectionY = start.y + t * dy;

  return Math.hypot(x - projectionX, y - projectionY);
};

const validateData = (data: TimeSeriesChartData) => {
  const size = data.labels.length;
  const everySeriesMatches = data.area.length === size && data.spline.length === size && data.line.length === size && data.bar.length === size;

  if (!size || !everySeriesMatches) {
    throw new Error('TimeSeriesChart expects labels, area, spline, line and bar arrays with the same non-zero length.');
  }
};

const createLinePath = (points: Point[]) => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

const createSmoothPath = (points: Point[]) => {
  if (points.length < 2) {
    return points[0] ? `M ${points[0].x} ${points[0].y}` : '';
  }

  const commands = [`M ${points[0].x} ${points[0].y}`];

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const previous = points[index - 1] ?? current;
    const afterNext = points[index + 2] ?? next;
    const smoothing = 0.18;
    const cp1x = current.x + (next.x - previous.x) * smoothing;
    const cp1y = current.y + (next.y - previous.y) * smoothing;
    const cp2x = next.x - (afterNext.x - current.x) * smoothing;
    const cp2y = next.y - (afterNext.y - current.y) * smoothing;

    commands.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`);
  }

  return commands.join(' ');
};

export function TimeSeriesChart({ data, width = 1000, height = 400, visiblePoints = 10 }: Props) {
  validateData(data);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipIndex, setTooltipIndex] = useState(0);
  const [tooltipPoint, setTooltipPoint] = useState({ x: 0, y: 0 });
  const [isSplineHovered, setIsSplineHovered] = useState(false);

  const metrics = useMemo(() => {
    const chart = {
      x: 82,
      y: 20,
      width: Math.max(590, data.labels.length > visiblePoints ? 590 + (data.labels.length - visiblePoints) * 110 : 590),
      height: 294,
    };
    const canvasWidth = data.labels.length > visiblePoints ? chart.width + 220 : width;
    const canvasHeight = height;
    const bottom = chart.y + chart.height;
    const areaRange = getRange(data.area);
    const splineRange = getRange(data.spline);
    const lineRange = getRange(data.line);
    const barRange = getRange(data.bar);
    const xStep = data.labels.length === 1 ? 0 : (chart.width - 112) / (data.labels.length - 1);
    const xForIndex = (index: number) => chart.x + 60 + index * xStep;
    const yForAreaValue = (value: number) => bottom - ((value - areaRange.min) / areaRange.span) * 250;
    const yForSplineValue = (value: number) => bottom - ((value - splineRange.min) / splineRange.span) * 240;
    const yForLineValue = (value: number) => bottom - ((value - lineRange.min) / lineRange.span) * 220 - 4;
    const yForBarValue = (value: number) => bottom - Math.max(3, ((value - barRange.min) / barRange.span) * 12);

    const areaPoints = data.area.map((value, index) => ({ x: xForIndex(index), y: yForAreaValue(value), value }));
    const splinePoints = data.spline.map((value, index) => ({ x: xForIndex(index), y: yForSplineValue(value), value }));
    const linePoints = data.line.map((value, index) => ({ x: xForIndex(index), y: yForLineValue(value), value }));
    const barPoints = data.bar.map((value, index) => ({ x: xForIndex(index), y: yForBarValue(value), value }));

    return {
      chart,
      canvasWidth,
      canvasHeight,
      bottom,
      xStep,
      points: {
        area: areaPoints,
        spline: splinePoints,
        line: linePoints,
        bar: barPoints,
      },
    };
  }, [data, height, visiblePoints, width]);

  const paths = useMemo(() => {
    const areaTop = createSmoothPath(metrics.points.area);
    const firstArea = metrics.points.area[0];
    const lastArea = metrics.points.area[metrics.points.area.length - 1];
    const areaPath = `${areaTop} L ${lastArea.x} ${metrics.bottom} L ${firstArea.x} ${metrics.bottom} Z`;

    return {
      area: areaPath,
      spline: createSmoothPath(metrics.points.spline),
      line: createLinePath(metrics.points.line),
    };
  }, [metrics]);

  const getLocalPoint = (event: MouseEvent<SVGRectElement | SVGPathElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) {
      return { x: 0, y: 0 };
    }

    const rect = svg.getBoundingClientRect();
    const scaleX = metrics.canvasWidth / rect.width;
    const scaleY = metrics.canvasHeight / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const updateHover = (event: MouseEvent<SVGRectElement | SVGPathElement>) => {
    const localPoint = getLocalPoint(event);
    const firstX = metrics.points.area[0].x;
    const nearest = Math.round((localPoint.x - firstX) / (metrics.xStep || 1));
    const isNearSpline = metrics.points.spline.some((point, index, points) => {
      const next = points[index + 1];

      if (!next) {
        return Math.hypot(localPoint.x - point.x, localPoint.y - point.y) < splineHoverRadius;
      }

      return distanceToSegment(localPoint.x, localPoint.y, point, next) < splineHoverRadius;
    });

    const nextIndex = clamp(nearest, 0, data.labels.length - 1);

    setHoverIndex(nextIndex);
    setTooltipIndex(nextIndex);
    setTooltipPoint(localPoint);
    setIsSplineHovered(isNearSpline);
  };

  const tooltipWidth = 370;
  const tooltipHeight = 176;
  const tooltipGap = 28;
  const plotCenter = metrics.chart.x + metrics.chart.width / 2;
  const candidateRight = tooltipPoint.x + tooltipGap;
  const candidateLeft = tooltipPoint.x - tooltipWidth - tooltipGap;
  const hasRoomOnRight = tooltipPoint.x < plotCenter && candidateRight + tooltipWidth <= metrics.chart.x + metrics.chart.width - 12;
  const preferredX = hasRoomOnRight ? candidateRight : candidateLeft;
  const tooltipX = clamp(preferredX, metrics.chart.x + 14, metrics.chart.x + metrics.chart.width - tooltipWidth - 12);
  const tooltipY = clamp(tooltipPoint.y - tooltipHeight / 2, metrics.chart.y + 4, metrics.chart.y + metrics.chart.height - tooltipHeight);
  const tooltipTransform = `translate3d(${tooltipX}px, ${tooltipY}px, 0)`;

  return (
    <div className="chart-shell" style={{ width, height }}>
      <div className="chart-scroll" ref={scrollRef}>
        <div className="chart-stage" style={{ width: metrics.canvasWidth, height: metrics.canvasHeight }}>
          <svg className="chart-svg" width={metrics.canvasWidth} height={metrics.canvasHeight} viewBox={`0 0 ${metrics.canvasWidth} ${metrics.canvasHeight}`}>
            <rect className="plot-frame" x={metrics.chart.x} y={metrics.chart.y} width={metrics.chart.width} height={metrics.chart.height} />

            <path className="area-fill" d={paths.area} />
            <path className="area-top-line" d={createSmoothPath(metrics.points.area)} />

            {metrics.points.bar.map((point) => (
              <rect
                key={`bar-${point.x}`}
                className="bar"
                x={point.x - 17}
                y={point.y}
                width={34}
                height={metrics.bottom - point.y + 3}
                rx={4}
              />
            ))}

            <path
              className={`spline-line ${isSplineHovered ? 'spline-line--hovered' : ''}`}
              d={paths.spline}
            />

            <path className="line-series" d={paths.line} />

            {metrics.points.line.map((point) => (
              <rect key={`line-point-${point.x}`} className="line-marker" x={point.x - 6} y={point.y - 6} width={12} height={12} />
            ))}

            <path
              className="spline-hit-area"
              d={paths.spline}
            />

            <rect
              className="hover-plane"
              x={metrics.chart.x}
              y={metrics.chart.y}
              width={metrics.chart.width}
              height={metrics.chart.height}
              onMouseMove={updateHover}
              onMouseLeave={() => {
                setHoverIndex(null);
                setIsSplineHovered(false);
              }}
            />

            <g className="hover-points">
              {data.labels.map((label, index) => (
                <g className={`hover-point-set ${hoverIndex === index ? 'hover-point-set--visible' : ''}`} key={`hover-point-set-${label}`}>
                  <circle className="hover-point-visual area-point-halo" cx={metrics.points.area[index].x} cy={metrics.points.area[index].y} r={19} />
                  <circle className="hover-point-visual area-point" cx={metrics.points.area[index].x} cy={metrics.points.area[index].y} r={4} />

                  <circle className="hover-point-visual spline-point-halo" cx={metrics.points.spline[index].x} cy={metrics.points.spline[index].y} r={19} />
                  <polygon
                    className="hover-point-visual spline-point"
                    points={[
                      `${metrics.points.spline[index].x},${metrics.points.spline[index].y - 6}`,
                      `${metrics.points.spline[index].x + 6},${metrics.points.spline[index].y}`,
                      `${metrics.points.spline[index].x},${metrics.points.spline[index].y + 6}`,
                      `${metrics.points.spline[index].x - 6},${metrics.points.spline[index].y}`,
                    ].join(' ')}
                  />

                  <circle className="hover-point-visual line-point-halo" cx={metrics.points.line[index].x} cy={metrics.points.line[index].y} r={19} />
                  <rect className="line-hover-fill" x={metrics.points.line[index].x - 6} y={metrics.points.line[index].y - 6} width={12} height={12} />
                  <rect className="line-hover-marker" x={metrics.points.line[index].x - 6} y={metrics.points.line[index].y - 6} width={12} height={12} />
                </g>
              ))}
            </g>
          </svg>

          <div
            className={`chart-tooltip ${hoverIndex === null ? '' : 'chart-tooltip--visible'}`}
            style={{
              width: tooltipWidth,
              height: tooltipHeight,
              transform: tooltipTransform,
            }}
          >
            <div className="tooltip-date">{data.labels[tooltipIndex]}</div>
            {seriesOrder.map((series) => (
              <div className="tooltip-row" key={series}>
                <span className="tooltip-dot" style={{ background: colors[series] }} />
                <span>{labels[series]}: </span>
                <strong>{formatValue(data[series][tooltipIndex])}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
