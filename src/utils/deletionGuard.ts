class DeletionGuard {
  private pending: boolean = false;

  begin(): boolean {
    if (this.pending) return false;
    this.pending = true;
    return true;
  }

  end(): void {
    this.pending = false;
  }

  isPending(): boolean {
    return this.pending;
  }
}

export default new DeletionGuard();
