import * as FileSystem from 'expo-file-system/legacy';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';

export type EchoParams = {
  delayMs: number; // 50-1000
  decay: number; // 0.1-0.9
};

export type SelectionEffect =
  | 'echo'
  | 'silence'
  | 'amplify'
  | 'normalize'
  | 'fadeIn'
  | 'fadeOut'
  | 'tempo'
  | 'pitch'
  | 'reverb'
  | 'equalizer'
  | 'bass'
  | 'treble'
  | 'phaser'
  | 'distortion';

export type SelectionEffectParams = {
  amount?: number;
  duration?: number;
  tempo?: number;
  pitch?: number;
  frequency?: number;
  gain?: number;
  width?: number;
  equalizerBands?: Array<{ frequency: number; gain: number }>;
  phaserDepth?: number;
  phaserDecay?: number;
  phaserSpeed?: number;
  phaserDelay?: number;
  distortionDrive?: number;
};

function getSelectionFilter(effect: SelectionEffect, params: SelectionEffectParams, duration: number): string {
  switch (effect) {
    case 'amplify':
      return `volume=${(params.amount ?? 1).toFixed(2)}`;
    case 'normalize':
      return `loudnorm=I=${(params.amount ?? -16).toFixed(1)}:TP=-1.5:LRA=11`;
    case 'fadeIn':
      return `afade=t=in:d=${Math.min(params.duration ?? 1, duration).toFixed(2)}`;
    case 'fadeOut':
      return `afade=t=out:st=${Math.max(0, duration - (params.duration ?? 1)).toFixed(2)}:d=${Math.min(params.duration ?? 1, duration).toFixed(2)}`;
    case 'tempo':
      return `atempo=${(params.tempo ?? 1).toFixed(2)}`;
    case 'pitch': {
      const semitones = params.pitch ?? 0;
      const ratio = Math.pow(2, semitones / 12);
      return `asetrate=44100*${ratio.toFixed(6)},aresample=44100,atempo=${(1 / ratio).toFixed(6)}`;
    }
    case 'reverb':
      return `afir=dry=10:wet=${(params.amount ?? 1).toFixed(2)}`;
    case 'equalizer':
      return `anequalizer=params='${(
        params.equalizerBands ?? [{ frequency: params.frequency ?? 1000, gain: params.gain ?? 0 }]
      )
        .map(
          (band) => {
            const frequency = Math.round(band.frequency);
            const width = Math.max(1, Math.round(frequency * 0.7));
            return `c0 f=${frequency} w=${width} g=${band.gain.toFixed(1)}`;
          }
        )
        .join('|')}'`;
    case 'bass':
      return `bass=g=${(params.gain ?? 0).toFixed(1)}:f=${Math.round(params.frequency ?? 100)}`;
    case 'treble':
      return `treble=g=${(params.gain ?? 0).toFixed(1)}:f=${Math.round(params.frequency ?? 3000)}`;
    case 'phaser':
      return `aphaser=in_gain=0.8:out_gain=0.8:delay=${(params.phaserDelay ?? 2).toFixed(2)}:decay=${(params.phaserDecay ?? 0.4).toFixed(2)}:speed=${(params.phaserSpeed ?? 0.5).toFixed(2)}:type=s`;
    case 'distortion': {
      const drive = Math.max(1, params.distortionDrive ?? 2);
      return `volume=${drive.toFixed(2)},asoftclip=type=tanh:threshold=0.8`;
  }

    default:
      return 'anull';
  }
}

export async function applyEffectToSelection(
  sourcePath: string,
  startSeconds: number,
  endSeconds: number,
  totalDuration: number,
  effect: SelectionEffect,
  params: SelectionEffectParams = {}
): Promise<string> {
  const outputPath = FileSystem.documentDirectory + `edited_${Date.now()}.wav`;
  const ffmpegInputPath = sourcePath.replace('file://', '');
  const ffmpegOutputPath = outputPath.replace('file://', '');
  const selectedDuration = Math.max(0.01, endSeconds - startSeconds);
  const hasPre = startSeconds > 0.01;
  const hasPost = endSeconds < totalDuration - 0.01;
  const filterParts: string[] = [];
  const segments: string[] = [];

  if (hasPre) {
    filterParts.push(`[0:a]atrim=0:${startSeconds.toFixed(3)},asetpts=PTS-STARTPTS[a0]`);
    segments.push('[a0]');
  }

  const selectedInput = `[0:a]atrim=${startSeconds.toFixed(3)}:${endSeconds.toFixed(3)},asetpts=PTS-STARTPTS`;
  if (effect === 'reverb') {
    filterParts.push(`${selectedInput}[selected]`);
    filterParts.push(`[1:a]atrim=0:1,asetpts=PTS-STARTPTS[ir]`);
    filterParts.push(`[selected][ir]${getSelectionFilter(effect, params, selectedDuration)}[a1]`);
  } else {
    filterParts.push(`${selectedInput},${getSelectionFilter(effect, params, selectedDuration)}[a1]`);
  }
  segments.push('[a1]');

  if (hasPost) {
    filterParts.push(`[0:a]atrim=${endSeconds.toFixed(3)},asetpts=PTS-STARTPTS[a2]`);
    segments.push('[a2]');
  }

  filterParts.push(`${segments.join('')}concat=n=${segments.length}:v=0:a=1[aout]`);
  const filterComplex = filterParts.join(';');
  const irInput = effect === 'reverb' ? ' -f lavfi -i "aevalsrc=exp(-6*t):s=44100:d=1"' : '';
  const command = `-y -i "${ffmpegInputPath}"${irInput} -filter_complex "${filterComplex}" -map "[aout]" -ar 44100 "${ffmpegOutputPath}"`;
  const session = await FFmpegKit.execute(command);
  const returnCode = await session.getReturnCode();

  if (!ReturnCode.isSuccess(returnCode)) {
    const logs = await session.getAllLogsAsString();
    console.error(`FFmpeg ${effect} efekat nije uspeo:`, logs);
    throw new Error('Primena efekta nije uspela.');
  }

  return outputPath;
}

