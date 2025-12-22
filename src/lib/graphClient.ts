// lib/graphClient.ts
import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import "isomorphic-fetch";

let cca: ConfidentialClientApplication | null = null;

function getCCA(): ConfidentialClientApplication {
  if (!cca) {
    const {
      AZURE_CLIENT_ID,
      AZURE_TENANT_ID,
      AZURE_CLIENT_SECRET,
    } = process.env;

    if (!AZURE_CLIENT_ID || !AZURE_TENANT_ID || !AZURE_CLIENT_SECRET) {
      throw new Error("Azure AD environment variables are missing");
    }

    cca = new ConfidentialClientApplication({
      auth: {
        clientId: AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
        clientSecret: AZURE_CLIENT_SECRET,
      },
    });
  }

  return cca;
}

export function getGraphClient() {
  const ccaInstance = getCCA();

  return Client.init({
    authProvider: async (done) => {
      try {
        const tokenResponse = await ccaInstance.acquireTokenByClientCredential({
          scopes: ["https://graph.microsoft.com/.default"],
        });

        if (!tokenResponse?.accessToken) {
          throw new Error("No access token returned from MSAL");
        }

        done(null, tokenResponse.accessToken);
      } catch (err) {
        done(err as Error, null);
      }
    },
  });
}
