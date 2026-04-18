export type LocalDictationCaptureResult = {
  audioBase64: string;
  sampleRate: number;
};

export type LocalDictationCaptureSession = {
  stop: () => Promise<LocalDictationCaptureResult>;
  abort: () => Promise<void>;
};

const TARGET_SAMPLE_RATE = 16_000;

function getAudioContextConstructor() {
  return (
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
    null
  );
}

function concatFloat32Arrays(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function downsampleBuffer(input: Float32Array, inputSampleRate: number, outputSampleRate: number) {
  if (inputSampleRate === outputSampleRate) {
    return input.slice();
  }

  if (inputSampleRate < outputSampleRate) {
    throw new Error("The microphone sample rate is lower than the dictation target sample rate.");
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(input.length / sampleRateRatio);
  const output = new Float32Array(outputLength);
  let outputIndex = 0;
  let inputIndex = 0;

  while (outputIndex < outputLength) {
    const nextInputIndex = Math.round((outputIndex + 1) * sampleRateRatio);
    let accumulatedSample = 0;
    let count = 0;

    for (let index = inputIndex; index < nextInputIndex && index < input.length; index += 1) {
      accumulatedSample += input[index] ?? 0;
      count += 1;
    }

    output[outputIndex] = count > 0 ? accumulatedSample / count : 0;
    outputIndex += 1;
    inputIndex = nextInputIndex;
  }

  return output;
}

function encodePcm16Base64(samples: Float32Array) {
  const pcmBytes = new Uint8Array(samples.length * 2);

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[index] ?? 0));
    const sample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    const value = Math.round(sample);
    pcmBytes[index * 2] = value & 0xff;
    pcmBytes[index * 2 + 1] = (value >> 8) & 0xff;
  }

  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < pcmBytes.length; index += chunkSize) {
    const chunk = pcmBytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function disposeCaptureResources({
  audioContext,
  processor,
  mutedDestination,
  source,
  stream,
}: {
  audioContext: AudioContext;
  processor: ScriptProcessorNode;
  mutedDestination: GainNode;
  source: MediaStreamAudioSourceNode;
  stream: MediaStream;
}) {
  processor.onaudioprocess = null;
  source.disconnect();
  processor.disconnect();
  mutedDestination.disconnect();

  for (const track of stream.getTracks()) {
    track.stop();
  }

  await audioContext.close();
}

export function canUseLocalDictationCapture() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    getAudioContextConstructor() !== null
  );
}

export async function startLocalDictationCapture(): Promise<LocalDictationCaptureSession> {
  if (!canUseLocalDictationCapture()) {
    throw new Error("Local microphone capture is unavailable in this runtime.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    for (const track of stream.getTracks()) {
      track.stop();
    }

    throw new Error("AudioContext is unavailable in this runtime.");
  }

  const audioContext = new AudioContextConstructor();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4_096, 1, 1);
  const mutedDestination = audioContext.createGain();
  mutedDestination.gain.value = 0;

  const recordedChunks: Float32Array[] = [];
  let settled = false;
  let settlePromise: Promise<void> | null = null;

  processor.onaudioprocess = (event) => {
    if (settled) {
      return;
    }

    const inputChannel = event.inputBuffer.getChannelData(0);
    const downsampled = downsampleBuffer(inputChannel, audioContext.sampleRate, TARGET_SAMPLE_RATE);
    if (downsampled.length > 0) {
      recordedChunks.push(downsampled);
    }
  };

  source.connect(processor);
  processor.connect(mutedDestination);
  mutedDestination.connect(audioContext.destination);

  const settleCapture = async () => {
    if (!settlePromise) {
      settled = true;
      settlePromise = disposeCaptureResources({
        audioContext,
        processor,
        mutedDestination,
        source,
        stream,
      });
    }

    await settlePromise;
  };

  return {
    stop: async () => {
      await settleCapture();
      const samples = concatFloat32Arrays(recordedChunks);

      return {
        audioBase64: encodePcm16Base64(samples),
        sampleRate: TARGET_SAMPLE_RATE,
      };
    },
    abort: async () => {
      await settleCapture();
    },
  };
}

export function appendDictatedText(current: string, dictated: string) {
  const normalized = dictated.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return current;
  }

  if (!current.trim()) {
    return normalized;
  }

  return `${current.trimEnd()} ${normalized}`;
}
