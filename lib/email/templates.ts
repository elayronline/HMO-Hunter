/**
 * Email templates for HMO Hunter notifications
 */

const BRAND_COLOR = "#0d9488" // Teal-600
const BACKGROUND_COLOR = "#f8fafc" // Slate-50

// Base email wrapper
function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HMO Hunter</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${BACKGROUND_COLOR};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${BACKGROUND_COLOR};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLOR}, #10b981); padding: 30px 40px; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">
                🏠 HMO Hunter
              </h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; border-top: 1px solid #e2e8f0; text-align: center;">
              <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">
                You're receiving this because you set up alerts on HMO Hunter.
              </p>
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                <a href="https://hmohunter.co.uk/settings" style="color: ${BRAND_COLOR};">Manage preferences</a> ·
                <a href="https://hmohunter.co.uk/unsubscribe" style="color: ${BRAND_COLOR};">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

// Price drop alert template
export function priceDropEmail(data: {
  userName: string
  propertyAddress: string
  propertyPostcode: string
  previousPrice: number
  newPrice: number
  priceChange: number
  priceChangePercent: number
  propertyUrl: string
  bedrooms?: number
  propertyType?: string
}): { subject: string; html: string; text: string } {
  const formattedPrevPrice = data.previousPrice.toLocaleString("en-GB")
  const formattedNewPrice = data.newPrice.toLocaleString("en-GB")
  const formattedChange = Math.abs(data.priceChange).toLocaleString("en-GB")
  const changePercent = Math.abs(data.priceChangePercent).toFixed(1)

  const subject = `🔻 Price Drop: ${data.propertyAddress} - Now £${formattedNewPrice}`

  const html = emailWrapper(`
    <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 20px;">
      Hi ${data.userName},
    </h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      Great news! A property you're watching has dropped in price.
    </p>

    <!-- Property Card -->
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 8px 0; color: #0f172a; font-size: 18px;">
        ${data.propertyAddress}
      </h3>
      <p style="margin: 0 0 16px 0; color: #64748b; font-size: 14px;">
        ${data.propertyPostcode}${data.bedrooms ? ` · ${data.bedrooms} bedrooms` : ""}${data.propertyType ? ` · ${data.propertyType}` : ""}
      </p>

      <!-- Price Change -->
      <div style="display: flex; align-items: center; gap: 16px;">
        <div>
          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Was</p>
          <p style="margin: 0; color: #64748b; font-size: 18px; text-decoration: line-through;">£${formattedPrevPrice}</p>
        </div>
        <div style="font-size: 24px; color: #10b981;">→</div>
        <div>
          <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Now</p>
          <p style="margin: 0; color: #10b981; font-size: 24px; font-weight: bold;">£${formattedNewPrice}</p>
        </div>
      </div>

      <div style="margin-top: 16px; padding: 12px; background-color: #ecfdf5; border-radius: 6px;">
        <p style="margin: 0; color: #059669; font-size: 14px; font-weight: 500;">
          💰 Save £${formattedChange} (${changePercent}% off)
        </p>
      </div>
    </div>

    <a href="${data.propertyUrl}" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500; font-size: 16px;">
      View Property →
    </a>
  `)

  const text = `
Hi ${data.userName},

A property you're watching has dropped in price!

${data.propertyAddress}, ${data.propertyPostcode}
Was: £${formattedPrevPrice}
Now: £${formattedNewPrice}
Save: £${formattedChange} (${changePercent}% off)

View property: ${data.propertyUrl}
`

  return { subject, html, text }
}

