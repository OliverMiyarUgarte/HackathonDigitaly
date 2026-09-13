export const PCM_SAMPLE_RATE = 16000 as const;
export const PCM_BATCH_SAMPLES = 4000;
export const PCM_ENCODING = "pcm_s16le" as const;

export class StreamingResampler {
  private readonly ratio: number;
  private position = 0;
  private pending = new Float32Array(0);

  constructor(inputRate: number, targetRate: number = PCM_SAMPLE_RATE) {
    this.ratio = inputRate > 0 ? inputRate / targetRate : 1;
  }

  push(samples: Float32Array): Float32Array {
    if (this.ratio === 1) {
      return samples.slice();
    }
    const combined = new Float32Array(this.pending.length + samples.length);
    combined.set(this.pending, 0);
    combined.set(samples, this.pending.length);
    this.pending = combined;

    const output: number[] = [];
    while (this.position + 1 < this.pending.length) {
      const index = Math.floor(this.position);
      const fraction = this.position - index;
      const start = this.pending[index];
      const end = this.pending[index + 1];
      output.push(start + (end - start) * fraction);
      this.position += this.ratio;
    }

    const consumed = Math.floor(this.position);
    if (consumed > 0) {
      this.pending = this.pending.slice(consumed);
      this.position -= consumed;
    }
    return Float32Array.from(output);
  }
}

export interface AudioChunkPayload {
  consultationId: string;
  seq: number;
  data: string;
  encoding: "pcm_s16le";
  sampleRate: 16000;
  channels: 1;
}

export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, input[index]));
    output[index] = sample < 0 ? Math.round(sample * 0x8000) : Math.round(sample * 0x7fff);
  }
  return output;
}

export function int16ToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(
    samples.buffer,
    samples.byteOffset,
    samples.byteLength,
  );
  let binary = "";
  const chunkSize = 0x4000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + chunkSize),
    );
  }
  return btoa(binary);
}

export function buildAudioChunkPayload(
  consultationId: string,
  seq: number,
  samples: Float32Array,
): AudioChunkPayload {
  return {
    consultationId,
    seq,
    data: int16ToBase64(floatTo16BitPCM(samples)),
    encoding: PCM_ENCODING,
    sampleRate: PCM_SAMPLE_RATE,
    channels: 1,
  };
}

export function computeRmsLevel(samples: Float32Array): number {
  if (samples.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) {
    sum += samples[index] * samples[index];
  }
  return Math.min(1, Math.sqrt(sum / samples.length));
}

export class PcmFrameBatcher {
  private readonly capacity: number;
  private readonly buffer: Float32Array;
  private length = 0;

  constructor(capacity: number = PCM_BATCH_SAMPLES) {
    this.capacity = capacity;
    this.buffer = new Float32Array(capacity);
  }

  get pending(): number {
    return this.length;
  }

  push(samples: Float32Array): Float32Array[] {
    const batches: Float32Array[] = [];
    let offset = 0;
    while (offset < samples.length) {
      const room = this.capacity - this.length;
      const take = Math.min(room, samples.length - offset);
      this.buffer.set(samples.subarray(offset, offset + take), this.length);
      this.length += take;
      offset += take;
      if (this.length === this.capacity) {
        batches.push(this.buffer.slice(0, this.capacity));
        this.length = 0;
      }
    }
    return batches;
  }

  flush(): Float32Array | null {
    if (this.length === 0) {
      return null;
    }
    const pending = this.buffer.slice(0, this.length);
    this.length = 0;
    return pending;
  }
}
