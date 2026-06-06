// Web Worker — runs runMonteCarlo off the main thread so sliders stay responsive.
// This file is bundled separately by Vite and executed in a DedicatedWorkerGlobalScope.

import { runMonteCarlo } from './montecarlo';
import type { EngineConfig } from '@/engine/config';
import type { MonteCarloOpts, MonteCarloResult } from './montecarlo';

export interface SimWorkerRequest {
  cfg: EngineConfig;
  opts: MonteCarloOpts;
}

export interface SimWorkerResponse {
  result: MonteCarloResult;
}

// Minimal interface for the worker's own global. `self` is typed as
// `Window & typeof globalThis` by the DOM lib, but at runtime this module runs
// inside a DedicatedWorkerGlobalScope. The cast is sound because we only call
// the two methods that exist on both surfaces.
interface WorkerCtx {
  addEventListener(type: 'message', listener: (e: MessageEvent<SimWorkerRequest>) => void): void;
  postMessage(data: SimWorkerResponse): void;
}

const ctx = self as unknown as WorkerCtx;

ctx.addEventListener('message', (e) => {
  const { cfg, opts } = e.data;
  const result = runMonteCarlo(cfg, opts);
  ctx.postMessage({ result });
});
