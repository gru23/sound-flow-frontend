# Sound Flow

Sound Flow is a cross-platform React Native application for working with digital audio recordings. It combines local audio playback and editing with waveform visualization, FFmpeg-powered processing, recording and file picking, authentication, and optional server-side source separation.

The project uses Expo with native prebuild support. This gives the application access to Expo modules while still allowing native dependencies such as FFmpeg Kit and Skia to be compiled into the Android application.

## Features

- Import audio files through the native document picker.
- Record and preview audio on the device.
- Play local audio files and trimmed previews.
- Display audio as static and interactive waveforms.
- Render channel-aware waveforms with Shopify React Native Skia.
- Edit multiple audio tracks on a shared timeline.
- Select regions and apply audio effects to only the selected segment.
- Move, split, mute, adjust and play tracks together.
- Apply FFmpeg filters such as echo, silence, amplification, normalization, fades, tempo, pitch, reverb, equalization, bass, treble, phaser and distortion.
- Upload recordings for server-side source separation.
- Poll separation jobs and download generated stems.
- Authenticate users with JWT-based sessions and Google OAuth support.
- Persist application data and credentials with Expo Secure Store and Async Storage.

## Technology Stack

### Application

- **React Native 0.81.5** for the mobile application runtime.
- **Expo SDK 54** with Expo Dev Client and native prebuild.
- **TypeScript 5.9** with strict type checking and Expo's base TypeScript configuration.
- **React 19.1**.
- **React Navigation 7** with native stack and drawer navigation.
- **React Native Reanimated, Gesture Handler and Worklets** for interactive gestures and animations.

### Audio and visualization

- **FFmpeg Kit React Native 6.0.2** for transcoding, trimming, PCM extraction and audio filters.
- **FFmpeg Kit Full 6.0.2 LTS AAR** bundled in `android/app/libs` for the Android native build.
- **FFprobe** through FFmpeg Kit for reading channel count, duration, codec and sample-rate metadata.
- **Shopify React Native Skia 2.2.12** for custom waveform rendering, axes, zooming and horizontal panning.
- **React Native Audio Waveform** for static waveform playback and progress callbacks.
- **Expo AV and Expo Audio Studio** for playback and recording workflows.
- **Expo File System** for local sandbox storage and temporary processing files.

### Networking and platform services

- **Axios** for API requests, JWT authorization headers and token refresh handling.
- **Expo Document Picker, Media Library, Sharing and Asset** for importing, storing and sharing audio files.
- **Expo Secure Store and Async Storage** for session and client data persistence.
- **Expo Auth Session and Web Browser** for OAuth flows.
- **Yup** for request and form validation.

## Architecture

Sound Flow is organized into a presentation layer, navigation layer, service layer and typed domain models:

```text
FFmpeg_1/
├── App.tsx                    # Root providers and application navigation
├── assets/                    # Audio samples, icons and fonts
├── android/                   # Generated/custom Android project and FFmpeg AAR
├── ios/                       # Generated iOS project
└── src/
    ├── @types/                # Type declarations for native packages
    ├── components/            # Shared UI components
    ├── constants/             # Theme, icon and authentication constants
    ├── models/                # Typed API and domain models
    ├── navigation/            # Root, initial and drawer navigation
    ├── screens/               # Authentication, editor, player and settings screens
    ├── services/              # API, authentication, audio, files and separation services
    ├── shared/                # Shared API endpoint definitions and helpers
    └── utils/                 # Storage, validation, error handling and job watchers
```

### Main data flows

1. **Local editing:** a selected file is copied into the application sandbox, FFprobe reads its metadata, FFmpeg converts it to PCM, and the normalized samples are rendered as one or two waveform channels.
2. **Editing operations:** the editor maintains a shared timeline for its tracks. User operations are translated into FFmpeg commands and the resulting files are stored as temporary files in the application document directory.
3. **Source separation:** a recording is uploaded as multipart form data. The application stores the returned job identifier, polls the job status every three seconds, downloads completed stems and prepares them for synchronized playback.
4. **Authentication:** Axios attaches the stored access token to API requests. Expired JWTs are refreshed once; if refresh fails, stored session data is cleared and the user can authenticate again.

## Project Requirements

Install the following tools before starting development:

- Node.js compatible with the Expo SDK 54 toolchain.
- npm.
- Git.
- Android Studio with an Android SDK, platform tools, emulator or physical Android device.
- Java and Android build tools required by the generated React Native project.
- Xcode and CocoaPods for iOS development on macOS.

