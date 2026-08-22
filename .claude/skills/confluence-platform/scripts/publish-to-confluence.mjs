#!/usr/bin/env node
/**
 * Legt eine mit dem confluence-platform-Skill erzeugte .storage.xml als Confluence-Seite an
 * (oder aktualisiert eine bestehende) — per REST-API, ohne manuelles Copy-Paste im Editor.
 *
 * WICHTIG: Läuft ausschließlich mit den eigenen Zugangsdaten des Nutzers. Diese Claude-
 * Code-Session ruft dieses Skript nicht selbst auf und hat keinen Zugriff auf die
 * verwendeten Zugangsdaten oder die Confluence-Instanz.
 *
 * Voraussetzung: Node.js 18+ (nutzt das eingebaute fetch).
 *
 * Umgebungsvariablen:
 *   CONFLUENCE_BASE_URL   Pflicht. Cloud z.B. "https://deinteam.atlassian.net/wiki"
 *                         Server/Data Center z.B. "https://confluence.firma.de"
 *   CONFLUENCE_AUTH_MODE  "cloud" (Basic Auth mit E-Mail + API-Token) oder
 *                         "token" (Bearer Personal Access Token, für Server/Data Center)
 *   CONFLUENCE_EMAIL      Nur bei AUTH_MODE=cloud. Atlassian-Account-E-Mail.
 *   CONFLUENCE_API_TOKEN  API-Token (Cloud) bzw. Personal Access Token (Server/DC).
 *   CONFLUENCE_SPACE_KEY  Pflicht bei Neuanlage. Space-Key, in dem die Seite entstehen soll.
 *   CONFLUENCE_PARENT_ID  Optional. pageId einer übergeordneten Seite.
 *
 * Aufruf:
 *   Neue Seite anlegen:
 *     CONFLUENCE_BASE_URL=... CONFLUENCE_AUTH_MODE=cloud CONFLUENCE_EMAIL=... \
 *     CONFLUENCE_API_TOKEN=... CONFLUENCE_SPACE_KEY=HR \
 *     node publish-to-confluence.mjs --file output/mein-projekt-platform.storage.xml \
 *       --title "Mein Projekt Board"
 *
 *   Bestehende Seite aktualisieren:
 *     node publish-to-confluence.mjs --file output/mein-projekt-platform.storage.xml \
 *       --title "Mein Projekt Board" --update 123456789
 *
 * API-Token erzeugen (Cloud): https://id.atlassian.com/manage-profile/security/api-tokens
 * Personal Access Token (Server/Data Center): Profilbild → Einstellungen → Personal Access Tokens
 */

import { readFileSync } from "node:fs";

function parseArgs(argv) {
  const args = { file: null, title: null, update: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--file") args.file = argv[++i];
    else if (argv[i] === "--title") args.title = argv[++i];
    else if (argv[i] === "--update") args.update = argv[++i];
  }
  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Fehlende Umgebungsvariable: ${name}`);
    process.exit(1);
  }
  return value;
}

function authHeader() {
  const mode = requireEnv("CONFLUENCE_AUTH_MODE");
  const token = requireEnv("CONFLUENCE_API_TOKEN");
  if (mode === "cloud") {
    const email = requireEnv("CONFLUENCE_EMAIL");
    const basic = Buffer.from(`${email}:${token}`).toString("base64");
    return `Basic ${basic}`;
  }
  if (mode === "token") {
    return `Bearer ${token}`;
  }
  console.error('CONFLUENCE_AUTH_MODE muss "cloud" oder "token" sein.');
  process.exit(1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file || !args.title) {
    console.error("Nutzung: node publish-to-confluence.mjs --file <pfad.storage.xml> --title \"<Titel>\" [--update <pageId>]");
    process.exit(1);
  }

  const baseUrl = requireEnv("CONFLUENCE_BASE_URL").replace(/\/$/, "");
  const auth = authHeader();
  const storageValue = readFileSync(args.file, "utf8");

  const headers = {
    "Authorization": auth,
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  if (args.update) {
    const currentRes = await fetch(`${baseUrl}/rest/api/content/${args.update}`, { headers });
    if (!currentRes.ok) {
      console.error(`Konnte bestehende Seite nicht laden: ${currentRes.status} ${await currentRes.text()}`);
      process.exit(1);
    }
    const current = await currentRes.json();
    const nextVersion = current.version.number + 1;

    const updateRes = await fetch(`${baseUrl}/rest/api/content/${args.update}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        id: args.update,
        type: "page",
        title: args.title,
        version: { number: nextVersion },
        body: { storage: { value: storageValue, representation: "storage" } },
      }),
    });
    if (!updateRes.ok) {
      console.error(`Update fehlgeschlagen: ${updateRes.status} ${await updateRes.text()}`);
      process.exit(1);
    }
    const updated = await updateRes.json();
    console.log(`Seite aktualisiert: ${baseUrl}${updated._links.webui}`);
    return;
  }

  const spaceKey = requireEnv("CONFLUENCE_SPACE_KEY");
  const body = {
    type: "page",
    title: args.title,
    space: { key: spaceKey },
    body: { storage: { value: storageValue, representation: "storage" } },
  };
  if (process.env.CONFLUENCE_PARENT_ID) {
    body.ancestors = [{ id: process.env.CONFLUENCE_PARENT_ID }];
  }

  const createRes = await fetch(`${baseUrl}/rest/api/content`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    console.error(`Anlegen fehlgeschlagen: ${createRes.status} ${await createRes.text()}`);
    process.exit(1);
  }
  const created = await createRes.json();
  console.log(`Seite angelegt: ${baseUrl}${created._links.webui}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
