import { BunwrightError } from "./errors.js";

/**
 * Marker for classes that participate in chaining. Instances carrying this
 * symbol are wrapped in a chain proxy when they appear as a step result,
 * so the chain continues on them instead of terminating with a value.
 */
export const CHAINABLE: unique symbol = Symbol("bunwright.chainable");

export interface ChainTarget {
  readonly [CHAINABLE]: true;
}

type AnyFn = (...args: never[]) => unknown;

/**
 * Return type of a chained method call.
 *
 * - `void` results keep chaining on the current target.
 * - `ChainTarget` results switch the chain to the returned object
 *   (covers `Promise<this>` and e.g. `page.locator()` mid-chain).
 * - Anything else is terminal: awaiting yields the value, and only
 *   `all()` remains available.
 */
type ChainResult<T, R, Acc extends unknown[]> = [R] extends [void]
  ? PendingChain<T, Acc>
  : R extends ChainTarget
    ? PendingChain<R, Acc>
    : TerminalChain<R, Acc>;

export type TerminalChain<R, Acc extends unknown[] = unknown[]> = PromiseLike<R> & {
  /** Resolves with every step's result, in call order. */
  all(): Promise<Acc>;
};

/**
 * Mapped types erase method generics, so `evaluate<R>` is re-declared
 * explicitly to keep its return type inference.
 */
type EvaluateOverride<T, Acc extends unknown[]> = T extends {
  evaluate: (...args: any[]) => any;
}
  ? {
      evaluate<R>(fn: (...args: any[]) => R): TerminalChain<Awaited<R>, [...Acc, Awaited<R>]>;
    }
  : unknown;

type ChainMethods<T, Acc extends unknown[]> = {
  [K in Exclude<keyof T, "evaluate">]: T[K] extends (...args: infer A) => Promise<infer R>
    ? (...args: A) => ChainResult<T, R, [...Acc, R]>
    : T[K] extends (...args: infer A) => infer R
      ? R extends ChainTarget
        ? (...args: A) => Chain<R>
        : T[K]
      : T[K];
} & EvaluateOverride<T, Acc>;

/**
 * A resting chain: the wrapped object itself. Not thenable — `await` on it
 * yields the proxy unchanged. Calling a method starts a pending chain.
 */
export type Chain<T> = ChainMethods<T, []>;

/**
 * A pending chain: a lazy queue of steps. Each method call enqueues onto the
 * previous step's promise. Awaiting flushes the queue and resolves with the
 * resting chain of the final target (or rejects with the first step error —
 * steps queued after a failed step never execute).
 */
export type PendingChain<T, Acc extends unknown[] = unknown[]> = ChainMethods<T, Acc> &
  PromiseLike<Chain<T>> & {
    /** Resolves with every step's result, in call order. */
    all(): Promise<Acc>;
  };

interface ChainState {
  target: object;
  mode: "target" | "value";
  value: unknown;
  steps: unknown[];
}

const RESTING_CACHE = new WeakMap<object, object>();

export function isChainable(value: unknown): value is ChainTarget {
  return typeof value === "object" && value !== null && CHAINABLE in value;
}

function route(prev: ChainState, result: unknown): ChainState {
  const steps = [...prev.steps, result];
  if (result === undefined) {
    return { target: prev.target, mode: "target", value: undefined, steps };
  }
  if (isChainable(result)) {
    return { target: result, mode: "target", value: undefined, steps };
  }
  return { target: prev.target, mode: "value", value: result, steps };
}

function enqueue(tail: Promise<ChainState>, prop: string): (...args: unknown[]) => unknown {
  return (...args: unknown[]) =>
    makePending(
      tail.then(async (state) => {
        if (state.mode === "value") {
          throw new BunwrightError(
            `Cannot chain ${prop}() after a step that returned a value; await the chain first`,
          );
        }
        const method = (state.target as Record<string, unknown>)[prop];
        if (typeof method !== "function") {
          throw new BunwrightError(`Cannot chain ${prop}: not a method on the current target`);
        }
        const result = await (method as AnyFn).apply(state.target, args as never[]);
        return route(state, result);
      }),
    );
}

function makePending(tail: Promise<ChainState>): object {
  const resolved = () =>
    tail.then((state) => (state.mode === "value" ? state.value : chainable(state.target)));

  return new Proxy(Object.create(null) as object, {
    get(_t, prop) {
      if (prop === "then") {
        return (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => resolved().then(onFulfilled, onRejected);
      }
      if (prop === "catch") {
        return (onRejected?: (reason: unknown) => unknown) => resolved().catch(onRejected);
      }
      if (prop === "finally") {
        return (onFinally?: () => void) => resolved().finally(onFinally);
      }
      if (prop === "all") {
        return () => tail.then((state) => [...state.steps]);
      }
      if (typeof prop === "symbol") {
        return undefined;
      }
      return enqueue(tail, prop);
    },
  });
}

/**
 * Wrap a chainable instance in a resting chain proxy. Method calls returning
 * a promise start a pending chain; sync methods returning chainable objects
 * are wrapped recursively; everything else passes through.
 */
export function chainable<T extends object>(target: T): Chain<T> {
  const cached = RESTING_CACHE.get(target);
  if (cached) {
    return cached as Chain<T>;
  }

  const proxy = new Proxy(target, {
    get(t, prop) {
      if (prop === "then") {
        return undefined;
      }
      const value = Reflect.get(t, prop, t);
      if (typeof value !== "function") {
        return value;
      }
      return (...args: unknown[]) => {
        const result = (value as AnyFn).apply(t, args as never[]);
        if (result instanceof Promise) {
          const seed: ChainState = { target: t, mode: "target", value: undefined, steps: [] };
          return makePending(result.then((r) => route(seed, r)));
        }
        if (isChainable(result)) {
          return chainable(result);
        }
        return result;
      };
    },
    set(t, prop, value) {
      return Reflect.set(t, prop, value, t);
    },
  });

  RESTING_CACHE.set(target, proxy);
  return proxy as Chain<T>;
}
