// lib/graphClient.ts
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client, AuthProviderCallback } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

let graphClient: Client | null = null;

export async function getGraphClient() {
  if (graphClient) return graphClient;

  const config = {
    auth: {
      clientId: process.env.AZURE_CLIENT_ID || "",
      authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
      clientSecret: process.env.AZURE_CLIENT_SECRET || "",
    },
  };

  const cca = new ConfidentialClientApplication(config);

  const tokenResponse = await cca.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });

  const accessToken = tokenResponse?.accessToken;

  if (!accessToken) {
    throw new Error("Failed to get access token");
  }

  graphClient = Client.init({
    authProvider: (done: AuthProviderCallback) => {
      done(null, accessToken);
    },
  });

  return graphClient;
}
