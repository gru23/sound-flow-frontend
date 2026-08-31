import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

export type PlayableTrack = { id: string; uri: string };

// Jedan Audio.Sound po tracku (mapiran preko id-a), deljen između
// individualnog preview dugmeta i "play all" funkcije - ko god prvi
// zatraži dati track, kreira Sound objekat; drugi ga samo ponovo koristi.
export function usePlayback() {
  const soundsRef = useRef<Map<string, Audio.Sound>>(new Map());
  const volumeByIdRef = useRef<Map<string, number>>(new Map());
  const [playingIds, setPlayingIds] = useState<Set<string>>(new Set());

  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const positionRef = useRef(0); // uvek sinhronizovan sa positionSeconds, bez stale closure problema
  const maxDurationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickAnchorRef = useRef({ wallClock: 0, position: 0 });

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    return () => {
      stopTimer();
      soundsRef.current.forEach((sound) => sound.unloadAsync().catch(() => {}));
      soundsRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // Playhead se pomera preko wall-clock timera (ne preko statusa pojedinačnog
  // Sound-a), jer zapisi mogu imati različito trajanje - "vreme" je zajedničko
  // za sve, vezano za najdužu pesmu (maxDurationRef).
  function startTimer() {
    stopTimer();
    tickAnchorRef.current = { wallClock: Date.now(), position: positionRef.current };
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - tickAnchorRef.current.wallClock) / 1000;
      const next = tickAnchorRef.current.position + elapsed;

      if (next >= maxDurationRef.current) {
        positionRef.current = maxDurationRef.current;
        setPositionSeconds(maxDurationRef.current);
        void pauseAll();
      } else {
        positionRef.current = next;
        setPositionSeconds(next);
      }
    }, 120);
  }

  const markStopped = useCallback((id: string) => {
    setPlayingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  function clampVolume(volume: number) {
    return Math.max(0, Math.min(1, volume));
  }

  async function applyTrackVolume(sound: Audio.Sound, volume: number) {
    await sound.setVolumeAsync(clampVolume(volume));
  }

  async function getOrCreateSound(id: string, uri: string) {
    let sound = soundsRef.current.get(id);
    if (!sound) {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        (status: AVPlaybackStatus) => {
          if (status.isLoaded && status.didJustFinish) {
            markStopped(id);
          }
        }
      );
      sound = newSound;
      await applyTrackVolume(sound, volumeByIdRef.current.get(id) ?? 1);
      soundsRef.current.set(id, sound);
    }
    return sound;
  }

  // Individualna reprodukcija JEDNOG tracka (dugme pored naslova)
  const togglePlayback = useCallback(
    async (id: string, uri: string) => {
      const sound = await getOrCreateSound(id, uri);
      const status = await sound.getStatusAsync();
      if (!status.isLoaded) return;

      if (status.isPlaying) {
        await sound.pauseAsync();
        markStopped(id);
        return;
      }

      if (status.didJustFinish || status.positionMillis >= (status.durationMillis ?? 0)) {
        await sound.setPositionAsync(0);
      }
      await sound.playAsync();
      setPlayingIds((prev) => new Set(prev).add(id));
    },
    [markStopped]
  );

  const isPlaying = useCallback((id: string) => playingIds.has(id), [playingIds]);

  // Reprodukcija SVIH zapisa odjednom, sa zajedničkim playhead vremenom
  const playAll = useCallback(async (tracksToPlay: PlayableTrack[], maxDurationSeconds: number) => {
    maxDurationRef.current = maxDurationSeconds;

    const sounds = await Promise.all(tracksToPlay.map((t) => getOrCreateSound(t.id, t.uri)));
    const seekMs = Math.round(positionRef.current * 1000);

    await Promise.all(
      sounds.map(async (sound) => {
        const status = await sound.getStatusAsync();
        if (!status.isLoaded) return;
        const clampedMs = Math.min(seekMs, status.durationMillis ?? seekMs);
        await sound.setPositionAsync(clampedMs);
        await sound.playAsync();
      })
    );

    setIsPlayingAll(true);
    startTimer();
  }, []);

  const pauseAll = useCallback(async () => {
    stopTimer();
    setIsPlayingAll(false);
    await Promise.all(Array.from(soundsRef.current.values()).map((s) => s.pauseAsync().catch(() => {})));
  }, []);

  const seekAll = useCallback(
    async (nextPositionSeconds: number) => {
      const clampedSeconds = Math.max(
        0,
        maxDurationRef.current > 0 ? Math.min(nextPositionSeconds, maxDurationRef.current) : nextPositionSeconds
      );

      positionRef.current = clampedSeconds;
      setPositionSeconds(clampedSeconds);

      if (!isPlayingAll) return;

      stopTimer();
      const seekMs = Math.round(clampedSeconds * 1000);

      await Promise.all(
        Array.from(soundsRef.current.values()).map(async (sound) => {
          const status = await sound.getStatusAsync();
          if (!status.isLoaded) return;
          const clampedMs = Math.min(seekMs, status.durationMillis ?? seekMs);
          await sound.setPositionAsync(clampedMs);
        })
      );

      startTimer();
    },
    [isPlayingAll]
  );

  const stopAll = useCallback(async () => {
    stopTimer();
    setIsPlayingAll(false);
    positionRef.current = 0;
    setPositionSeconds(0);
    setPlayingIds(new Set());

    await Promise.all(Array.from(soundsRef.current.values()).map((s) => s.stopAsync().catch(() => {})));
  }, []);

  const toggleAll = useCallback(
    async (tracksToPlay: PlayableTrack[], maxDurationSeconds: number) => {
      if (isPlayingAll) {
        await pauseAll();
      } else {
        if (positionRef.current >= maxDurationSeconds) {
          positionRef.current = 0;
          setPositionSeconds(0);
        }
        await playAll(tracksToPlay, maxDurationSeconds);
      }
    },
    [isPlayingAll, pauseAll, playAll]
  );

  const setTrackVolume = useCallback(async (id: string, uri: string, volume: number) => {
    const nextVolume = clampVolume(volume);
    volumeByIdRef.current.set(id, nextVolume);

    const sound = await getOrCreateSound(id, uri);
    const status = await sound.getStatusAsync();
    if (!status.isLoaded) return;

    await applyTrackVolume(sound, nextVolume);
  }, []);

  const setTrackMuted = useCallback(async (id: string, uri: string, muted: boolean) => {
    await setTrackVolume(id, uri, muted ? 0 : 1);
  }, [setTrackVolume]);

  const unloadTrack = useCallback(async (id: string) => {
    const sound = soundsRef.current.get(id);
    if (sound) {
      await sound.unloadAsync().catch(() => {});
      soundsRef.current.delete(id);
    }
    volumeByIdRef.current.delete(id);
    setPlayingIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { togglePlayback, isPlaying, toggleAll, stopAll, seekAll, isPlayingAll, positionSeconds, setTrackMuted, setTrackVolume, unloadTrack };
}