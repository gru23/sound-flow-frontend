import React from 'react';
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Slider from '@react-native-community/slider';
import { AXIS_GUTTER, TrackLayout } from '../types';

type Props = {
  trackLayouts: TrackLayout[];
  canvasHeight: number;
  isMuted: (id: string) => boolean;
  onToggleMute: (id: string) => void;
  trackVolume: (id: string) => number;
  onVolumeChange: (id: string, volume: number) => void;
  onDeleteTrack: (id: string) => void;
};

// Diskretni naslovi pesama - obične RN Text komponente, van horizontalnog
// ScrollView-a, pa ostaju vidljivi bez obzira na scroll poziciju signala.
// Ispred naslova je "x" dugme koje uklanja ceo track.
export default function TrackTitles({
  trackLayouts,
  canvasHeight,
  isMuted,
  onToggleMute,
  trackVolume,
  onVolumeChange,
  onDeleteTrack,
}: Props) {
  return (
    <View pointerEvents="box-none" style={[styles.overlay, { left: AXIS_GUTTER, height: canvasHeight }]}>
      {trackLayouts.map((tl) => (
        <View key={`${tl.id}-header`} style={[styles.headerRow, { top: tl.titleY }]}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDeleteTrack(tl.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="close" size={14} style={styles.deleteIcon} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {tl.title}
          </Text>
        </View>
      ))}
      <View style={styles.rightView}>
        {trackLayouts.map((tl) => (
          <View key={`${tl.id}-volume`} style={[styles.volumeRow, { top: tl.titleY - 4 }]}>
            <TouchableOpacity
              style={styles.muteButton}
              onPress={() => onToggleMute(tl.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialIcons
                name={isMuted(tl.id) ? 'volume-off' : 'volume-up'}
                size={14}
                style={[styles.muteIcon, isMuted(tl.id) && styles.muteIconActive]}
              />
            </TouchableOpacity>

            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              value={trackVolume(tl.id)}
              onValueChange={(value) => onVolumeChange(tl.id, value)}
              minimumTrackTintColor="#1561bd"
              maximumTrackTintColor="#c7cfdb"
              thumbTintColor="#1561bd"
            />

            <Text style={styles.volumeText}>{Math.round(trackVolume(tl.id) * 100)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0 },
  headerRow: { position: 'absolute', left: 4, flexDirection: 'row', alignItems: 'center' },
  deleteButton: { paddingHorizontal: 4, paddingVertical: 2 },
  deleteIcon: { color: '#b42318' },
  title: { fontSize: 11, fontWeight: '500', color: '#8a94a6', marginLeft: 4 },
  rightView: { position: 'absolute', top: 0, right: 0, marginRight: 10 },
  volumeRow: { position: 'absolute', right: 0, width: 156, flexDirection: 'row', alignItems: 'center' },
  muteButton: { paddingHorizontal: 2, paddingVertical: 2 },
  muteIcon: { color: '#1561bd' },
  muteIconActive: { color: '#7d8798' },
  slider: { width: 94, height: 22, marginLeft: 2 },
  volumeText: { width: 38, marginLeft: 4, fontSize: 10, fontWeight: '600', color: '#6f7c91' },
});