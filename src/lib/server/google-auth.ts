import { OAuth2Client } from "google-auth-library";

const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

if (!clientId) {
  console.warn("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google auth will fail until configured.");
}

const oauthClient = new OAuth2Client(clientId || "missing-google-client-id");

export async function verifyGoogleCredential(credential: string): Promise<{
  email: string;
  name: string;
  googleSub: string;
}> {
  if (!clientId) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
  }

  const ticket = await oauthClient.verifyIdToken({
    idToken: credential,
    audience: clientId
  });
  const payload = ticket.getPayload();

  if (!payload?.email || !payload?.sub) {
    throw new Error("Invalid Google token payload");
  }

  return {
    email: payload.email,
    name: payload.name || "",
    googleSub: payload.sub
  };
}
