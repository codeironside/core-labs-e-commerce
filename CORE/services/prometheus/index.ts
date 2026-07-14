import type { Context } from "hono";
import client from "prom-client";

client.collectDefaultMetrics();

export const register = client.register;

export async function getMetrics(c: Context): Promise<Response> {
  c.header("Content-Type", register.contentType);
  return c.body(await register.metrics());
}