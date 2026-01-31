import { NextResponse } from "next/server"
import { z, ZodError, ZodSchema } from "zod"

/**
 * Validation result type
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: NextResponse }

/**
 * Validate request body against a Zod schema
 * Returns validated data or a NextResponse with error details
 */
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  try {
    const body = await request.json()
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: NextResponse.json(
          {
            error: "Validation failed",
            details: error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      }
    }

    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: NextResponse.json(
          { error: "Invalid JSON in request body" },
          { status: 400 }
        ),
      }
    }

    return {
      success: false,
      error: NextResponse.json(
        { error: "Failed to parse request body" },
        { status: 400 }
      ),
    }
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): ValidationResult<T> {
  try {
    const params: Record<string, string | string[]> = {}

    searchParams.forEach((value, key) => {
      const existing = params[key]
      if (existing) {
        params[key] = Array.isArray(existing)
          ? [...existing, value]
          : [existing, value]
      } else {
        params[key] = value
      }
    })

    const data = schema.parse(params)
    return { success: true, data }
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        success: false,
        error: NextResponse.json(
          {
            error: "Invalid query parameters",
            details: error.errors.map((e) => ({
              field: e.path.join("."),
              message: e.message,
            })),
          },
          { status: 400 }
        ),
      }
    }

    return {
      success: false,
      error: NextResponse.json(
        { error: "Failed to parse query parameters" },
        { status: 400 }
      ),
    }
  }
}

/**
 * Sanitize string input - remove potential XSS vectors
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove angle brackets
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+=/gi, "") // Remove event handlers
    .trim()
}

/**
 * Sanitize object - recursively sanitize all string values
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === "string" ? sanitizeString(item) : item
      )
    } else if (value && typeof value === "object") {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized as T
}
