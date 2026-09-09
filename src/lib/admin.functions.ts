import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string, user?: any) {
  if (user?.user_metadata?.role === "administrator") return;

  try {
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "administrator",
    });
    if (!error && isAdmin) return;
  } catch {}

  try {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("status", "active");
    if (roles?.some((r: any) => r.role === "administrator")) return;
  } catch {}

  throw new Error("Forbidden");
}

async function requireAdminOrManager(supabase: any, userId: string, user?: any) {
  const metaRole = user?.user_metadata?.role;
  if (metaRole === "administrator" || metaRole === "swift_manager") return;

  try {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("status", "active");
    const roleList = (roles || []).map((r: any) => r.role);
    if (roleList.includes("administrator") || roleList.includes("swift_manager")) return;
  } catch {}

  throw new Error("Forbidden: Administrator or Manager access required");
}

async function requireAuthorizedToCreateUser(
  supabase: any,
  userId: string,
  targetRole: string,
  user?: any
) {
  const metaRole = user?.user_metadata?.role;
  if (metaRole === "administrator") return;
  if (targetRole === "driver" && (metaRole === "swift_manager" || metaRole === "swift_dispatcher")) {
    return;
  }

  // Check database user_roles table
  try {
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("status", "active");
    const roleList = (roles || []).map((r: any) => r.role);
    if (roleList.includes("administrator")) return;
    if (targetRole === "driver" && (roleList.includes("swift_manager") || roleList.includes("swift_dispatcher"))) {
      return;
    }
  } catch {}

  // Also check RPCs
  if (targetRole === "driver") {
    try {
      const { data: isSwift } = await supabase.rpc("is_swift_staff", { _user_id: userId });
      if (isSwift) return;
    } catch {}
  }

  try {
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "administrator",
    });
    if (isAdmin) return;
  } catch {}

  throw new Error("Forbidden");
}

export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, user } = context;
    await requireAdmin(supabase, userId, user);
    const [users, pages] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("pages")
        .select("id", { count: "exact", head: true })
        .eq("status", "published"),
    ]);
    return {
      userCount: users.count ?? 0,
      publishedPages: pages.count ?? 0,
    };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, user } = context;
    await requireAdmin(supabase, userId, user);
    const [profiles, roles] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, phone, location, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    const roleMap = new Map<string, string[]>();
    for (const r of roles.data ?? []) {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    }
    return (profiles.data ?? []).map((p) => ({ ...p, roles: roleMap.get(p.user_id) ?? [] }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["registered_user", "administrator", "programme_officer", "content_editor"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, user } = context;
    await requireAdmin(supabase, userId, user);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
    }
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: data.grant ? "role.grant" : "role.revoke",
      entity_type: "user_roles",
      metadata: { target_user: data.userId, role: data.role },
    });
    return { ok: true };
  });

