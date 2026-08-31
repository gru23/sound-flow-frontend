import { useMemo } from 'react';
import { Skia } from '@shopify/react-native-skia';
import {
  AXIS_GUTTER,
  CHANNEL_GAP,
  TIME_AXIS_AREA,
  TRACK_TITLE_HEIGHT,
  TRACK_SEPARATOR_GAP,
  META_AREA,
  CONTAINER_VERTICAL_PADDING,
  MIN_CHANNEL_HEIGHT,
  TrackData,
  ChannelRow,
  TrackLayout,
} from './types';
import { createWaveformEnvelopePath } from './audioMath';

// Sav layout proračun (širine, visine, pozicije kanala/naslova/separatora) je
// ovde - EditorScreen samo koristi rezultat, ne računa ništa sam.
export function useEditorLayout(
  tracks: TrackData[],
  screenWidth: number,
  screenHeight: number,
  zoomFactor: number
) {
  const maxDuration = tracks.length ? Math.max(...tracks.map((t) => t.duration)) : 0;

  const canvasWidth = Math.max(
    Math.max(320, screenWidth - 40),
    Math.min(4000, Math.ceil(maxDuration * 70 * zoomFactor) + AXIS_GUTTER + 2)
  );
  const plotWidth = Math.max(1, canvasWidth - AXIS_GUTTER - 2);

  // Fiksna visina po kanalu - računata za jednu stereo pesmu da ispuni ekran;
  // ne smanjuje se kad se doda još pesama - sadržaj samo postaje viši (skroluje se).
  const availableForOneTrack = Math.max(
    MIN_CHANNEL_HEIGHT * 2,
    screenHeight - CONTAINER_VERTICAL_PADDING - META_AREA - TIME_AXIS_AREA - TRACK_TITLE_HEIGHT - CHANNEL_GAP
  );
  const channelHeight = Math.max(MIN_CHANNEL_HEIGHT, Math.floor(availableForOneTrack / 2));

  // Skia Path-ovi zavise od plotWidth (koja zavisi od trajanja NAJDUŽE pesme),
  // pa se prave ovde - svaka kraća pesma se proporcionalno "steže" naspram najduže.
  const derivedTracks = useMemo(() => {
    return tracks.map((t) => {
      const trackPlotWidth =
        maxDuration > 0 ? Math.max(1, Math.round(plotWidth * (t.duration / maxDuration))) : plotWidth;
      const leftPath = createWaveformEnvelopePath(t.leftChannel, trackPlotWidth, 1, 0, 1, 0);
      const rightPath = t.rightChannel
        ? createWaveformEnvelopePath(t.rightChannel, trackPlotWidth, 1, 0, 1, 0)
        : null;
      return { ...t, leftPath, rightPath };
    });
  }, [tracks, plotWidth, maxDuration]);

  let cursor = 0;
  const trackLayouts: TrackLayout[] = derivedTracks.map((t, ti) => {
    const titleY = cursor;
    cursor += TRACK_TITLE_HEIGHT;

    const rows = t.rightPath
      ? [
          { path: t.leftPath, fillColor: t.fillColorL, strokeColor: t.strokeColorL, key: `${t.id}-L` },
          { path: t.rightPath, fillColor: t.fillColorR, strokeColor: t.strokeColorR, key: `${t.id}-R` },
        ]
      : [{ path: t.leftPath, fillColor: t.fillColorL, strokeColor: t.strokeColorL, key: `${t.id}-L` }];

    const channels: ChannelRow[] = rows.map((r, ri) => {
      const yTop = cursor;
      cursor += channelHeight;
      if (ri < rows.length - 1) cursor += CHANNEL_GAP;
      return { ...r, yTop };
    });

    let separatorY: number | null = null;
    if (ti < derivedTracks.length - 1) {
      separatorY = cursor + TRACK_SEPARATOR_GAP / 2;
      cursor += TRACK_SEPARATOR_GAP;
    }

    const leadingSilencePx = maxDuration > 0 ? (t.leadingSilenceSeconds / maxDuration) * plotWidth : 0;

    return { id: t.id, title: t.title, titleY, channels, separatorY, leadingSilencePx };
  });

  const waveformContentHeight = cursor;
  const canvasHeight = waveformContentHeight;
  const plotClipRect = Skia.XYWHRect(0, 0, plotWidth, canvasHeight);

  return { maxDuration, canvasWidth, plotWidth, channelHeight, trackLayouts, canvasHeight, plotClipRect };
}