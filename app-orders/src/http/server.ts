import "@opentelemetry/auto-instrumentations-node/register";

import { fastifyCors } from "@fastify/cors";
import { trace } from "@opentelemetry/api";
import { fastify } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { dispatchOrderCreated } from "../broker/messages/order-created.ts";
import { db } from "../db/client.ts";
import { schema } from "../db/schema/index.ts";
import { tracer } from "../tracer/tracer.ts";

const app = fastify().withTypeProvider<ZodTypeProvider>();

app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

app.register(fastifyCors, { origin: "*" });

app.get("/health", () => {
  return "OK";
});

app.post(
  "/orders",
  {
    schema: {
      body: z.object({
        amount: z.coerce.number(),
      }),
    },
  },
  async (request, replay) => {
    const { amount } = request.body;

    const orderId = randomUUID();
    const customerId = "0e6c7ca3-d608-44fb-8972-64af5dcf36ec";

    await db.insert(schema.orders).values({
      id: randomUUID(),
      customerId,
      amount,
    });

    const span = tracer.startSpan("Algo de errado não esta certo");
    await setTimeout(2000);
    span.end();

    trace.getActiveSpan()?.setAttribute("order_id", orderId);

    dispatchOrderCreated({
      orderId,
      amount,
      customer: {
        id: customerId,
      },
    });

    return replay.status(201).send();
  }
);

app.listen({ host: "0.0.0.0", port: 3333 }).then(() => {
  console.log("[Orders] HTTP Server running...");
});