export const createUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().min(1),
        phone: z.string().optional(),
        vehicle_type: z.string().optional(),
        vehicle_make: z.string().optional(),
        plate_number: z.string().optional(),
        vehicle_color: z.string().optional(),
        rider_category: z.enum(["dispatch_rider", "driver"]).optional(),
        role: z.enum([
          "registered_user",
          "administrator",
          "driver",
          "swift_manager",
          "swift_dispatcher",
          "programme_officer",
          "content_editor",
          "staff",
        ]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, user } = context;
    await requireAuthorizedToCreateUser(supabase, userId, data.role, user);

    const { hasServiceRoleKey, supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let newUserId: string;

    const category = data.rider_category || (data.vehicle_type && /car|sedan|suv|van|bus/i.test(data.vehicle_type) ? "driver" : "dispatch_rider");
    const vType = data.vehicle_type || (category === "driver" ? "Sedan" : "Motorcycle");
    const vMake = data.vehicle_make || "";
    const vPlate = data.plate_number || "";
    const vColor = data.vehicle_color || "";

    if (hasServiceRoleKey) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.full_name,
          phone: data.phone,
          role: data.role,
          rider_category: category,
          vehicle_type: vType,
          vehicle_make: vMake,
          plate_number: vPlate,
          vehicle_color: vColor,
        },
      });

      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error("Failed to create user");

      newUserId = authData.user.id;

      // Insert into user_roles
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newUserId, role: data.role as any, status: "active" }, { onConflict: "user_id,role" })
        .then(() => {});

      // Insert into profiles
      await supabaseAdmin
        .from("profiles")
        .upsert({ user_id: newUserId, full_name: data.full_name, phone: data.phone }, { onConflict: "user_id" })
        .then(() => {});

      if (data.role === "driver") {
        // Insert into active_drivers so rider shows as "active" immediately
        await supabaseAdmin
          .from("active_drivers")
          .upsert({
            driver_id: newUserId,
            status: "available",
            vehicle_type: `${vColor ? vColor + ' ' : ''}${vMake || vType}${vPlate ? ' (' + vPlate + ')' : ''}`,
          }, { onConflict: "driver_id" })
          .then(() => {});
      }

      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId,
        action: "user.create",
        entity_type: "auth.users",
        metadata: { target_user: newUserId, role: data.role, email: data.email },
      }).then(() => {});
    } else {
      // Create user using isolated client without persisting session
      const { sanitizeSupabaseUrl, sanitizeSupabaseKey } = await import("@/integrations/supabase/client");
      const url = sanitizeSupabaseUrl(process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]);
      const key = sanitizeSupabaseKey(process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);

      const isolatedClient = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data: signUpData, error: signUpError } = await isolatedClient.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            phone: data.phone,
            role: data.role,
            rider_category: category,
            vehicle_type: vType,
            vehicle_make: vMake,
            plate_number: vPlate,
            vehicle_color: vColor,
            consent_given: true,
          },
        },
      });

      if (signUpError) throw new Error(signUpError.message);
      if (!signUpData.user) throw new Error("Failed to create user");

      newUserId = signUpData.user.id;

      // Ensure profile and driver records exist via authenticated client
      try {
        await supabase.from("profiles").upsert({
          user_id: newUserId,
          full_name: data.full_name,
          phone: data.phone,
        } as any, { onConflict: "user_id" });
      } catch {}

      if (data.role === "driver") {
        try {
          await supabase.from("drivers").upsert({
            user_id: newUserId,
            full_name: data.full_name,
            phone: data.phone || "",
            email: data.email,
            status: "active" as any,
          } as any, { onConflict: "user_id" });
        } catch {}

        // Insert into active_drivers so rider shows as "active" immediately
        try {
          await supabase.from("active_drivers").upsert({
            driver_id: newUserId,
            status: "available",
          } as any, { onConflict: "driver_id" });
        } catch {}
      }
    }

    return { ok: true, userId: newUserId };
  });

export const createStaffAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6),
        full_name: z.string().min(1),
        phone: z.string().optional().nullable(),
        recovery_email: z.string().optional().nullable(),
        role: z.string().default("staff"),
        department: z.string().optional().nullable(),
        designation: z.string().optional().nullable(),
        branch: z.string().optional().nullable(),
        employee_id: z.string().optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, user } = context;
    const metaRole = user?.user_metadata?.['role'] as string | undefined;
    let isAllowed = metaRole === "administrator" || metaRole === "swift_manager";
    if (!isAllowed) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("status", "active");
      const roleList = (roles || []).map((r: any) => r.role);
      isAllowed = roleList.includes("administrator") || roleList.includes("swift_manager");
    }
    if (!isAllowed) throw new Error("Forbidden: Only administrators and managers can add staff");

    const { hasServiceRoleKey, supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!hasServiceRoleKey) {
      throw new Error("Server configuration error: Service role key is missing.");
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.full_name,
        phone: data.phone || null,
        recovery_email: data.recovery_email || null,
        role: data.role,
        department: data.department || null,
        designation: data.designation || null,
        branch: data.branch || null,
        employee_id: data.employee_id || null,
      },
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Failed to create staff account");

    const newUserId = authData.user.id;

    // Profiles: only insert columns that exist in DB (user_id, full_name, phone)
    await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          user_id: newUserId,
          full_name: data.full_name,
          phone: data.phone || null,
        },
        { onConflict: "user_id" }
      );

    // User Roles: insert staff role if allowed by DB enum
    try {
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          {
            user_id: newUserId,
            role: data.role as any,
            status: "active",
          },
          { onConflict: "user_id,role" }
        );
    } catch {}

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "staff.create",
      entity_type: "auth.users",
      metadata: { target_user: newUserId, role: data.role, email: data.email },
    }).then(() => {});

    return {
      ok: true,
      userId: newUserId,
      email: authData.user.email,
    };
  });