Because this project depends on native modules and a local Android FFmpeg AAR, it must be run as a development build. Expo Go is not sufficient for the complete feature set.

## Getting Started

### 1. Clone the repository

Replace `<repository-url>` with the URL of the repository:

```bash
git clone <repository-url>
cd FFmpeg_1
```

### 2. Install JavaScript dependencies

```bash
npm install
```

### 3. Generate native projects

If the native folders are not present, or after changing Expo native configuration, run:

```bash
npx expo prebuild
```

The repository already contains generated `android` and `ios` directories. Running prebuild can update generated native files, so review the resulting changes before committing them.

### 4. Run the Android application

Start an Android emulator or connect a USB-debugging-enabled Android device, then run:

```bash
npx expo run:android
```

The package scripts provide the equivalent command:

```bash
npm run android
```

For day-to-day JavaScript development with an installed development client, use:

```bash
npm start
```

Other available scripts are:

```bash
npm run ios
npm run web
```

## Android FFmpeg Integration

The Android build uses a locally bundled FFmpeg Kit library:

```text
android/app/libs/ffmpeg-kit-full-6.0-2.LTS.aar
```

It is included from `android/app/build.gradle` together with the required Smart Exception JAR files. This is why the project needs a native Android build and why `npx expo run:android` is preferred over Expo Go.

When changing the FFmpeg package or regenerating native projects, verify that:

- the AAR and supporting JAR files still exist in `android/app/libs`;
- the `flatDir` repository and file dependencies remain in `android/app/build.gradle`;
- the installed Android SDK and NDK versions match the generated Gradle configuration.

## Backend Configuration

Authentication and source separation are implemented through the service layer under `src/services`. The Axios client adds bearer tokens, refreshes expired JWTs and handles API errors. Separation requests use multipart form data and are followed through a polling watcher.

Before using login, registration or source separation, configure the backend endpoints for the target environment. The current codebase contains development endpoint values, including a local upload address in `src/services/audioService.ts`. A physical device cannot normally reach a server through `localhost` on the development computer, so use a reachable LAN address or an environment-specific configuration.

The Expo configuration also defines the Android application identifier and OAuth URL schemes in `app.json`. Update those values, OAuth credentials and backend URLs for production deployments.

## Important Directories

| Path | Responsibility |
| --- | --- |
| `src/screens/Editor` | Multi-track timeline, waveform editor, playback and audio effects |
| `src/screens/SkiaVisualScreen.tsx` | Custom Skia waveform rendering, zoom and pan |
| `src/screens/VisualScreen.tsx` | Static waveform playback using the audio waveform package |
| `src/services/authService.ts` | Login, registration, logout, session validation and token refresh |
| `src/services/separationService.ts` | Source separation requests, status checks and downloads |
| `src/utils/separationWatcher.ts` | Periodic separation job status polling |
| `src/utils/authStorage.ts` | Access and refresh token persistence |
| `android/app/libs` | Bundled Android FFmpeg and supporting native libraries |
| `assets` | Audio fixtures, icons and fonts used by the application |

## Troubleshooting

### The app builds in Expo Go but a native feature is unavailable

Use a development build instead:

```bash
npx expo run:android
```

Native modules such as FFmpeg Kit and React Native Skia require native compilation.

### Android cannot reach the backend

Do not use `localhost` from a physical Android device for a backend running on the development computer. Use the computer's local network IP address, configure the Android emulator's host alias where appropriate, and ensure the backend firewall allows the connection.

### FFmpeg processing fails

Check that the input file exists in the Expo document directory, that the generated output path is writable, and that the Android FFmpeg AAR is available under `android/app/libs`. FFmpeg and FFprobe logs are written to the development console by the relevant services and screens.

### Native changes are not reflected

Regenerate the native project and rebuild the application:

```bash
npx expo prebuild
npx expo run:android
```

## Development Notes

- Audio processing creates temporary files in the application document directory. Production cleanup policies should be reviewed as the number of edited tracks and separation results grows.
- The editor locks the screen to landscape while active and restores portrait orientation when it loses focus.
- Waveform rendering is based on normalized PCM samples and supports separate left and right channel data when the source is stereo.
- Release Android builds currently use the debug signing configuration in the generated project. Configure a production keystore before distributing the application.

## License

No license file is currently included in the repository. Add a license before publishing Sound Flow for external use.