// New listing alert template
export function newListingEmail(data: {
  userName: string
  searchName: string
  properties: Array<{
    address: string
    postcode: string
    price: number
    bedrooms?: number
    propertyType?: string
    url: string
  }>
  totalMatches: number
}): { subject: string; html: string; text: string } {
  const subject = `🆕 ${data.totalMatches} new ${data.totalMatches === 1 ? "property" : "properties"} matching "${data.searchName}"`

  const propertyCards = data.properties.slice(0, 5).map(p => `
    <div style="padding: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 12px;">
      <h4 style="margin: 0 0 4px 0; color: #0f172a; font-size: 16px;">${p.address}</h4>
      <p style="margin: 0 0 8px 0; color: #64748b; font-size: 14px;">
        ${p.postcode}${p.bedrooms ? ` · ${p.bedrooms} beds` : ""}${p.propertyType ? ` · ${p.propertyType}` : ""}
      </p>
      <p style="margin: 0; color: ${BRAND_COLOR}; font-size: 18px; font-weight: bold;">
        £${p.price.toLocaleString("en-GB")}
      </p>
    </div>
  `).join("")

  const html = emailWrapper(`
    <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 20px;">
      Hi ${data.userName},
    </h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      We found <strong>${data.totalMatches} new ${data.totalMatches === 1 ? "property" : "properties"}</strong> matching your saved search "<strong>${data.searchName}</strong>".
    </p>

    ${propertyCards}

    ${data.totalMatches > 5 ? `
      <p style="margin: 16px 0; color: #64748b; font-size: 14px;">
        + ${data.totalMatches - 5} more properties
      </p>
    ` : ""}

    <a href="https://hmohunter.co.uk" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500; font-size: 16px;">
      View All Matches →
    </a>
  `)

  const text = `
Hi ${data.userName},

We found ${data.totalMatches} new ${data.totalMatches === 1 ? "property" : "properties"} matching your saved search "${data.searchName}".

${data.properties.slice(0, 5).map(p =>
  `${p.address}, ${p.postcode} - £${p.price.toLocaleString("en-GB")}`
).join("\n")}

${data.totalMatches > 5 ? `+ ${data.totalMatches - 5} more properties\n` : ""}
View all: https://hmohunter.co.uk
`

  return { subject, html, text }
}

