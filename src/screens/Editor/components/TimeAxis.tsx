import React from 'react';
import { Group, Path, Text as SkiaText, Skia, SkFont } from '@shopify/react-native-skia';
import { TIME_AXIS_AREA } from '../types';

type Props = {
  plotWidth: number;
  durationSeconds: number;
  font: SkFont | null;
};

// Jedna vremenska osa, na vrhu - scroluje horizontalno zajedno sa signalom,
// jer tikice moraju odgovarati stvarnoj poziciji semplova.
export default function TimeAxis({ plotWidth, durationSeconds, font }: Props) {
  if (!(durationSeconds > 0) || !font) return null;

  const desiredTickSpacingPx = 50;
  const pixelsPerSecond = plotWidth / durationSeconds;
  let step = Math.ceil(durationSeconds / (plotWidth / desiredTickSpacingPx));
  if (step < 1) step = 1;
  const axisEndSeconds = Math.ceil(durationSeconds);

  const tickColor = '#6b7280';
  const labelColor = '#111827';
  const axisY = TIME_AXIS_AREA - 18;

  const axisLine = Skia.Path.Make();
  axisLine.moveTo(0, axisY);
  axisLine.lineTo(plotWidth, axisY);

  function formatTime(totalSeconds: number): string {
    if (totalSeconds === 0) return '0';
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return (
    <Group>
      <Path path={axisLine} color={tickColor} style="stroke" strokeWidth={1} />
      {Array.from({ length: axisEndSeconds + 1 }).map((_, idx) => {
        const sec = idx;
        if (sec % step !== 0) return null;

        const x = sec * pixelsPerSecond;
        const tick = Skia.Path.Make();
        tick.moveTo(x, axisY);
        tick.lineTo(x, axisY - 5);

        // const label = `${sec}s`;
        const label = formatTime(sec);
        const labelWidth = font.measureText(label).width;

        return (
          <React.Fragment key={`time-${sec}`}>
            <Path path={tick} color={tickColor} style="stroke" strokeWidth={1} />
            <SkiaText text={label} x={x - labelWidth / 2} y={axisY - 8} font={font} color={labelColor} />
          </React.Fragment>
        );
      })}
    </Group>
  );
}