import { redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';

export const SUPER_ADMIN_EMAILS = [
  'barakahdevcentre@gmail.com',
  'barakahdevelopmentcentre@gmail.com',
];

export const ADMIN_ROLES = ['administrator', 'admin', 'swift_manager'];

/**
 * Standard client-side beforeLoad authorization for Admin routes.
 * Handles:
 * - Super admin emails
 * - Multiple roles in user_roles (avoids maybeSingle crashes)
 * - User metadata role fallbacks
 */
export async function requireAdminRouteAccess(
  allowedRoles: string[] = ADMIN_ROLES,
  redirectTo = '/my-swift-move'
) {
  try {
    const { data, error } = await supabase.auth.getUser();
    const user = data?.user;
    if (error || !user) {
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }

    const email = user.email?.toLowerCase();
    if (email && SUPER_ADMIN_EMAILS.includes(email)) {
      return { user, isSuperAdmin: true, roles: ['administrator'] };
    }

    const metaRole = user.user_metadata?.['role'] as string | undefined;
    if (metaRole && (allowedRoles.includes(metaRole) || ADMIN_ROLES.includes(metaRole))) {
      return { user, isSuperAdmin: false, roles: [metaRole] };
    }

    // Query user_roles safely without maybeSingle
    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const roles = (roleRows || []).map((r: any) => r.role);
    if (metaRole && !roles.includes(metaRole)) {
      roles.push(metaRole);
    }

    const hasAccess = roles.some((r: string) => allowedRoles.includes(r) || ADMIN_ROLES.includes(r));
    if (!hasAccess) {
      throw redirect({ to: redirectTo as any });
    }

    return { user, isSuperAdmin: false, roles };
  } catch (err: any) {
    if (err?.isRedirect || err?.to || err?.statusCode) throw err;
    throw redirect({ to: '/auth', search: { mode: 'login' } });
  }
}
