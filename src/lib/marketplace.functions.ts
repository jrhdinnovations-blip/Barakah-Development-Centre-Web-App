import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { audit, cartSchema, productSchema, requireStaff, uuid } from "./staff.server";
import { createPaymentIntent, makeNumber } from "./payments.server";

async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient(process.env["SUPABASE_URL"]!, key, {
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

export const listProducts = createServerFn({ method: "GET" }).handler(async () => {
  const pub = await publicClient();
  const [products, categories] = await Promise.all([
    pub
      .from("products")
      .select("id, slug, title, description, image_url, price_kobo, currency, is_digital, stock_quantity, category:product_categories(name)")
      .eq("status", "published")
      .order("title"),
    pub.from("product_categories").select("id, slug, name").order("name"),
  ]);
  return { products: products.data ?? [], categories: categories.data ?? [] };
});

export const myCart = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("cart_items")
      .select("id, quantity, product:products(id, title, price_kobo, currency, image_url, is_digital, stock_quantity, status)")
      .eq("user_id", userId);
    return data ?? [];
  });

export const addToCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => cartSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: product } = await supabase
      .from("products")
      .select("id, status, is_digital, stock_quantity")
      .eq("id", data.productId)
      .single();
    if (!product || product.status !== "published") throw new Error("Product unavailable");
    if (!product.is_digital && (product.stock_quantity ?? 0) < data.quantity)
      throw new Error("Not enough stock");
    const { error } = await supabase
      .from("cart_items")
      .upsert({ user_id: userId, product_id: data.productId, quantity: data.quantity });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeFromCart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ cartItemId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("cart_items").delete().eq("id", data.cartItemId).eq("user_id", userId);
    return { ok: true };
  });

/** Creates the order from the cart and returns a hosted payment page (when configured). */
export const checkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: cart } = await supabase
      .from("cart_items")
      .select("id, quantity, product:products(id, title, price_kobo, is_digital, stock_quantity, status, legal_entity_id, programme_id)")
      .eq("user_id", userId);
    if (!cart?.length) throw new Error("Your cart is empty");

    let total = 0;
    for (const item of cart) {
      const p: any = Array.isArray(item.product) ? item.product[0] : item.product;
      if (!p || p.status !== "published") throw new Error("A product in your cart is unavailable");
      if (!p.is_digital && (p.stock_quantity ?? 0) < item.quantity)
        throw new Error(`Not enough stock for ${p.title}`);
      total += p.price_kobo * item.quantity;
    }
    if (total <= 0) throw new Error("Cart total must be greater than zero");

    const { data: order, error } = await supabase
      .from("orders")
      .insert({ order_number: makeNumber("ORD"), user_id: userId, total_kobo: total, created_by: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("order_items").insert(
      cart.map((item) => {
        const p: any = Array.isArray(item.product) ? item.product[0] : item.product;
        return { order_id: order.id, product_id: p.id, quantity: item.quantity, unit_price_kobo: p.price_kobo };
      }),
    );
    await supabase.from("cart_items").delete().eq("user_id", userId);

    const firstItem = cart[0]!;
    const first: any = Array.isArray(firstItem.product) ? firstItem.product[0] : firstItem.product;
    const result = await createPaymentIntent(supabase, userId, {
      entityType: "order",
      entityId: order.id,
      amountKobo: total,
      description: `Marketplace order (${cart.length} item${cart.length > 1 ? "s" : ""})`,
      legalEntityId: first?.legal_entity_id ?? null,
      programmeId: first?.programme_id ?? null,
      callbackPath: "/my-payments",
    });
    await audit({ supabase, userId }, "order.create", "orders", order.id, { total });
    return { orderId: order.id, ...result };
  });

export const myOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: orders } = await supabase
      .from("orders")
      .select("id, order_number, status, total_kobo, currency, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const ids = (orders ?? []).map((o) => o.id);
    const { data: items } = ids.length
      ? await supabase
          .from("order_items")
          .select("id, order_id, quantity, unit_price_kobo, product:products(title)")
          .in("order_id", ids)
      : { data: [] };
    return { orders: orders ?? [], items: items ?? [] };
  });

// ===== Staff =====

export const staffListProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const [products, categories, orders] = await Promise.all([
      supabase
        .from("products")
        .select("id, slug, title, price_kobo, currency, is_digital, stock_quantity, status, category:product_categories(name)")
        .order("created_at", { ascending: false }),
      supabase.from("product_categories").select("id, slug, name").order("name"),
      supabase
        .from("orders")
        .select("id, order_number, status, total_kobo, currency, created_at, buyer:profiles!orders_user_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    return { products: products.data ?? [], categories: categories.data ?? [], orders: orders.data ?? [] };
  });

export const staffUpsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => productSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const fields = {
      slug: data.slug,
      title: data.title,
      description: data.description ?? null,
      image_url: data.imageUrl || null,
      price_kobo: data.priceKobo,
      is_digital: data.isDigital,
      stock_quantity: data.isDigital ? null : (data.stockQuantity ?? 0),
      category_id: data.categoryId ?? null,
      status: data.status,
    };
    if (data.id) {
      await supabase.from("products").update(fields).eq("id", data.id);
    } else {
      await supabase.from("products").insert({ ...fields, created_by: userId });
    }
    await audit({ supabase, userId }, "product.upsert", "products", data.id);
    return { ok: true };
  });

export const staffAddCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
      name: z.string().trim().min(2).max(100),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    await supabase.from("product_categories").insert({ slug: data.slug, name: data.name });
    return { ok: true };
  });

export const staffSetOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ orderId: uuid, status: z.enum(["processing", "fulfilled", "cancelled"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireStaff(supabase, userId);
    const { data: order } = await supabase
      .from("orders")
      .select("user_id, order_number")
      .eq("id", data.orderId)
      .single();
    if (!order) throw new Error("Order not found");
    await supabase.from("orders").update({ status: data.status }).eq("id", data.orderId);
    await supabase.rpc("notify_user", {
      _user_id: order.user_id,
      _type: "order_update",
      _title: `Order ${order.order_number} ${data.status}`,
      _link: "/my-payments",
    });
    await audit({ supabase, userId }, "order.status", "orders", data.orderId, { status: data.status });
    return { ok: true };
  });
