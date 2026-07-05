import { Env } from "../lib/sportsdata";

// Middleware subscription check
export async function checkSubscription(
  userId: string,
  requiredTier: "FREE" | "PRO" | "ELITE",
  db: D1Database
): Promise<{ allowed: boolean; activeTier: string }> {
  // Lazy create subscriptions table to guarantee it exists
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS user_subscriptions (
      user_id TEXT PRIMARY KEY,
      tier TEXT NOT NULL DEFAULT 'FREE',
      expires_at INTEGER,
      cancel_at_period_end INTEGER DEFAULT 0
    )
  `).run();

  const sub = await db.prepare("SELECT tier, expires_at FROM user_subscriptions WHERE user_id = ?").bind(userId).first<{ tier: string; expires_at: number | null }>();
  const tier = sub?.tier || "FREE";
  const expires = sub?.expires_at || 0;
  const now = Math.floor(Date.now() / 1000);

  // If expired, fall back to FREE
  const activeTier = (expires > 0 && expires < now) ? "FREE" : tier;

  if (requiredTier === "ELITE") {
    return { allowed: activeTier === "ELITE", activeTier };
  }
  if (requiredTier === "PRO") {
    return { allowed: activeTier === "PRO" || activeTier === "ELITE", activeTier };
  }
  return { allowed: true, activeTier }; // FREE allows everything below it
}

// RevenueCat Webhook handler
export async function handleRevenueCatWebhook(
  request: Request,
  db: D1Database
): Promise<Response> {
  try {
    const data: any = await request.json();
    const event = data?.event;
    if (!event) {
      return new Response(JSON.stringify({ error: "Missing event payload" }), { status: 400 });
    }

    const userId = event.app_user_id;
    const eventType = event.type;
    const entitlementId = event.entitlement_id || "PRO"; // Default fallback
    const expirationTime = event.expiration_at_ms ? Math.floor(event.expiration_at_ms / 1000) : null;

    // Ensure table exists
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        user_id TEXT PRIMARY KEY,
        tier TEXT NOT NULL DEFAULT 'FREE',
        expires_at INTEGER,
        cancel_at_period_end INTEGER DEFAULT 0
      )
    `).run();

    if (eventType === "INITIAL_PURCHASE" || eventType === "RENEWAL") {
      const tier = entitlementId.toUpperCase().includes("ELITE") ? "ELITE" : "PRO";
      await db.prepare(`
        INSERT INTO user_subscriptions (user_id, tier, expires_at, cancel_at_period_end)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(user_id) DO UPDATE SET tier = excluded.tier, expires_at = excluded.expires_at, cancel_at_period_end = 0
      `).bind(userId, tier, expirationTime).run();
    } else if (eventType === "CANCELLATION") {
      await db.prepare(`
        UPDATE user_subscriptions 
        SET cancel_at_period_end = 1 
        WHERE user_id = ?
      `).bind(userId).run();
    } else if (eventType === "EXPIRATION") {
      await db.prepare(`
        UPDATE user_subscriptions 
        SET tier = 'FREE', expires_at = 0 
        WHERE user_id = ?
      `).bind(userId).run();
    }

    return new Response(JSON.stringify({ success: true, event: eventType }), {
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

// User subscription retrieval API
export async function getUserSubscriptionDetails(
  userId: string,
  db: D1Database
): Promise<Response> {
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS user_subscriptions (
        user_id TEXT PRIMARY KEY,
        tier TEXT NOT NULL DEFAULT 'FREE',
        expires_at INTEGER,
        cancel_at_period_end INTEGER DEFAULT 0
      )
    `).run();

    const sub = await db.prepare("SELECT * FROM user_subscriptions WHERE user_id = ?").bind(userId).first<any>();
    const tier = sub?.tier || "FREE";
    const expires_at = sub?.expires_at || null;

    // Compile mock feature list
    const features = {
      FREE: ["1 league entry", "Basic lineup settings", "3 AI queries/week"],
      PRO: ["Unlimited leagues", "Full AI Optimizations", "Momentum Swaps", "Tactical Timeouts", "Priority waivers"],
      ELITE: ["All PRO benefits", "AI Commissioner review", "Unlimited AI", "Custom scoring profiles", "Private dynasty leagues"]
    };

    return new Response(JSON.stringify({
      userId,
      tier,
      expires_at,
      features: features[tier as keyof typeof features]
    }), {
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
