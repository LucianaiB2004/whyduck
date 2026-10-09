import { useEffect, useState } from "react";
import type { User, Capabilities } from "../shared/types";
import { api, avatar } from "./api";
import { Field } from "./components";
export function Account({
  page,
  user,
  capabilities,
  refresh,
  go,
  notify,
}: {
  page: string;
  user: User | null;
  capabilities: Capabilities | null;
  refresh: () => Promise<void>;
  go: (r: string) => void;
  notify: (s: string) => void;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(user?.name || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [tokens, setTokens] = useState<
      { id: string; label: string; createdAt: string }[]
    >([]),
    [token, setToken] = useState(""),
    [tokensLoading, setTokensLoading] = useState(true),
    [label, setLabel] = useState("MCP 个人连接"),
    [platform, setPlatform] = useState<{
      configured: boolean;
      linked: boolean;
      status: string;
      note: string;
    } | null>(null);
  useEffect(() => {
    if (user) {
      setTokensLoading(true);
      void api<{ tokens: typeof tokens }>("/auth/tokens")
        .then((r) => setTokens(r.tokens))
        .catch((e) => setError(e.message))
        .finally(()=>setTokensLoading(false));
      void api<typeof platform>("/alipay/status")
        .then(setPlatform)
        .catch((e) => setError(e.message));
    }
  }, [user?.id]);
  async function auth() {
    setBusy(true);
    setError("");
    try {
      await api(
        "/auth/" + (page === "register" ? "register" : "login"),
        "POST",
        page === "register" ? { email, password, name } : { email, password },
      );
      await refresh();
      go("home");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!user || page === "login" || page === "register")
    return (
      <section className="card auth-card">
        <a className="brand" href="#home">
          <span className="brandmark">
            <img src={avatar("analyst")} alt="凭啥鸭" />
          </span>
          凭啥鸭
        </a>
        <h2>{page === "register" ? "创建你的鸭鸭账户" : "欢迎回到鸭鸭局"}</h2>
        <p>登录后保存私有案件、材料和进展</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void auth();
          }}
        >
          {page === "register" && (
            <Field label="昵称">
              <input
                required
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
          )}
          <Field label="邮箱">
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="密码">
            <input
              required
              type="password" aria-label="密码"
              minLength={12}
              autoComplete={
                page === "register" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small>至少 12 位字符</small>
          </Field>
          {error && (
            <p role="alert" className="notice red">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy}>
            {busy ? "正在处理…" : page === "register" ? "注册并登录" : "登录"}
          </button>
        </form>
        <button
          className="link"
          onClick={() => go(page === "register" ? "login" : "register")}
        >
          {page === "register" ? "已有账户，去登录" : "没有账户，去注册"}
        </button>
      </section>
    );
  return (
    <div className="grid-two">
      <section className="card">
        <h3>账户与隐私</h3>
        <p>{user.email}</p>
        <Field label="昵称">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <button
          onClick={async () => {
            try {
              await api("/profile", "PATCH", { name });
              await refresh();
              notify("昵称已保存");
            } catch (e) {
              notify((e as Error).message);
            }
          }}
        >
          保存昵称
        </button>
        <div className="settings-row">
          <div>
            <strong>第三方 AI 材料处理</strong>
            <p>主动提交的案件文字与图片发送给已配置模型。可随时撤回同意。</p>
          </div>
          <input
            type="checkbox"
            aria-label="同意 AI 材料处理"
            checked={user.aiConsent}
            onChange={async (e) => {
              try {
                await api("/profile", "PATCH", { aiConsent: e.target.checked });
                await refresh();
              } catch (err) {
                notify((err as Error).message);
              }
            }}
          />
        </div>
        <div className="settings-row">
          <div>
            <strong>真实模型接入</strong>
            <p>
              {capabilities?.aiConfigured
                ? "已配置"
                : "未配置，处理请求会明确失败"}{" "}
              · 文本：{capabilities?.textModel || "未配置"} · 视觉：
              {capabilities?.visionConfigured ? "已配置" : "未配置"}
            </p>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <strong>支付宝账户关联</strong>
            <p>{platform?.note || "正在查询平台状态…"}</p>
            <p>
              {platform?.configured ? "已配置平台" : "未配置平台"} ·{" "}
              {platform?.linked ? "已关联" : "未关联"}
            </p>
          </div>
          {platform?.linked ? (
            <button
              onClick={async () => {
                if (confirm("解除支付宝身份关联？不会删除售后案件。")) {
                  try {
                    await api("/alipay/link", "DELETE");
                    setPlatform(await api("/alipay/status"));
                    notify("已解除身份关联");
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }
              }}
            >
              解除关联
            </button>
          ) : (
            <button
              disabled={!platform?.configured}
              onClick={async () => {
                try {
                  const result = await api<{ url: string }>(
                    "/alipay/authorize",
                    "POST",
                  );
                  const url = new URL(result.url);
                  if (
                    url.protocol !== "https:" ||
                    url.hostname !== "openauth.alipay.com"
                  )
                    throw Error("平台授权地址无效");
                  location.assign(url.href);
                } catch (e) {
                  notify((e as Error).message);
                }
              }}
            >
              关联支付宝
            </button>
          )}
        </div>
        <p className="notice">
          平台与模型密钥由服务端管理员配置，网页不会接收或存储供应商密钥。
        </p>
        <button
          className="danger"
          onClick={async () => {
            await api("/auth/logout", "POST");
            setToken("");
            await refresh();
            go("login");
          }}
        >
          退出账户
        </button>
      </section>
      <section className="card">
        <h3>MCP / 账户访问令牌</h3>
        <p>
          签发的令牌拥有当前账户权限。明文只显示一次，请保存在自己的客户端。
        </p>
        <Field label="令牌名称">
          <input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <button
          disabled={!label.trim() || tokensLoading}
          onClick={async () => {
            try {
              const r = await api<{ token: string; id: string }>(
                "/auth/tokens",
                "POST",
                { label },
              );
              setToken(r.token);
              setTokens(previous=>[...previous,{id:r.id,label,createdAt:new Date().toISOString()}]);
              const list = await api<{ tokens: typeof tokens }>("/auth/tokens");
              setTokens(list.tokens);
            } catch (e) {
              notify((e as Error).message);
            }
          }}
        >
          签发访问令牌
        </button>
        {token && (
          <div className="notice">
            <p>仅本次显示，请勿分享</p>
            <textarea aria-label="新访问令牌" readOnly value={token} />
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(token)
                  .then(() => notify("令牌已复制"))
              }
            >
              复制
            </button>
            <button onClick={() => setToken("")}>隐藏明文</button>
          </div>
        )}
        {tokens.map((t) => (
          <div className="settings-row" key={t.id}>
            <div>
              <strong>{t.label}</strong>
              <p>{new Date(t.createdAt).toLocaleString("zh-CN")}</p>
            </div>
            <button
              className="danger"
              onClick={async () => {
                if (
                  confirm("撤销后使用此令牌的客户端将失去访问权限，确认撤销？")
                ) {
                  await api("/auth/tokens/" + t.id, "DELETE");
                  setTokens(tokens.filter((x) => x.id !== t.id));
                }
              }}
            >
              撤销
            </button>
          </div>
        ))}
        {error && <p role="alert">{error}</p>}
        <h3>参考来源</h3>
        {capabilities?.legalSources.map((s) => (
          <p key={s.url}>
            <a className="link" href={s.url} target="_blank" rel="noreferrer">
              {s.title}
            </a>
            <br />
            <small>{s.note}</small>
          </p>
        ))}
      </section>
    </div>
  );
}
