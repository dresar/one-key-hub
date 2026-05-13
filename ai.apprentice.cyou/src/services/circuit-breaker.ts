import { config } from "../config.js";

type State = { mode: "closed" | "open" | "half-open"; openedAt: number };

const states = new Map<string, State>();

export class CircuitBreaker {
  private timeoutMs: number;
  private halfOpenAfterMs: number;

  constructor(timeoutMs = config.breakerTimeoutMs, halfOpenAfterMs = config.breakerHalfOpenAfterMs) {
    this.timeoutMs = timeoutMs;
    this.halfOpenAfterMs = halfOpenAfterMs;
  }

  getState(key: string): State {
    return states.get(key) ?? { mode: "closed", openedAt: 0 };
  }

  canPass(key: string): boolean {
    const s = this.getState(key);
    if (s.mode === "closed") return true;
    if (s.mode === "open") {
      if (Date.now() - s.openedAt >= this.halfOpenAfterMs) {
        states.set(key, { mode: "half-open", openedAt: s.openedAt });
        return true;
      }
      return false;
    }
    return true;
  }

  onSuccess(key: string) {
    states.set(key, { mode: "closed", openedAt: 0 });
  }

  onFailure(key: string) {
    const s = this.getState(key);
    if (s.mode === "open") return;
    states.set(key, { mode: "open", openedAt: Date.now() });
  }

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (!this.canPass(key)) throw new Error("CircuitOpen");
    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error("timeout")), this.timeoutMs)
        ),
      ]);
      this.onSuccess(key);
      return result;
    } catch (e) {
      this.onFailure(key);
      throw e;
    }
  }
}

export const gatewayBreaker = new CircuitBreaker();
