type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  function: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;
  requestId?: string;
}

function createLogger(functionName: string) {
  const requestId = crypto.randomUUID().slice(0, 8);

  const log = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
    const entry: LogEntry = {
      level,
      function: functionName,
      message,
      timestamp: new Date().toISOString(),
      requestId,
      ...(data && { data }),
    };
    const output = JSON.stringify(entry);
    if (level === "error") {
      console.error(output);
    } else if (level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  };

  return {
    info: (message: string, data?: Record<string, unknown>) => log("info", message, data),
    warn: (message: string, data?: Record<string, unknown>) => log("warn", message, data),
    error: (message: string, data?: Record<string, unknown>) => log("error", message, data),
  };
}

export { createLogger };
export type { LogEntry };