// Licence expiry warning template
export function licenceExpiryEmail(data: {
  userName: string
  properties: Array<{
    address: string
    postcode: string
    expiryDate: string
    daysUntilExpiry: number
    url: string
  }>
}): { subject: string; html: string; text: string } {
  const urgentCount = data.properties.filter(p => p.daysUntilExpiry <= 30).length
  const subject = urgentCount > 0
    ? `⚠️ ${urgentCount} HMO licence${urgentCount > 1 ? "s" : ""} expiring soon`
    : `📋 HMO licence expiry reminder`

  const propertyRows = data.properties.map(p => {
    const isUrgent = p.daysUntilExpiry <= 30
    const bgColor = isUrgent ? "#fef2f2" : "#f8fafc"
    const textColor = isUrgent ? "#dc2626" : "#64748b"

    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #0f172a;">${p.address}</strong><br>
          <span style="color: #64748b; font-size: 14px;">${p.postcode}</span>
        </td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; background-color: ${bgColor};">
          <span style="color: ${textColor}; font-weight: 500;">${p.expiryDate}</span><br>
          <span style="color: ${textColor}; font-size: 12px;">${p.daysUntilExpiry} days</span>
        </td>
      </tr>
    `
  }).join("")

  const html = emailWrapper(`
    <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 20px;">
      Hi ${data.userName},
    </h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      The following HMO licences in your watchlist are expiring soon:
    </p>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background-color: #f1f5f9;">
          <th style="padding: 12px; text-align: left; font-weight: 500; color: #475569; font-size: 14px;">Property</th>
          <th style="padding: 12px; text-align: right; font-weight: 500; color: #475569; font-size: 14px;">Expires</th>
        </tr>
      </thead>
      <tbody>
        ${propertyRows}
      </tbody>
    </table>

    <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px;">
      Properties with expiring licences may represent motivated seller opportunities.
    </p>

    <a href="https://hmohunter.co.uk" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500; font-size: 16px;">
      View Properties →
    </a>
  `)

  const text = `
Hi ${data.userName},

The following HMO licences in your watchlist are expiring soon:

${data.properties.map(p =>
  `${p.address}, ${p.postcode} - Expires: ${p.expiryDate} (${p.daysUntilExpiry} days)`
).join("\n")}

View properties: https://hmohunter.co.uk
`

  return { subject, html, text }
}

// Welcome email template
export function welcomeEmail(data: {
  userName: string
}): { subject: string; html: string; text: string } {
  const subject = "Welcome to HMO Hunter! 🏠"

  const html = emailWrapper(`
    <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 20px;">
      Welcome to HMO Hunter, ${data.userName}!
    </h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      Thank you for signing up. You now have access to the UK's most comprehensive HMO property database.
    </p>

    <h3 style="margin: 24px 0 16px 0; color: #0f172a; font-size: 16px;">Here's what you can do:</h3>

    <ul style="margin: 0 0 24px 0; padding-left: 20px; color: #475569; line-height: 1.8;">
      <li>Browse licensed HMOs across major UK cities</li>
      <li>Filter by EPC rating, bedrooms, Article 4 areas</li>
      <li>Save properties to your watchlist</li>
      <li>Set up price alerts for properties you're interested in</li>
      <li>Access owner and contact data (Pro)</li>
    </ul>

    <a href="https://hmohunter.co.uk" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500; font-size: 16px;">
      Start Exploring →
    </a>

    <p style="margin: 24px 0 0 0; color: #64748b; font-size: 14px;">
      Questions? Reply to this email or visit our <a href="https://hmohunter.co.uk/faq" style="color: ${BRAND_COLOR};">FAQ page</a>.
    </p>
  `)

  const text = `
Welcome to HMO Hunter, ${data.userName}!

Thank you for signing up. You now have access to the UK's most comprehensive HMO property database.

Here's what you can do:
- Browse licensed HMOs across major UK cities
- Filter by EPC rating, bedrooms, Article 4 areas
- Save properties to your watchlist
- Set up price alerts for properties you're interested in
- Access owner and contact data (Pro)

Start exploring: https://hmohunter.co.uk

Questions? Reply to this email or visit our FAQ page.
`

  return { subject, html, text }
}

// Low credits warning email
export function lowCreditsEmail(data: {
  userName: string
  remainingCredits: number
  totalCredits: number
}): { subject: string; html: string; text: string } {
  const subject = `⚠️ You have ${data.remainingCredits} credits remaining`

  const html = emailWrapper(`
    <h2 style="margin: 0 0 20px 0; color: #0f172a; font-size: 20px;">
      Hi ${data.userName},
    </h2>
    <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
      You're running low on credits for today.
    </p>

    <div style="background-color: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>${data.remainingCredits}</strong> of <strong>${data.totalCredits}</strong> daily credits remaining
      </p>
      <div style="margin-top: 12px; background-color: #fde68a; border-radius: 4px; height: 8px;">
        <div style="background-color: #f59e0b; border-radius: 4px; height: 8px; width: ${(data.remainingCredits / data.totalCredits) * 100}%;"></div>
      </div>
    </div>

    <p style="margin: 0 0 20px 0; color: #64748b; font-size: 14px;">
      Your credits reset at midnight UTC. Upgrade to Pro for more daily credits and premium features.
    </p>

    <a href="https://hmohunter.co.uk/pricing" style="display: inline-block; background-color: ${BRAND_COLOR}; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 500; font-size: 16px;">
      Upgrade to Pro →
    </a>
  `)

  const text = `
Hi ${data.userName},

You're running low on credits for today.

${data.remainingCredits} of ${data.totalCredits} daily credits remaining.

Your credits reset at midnight UTC. Upgrade to Pro for more daily credits and premium features.

Upgrade: https://hmohunter.co.uk/pricing
`

  return { subject, html, text }
}
