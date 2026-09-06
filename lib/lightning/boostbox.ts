/**
 * BoostBox API client for storing Podcasting 2.0 boost metadata.
 *
 * BoostBox stores payment metadata and returns a short URL that gets
 * included in LNURL invoice comments via the `rss::payment::boost` protocol.
 * Recipients can then fetch the full metadata from that URL using the
 * `x-rss-payment` HTTP header.
 *
 * Used for LNURL payments where keysend TLV records aren't available.
 * Keysend payments continue to use Helipad metadata directly.
 *
 * @see https://github.com/ChadFarrow/boostbox
 */

import { APP_NAME } from '@/lib/constants';
export interface BoostBoxPayload {
  action: 'boost' | 'stream';
  split: number;
  value_msat: number;
  value_msat_total: number;
  timestamp: string;
  message?: string;
  app_name?: string;
  app_version?: string;
  sender_name?: string;
  recipient_name?: string;
  recipient_address?: string;
  feed_guid?: string;
  feed_title?: string;
  item_guid?: string;
  item_title?: string;
  publisher_guid?: string;
  publisher_title?: string;
  remote_feed_guid?: string;
  remote_item_guid?: string;
  remote_publisher_guid?: string;
  group?: string;
  sender_id?: string;
  sender_npub?: string;
  boost_link?: string;
}

export interface BoostBoxResponse {
  id: string;
  url: string;
  desc: string;
}

/**
 * Map Helipad metadata to BoostBox payload format.
 */
function mapHelipadToBoostBox(
  helipadMetadata: Record<string, any>,
  recipientName?: string,
  recipientAddress?: string,
  split?: number
): BoostBoxPayload {
  return {
    action: helipadMetadata.action === 'auto' ? 'stream' : 'boost',
    split: split ?? 1,
    value_msat: helipadMetadata.value_msat || 0,
    value_msat_total: helipadMetadata.value_msat_total || helipadMetadata.value_msat || 0,
    timestamp: new Date().toISOString(),
    message: helipadMetadata.message,
    app_name: helipadMetadata.app_name || APP_NAME,
    app_version: helipadMetadata.app_version,
    sender_name: helipadMetadata.sender_name,
    recipient_name: recipientName,
    recipient_address: recipientAddress,
    // feed_guid and remote_feed_guid are the same value because we only have
    // the remote GUID from <podcast:remoteItem> — the playlist feed's own GUID
    // is not meaningful here.
    feed_guid: helipadMetadata.remote_feed_guid,
    // The feed IS the album, so use album name first, fall back to artist name
    feed_title: helipadMetadata.album || helipadMetadata.podcast,
    item_guid: helipadMetadata.episode_guid || helipadMetadata.remote_item_guid,
    item_title: helipadMetadata.episode,
    publisher_guid: helipadMetadata.publisher_guid,
    // The publisher IS the artist
    publisher_title: helipadMetadata.podcast,
    remote_feed_guid: helipadMetadata.remote_feed_guid,
    remote_item_guid: helipadMetadata.remote_item_guid,
    remote_publisher_guid: helipadMetadata.publisher_guid,
    group: helipadMetadata.uuid,
    sender_id: helipadMetadata.sender_npub,
    sender_npub: helipadMetadata.sender_npub,
    boost_link: helipadMetadata.boost_link,
  };
}

export class BoostBoxService {
  /**
   * Store boost metadata in BoostBox and return the description string
   * for use in LNURL invoice comments.
   *
   * Returns null on any failure so the caller can proceed without it.
   */
  static async storeMetadata(
    helipadMetadata: Record<string, any>,
    recipientName?: string,
    recipientAddress?: string,
    split?: number
  ): Promise<{ desc: string; url: string } | null> {
    try {
      const payload = mapHelipadToBoostBox(helipadMetadata, recipientName, recipientAddress, split);

      // Always use server-side proxy (this is only called client-side)
      const response = await fetch('/api/lightning/boostbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.warn(`BoostBox proxy error: HTTP ${response.status}`);
        return null;
      }

      const data: BoostBoxResponse = await response.json();

      if (data.desc) {
        console.log(`BoostBox stored: ${data.url}`);
        return { desc: data.desc, url: data.url };
      }

      return null;
    } catch (error) {
      console.warn('BoostBox unavailable, proceeding without metadata storage:', error);
      return null;
    }
  }
}
