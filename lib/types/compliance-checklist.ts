/**
 * Compliance checks for an HMO you already own.
 *
 * Rescued from the `operator` profile when the role system was removed. That
 * profile served nobody — five accounts existed and not one had selected it —
 * but this list is the one part of it worth keeping, because the checks are
 * real regardless of who is doing them.
 *
 * It is not wired into anything yet, and deliberately so: the platform is for
 * sourcing and verifying properties to buy, and compliance begins after that.
 * When there is a post-purchase view to hang it on, it is already written.
 */
export const HMO_COMPLIANCE_CHECKS: { key: string; label: string }[] = [
  { key: "licence_displayed", label: "HMO licence displayed" },
  { key: "fire_alarms", label: "Fire alarms tested" },
  { key: "fire_doors", label: "Fire doors operational" },
  { key: "emergency_lighting", label: "Emergency lighting working" },
  { key: "gas_safety", label: "Gas safety certificate current" },
  { key: "electrical_cert", label: "Electrical certificate current" },
  { key: "epc_displayed", label: "EPC displayed" },
  { key: "tenant_satisfaction", label: "Tenant satisfaction checked" },
]

/**
 * Pipeline stages for tracking that compliance work, from the same profile.
 * Kept for the same reason and under the same caveat.
 */
export const HMO_COMPLIANCE_STAGES: { key: string; label: string }[] = [
  { key: "identified", label: "Identified" },
  { key: "compliance_check", label: "Compliance Check" },
  { key: "renewal_due", label: "Renewal Due" },
  { key: "in_progress", label: "In Progress" },
  { key: "compliant", label: "Compliant" },
  { key: "non_compliant", label: "Non-Compliant" },
]
