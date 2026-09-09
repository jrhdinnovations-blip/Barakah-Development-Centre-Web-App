import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  audit,
  bookingCreateSchema,
  bookingStatusSchema,
  notifyUserFromTemplate,
  requireStaff,
  serviceSchema,
  slotSchema,
  uuid,
} from "./staff.server";

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const { sanitizeSupabaseUrl, sanitizeSupabaseKey } = await import("@/integrations/supabase/client");
  const key = sanitizeSupabaseKey(process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]);
  const url = sanitizeSupabaseUrl(process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"]);
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listBookingServices = createServerFn({ method: "GET" }).handler(async () => {
  const pub = await publicClient();
  const { data } = await pub
    .from("booking_services")
    .select("id, title, description, category, duration_minutes")
    .eq("status", "active")
    .order("title");
  return data ?? [];
});

export const listOpenSlots = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ serviceId: uuid.optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const pub = await publicClient();
    let q = pub
      .from("booking_slots")
      .select("id, starts_at, ends_at, capacity, location, service:booking_services(title, duration_minutes)")
      .eq("status", "open")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(100);
    if (data.serviceId) q = q.eq("service_id", data.serviceId);

    const { data: slots } = await q;
    if (!slots?.length) return [];

    // Remaining capacity = capacity minus active bookings
    const ids = slots.map((s) => s.id);
    const { data: bookings } = await pub
      .from("bookings")
      .select("slot_id")
      .in("slot_id", ids)
      .in("status", ["requested", "confirmed"]);
    const taken = new Map<string, number>();
    for (const b of bookings ?? []) taken.set(b.slot_id, (taken.get(b.slot_id) ?? 0) + 1);
    return slots
      .map((s) => ({ ...s, remaining: s.capacity - (taken.get(s.id) ?? 0) }))
      .filter((s) => s.remaining > 0);
  });

export const bookSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => bookingCreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: slot } = await supabase
      .from("booking_slots")
      .select("id, capacity, starts_at, status, service:booking_services(title)")
      .eq("id", data.slotId)
      .single();
    if (!slot || slot.status !== "open") throw new Error("Slot unavailable");
    if (new Date(slot.starts_at) < new Date()) throw new Error("Slot is in the past");

    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("slot_id", data.slotId)
      .in("status", ["requested", "confirmed"]);
    if ((count ?? 0) >= slot.capacity) throw new Error("Slot is full");

    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("slot_id", data.slotId)
      .eq("user_id", userId)
      .in("status", ["requested", "confirmed"])
      .maybeSingle();
    if (existing) throw new Error("You already booked this slot");

    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({ slot_id: data.slotId, user_id: userId, status: "confirmed", created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const serviceName =
      (Array.isArray(slot.service) ? slot.service[0]?.title : (slot.service as any)?.title) ??
      "your session";
    await notifyUserFromTemplate(
      supabase,
      userId,
      "booking_confirmed",
      "Booking confirmed",
      { service_name: serviceName, slot_time: new Date(slot.starts_at).toLocaleString("en-NG") },
      "/my-barakah",
    );
    await audit({ supabase, userId }, "booking.create", "bookings", booking.id);
    return { id: booking.id };
  });

export const myBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("bookings")
      .select(
        "id, status, created_at, slot:booking_slots(starts_at, ends_at, location, service:booking_services(title, cancel_cutoff_hours))",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ bookingId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: booking } = await supabase
      .from("bookings")
      .select(
        "id, status, slot:booking_slots(starts_at, service:booking_services(title, cancel_cutoff_hours))",
      )
      .eq("id", data.bookingId)
      .eq("user_id", userId)
      .single();
    if (!booking) throw new Error("Booking not found");
    if (!["requested", "confirmed"].includes(booking.status))
      throw new Error("Booking cannot be cancelled");

    const slot: any = Array.isArray(booking.slot) ? booking.slot[0] : booking.slot;
    const service: any = Array.isArray(slot?.service) ? slot.service[0] : slot?.service;
    const cutoffMs = (service?.cancel_cutoff_hours ?? 24) * 3600 * 1000;
    if (new Date(slot?.starts_at).getTime() - Date.now() < cutoffMs) {
      throw new Error(
        `Cancellations close ${service?.cancel_cutoff_hours ?? 24}h before the session. Please contact us.`,
      );
    }

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);
    await notifyUserFromTemplate(
      supabase,
      userId,
      "booking_cancelled",
      "Booking cancelled",
      {
        service_name: service?.title ?? "your session",
        slot_time: new Date(slot?.starts_at).toLocaleString("en-NG"),
      },
      "/my-barakah",
    );
    return { ok: true };
  });

export const staffListBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data } = await supabase
      .from("bookings")
      .select(
        "id, status, created_at, user_id, slot:booking_slots(starts_at, location, service:booking_services(title)), booker:profiles!bookings_user_id_fkey(full_name, phone)",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const staffSetBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => bookingStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data: booking } = await supabase
      .from("bookings")
      .select("user_id, slot:booking_slots(starts_at, service:booking_services(title))")
      .eq("id", data.bookingId)
      .single();
    if (!booking) throw new Error("Booking not found");
    const { error } = await supabase
      .from("bookings")
      .update({ status: data.status })
      .eq("id", data.bookingId);
    if (error) throw new Error(error.message);

    const slot: any = Array.isArray(booking.slot) ? booking.slot[0] : booking.slot;
    const service: any = Array.isArray(slot?.service) ? slot.service[0] : slot?.service;
    if (data.status === "confirmed" || data.status === "cancelled") {
      await notifyUserFromTemplate(
        supabase,
        booking.user_id,
        data.status === "confirmed" ? "booking_confirmed" : "booking_cancelled",
        `Booking ${data.status}`,
        {
          service_name: service?.title ?? "your session",
          slot_time: new Date(slot?.starts_at).toLocaleString("en-NG"),
        },
        "/my-barakah",
      );
    }
    await audit({ supabase, userId }, "booking.status", "bookings", data.bookingId, {
      status: data.status,
    });
    return { ok: true };
  });

export const staffUpsertService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => serviceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const fields = {
      title: data.title,
      description: data.description ?? null,
      category: data.category ?? "general",
      duration_minutes: data.durationMinutes,
      cancel_cutoff_hours: data.cancelCutoffHours,
    };
    if (data.id) {
      await supabase.from("booking_services").update(fields).eq("id", data.id);
    } else {
      await supabase.from("booking_services").insert({ ...fields, created_by: userId });
    }
    return { ok: true };
  });

export const staffUpsertSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => slotSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    if (new Date(data.endsAt) <= new Date(data.startsAt))
      throw new Error("End time must be after start time");
    const fields = {
      service_id: data.serviceId,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
      capacity: data.capacity,
      location: data.location ?? null,
    };
    if (data.id) {
      await supabase.from("booking_slots").update(fields).eq("id", data.id);
    } else {
      await supabase.from("booking_slots").insert({ ...fields, created_by: userId });
    }
    return { ok: true };
  });

export const staffListServicesSlots = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const [services, slots] = await Promise.all([
      supabase.from("booking_services").select("*").order("title"),
      supabase
        .from("booking_slots")
        .select("id, starts_at, ends_at, capacity, location, status, service:booking_services(title)")
        .gte("starts_at", new Date(Date.now() - 7 * 864e5).toISOString())
        .order("starts_at")
        .limit(100),
    ]);
    return { services: services.data ?? [], slots: slots.data ?? [] };
  });
