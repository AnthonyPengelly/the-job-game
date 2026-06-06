import { useEffect, useRef, useState } from 'react';
import type { EngineConfig } from '@/engine/config';
import type { Skill } from '@/engine/types';
import type { MonteCarloResult } from './montecarlo';
import type { SimWorkerRequest, SimWorkerResponse } from './sim.worker';

/** Fixed N and seed for the in-app panel — fast enough for interactive use, deterministic. */
const PANEL_N = 500;
const PANEL_SEED = 42;
const DEBOUNCE_MS = 300;

export interface UseMonteCarloOpts {
  skill?: Skill;
  headcount?: number;
}

export interface UseMonteCarloReturn {
  result: MonteCarloResult | null;
  isRunning: boolean;
}

/**
 * Runs the Monte Carlo in a Web Worker (debounced) and returns the latest
 * distributions plus a busy indicator. Recomputes whenever `cfg` changes.
 */
export function useMonteCarlo(
  cfg: EngineConfig,
  opts?: UseMonteCarloOpts,
): UseMonteCarloReturn {
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const skill = opts?.skill ?? 'avg';
  const headcount = opts?.headcount ?? 4;

  // Create and destroy the worker alongside this hook instance.
  useEffect(() => {
    const worker = new Worker(new URL('./sim.worker.ts', import.meta.url), {
      type: 'module',
    });
    workerRef.current = worker;

    worker.addEventListener(
      'message',
      (e: MessageEvent<SimWorkerResponse>) => {
        setResult(e.data.result);
        setIsRunning(false);
      },
    );

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Debounce recompute on cfg / skill / headcount changes.
  useEffect(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      const worker = workerRef.current;
      if (worker === null) return;

      setIsRunning(true);
      worker.postMessage({
        cfg,
        opts: {
          n: PANEL_N,
          baseSeed: PANEL_SEED,
          skill,
          headcount,
        },
      } satisfies SimWorkerRequest);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [cfg, skill, headcount]);

  return { result, isRunning };
}