// Primenjuje echo/delay efekat SAMO na segment [startSeconds, endSeconds] zapisa,
// dok ostatak (pre i posle selekcije) ostaje nepromenjen. Sve se odrađuje u JEDNOM
// ffmpeg pozivu preko filter_complex grafa: isečemo do 3 segmenta (pre/selekcija/posle),
// primenimo aecho SAMO na srednji, pa ih ponovo spojimo (concat) u jedan fajl.
export async function applyEchoToSelection(
  sourcePath: string,
  startSeconds: number,
  endSeconds: number,
  totalDuration: number,
  params: EchoParams
): Promise<string> {
  const outputPath = FileSystem.documentDirectory + `edited_${Date.now()}.wav`;
  const ffmpegInputPath = sourcePath.replace('file://', '');
  const ffmpegOutputPath = outputPath.replace('file://', '');

  // Segmenti pre/posle selekcije se izostavljaju ako je selekcija na samom
  // početku/kraju zapisa (izbegava se nulti/negativan atrim opseg).
  const hasPre = startSeconds > 0.01;
  const hasPost = endSeconds < totalDuration - 0.01;

  const filterParts: string[] = [];
  const segments: string[] = [];

  if (hasPre) {
    filterParts.push(`[0:a]atrim=0:${startSeconds.toFixed(3)},asetpts=PTS-STARTPTS[a0]`);
    segments.push('[a0]');
  }

  // in_gain:out_gain su fiksni (0.8:0.9) - standardne, "sigurne" vrednosti za
  // aecho koje ne izazivaju klipovanje; delay i decay dolaze od korisnika.
  filterParts.push(
    `[0:a]atrim=${startSeconds.toFixed(3)}:${endSeconds.toFixed(3)},asetpts=PTS-STARTPTS,` +
      `aecho=0.8:0.9:${Math.round(params.delayMs)}:${params.decay.toFixed(2)}[a1]`
  );
  segments.push('[a1]');

  if (hasPost) {
    filterParts.push(`[0:a]atrim=${endSeconds.toFixed(3)},asetpts=PTS-STARTPTS[a2]`);
    segments.push('[a2]');
  }

  filterParts.push(`${segments.join('')}concat=n=${segments.length}:v=0:a=1[aout]`);
  const filterComplex = filterParts.join(';');

  const command =
    `-y -i "${ffmpegInputPath}" -filter_complex "${filterComplex}" ` +
    `-map "[aout]" -ar 44100 "${ffmpegOutputPath}"`;

  const session = await FFmpegKit.execute(command);
  const returnCode = await session.getReturnCode();

  if (!ReturnCode.isSuccess(returnCode)) {
    const logs = await session.getAllLogsAsString();
    console.error('FFmpeg efekat nije uspeo:', logs);
    throw new Error('Primena efekta nije uspela.');
  }

  return outputPath;
}


// Utišava (postavlja na nulu) segment [startSeconds, endSeconds], dok ostatak
// zapisa ostaje nepromenjen. Za razliku od echo efekta, ovde nije potrebno
// sečenje na segmente - "volume" filter sa "enable" izrazom sam prepoznaje
// vremenski opseg unutar jednog neisečenog audio toka.
export async function applySilenceToSelection(
  sourcePath: string,
  startSeconds: number,
  endSeconds: number
): Promise<string> {
  const outputPath = FileSystem.documentDirectory + `edited_${Date.now()}.wav`;
  const ffmpegInputPath = sourcePath.replace('file://', '');
  const ffmpegOutputPath = outputPath.replace('file://', '');

  const filter = `volume=enable='between(t,${startSeconds.toFixed(3)},${endSeconds.toFixed(3)})':volume=0`;
  const command = `-y -i "${ffmpegInputPath}" -af "${filter}" -ar 44100 "${ffmpegOutputPath}"`;

  const session = await FFmpegKit.execute(command);
  const returnCode = await session.getReturnCode();

  if (!ReturnCode.isSuccess(returnCode)) {
    const logs = await session.getAllLogsAsString();
    console.error('FFmpeg silence efekat nije uspeo:', logs);
    throw new Error('Primena silence efekta nije uspela.');
  }

  return outputPath;
}