import { Canvas, Group, useFont } from '@shopify/react-native-skia';
import {
  ActivityIndicator,
  Alert,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import React, { useEffect, useRef, useState } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as DocumentPicker from 'expo-document-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import Slider from '@react-native-community/slider';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { shiftTrackStart, splitAudioFile } from './trackOps';

import { applyEchoToSelection, applyEffectToSelection, applySilenceToSelection, SelectionEffect } from './effects';


import { RootStackParamList } from '../../../App';
import { AXIS_GUTTER, TIME_AXIS_AREA, TrackData, TRACK_COLORS } from './types';
import { extractTrackData } from './audioExtraction';
import { useEditorLayout } from './useEditorLayout';
import { usePlayback } from './usePlayback';
import TimeAxis from './components/TimeAxis';
import AmplitudeAxis from './components/AmplitudeAxis';
import Track from './components/Track';
import TrackTitles from './components/TrackTitles';
import Playhead from './components/Playhead';

type EditorRouteProp = RouteProp<RootStackParamList, 'EditorScreen'>;

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const SELECTION_HANDLE_WIDTH = 18;
const SELECTION_HANDLE_HIT_SLOP = 22;
const GRAPHIC_EQ_BANDS = [
  { frequency: 125, label: '125 Hz' },
  { frequency: 250, label: '250 Hz' },
  { frequency: 500, label: '500 Hz' },
  { frequency: 1000, label: '1 kHz' },
  { frequency: 2000, label: '2 kHz' },
  { frequency: 4000, label: '4 kHz' },
  { frequency: 8000, label: '8 kHz' },
  { frequency: 16000, label: '16 kHz' },
] as const;

export default function EditorScreen() {
  const route = useRoute<EditorRouteProp>();
  const initialPath = route.params?.path;
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [tracks, setTracks] = useState<TrackData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAddingTrack, setIsAddingTrack] = useState<boolean>(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionStartTime, setSelectionStartTime] = useState<number | null>(null);
  const [selectionEndTime, setSelectionEndTime] = useState<number | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const [trackVolumes, setTrackVolumes] = useState<Record<string, number>>({});
  const [lastNonZeroVolumes, setLastNonZeroVolumes] = useState<Record<string, number>>({});

  const [isMoveMode, setIsMoveMode] = useState(false);
  const [movingTrackId, setMovingTrackId] = useState<string | null>(null);
  const [movePreviewDeltaSeconds, setMovePreviewDeltaSeconds] = useState(0);
  const [isApplyingMove, setIsApplyingMove] = useState(false);
  const [isApplyingSplit, setIsApplyingSplit] = useState(false);

  const [showEffectPanel, setShowEffectPanel] = useState(false);
  const [effectDelayMs, setEffectDelayMs] = useState(300);
  const [effectDecay, setEffectDecay] = useState(0.5);
  const [effectType, setEffectType] = useState<SelectionEffect>('echo');
  const [effectAmount, setEffectAmount] = useState(1.5);
  const [effectTargetLufs, setEffectTargetLufs] = useState(-16);
  const [effectDuration, setEffectDuration] = useState(1);
  const [effectTempo, setEffectTempo] = useState(1);
  const [effectPitch, setEffectPitch] = useState(0);
  const [equalizerGains, setEqualizerGains] = useState<number[]>(() =>
    GRAPHIC_EQ_BANDS.map(() => 0)
  );
  const [effectFrequency, setEffectFrequency] = useState(1000);
  const [effectGain, setEffectGain] = useState(0);
  const [isApplyingEffect, setIsApplyingEffect] = useState(false);

  const [effectPhaserDepth, setEffectPhaserDepth] = useState(2);
  const [effectPhaserDecay, setEffectPhaserDecay] = useState(0.4);
  const [effectPhaserSpeed, setEffectPhaserSpeed] = useState(0.5);
  const [effectPhaserDelay, setEffectPhaserDelay] = useState(2);
  const [effectDistortionDrive, setEffectDistortionDrive] = useState(2);



  const waveformTouchRef = useRef<{ x: number; y: number; time: number; moved: boolean } | null>(null);
  const selectionGestureRef = useRef<{
    mode: 'create' | 'start' | 'end' | null;
    anchorTime: number;
    trackId: string | null;
  } | null>(null);
  const moveGestureRef = useRef<{ trackId: string; anchorX: number; startLeadingSilence: number } | null>(null);
  const moveDeltaRef = useRef(0);

  useFocusEffect(
    React.useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return () => {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      };
    }, [])
  );

  const font = useFont(require('../../../assets/Roboto-Regular.ttf'), 12);
  const baseCanvasWidth = Math.max(320, screenWidth - 40);
  const { maxDuration, canvasWidth, plotWidth, channelHeight, trackLayouts, canvasHeight, plotClipRect } =
    useEditorLayout(tracks, screenWidth, screenHeight, zoomFactor);
  const minVisualZoom = maxDuration > 0 ? Math.max(MIN_ZOOM, (baseCanvasWidth - AXIS_GUTTER - 2) / (maxDuration * 70)) : MIN_ZOOM;

  const { toggleAll, stopAll, seekAll, setLoopRange, isPlayingAll, positionSeconds, setTrackVolume, unloadTrack } = usePlayback();

  const handleToggleAll = () => {
    const playableTracks = tracks.map((t) => ({ id: t.id, uri: t.path }));
    void toggleAll(playableTracks, maxDuration);
  };

  const handleStopAll = () => {
    void stopAll();
  };

  const getTrackVolume = (id: string) => {
    return trackVolumes[id] ?? 1;
  };

  const isMuted = (id: string) => {
    return getTrackVolume(id) <= 0;
  };

  const handleVolumeChange = (id: string, volume: number) => {
    const track = tracks.find((t) => t.id === id);
    if (!track) return;

    const nextVolume = Math.max(0, Math.min(1, volume));
    setTrackVolumes((current) => ({
      ...current,
      [id]: nextVolume,
    }));

    if (nextVolume > 0) {
      setLastNonZeroVolumes((current) => ({
        ...current,
        [id]: nextVolume,
      }));
    }

    void setTrackVolume(id, track.path, nextVolume);
  };

  const handleToggleMute = (id: string) => {
    const currentVolume = getTrackVolume(id);
    if (currentVolume <= 0) {
      handleVolumeChange(id, lastNonZeroVolumes[id] ?? 1);
      return;
    }

    setLastNonZeroVolumes((current) => ({
      ...current,
      [id]: currentVolume,
    }));
    handleVolumeChange(id, 0);
  };

  const handleDeleteTrack = (id: string) => {
    void unloadTrack(id);
    setTracks((prev) => prev.filter((t) => t.id !== id));

    setTrackVolumes((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
    setLastNonZeroVolumes((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });

    if (selectedTrackId === id) {
      clearSelection();
    }
  };


  const clampTime = (time: number) => {
    if (maxDuration <= 0) return 0;
    return Math.max(0, Math.min(maxDuration, time));
  };

  const timeToX = (time: number) => {
    if (maxDuration <= 0) return 0;
    return (clampTime(time) / maxDuration) * plotWidth;
  };

  const viewportXToTime = (viewportX: number) => {
    if (maxDuration <= 0) return 0;
    return clampTime(((scrollXRef.current + viewportX) / plotWidth) * maxDuration);
  };

  const normalizedSelection =
    selectionStartTime !== null && selectionEndTime !== null
      ? {
          start: Math.min(selectionStartTime, selectionEndTime),
          end: Math.max(selectionStartTime, selectionEndTime),
        }
      : null;
  const canLoop = normalizedSelection !== null && normalizedSelection.end - normalizedSelection.start > 0.05;

  const selectedTrackLayout = selectedTrackId
    ? trackLayouts.find((layout) => layout.id === selectedTrackId) ?? null
    : null;

  const getTrackSelectionBounds = (layout: (typeof trackLayouts)[number]) => {
    const firstChannel = layout.channels[0];
    const lastChannel = layout.channels[layout.channels.length - 1];
    const top = firstChannel?.yTop ?? layout.titleY;
    const bottom = lastChannel ? lastChannel.yTop + channelHeight : layout.titleY + channelHeight;
    return { top, height: Math.max(1, bottom - top) };
  };

  const findTrackAtY = (viewportY: number) => {
    return (
      trackLayouts.find((layout) => {
        const { top, height } = getTrackSelectionBounds(layout);
        return viewportY >= top && viewportY <= top + height;
      }) ?? null
    );
  };

  const handleSelectionToggle = () => {
    setIsSelectionMode((current) => {
      const next = !current;
      if (next) {
        setIsMoveMode(false);
      } else {
        setSelectionStartTime(null);
        setSelectionEndTime(null);
        setIsLoopEnabled(false);
        selectionGestureRef.current = null;
      }
      return next;
    });
  };

  const handleMoveToggle = () => {
    setIsMoveMode((current) => {
      const next = !current;
      if (next) setIsSelectionMode(false);
      return next;
    });
  };

  const handleLoopToggle = () => {
    if (!canLoop) return;
    setIsLoopEnabled((current) => !current);
  };

  const clearSelection = () => {
    setSelectionStartTime(null);
    setSelectionEndTime(null);
    setSelectedTrackId(null);
    setIsLoopEnabled(false);
    selectionGestureRef.current = null;
  };

  const updateSelection = (startTime: number, endTime: number) => {
    const nextStart = clampTime(Math.min(startTime, endTime));
    const nextEnd = clampTime(Math.max(startTime, endTime));
    setSelectionStartTime(nextStart);
    setSelectionEndTime(nextEnd);
  };

  const beginSelectionGesture = (viewportX: number, viewportY: number) => {
    const touchedTrack = findTrackAtY(viewportY);
    if (!touchedTrack) return;

    const touchTime = viewportXToTime(viewportX);
    const selection = normalizedSelection;
    const contentX = scrollXRef.current + viewportX;
    const hasSelectionOnTouchedTrack = selection && selectedTrackId === touchedTrack.id;

    if (hasSelectionOnTouchedTrack) {
      const startX = timeToX(selection.start);
      const endX = timeToX(selection.end);
      const nearStart = Math.abs(contentX - startX) <= SELECTION_HANDLE_HIT_SLOP;
      const nearEnd = Math.abs(contentX - endX) <= SELECTION_HANDLE_HIT_SLOP;

      if (nearStart || nearEnd) {
        selectionGestureRef.current = { mode: nearStart ? 'start' : 'end', anchorTime: touchTime, trackId: touchedTrack.id };
        return;
      }
    }

    setSelectedTrackId(touchedTrack.id);
    selectionGestureRef.current = { mode: 'create', anchorTime: touchTime, trackId: touchedTrack.id };
    updateSelection(touchTime, touchTime);
  };

  const updateSelectionGesture = (viewportX: number) => {
    const gesture = selectionGestureRef.current;
    if (!gesture) return;
    if (!gesture.trackId || selectedTrackId !== gesture.trackId) return;

    const currentTime = viewportXToTime(viewportX);
    const selection = normalizedSelection;

    if (gesture.mode === 'create') {
      updateSelection(gesture.anchorTime, currentTime);
      return;
    }

    if (!selection) return;

    if (gesture.mode === 'start') {
      updateSelection(currentTime, selection.end);
    } else if (gesture.mode === 'end') {
      updateSelection(selection.start, currentTime);
    }
  };

  const endSelectionGesture = () => {
    selectionGestureRef.current = null;
  };

  const beginMoveGesture = (viewportX: number, viewportY: number) => {
    const touchedTrack = findTrackAtY(viewportY);
    if (!touchedTrack) return;
    const trackData = tracks.find((t) => t.id === touchedTrack.id);
    if (!trackData) return;

    moveGestureRef.current = {
      trackId: touchedTrack.id,
      anchorX: scrollXRef.current + viewportX,
      startLeadingSilence: trackData.leadingSilenceSeconds,
    };
    setSelectedTrackId(touchedTrack.id);
    setMovingTrackId(touchedTrack.id);
    moveDeltaRef.current = 0;
    setMovePreviewDeltaSeconds(0);
  };

  const updateMoveGesture = (viewportX: number) => {
    const gesture = moveGestureRef.current;
    if (!gesture || maxDuration <= 0) return;

    const contentX = scrollXRef.current + viewportX;
    const pixelsPerSecond = plotWidth / maxDuration;
    if (pixelsPerSecond <= 0) return;

    const rawDeltaSeconds = (contentX - gesture.anchorX) / pixelsPerSecond;
    // Ne dozvoljavamo da ukupna tišina padne ispod 0 - to je i tražena granica.
    const clampedDelta = Math.max(-gesture.startLeadingSilence, rawDeltaSeconds);

    moveDeltaRef.current = clampedDelta;
    setMovePreviewDeltaSeconds(clampedDelta);
  };

  const endMoveGesture = async () => {
    const gesture = moveGestureRef.current;
    moveGestureRef.current = null;
    setMovingTrackId(null);

    const delta = moveDeltaRef.current;
    moveDeltaRef.current = 0;
    setMovePreviewDeltaSeconds(0);

    if (!gesture) return;
    if (Math.abs(delta) < 0.02) return; // zanemarljivo pomeranje, ne diramo fajl

    const track = tracks.find((t) => t.id === gesture.trackId);
    if (!track) return;

    setIsApplyingMove(true);
    try {
      const newPath = await shiftTrackStart(track.path, delta);
      const refreshed = await extractTrackData(newPath, `${track.title}.wav`);
      const nextLeadingSilence = Math.max(0, track.leadingSilenceSeconds + delta);

      setTracks((prev) =>
        prev.map((t) =>
          t.id === track.id ? { ...t, ...refreshed, id: track.id, leadingSilenceSeconds: nextLeadingSilence } : t
        )
      );
    } catch (err) {
      console.error('Greška pri pomeranju zapisa:', err);
      Alert.alert('Greška', 'Nije uspjelo pomjeranje zapisa.');
    } finally {
      setIsApplyingMove(false);
    }
  };

  const selectedTrackForSplit = selectedTrackId ? tracks.find((t) => t.id === selectedTrackId) ?? null : null;
  const canSplit =
    !!selectedTrackForSplit &&
    positionSeconds > selectedTrackForSplit.leadingSilenceSeconds + 0.05 &&
    positionSeconds < selectedTrackForSplit.duration - 0.05;

  const handleSplit = async () => {
    if (!selectedTrackForSplit || !canSplit) return;
    const track = selectedTrackForSplit;

    setIsApplyingSplit(true);
    try {
      const { leftPath, rightPath } = await splitAudioFile(track.path, positionSeconds, track.duration);
      const [leftData, rightData] = await Promise.all([
        extractTrackData(leftPath, `${track.title} (1).wav`),
        extractTrackData(rightPath, `${track.title} (2).wav`),
      ]);

      setTracks((prev) => {
        const idx = prev.findIndex((t) => t.id === track.id);
        if (idx === -1) return prev;

        const left: TrackData = {
          ...track,
          ...leftData,
          id: `${track.id}-a`,
          leadingSilenceSeconds: track.leadingSilenceSeconds,
        };
        const right: TrackData = {
          ...track,
          ...rightData,
          id: `${track.id}-b`,
          leadingSilenceSeconds: positionSeconds,
        };

        const next = [...prev];
        next.splice(idx, 1, left, right);
        return next;
      });

      clearSelection();
    } catch (err) {
      console.error('Greška pri sečenju zapisa:', err);
      Alert.alert('Greška', 'Nije uspjelo sečenje zapisa.');
    } finally {
      setIsApplyingSplit(false);
    }
  };

  const handleZoomIn = () => {
    setZoomFactor((current) => Math.min(MAX_ZOOM, Number((current + ZOOM_STEP).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoomFactor((current) => Math.max(minVisualZoom, Number((current - ZOOM_STEP).toFixed(2))));
  };

  const handleWaveformTouchStart = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    waveformTouchRef.current = {
      x: locationX,
      y: locationY,
      time: Date.now(),
      moved: false,
    };
  };

  const handleWaveformTouchMove = (e: any) => {
    const touch = waveformTouchRef.current;
    if (!touch) return;

    const { locationX, locationY } = e.nativeEvent;
    const dx = Math.abs(locationX - touch.x);
    const dy = Math.abs(locationY - touch.y);
    if (dx > 10 || dy > 10) {
      touch.moved = true;
    }
  };

  const handleWaveformTouchEnd = (e: any) => {
    if (isSelectionMode) {
      endSelectionGesture();
      return;
    }

    const touch = waveformTouchRef.current;
    waveformTouchRef.current = null;
    if (!touch || touch.moved || maxDuration <= 0) return;

    const touchedTrack = findTrackAtY(touch.y);
    if (touchedTrack) {
      setSelectedTrackId(touchedTrack.id);
      setSelectionStartTime(null);
      setSelectionEndTime(null);
    }

    const elapsed = Date.now() - touch.time;
    if (elapsed > 300) return;

    const pixelsPerSecond = plotWidth / maxDuration;
    if (pixelsPerSecond <= 0) return;

    const x = Math.max(0, Math.min(plotWidth, scrollXRef.current + e.nativeEvent.locationX));
    const nextPosition = x / pixelsPerSecond;
    void seekAll(nextPosition);
  };

  const handleSelectionLayerStart = (e: any) => {
    beginSelectionGesture(e.nativeEvent.locationX, e.nativeEvent.locationY);
  };

  const handleSelectionLayerMove = (e: any) => {
    updateSelectionGesture(e.nativeEvent.locationX);
  };

  const handleSelectionLayerEnd = () => {
    endSelectionGesture();
  };

  const handleMoveLayerStart = (e: any) => {
    beginMoveGesture(e.nativeEvent.locationX, e.nativeEvent.locationY);
  };

  const handleMoveLayerMove = (e: any) => {
    updateMoveGesture(e.nativeEvent.locationX);
  };

  const handleMoveLayerEnd = () => {
    void endMoveGesture();
  };

  const handleApplyEffect = async () => {
    if (!selectedTrackId || !normalizedSelection) return;

    const track = tracks.find((t) => t.id === selectedTrackId);
    if (!track) return;

    setIsApplyingEffect(true);

    try {
      const newPath =
        effectType === 'echo'
          ? await applyEchoToSelection(
              track.path,
              normalizedSelection.start,
              normalizedSelection.end,
              track.duration,
              {
                delayMs: effectDelayMs,
                decay: effectDecay,
              }
            )
          : effectType === 'silence'
            ? await applySilenceToSelection(
                track.path,
                normalizedSelection.start,
                normalizedSelection.end
              )
            : await applyEffectToSelection(
                track.path,
                normalizedSelection.start,
                normalizedSelection.end,
                track.duration,
                effectType,
                {
                  // Opšti efekti
                  amount:
                    effectType === 'normalize'
                      ? effectTargetLufs
                      : effectAmount,

                  duration: effectDuration,
                  tempo: effectTempo,
                  pitch: effectPitch,
                  frequency: effectFrequency,
                  gain: effectGain,

                  // Graphic EQ
                  equalizerBands: GRAPHIC_EQ_BANDS.map(
                    (band, index) => ({
                      frequency: band.frequency,
                      gain: equalizerGains[index] ?? 0,
                    })
                  ),

                  // Phaser
                  phaserDepth: effectPhaserDepth,
                  phaserDecay: effectPhaserDecay,
                  phaserSpeed: effectPhaserSpeed,
                  phaserDelay: effectPhaserDelay,

                  // Distortion
                  distortionDrive: effectDistortionDrive,
                }
              );

      // Ponovo izvlačimo waveform/trajanje iz izmijenjenog fajla.
      const refreshed = await extractTrackData(
        newPath,
        `${track.title}.wav`
      );

      // Playback kešira Audio.Sound po ID-u,
      // pa ga moramo osloboditi nakon promjene putanje.
      await unloadTrack(track.id);

      setTracks((prev) =>
        prev.map((t) =>
          t.id === track.id
            ? {
                ...t,
                ...refreshed,
                id: track.id,
              }
            : t
        )
      );

      clearSelection();
    } catch (err) {
      console.error(
        `Greška pri primjeni efekta (${effectType}):`,
        err
      );

      Alert.alert(
        'Greška',
        'Nije uspjela primjena efekta.'
      );
    } finally {
      setIsApplyingEffect(false);
    }
  };


  // Refs za sinhronizaciju fiksnog header-a (vremenska osa) sa horizontalnim
  // scroll-om glavnog sadržaja, i za auto-scroll koji prati playhead.
  const contentScrollRef = useRef<ScrollView>(null);
  const headerScrollRef = useRef<ScrollView>(null);
  const scrollXRef = useRef(0);
  const viewportWidthRef = useRef(0);

  const handleContentScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    scrollXRef.current = x;
    headerScrollRef.current?.scrollTo({ x, animated: false });
  };

  const handleViewportLayout = (e: LayoutChangeEvent) => {
    viewportWidthRef.current = e.nativeEvent.layout.width;
  };

  useEffect(() => {
    if (!isPlayingAll || maxDuration <= 0) return;
    const viewportWidth = viewportWidthRef.current;
    if (viewportWidth === 0) return;

    const pixelsPerSecond = plotWidth / maxDuration;
    const playheadX = positionSeconds * pixelsPerSecond;
    const margin = 40;
    const rightEdge = scrollXRef.current + viewportWidth;

    if (playheadX > rightEdge - margin) {
      const nextX = Math.max(0, playheadX - margin);
      scrollXRef.current = nextX;
      contentScrollRef.current?.scrollTo({ x: nextX, animated: false });
      headerScrollRef.current?.scrollTo({ x: nextX, animated: false });
    } else if (playheadX < scrollXRef.current) {
      scrollXRef.current = playheadX;
      contentScrollRef.current?.scrollTo({ x: playheadX, animated: false });
      headerScrollRef.current?.scrollTo({ x: playheadX, animated: false });
    }
  }, [positionSeconds, isPlayingAll, maxDuration, plotWidth]);

  useEffect(() => {
    const viewportWidth = viewportWidthRef.current;
    if (viewportWidth === 0) return;

    const maxScrollX = Math.max(0, canvasWidth - viewportWidth);
    const nextScrollX = Math.min(scrollXRef.current, maxScrollX);
    if (nextScrollX !== scrollXRef.current) {
      scrollXRef.current = nextScrollX;
      contentScrollRef.current?.scrollTo({ x: nextScrollX, animated: false });
      headerScrollRef.current?.scrollTo({ x: nextScrollX, animated: false });
    }
  }, [canvasWidth]);

  useEffect(() => {
    setLoopRange(isLoopEnabled && canLoop ? normalizedSelection : null);
  }, [isLoopEnabled, canLoop, normalizedSelection?.start, normalizedSelection?.end, setLoopRange]);

  useEffect(() => {
    if (!isSelectionMode) {
      selectionGestureRef.current = null;
    }
  }, [isSelectionMode]);

  useEffect(() => {
    if (!selectedTrackId) return;
    if (trackLayouts.some((layout) => layout.id === selectedTrackId)) return;

    setSelectedTrackId(null);
    setSelectionStartTime(null);
    setSelectionEndTime(null);
  }, [trackLayouts, selectedTrackId]);

  async function loadInitialTrack(filePath: string) {
    try {
      const data = await extractTrackData(filePath);
      setTracks([{ ...data, ...TRACK_COLORS[0], leadingSilenceSeconds: 0 }]);
      setErrorText(null);
    } catch (err) {
      console.error('Greška pri ekstrakciji PCM:', err);
      setErrorText('Greška pri učitavanju audio signala.');
    } finally {
      setIsLoading(false);
    }
  }

  async function pickAndAddTrack() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setIsAddingTrack(true);
      const data = await extractTrackData(asset.uri, asset.name);
      const colors = TRACK_COLORS[tracks.length % TRACK_COLORS.length];
      setTracks((prev) => [...prev, { ...data, ...colors, leadingSilenceSeconds: 0 }]);
    } catch (err) {
      console.error('Greška pri dodavanju pesme:', err);
      Alert.alert('Greška', 'Nije uspelo dodavanje pesme.');
    } finally {
      setIsAddingTrack(false);
    }
  }

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, seconds || 0);

    const minutes = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60);
    const milliseconds = Math.floor((safeSeconds % 1) * 100);

    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}`;
  };

  const renderEffectSlider = (
    label: string,
    value: number,
    minimumValue: number,
    maximumValue: number,
    step: number,
    onValueChange: (value: number) => void,
    suffix = ''
  ) => (
    <View style={styles.effectRow}>
      <Text style={styles.effectLabel}>{label}</Text>
      <Slider
        style={styles.effectSlider}
        minimumValue={minimumValue}
        maximumValue={maximumValue}
        step={step}
        value={value}
        onValueChange={onValueChange}
        minimumTrackTintColor="#1561bd"
        maximumTrackTintColor="#c7cfdb"
        thumbTintColor="#1561bd"
      />
      <Text style={styles.effectValue}>{value.toFixed(step < 1 ? 2 : 0)}{suffix}</Text>
    </View>
  );

  const renderGraphicEq = () => (
    <View style={styles.graphicEqRow}>
      {GRAPHIC_EQ_BANDS.map((band, index) => (
        <View key={band.frequency} style={styles.graphicEqBand}>
          <Text style={styles.graphicEqGain}>
            {(equalizerGains[index] ?? 0).toFixed(1)} dB
          </Text>
          <View style={styles.graphicEqSliderSlot}>
            <Slider
              style={styles.graphicEqSlider}
              minimumValue={-12}
              maximumValue={12}
              step={0.5}
              value={equalizerGains[index] ?? 0}
              onValueChange={(value) => {
                setEqualizerGains((current) => {
                  const next = [...current];
                  next[index] = value;
                  return next;
                });
              }}
              minimumTrackTintColor="#1561bd"
              maximumTrackTintColor="#c7cfdb"
              thumbTintColor="#1561bd"
              accessibilityLabel={`${band.label} gain`}
            />
          </View>
          <Text style={styles.graphicEqFrequency}>{band.label}</Text>
        </View>
      ))}
    </View>
  );


  useEffect(() => {
    if (initialPath) {
      void loadInitialTrack(initialPath);
    } else {
      setErrorText('Nije izabran audio fajl.');
      setIsLoading(false);
    }
  }, [initialPath]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1561bd" />
        <Text style={styles.loadingText}>Učitavam signal...</Text>
      </View>
    );
  }

  if (errorText && tracks.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{errorText}</Text>
      </View>
    );
  }

  return (
  <SafeAreaView style={styles.container}>
    <View style={styles.topControls}>
      <TouchableOpacity
        style={styles.addTrackButton}
        onPress={pickAndAddTrack}
        disabled={isAddingTrack}
        accessibilityRole="button"
        accessibilityLabel="Dodaj pjesmu"
      >
        {isAddingTrack ? (
          <ActivityIndicator size="small" color="#1561bd" />
        ) : (
          <MaterialIcons name="add" size={25} color="#1561bd" />
        )}
      </TouchableOpacity>

      <View style={styles.timeDisplayContainer}>
        <Text style={styles.timeDisplay}>
          {formatTime(positionSeconds)}
          <Text style={styles.timeSeparator}> / </Text>
          {formatTime(maxDuration)}
        </Text>

        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomIconButton}
            onPress={handleZoomOut}
            disabled={zoomFactor <= minVisualZoom}
            accessibilityRole="button"
            accessibilityLabel="Umanji prikaz"
          >
            <MaterialIcons
              name="zoom-out"
              size={22}
              color={
                zoomFactor <= minVisualZoom
                  ? '#b8c0cc'
                  : '#475569'
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.zoomIconButton}
            onPress={handleZoomIn}
            disabled={zoomFactor >= MAX_ZOOM}
            accessibilityRole="button"
            accessibilityLabel="Uvećaj prikaz"
          >
            <MaterialIcons
              name="zoom-in"
              size={22}
              color={
                zoomFactor >= MAX_ZOOM
                  ? '#b8c0cc'
                  : '#475569'
              }
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>

    <View style={{ flexDirection: 'row' }}>
      <View
        style={{
          width: AXIS_GUTTER,
          height: TIME_AXIS_AREA,
        }}
      />

      <ScrollView
        ref={headerScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        bounces={false}
      >
        <Canvas
          style={{
            width: canvasWidth - AXIS_GUTTER,
            height: TIME_AXIS_AREA,
          }}
        >
          <TimeAxis
            plotWidth={plotWidth}
            durationSeconds={maxDuration}
            font={font}
          />
        </Canvas>
      </ScrollView>
    </View>

    <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={styles.waveformStage}>
        <View
          style={{
            flexDirection: 'row',
            position: 'relative',
          }}
        >
          <Canvas
            style={{
              width: AXIS_GUTTER,
              height: canvasHeight,
            }}
          >
            <AmplitudeAxis
              trackLayouts={trackLayouts}
              channelHeight={channelHeight}
              font={font}
            />
          </Canvas>

          <ScrollView
            ref={contentScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={!isSelectionMode && !isMoveMode}
            bounces={false}
            onScroll={handleContentScroll}
            scrollEventThrottle={16}
            onLayout={handleViewportLayout}
            onTouchStart={handleWaveformTouchStart}
            onTouchMove={handleWaveformTouchMove}
            onTouchEnd={handleWaveformTouchEnd}
          >
            <View
              style={{
                width: canvasWidth - AXIS_GUTTER,
                height: canvasHeight,
                position: 'relative',
              }}
            >
              <Canvas
                style={{
                  width: canvasWidth - AXIS_GUTTER,
                  height: canvasHeight,
                }}
              >
                <Group clip={plotClipRect}>
                  {trackLayouts.map((layout, idx) => {
                    const isMovingThis =
                      movingTrackId === layout.id;

                    const previewPx =
                      isMovingThis && maxDuration > 0
                        ? movePreviewDeltaSeconds *
                          (plotWidth / maxDuration)
                        : 0;

                    return (
                      <Track
                        key={layout.id}
                        layout={layout}
                        plotWidth={plotWidth}
                        channelHeight={channelHeight}
                        isLast={
                          idx === trackLayouts.length - 1
                        }
                        isSelected={
                          layout.id === selectedTrackId
                        }
                        extraTranslateXPx={previewPx}
                      />
                    );
                  })}
                </Group>

                <Playhead
                  positionSeconds={positionSeconds}
                  maxDurationSeconds={maxDuration}
                  plotWidth={plotWidth}
                  canvasHeight={canvasHeight}
                />
              </Canvas>

              {normalizedSelection &&
                maxDuration > 0 &&
                selectedTrackLayout && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.selectionHighlight,
                      {
                        left: timeToX(
                          normalizedSelection.start
                        ),
                        width: Math.max(
                          1,
                          timeToX(
                            normalizedSelection.end
                          ) -
                            timeToX(
                              normalizedSelection.start
                            )
                        ),
                        top: getTrackSelectionBounds(
                          selectedTrackLayout
                        ).top,
                        height: getTrackSelectionBounds(
                          selectedTrackLayout
                        ).height,
                      },
                    ]}
                  />
                )}

              {normalizedSelection &&
                maxDuration > 0 &&
                isSelectionMode &&
                selectedTrackLayout && (
                  <>
                    <View
                      pointerEvents="none"
                      style={[
                        styles.selectionHandle,
                        {
                          left:
                            timeToX(
                              normalizedSelection.start
                            ) -
                            SELECTION_HANDLE_WIDTH / 2,
                          top: getTrackSelectionBounds(
                            selectedTrackLayout
                          ).top,
                          height: getTrackSelectionBounds(
                            selectedTrackLayout
                          ).height,
                        },
                      ]}
                    >
                      <View
                        style={styles.selectionHandleGrip}
                      />
                    </View>

                    <View
                      pointerEvents="none"
                      style={[
                        styles.selectionHandle,
                        {
                          left:
                            timeToX(
                              normalizedSelection.end
                            ) -
                            SELECTION_HANDLE_WIDTH / 2,
                          top: getTrackSelectionBounds(
                            selectedTrackLayout
                          ).top,
                          height: getTrackSelectionBounds(
                            selectedTrackLayout
                          ).height,
                        },
                      ]}
                    >
                      <View
                        style={styles.selectionHandleGrip}
                      />
                    </View>
                  </>
                )}

              {isSelectionMode &&
                maxDuration > 0 && (
                  <View
                    style={styles.selectionGestureLayer}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={
                      handleSelectionLayerStart
                    }
                    onResponderMove={
                      handleSelectionLayerMove
                    }
                    onResponderRelease={
                      handleSelectionLayerEnd
                    }
                    onResponderTerminate={
                      handleSelectionLayerEnd
                    }
                  />
                )}

              {isMoveMode && maxDuration > 0 && (
                <View
                  style={styles.selectionGestureLayer}
                  onStartShouldSetResponder={() => true}
                  onMoveShouldSetResponder={() => true}
                  onResponderGrant={handleMoveLayerStart}
                  onResponderMove={handleMoveLayerMove}
                  onResponderRelease={handleMoveLayerEnd}
                  onResponderTerminate={handleMoveLayerEnd}
                />
              )}
            </View>
          </ScrollView>

          <TrackTitles
            trackLayouts={trackLayouts}
            canvasHeight={canvasHeight}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            trackVolume={getTrackVolume}
            onVolumeChange={handleVolumeChange}
            onDeleteTrack={handleDeleteTrack}
          />
        </View>
      </View>

      <View style={styles.editorToolbar}>
        <View style={styles.editTools}>
          <TouchableOpacity
            style={[
              styles.toolButton,
              isSelectionMode &&
                styles.toolButtonActive,
            ]}
            onPress={handleSelectionToggle}
            disabled={tracks.length === 0}
            accessibilityRole="button"
            accessibilityLabel={
              isSelectionMode
                ? 'Onemogući selekciju'
                : 'Omogući selekciju'
            }
          >
            <MaterialIcons
              name="select-all"
              size={20}
              color={
                isSelectionMode
                  ? '#1561bd'
                  : '#526174'
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              isMoveMode &&
                styles.toolButtonActive,
            ]}
            onPress={handleMoveToggle}
            disabled={
              tracks.length === 0 ||
              isApplyingMove
            }
            accessibilityRole="button"
            accessibilityLabel={
              isMoveMode
                ? 'Onemogući pomjeranje'
                : 'Omogući pomjeranje'
            }
          >
            <MaterialIcons
              name="pan-tool"
              size={19}
              color={
                isMoveMode
                  ? '#1561bd'
                  : '#526174'
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              !canSplit &&
                styles.toolButtonDisabled,
            ]}
            onPress={handleSplit}
            disabled={
              !canSplit ||
              isApplyingSplit
            }
            accessibilityRole="button"
            accessibilityLabel="Podijeli"
          >
            {isApplyingSplit ? (
              <ActivityIndicator
                size="small"
                color="#64748b"
              />
            ) : (
              <MaterialIcons
                name="content-cut"
                size={20}
                color={
                  canSplit
                    ? '#526174'
                    : '#b7c0cc'
                }
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              (!normalizedSelection ||
                isApplyingEffect) &&
                styles.toolButtonDisabled,
            ]}
            onPress={() =>
              setShowEffectPanel(true)
            }
            disabled={
              !normalizedSelection ||
              isApplyingEffect
            }
            accessibilityRole="button"
            accessibilityLabel="Efekti"
          >
            <MaterialIcons
              name="auto-fix-high"
              size={20}
              color={
                normalizedSelection &&
                !isApplyingEffect
                  ? '#7c3aed'
                  : '#b7c0cc'
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolButton,
              isLoopEnabled &&
                styles.toolButtonActive,
            ]}
            onPress={handleLoopToggle}
            disabled={!canLoop}
            accessibilityRole="button"
            accessibilityLabel={
              isLoopEnabled
                ? 'Onemogući petlju'
                : 'Omogući petlju'
            }
          >
            <MaterialIcons
              name="repeat"
              size={20}
              color={
                isLoopEnabled
                  ? '#1561bd'
                  : canLoop
                    ? '#526174'
                    : '#b7c0cc'
              }
            />
          </TouchableOpacity>
        </View>

        <View style={styles.toolDivider} />

        <View style={styles.transportControls}>
          <TouchableOpacity
            style={[
              styles.transportButton,
              styles.playButton,
            ]}
            onPress={handleToggleAll}
            disabled={tracks.length === 0}
            accessibilityRole="button"
            accessibilityLabel={
              isPlayingAll
                ? 'Pauziraj sve'
                : 'Pokreni sve'
            }
          >
            <MaterialIcons
              name={
                isPlayingAll
                  ? 'pause'
                  : 'play-arrow'
              }
              size={27}
              color="#ffffff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.transportButton,
              styles.stopButton,
            ]}
            onPress={handleStopAll}
            disabled={tracks.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Stopiraj sve"
          >
            <MaterialIcons
              name="stop"
              size={23}
              color={
                tracks.length === 0
                  ? '#94a3b8'
                  : '#475569'
              }
            />
          </TouchableOpacity>
        </View>
      </View>

      {showEffectPanel &&
        normalizedSelection && (
          <View style={styles.effectPanel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                styles.effectTypeRow
              }
            >
              <TouchableOpacity
                style={[
                  styles.effectTypeButton,
                  effectType === 'echo' &&
                    styles.effectTypeButtonActive,
                ]}
                onPress={() =>
                  setEffectType('echo')
                }
              >
                <Text
                  style={
                    styles.effectTypeButtonText
                  }
                >
                  Echo / Delay
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.effectTypeButton,
                  effectType === 'silence' &&
                    styles.effectTypeButtonActive,
                ]}
                onPress={() =>
                  setEffectType('silence')
                }
              >
                <Text
                  style={
                    styles.effectTypeButtonText
                  }
                >
                  Silence
                </Text>
              </TouchableOpacity>

              {(
                [
                  ['amplify', 'Amplify'],
                  ['normalize', 'Normalize'],
                  ['fadeIn', 'Fade In'],
                  ['fadeOut', 'Fade Out'],
                  ['tempo', 'Change Tempo'],
                  ['pitch', 'Pitch'],
                  ['reverb', 'Reverb'],
                  ['equalizer', 'Graphic EQ'],
                  ['bass', 'Bass'],
                  ['treble', 'Treble'],
                  ['phaser', 'Phaser'],
                  ['distortion', 'Distortion'],
                ] as [SelectionEffect, string][]
              ).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.effectTypeButton,
                    effectType === key &&
                      styles.effectTypeButtonActive,
                  ]}
                  onPress={() =>
                    setEffectType(key)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <Text
                    style={
                      styles.effectTypeButtonText
                    }
                  >
                    {key === 'pitch' ? 'Change Pitch' : label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {effectType === 'echo' && (
              <>
                {renderEffectSlider(
                  'Delay',
                  effectDelayMs,
                  50,
                  1000,
                  10,
                  setEffectDelayMs,
                  ' ms'
                )}

                {renderEffectSlider(
                  'Echo Decay',
                  effectDecay,
                  0.1,
                  0.9,
                  0.05,
                  setEffectDecay
                )}
              </>
            )}

            {effectType === 'amplify' &&
              renderEffectSlider(
                'Gain',
                effectAmount,
                0.5,
                3,
                0.1,
                setEffectAmount,
                'x'
              )}

            {effectType === 'normalize' &&
              renderEffectSlider(
                'Loudness',
                effectTargetLufs,
                -30,
                -5,
                1,
                setEffectTargetLufs,
                ' LUFS'
              )}

            {(effectType === 'fadeIn' ||
              effectType === 'fadeOut') &&
              renderEffectSlider(
                'Fade Duration',
                effectDuration,
                0.1,
                10,
                0.1,
                setEffectDuration,
                ' s'
              )}

            {effectType === 'tempo' &&
              renderEffectSlider(
                'Speed',
                effectTempo,
                0.5,
                2,
                0.05,
                setEffectTempo,
                'x'
              )}
            {effectType === 'pitch' &&
              renderEffectSlider(
                'Pitch',
                effectPitch,
                -12,
                12,
                1,
                setEffectPitch,
                ' st'
              )}

            {effectType === 'reverb' &&
              renderEffectSlider(
                'Reverb Amount',
                effectAmount,
                0.1,
                3,
                0.1,
                setEffectAmount,
                'x'
              )}

            {effectType === 'equalizer' && (
              renderGraphicEq()
            )}

            {(effectType === 'bass' ||
              effectType === 'treble') && (
              <>
                {renderEffectSlider(
                  'Gain',
                  effectGain,
                  -12,
                  12,
                  0.5,
                  setEffectGain,
                  ' dB'
                )}

                {renderEffectSlider(
                  'Frequency',
                  effectFrequency,
                  20,
                  12000,
                  10,
                  setEffectFrequency,
                  ' Hz'
                )}
              </>
            )}

            {effectType === 'phaser' && (
              <>
                {renderEffectSlider(
                  'Depth',
                  effectPhaserDepth,
                  0.1,
                  10,
                  0.1,
                  setEffectPhaserDepth
                )}

                {renderEffectSlider(
                  'Decay',
                  effectPhaserDecay,
                  0,
                  0.9,
                  0.05,
                  setEffectPhaserDecay
                )}

                {renderEffectSlider(
                  'Speed',
                  effectPhaserSpeed,
                  0.1,
                  5,
                  0.1,
                  setEffectPhaserSpeed,
                  ' Hz'
                )}

                {renderEffectSlider(
                  'Delay',
                  effectPhaserDelay,
                  0.1,
                  10,
                  0.1,
                  setEffectPhaserDelay,
                  ' ms'
                )}
              </>
            )}

            {effectType === 'distortion' &&
              renderEffectSlider(
                'Drive',
                effectDistortionDrive,
                1,
                10,
                0.1,
                setEffectDistortionDrive,
                'x'
              )}

            {effectType === 'silence' && (
              <Text
                style={
                  styles.effectSilenceNote
                }
              >
                The selected part of the audio will be completely muted (flat line, zero signal).
              </Text>
            )}

            <View style={styles.effectButtonsRow}>
              <TouchableOpacity
                style={[
                  styles.effectActionButton,
                  styles.effectCancelButton,
                ]}
                onPress={() =>
                  setShowEffectPanel(false)
                }
                disabled={isApplyingEffect}
              >
                <Text
                  style={
                    styles.effectActionButtonText
                  }
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.effectActionButton,
                  styles.effectApplyButton,
                ]}
                onPress={handleApplyEffect}
                disabled={isApplyingEffect}
              >
                {isApplyingEffect ? (
                  <ActivityIndicator
                    size="small"
                    color="#ffffff"
                  />
                ) : (
                  <Text
                    style={
                      styles.effectActionButtonText
                    }
                  >
                    Confirm
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
    </ScrollView>
  </SafeAreaView>
);

}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7fb',
    paddingTop: 0,
    paddingHorizontal: 5,
  },

  waveformStage: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
  },

  meta: {
    marginTop: 14,
    marginHorizontal: 15,
    color: '#46607c',
    fontSize: 13,
  },

  topControls: {
    height: 44,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  addTrackButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  timeDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  timeDisplay: {
    color: '#263548',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.2,
  },

  timeSeparator: {
    color: '#94a3b8',
    fontWeight: '400',
  },

  zoomControls: {
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  zoomIconButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },

  editorToolbar: {
    marginTop: 10,
    marginHorizontal: 15,
    minHeight: 58,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e3e8ef',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 2,
  },

  transportControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  transportButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  playButton: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: '#059669',
  },

  stopButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e2e8f0',
  },

  toolDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 12,
  },

  editTools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },

  toolButtonActive: {
    backgroundColor: '#e8f1fb',
  },

  toolButtonDisabled: {
    opacity: 0.55,
  },

  selectionHighlight: {
    position: 'absolute',
    top: 0,
    backgroundColor: 'rgba(15, 118, 110, 0.18)',
    borderColor: 'rgba(15, 118, 110, 0.55)',
    borderWidth: 1,
  },

  selectionHandle: {
    position: 'absolute',
    top: 0,
    width: SELECTION_HANDLE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },

  selectionHandleGrip: {
    width: 5,
    height: '72%',
    borderRadius: 3,
    backgroundColor: '#0f766e',
  },

  selectionGestureLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f4f7fb',
    padding: 20,
  },

  loadingText: {
    marginTop: 12,
    color: '#17324d',
    fontSize: 15,
  },

  errorText: {
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center',
  },

  effectPanel: {
    marginTop: 8,
    marginHorizontal: 15,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },

  effectPanelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#17324d',
    marginBottom: 8,
  },

  effectRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  effectLabel: {
    width: 125,
    fontSize: 12,
    color: '#46607c',
  },

  effectSlider: {
    flex: 1,
    height: 30,
  },

  effectValue: {
    width: 70,
    color: '#17324d',
    fontSize: 12,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },

  effectButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },

  effectActionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  effectActionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },

  effectCancelButton: {
    backgroundColor: '#64748b',
  },

  effectApplyButton: {
    backgroundColor: '#1561bd',
  },

  effectTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },

  effectTypeButton: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pitchEffectTypeButton: {
    width: 42,
    paddingHorizontal: 0,
  },

  effectTypeButtonActive: {
    backgroundColor: '#e8f1fb',
    borderWidth: 1,
    borderColor: '#1561bd',
  },

  effectTypeButtonText: {
    color: '#526174',
    fontWeight: '600',
    fontSize: 12,
  },

  graphicEqRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 4,
    width: '100%',
    justifyContent: 'space-between',
  },

  graphicEqBand: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },

  graphicEqGain: {
    color: '#526174',
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },

  graphicEqSliderSlot: {
    width: '100%',
    height: 142,
    alignItems: 'center',
    justifyContent: 'center',
  },

  graphicEqSlider: {
    width: 142,
    height: 40,
    transform: [{ rotate: '-90deg' }],
  },

  graphicEqFrequency: {
    color: '#526174',
    fontSize: 10,
    marginTop: 4,
  },

  effectSilenceNote: {
    fontSize: 12,
    color: '#46607c',
    marginBottom: 8,
    fontStyle: 'italic',
  },
});
