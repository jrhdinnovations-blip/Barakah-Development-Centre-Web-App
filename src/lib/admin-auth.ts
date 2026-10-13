import { redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';

export const SUPER_ADMIN_EMAILS = [
  'barakahdevcentre@gmail.com',
  'barakahdevelopmentcentre@gmail.com',
  'raymondlongdiem22@gmail.com',
];

export const ADMIN_ROLES = ['administrator', 'admin', 'swift_manager'];
export const DISPATCHER_ROLES = ['swift_dispatcher', 'dispatcher'];
export const DRIVER_ROLES = ['driver', 'dispatch_rider'];
export const STAFF_ROLES = ['staff', 'programme_officer', 'content_editor'];

/**
 * Determine the user's primary dedicated console URL based on roles.
 */
export function getConsoleForRoles(roles: string[]): string {
  if (roles.some((r) => ADMIN_ROLES.includes(r))) return '/admin';
  if (roles.some((r) => DISPATCHER_ROLES.includes(r))) return '/dispatcher';
  if (roles.some((r) => DRIVER_ROLES.includes(r))) return '/drive';
  if (roles.some((r) => STAFF_ROLES.includes(r))) return '/staff';
  return '/my-swift-move';
}

/**
 * Extract all roles for a Supabase user.
 */
export async function resolveUserRoles(user: any): Promise<{ roles: string[]; isSuperAdmin: boolean }> {
  if (!user) return { roles: ['registered_user'], isSuperAdmin: false };

  const email = user.email?.toLowerCase() || '';
  if (SUPER_ADMIN_EMAILS.includes(email)) {
    return { roles: ['administrator'], isSuperAdmin: true };
  }

  const roles: string[] = [];
  const metaRole = user.user_metadata?.['role'] as string | undefined;
  if (metaRole) roles.push(metaRole);
  const riderCat = user.user_metadata?.['rider_category'] as string | undefined;
  if (riderCat && !roles.includes(riderCat)) roles.push(riderCat);

  try {
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);
    (roleRows || []).forEach((r: any) => {
      if (r?.role && !roles.includes(r.role)) roles.push(r.role);
    });
  } catch {}

  // Also check active_drivers or drivers table to ensure registered riders are recognized
  if (!roles.includes('driver') && !roles.includes('dispatch_rider')) {
    try {
      const { data: drv } = await supabase
        .from('active_drivers')
        .select('driver_id')
        .eq('driver_id', user.id)
        .maybeSingle();
      if (drv?.driver_id) roles.push('driver');
    } catch {}
  }

  if (roles.length === 0) roles.push('registered_user');
  return { roles, isSuperAdmin: false };
}

/**
 * Standard client-side beforeLoad authorization for Admin routes.
 * Redirects unauthorized users to their own respective console.
 */
export async function requireAdminRouteAccess(
  allowedRoles: string[] = ADMIN_ROLES,
  customRedirect?: string
) {
  try {
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;
    if (error || !user) {
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }

    const { roles, isSuperAdmin } = await resolveUserRoles(user);
    if (isSuperAdmin) {
      return { user, isSuperAdmin: true, roles };
    }

    const hasAccess = roles.some((r: string) => allowedRoles.includes(r) || ADMIN_ROLES.includes(r));
    if (!hasAccess) {
      const target = customRedirect || getConsoleForRoles(roles);
      throw redirect({ to: target as any });
    }

    return { user, isSuperAdmin: false, roles };
  } catch (err: any) {
    if (err?.isRedirect || err?.to || err?.statusCode) throw err;
    throw redirect({ to: '/auth', search: { mode: 'login' } });
  }
}

/**
 * Enforce role-level access for any route.
 * Redirects unauthorized users to their own respective console.
 */
export async function requireRoleAccess(allowedRoles: string[]) {
  try {
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;
    if (error || !user) {
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }

    const { roles, isSuperAdmin } = await resolveUserRoles(user);
    if (isSuperAdmin) {
      return { user, isSuperAdmin: true, roles };
    }

    const hasAccess = roles.some((r: string) => allowedRoles.includes(r) || ADMIN_ROLES.includes(r));
    if (!hasAccess) {
      const target = getConsoleForRoles(roles);
      throw redirect({ to: target as any });
    }

    return { user, isSuperAdmin: false, roles };
  } catch (err: any) {
    if (err?.isRedirect || err?.to || err?.statusCode) throw err;
    throw redirect({ to: '/auth', search: { mode: 'login' } });
  }
}

