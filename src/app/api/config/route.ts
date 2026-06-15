import { NextResponse } from "next/server";

export async function GET() {
  const armoriqKey = process.env.ARMORIQ_API_KEY || "";
  const openRouterKey = process.env.OPENROUTER_API_KEY || "";

  return NextResponse.json({
    armoriqConfigured: armoriqKey.startsWith("ak_"),
    openrouterConfigured: openRouterKey.length > 0,
    apiKeyType: armoriqKey.startsWith("ak_live_")
      ? "Live"
      : armoriqKey.startsWith("ak_test_")
      ? "Test"
      : armoriqKey.startsWith("ak_claw_")
      ? "Claw"
      : "Unknown",
  });
}