export const getStaffMembersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, user } = context;
    const metaRole = user?.user_metadata?.['role'] as string | undefined;
    let isAllowed = metaRole === "administrator" || metaRole === "swift_manager";
    if (!isAllowed) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("status", "active");
      const roleList = (roles || []).map((r: any) => r.role);
      isAllowed = roleList.includes("administrator") || roleList.includes("swift_manager");
    }
    if (!isAllowed) throw new Error("Forbidden");

    const { hasServiceRoleKey, supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const STAFF_ROLES = [
      'administrator',
      'programme_officer',
      'content_editor',
      'swift_dispatcher',
      'swift_manager',
      'staff',
    ];

    if (hasServiceRoleKey) {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw new Error(error.message);

      const [profilesData, rolesData] = await Promise.all([
        supabaseAdmin.from("profiles").select("*"),
        supabaseAdmin.from("user_roles").select("*"),
      ]);

      const profiles = profilesData.data || [];
      const roles = rolesData.data || [];

      const staffList = (users || [])
        .filter((u: any) => {
          const uMetaRole = u.user_metadata?.['role'];
          const userRoleRows = roles.filter((r: any) => r.user_id === u.id);
          const hasStaffDbRole = userRoleRows.some((r: any) => STAFF_ROLES.includes(r.role));
          const hasStaffMetaRole = STAFF_ROLES.includes(uMetaRole);
          return hasStaffDbRole || hasStaffMetaRole;
        })
        .map((u: any) => {
          const profile = profiles.find((p: any) => p.user_id === u.id);
          const userRoleRow = roles.find((r: any) => r.user_id === u.id && STAFF_ROLES.includes(r.role));
          const role = userRoleRow?.role || u.user_metadata?.['role'] || 'staff';
          return {
            user_id: u.id,
            full_name: (u.user_metadata?.['full_name'] as string | undefined) || profile?.full_name || 'Unnamed Staff',
            email: u.email || 'N/A',
            phone: (u.user_metadata?.['phone'] as string | undefined) || profile?.phone || null,
            department: (u.user_metadata?.['department'] as string | undefined) || (profile as any)?.department || null,
            designation: (u.user_metadata?.['designation'] as string | undefined) || (profile as any)?.designation || null,
            branch: (u.user_metadata?.['branch'] as string | undefined) || (profile as any)?.branch || null,
            employee_id: (u.user_metadata?.['employee_id'] as string | undefined) || null,
            role,
            created_at: u.created_at,
            status: (profile?.status as string) || 'active',
          };
        })
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return staffList;
    }

    return [];
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        newPassword: z.string().min(6),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, user } = context;
    const metaRole = user?.user_metadata?.['role'] as string | undefined;
    let isAllowed = metaRole === "administrator" || metaRole === "swift_manager";
    if (!isAllowed) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("status", "active");
      const roleList = (roles || []).map((r: any) => r.role);
      isAllowed = roleList.includes("administrator") || roleList.includes("swift_manager");
    }
    if (!isAllowed) throw new Error("Forbidden");

    const { hasServiceRoleKey, supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!hasServiceRoleKey) throw new Error("Service role key is required to reset passwords.");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
      password: data.newPassword,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "user.password_reset",
      entity_type: "auth.users",
      metadata: { target_user: data.targetUserId },
    }).then(() => {});

    return { ok: true };
  });


