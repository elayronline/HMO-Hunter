import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { sendEmail } from "@/lib/email/resend"
import {
  priceDropEmail,
  newListingEmail,
  licenceExpiryEmail,
} from "@/lib/email/templates"

// This endpoint is called by a cron job to process and send pending notifications
// In production, use Vercel Cron or an external service

export async function POST(request: Request) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const results = {
      priceAlerts: 0,
      licenceAlerts: 0,
      errors: 0,
    }

    // 1. Process price drop alerts
    const { data: priceAlerts } = await supabase
      .from("price_alert_history")
      .select(`
        *,
        alert:price_alerts(user_id, notify_email),
        property:properties(address, postcode, bedrooms, property_type)
      `)
      .eq("email_sent", false)
      .eq("alert.notify_email", true)
      .limit(50)

    if (priceAlerts && priceAlerts.length > 0) {
      for (const alert of priceAlerts) {
        if (!alert.alert?.user_id) continue

        // Get user email
        const { data: userData } = await supabase.auth.admin.getUserById(
          alert.alert.user_id
        )

        if (!userData?.user?.email) continue

        const userName = userData.user.user_metadata?.full_name || "there"
        const email = priceDropEmail({
          userName,
          propertyAddress: alert.property?.address || alert.property_address || "Property",
          propertyPostcode: alert.property?.postcode || alert.property_postcode || "",
          previousPrice: alert.previous_price || 0,
          newPrice: alert.new_price || 0,
          priceChange: alert.price_change || 0,
          priceChangePercent: alert.price_change_percent || 0,
          propertyUrl: `https://hmohunter.co.uk/property/${alert.property_id}`,
          bedrooms: alert.property?.bedrooms,
          propertyType: alert.property?.property_type,
        })

        const result = await sendEmail({
          to: userData.user.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        })

        if (result.success) {
          // Mark as sent
          await supabase
            .from("price_alert_history")
            .update({
              email_sent: true,
              email_sent_at: new Date().toISOString(),
            })
            .eq("id", alert.id)
          results.priceAlerts++
        } else {
          results.errors++
        }
      }
    }

    // 2. Process licence expiry notifications
    // Get users with watched properties that have licences expiring within 30 days
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    const { data: expiringLicences } = await supabase
      .from("watched_properties")
      .select(`
        user_id,
        property:properties(
          id,
          address,
          postcode,
          licence_expiry
        )
      `)
      .eq("is_active", true)
      .not("property.licence_expiry", "is", null)
      .lte("property.licence_expiry", thirtyDaysFromNow.toISOString())
      .gte("property.licence_expiry", new Date().toISOString())

    if (expiringLicences && expiringLicences.length > 0) {
      // Group by user
      const userProperties: Record<string, typeof expiringLicences> = {}
      for (const item of expiringLicences) {
        if (!item.user_id) continue
        if (!userProperties[item.user_id]) {
          userProperties[item.user_id] = []
        }
        userProperties[item.user_id].push(item)
      }

      // Send one email per user with all expiring properties
      for (const [userId, properties] of Object.entries(userProperties)) {
        const { data: userData } = await supabase.auth.admin.getUserById(userId)

        if (!userData?.user?.email) continue

        const userName = userData.user.user_metadata?.full_name || "there"
        const propertyData = properties
          .filter(p => p.property)
          .map(p => {
            const expiryDate = new Date(p.property!.licence_expiry!)
            const daysUntilExpiry = Math.ceil(
              (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            )
            return {
              address: p.property!.address || "Unknown",
              postcode: p.property!.postcode || "",
              expiryDate: expiryDate.toLocaleDateString("en-GB"),
              daysUntilExpiry,
              url: `https://hmohunter.co.uk/property/${p.property!.id}`,
            }
          })
          .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)

        if (propertyData.length === 0) continue

        const email = licenceExpiryEmail({
          userName,
          properties: propertyData,
        })

        const result = await sendEmail({
          to: userData.user.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        })

        if (result.success) {
          results.licenceAlerts++
        } else {
          results.errors++
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: results,
    })
  } catch (error) {
    console.error("[SendNotifications] Error:", error)
    return NextResponse.json(
      { error: "Failed to process notifications" },
      { status: 500 }
    )
  }
}

// GET endpoint to check status (useful for debugging)
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Notification service is running",
    configured: !!process.env.RESEND_API_KEY,
  })
}
