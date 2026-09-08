import { createFileRoute, redirect } from '@tanstack/react-router';

// This route now simply redirects to the canonical /my-swift-move booking page.
// Previously this was a separate booking interface that caused user confusion.
export const Route = createFileRoute('/_authenticated/swift-move/new')({
  beforeLoad: () => {
    throw redirect({ to: '/my-swift-move' });
  },
  component: () => null,
});