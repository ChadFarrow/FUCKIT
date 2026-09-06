'use client';

import { useCallback, useRef } from 'react';
import { APP_NAME } from '@/lib/constants';
import { useBitcoinConnect } from '@/components/Lightning/BitcoinConnectProvider';
import { useUserSettings } from '@/contexts/UserSettingsContext';
import { ValueSplitsService } from '@/lib/lightning/value-splits';
import { ValueRecipient } from '@/lib/lightning/value-parser';
import { reportBoost } from '@/lib/lightning/report-boost';
import { resolveAutoBoostSenderName, resolveBoostSenderName } from '@/lib/lightning/sender-name';
import { toast } from '@/components/Toast';
import { hasV4V as checkHasV4V, getV4VRecipients, getPrimaryRecipient, getPrimaryRecipientObject } from '@/lib/v4v-utils';

interface TrackInfo {
  id?: string;
  title?: string;
  guid?: string;
  v4vValue?: any;
  v4vRecipient?: string;
}

interface AlbumInfo {
  id?: string;
  title?: string;
  artist?: string;
  feedGuid?: string;
  feedUrl?: string;
}

interface AutoBoostResult {
  success: boolean;
  error?: string;
  amount?: number;
}

export function useAutoBoost() {
  const { isConnected, sendPayment, sendKeysend, supportsKeysend } = useBitcoinConnect();
  const { settings } = useUserSettings();
  const isProcessingRef = useRef(false);

  const triggerAutoBoost = useCallback(async (
    track: TrackInfo,
    album: AlbumInfo,
    amount?: number
  ): Promise<AutoBoostResult> => {
    // Prevent concurrent auto-boosts
    if (isProcessingRef.current) {
      console.log('⚡ Auto-boost already in progress, skipping');
      return { success: false, error: 'Already processing' };
    }

    // Check if auto-boost is enabled
    if (!settings.autoBoostEnabled) {
      return { success: false, error: 'Auto-boost disabled' };
    }

    // Check if wallet is connected
    if (!isConnected) {
      console.log('⚡ Auto-boost skipped: wallet not connected');
      return { success: false, error: 'Wallet not connected' };
    }

    // Check if track has V4V data
    if (!checkHasV4V(track)) {
      console.log('⚡ Auto-boost skipped: no V4V data for track');
      return { success: false, error: 'No V4V data' };
    }

    const boostAmount = amount || settings.autoBoostAmount || 50;

    isProcessingRef.current = true;

    try {
      console.log(`⚡ Auto-boost starting: ${boostAmount} sats for "${track.title}"`);

      // Build Helipad metadata
      const helipadMetadata: any = {
        podcast: album.artist || 'Unknown Artist',
        episode: track.title || 'Unknown Track',
        action: 'auto', // Helipad action type 4 = automated boost
        app_name: APP_NAME,
        value_msat: boostAmount * 1000,
        value_msat_total: boostAmount * 1000,
        sender_name: resolveAutoBoostSenderName(settings.defaultBoostName),
        ts: Math.floor(Date.now() / 1000),
        uuid: `auto-${Date.now()}-${Math.floor(Math.random() * 999)}`
      };

      // Add optional fields
      if (album.feedUrl) {
        helipadMetadata.url = album.feedUrl;
        helipadMetadata.feed = album.feedUrl;
      }
      if (album.id) {
        helipadMetadata.feedId = album.id;
      }
      if (album.feedGuid) {
        helipadMetadata.remote_feed_guid = album.feedGuid;
      }
      if (track.guid || track.id) {
        helipadMetadata.remote_item_guid = track.guid || track.id;
        helipadMetadata.episode_guid = track.guid || track.id;
      }
      if (album.title) {
        helipadMetadata.album = album.title;
      }

      console.log('📋 Auto-boost Helipad metadata:', helipadMetadata);

      let result: { preimage?: string; error?: string } | null = null;

      // Check if we have value splits (multiple recipients)
      const v4vRecipients = getV4VRecipients(track);
      if (v4vRecipients.length > 0) {
        // Multi-recipient payment via value splits
        const recipients: ValueRecipient[] = v4vRecipients.map((r) => ({
          name: r.name || 'Unknown',
          type: r.type === 'lnaddress' ? 'lnaddress' : 'node',
          address: r.address,
          split: r.split || 100,
          customKey: r.customKey,
          customValue: r.customValue,
        }));

        console.log(`⚡ Auto-boost: sending to ${recipients.length} recipients`);

        const multiResult = await ValueSplitsService.sendMultiRecipientPayment(
          recipients,
          boostAmount,
          sendPayment,
          sendKeysend,
          undefined, // No message for auto-boost
          helipadMetadata,
          undefined, // No progress callback for auto-boost
          undefined, // walletType
          supportsKeysend
        );

        if (multiResult.success || multiResult.isPartialSuccess) {
          result = { preimage: multiResult.primaryPreimage };
        } else {
          result = { error: multiResult.errors.join(', ') };
        }
      } else {
        // Single recipient (fallback to v4vRecipient). Routed through the same dispatch as the
        // multi-recipient case rather than calling sendKeysend directly — that is what applies
        // the Fountain LNURL rule and the routing-TLV handling to auto-boost too.
        const primaryObject = getPrimaryRecipientObject(track);
        const primaryAddress = getPrimaryRecipient(track);

        if (primaryObject || primaryAddress) {
          const recipient: ValueRecipient = primaryObject
            ? {
                name: primaryObject.name || 'Unknown',
                type: primaryObject.type === 'lnaddress' ? 'lnaddress' : 'node',
                address: primaryObject.address,
                split: 100,
                customKey: primaryObject.customKey,
                customValue: primaryObject.customValue,
              }
            : {
                name: 'Unknown',
                // v4vRecipient is a bare string, so infer from its shape the way
                // /api/lightning/value-splits does.
                type: primaryAddress!.includes('@') ? 'lnaddress' : 'node',
                address: primaryAddress!,
                split: 100,
              };

          console.log(`⚡ Auto-boost: sending to single recipient ${recipient.address}`);

          const singleResult = await ValueSplitsService.sendMultiRecipientPayment(
            [recipient],
            boostAmount,
            sendPayment,
            sendKeysend,
            undefined, // No message for auto-boost
            helipadMetadata,
            undefined, // No progress callback for auto-boost
            undefined, // walletType
            supportsKeysend
          );

          if (singleResult.success || singleResult.isPartialSuccess) {
            result = { preimage: singleResult.primaryPreimage };
          } else {
            result = { error: singleResult.errors.join(', ') };
          }
        }
      }

      // Reported on BOTH branches — see reportBoost. Auto-boost fires while the
      // screen is off, so a failure that is only a toast is a failure nobody sees.
      const autoBoostReport = {
        trackId: track.id,
        feedId: album.id,
        trackTitle: track.title,
        artistName: album.artist,
        amount: boostAmount,
        senderName: resolveBoostSenderName({ settingsName: settings.defaultBoostName }),
        recipient: getPrimaryRecipient(track) || 'value-splits',
      };

      if (result?.preimage) {
        console.log(`✅ Auto-boost successful: ${boostAmount} sats`);

        await reportBoost({ ...autoBoostReport, preimage: result.preimage, status: 'succeeded' });

        // Show subtle toast notification
        toast.success(`Auto-boost: ${boostAmount} sats ⚡`, {
          duration: 2000
        });

        return { success: true, amount: boostAmount };
      } else {
        const reason = result?.error || 'Unknown error';
        console.warn(`⚠️ Auto-boost failed: ${reason}`);
        await reportBoost({ ...autoBoostReport, status: 'failed', error: reason });
        return { success: false, error: result?.error || 'Payment failed' };
      }
    } catch (error) {
      console.error('❌ Auto-boost error:', error);
      await reportBoost({
        trackId: track.id,
        feedId: album.id,
        trackTitle: track.title,
        artistName: album.artist,
        amount: boostAmount,
        recipient: getPrimaryRecipient(track) || 'value-splits',
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      isProcessingRef.current = false;
    }
  }, [isConnected, sendPayment, sendKeysend, supportsKeysend, settings]);

  return {
    triggerAutoBoost,
    isAutoBoostEnabled: settings.autoBoostEnabled,
    autoBoostAmount: settings.autoBoostAmount
  };
}
