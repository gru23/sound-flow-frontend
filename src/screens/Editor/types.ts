export type TrackData = {
  id: string;
  title: string;
  duration: number;
  path: string;
  leftChannel: number[];
  rightChannel: number[] | null;
  fillColorL: string;
  strokeColorL: string;
  fillColorR: string;
  strokeColorR: string;
  leadingSilenceSeconds: number;
};

export type DerivedTrack = TrackData & {
  leftPath: any;
  rightPath: any | null;
};

export type ChannelRow = {
  key: string;
  path: any;
  fillColor: string;
  strokeColor: string;
  yTop: number;
};

export type TrackLayout = {
  id: string;
  title: string;
  titleY: number;
  channels: ChannelRow[];
  separatorY: number | null;
  leadingSilencePx: number;
};

export const AXIS_GUTTER = 34;
export const CHANNEL_GAP = 20;
export const TIME_AXIS_AREA = 40;
export const TRACK_TITLE_HEIGHT = 18;
export const TRACK_SEPARATOR_GAP = 16;
export const META_AREA = 56;
export const CONTAINER_VERTICAL_PADDING = 28 + 20;
export const MIN_CHANNEL_HEIGHT = 70;
export const WAVEFORM_SAMPLE_RATE = 8000;

export const TRACK_COLORS = [
  {
    fillColorL: 'rgba(37, 99, 235, 0.40)',
    strokeColorL: 'rgba(29, 78, 216, 0.98)',
    fillColorR: 'rgba(239, 68, 68, 0.40)',
    strokeColorR: 'rgba(220, 38, 38, 0.98)',
  },
  {
    fillColorL: 'rgba(16, 185, 129, 0.40)',
    strokeColorL: 'rgba(5, 150, 105, 0.98)',
    fillColorR: 'rgba(245, 158, 11, 0.40)',
    strokeColorR: 'rgba(217, 119, 6, 0.98)',
  },
  {
    fillColorL: 'rgba(139, 92, 246, 0.40)',
    strokeColorL: 'rgba(109, 40, 217, 0.98)',
    fillColorR: 'rgba(236, 72, 153, 0.40)',
    strokeColorR: 'rgba(219, 39, 119, 0.98)',
  },
];