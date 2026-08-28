export class ShortIds {
  private readonly toFull = new Map<string, string>();
  private readonly toShort = new Map<string, string>();
  private counts: Record<string, number> = { s: 0, ds: 0, m: 0 };

  intern(kind: 's' | 'ds' | 'm', full: string): string {
    const existing = this.toShort.get(full);
    if (existing) {
      return existing;
    }
    this.counts[kind] += 1;
    const short = `${kind}${this.counts[kind]}`;
    this.toFull.set(short, full);
    this.toShort.set(full, short);
    return short;
  }

  resolve(shortOrFull: string): string | undefined {
    if (this.toFull.has(shortOrFull)) {
      return this.toFull.get(shortOrFull);
    }
    if (this.toShort.has(shortOrFull)) {
      return shortOrFull;
    }
    if (shortOrFull.includes('.')) {
      return shortOrFull;
    }
    return undefined;
  }
}
