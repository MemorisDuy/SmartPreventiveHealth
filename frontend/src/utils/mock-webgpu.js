// Mock WebGPU backend to resolve TFJS bundler dependencies
export const webgpu_util = {
  showWarning: () => {},
  isWebGPUSupported: () => false,
};

export class WebGPUBackend {
  static register() {}
}

export default {
  webgpu_util,
  WebGPUBackend,
};
