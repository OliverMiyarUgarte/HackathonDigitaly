class PcmCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || input[0].length === 0) {
      return true;
    }

    const channelCount = input.length;
    const frameCount = input[0].length;
    let mono;

    if (channelCount === 1) {
      mono = input[0].slice();
    } else {
      mono = new Float32Array(frameCount);
      for (let channel = 0; channel < channelCount; channel += 1) {
        const samples = input[channel];
        for (let index = 0; index < frameCount; index += 1) {
          mono[index] += samples[index];
        }
      }
      for (let index = 0; index < frameCount; index += 1) {
        mono[index] /= channelCount;
      }
    }

    this.port.postMessage(mono, [mono.buffer]);
    return true;
  }
}

registerProcessor("pcm-capture-processor", PcmCaptureProcessor);
