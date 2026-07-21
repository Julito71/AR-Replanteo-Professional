export interface Measurement {
  readonly name: string;
  readonly duration: number;
}

export class PerformanceTracker {
  private readonly measurements = new Map<string, number>();

  public measure<T>(name: string, work: () => T): { readonly value: T; readonly measurement: Measurement } {
    const start = performance.now();
    const value = work();
    const duration = performance.now() - start;
    this.measurements.set(name, duration);
    return { value, measurement: { name, duration } };
  }

  public get(name: string): number | undefined {
    return this.measurements.get(name);
  }

  public entries(): readonly Measurement[] {
    return [...this.measurements.entries()].map(([name, duration]) => ({ name, duration }));
  }
}
