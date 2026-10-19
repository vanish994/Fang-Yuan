export type AdvanceIntentAction =
  | { kind: 'blocked' }
  | { kind: 'review' }
  | { kind: 'confirm' }
  | { kind: 'attempt'; revision: number };

/** Dois toques conscientes para gastar; repetição posterior só reabre a revisão. */
export class AdvanceIntent {
  phase: 'review' | 'confirm' | 'settled' = 'review';
  private confirmedRevision = -1;

  press(canAdvance: boolean, revision: number): AdvanceIntentAction {
    if (this.phase === 'settled') {
      this.phase = 'review';
      return { kind: 'review' };
    }
    if (!canAdvance) {
      this.phase = 'review';
      return { kind: 'blocked' };
    }
    if (this.phase === 'confirm') {
      if (revision !== this.confirmedRevision) {
        this.phase = 'review';
        return { kind: 'review' };
      }
      this.phase = 'settled';
      return { kind: 'attempt', revision: this.confirmedRevision };
    }
    this.confirmedRevision = revision;
    this.phase = 'confirm';
    return { kind: 'confirm' };
  }

  resetIfStale(revision: number): void {
    if (this.phase === 'confirm' && revision !== this.confirmedRevision) this.phase = 'review';
  }
}
