import { z } from "zod";

type Ctx = { supabase: any; userId: string };

export async function requireAdmin(supabase: any, userId: string) {
  try {
    const { data: isAdmin, error } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "administrator",
    });
    if (!error && isAdmin) return;
  } catch {}

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active");
  if (roles?.some((r: any) => r.role === "administrator")) return;

  throw new Error("Forbidden");
}

export async function requireStaff(supabase: any, userId: string) {
  try {
    const { data: staff, error } = await supabase.rpc("is_staff", { _user_id: userId });
    if (!error && staff) return;
  } catch {}

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active");
  const staffRoles = ['administrator', 'programme_officer', 'content_editor', 'swift_dispatcher', 'swift_manager'];
  if (roles?.some((r: any) => staffRoles.includes(r.role))) return;

  throw new Error("Forbidden");
}

export async function requireSwiftStaff(supabase: any, userId: string) {
  try {
    const { data: ok, error } = await supabase.rpc("is_swift_staff", { _user_id: userId });
    if (!error && ok) return;
  } catch {}

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("status", "active");
  const swiftStaffRoles = ['administrator', 'swift_dispatcher', 'swift_manager'];
  if (roles?.some((r: any) => swiftStaffRoles.includes(r.role))) return;

  throw new Error("Forbidden");
}


export function renderTemplate(body: string, vars: Record<string, string>) {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

/**
 * Sends an in-app notification using a template (falls back to the given
 * title/body). Email/SMS/WhatsApp delivery hooks in here once a provider is
 * configured — the channel abstraction lives in notification_templates.
 */
export async function notifyUserFromTemplate(
  supabase: any,
  userId: string,
  templateKey: string,
  title: string,
  vars: Record<string, string>,
  link?: string,
) {
  let body = "";
  const { data: tpl } = await supabase
    .from("notification_templates")
    .select("body, status")
    .eq("key", templateKey)
    .maybeSingle();
  if (tpl?.status === "active") body = renderTemplate(tpl.body, vars);
  await supabase.rpc("notify_user", {
    _user_id: userId,
    _type: templateKey,
    _title: title,
    _body: body || null,
    _link: link ?? null,
  });
}

export async function audit(
  ctx: Ctx,
  action: string,
  entityType: string,
  entityId?: string,
  metadata: Record<string, unknown> = {},
) {
  await ctx.supabase.from("audit_logs").insert({
    actor_id: ctx.userId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata,
  });
}

export const uuid = z.string().uuid();

export const applicationFormSchema = z.object({
  programmeId: uuid.optional(),
  motivation: z.string().trim().min(10).max(2000),
  background: z.string().trim().max(2000).optional(),
  commitment: z.string().trim().max(1000).optional(),
});

export const applicationReviewSchema = z.object({
  applicationId: uuid,
  status: z.enum(["under_review", "approved", "rejected", "waitlisted"]),
  note: z.string().trim().max(1000).optional(),
});

export const bookingCreateSchema = z.object({ slotId: uuid });

export const bookingStatusSchema = z.object({
  bookingId: uuid,
  status: z.enum(["confirmed", "completed", "cancelled", "no_show"]),
  note: z.string().trim().max(500).optional(),
});

export const serviceSchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(60).optional(),
  durationMinutes: z.number().int().min(15).max(480),
  cancelCutoffHours: z.number().int().min(0).max(720),
});

export const slotSchema = z.object({
  id: uuid.optional(),
  serviceId: uuid,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.number().int().min(1).max(500),
  location: z.string().trim().max(200).optional(),
});

export const courseSchema = z.object({
  id: uuid.optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(500).optional(),
  description: z.string().max(20000).optional(),
  selfEnrol: z.boolean(),
  status: z.enum(["draft", "review", "approved", "published", "archived"]),
});

export const lessonSchema = z.object({
  id: uuid.optional(),
  courseId: uuid,
  title: z.string().trim().min(2).max(200),
  contentType: z.enum(["video", "document"]),
  videoUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  body: z.string().max(50000).optional(),
  sortOrder: z.number().int().min(0).max(10000),
});

export const enquirySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  subject: z.string().trim().min(2).max(150),
  message: z.string().trim().min(5).max(1000),
});

export const followUpSchema = z.object({
  enquiryId: uuid.optional(),
  contactId: uuid.optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(500).optional(),
});

export const templateSchema = z.object({
  id: uuid.optional(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscores only"),
  channel: z.enum(["in_app", "email", "sms", "whatsapp"]),
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1).max(4000),
});

export const documentRegisterSchema = z.object({
  entityType: z.enum(["profile", "application", "booking", "driver", "vehicle"]),
  entityId: uuid.optional(),
  filePath: z.string().trim().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().min(1).max(10 * 1024 * 1024),
});

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// ===== Phase 3 schemas =====

export const moneyKobo = z.number().int().min(0).max(1_000_000_000);
export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const travelPackageSchema = z.object({
  id: uuid.optional(),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().trim().min(2).max(200),
  summary: z.string().trim().max(500).optional(),
  body: z.string().max(20000).optional(),
  providerName: z.string().trim().max(200).optional(),
  providerNotes: z.string().trim().max(1000).optional(),
  itinerary: z.string().max(20000).optional(),
  startsOn: dateStr.optional().or(z.literal("")),
  endsOn: dateStr.optional().or(z.literal("")),
  priceKobo: moneyKobo,
  status: z.enum(["draft", "review", "approved", "published", "archived"]),
});

