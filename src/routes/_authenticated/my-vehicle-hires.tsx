import { createFileRoute, redirect } from '@tanstack/react-router';
import { z } from 'zod';

const searchSchema = z
  .object({
    service: z.string().optional(),
    paid: z.string().optional(),
    orderId: z.string().optional(),
  })
  .catch({});

export const Route = createFileRoute('/_authenticated/my-vehicle-hires')({
  validateSearch: searchSchema,
  ssr: false,
  beforeLoad: ({ search }: any) => {
    throw redirect({
      to: '/my-swift-move' as any,
      search: { service: 'ride', ...search },
    });
  },
  component: () => null,
});