import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBag, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { addToCart, listProducts, myCart } from "@/lib/marketplace.functions";
import { formatNaira } from "@/lib/currency";
import { supabase } from "@/integrations/supabase/client";
import { ORG } from "@/lib/site";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: `Marketplace — ${ORG.legalName}` },
      { name: "description", content: "Shop products and digital downloads that support Barakah's programmes." },
      { property: "og:title", content: `Marketplace — ${ORG.legalName}` },
      { property: "og:description", content: "Shop products and digital downloads that support Barakah's programmes." },
    ],
  }),
  component: MarketPage,
});

function MarketPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [category, setCategory] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  const products = useQuery({ queryKey: ["products", category], queryFn: () => listProducts() });
  const cart = useQuery({ queryKey: ["my-cart"], queryFn: () => myCart(), enabled: signedIn });

  const add = useMutation({
    mutationFn: (productId: string) => addToCart({ data: { productId, quantity: 1 } }),
    onSuccess: () => {
      toast.success("Added to cart.");
      queryClient.invalidateQueries({ queryKey: ["my-cart"] });
    },
    onError: () => navigate({ to: "/auth", search: { mode: "login" } }),
  });

  const categories = products.data?.categories ?? [];
  const activeCatName = categories.find((c) => c.slug === category)?.name;
  const items = (products.data?.products ?? []).filter((p: any) => {
    if (!activeCatName) return true;
    const cat = Array.isArray(p.category) ? p.category[0] : p.category;
    return cat?.name === activeCatName;
  });
  const cartCount = (cart.data ?? []).reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground md:text-5xl">Marketplace</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Products and digital downloads. Every purchase supports Barakah's community programmes.
          </p>
        </div>
        {signedIn && (
          <Link to="/cart" className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
            <ShoppingCart className="h-4 w-4" /> Cart ({cartCount})
          </Link>
        )}
      </div>

      {categories.length > 0 && (
        <div className="mt-8 flex flex-wrap gap-2">
          <button
            onClick={() => setCategory("")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium ${!category ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.slug)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium ${category === c.slug ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {products.isLoading && <p className="mt-12 text-sm text-muted-foreground">Loading products…</p>}
      {!products.isLoading && items.length === 0 && (
        <div className="card-surface mt-12 p-10 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-xl font-semibold text-foreground">Shop opening soon</h2>
          <p className="mt-2 text-sm text-muted-foreground">Products are being prepared.</p>
        </div>
      )}

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p: any) => {
          const cat = Array.isArray(p.category) ? p.category[0] : p.category;
          const out = !p.is_digital && (p.stock_quantity ?? 0) <= 0;
          return (
            <div key={p.id} className="card-surface flex flex-col p-6">
              {cat && <span className="text-xs font-medium uppercase tracking-wide text-primary">{cat.name}</span>}
              <h2 className="mt-2 text-lg font-semibold text-foreground">{p.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="font-semibold text-foreground">{formatNaira(p.price_kobo, p.currency)}</span>
                {out ? (
                  <span className="text-xs text-muted-foreground">Out of stock</span>
                ) : (
                  <button
                    onClick={() => add.mutate(p.id)}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
                  >
                    Add to cart
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
