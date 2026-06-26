import { describe, it, expect, vi } from 'vitest'

// Supabase auth uses profile.role — test helper
function isAdminRole(role?: string): boolean {
  return role === 'super_admin' || role === 'company_admin'
}

describe('isAdminRole', () => {
  it('returns true for super_admin', () => {
    expect(isAdminRole('super_admin')).toBe(true)
  })
  it('returns true for company_admin', () => {
    expect(isAdminRole('company_admin')).toBe(true)
  })
  it('returns false for hr_manager', () => {
    expect(isAdminRole('hr_manager')).toBe(false)
  })
  it('returns false for employee', () => {
    expect(isAdminRole('employee')).toBe(false)
  })
  it('returns false for undefined', () => {
    expect(isAdminRole(undefined)).toBe(false)
  })
})
