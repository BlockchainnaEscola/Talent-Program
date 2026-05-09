// api/submit.js — Vercel Serverless Function
// Commit no Talent-Program via GitHub API

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name, bio, location, github, wallet, cohort, skills, tracks, isMiniPay } = req.body;

  if (!wallet || !name) {
    return res.status(400).json({ error: "wallet e name são obrigatórios" });
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const GITHUB_OWNER = process.env.GITHUB_OWNER || "BlockchainnaEscola";
  const GITHUB_REPO  = process.env.GITHUB_REPO  || "Talent-Program";

  const filePath = `builders/${wallet.toLowerCase()}.md`;
  const fileContent = `# ${name}

**Wallet:** \`${wallet}\`
**Cohort:** ${cohort || "—"}
**Location:** ${location || "—"}
**GitHub:** ${github || "—"}
**MiniPay:** ${isMiniPay ? "✓" : "—"}

## Bio
${bio || "—"}

## Skills
${skills && skills.length ? skills.map((s) => `- ${s}`).join("\n") : "—"}

## Trilhas Concluídas
${tracks && tracks.length ? tracks.map((t) => `- ${t}`).join("\n") : "—"}

---
*Registered via BnE Talent Hub · ${new Date().toISOString().split("T")[0]}*
`;

  const contentB64 = Buffer.from(fileContent).toString("base64");

  try {
    // Verifica se arquivo já existe (pega sha para update)
    let sha = undefined;
    const checkRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json"
        }
      }
    );
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }

    // Cria ou atualiza o arquivo
    const commitRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `feat: add builder ${name} (${wallet.slice(0, 8)})`,
          content: contentB64,
          ...(sha ? { sha } : {})
        })
      }
    );

    if (!commitRes.ok) {
      const err = await commitRes.json();
      throw new Error(err.message || "GitHub API error");
    }

    return res.status(200).json({ ok: true, github: "ok" });

  } catch (err) {
    console.error("GitHub commit error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
