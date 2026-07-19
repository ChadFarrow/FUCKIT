/**
 * Next-track blob prefetch cache (Android locked-screen fix).
 *
 * On Android with the screen locked, Chromium suspends an <audio> element's own
 * network load() for a hidden, not-yet-playing element, so the ping-pong idle
 * element cannot fetch the next track and playback stalls at the boundary
 * (MEDIA_ERR_SRC_NOT_SUPPORTED). A page-level fetch() still works while the tab
 * is alive (current track playing), and a blob: URL needs no network at the
 * boundary. This cache holds the next track's bytes as a blob: URL so the
 * transition needs zero network.
 *
 * Holds at most two object URLs at once: the one currently playing and the next
 * prepared one. create/revoke are injectable for testability.
 */

export interface NextTrackBlob {
  /** Key = the resolved primary playback URL of the prepared track. */
  key: string;
  /** In-memory object URL for the fetched bytes. */
  blobUrl: string;
}

type CreateObjectURL = (blob: Blob) => string;
type RevokeObjectURL = (url: string) => void;

export class NextTrackBlobCache {
  private createObjectURL: CreateObjectURL;
  private revokeObjectURL: RevokeObjectURL;
  private next: NextTrackBlob | null = null;
  private playing: NextTrackBlob | null = null;

  constructor(createObjectURL?: CreateObjectURL, revokeObjectURL?: RevokeObjectURL) {
    this.createObjectURL = createObjectURL ?? ((b) => URL.createObjectURL(b));
    this.revokeObjectURL = revokeObjectURL ?? ((u) => URL.revokeObjectURL(u));
  }

  /** True if a prepared next blob for `key` is ready to use. */
  hasPreparedNext(key: string): boolean {
    return this.next !== null && this.next.key === key;
  }

  /** The prepared next blob URL for `key`, or null. */
  getPreparedNext(key: string): string | null {
    return this.next !== null && this.next.key === key ? this.next.blobUrl : null;
  }

  /**
   * Store freshly-fetched bytes for `key` as the prepared next blob. Revokes any
   * previous prepared-next that was never consumed (the upcoming track changed).
   */
  prepareNext(key: string, blob: Blob): NextTrackBlob {
    if (this.next !== null) {
      this.revokeObjectURL(this.next.blobUrl);
      this.next = null;
    }
    const blobUrl = this.createObjectURL(blob);
    this.next = { key, blobUrl };
    return this.next;
  }

  /**
   * Promote the prepared next blob (matching `key`) to "playing" — it has just
   * been attached to the active audio element. Revokes the previously-playing
   * blob (that track finished). No-op if the prepared next doesn't match `key`.
   */
  promoteToPlaying(key: string): void {
    if (this.next === null || this.next.key !== key) {
      return;
    }
    if (this.playing !== null) {
      this.revokeObjectURL(this.playing.blobUrl);
    }
    this.playing = this.next;
    this.next = null;
  }

  /** Revoke everything and reset (stop / album change). */
  clearAll(): void {
    if (this.next !== null) {
      this.revokeObjectURL(this.next.blobUrl);
      this.next = null;
    }
    if (this.playing !== null) {
      this.revokeObjectURL(this.playing.blobUrl);
      this.playing = null;
    }
  }
}
