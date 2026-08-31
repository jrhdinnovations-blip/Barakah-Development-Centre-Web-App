import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  myNotifications,
} from "@/lib/notifications.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => myNotifications(),
    enabled: open,
  });
  const unread = useQuery({
    queryKey: ["notifications-unread"],
    queryFn: () => myNotifications().then((n) => n.filter((x) => !x.read_at).length),
    refetchInterval: 60_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["notifications-unread"] });
  };
  const markAll = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: invalidate,
  });
  const markOne = useMutation({
    mutationFn: (id: string) => markNotificationRead({ data: { id } }),
    onSuccess: invalidate,
  });

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative rounded-md p-2 text-foreground transition-colors hover:bg-accent"
        >
          <Bell className="h-5 w-5" />
          {(unread.data ?? 0) > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {unread.data}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-sm font-semibold text-foreground">Notifications</p>
          <button
            onClick={() => markAll.mutate()}
            className="text-xs font-medium text-primary hover:underline"
          >
            Mark all read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {(notifications.data ?? []).length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          )}
          {(notifications.data ?? []).map((n) => (
            <div
              key={n.id}
              className={`border-b border-border px-4 py-3 last:border-0 ${n.read_at ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">{n.title}</p>
                {!n.read_at && (
                  <button
                    onClick={() => markOne.mutate(n.id)}
                    className="shrink-0 text-[11px] text-primary hover:underline"
                  >
                    Mark read
                  </button>
                )}
              </div>
              {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
              {n.link && (
                <Link
                  to={n.link}
                  onClick={() => {
                    if (!n.read_at) markOne.mutate(n.id);
                    setOpen(false);
                  }}
                  className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                >
                  View
                </Link>
              )}
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
