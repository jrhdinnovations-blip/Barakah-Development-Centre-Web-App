import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
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
        
        const roles = (roleRows || []).map((r: any) => r.role);
        const metaRole = user.user_metadata?.['role'] as string | undefined;
        if (metaRole && !roles.includes(metaRole)) roles.push(metaRole);

        // Prioritize specific privileges over default registered_user
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
        const effectiveRole = PRIORITY.find(r => roles.includes(r)) ?? roles[0] ?? 'registered_user';
        setRole(effectiveRole);
      } else {
        setRole(null);
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
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUser.id);
        
        const roles = (roleRows || []).map((r: any) => r.role);
        const metaRole = currentUser.user_metadata?.['role'] as string | undefined;
        if (metaRole && !roles.includes(metaRole)) roles.push(metaRole);

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
        const effectiveRole = PRIORITY.find(r => roles.includes(r)) ?? roles[0] ?? 'registered_user';
        setRole(effectiveRole);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, role, loading, isAuthenticated: !!user, logout: signOut, signOut };
}