export const passengerSchema = z.object({
  enrolmentId: uuid,
  fullName: z.string().trim().min(2).max(200),
  dateOfBirth: dateStr.optional().or(z.literal("")),
  passportNumber: z.string().trim().max(30).optional(),
  passportExpiry: dateStr.optional().or(z.literal("")),
  nextOfKinName: z.string().trim().max(200).optional(),
  nextOfKinPhone: z.string().trim().max(30).optional(),
  medicalNotes: z.string().trim().max(2000).optional(),
});

export const paymentPlanSchema = z.object({
  enrolmentId: uuid,
  instalments: z
    .array(z.object({ label: z.string().trim().min(1).max(80), amountKobo: z.number().int().min(1), dueDate: dateStr }))
    .min(1)
    .max(24),
});

export const productSchema = z.object({
  id: uuid.optional(),
  categoryId: uuid.optional(),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).optional(),
  imageUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
  priceKobo: moneyKobo,
  isDigital: z.boolean(),
  stockQuantity: z.number().int().min(0).max(1_000_000).nullable().optional(),
  status: z.enum(["draft", "review", "approved", "published", "archived"]),
});

export const cartSchema = z.object({
  productId: uuid,
  quantity: z.number().int().min(1).max(99),
});

export const assistanceRequestSchema = z.object({
  programmeId: uuid.optional(),
  needSummary: z.string().trim().min(5).max(200),
  circumstances: z.string().trim().max(5000).optional(),
});

export const caseStatusSchema = z.object({
  caseId: uuid,
  status: z.enum(["intake", "assessment", "eligibility_review", "approved", "declined", "referred", "in_support", "follow_up", "closed"]),
});

export const caseAssignSchema = z.object({ caseId: uuid, officerId: uuid });

export const assessmentSchema = z.object({
  caseId: uuid,
  notes: z.string().trim().min(5).max(5000),
  recommendation: z.string().trim().max(1000).optional(),
});

export const eligibilitySchema = z.object({
  caseId: uuid,
  eligible: z.boolean(),
  criteriaNotes: z.string().trim().max(2000).optional(),
});

export const referralSchema = z.object({
  caseId: uuid,
  referredTo: z.string().trim().min(2).max(200),
  reason: z.string().trim().max(1000).optional(),
});

export const volunteerProfileSchema = z.object({
  skills: z.array(z.string().trim().min(1).max(60)).max(20),
  availability: z.string().trim().max(500).optional(),
  bio: z.string().trim().max(2000).optional(),
});

export const opportunitySchema = z.object({
  id: uuid.optional(),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(5000).optional(),
  commitment: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  isRemote: z.boolean(),
  status: z.enum(["draft", "review", "approved", "published", "archived"]),
});

export const hoursSchema = z.object({
  assignmentId: uuid,
  workDate: dateStr,
  hours: z.number().min(0.25).max(24),
  note: z.string().trim().max(500).optional(),
});

// ===== Phase 4 — SwiftMove schemas =====

export const driverApplySchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(255),
  address: z.string().trim().max(300).optional(),
  emergencyContactName: z.string().trim().max(200).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
  bankName: z.string().trim().max(120).optional(),
  accountNumber: z.string().trim().max(20).optional(),
  accountName: z.string().trim().max(200).optional(),
});

export const vehicleSchema = z.object({
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.number().int().min(1990).max(2100).optional(),
  colour: z.string().trim().max(40).optional(),
  plateNumber: z.string().trim().min(3).max(20),
});

export const rideRequestSchema = z.object({
  serviceTypeCode: z.string().trim().max(40).default("swift_ride"),
  pickupAddress: z.string().trim().min(3).max(300),
  pickupLat: z.number().min(-90).max(90),
  pickupLng: z.number().min(-180).max(180),
  destinationAddress: z.string().trim().min(3).max(300),
  destinationLat: z.number().min(-90).max(90),
  destinationLng: z.number().min(-180).max(180),
});

export const ratingSchema = z.object({
  rideId: uuid,
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const rideReportSchema = z.object({
  rideId: uuid,
  category: z.enum(["safety", "driver_conduct", "vehicle", "fare", "lost_item", "other"]),
  description: z.string().trim().min(10).max(2000),
});

export const pricingRuleSchema = z.object({
  id: uuid.optional(),
  serviceTypeId: uuid,
  baseFareKobo: z.number().int().min(0),
  minFareKobo: z.number().int().min(0),
  perKmKobo: z.number().int().min(0),
  perMinuteKobo: z.number().int().min(0),
  waitingPerMinuteKobo: z.number().int().min(0),
  bookingFeeKobo: z.number().int().min(0),
  cancellationFeeKobo: z.number().int().min(0),
  cancellationGraceMinutes: z.number().int().min(0).max(120),
  commissionPercent: z.number().min(0).max(100),
});

export const savedLocationSchema = z.object({
  label: z.string().trim().min(1).max(40),
  address: z.string().trim().min(3).max(300),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const driverReviewSchema = z.object({
  driverId: uuid,
  action: z.enum(["approve", "reject", "suspend", "reactivate"]),
  notes: z.string().trim().max(1000).optional(),
});
