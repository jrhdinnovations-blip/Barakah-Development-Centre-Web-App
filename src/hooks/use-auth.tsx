import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserAndRole() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        // Fetch all roles for user from user_roles
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        const SUPER_ADMINS = ['barakahdevcentre@gmail.com', 'barakahdevelopmentcentre@gmail.com'];
        const email = user.email?.toLowerCase() || '';

        const userRoles = (roleRows || []).map((r: any) => r.role);
        const metaRole = user.user_metadata?.['role'] as string | undefined;
        if (metaRole && !userRoles.includes(metaRole)) userRoles.push(metaRole);
        const riderCat = (user.user_metadata?.['rider_category'] || user.user_metadata?.['category']) as string | undefined;
        if (riderCat && !userRoles.includes(riderCat)) userRoles.push(riderCat);

        // Check if user is in drivers or active_drivers
        if (!userRoles.includes('driver') && !userRoles.includes('dispatch_rider')) {
          try {
            const { data: drv } = await supabase
              .from('active_drivers')
              .select('driver_id')
              .eq('driver_id', user.id)
              .maybeSingle();
            if (drv?.driver_id) userRoles.push('driver');
          } catch {}
          try {
            const { data: dRow } = await supabase
              .from('drivers')
              .select('id')
              .or(`user_id.eq.${user.id},id.eq.${user.id}`)
              .maybeSingle();
            if (dRow?.id) userRoles.push('driver');
          } catch {}
        }

        if (SUPER_ADMINS.includes(email) && !userRoles.includes('administrator')) {
          userRoles.push('administrator');
        }

        setRoles(userRoles);

        // If user explicitly has driver/rider metadata or category, prioritize driver identity
        if (metaRole === 'driver' || metaRole === 'dispatch_rider') {
          setRole(metaRole);
        } else if (riderCat === 'dispatch_rider') {
          setRole('dispatch_rider');
        } else if (riderCat === 'driver') {
          setRole('driver');
        } else if (userRoles.includes('driver') || userRoles.includes('dispatch_rider')) {
          setRole(userRoles.includes('dispatch_rider') ? 'dispatch_rider' : 'driver');
        } else if (SUPER_ADMINS.includes(email)) {
          setRole('administrator');
        } else {
          const PRIORITY = [
            'administrator',
            'admin',
            'swift_manager',
            'swift_dispatcher',
            'dispatcher',
            'driver',
            'dispatch_rider',
            'programme_officer',
            'content_editor',
            'staff',
            'registered_user',
          ];
          const effectiveRole = PRIORITY.find(r => userRoles.includes(r)) ?? userRoles[0] ?? 'registered_user';
          setRole(effectiveRole);
        }
      } else {
        setRole(null);
        setRoles([]);
      }
      setLoading(false);
    }

    fetchUserAndRole();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        const SUPER_ADMINS = ['barakahdevcentre@gmail.com', 'barakahdevelopmentcentre@gmail.com'];
        const email = currentUser.email?.toLowerCase() || '';

        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUser.id);
        
        const userRoles = (roleRows || []).map((r: any) => r.role);
        const metaRole = currentUser.user_metadata?.['role'] as string | undefined;
        if (metaRole && !userRoles.includes(metaRole)) userRoles.push(metaRole);
        const riderCat = (currentUser.user_metadata?.['rider_category'] || currentUser.user_metadata?.['category']) as string | undefined;
        if (riderCat && !userRoles.includes(riderCat)) userRoles.push(riderCat);

        if (!userRoles.includes('driver') && !userRoles.includes('dispatch_rider')) {
          try {
            const { data: drv } = await supabase
              .from('active_drivers')
              .select('driver_id')
              .eq('driver_id', currentUser.id)
              .maybeSingle();
            if (drv?.driver_id) userRoles.push('driver');
          } catch {}
          try {
            const { data: dRow } = await supabase
              .from('drivers')
              .select('id')
              .or(`user_id.eq.${currentUser.id},id.eq.${currentUser.id}`)
              .maybeSingle();
            if (dRow?.id) userRoles.push('driver');
          } catch {}
        }

        if (SUPER_ADMINS.includes(email) && !userRoles.includes('administrator')) {
          userRoles.push('administrator');
        }

        setRoles(userRoles);

        if (metaRole === 'driver' || metaRole === 'dispatch_rider') {
          setRole(metaRole);
        } else if (riderCat === 'dispatch_rider') {
          setRole('dispatch_rider');
        } else if (riderCat === 'driver') {
          setRole('driver');
        } else if (userRoles.includes('driver') || userRoles.includes('dispatch_rider')) {
          setRole(userRoles.includes('dispatch_rider') ? 'dispatch_rider' : 'driver');
        } else if (SUPER_ADMINS.includes(email)) {
          setRole('administrator');
        } else {
          const PRIORITY = [
            'administrator',
            'admin',
            'swift_manager',
            'swift_dispatcher',
            'dispatcher',
            'driver',
            'dispatch_rider',
            'programme_officer',
            'content_editor',
            'staff',
            'registered_user',
          ];
          const effectiveRole = PRIORITY.find(r => userRoles.includes(r)) ?? userRoles[0] ?? 'registered_user';
          setRole(effectiveRole);
        }
      } else {
        setRole(null);
        setRoles([]);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, role, roles, loading, isAuthenticated: !!user, logout: signOut, signOut };
}

