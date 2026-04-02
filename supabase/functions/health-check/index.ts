import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { checkRateLimit, RateLimitError } from "../_shared/rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";

type HealthStatus = "ok" | "degraded" | "down";

interface CheckResult {
  status: HealthStatus;
  message: string;
  latency_ms?: number;
}

interface HealthResponse {
  status: HealthStatus;
  checks: {
    db: CheckResult;
    env_vars: CheckResult;
  };
  timestamp: string;
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabase
      .from("tenants")
      .select("id")
      .limit(1);

    const latency_ms = Date.now() - start;

    if (error) {
      return {
        status: "down",
        message: `DB query failed: ${error.message}`,
        latency_ms,
      };
    }

    return {
      status: "ok",
      message: "Database reachable",
      latency_ms,
    };
  } catch (err: unknown) {
    const latency_ms = Date.now() - start;
    const message = err instanceof Error ? err.message : "Unknown DB error";
    return {
      status: "down",
      message,
      latency_ms,
    };
  }
}

function checkEnvVars(): CheckResult {
  const required = [
    "ALLOWED_ORIGINS",
    "STRIPE_WEBHOOK_SECRET",
  ];

  // At least one AI key must be present
  const aiKeys = ["AI_GATEWAY_API_KEY", "OPENAI_API_KEY"];

  const missing: string[] = [];

  for (const key of required) {
    if (!Deno.env.get(key)) {
      missing.push(key);
    }
  }

  const hasAiKey = aiKeys.some((key) => !!Deno.env.get(key));
  if (!hasAiKey) {
    missing.push(`one of [${aiKeys.join(", ")}]`);
  }

  if (missing.length > 0) {
    return {
      status: "down",
      message: `Missing critical env vars: ${missing.join(", ")}`,
    };
  }

  return {
    status: "ok",
    message: "All critical env vars present",
  };
}

serve(async (req: Request): Promise<Response> => {
  const logger = createLogger("health-check");

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    await checkRateLimit(req, "health-check", 10);

    logger.info("Health check requested");

    const [dbCheck, envCheck] = await Promise.all([
      checkDatabase(),
      Promise.resolve(checkEnvVars()),
    ]);

    const allChecks = [dbCheck, envCheck];

    let overallStatus: HealthStatus = "ok";
    if (allChecks.some((c) => c.status === "down")) {
      overallStatus = "down";
    } else if (allChecks.some((c) => c.status === "degraded")) {
      overallStatus = "degraded";
    }

    const response: HealthResponse = {
      status: overallStatus,
      checks: {
        db: dbCheck,
        env_vars: envCheck,
      },
      timestamp: new Date().toISOString(),
    };

    logger.info("Health check complete", {
      status: overallStatus,
      db_latency_ms: dbCheck.latency_ms,
    });

    const httpStatus = overallStatus === "down" ? 503 : 200;

    return new Response(JSON.stringify(response), {
      status: httpStatus,
      headers: {
        ...getCorsHeaders(req),
        "Content-Type": "application/json",
      },
    });
  } catch (error: unknown) {
    if (error instanceof RateLimitError) {
      return new Response(
        JSON.stringify({ error: "Too many requests, please retry later" }),
        {
          status: 429,
          headers: {
            ...getCorsHeaders(req),
            "Content-Type": "application/json",
            "Retry-After": String(error.retryAfter),
          },
        }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    logger.error("Health check failed unexpectedly", { error: message });

    return new Response(
      JSON.stringify({
        status: "down",
        checks: {
          db: { status: "down", message: "Check could not run" },
          env_vars: { status: "down", message: "Check could not run" },
        },
        timestamp: new Date().toISOString(),
        error: message,
      } satisfies HealthResponse & { error: string }),
      {
        status: 503,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/json",
        },
      }
    );
  }
});
