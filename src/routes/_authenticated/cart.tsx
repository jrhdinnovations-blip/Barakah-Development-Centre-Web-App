import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PaymentReturn } from "@/components/PaymentReturn";
import { checkout, myCart, removeFromCart } from "@/lib/marketplace.functions";
import { paymentGatewayStatus } from "@/lib/payments.functions";
import { formatNaira } from "@/lib/payments.server";

export const Route = createFileRoute("/_authenticated/cart")({
  head: () => ({
    meta: [
      { title: "Cart & Checkout — My Barakah" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const queryClient = useQueryClient();
  const cart = useQuery({ queryKey: ["my-cart"], queryFn: () => myCart() });
  const gateway = useQuery({ queryKey: ["gateway-status"], queryFn: () => paymentGatewayStatus() });

  const remove = useMutation({
    mutationFn: (cartItemId: string) => removeFromCart({ data: { cartItemId } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-cart"] }),
    onError: (e) => toast.error(e.message),
  });

  const pay = useMutation({
    mutationFn: () => checkout(),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["my-cart"] });
      if (r.configured && r.authorizationUrl) {
        window.location.href = r.authorizationUrl;
      } else {
        toast.success(
          "Order placed. Online payment isn't live yet — our team will contact you to complete payment.",
        );
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const items = cart.data ?? [];
  const total = items.reduce((s, i: any) => {
    const p = Array.isArray(i.product) ? i.product[0] : i.product;
    return s + (p?.price_kobo ?? 0) * i.quantity;
  }, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-foreground">Your Cart</h1>
      <PaymentReturn onVerified={() => queryClient.invalidateQueries()} />

      {items.length === 0 ? (
        <div className="card-surface mt-8 p-10 text-center">
          <ShoppingCart className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Your cart is empty</h2>
          <Link to="/market" className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            Browse the marketplace
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <ul className="card-surface divide-y divide-border p-6">
            {items.map((i: any) => {
              const p = Array.isArray(i.product) ? i.product[0] : i.product;
              return (
                <li key={i.id} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-foreground">{p?.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.quantity} × {formatNaira(p?.price_kobo ?? 0, p?.currency)}
                      {p?.is_digital ? " · digital download" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-foreground">
                      {formatNaira((p?.price_kobo ?? 0) * i.quantity, p?.currency)}
                    </span>
                    <button onClick={() => remove.mutate(i.id)} aria-label="Remove item">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="card-surface flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="font-display text-2xl font-bold text-foreground">{formatNaira(total)}</p>
            </div>
            <button
              onClick={() => pay.mutate()}
              disabled={pay.isPending}
              className="rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {pay.isPending ? "Processing…" : gateway.data?.configured ? "Checkout & pay" : "Place order"}
            </button>
          </div>
          {!gateway.data?.configured && (
            <p className="text-xs text-muted-foreground">
              Online card payment isn't live yet. You can place your order now and our team will
              contact you to complete payment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
