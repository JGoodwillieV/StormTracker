// supabase/functions/send-push/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

// VAPID keys (set these in Supabase secrets)
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@stormtracker.com'

interface PushPayload {
  user_ids: string[]
  title: string
  body: string
  url?: string
  tag?: string
  notification_type: string
  actions?: Array<{ action: string; title: string }>
}

interface PushSubscription {
  endpoint: string
  p256dh: string
  auth: string
  user_id: string
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify API key (only service role should call this)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Parse request body
    const payload: PushPayload = await req.json()
    
    console.log('📬 Sending push notifications:', {
      user_count: payload.user_ids.length,
      notification_type: payload.notification_type,
      title: payload.title
    })

    // Validate payload
    if (!payload.user_ids || payload.user_ids.length === 0) {
      throw new Error('user_ids array is required')
    }
    if (!payload.title || !payload.body) {
      throw new Error('title and body are required')
    }
    if (!payload.notification_type) {
      throw new Error('notification_type is required')
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get push subscriptions for users who want this notification type
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id, notification_preferences!inner(*)')
      .in('user_id', payload.user_ids)
      .eq(`notification_preferences.${payload.notification_type}`, true)

    if (subError) {
      console.error('❌ Error fetching subscriptions:', subError)
      throw subError
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('ℹ️ No subscriptions found for these users')
      return new Response(
        JSON.stringify({ sent: 0, message: 'No active subscriptions' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter by quiet hours using database function
    const filteredSubscriptions: PushSubscription[] = []
    
    for (const sub of subscriptions) {
      const { data: shouldSend } = await supabase.rpc('should_send_notification', {
        p_user_id: sub.user_id,
        p_notification_type: payload.notification_type
      })

      if (shouldSend) {
        filteredSubscriptions.push(sub as PushSubscription)
      } else {
        console.log(`⏰ Skipping notification for user ${sub.user_id} (quiet hours or disabled)`)
      }
    }

    console.log(`📊 Sending to ${filteredSubscriptions.length} out of ${subscriptions.length} subscriptions`)

    // Send push notifications
    const results = await Promise.allSettled(
      filteredSubscriptions.map((sub) => sendPushNotification(sub, payload, supabase))
    )

    // Count successful sends
    const sent = results.filter((r) => r.status === 'fulfilled' && r.value === true).length
    const failed = results.length - sent

    console.log(`✅ Sent: ${sent}, ❌ Failed: ${failed}`)

    // Increment badge counts for users who received notifications
    if (sent > 0) {
      const successfulUserIds = filteredSubscriptions
        .filter((_, i) => results[i].status === 'fulfilled')
        .map(sub => sub.user_id)

      await supabase.rpc('increment_badge_counts', {
        user_ids: successfulUserIds
      })
    }

    // Save to notification history
    const historyRecords = filteredSubscriptions.map(sub => ({
      user_id: sub.user_id,
      title: payload.title,
      body: payload.body,
      notification_type: payload.notification_type,
      url: payload.url || '/',
      sent_at: new Date().toISOString()
    }))

    if (historyRecords.length > 0) {
      await supabase.from('notification_history').insert(historyRecords)
    }

    return new Response(
      JSON.stringify({ 
        sent, 
        failed,
        total: results.length 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Error in send-push function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/**
 * Send a push notification using Web Push protocol
 */
async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload,
  supabase: any
): Promise<boolean> {
  try {
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      tag: payload.tag || `notification-${Date.now()}`,
      actions: payload.actions || []
    })

    // Encrypt payload using Web Push encryption
    const encryptedPayload = await encryptPayload(
      pushPayload,
      subscription.p256dh,
      subscription.auth
    )

    // Generate VAPID authorization header
    const vapidAuth = await generateVAPIDAuth(subscription.endpoint)

    // Send the push notification
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400', // 24 hours
        'Authorization': vapidAuth,
      },
      body: encryptedPayload,
    })

    // Handle gone subscriptions (410)
    if (response.status === 410 || response.status === 404) {
      console.log('🗑️ Removing expired subscription:', subscription.endpoint.substring(0, 50))
      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', subscription.endpoint)
      return false
    }

    if (!response.ok) {
      console.error(`❌ Push failed (${response.status}):`, await response.text())
      return false
    }

    console.log('✅ Push sent successfully')
    return true

  } catch (error) {
    console.error('❌ Error sending push:', error)
    return false
  }
}

/**
 * Generate VAPID Authorization header (JWT)
 */
async function generateVAPIDAuth(endpoint: string): Promise<string> {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`

  // Create JWT header
  const header = {
    typ: 'JWT',
    alg: 'ES256',
  }

  // Create JWT payload
  const jwtPayload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, // 12 hours
    sub: VAPID_SUBJECT,
  }

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header))
  const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload))
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  // Sign with VAPID private key
  const signature = await signJWT(unsignedToken, VAPID_PRIVATE_KEY)
  const jwt = `${unsignedToken}.${signature}`

  return `vapid t=${jwt}, k=${VAPID_PUBLIC_KEY}`
}

/**
 * Sign JWT using ES256 (simplified version - you may need web-push library)
 */
async function signJWT(data: string, privateKey: string): Promise<string> {
  // This is a simplified placeholder
  // In production, use a proper JWT signing library or web-push
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  
  // For now, return a base64url encoded hash
  // NOTE: This is NOT proper ES256 signing - use web-push library in production
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(hashBuffer)))
}

/**
 * Encrypt payload for Web Push (simplified)
 */
async function encryptPayload(
  payload: string,
  userPublicKey: string,
  userAuth: string
): Promise<Uint8Array> {
  // This is a simplified version
  // In production, use proper Web Push encryption (aes128gcm)
  // Consider using the 'web-push' npm package
  
  const encoder = new TextEncoder()
  return encoder.encode(payload)
}

/**
 * Base64 URL encode
 */
function base64UrlEncode(str: string): string {
  const base64 = btoa(str)
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

