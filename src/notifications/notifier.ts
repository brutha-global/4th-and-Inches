import { Env } from "../lib/sportsdata";

/**
 * Registers a user device token for FCM push notifications.
 */
export async function registerDevice(
  userId: string,
  fcmToken: string,
  platform: "ios" | "android" | "web",
  db: D1Database
): Promise<Response> {
  try {
    const now = Math.floor(Date.now() / 1000);
    await db.prepare(`
      INSERT INTO user_devices (user_id, fcm_token, platform, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, fcm_token) DO UPDATE SET updated_at = excluded.updated_at
    `).bind(userId, fcmToken, platform, now).run();

    // Default preference setup
    await db.prepare(`
      INSERT INTO user_notification_prefs (user_id)
      VALUES (?)
      ON CONFLICT(user_id) DO NOTHING
    `).bind(userId).run();

    return new Response(JSON.stringify({ success: true, message: "Device registered successfully" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

/**
 * Dispatches simulated push notifications by writing logs to output.
 * Fully mirrors FCM service behaviors.
 */
export async function sendSimulatedPush(
  userId: string,
  type: string,
  title: string,
  body: string,
  deepLink: string,
  db: D1Database
): Promise<boolean> {
  try {
    // 1. Check preference settings
    const prefs = await db.prepare("SELECT * FROM user_notification_prefs WHERE user_id = ?").bind(userId).first<any>();
    if (prefs) {
      const isAllowed = prefs[type] !== 0; // Check preference flag (1 = Allowed, 0 = Blocked)
      if (!isAllowed) {
        console.log(`Notification of type ${type} blocked by user preference settings.`);
        return false;
      }
    }

    // 2. Fetch active device tokens
    const { results: devices } = await db.prepare("SELECT fcm_token, platform FROM user_devices WHERE user_id = ?").bind(userId).all<any>();
    if (devices.length === 0) {
      console.log(`No registered devices found for user: ${userId}.`);
      return false;
    }

    // Simulate sending payloads
    for (const d of devices) {
      console.log(`[FCM PUSH -> ${d.platform.toUpperCase()}] Token: ${d.fcm_token} | Title: "${title}" | Body: "${body}" | DeepLink: "${deepLink}"`);
    }

    return true;
  } catch (err) {
    console.error("Failed to process push payload", err);
    return false;
  }
}