export const getAllRidersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, user } = context;
    const metaRole = user?.user_metadata?.['role'] as string | undefined;
    let isAllowed = metaRole === "administrator" || metaRole === "swift_manager" || metaRole === "swift_dispatcher";
    if (!isAllowed) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("status", "active");
      const roleList = (roles || []).map((r: any) => r.role);
      isAllowed = roleList.includes("administrator") || roleList.includes("swift_manager") || roleList.includes("swift_dispatcher");
    }
    if (!isAllowed) throw new Error("Forbidden");

    const { hasServiceRoleKey, supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Get driver user_ids
    const client = hasServiceRoleKey ? supabaseAdmin : supabase;
    const { data: driverRoles } = await client.from("user_roles").select("user_id").eq("role", "driver");
    const driverIds = (driverRoles || []).map((r: any) => r.user_id);
    if (driverIds.length === 0) return [];

    // 2. Fetch profiles and active_drivers
    const [profilesRes, activeRes] = await Promise.all([
      client.from("profiles").select("*").in("user_id", driverIds).order("created_at", { ascending: false }),
      client.from("active_drivers").select("*"),
    ]);

    const profiles = profilesRes.data || [];
    const activeDrvs = activeRes.data || [];

    // 3. User metadata & emails from auth.users (via admin API)
    const userMetaMap = new Map<string, {
      email: string;
      category: "dispatch_rider" | "driver";
      vehicle_type: string;
      vehicle_make: string;
      plate_number: string;
      vehicle_color: string;
    }>();
    if (hasServiceRoleKey) {
      try {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        for (const u of users || []) {
          const rawCat = u.user_metadata?.['rider_category'] as string | undefined;
          const rawVehicleType = (u.user_metadata?.['vehicle_type'] as string | undefined) || "";
          const rawVehicleMake = (u.user_metadata?.['vehicle_make'] as string | undefined) || "";
          const rawPlateNumber = (u.user_metadata?.['plate_number'] as string | undefined) || "";
          const rawVehicleColor = (u.user_metadata?.['vehicle_color'] as string | undefined) || "";
          let category: "dispatch_rider" | "driver" = "dispatch_rider";
          if (rawCat === "driver" || rawCat === "dispatch_rider") {
            category = rawCat;
          } else if (rawVehicleType || rawVehicleMake) {
            const vLower = (rawVehicleType + " " + rawVehicleMake).toLowerCase();
            if (vLower.includes("car") || vLower.includes("sedan") || vLower.includes("suv") || vLower.includes("van") || vLower.includes("bus") || vLower.includes("truck")) {
              category = "driver";
            } else {
              category = "dispatch_rider";
            }
          }
          userMetaMap.set(u.id, {
            email: u.email || "N/A",
            category,
            vehicle_type: rawVehicleType,
            vehicle_make: rawVehicleMake,
            plate_number: rawPlateNumber,
            vehicle_color: rawVehicleColor,
          });
        }
      } catch {}
    }

    return profiles.map((p: any) => {
      const active = activeDrvs.find((a: any) => a.driver_id === p.user_id);
      const meta = userMetaMap.get(p.user_id);
      const isActive = active?.status === "available" || p.status === "active";
      
      let category: "dispatch_rider" | "driver" = meta?.category || "dispatch_rider";
      let vehicleType = meta?.vehicle_type || (active as any)?.vehicle_type || "";
      if (!vehicleType) {
        vehicleType = category === "driver" ? "Sedan" : "Motorcycle";
      }

      return {
        id: p.user_id,
        user_id: p.user_id,
        full_name: p.full_name || "Unnamed Personnel",
        phone: p.phone || "N/A",
        email: meta?.email || "N/A",
        category,
        vehicle_type: vehicleType,
        vehicle_make: meta?.vehicle_make || "",
        plate_number: meta?.plate_number || "",
        vehicle_color: meta?.vehicle_color || "",
        location: p.location || "Location Unknown",
        status: isActive ? "active" : "offline",
        created_at: p.created_at,
      };
    });
  });

export const updateRiderRoleCategoryAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        category: z.enum(["dispatch_rider", "driver"]),
        vehicleType: z.string().optional(),
        vehicleMake: z.string().optional(),
        plateNumber: z.string().optional(),
        vehicleColor: z.string().optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, user } = context;
    const metaRole = user?.user_metadata?.['role'] as string | undefined;
    let isAllowed = metaRole === "administrator" || metaRole === "swift_manager";
    if (!isAllowed) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("status", "active");
      const roleList = (roles || []).map((r: any) => r.role);
      isAllowed = roleList.includes("administrator") || roleList.includes("swift_manager");
    }
    if (!isAllowed) throw new Error("Forbidden");

    const { hasServiceRoleKey, supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = hasServiceRoleKey ? supabaseAdmin : supabase;

    const vType = data.vehicleType || (data.category === "dispatch_rider" ? "Motorcycle" : "Sedan");
    const vMake = data.vehicleMake || "";
    const vPlate = data.plateNumber || "";
    const vColor = data.vehicleColor || "";

    if (hasServiceRoleKey) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(data.targetUserId, {
          user_metadata: {
            rider_category: data.category,
            vehicle_type: vType,
            vehicle_make: vMake,
            plate_number: vPlate,
            vehicle_color: vColor,
          },
        });
      } catch (err) {
        console.warn("Error updating user_metadata in auth:", err);
      }
    }

    try {
      await (client.from("active_drivers") as any).upsert({
        driver_id: data.targetUserId,
        vehicle_type: `${vColor ? vColor + ' ' : ''}${vMake || vType}${vPlate ? ' (' + vPlate + ')' : ''}`,
        status: "available",
      }, { onConflict: "driver_id" });
    } catch (_) {}

    return {
      ok: true,
      category: data.category,
      vehicle_type: vType,
      vehicle_make: vMake,
      plate_number: vPlate,
      vehicle_color: vColor,
    };
  });

export const getAllUsersAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, user } = context;
    const metaRole = user?.user_metadata?.['role'] as string | undefined;
    let isAllowed = metaRole === "administrator" || metaRole === "swift_manager";
    if (!isAllowed) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("status", "active");
      const roleList = (roles || []).map((r: any) => r.role);
      isAllowed = roleList.includes("administrator") || roleList.includes("swift_manager");
    }
    if (!isAllowed) throw new Error("Forbidden");

    const { hasServiceRoleKey, supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (hasServiceRoleKey) {
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
      if (error) throw new Error(error.message);

      const [profilesData, rolesData] = await Promise.all([
        supabaseAdmin.from("profiles").select("*"),
        supabaseAdmin.from("user_roles").select("*"),
      ]);

      const profiles = profilesData.data || [];
      const roles = rolesData.data || [];

      const rolePriority: Record<string, number> = {
        administrator: 100,
        swift_manager: 90,
        swift_dispatcher: 80,
        dispatcher: 80,
        driver: 70,
        programme_officer: 60,
        content_editor: 50,
        staff: 40,
        registered_user: 10,
      };

      const userRoleMap = new Map<string, string>();
      for (const r of roles) {
        const currentBest = userRoleMap.get(r.user_id);
        const currentScore = currentBest ? (rolePriority[currentBest] ?? 0) : -1;
        const newScore = rolePriority[r.role] ?? 0;
        if (newScore > currentScore) {
          userRoleMap.set(r.user_id, r.role);
        }
      }

      return users.map(u => {
        const profile = profiles.find(p => p.user_id === u.id);
        const assignedRole = userRoleMap.get(u.id) || (u.user_metadata?.['role'] as string | undefined) || 'registered_user';
        return {
          user_id: u.id,
          full_name: profile?.full_name || (u.user_metadata?.['full_name'] as string | undefined) || 'Unnamed User',
          phone: profile?.phone || (u.user_metadata?.['phone'] as string | undefined) || null,
          location: profile?.location || null,
          email: u.email,
          role: assignedRole,
          created_at: u.created_at,
          status: profile?.status || 'active'
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      // Fallback: Query profiles and user_roles directly via authenticated client
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone, location, status, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const profiles = profilesRes.data || [];
      const roles = rolesRes.data || [];

      const rolePriority: Record<string, number> = {
        administrator: 100,
        swift_manager: 90,
        swift_dispatcher: 80,
        dispatcher: 80,
        driver: 70,
        programme_officer: 60,
        content_editor: 50,
        staff: 40,
        registered_user: 10,
      };

      const roleMap = new Map<string, string>();
      for (const r of roles) {
        const currentBest = roleMap.get(r.user_id);
        const currentScore = currentBest ? (rolePriority[currentBest] ?? 0) : -1;
        const newScore = rolePriority[r.role] ?? 0;
        if (newScore > currentScore) {
          roleMap.set(r.user_id, r.role);
        }
      }

      return profiles.map((p: any) => ({
        user_id: p.user_id,
        full_name: p.full_name || 'Unnamed User',
        phone: p.phone || null,
        location: p.location || null,
        email: 'N/A',
        role: roleMap.get(p.user_id) || 'registered_user',
        created_at: p.created_at,
        status: p.status || 'active',
      }));
    }
  });

const pageSchema = z.object({
  slug: z.string().trim().min(1).max(120).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(500).optional(),
  body: z.string().max(50000).optional(),
  status: z.enum(["draft", "review", "approved", "published", "archived"]),
});

export const listPages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, user } = context;
    await requireAdmin(supabase, userId, user);
    const { data } = await supabase
      .from("pages")
      .select("id, slug, title, status, updated_at")
      .order("updated_at", { ascending: false });
    return data ?? [];
  });

