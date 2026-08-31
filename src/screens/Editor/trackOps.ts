import * as FileSystem from 'expo-file-system/legacy';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';

// Pomera "početak" zapisa - deltaSeconds > 0 dodaje tišinu na početak
// (adelay filter), deltaSeconds < 0 uklanja postojeću tišinu sa početka
// (atrim). Poziva se JEDNOM, na kraju drag gesta - ne tokom prevlačenja.
export async function shiftTrackStart(sourcePath: string, deltaSeconds: number): Promise<string> {
  const outputPath = FileSystem.documentDirectory + `edited_${Date.now()}.wav`;
  const ffmpegInputPath = sourcePath.replace('file://', '');
  const ffmpegOutputPath = outputPath.replace('file://', '');

  const filter =
    deltaSeconds >= 0
      ? `adelay=${Math.round(deltaSeconds * 1000)}:all=1`
      : `atrim=start=${(-deltaSeconds).toFixed(3)},asetpts=PTS-STARTPTS`;

  const command = `-y -i "${ffmpegInputPath}" -af "${filter}" -ar 44100 "${ffmpegOutputPath}"`;

  const session = await FFmpegKit.execute(command);
  if (!ReturnCode.isSuccess(await session.getReturnCode())) {
    const logs = await session.getAllLogsAsString();
    console.error('FFmpeg pomeranje nije uspelo:', logs);
    throw new Error('Pomjeranje zapisa nije uspjelo.');
  }

  return outputPath;
}

// Deli zapis na dva fajla na tački splitAtSeconds. Levi deo počinje od 0
// (kao i original). Desni deo dobija adelay tačno jednak tački sečenja, tako
// da na zajedničkoj vremenskoj osi i dalje počinje tamo gde je originalni
// zapis presečen (npr. presečen na 5.4s -> novi track počinje na 5.4s).
export async function splitAudioFile(
  sourcePath: string,
  splitAtSeconds: number,
  totalDuration: number
): Promise<{ leftPath: string; rightPath: string }> {
  const leftOutput = FileSystem.documentDirectory + `split_left_${Date.now()}.wav`;
  const rightOutput = FileSystem.documentDirectory + `split_right_${Date.now()}.wav`;
  const ffmpegInputPath = sourcePath.replace('file://', '');
  const ffmpegLeftPath = leftOutput.replace('file://', '');
  const ffmpegRightPath = rightOutput.replace('file://', '');

  const leftCommand = `-y -i "${ffmpegInputPath}" -af "atrim=0:${splitAtSeconds.toFixed(3)},asetpts=PTS-STARTPTS" -ar 44100 "${ffmpegLeftPath}"`;

  const delayMs = Math.round(splitAtSeconds * 1000);
  const rightCommand =
    `-y -i "${ffmpegInputPath}" -af "atrim=${splitAtSeconds.toFixed(3)}:${totalDuration.toFixed(3)},` +
    `asetpts=PTS-STARTPTS,adelay=${delayMs}:all=1" -ar 44100 "${ffmpegRightPath}"`;

  const leftSession = await FFmpegKit.execute(leftCommand);
  if (!ReturnCode.isSuccess(await leftSession.getReturnCode())) {
    throw new Error('Sečenje (lijevi dio) nije uspjelo.');
  }

  const rightSession = await FFmpegKit.execute(rightCommand);
  if (!ReturnCode.isSuccess(await rightSession.getReturnCode())) {
    throw new Error('Sečenje (desni dio) nije uspjelo.');
  }

  return { leftPath: leftOutput, rightPath: rightOutput };
}