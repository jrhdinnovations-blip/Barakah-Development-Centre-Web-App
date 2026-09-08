import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { searchAddress, calculateServerRoute } from "./maps.server";

export const searchAddressServerFn = createServerFn({ method: "GET" })
  .validator((input: { query: string }) =>
    z.object({ query: z.string().min(1) }).parse(input)
  )
  .handler(async ({ data }) => {
    return await searchAddress(data.query);
  });

export const calculateRouteServerFn = createServerFn({ method: "POST" })
  .validator((input: {
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
  }) =>
    z
      .object({
        originLat: z.number(),
        originLng: z.number(),
        destLat: z.number(),
        destLng: z.number(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    return await calculateServerRoute(
      data.originLat,
      data.originLng,
      data.destLat,
      data.destLng
    );
  });
