import { useEffect, useState } from "react";
import {
  Home,
  MessagesSquare,
  Folder,
  FileImage,
  ListTodo,
  Settings,
  BookOpen,
  Bird,
  Plus,
  UserRound,
} from "lucide-react";
import type { AgentId, CaseRecord, User, Capabilities } from "../shared/types";
import { api, ducks, character, avatar } from "./api";
import { Chat } from "./Chat";
import { CaseTools } from "./CaseTools";
import { Modal, Field, Empty } from "./components";
import { Account } from "./Account";
const nav = [
  ["home", "首页", Home],
  ["butler", "管家鸭", Bird],
  ["meeting", "鸭鸭开会", MessagesSquare],
  ["cases", "我的案件", Folder],
  ["evidence", "消费凭证盒", FileImage],
  ["tasks", "跟进办事单", ListTodo],
  ["timeline", "证据时间线", Folder],
  ["drafts", "沟通草稿", MessagesSquare],
  ["report", "办事报告", FileImage],
  ["guide", "使用指南", BookOpen],
  ["brand", "品牌与角色", Bird],
  ["settings", "设置与隐私", Settings],
] as const;
const titles: Record<string, string> = { meeting: "鸭鸭开会",
  home: "你好呀，今天有什么需要鸭鸭帮忙？",
  cases: "我的案件",
  evidence: "消费凭证盒",
  timeline: "证据时间线",
  tasks: "跟进办事单",
  drafts: "沟通草稿",
  report: "核对并导出办事报告",
  guide: "鸭鸭使用指南",
  brand: "认识鸭鸭全家桶",
  settings: "设置与隐私",
  account: "账户",
  login: "登录",
  register: "注册",
  "case-detail": "案件详情",
};
export function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || "home"),
    [user, setUser] = useState<User | null>(null),
    [cap, setCap] = useState<Capabilities | null>(null),
    [cases, setCases] = useState<CaseRecord[]>([]),
    [selected, setSelected] = useState(
      sessionStorage.getItem("whyduck-case") || "",
    ),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState(""),
    [title, setTitle] = useState(""),
    [homeText, setHomeText] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [creating, setCreating] = useState(false);
  const record = cases.find((c) => c.id === selected) || null;
  const role = ducks.find((d) => d.id === route)?.id;
  const page = route.split("/")[0];
  function go(r: string) {
    location.hash = r;
    setRoute(r);
  }
  function notify(s: string) {
    setToast(s);
    setTimeout(() => setToast(""), 5000);
  }
  async function refresh() {
    const s = await api<{ user: User | null; capabilities: Capabilities }>(
      "/session",
    );
    setUser(s.user);
    setCap(s.capabilities);
    if (s.user) {
      const c = await api<{ cases: CaseRecord[] }>("/cases");
      setCases(c.cases);
      if (!c.cases.some((record) => record.id === selected))
        choose(c.cases[0]?.id || "");
    } else {
      setCases([]);
      choose("");
    }
  }
  function choose(id: string) {
    setSelected(id);
    sessionStorage.setItem("whyduck-case", id);
  }
  useEffect(() => {
    const listener = () => setRoute(location.hash.slice(1) || "home");
    addEventListener("hashchange", listener);
    void refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    return () => removeEventListener("hashchange", listener);
  }, []);
  async function mutate(path: string, method: string, body?: unknown) {
    try {
      await api(path, method, body);
      await refresh();
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  async function create(message = "", demo?: string) {
    if (!user) {
      go("login");
      notify("登录后创建私有案件");
      return;
    }
    setCreating(true);
    try {
      const r = await api<{ case: CaseRecord }>(
        demo ? "/cases/demo" : "/cases",
        "POST",
        demo
          ? { scenario: demo }
          : {
              title: title.trim() || message.slice(0, 32) || "新的售后案件",
              description: message,
            },
      );
      choose(r.case.id);
      if (message)
        sessionStorage.setItem("whyduck-pending-" + r.case.id, message);
      await refresh();
      setModal("");
      setTitle("");
      go("meeting");
      if (message) notify("案件已创建，请在聊天中发送并授权 AI 处理");
      setHomeText("");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setCreating(false);
    }
  }
  return (
    <>
      <div className="prototype-note">
        凭啥鸭 · 售后鸭鸭局{" "}
        <span>
          {cap?.aiConfigured
            ? "真实 AI 已配置"
            : "AI 尚未配置 · 案件与材料可真实保存"}
        </span>
      </div>
      <div className="layout">
        <aside className="sidebar">
          <a className="brand" href="#home">
            <span className="brandmark">
              <img src={avatar("analyst")} alt="凭啥鸭" />
            </span>
            <span>凭啥鸭</span>
            <small>AI</small>
          </a>
          <p className="brand-sub">你只管说事，鸭鸭组团办事！</p>
          <div className="nav-label">鸭鸭事务所</div>
          <nav>
            {nav.map(([id, label, Icon]) => (
              <a
                href={"#" + id}
                className={"nav-item " + (page === id ? "active" : "")}
                key={id}
                aria-current={page === id ? "page" : undefined}
              >
                <Icon className="icon" />
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <a className="sidebar-bottom" href={user ? "#account" : "#login"}>
            <UserRound size={23} />
            <span>
              {user?.name || "登录 / 注册"}
              <br />
              <small>{user ? "账户内私有案件" : "开始保存你的案件"}</small>
            </span>
          </a>
        </aside>
        <div className="workspace">
          {loading ? (
            <main className="main">
              <div className="notice">
                <span className="spinner" />
                正在加载账户和案件…
              </div>
            </main>
          ) : error ? (
            <main className="main">
              <div className="notice red" role="alert">
                {error}
                <button
                  onClick={() => {
                    setError("");
                    setLoading(true);
                    void refresh()
                      .catch((e) => setError(e.message))
                      .finally(() => setLoading(false));
                  }}
                >
                  重新连接
                </button>
              </div>
            </main>
          ) : (
            <main
              className={"main " + (page === "meeting" ? "meeting-main" : "")}
            >
              <header className="topbar">
                <div>
                  <div className="eyebrow">YOUR AFTER-SALES DUCK OFFICE</div>
                  <h2>
                    {role
                      ? ducks.find((d) => d.id === role)?.name
                      : titles[page] || "材料核对"}
                  </h2>
                </div>
                <div className="top-actions">
                  <button className="primary" onClick={() => setModal("new")}>
                    <Plus size={16} />
                    新建案件
                  </button>
                  <a href="#account">{user?.name || "登录"}</a>
                </div>
              </header>
              {user &&
                ![
                  "home",
                  "cases",
                  "brand",
                  "guide",
                  "settings",
                  "account",
                  "login",
                  "register",
                  "states",
                ].includes(page) && (
                  <div className="case-selector">
                    <label>
                      当前案件{" "}
                      <select
                        aria-label="当前案件"
                        value={selected}
                        onChange={(e) => choose(e.target.value)}
                      >
                        <option value="">选择案件</option>
                        {cases.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.title}
                            {c.demo ? " · 示例" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    {record && (
                      <button onClick={() => go("case-detail")}>
                        案件详情
                      </button>
                    )}
                  </div>
                )}
              {page === "home" && (
                <>
                  <section className="hero">
                    <div className="hero-content">
                      <span className="pill">管家鸭今日值班</span>
                      <h1>
                        这事儿，
                        <br />
                        凭啥呀？！
                      </h1>
                      <p>
                        退款难、客服绕、售后没下文？
                        <br />
                        把问题交给鸭鸭们，有理有据解决。
                      </p>
                      <div className="hero-actions">
                        <button
                          className="primary"
                          onClick={() => go("butler")}
                        >
                          找管家鸭帮忙 →
                        </button>
                        <button onClick={() => go("meeting")}>鸭鸭开会</button>
                      </div>
                    </div>
                    <img
                      className="hero-art"
                      src={character("butler")}
                      alt="管家鸭欢迎你"
                    />
                    <span className="hero-sticker">先吐槽，鸭来安排！</span>
                  </section>
                  <div className="composer-home">
                    <textarea
                      aria-label="描述售后问题"
                      placeholder="说说遇到的糟心事，先创建你的私有案件…"
                      value={homeText}
                      onChange={(e) => setHomeText(e.target.value)}
                    />
                    <button
                      className="primary"
                      disabled={!homeText.trim() || creating}
                      onClick={() => create(homeText)}
                    >
                      创建案件
                    </button>
                  </div>
                  <div className="examples">
                    {[
                      ["refund", "体验退款未到账"],
                      ["contradiction", "体验商家说法矛盾"],
                      ["evidence-missing", "体验证据不足"],
                      ["continue", "体验接续跟进"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        disabled={creating}
                        onClick={() => create("", id)}
                      >
                        {label} · 示例
                      </button>
                    ))}
                  </div>
                  <div className="section-head">
                    <div>
                      <h2>今天找哪只鸭？</h2>
                      <p>各有绝活，按需协作</p>
                    </div>
                    <a href="#brand">认识鸭鸭全家桶 →</a>
                  </div>
                  <div className="ducks-grid">
                    {ducks.map((d) => (
                      <article
                        className="duck-card"
                        style={{ background: d.color }}
                        key={d.id}
                      >
                        <div className="duck-copy">
                          <small>{d.role}</small>
                          <h3>{d.name}</h3>
                          <p>{d.desc}</p>
                          <button onClick={() => go(d.id)}>找它聊聊 ↗</button>
                        </div>
                        <img
                          src={character(d.id)}
                          alt={d.name + "，胸前佩戴全名名牌"}
                        />
                      </article>
                    ))}
                  </div>
                  <p className="caption">
                    情绪有出口，证据有出处，售后有后手。
                  </p>
                </>
              )}
              {(page === "meeting" || role) &&
                (user ? (
                  <Chat
                    record={record}
                    role={role}
                    user={user}
                    refresh={refresh}
                    mutate={mutate}
                    go={go}
                    notify={notify}
                  />
                ) : (
                  <Empty text="登录后即可建立案件，与鸭鸭协作" />
                ))}
              {page === "cases" && (
                <>
                  <div className="toolbar">
                    <div className="search">
                      <input
                        aria-label="搜索案件"
                        placeholder="搜索案件名称或商家"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="tabs">
                      {[
                        ["all", "全部"],
                        ["active", "处理中"],
                        ["archived", "已归档"],
                      ].map(([id, label]) => (
                        <button
                          key={id}
                          className={filter === id ? "selected" : ""}
                          onClick={() => setFilter(id)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid-three">
                    {cases
                      .filter(
                        (c) =>
                          (filter === "all" ||
                            (filter === "active"
                              ? c.status !== "archived"
                              : c.status === "archived")) &&
                          (c.title + c.merchant).includes(search),
                      )
                      .map((c) => (
                        <article className="card case-card" key={c.id}>
                          <span className="pill">
                            {c.demo ? "示例案件" : "私有案件"} ·{" "}
                            {c.status === "archived"
                              ? "已归档"
                              : c.status === "resolved"
                                ? "已解决"
                                : "处理中"}
                          </span>
                          <h3>{c.title}</h3>
                          <p>{c.request || "尚未填写诉求"}</p>
                          <p className="small muted">
                            {new Date(c.updatedAt).toLocaleString("zh-CN")}
                          </p>
                          <div className="horizontal-actions">
                            <button
                              onClick={() => {
                                choose(c.id);
                                go("meeting");
                              }}
                            >
                              继续处理 →
                            </button>
                            <button
                              onClick={() => {
                                const value = prompt("新的案件名称", c.title);
                                if (value?.trim())
                                  void mutate("/cases/" + c.id, "PATCH", {
                                    title: value.trim(),
                                  });
                              }}
                            >
                              重命名
                            </button>
                            <button
                              onClick={() =>
                                mutate("/cases/" + c.id, "PATCH", {
                                  status:
                                    c.status === "archived"
                                      ? "active"
                                      : "archived",
                                })
                              }
                            >
                              {c.status === "archived" ? "恢复" : "归档"}
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                if (
                                  confirm(
                                    "永久删除案件及全部私有材料？此操作不可恢复。",
                                  )
                                )
                                  void mutate("/cases/" + c.id, "DELETE", {
                                    confirmation: c.id,
                                  });
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                  {!cases.length && (
                    <Empty text="还没有案件，先把事情说给鸭鸭听" />
                  )}
                </>
              )}
              {[
                "evidence",
                "evidence-detail",
                "timeline",
                "tasks",
                "drafts",
                "report",
                "case-detail",
              ].includes(page) && (
                <CaseTools
                  key={record?.id || "no-case"}
                  page={route}
                  record={record}
                  mutate={mutate}
                  go={go}
                  notify={notify}
                />
              )}
              {["account", "login", "register", "settings"].includes(page) && (
                <Account
                  page={page}
                  user={user}
                  capabilities={cap}
                  refresh={refresh}
                  go={go}
                  notify={notify}
                />
              )}
              {page === "brand" && (
                <div className="brand-board">
                  {ducks.map((d) => (
                    <article
                      key={d.id}
                      className="brand-character"
                      style={{ background: d.color }}
                    >
                      <img src={character(d.id)} alt={d.name} />
                      <h3>{d.name}</h3>
                      <p>{d.role}</p>
                      <p>{d.tags.join(" · ")}</p>
                      <button onClick={() => go(d.id)}>和它聊聊</button>
                    </article>
                  ))}
                </div>
              )}
              {page === "guide" && (
                <section className="card">
                  {[
                    "注册或登录，创建独立售后案件",
                    "上传原始订单与客服材料，对照原图确认事实",
                    "选择专业鸭或开会，授权后才提交真实 AI",
                    "核对建议、确认办事任务，自行复制沟通草稿",
                    "补充新进展，事实更新后重新核对旧草稿",
                    "导出前核对待核实内容和脱敏选项",
                  ].map((text, i) => (
                    <div className="guide-step" key={text}>
                      <span className="step-number">{i + 1}</span>
                      <div>
                        <h4>{text}</h4>
                        <p>所有动作以你确认的材料和当前案件为依据。</p>
                      </div>
                    </div>
                  ))}
                  <div className="notice">
                    鸭鸭不替你作法律裁决、不保证退款、不自动向商家发消息。示例模式有明确标记。
                  </div>
                </section>
              )}
              {page === "states" && (
                <div className="card">
                  <h3>真实处理状态</h3>
                  <p>加载、上传、失败和取消状态会随实际操作出现。</p>
                  {record?.runs.map((r) => (
                    <p key={r.id}>
                      {ducks.find((d) => d.id === r.agentId)?.name} · {r.status}{" "}
                      · {r.error || r.summary}
                      {(r.validationCorrections || 0) > 0 &&
                        ` · 校验纠正 ${r.validationCorrections} 次`}
                    </p>
                  ))}
                </div>
              )}
            </main>
          )}
        </div>
      </div>
      <nav className="mobile-nav" aria-label="手机导航">
        {nav
          .filter((n) =>
            ["home", "meeting", "cases", "settings"].includes(n[0]),
          )
          .map(([id, label, Icon]) => (
            <a className={page === id ? "active" : ""} href={"#" + id} key={id}>
              <Icon className="icon" />
              {label}
            </a>
          ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {modal === "new" && (
        <Modal title="新建售后案件" close={() => setModal("")}>
          <Field label="案件名称">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：耳机退款未到账"
            />
          </Field>
          <button
            className="primary"
            disabled={!title.trim() || creating}
            onClick={() => create()}
          >
            {creating ? "正在创建…" : "创建私有案件"}
          </button>
        </Modal>
      )}
    </>
  );
}
