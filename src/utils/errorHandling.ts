export async function getErrorMessage(err: any): Promise<string> {
  let msg = typeof err === 'string' ? err : (err?.message || err?.toString() || "Unknown error occurred.");

  // If the error wraps the raw HTTP response object, we parse the buffer text out of it
  if (err && err.context && typeof err.context.text === 'function') {
    try {
      // Must await the stream buffer completion
      const rawText = await err.context.text();
      if (rawText) msg = rawText;
    } catch {
      // fallback cleanly to standard message string
    }
  }

  const lowerMsg = msg.toLowerCase();
  
  if (lowerMsg.includes("429") || lowerMsg.includes("overloaded") || lowerMsg.includes("busy") || lowerMsg.includes("quota") || lowerMsg.includes("429 too many requests")) {
    return "The AI model is currently busy with high demand. Please try again in a few minutes.";
  }
  if (lowerMsg.includes("503") || lowerMsg.includes("unavailable") || lowerMsg.includes("offline")) {
    return "The generation service is temporarily unavailable. Please try again shortly.";
  }
  if (lowerMsg.includes("timeout") || lowerMsg.includes("aborted") || lowerMsg.includes("took too long") || lowerMsg.includes("deadline") || lowerMsg.includes("timed out")) {
    return "The request took too long to respond. Please try again.";
  }
  if (lowerMsg.includes("limit") || lowerMsg.includes("generations remaining") || lowerMsg.includes("no generations remaining")) {
    return "You have no generations remaining. Please contact your admin.";
  }
  if (lowerMsg.includes("auth") || lowerMsg.includes("unauthorized") || lowerMsg.includes("expired") || lowerMsg.includes("jwt") || lowerMsg.includes("session")) {
    return "Your session has expired. Please refresh and try again.";
  }
  
  return msg;
}
