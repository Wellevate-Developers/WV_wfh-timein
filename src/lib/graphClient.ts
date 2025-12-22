// lib/graphClient.ts
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

const cca = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET!,
  },
});

export function getGraphClient() {
  return Client.init({
    authProvider: async (done) => {
      try {
        const tokenResponse = await cca.acquireTokenByClientCredential({
          scopes: ["https://graph.microsoft.com/.default"],
        });

        if (!tokenResponse?.accessToken) {
          throw new Error("No access token returned");
        }

        done(null, tokenResponse.accessToken);
      } catch (err) {
        done(err as Error, null);
      }
    },
  });
}
