import React from 'react';
import { Group, Path, Skia } from '@shopify/react-native-skia';
import { TrackLayout } from '../types';
import { createCenterLinePath } from '../audioMath';

type Props = {
  layout: TrackLayout;
  plotWidth: number;
  channelHeight: number;
  isLast: boolean;
  isSelected: boolean;
  extraTranslateXPx?: number; // Live preview pomeranja tokom Move gesta; 0 van gesta
};

// Jedan track: 1 ili 2 kanala (mono/stereo) + linija razdvajanja ispod, ako
// track nije poslednji u nizu. Vodeća tišina (leadingSilencePx) se ne crta -
// waveform i centralna linija su isečeni (clip) tako da vizuelno track
// izgleda kao da počinje tačno tamo gde počinje stvarni sadržaj, iako je
// tišina fizički prisutna u audio fajlu.
export default function Track({
  layout,
  plotWidth,
  channelHeight,
  isLast,
  isSelected,
  extraTranslateXPx = 0,
}: Props) {
  const rowTop = layout.channels[0]?.yTop ?? 0;
  const rowBottom = layout.channels.length
    ? layout.channels[layout.channels.length - 1].yTop + channelHeight
    : rowTop;
  const rowHeight = Math.max(1, rowBottom - rowTop);

  const leadingSilencePx = Math.max(0, layout.leadingSilencePx);
  const contentClip = Skia.XYWHRect(leadingSilencePx, rowTop, Math.max(1, plotWidth - leadingSilencePx), rowHeight);

  return (
    // Ceo track (highlight + sadržaj + separator) se pomera zajedno tokom
    // Move drag-a preko ove spoljne translateX transformacije.
    <Group transform={[{ translateX: extraTranslateXPx }]}>
      {isSelected && (
        <Path
          path={(() => {
            const p = Skia.Path.Make();
            p.addRect(contentClip);
            return p;
          })()}
          color="rgba(21, 97, 189, 0.08)"
          style="fill"
        />
      )}

      <Group clip={contentClip}>
        {layout.channels.map((row) => {
          const yOffset = row.yTop;
          return (
            <React.Fragment key={row.key}>
              <Path
                path={createCenterLinePath(plotWidth, channelHeight, yOffset, 0)}
                color="#9ca3af"
                style="stroke"
                strokeWidth={0.8}
              />
              <Group transform={[{ translateY: yOffset }, { scaleY: channelHeight }]}>
                <Path path={row.path} color={row.fillColor} style="fill" />
              </Group>
              <Group transform={[{ translateY: yOffset }, { scaleY: channelHeight }]}>
                <Path path={row.path} color={row.strokeColor} style="stroke" strokeWidth={0.9 / channelHeight} />
              </Group>
            </React.Fragment>
          );
        })}
      </Group>

      {!isLast && layout.separatorY !== null && (
        <Path
          path={(() => {
            const p = Skia.Path.Make();
            const y = layout.separatorY!;
            p.moveTo(0, y);
            p.lineTo(plotWidth, y);
            return p;
          })()}
          color="#c7cfdb"
          style="stroke"
          strokeWidth={1}
        />
      )}
    </Group>
  );
}