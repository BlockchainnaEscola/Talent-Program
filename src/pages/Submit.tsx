import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { ALL_TRACKS } from "@/data/builders";
import { useMiniPay } from "@/hooks/useMiniPay";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2 } from "lucide-react";

const GITHUB_TOKEN  = import.meta.env.VITE_GITHUB_TOKEN as string;
const GITHUB_OWNER  = import.meta.env.VITE_GITHUB_OWNER as string;
const GITHUB_REPO   = import.meta.env.VITE_GITHUB_REPO  as string;
const GITHUB_BRANCH = "main";

async function commitBuilderToGitHub(builder: {
  name: string; bio: string; location: string; github: string;
  wallet: string; skills: string[]; tracks: string[]; cohort: string;
}) {
  const slug     = builder.wallet.toLowerCase().replace(/[^a-z0-9]/g, "");
  const filePath = `builders/${slug}.md`;
  const date     = new Date().toISOString().split("T")[0];

  const content = [
    `# ${builder.name}`,
    ``,
    `| Campo | Valor |`,
    `|---|---|`,
    `| **Wallet** | \`${builder.wallet}\` |`,
    `| **Cohort** | ${builder.cohort || "—"} |`,
    `| **Localização** | ${builder.location || "—"} |`,
    `| **GitHub** | ${builder.github ? `[${builder.github}](${builder.github})` : "—"} |`,
    `| **Registered** | ${date} |`,
    ``,
    `## Bio`,
    ``,
    builder.bio || "—",
    ``,
    `## Skills`,
    ``,
    builder.skills.length > 0 ? builder.skills.map((s) => `- ${s}`).join("\n") : "—",
    ``,
    `## Trilhas`,
    ``,
    builder.tracks.length > 0 ? builder.tracks.map((t) => `- ${t}`).join("\n") : "—",
    ``,
    `---`,
    `*Registered via BnE Talent Hub — [bne-talent-hub.vercel.app](https://bne-talent-hub.vercel.app)*`,
  ].join("\n");

  const encoded = btoa(unescape(encodeURIComponent(content)));

  let sha: string | undefined;
  try {
    const check = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
      { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json" } }
    );
    if (check.ok) sha = (await check.json()).sha;
  } catch { /* new file */ }

  const body: Record<string, unknown> = {
    message: `feat: add builder ${builder.name} (${builder.wallet.slice(0, 8)}...)`,
    content: encoded,
    branch: GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${filePath}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? "GitHub commit failed");
  }
}

const SKILL_OPTIONS = [
  "Solidity", "TypeScript", "React", "viem", "wagmi",
  "Foundry", "Python", "Rust", "Figma", "DeFi", "MiniPay",
];

const COHORT_OPTIONS = [
  "W3T — Belo Horizonte",
  "BnE @ UNIFACS — Salvador",
  "Mulheres que Codam — Rio de Janeiro",
  "EduLatam",
  "Outro",
];

export default function Submit() {
  const { isMiniPay } = useMiniPay();
  const { address }   = useAccount();

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [name, setName]           = useState("");
  const [bio, setBio]             = useState("");
  const [location, setLocation]   = useState("");
  const [github, setGithub]       = useState("");
  const [wallet, setWallet]       = useState("");
  const [cohort, setCohort]       = useState("");
  const [skills, setSkills]       = useState<string[]>([]);
  const [tracks, setTracks]       = useState<string[]>([]);

  useEffect(() => {
    if (isMiniPay && address) setWallet(address);
  }, [isMiniPay, address]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !wallet) {
      toast({ title: "Preencha nome e endereço da carteira", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error: dbError } = await supabase.from("builders").insert({
        name, bio, location,
        github_url: github || null,
        wallet_address: wallet,
        skills, tracks,
      });
      if (dbError) {
        toast({ title: "Erro ao salvar perfil", description: dbError.message, variant: "destructive" });
        return;
      }
      try {
        await commitBuilderToGitHub({ name, bio, location, github, wallet, skills, tracks, cohort });
      } catch (ghErr) {
        console.warn("GitHub commit falhou (non-blocking):", ghErr);
      }
      setSubmitted(true);
    } catch (err) {
      toast({ title: "Erro inesperado", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="container max-w-xl px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">Perfil criado!</h1>
        <p className="mt-2 text-muted-foreground">
          Você está no pipeline de builders Web3 do Brasil.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Credenciais onchain serão emitidas pelo time do BnE.
        </p>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Cadastrar perfil</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Junte-se ao pipeline de builders Web3 do Brasil.
      </p>
      <Card className="mt-6 p-6">
        <form onSubmit={onSubmit} className="space-y-5">

          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Localização (cidade, estado)</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: Salvador, BA" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="github">GitHub do seu projeto</Label>
            <Input
              id="github"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              placeholder="https://github.com/..."
            />
            <p className="text-xs text-muted-foreground">
              Link do repositório — vira sua credencial verificável no BnE.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wallet">Carteira Celo</Label>
            <Input
              id="wallet"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x..."
              disabled={isMiniPay}
              required
            />
            {isMiniPay && (
              <p className="text-xs text-primary">Endereço MiniPay conectado automaticamente.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cohort">Turma</Label>
            <select
              id="cohort"
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione sua turma</option>
              {COHORT_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-2">
              {SKILL_OPTIONS.map((s) => {
                const active = skills.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(skills, setSkills, s)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Trilhas concluídas</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_TRACKS.map((t) => (
                <label key={t} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
                  <Checkbox
                    checked={tracks.includes(t)}
                    onCheckedChange={() => toggle(tracks, setTracks, t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Registrando…" : "Criar perfil"}
          </Button>

        </form>
      </Card>
    </div>
  );
}
