import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  RouteProp,
} from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Sound } from 'expo-av/build/Audio';
import * as FileSystem from 'expo-file-system/legacy';
import Track from './Track';
import { ICON_KEYS, ICONS } from '../../constants';
import Slider from '@react-native-community/slider';
import { MaterialIcons } from '@expo/vector-icons';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import {
  deleteLocalSeparationById,
  getSeparationFolderPath,
  getSeparationOptionType,
  isLocalSeparationsStoringEnabled,
  prepareSeparationForPlayer,
} from '../../utils/separationStorage';
import { SeparationOption } from '../../models/separations-jobs/SeparationOption';
import {
  Menu,
  MenuOption,
  MenuOptions,
  MenuTrigger,
} from 'react-native-popup-menu';
import { exportSeparation } from '../../utils/pickDocument';
import { useTheme } from '../../utils/ThemeProvider';

type SourceSeparationRouteParams = {
  SourceSeparation: { id: string };
};

export default function SourceSeparationPlayerScreen() {
  const route =
    useRoute<RouteProp<SourceSeparationRouteParams, 'SourceSeparation'>>();

  const navigation = useNavigation();

  const separationId = route.params?.id;

  const { colors } = useTheme();

  const [stemsLoading, setStemsLoading] = useState<boolean>(true);
  const [loadingText, setLoadingText] = useState<string>('');

  const [stems, setStems] = useState<Sound[]>([]);
  const [stemPaths, setStemPaths] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentPosition, setCurrentPosition] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const [names, setNames] = useState<string[]>([
    'Vocals',
    'Drums',
    'Other',
    'Bass',
  ]);

  const [stemFiles, setStemFiles] = useState<string[]>([
    'vocals.wav',
    'drums.wav',
    'other.wav',
    'bass.wav',
  ]);

  const [waveformLoadingStates, setWaveformLoadingStates] = useState<
    boolean[]
  >([]);

  const stemsRef = useRef<Sound[]>([]);
  const playbackResettingRef = useRef(false);

  const stopAndUnloadStems = useCallback(async () => {
    const activeStems = stemsRef.current;

    stemsRef.current = [];
    setIsPlaying(false);

    await Promise.all(
      activeStems.map(async stem => {
        try {
          await stem.stopAsync();
        } catch (error) {
          console.log('Error stopping stem playback:', error);
        }
      })
    );

    await Promise.all(
      activeStems.map(async stem => {
        try {
          const status = await stem.getStatusAsync();

          if (status.isLoaded) {
            await stem.unloadAsync();
          }
        } catch (error) {
          console.log('Error stopping stem playback:', error);
        }
      })
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      return () => {
        void stopAndUnloadStems();
      };
    }, [stopAndUnloadStems])
  );

  useEffect(() => {
    const nativeNavigation = navigation as any;

    const removeBlurListener = nativeNavigation.addListener(
      'blur',
      () => {
        void stopAndUnloadStems();
      }
    );

    const removeTransitionStartListener =
      nativeNavigation.addListener(
        'transitionStart',
        (event: any) => {
          if (event?.data?.closing) {
            void stopAndUnloadStems();
          }
        }
      );

    const removeBeforeRemoveListener =
      nativeNavigation.addListener(
        'beforeRemove',
        () => {
          void stopAndUnloadStems();
        }
      );

    return () => {
      removeBlurListener();
      removeTransitionStartListener();
      removeBeforeRemoveListener();
    };
  }, [navigation, stopAndUnloadStems]);

  useEffect(() => {
    async function loadStems() {
      console.log('1');

      setStemsLoading(true);
      setLoadingText('Downloading stems...');

      await prepareSeparationForPlayer(separationId);

      setLoadingText('Loading...');

      let currentNames = [
        'Vocals',
        'Drums',
        'Other',
        'Bass',
      ];

      let currentStemFiles = [
        'vocals.wav',
        'drums.wav',
        'other.wav',
        'bass.wav',
      ];

      console.log('2 ' + separationId);

      const separationOptionType =
        await getSeparationOptionType(separationId);

      console.log('Type: ' + separationOptionType);

      if (separationOptionType === SeparationOption.VOCALS) {
        currentNames = [
          'Vocals',
          'No vocals',
        ];

        currentStemFiles = [
          'vocals.wav',
          'no_vocals.wav',
        ];
      }

      console.log('3');

      setNames(currentNames);
      setStemFiles(currentStemFiles);

      setWaveformLoadingStates(
        new Array(currentStemFiles.length).fill(true)
      );

      const path =
        await getSeparationFolderPath(separationId);

      console.log('PATH: ' + path);

      const files = await Promise.all(
        currentStemFiles.map(async fileName => {
          const filePath = `${path}/${fileName}`;

          const info =
            await FileSystem.getInfoAsync(filePath);

          if (!info.exists) {
            throw new Error(
              `Missing stem file: ${filePath}`
            );
          }

          return info.uri;
        })
      );

      setStemPaths(
        files.map(fileUri =>
          fileUri.replace('file://', '')
        )
      );

      console.log('4');

      const loaded: Sound[] = [];

      for (const fileUri of files) {
        const sound = new Audio.Sound();

        await sound.loadAsync(
          { uri: fileUri },
          { shouldPlay: false }
        );

        sound.setOnPlaybackStatusUpdate(
          handlePlaybackStatusUpdate
        );

        loaded.push(sound);
      }

      setStems(loaded);
      stemsRef.current = loaded;

      console.log('5');

      const status =
        await loaded[0].getStatusAsync();

      if (status.isLoaded) {
        setDuration(
          status.durationMillis || 0
        );
      }

      console.log('6');

      setStemsLoading(false);
    }

    loadStems();

    console.log('7');

    return () => {
      void stopAndUnloadStems();

      (async () => {
        const isEnabled =
          await isLocalSeparationsStoringEnabled();

        if (!isEnabled) {
          await deleteLocalSeparationById(
            separationId
          );
        }
      })();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (stems.length > 0) {
        const status =
          await stems[0].getStatusAsync();

        if (
          status.isLoaded &&
          status.isPlaying
        ) {
          setCurrentPosition(
            status.positionMillis
          );
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [stems]);

  const playAll = async () => {
    await Promise.all(
      stems.map(stem =>
        stem.playAsync()
      )
    );
  };

  const pauseAll = async () => {
    await Promise.all(
      stems.map(stem =>
        stem.pauseAsync()
      )
    );
  };

  const stopAll = async () => {
    setIsPlaying(false);

    await Promise.all(
      stems.map(stem =>
        stem.pauseAsync()
      )
    );

    await Promise.all(
      stems.map(stem =>
        stem.setPositionAsync(0)
      )
    );

    await Promise.all(
      stems.map(stem =>
        stem.setVolumeAsync(1)
      )
    );

    setCurrentPosition(0);
  };

  const setVolume = async (
    index: number,
    volume: number
  ) => {
    await stems[index].setVolumeAsync(
      volume
    );
  };

  const handlePlaybackStatusUpdate =
    useCallback((status: any) => {
      if (!status?.isLoaded) {
        return;
      }

      if (status.isPlaying) {
        setCurrentPosition(
          status.positionMillis ?? 0
        );
      }

      if (
        status.didJustFinish &&
        !playbackResettingRef.current
      ) {
        playbackResettingRef.current = true;

        void (async () => {
          try {
            await Promise.all(
              stemsRef.current.map(
                async stem => {
                  try {
                    await stem.pauseAsync();
                    await stem.setPositionAsync(
                      0
                    );
                  } catch (error) {
                    console.log(
                      'Error resetting stem after finish:',
                      error
                    );
                  }
                }
              )
            );

            setCurrentPosition(0);
            setIsPlaying(false);
          } finally {
            playbackResettingRef.current = false;
          }
        })();
      }
    }, []);

  const handleWaveformLoadStateChange = (
    index: number,
    isLoading: boolean
  ) => {
    setWaveformLoadingStates(prev => {
      const next = [...prev];

      next[index] = isLoading;

      return next;
    });
  };

  const formatTime = (
    miliseconds: number
  ) => {
    const totalSeconds =
      Math.floor(miliseconds / 1000);

    const minutes =
      Math.floor(totalSeconds / 60);

    const seconds =
      totalSeconds % 60;

    return `${minutes}:${
      seconds < 10 ? '0' : ''
    }${seconds}`;
  };

  const changePlayButton = async () => {
    if (isPlaying) {
      await pauseAll();
      setIsPlaying(false);
    } else {
      await playAll();
      setIsPlaying(true);
    }
  };

  const isAnyWaveformLoading =
    waveformLoadingStates.length === 0 ||
    waveformLoadingStates.some(Boolean);

  const optionsStyles = {
    optionsContainer: {
      backgroundColor:
        colors.menuItemBackground,
      padding: 10,
      borderRadius: 12,
      width: 200,
    },

    optionWrapper: {
      margin: 5,
    },

    optionText: {
      fontSize: 17,
      color: colors.textPrimary,
      fontWeight: '600' as const,
    },
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <View style={styles.menuContainer}>
        <Menu>
          <MenuTrigger>
            <SimpleLineIcons
              name="menu"
              size={24}
              color={colors.textPrimary}
            />
          </MenuTrigger>

          <MenuOptions
            customStyles={optionsStyles}
          >
            <MenuOption
              onSelect={async () => {
                console.log('export');
                await exportSeparation(
                  separationId
                );
              }}
            >
              <Text
                style={optionsStyles.optionText}
              >
                Export stems
              </Text>
            </MenuOption>

            <MenuOption
              onSelect={() =>
                console.log('Initial screen')
              }
            >
              <Text
                style={optionsStyles.optionText}
              >
                Home
              </Text>
            </MenuOption>

            <MenuOption
              onSelect={() =>
                console.log('Cancel')
              }
            >
              <Text
                style={optionsStyles.optionText}
              >
                Cancel
              </Text>
            </MenuOption>
          </MenuOptions>
        </Menu>
      </View>

      <ScrollView
        style={styles.scrollArea}
        scrollEnabled={
          !stemsLoading &&
          !isAnyWaveformLoading
        }
      >
        {stems.map((stem, i) => (
          <Track
            key={i}
            name={names[i]}
            sound={stem}
            index={i}
            volume={1}
            audioPath={stemPaths[i] ?? ''}
            onVolumeChange={setVolume}
            onWaveformLoadStateChange={
              handleWaveformLoadStateChange
            }
            icon={
              ICONS[
                ICON_KEYS[names[i]]
              ].normal
            }
            muteIcon={
              ICONS[
                ICON_KEYS[names[i]]
              ].mute
            }
            currentPosition={
              currentPosition
            }
          />
        ))}
      </ScrollView>

      <View
        style={
          styles.progressBarContainer
        }
      >
        <Slider
          style={
            styles.progressBarSlider
          }
          minimumValue={0}
          maximumValue={
            stems.length > 0
              ? duration
              : 0
          }
          value={currentPosition}
          onSlidingComplete={async val => {
            await Promise.all(
              stems.map(stem =>
                stem.setPositionAsync(
                  val
                )
              )
            );

            setCurrentPosition(val);
          }}
          minimumTrackTintColor={
            colors.primary
          }
          maximumTrackTintColor={
            colors.borderColor
          }
          thumbTintColor={
            colors.primary
          }
        />

        <View style={styles.timeContainer}>
          <Text
            style={[
              styles.time,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            {formatTime(
              currentPosition
            )}
          </Text>

          <Text
            style={[
              styles.time,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            {formatTime(duration)}
          </Text>
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={changePlayButton}
        >
          {isPlaying ? (
            <MaterialIcons
              name="pause"
              size={52}
              color={colors.textPrimary}
            />
          ) : (
            <MaterialIcons
              name="play-arrow"
              size={52}
              color={colors.textPrimary}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={stopAll}
        >
          <MaterialIcons
            name="stop"
            size={52}
            color={colors.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {(stemsLoading ||
        isAnyWaveformLoading) && (
        <View
          style={[
            styles.overlay,
            {
              backgroundColor:
                colors.overlay,
            },
          ]}
        >
          <View
            style={[
              styles.loadingCard,
              {
                backgroundColor:
                  colors.modalBackground,
              },
            ]}
          >
            <ActivityIndicator
              size="large"
              color={colors.primary}
            />

            <Text
              style={[
                styles.loadingText,
                {
                  color:
                    colors.textPrimary,
                },
              ]}
            >
              {isAnyWaveformLoading
                ? 'Stems loading...'
                : loadingText}
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },

  progressBarContainer: {
    marginVertical: 2,
  },

  progressBarSlider: {
    width: '100%',
    height: 40,
  },

  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  time: {
    fontSize: 13,
  },

  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
  },

  controlButton: {
    paddingHorizontal: 20,
  },

  scrollArea: {
    flex: 1,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },

  loadingCard: {
    minWidth: 150,
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 18,
    alignItems: 'center',

    elevation: 10,

    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,

    shadowOffset: {
      width: 0,
      height: 6,
    },
  },

  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
  },

  menuContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginLeft: 10,
    marginBottom: 10,
  },
});
