// ══════════════════════════════════════════════════════════════════════════════
// SHARED UTILITY: Partner API Authentication
// ══════════════════════════════════════════════════════════════════════════════
// Extracts Bearer token from Authorization header, calls validate_api_key() RPC,
// checks required permission. Returns auth result for use in partner API endpoints.
// ══════════════════════════════════════════════════════════════════════════════

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface ApiAuthResult {
  valid: boolean
  clientId: string | null
  clientName: string | null
  isSandbox: boolean
  error: string | null
  statusCode: number
}

/**
 * Validates a partner API request by extracting the Bearer token,
 * calling validate_api_key() RPC, and checking the required permission.
 *
 * @param req         - The incoming Request object
 * @param supabase    - A Supabase client initialized with the service role key
 * @param permission  - The permission string required (e.g. 'cases.create', 'honor.read')
 * @returns ApiAuthResult with validation status and client details
 */
export async function validateApiRequest(
  req: Request,
  supabase: SupabaseClient,
  permission: string
): Promise<ApiAuthResult> {
  // Extract Bearer token from Authorization header
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')

  if (!authHeader) {
    return {
      valid: false,
      clientId: null,
      clientName: null,
      isSandbox: false,
      error: 'Missing Authorization header',
      statusCode: 401,
    }
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      clientId: null,
      clientName: null,
      isSandbox: false,
      error: 'Authorization header must use Bearer scheme',
      statusCode: 401,
    }
  }

  const apiKey = authHeader.replace('Bearer ', '')

  if (!apiKey || apiKey.trim().length === 0) {
    return {
      valid: false,
      clientId: null,
      clientName: null,
      isSandbox: false,
      error: 'Empty API key',
      statusCode: 401,
    }
  }

  // Validate the API key via RPC
  const { data, error } = await supabase.rpc('validate_api_key', {
    p_api_key: apiKey,
  })

  if (error) {
    console.error('validate_api_key RPC error:', error.message)
    return {
      valid: false,
      clientId: null,
      clientName: null,
      isSandbox: false,
      error: 'API key validation failed',
      statusCode: 500,
    }
  }

  if (!data || data.length === 0) {
    return {
      valid: false,
      clientId: null,
      clientName: null,
      isSandbox: false,
      error: 'Invalid or inactive API key',
      statusCode: 401,
    }
  }

  const client = data[0]

  // Check that the client has the required permission
  const permissions: string[] = client.permissions || []

  if (!permissions.includes(permission)) {
    return {
      valid: false,
      clientId: client.client_id,
      clientName: client.client_name,
      isSandbox: client.is_sandbox,
      error: `Missing required permission: ${permission}`,
      statusCode: 403,
    }
  }

  return {
    valid: true,
    clientId: client.client_id,
    clientName: client.client_name,
    isSandbox: client.is_sandbox,
    error: null,
    statusCode: 200,
  }
}
