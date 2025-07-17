/**
 * Array-based priority manager for reliable, predictable ordering
 * Uses array indices to determine priority order instead of floating point numbers
 */
export class ArrayPriorityManager {
  /** Cards ordered from highest to lowest priority */
  private order: string[];
  private isDirty = false;

  constructor(initialOrder: string[] = []) {
    this.order = [...initialOrder];
  }

  /**
   * Get current complete order (returns a copy to prevent external modification)
   */
  getSortedUids(): string[] {
    return [...this.order];
  }

  /**
   * Insert uid before beforeUid (or at the end if beforeUid not found)
   */
  insert(uid: string, beforeUid?: string) {
    this.remove(uid); // Clean up old position first
    const idx = beforeUid ? this.order.indexOf(beforeUid) : -1;
    if (idx === -1) {
      this.order.push(uid); // Add to end
    } else {
      this.order.splice(idx, 0, uid);
    }
    this.isDirty = true;
  }

  /**
   * Move uid to specific index (0 = highest priority)
   */
  moveTo(uid: string, newIndex: number) {
    this.remove(uid);
    const clamped = Math.max(0, Math.min(this.order.length, newIndex));
    this.order.splice(clamped, 0, uid);
    this.isDirty = true;
  }

  /**
   * Move card to specific position (alias for moveTo for compatibility)
   */
  moveCard(uid: string, toIndex: number): void {
    this.moveTo(uid, toIndex);
  }

  /**
   * Remove uid from order
   */
  remove(uid: string) {
    const idx = this.order.indexOf(uid);
    if (idx !== -1) {
      this.order.splice(idx, 1);
      this.isDirty = true;
    }
  }

  /**
   * Get current index of uid (-1 if not found)
   */
  getIndex(uid: string): number {
    return this.order.indexOf(uid);
  }

  /**
   * Get uid at specific index
   */
  getUidAt(index: number): string | undefined {
    return this.order[index];
  }

  /**
   * Get serializable data for persistence
   */
  serialize(): string[] {
    return [...this.order];
  }

  /**
   * Create from serialized data
   */
  static fromSerialized(data: string[]): ArrayPriorityManager {
    return new ArrayPriorityManager(data);
  }

  /**
   * Create from old float-based priority map (for migration)
   */
  static fromFloatMap(map: Record<string, number>): ArrayPriorityManager {
    const order = Object.entries(map)
      .sort((a, b) => b[1] - a[1]) // Sort by priority descending
      .map(([uid]) => uid);
    return new ArrayPriorityManager(order);
  }

  /**
   * Add multiple UIDs that aren't in the order yet
   * Optimized for performance with large arrays
   */
  addMissing(uids: string[]) {
    if (uids.length === 0) return;
    
    // Use Set for O(1) lookup instead of O(n) includes
    const existingSet = new Set(this.order);
    const missingUids = uids.filter(uid => !existingSet.has(uid));
    
    // Batch add all missing UIDs
    this.order.push(...missingUids);
  }

  /**
   * Remove UIDs that are no longer needed
   */
  cleanup(validUids: string[]) {
    const validSet = new Set(validUids);
    this.order = this.order.filter(uid => validSet.has(uid));
  }

  /**
   * Remove specific orphaned UIDs from the order
   */
  removeOrphanedUids(orphanedUids: string[]) {
    const orphanedSet = new Set(orphanedUids);
    this.order = this.order.filter(uid => !orphanedSet.has(uid));
  }

  /**
   * Get total count of cards in order
   */
  getCount(): number {
    return this.order.length;
  }

  /**
   * Check if uid exists in order
   */
  has(uid: string): boolean {
    return this.order.includes(uid);
  }

  /**
   * Move a card to the top (highest priority)
   */
  moveToTop(uid: string) {
    this.moveTo(uid, 0);
  }

  /**
   * Move a card to the bottom (lowest priority)
   */
  moveToBottom(uid: string) {
    this.moveTo(uid, this.order.length);
  }

  /**
   * Batch move multiple cards to new positions
   */
  batchMove(moves: Array<{ uid: string; newIndex: number }>) {
    // Sort by target index to maintain relative order
    const sortedMoves = moves.sort((a, b) => a.newIndex - b.newIndex);
    
    // Remove all moving cards first
    const movingUids = new Set(sortedMoves.map(m => m.uid));
    this.order = this.order.filter(uid => !movingUids.has(uid));
    
    // Insert cards at their new positions
    for (const { uid, newIndex } of sortedMoves) {
      const clamped = Math.max(0, Math.min(this.order.length, newIndex));
      this.order.splice(clamped, 0, uid);
    }
    this.isDirty = true;
  }

  /**
   * Get card's current position (1-indexed for compatibility)
   */
  getCardPosition(uid: string): number {
    const index = this.order.indexOf(uid);
    return index === -1 ? this.order.length : index + 1;
  }

  /**
   * Check if manager has unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  /**
   * Mark changes as saved
   */
  markAsSaved(): void {
    this.isDirty = false;
  }

  /**
   * Get deck positions for deck management
   */
  getDeckPositions(cardUids: Record<string, string[]>): { deckName: string; position: number; cardCount: number }[] {
    const positions: { deckName: string; position: number; cardCount: number }[] = [];
    
    Object.entries(cardUids).forEach(([deckName, uids]) => {
      if (uids.length > 0) {
        // Find the position of the first card in the deck
        const firstCardIndex = this.order.findIndex(uid => uids.includes(uid));
        positions.push({
          deckName,
          position: firstCardIndex === -1 ? this.order.length : firstCardIndex + 1,
          cardCount: uids.length
        });
      }
    });
    
    return positions.sort((a, b) => a.position - b.position);
  }

  /**
   * Set complete order and mark as dirty
   */
  setOrder(newOrder: string[]): void {
    this.order = [...newOrder];
    this.isDirty = true;
  }

  /**
   * Add new cards if they don't exist
   */
  addCards(newUids: string[]): void {
    const existingSet = new Set(this.order);
    const toAdd = newUids.filter(uid => !existingSet.has(uid));
    
    if (toAdd.length > 0) {
      this.order.push(...toAdd);
      this.isDirty = true;
    }
  }

  /**
   * Remove cards that are no longer valid
   */
  removeCards(validUids: string[]): void {
    const validSet = new Set(validUids);
    const oldLength = this.order.length;
    this.order = this.order.filter(uid => validSet.has(uid));
    
    if (this.order.length !== oldLength) {
      this.isDirty = true;
    }
  }

  /**
   * Move deck to specific position (batch move)
   */
  moveDeck(deckUids: string[], toIndex: number): void {
    // Remove deck cards from current positions
    this.order = this.order.filter(uid => !deckUids.includes(uid));
    
    // Insert deck cards at target position
    this.order.splice(toIndex, 0, ...deckUids);
    this.isDirty = true;
  }

  /**
   * Get statistics about the manager
   */
  getStats() {
    return {
      totalCards: this.order.length,
      hasUnsavedChanges: this.isDirty
    };
  }
}