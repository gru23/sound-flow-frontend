import { StyleSheet, Text, View, TouchableOpacity, Image, Animated } from 'react-native';
import React, { useEffect, useState, useRef } from 'react';
import { Sound } from 'expo-av/build/Audio';
import { Waveform, type IWaveformRef } from '@simform_solutions/react-native-audio-waveform';
import Slider from '@react-native-community/slider';
import { useTheme } from '../../utils/ThemeProvider';

type TrackProps = {
  name: string;
  sound: Sound;
  index: number;
  volume: number;
  audioPath: string;
  onVolumeChange: (index: number, volume: number) => void;
  onWaveformLoadStateChange?: (index: number, isLoading: boolean) => void;
  icon: any;
  muteIcon: any;
  currentPosition: number;
};

export default function Track({
  name,
  sound,
  index,
  volume,
  audioPath,
  onVolumeChange,
  onWaveformLoadStateChange,
  icon,
  muteIcon,
  currentPosition,
}: TrackProps) {
  const { colors } = useTheme();

  const [volumeValue, setVolumeValue] = useState<number>(volume);
  const [muteButton, setMuteButton] = useState<string>("Mute");
  const [sliderValue, setSliderValue] = useState<number>(volume * 100);
  const [duration, setDuration] = useState<number>(0);

  const lastVolumeRef = useRef<number>(volume);
  const waveformRef = useRef<IWaveformRef>(null);
  const animatedProgressRef = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    onVolumeChange(index, volumeValue);
  }, [volumeValue]);

  useEffect(() => {
    const getDuration = async () => {
      const status = await sound.getStatusAsync();

      if (status.isLoaded) {
        setDuration(status.durationMillis || 0);
      }
    };

    getDuration();
  }, [sound]);

  useEffect(() => {
    if (duration > 0) {
      const percentage = (currentPosition / duration) * 100;

      Animated.timing(animatedProgressRef, {
        toValue: percentage,
        duration: 50,
        useNativeDriver: false,
      }).start();
    }
  }, [currentPosition, duration]);

  const setVolume = async (value: number) => {
    if (value === 0)
      muteVolume();
    else {
      lastVolumeRef.current = value;
      setVolumeValue(value);
      setMuteButton("Mute");
    }
  };

  const muteVolume = async () => {
    if ("Mute" === muteButton) {
      setMuteButton("Unmute");
      lastVolumeRef.current = volumeValue;
      setVolumeValue(0);
      setSliderValue(0);
    }
    else {
      setMuteButton("Mute");
      setVolumeValue(lastVolumeRef.current);
      setSliderValue(lastVolumeRef.current * 100);
    }
  }

  const handleSliderChange = (val: number) => {
    setSliderValue(val);
    const normalized = val / 100;
    setVolume(normalized);
  };

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: colors.surfaceBackground,
          borderColor: colors.borderColor,
        },
      ]}
    >
      <Text
        style={[
          styles.trackName,
          {
            color: colors.textPrimary,
          },
        ]}
      >
        {name}
      </Text>

      <View style={styles.inputRow}>
        <TouchableOpacity onPress={() => muteVolume()}>
          <Image
            source={volumeValue === 0 ? muteIcon : icon}
            style={{ marginRight: 0 }}
          />
        </TouchableOpacity>

        <Slider
          style={styles.volumeSlider}
          minimumValue={0}
          maximumValue={100}
          value={sliderValue}
          onValueChange={handleSliderChange}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.borderColor}
          thumbTintColor={colors.primary}
        />
      </View>

      <Text
        style={[
          styles.volumeText,
          {
            color: colors.textSecondary,
          },
        ]}
      >
        Vol: {Math.round(volumeValue * 100)}%
      </Text>

      <View style={styles.waveformWrapper}>
        <Waveform
          mode="static"
          ref={waveformRef}
          path={audioPath}
          candleWidth={3}
          candleSpace={1}
          waveColor={colors.textSecondary}
          scrubColor={colors.textSecondary}
          containerStyle={styles.waveformContainer}
          onChangeWaveformLoadState={(state) => {
            onWaveformLoadStateChange?.(index, state);
          }}
          onError={(error) => {
            console.error(`Waveform error for track ${index}:`, error);
            onWaveformLoadStateChange?.(index, false);
          }}
        />

        {duration > 0 && (
          <Animated.View
            style={[
              styles.progressIndicator,
              {
                backgroundColor: colors.primary,
                left: animatedProgressRef.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
  },

  trackName: {
    fontSize: 18,
    fontWeight: '700',
  },

  volumeSlider: {
    flex: 1,
    height: 10,
    marginHorizontal: 10,
  },

  volumeText: {
    fontSize: 13,
    fontWeight: '500',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  waveformContainer: {
    height: 80,
    width: '100%',
  },

  waveformWrapper: {
    position: 'relative',
    marginTop: -10,
  },

  progressIndicator: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: 40,
    zIndex: 10,
    marginTop: 20,
  },
});