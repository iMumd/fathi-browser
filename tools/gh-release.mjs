#!/usr/bin/env node
// Minimal GitHub release helper. Requires GH_TOKEN in the environment.
// Usage:
//   node tools/gh-release.mjs create <tag> <name> <bodyFile> [target]
//   node tools/gh-release.mjs upload <tag> <file...>
//   node tools/gh-release.mjs list
import fs from "node:fs";
import path from "node:path";

const API = "https://api.github.com/repos/iMumd/fathi-browser";
const token = process.env.GH_TOKEN;
if (!token) {
  console.error("GH_TOKEN is required");
  process.exit(1);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "fathi-release",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function releaseFor(tag) {
  const releases = await api(`${API}/releases?per_page=100`);
  return releases.find((r) => r.tag_name === tag);
}

const [command, ...args] = process.argv.slice(2);

if (command === "create") {
  const [tag, name, bodyFile, target] = args;
  const body = fs.readFileSync(bodyFile, "utf8");
  const existing = await releaseFor(tag);
  if (existing) {
    console.log(`release ${tag} already exists: ${existing.html_url}`);
    process.exit(0);
  }
  const release = await api(`${API}/releases`, {
    method: "POST",
    body: JSON.stringify({
      tag_name: tag,
      target_commitish: target,
      name,
      body,
      draft: false,
      prerelease: false,
      make_latest: "true",
    }),
  });
  console.log(`created ${release.html_url}`);
} else if (command === "upload") {
  const [tag, ...files] = args;
  const release = await releaseFor(tag);
  if (!release) throw new Error(`release ${tag} not found`);
  for (const file of files) {
    const name = path.basename(file);
    const existing = release.assets.find((a) => a.name === name);
    if (existing) {
      console.log(`skip ${name} (already uploaded)`);
      continue;
    }
    const size = fs.statSync(file).size;
    const buffer = fs.readFileSync(file);
    console.log(`uploading ${name} (${(size / 1048576).toFixed(1)} MiB)`);
    const uploadUrl = `https://uploads.github.com/repos/iMumd/fathi-browser/releases/${release.id}/assets?name=${encodeURIComponent(name)}`;
    const asset = await api(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "Content-Length": String(size) },
      body: buffer,
    });
    console.log(`uploaded ${asset.name} -> ${asset.browser_download_url}`);
  }
} else if (command === "list") {
  const releases = await api(`${API}/releases`);
  for (const r of releases) {
    console.log(`${r.tag_name}\t${r.draft ? "draft" : "published"}\tassets=${r.assets.length}\t${r.html_url}`);
  }
} else {
  console.error("unknown command");
  process.exit(1);
}
