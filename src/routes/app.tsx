import { createFileRoute, redirect } from '@tanstack/react-router';
import { isSwiftmoveDomain } from '@/lib/domain-detection';

export const Route = createFileRoute('/app')({
  beforeLoad: () => {
    throw redirect({ to: isSwiftmoveDomain() ? '/' : '/swiftmove' });
  },
  component: () => null,
});
