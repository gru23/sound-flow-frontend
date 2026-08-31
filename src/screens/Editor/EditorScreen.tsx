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
  const [effectFrequency, setEffectFrequency] = useState(1000);
  const [effectGain, setEffectGain] = useState(0);
  const [isApplyingEffect, setIsApplyingEffect] = useState(false);


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

  const { toggleAll, stopAll, seekAll, isPlayingAll, positionSeconds, setTrackVolume, unloadTrack } = usePlayback();

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

  const clearSelection = () => {
    setSelectionStartTime(null);
    setSelectionEndTime(null);
    setSelectedTrackId(null);
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
          ? await applyEchoToSelection(track.path, normalizedSelection.start, normalizedSelection.end, track.duration, {
              delayMs: effectDelayMs,
              decay: effectDecay,
            })
          : effectType === 'silence'
            ? await applySilenceToSelection(track.path, normalizedSelection.start, normalizedSelection.end)
            : await applyEffectToSelection(track.path, normalizedSelection.start, normalizedSelection.end, track.duration, effectType, {
                amount: effectType === 'normalize' ? effectTargetLufs : effectAmount,
                duration: effectDuration,
                tempo: effectTempo,
                frequency: effectFrequency,
                gain: effectGain,
              });


      // Ponovo izvlačimo waveform/trajanje iz IZMENJENOG fajla - isti kod
      // koji se koristi i pri prvom uvozu pesme.
      const refreshed = await extractTrackData(newPath, `${track.title}.wav`);
      // Playback kešira Audio.Sound po ID-u, pa ga moramo osloboditi nakon
      // promjene putanje da bi sljedeća reprodukcija učitala novi fajl.
      await unloadTrack(track.id);
      setTracks((prev) =>
        prev.map((t) => (t.id === track.id ? { ...t, ...refreshed, id: track.id } : t))
      );

      clearSelection();
    } catch (err) {
      console.error('Greška pri primjeni efekta:', err);
      Alert.alert('Greška', 'Nije uspjela primjena efekta.');
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
      {/* FIKSNA vremenska osa - van vertikalnog ScrollView-a, ostaje na vrhu
          i kad se skroluje na dole. Horizontalno je scrollEnabled=false -
          pomera se programski, u sinhronizaciji sa glavnim sadržajem. */}
      <View style={styles.timeDisplayContainer}>
        <Text style={styles.timeDisplay}>
          {formatTime(positionSeconds)} / {formatTime(maxDuration)}
        </Text>
        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={[styles.zoomButton, zoomFactor <= minVisualZoom && styles.zoomButtonDisabled]}
            onPress={handleZoomOut}
            disabled={zoomFactor <= minVisualZoom}
            accessibilityRole="button"
            accessibilityLabel="Umanji prikaz"
          >
            <MaterialIcons name="remove" size={22} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.zoomButton, zoomFactor >= MAX_ZOOM && styles.zoomButtonDisabled]}
            onPress={handleZoomIn}
            disabled={zoomFactor >= MAX_ZOOM}
            accessibilityRole="button"
            accessibilityLabel="Uvećaj prikaz"
          >
            <MaterialIcons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>


      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: AXIS_GUTTER, height: TIME_AXIS_AREA }} />
        <ScrollView
          ref={headerScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={false}
          bounces={false}
        >
          <Canvas style={{ width: canvasWidth - AXIS_GUTTER, height: TIME_AXIS_AREA }}>
            <TimeAxis plotWidth={plotWidth} durationSeconds={maxDuration} font={font} />
          </Canvas>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.waveformStage}>
          <View style={{ flexDirection: 'row', position: 'relative' }}>
            <Canvas style={{ width: AXIS_GUTTER, height: canvasHeight }}>
              <AmplitudeAxis trackLayouts={trackLayouts} channelHeight={channelHeight} font={font} />
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
              <View style={{ width: canvasWidth - AXIS_GUTTER, height: canvasHeight, position: 'relative' }}>
                <Canvas style={{ width: canvasWidth - AXIS_GUTTER, height: canvasHeight }}>
                  <Group clip={plotClipRect}>
                    {trackLayouts.map((layout, idx) => {
                      const isMovingThis = movingTrackId === layout.id;
                      const previewPx = isMovingThis && maxDuration > 0 ? movePreviewDeltaSeconds * (plotWidth / maxDuration) : 0;
                      return (
                        <Track
                          key={layout.id}
                          layout={layout}
                          plotWidth={plotWidth}
                          channelHeight={channelHeight}
                          isLast={idx === trackLayouts.length - 1}
                          isSelected={layout.id === selectedTrackId}
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

                {normalizedSelection && maxDuration > 0 && selectedTrackLayout && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.selectionHighlight,
                      {
                        left: timeToX(normalizedSelection.start),
                        width: Math.max(1, timeToX(normalizedSelection.end) - timeToX(normalizedSelection.start)),
                        top: getTrackSelectionBounds(selectedTrackLayout).top,
                        height: getTrackSelectionBounds(selectedTrackLayout).height,
                      },
                    ]}
                  />
                )}

                {normalizedSelection && maxDuration > 0 && isSelectionMode && selectedTrackLayout && (
                  <>
                    <View
                      pointerEvents="none"
                      style={[
                        styles.selectionHandle,
                        {
                          left: timeToX(normalizedSelection.start) - SELECTION_HANDLE_WIDTH / 2,
                          top: getTrackSelectionBounds(selectedTrackLayout).top,
                          height: getTrackSelectionBounds(selectedTrackLayout).height,
                        },
                      ]}
                    >
                      <View style={styles.selectionHandleGrip} />
                    </View>
                    <View
                      pointerEvents="none"
                      style={[
                        styles.selectionHandle,
                        {
                          left: timeToX(normalizedSelection.end) - SELECTION_HANDLE_WIDTH / 2,
                          top: getTrackSelectionBounds(selectedTrackLayout).top,
                          height: getTrackSelectionBounds(selectedTrackLayout).height,
                        },
                      ]}
                    >
                      <View style={styles.selectionHandleGrip} />
                    </View>
                  </>
                )}

                {isSelectionMode && maxDuration > 0 && (
                  <View
                    style={styles.selectionGestureLayer}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={handleSelectionLayerStart}
                    onResponderMove={handleSelectionLayerMove}
                    onResponderRelease={handleSelectionLayerEnd}
                    onResponderTerminate={handleSelectionLayerEnd}
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

        <Text style={styles.meta}>Trajanje: {maxDuration.toFixed(2)} s</Text>
        <Text style={styles.meta} numberOfLines={2}>Putanja: {initialPath ?? '-'}</Text>

        <View style={styles.modeControls}>
          <TouchableOpacity
            style={[styles.modeButton, isSelectionMode && styles.modeButtonActive]}
            onPress={handleSelectionToggle}
            disabled={tracks.length === 0}
          >
            <Text style={styles.modeButtonText}>{isSelectionMode ? 'Select ON' : 'Select OFF'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, isMoveMode && styles.modeButtonActive]}
            onPress={handleMoveToggle}
            disabled={tracks.length === 0 || isApplyingMove}
          >
            <MaterialIcons name="pan-tool" size={18} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, styles.splitButton]}
            onPress={handleSplit}
            disabled={!canSplit || isApplyingSplit}
          >
            {isApplyingSplit ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.modeButtonText}>✂ Split</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeButton, styles.effectOpenButton]}
            onPress={() => setShowEffectPanel(true)}
            disabled={!normalizedSelection || isApplyingEffect}
          >
            <MaterialIcons name="auto-fix-high" size={18} color="#ffffff" />
            <Text style={styles.modeButtonText}>Efekti</Text>
          </TouchableOpacity>
        </View>

        {showEffectPanel && normalizedSelection && (
          <View style={styles.effectPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.effectTypeRow}>
              <TouchableOpacity
                style={[styles.effectTypeButton, effectType === 'echo' && styles.effectTypeButtonActive]}
                onPress={() => setEffectType('echo')}
              >
                <Text style={styles.effectTypeButtonText}>Echo / Delay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.effectTypeButton, effectType === 'silence' && styles.effectTypeButtonActive]}
                onPress={() => setEffectType('silence')}
              >
                <Text style={styles.effectTypeButtonText}>Silence</Text>
              </TouchableOpacity>
              {([
                ['amplify', 'Amplify'],
                ['normalize', 'Normalize'],
                ['fadeIn', 'Fade In'],
                ['fadeOut', 'Fade Out'],
                ['tempo', 'Change Tempo'],
                ['reverb', 'Reverb'],
                ['equalizer', 'Graphic EQ'],
                ['bass', 'Bass'],
                ['treble', 'Treble'],
              ] as [SelectionEffect, string][]).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.effectTypeButton, effectType === key && styles.effectTypeButtonActive]}
                  onPress={() => setEffectType(key)}
                >
                  <Text style={styles.effectTypeButtonText}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {effectType === 'echo' && (
              <>
                {renderEffectSlider('Kašnjenje', effectDelayMs, 50, 1000, 10, setEffectDelayMs, ' ms')}
                {renderEffectSlider('Slabljenje odjeka', effectDecay, 0.1, 0.9, 0.05, setEffectDecay)}
              </>
            )}

            {effectType === 'amplify' && renderEffectSlider('Pojačanje', effectAmount, 0.5, 3, 0.1, setEffectAmount, 'x')}
            {effectType === 'normalize' && renderEffectSlider('Ciljna glasnoća', effectTargetLufs, -30, -5, 1, setEffectTargetLufs, ' LUFS')}
            {(effectType === 'fadeIn' || effectType === 'fadeOut') && renderEffectSlider('Trajanje fade-a', effectDuration, 0.1, 10, 0.1, setEffectDuration, ' s')}
            {effectType === 'tempo' && renderEffectSlider('Brzina', effectTempo, 0.5, 2, 0.05, setEffectTempo, 'x')}
            {effectType === 'reverb' && renderEffectSlider('Jačina reverba', effectAmount, 0.1, 3, 0.1, setEffectAmount, 'x')}
            {effectType === 'equalizer' && (
              <>
                {renderEffectSlider('Frekvencija', effectFrequency, 80, 12000, 10, setEffectFrequency, ' Hz')}
                {renderEffectSlider('Gain', effectGain, -12, 12, 0.5, setEffectGain, ' dB')}
              </>
            )}
            {(effectType === 'bass' || effectType === 'treble') && (
              <>
                {renderEffectSlider('Gain', effectGain, -12, 12, 0.5, setEffectGain, ' dB')}
                {renderEffectSlider('Frekvencija', effectFrequency, 20, 12000, 10, setEffectFrequency, ' Hz')}
              </>
            )}

            {effectType === 'silence' && (
              <Text style={styles.effectSilenceNote}>
                Selektovani dio signala biće potpuno utišan (ravna linija, nulti signal).
              </Text>
            )}

            <View style={styles.effectButtonsRow}>
              <TouchableOpacity
                style={[styles.modeButton, styles.effectCancelButton]}
                onPress={() => setShowEffectPanel(false)}
                disabled={isApplyingEffect}
              >
                <Text style={styles.modeButtonText}>Otkaži</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, styles.effectApplyButton]}
                onPress={handleApplyEffect}
                disabled={isApplyingEffect}
              >
                {isApplyingEffect ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.modeButtonText}>Primijeni</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.playAllButton} onPress={handleToggleAll} disabled={tracks.length === 0}>
          <Text style={styles.playAllButtonText}>
            {isPlayingAll ? '⏸ Pauziraj sve' : '▶ Pokreni sve'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.stopAllButton} onPress={handleStopAll} disabled={tracks.length === 0}>
          <Text style={styles.stopAllButtonText}>⏹ Stopiraj sve</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.addButton} onPress={pickAndAddTrack} disabled={isAddingTrack}>
          {isAddingTrack ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.addButtonText}>+ Dodaj pjesmu</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f7fb', paddingTop: 28, paddingHorizontal: 5 },
  waveformStage: { backgroundColor: 'transparent', paddingVertical: 8 },
  meta: { marginTop: 14, marginHorizontal: 15, color: '#46607c', fontSize: 13 },
  modeControls: {
    marginTop: 10,
    marginHorizontal: 15,
    flexDirection: 'row',
    gap: 10,
  },
  modeButton: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitButton: {
    backgroundColor: '#7c2d12',
  },
  modeButtonActive: {
    backgroundColor: '#0f766e',
  },
  modeButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  playAllButton: {
    marginTop: 8,
    marginHorizontal: 15,
    backgroundColor: '#17324d',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playAllButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  zoomControls: {
    marginLeft: 10,
    flexDirection: 'row',
    gap: 10,
  },
  zoomButton: {
    backgroundColor: '#0f766e',
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomButtonDisabled: { backgroundColor: '#94a3b8' },
  stopAllButton: {
    marginTop: 10,
    marginHorizontal: 15,
    backgroundColor: '#b42318',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopAllButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
  addButton: {
    marginTop: 20,
    marginHorizontal: 15,
    backgroundColor: '#1561bd',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },
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
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f4f7fb', padding: 20 },
  loadingText: { marginTop: 12, color: '#17324d', fontSize: 15 },
  errorText: { color: '#b42318', fontSize: 16, textAlign: 'center' },
  clearSelectionButton: {
    backgroundColor: '#7c2d12',
    flex: 1,
  },
  effectOpenButton: { backgroundColor: '#0f766e', flex: 1 },
  effectPanel: {
    marginTop: 10,
    marginHorizontal: 15,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  effectPanelTitle: { fontSize: 14, fontWeight: '700', color: '#17324d', marginBottom: 8 },
  effectRow: { marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  effectLabel: { width: 125, fontSize: 12, color: '#46607c' },
  effectSlider: { flex: 1, height: 30 },
  effectValue: { width: 70, color: '#17324d', fontSize: 12, textAlign: 'right', fontVariant: ['tabular-nums'] },
  effectButtonsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  effectCancelButton: { backgroundColor: '#334155', flex: 1 },
  effectApplyButton: { backgroundColor: '#1561bd', flex: 1 },
  effectTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  effectTypeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
  },
  effectTypeButtonActive: { backgroundColor: '#1561bd' },
  effectTypeButtonText: { color: '#17324d', fontWeight: '600', fontSize: 12 },
  effectSilenceNote: { fontSize: 12, color: '#46607c', marginBottom: 8, fontStyle: 'italic' },
  timeDisplayContainer: {
    position: 'absolute',
    top: 8,
    right: 10,
    zIndex: 100,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },

  timeDisplay: {
    color: '#030303',
    fontSize: 14,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },

});