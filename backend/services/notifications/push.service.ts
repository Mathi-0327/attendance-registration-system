/**
 * @file backend/services/notifications/push.service.ts
 * @description Web Push & Client WebSocket Notification service.
 * Supports registering push subscriptions and sending push alerts to active client views.
 */

import { getWebSocketServer } from "../../websocket";

export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscription {
  endpoint: string;
  keys: PushSubscriptionKeys;
}

// In-memory registry for client push subscriptions (Redis-ready interface)
const userSubscriptions: Map<number, Set<PushSubscription>> = new Map();

export class PushService {
  /**
   * Subscribe a user's browser device to push alerts.
   */
  async subscribeUser(userId: number, subscription: PushSubscription): Promise<void> {
    if (!userSubscriptions.has(userId)) {
      userSubscriptions.set(userId, new Set());
    }
    const subs = userSubscriptions.get(userId)!;
    
    // Check duplicate
    const exists = Array.from(subs).some(s => s.endpoint === subscription.endpoint);
    if (!exists) {
      subs.add(subscription);
      console.log(`[push-notification] User #${userId} subscribed to browser push alerts.`);
    }
  }

  /**
   * Unsubscribe a user's device.
   */
  async unsubscribeUser(userId: number, endpoint: string): Promise<void> {
    const subs = userSubscriptions.get(userId);
    if (subs) {
      const match = Array.from(subs).find(s => s.endpoint === endpoint);
      if (match) {
        subs.delete(match);
        console.log(`[push-notification] User #${userId} unsubscribed.`);
      }
    }
  }

  /**
   * Send a push alert to a user's registered devices.
   * Falls back to WebSocket alert.
   */
  async sendNotification(
    userId: number,
    payload: { title: string; body: string; url?: string }
  ): Promise<{ success: boolean; deviceCount: number }> {
    const subs = userSubscriptions.get(userId);
    const hasSubs = subs && subs.size > 0;

    console.log(
      `[push-notification] Sending to User #${userId} → Title: "${payload.title}" | Body: "${payload.body}"`
    );

    // Simulate Web Push delivery for registered browsers
    if (hasSubs) {
      subs.forEach((sub) => {
        console.log(`[push-notification] Dispatching Web Push API frame to: ${sub.endpoint.substring(0, 45)}...`);
      });
    }

    // Broadcast instant update via WebSocket
    const wsServer = getWebSocketServer();
    if (wsServer) {
      wsServer.broadcast({
        type: "attendance_recorded", // Using existing type for compatibility
        data: {
          toastMessage: `${payload.title}: ${payload.body}`,
          title: payload.title,
          body: payload.body,
          url: payload.url,
          userId,
        },
      });
    }

    return {
      success: true,
      deviceCount: subs ? subs.size : 0,
    };
  }
}

export const pushService = new PushService();
