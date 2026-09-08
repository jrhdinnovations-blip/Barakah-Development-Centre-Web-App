import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatNaira } from "@/lib/currency";
import {
  staffAddCategory,
  staffListProducts,
  staffSetOrderStatus,
  staffUpsertProduct,
} from "@/lib/marketplace.functions";

const inputCls =
  "w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring";

export function MarketTab() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["staff-market"], queryFn: () => staffListProducts() });

  const [cat, setCat] = useState({ slug: "", name: "" });
  const [prod, setProd] = useState({
    slug: "", title: "", description: "", price: "", stock: "",
    isDigital: false, status: "draft", categoryId: "",
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff-market"] });

  const addCategory = useMutation({
    mutationFn: () => staffAddCategory({ data: cat }),
    onSuccess: () => { toast.success("Category added."); setCat({ slug: "", name: "" }); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const upsertProduct = useMutation({
    mutationFn: () =>
      staffUpsertProduct({
        data: {
          slug: prod.slug,
          title: prod.title,
          description: prod.description || undefined,
          priceKobo: Math.round(Number(prod.price) * 100),
          isDigital: prod.isDigital,
          stockQuantity: prod.isDigital ? null : Number(prod.stock || 0),
          status: prod.status as any,
          categoryId: prod.categoryId || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Product saved.");
      setProd({ slug: "", title: "", description: "", price: "", stock: "", isDigital: false, status: "draft", categoryId: "" });
      refresh();
    },
    onError: (e) => toast.error(e.message),
  });

  const setOrderStatus = useMutation({
    mutationFn: (v: { orderId: string; status: "processing" | "fulfilled" | "cancelled" }) =>
      staffSetOrderStatus({ data: v }),
    onSuccess: () => { toast.success("Order updated."); refresh(); },
    onError: (e) => toast.error(e.message),
  });

  const d = data.data;

  return (
    <div className="mt-8 space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <form className="card-surface space-y-3 p-6" onSubmit={(e) => { e.preventDefault(); upsertProduct.mutate(); }}>
          <h2 className="text-lg font-semibold text-foreground">New product</h2>
          <input className={inputCls} required placeholder="slug (e.g. barakah-handbook)" pattern="[a-z0-9-]+" value={prod.slug} onChange={(e) => setProd({ ...prod, slug: e.target.value })} />
          <input className={inputCls} required placeholder="Product title" value={prod.title} onChange={(e) => setProd({ ...prod, title: e.target.value })} />
          <textarea className={inputCls} rows={2} placeholder="Description" value={prod.description} onChange={(e) => setProd({ ...prod, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} required type="number" min="0" step="0.01" placeholder="Price (₦)" value={prod.price} onChange={(e) => setProd({ ...prod, price: e.target.value })} />
            <select className={inputCls} value={prod.categoryId} onChange={(e) => setProd({ ...prod, categoryId: e.target.value })}>
              <option value="">No category</option>
              {(d?.categories ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className={inputCls} value={prod.status} onChange={(e) => setProd({ ...prod, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="review">Review</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={prod.isDigital} onChange={(e) => setProd({ ...prod, isDigital: e.target.checked })} />
              Digital product
            </label>
          </div>
          {!prod.isDigital && (
            <input className={inputCls} type="number" min="0" placeholder="Stock quantity" value={prod.stock} onChange={(e) => setProd({ ...prod, stock: e.target.value })} />
          )}
          <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save product</button>
        </form>

        <div className="space-y-6">
          <form className="card-surface space-y-3 p-6" onSubmit={(e) => { e.preventDefault(); addCategory.mutate(); }}>
            <h2 className="text-lg font-semibold text-foreground">New category</h2>
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} required placeholder="slug" pattern="[a-z0-9-]+" value={cat.slug} onChange={(e) => setCat({ ...cat, slug: e.target.value })} />
              <input className={inputCls} required placeholder="Name" value={cat.name} onChange={(e) => setCat({ ...cat, name: e.target.value })} />
            </div>
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Add category</button>
          </form>

          <div className="card-surface p-6">
            <h2 className="text-lg font-semibold text-foreground">Products & inventory</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {(d?.products ?? []).map((p: any) => (
                <li key={p.id} className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-foreground">{p.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatNaira(p.price_kobo, p.currency)} ·{" "}
                    {p.is_digital ? "digital" : `stock: ${p.stock_quantity ?? 0}`} ·{" "}
                    <span className="capitalize">{p.status}</span>
                  </span>
                </li>
              ))}
              {(d?.products ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No products yet.</p>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="card-surface p-6">
        <h2 className="text-lg font-semibold text-foreground">Orders</h2>
        <ul className="mt-4 space-y-3">
          {(d?.orders ?? []).map((o: any) => {
            const buyer = Array.isArray(o.buyer) ? o.buyer[0] : o.buyer;
            return (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <div>
                  <span className="font-mono text-xs">{o.order_number}</span>
                  <span className="ml-2 text-muted-foreground">{buyer?.full_name ?? "Customer"}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>{formatNaira(o.total_kobo, o.currency)}</span>
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs capitalize">{o.status.replace(/_/g, " ")}</span>
                  {o.status === "payment_confirmed" && (
                    <button onClick={() => setOrderStatus.mutate({ orderId: o.id, status: "processing" })} className="text-xs font-medium text-primary hover:underline">Start processing</button>
                  )}
                  {o.status === "processing" && (
                    <button onClick={() => setOrderStatus.mutate({ orderId: o.id, status: "fulfilled" })} className="text-xs font-medium text-primary hover:underline">Mark fulfilled</button>
                  )}
                  {!["fulfilled", "cancelled"].includes(o.status) && (
                    <button onClick={() => setOrderStatus.mutate({ orderId: o.id, status: "cancelled" })} className="text-xs font-medium text-destructive hover:underline">Cancel</button>
                  )}
                </div>
              </li>
            );
          })}
          {(d?.orders ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
