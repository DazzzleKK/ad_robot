import { useMemo, useState, type MouseEvent } from 'react';

export type TimeSeriesChartData = {
  area: TimeSeriesChartPoint[];
  spline: TimeSeriesChartPoint[];
  line: TimeSeriesChartPoint[];
  bar: TimeSeriesChartPoint[];
};

export type TimeSeriesChartPoint = {
  date: string;
  value: number;
};

type NormalizedChartData = {
  labels: string[];
  area: Array<number | null>;
  spline: Array<number | null>;
  line: Array<number | null>;
  bar: Array<number | null>;
};

type Point = {
  x: number;
  y: number;
  value: number;
  index: number;
};

type ChartSeries = 'area' | 'spline' | 'line' | 'bar';

type Props = {
  data: TimeSeriesChartData;
  width?: number;
  height?: number;
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

const formatValue = (value: number | null) => {
  if (value === null) {
    return '-';
  }

  return (
  new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
  );
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const parseDateLabel = (date: string) => {
  const [day, month, year] = date.split('.').map(Number);

  if (!day || !month || !year) {
    return Number.MAX_SAFE_INTEGER;
  }

  return new Date(year, month - 1, day).getTime();
};

const getRange = (values: Array<number | null>) => {
  const presentValues = values.filter((value): value is number => value !== null);
  const min = Math.min(0, ...presentValues);
  const max = Math.max(...presentValues, 1);

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

const normalizeData = (data: TimeSeriesChartData): NormalizedChartData => {
  const labels = Array.from(new Set(seriesOrder.flatMap((series) => data[series].map((point) => point.date))))
    .sort((leftDate, rightDate) => parseDateLabel(leftDate) - parseDateLabel(rightDate));
  const size = labels.length;

  if (!size) {
    throw new Error('TimeSeriesChart expects at least one point in any series.');
  }

  const normalizeSeries = (series: ChartSeries) => {
    const valuesByDate = new Map(data[series].map((point) => [point.date, point.value]));

    return labels.map((date) => valuesByDate.get(date) ?? null);
  };

  return {
    labels,
    area: normalizeSeries('area'),
    spline: normalizeSeries('spline'),
    line: normalizeSeries('line'),
    bar: normalizeSeries('bar'),
  };
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

export function TimeSeriesChart({ data, width = 1000, height = 450 }: Props) {
  const chartData = useMemo(() => normalizeData(data), [data]);

  const [zoom, setZoom] = useState(1);
  const [viewportStart, setViewportStart] = useState(0);
  const [isMinimapDragging, setIsMinimapDragging] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [tooltipIndex, setTooltipIndex] = useState(0);
  const [tooltipPoint, setTooltipPoint] = useState({ x: 0, y: 0 });
  const [isSplineHovered, setIsSplineHovered] = useState(false);

  const metrics = useMemo(() => {
    const totalPoints = chartData.labels.length;
    const maxZoom = Math.max(1, totalPoints / 2);
    const safeZoom = clamp(zoom, 1, maxZoom);
    const visibleCount = Math.min(totalPoints, Math.max(2, Math.ceil(totalPoints / safeZoom)));
    const maxViewportStart = Math.max(0, totalPoints - visibleCount);
    const safeViewportStart = clamp(viewportStart, 0, maxViewportStart);
    const viewportEnd = safeViewportStart + visibleCount;
    const innerWidth = Math.round(width * 0.85);
    const innerX = Math.round((width - innerWidth) / 2);
    const chart = {
      x: innerX,
      y: 20,
      width: innerWidth,
      height: Math.round(height * 0.85) - 44,
    };
    const minimap = {
      x: chart.x,
      y: Math.round(height * 0.85) + 2,
      width: chart.width,
      height: 30,
    };
    const zoomControl = {
      x: chart.x,
      y: minimap.y + minimap.height + 14,
      width: chart.width,
    };
    const canvasWidth = width;
    const canvasHeight = height;
    const bottom = chart.y + chart.height;
    const areaRange = getRange(chartData.area);
    const splineRange = getRange(chartData.spline);
    const lineRange = getRange(chartData.line);
    const barRange = getRange(chartData.bar);
    const xStep = visibleCount === 1 ? 0 : (chart.width - 112) / (visibleCount - 1);
    const xForIndex = (index: number) => chart.x + 60 + (index - safeViewportStart) * xStep;
    const minimapXStep = totalPoints === 1 ? 0 : minimap.width / (totalPoints - 1);
    const xForMinimapIndex = (index: number) => minimap.x + index * minimapXStep;
    const yForAreaValue = (value: number) => bottom - ((value - areaRange.min) / areaRange.span) * 250;
    const yForSplineValue = (value: number) => bottom - ((value - splineRange.min) / splineRange.span) * 240;
    const yForLineValue = (value: number) => bottom - ((value - lineRange.min) / lineRange.span) * 220 - 4;
    const yForBarValue = (value: number) => bottom - Math.max(8, ((value - barRange.min) / barRange.span) * 140);
    const yForMinimapAreaValue = (value: number) => minimap.y + minimap.height - ((value - areaRange.min) / areaRange.span) * (minimap.height - 4) - 2;
    const yForMinimapSplineValue = (value: number) => minimap.y + minimap.height - ((value - splineRange.min) / splineRange.span) * (minimap.height - 4) - 2;
    const yForMinimapLineValue = (value: number) => minimap.y + minimap.height - ((value - lineRange.min) / lineRange.span) * (minimap.height - 4) - 2;

    const toPoints = (values: Array<number | null>, yForValue: (value: number) => number, xGetter = xForIndex, onlyVisible = true) =>
      values.flatMap((value, index) =>
        value === null || (onlyVisible && (index < safeViewportStart || index >= viewportEnd))
          ? []
          : [{
              x: xGetter(index),
              y: yForValue(value),
              value,
              index,
            }],
      );

    const areaPoints = toPoints(chartData.area, yForAreaValue);
    const splinePoints = toPoints(chartData.spline, yForSplineValue);
    const linePoints = toPoints(chartData.line, yForLineValue);
    const barPoints = toPoints(chartData.bar, yForBarValue);
    const minimapAreaPoints = toPoints(chartData.area, yForMinimapAreaValue, xForMinimapIndex, false);
    const minimapSplinePoints = toPoints(chartData.spline, yForMinimapSplineValue, xForMinimapIndex, false);
    const minimapLinePoints = toPoints(chartData.line, yForMinimapLineValue, xForMinimapIndex, false);
    const brushWidth = Math.max(28, (visibleCount / totalPoints) * minimap.width);
    const brushTravel = Math.max(0, minimap.width - brushWidth);
    const brushX = minimap.x + (maxViewportStart === 0 ? 0 : (safeViewportStart / maxViewportStart) * brushTravel);

    return {
      chart,
      minimap,
      zoomControl,
      canvasWidth,
      canvasHeight,
      bottom,
      xStep,
      maxZoom,
      visibleCount,
      viewportStart: safeViewportStart,
      viewportEnd,
      maxViewportStart,
      brush: {
        x: brushX,
        width: brushWidth,
      },
      points: {
        area: areaPoints,
        spline: splinePoints,
        line: linePoints,
        bar: barPoints,
      },
      minimapPoints: {
        area: minimapAreaPoints,
        spline: minimapSplinePoints,
        line: minimapLinePoints,
      },
      pointByIndex: {
        area: new Map(areaPoints.map((point) => [point.index, point])),
        spline: new Map(splinePoints.map((point) => [point.index, point])),
        line: new Map(linePoints.map((point) => [point.index, point])),
        bar: new Map(barPoints.map((point) => [point.index, point])),
      },
    };
  }, [chartData, height, viewportStart, width, zoom]);

  const paths = useMemo(() => {
    const areaTop = createSmoothPath(metrics.points.area);
    const firstArea = metrics.points.area[0];
    const lastArea = metrics.points.area[metrics.points.area.length - 1];
    const areaPath = firstArea && lastArea ? `${areaTop} L ${lastArea.x} ${metrics.bottom} L ${firstArea.x} ${metrics.bottom} Z` : '';

    return {
      area: areaPath,
      spline: createSmoothPath(metrics.points.spline),
      line: createLinePath(metrics.points.line),
      minimapArea: createSmoothPath(metrics.minimapPoints.area),
      minimapSpline: createSmoothPath(metrics.minimapPoints.spline),
      minimapLine: createLinePath(metrics.minimapPoints.line),
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
    const firstX = metrics.chart.x + 60;
    const nearest = Math.round((localPoint.x - firstX) / (metrics.xStep || 1)) + metrics.viewportStart;
    const isNearSpline = metrics.points.spline.some((point, index, points) => {
      const next = points[index + 1];

      if (!next) {
        return Math.hypot(localPoint.x - point.x, localPoint.y - point.y) < splineHoverRadius;
      }

      return distanceToSegment(localPoint.x, localPoint.y, point, next) < splineHoverRadius;
    });

    const nextIndex = clamp(nearest, 0, chartData.labels.length - 1);

    setHoverIndex(nextIndex);
    setTooltipIndex(nextIndex);
    setTooltipPoint(localPoint);
    setIsSplineHovered(isNearSpline);
  };

  const updateViewportFromMinimap = (event: MouseEvent<SVGRectElement>) => {
    const localPoint = getLocalPoint(event);
    const relativeX = clamp(localPoint.x - metrics.minimap.x, 0, metrics.minimap.width);
    const centeredIndex = Math.round((relativeX / metrics.minimap.width) * chartData.labels.length - metrics.visibleCount / 2);

    setViewportStart(clamp(centeredIndex, 0, metrics.maxViewportStart));
    setHoverIndex(null);
    setIsSplineHovered(false);
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
      <div className="chart-stage" style={{ width: metrics.canvasWidth, height: metrics.canvasHeight }}>
          <svg className="chart-svg" width={metrics.canvasWidth} height={metrics.canvasHeight} viewBox={`0 0 ${metrics.canvasWidth} ${metrics.canvasHeight}`}>
            <defs>
              <clipPath id="plot-clip">
                <rect x={metrics.chart.x} y={metrics.chart.y} width={metrics.chart.width} height={metrics.chart.height} />
              </clipPath>
            </defs>
            <rect className="plot-frame" x={metrics.chart.x} y={metrics.chart.y} width={metrics.chart.width} height={metrics.chart.height} />

            <path className="area-fill" d={paths.area} />
            <path className="area-top-line" d={createSmoothPath(metrics.points.area)} />

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
              {chartData.labels.map((label, index) => {
                const areaPoint = metrics.pointByIndex.area.get(index);
                const splinePoint = metrics.pointByIndex.spline.get(index);
                const linePoint = metrics.pointByIndex.line.get(index);

                return (
                  <g className={`hover-point-set ${hoverIndex === index ? 'hover-point-set--visible' : ''}`} key={`hover-point-set-${label}`}>
                    {areaPoint && (
                      <>
                        <circle className="hover-point-visual area-point-halo" cx={areaPoint.x} cy={areaPoint.y} r={19} />
                        <circle className="hover-point-visual area-point" cx={areaPoint.x} cy={areaPoint.y} r={4} />
                      </>
                    )}

                    {splinePoint && (
                      <>
                        <circle className="hover-point-visual spline-point-halo" cx={splinePoint.x} cy={splinePoint.y} r={19} />
                        <polygon
                          className="hover-point-visual spline-point"
                          points={[
                            `${splinePoint.x},${splinePoint.y - 6}`,
                            `${splinePoint.x + 6},${splinePoint.y}`,
                            `${splinePoint.x},${splinePoint.y + 6}`,
                            `${splinePoint.x - 6},${splinePoint.y}`,
                          ].join(' ')}
                        />
                      </>
                    )}

                    {linePoint && (
                      <>
                        <circle className="hover-point-visual line-point-halo" cx={linePoint.x} cy={linePoint.y} r={19} />
                        <rect className="line-hover-fill" x={linePoint.x - 6} y={linePoint.y - 6} width={12} height={12} />
                        <rect className="line-hover-marker" x={linePoint.x - 6} y={linePoint.y - 6} width={12} height={12} />
                      </>
                    )}
                  </g>
                );
              })}
            </g>

            <g clipPath="url(#plot-clip)">
              {metrics.points.bar.map((point) => (
                <rect
                  key={`bar-${point.x}`}
                  className="bar"
                  x={point.x - 11}
                  y={point.y}
                  width={22}
                  height={metrics.bottom - point.y + 3}
                  rx={4}
                />
              ))}
            </g>

            <g className="minimap">
              <rect className="minimap-frame" x={metrics.minimap.x} y={metrics.minimap.y} width={metrics.minimap.width} height={metrics.minimap.height} rx={4} />
              <path className="minimap-area" d={paths.minimapArea} />
              <path className="minimap-spline" d={paths.minimapSpline} />
              <path className="minimap-line" d={paths.minimapLine} />
              <rect
                className="minimap-hit-area"
                x={metrics.minimap.x}
                y={metrics.minimap.y}
                width={metrics.minimap.width}
                height={metrics.minimap.height}
                onMouseDown={(event) => {
                  setIsMinimapDragging(true);
                  updateViewportFromMinimap(event);
                }}
                onMouseMove={(event) => {
                  if (isMinimapDragging) {
                    updateViewportFromMinimap(event);
                  }
                }}
                onMouseUp={() => setIsMinimapDragging(false)}
                onMouseLeave={() => setIsMinimapDragging(false)}
              />
              <rect className="minimap-brush" x={metrics.brush.x} y={metrics.minimap.y} width={metrics.brush.width} height={metrics.minimap.height} rx={4} />
            </g>
          </svg>

          <label className="zoom-control" style={{ left: metrics.zoomControl.x, top: metrics.zoomControl.y, width: metrics.zoomControl.width }}>
            <span>Scale</span>
            <input
              type="range"
              min={1}
              max={metrics.maxZoom}
              step={0.1}
              value={zoom}
              onChange={(event) => {
                setZoom(Number(event.target.value));
                setViewportStart((currentStart) => clamp(currentStart, 0, metrics.maxViewportStart));
              }}
            />
          </label>

          <div
            className={`chart-tooltip ${hoverIndex === null ? '' : 'chart-tooltip--visible'}`}
            style={{
              width: tooltipWidth,
              height: tooltipHeight,
              transform: tooltipTransform,
            }}
          >
            <div className="tooltip-date">{chartData.labels[tooltipIndex]}</div>
            {seriesOrder.map((series) => (
              <div className="tooltip-row" key={series}>
                <span className="tooltip-dot" style={{ background: colors[series] }} />
                <span>{labels[series]}: </span>
                <strong>{formatValue(chartData[series][tooltipIndex])}</strong>
              </div>
            ))}
          </div>
        </div>
    </div>
  );
}