export const upsertPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    pageSchema.extend({ id: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, user } = context;
    await requireAdmin(supabase, userId, user);
    const { id, ...rest } = data;
    const fields = {
      slug: rest.slug,
      title: rest.title,
      status: rest.status,
      excerpt: rest.excerpt ?? null,
      body: rest.body ?? null,
    };
    if (id) {
      await supabase.from("pages").update(fields).eq("id", id);
    } else {
      await supabase.from("pages").insert({ ...fields, created_by: userId });
    }
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: id ? "page.update" : "page.create",
      entity_type: "pages",
      metadata: { slug: fields.slug, status: fields.status },
    });
    return { ok: true };
  });

export const updateUserRoleAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, user } = context;
    await requireAdminOrManager(supabase, userId, user);

    const { hasServiceRoleKey, supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!hasServiceRoleKey) throw new Error("Service role key required to update roles");

    // Standardize 'dispatcher' to 'swift_dispatcher'
    const normalizedRole = data.role === "dispatcher" ? "swift_dispatcher" : data.role;

    // 1. Delete competing roles for this user so they don't have multiple conflicting roles
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);

    // 2. Insert the target role
    const { error: insertErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: data.userId,
      role: normalizedRole as any,
      status: "active",
    });
    if (insertErr) throw new Error(insertErr.message);

    // 3. Update auth metadata so user.user_metadata has the new role
    try {
      const { data: targetUser } = await supabaseAdmin.auth.admin.getUserById(data.userId);
      if (targetUser?.user) {
        await supabaseAdmin.auth.admin.updateUserById(data.userId, {
          user_metadata: {
            ...targetUser.user.user_metadata,
            role: normalizedRole,
          },
        });
      }
    } catch (e) {
      console.warn("Failed to update auth metadata for role:", e);
    }

    // 4. Handle driver table if needed
    if (normalizedRole === "driver") {
      await supabaseAdmin.from("active_drivers").upsert(
        { driver_id: data.userId, status: "available" },
        { onConflict: "driver_id" }
      );
    } else {
      await supabaseAdmin.from("active_drivers").delete().eq("driver_id", data.userId);
    }

    // 5. Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "user.role_change",
      entity_type: "user_roles",
      metadata: { target_user: data.userId, new_role: normalizedRole },
    });

    return { ok: true, role: normalizedRole };
  });

