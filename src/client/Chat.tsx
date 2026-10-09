import { useEffect, useState, useRef } from "react";
import { Send, Paperclip, Plus, Copy } from "lucide-react";
import type { AgentId, CaseRecord, User, AgentEvent } from "../shared/types";
import { api, stream, ducks, avatar, character } from "./api";
import { Modal, Empty } from "./components";
export type Mutate = (
  path: string,
  method: string,
  body?: unknown,
) => Promise<boolean>;
export function Chat({
  record,
  role,
  user,
  refresh,
  mutate,
  go,
  notify,
}: {
  record: CaseRecord | null;
  role?: AgentId;
  user: User;
  refresh: () => Promise<void>;
  mutate: Mutate;
  go: (r: string) => void;
  notify: (s: string) => void;
}) {
  const [text, setText] = useState(""),
    [target, setTarget] = useState<AgentId | undefined>(role === "butler" ? undefined : role),
    [busy, setBusy] = useState(false),
    [event, setEvent] = useState<AgentEvent | null>(null),
    [controller, setController] = useState<AbortController | null>(null),
    [modal, setModal] = useState(""),
    [error, setError] = useState("");
  const workflowId = useRef<string | undefined>(undefined);
  const d = ducks.find((d) => d.id === role);
  const failedRun = record?.runs.filter((r) => r.status === "failed").at(-1);
  useEffect(() => {
    setTarget(role === "butler" ? undefined : role);
    if (record) {
      const pending = sessionStorage.getItem("whyduck-pending-" + record.id);
      setText(pending || "");
      if (pending) sessionStorage.removeItem("whyduck-pending-" + record.id);
    }
  }, [record?.id, role]);
  async function send(retry?: string) {
    if (!record) return;
    if (!user.aiConsent) {
      setModal("consent");
      return;
    }
    const abort = new AbortController();
    setController(abort);
    setBusy(true);
    setError("");
    setEvent(null);
    workflowId.current = undefined;
    let routedToMeeting = false;
    try {
      await stream(
        `/cases/${record.id}/${retry ? "retry" : "messages"}`,
        retry
          ? { runId: retry }
          : {
              message: text.trim(),
              target,
              mode: role && role !== "butler" ? "direct" : "group",
              requestId: crypto.randomUUID(),
            },
        (e) => {
          setEvent(e);
          if (e.type === "route" && e.runId) workflowId.current = e.runId;
          if (e.type === "route" && role === "butler") routedToMeeting = true;
          if (e.type === "error") setError(e.message || "处理失败");
          if (e.type === "result")
            void refresh().catch((error: Error) => setError(error.message));
        },
        abort.signal,
      );
      if (!retry) setText("");
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message);
    } finally {
      setBusy(false);
      await refresh().catch((e) => setError(e.message));
      if (routedToMeeting) go("meeting");
    }
  }
  return (
    <>
      {d && (
        <section className="role-hero" style={{ background: d.color }}>
          <img src={character(d.id)} alt={d.name} />
          <div>
            <h1>
              {d.name} · {d.desc}
            </h1>
            <p>{d.role}</p>
            <div className="role-specialty">
              {d.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className={"chat-shell " + (role ? "compact-chat" : "")}>
        <header className="chat-header">
          <div>
            <h2>
              {role ? d?.name : "鸭鸭开会"} ·{" "}
              {record?.title || "选择案件后开始"}
            </h2>
            <p>
              {record?.demo
                ? "示例案件 · 仅展示预制结果；处理新材料请创建真实案件"
                : "真实案件 · 关键事实需由你确认"}
            </p>
          </div>
          <div className="top-actions">
            <button onClick={() => setModal("members")}>邀请成员</button>
            <button
              className="mobile-sheet-trigger"
              onClick={() => setModal("panel")}
            >
              办事单
            </button>
          </div>
        </header>
        <div className="chat-body">
          <div className="conversation">
            <div className="messages" aria-live="polite">
              {!record ? (
                <Empty text="先新建或选择一个案件" />
              ) : !record.messages.length ? (
                <div className="notice">
                  把事情按你的方式说出来，鸭鸭会依据真实材料协作。
                </div>
              ) : (
                record.messages.map((m) => (
                  <article
                    key={m.id}
                    className={"message " + (m.role === "user" ? "user" : "")}
                  >
                    {m.agentId && (
                      <img
                        className="avatar"
                        src={avatar(m.agentId)}
                        alt={ducks.find((d) => d.id === m.agentId)?.name}
                      />
                    )}
                    <div className="message-content">
                      <div className="message-label">
                        {m.role === "user"
                          ? "你"
                          : m.agentId
                            ? ducks.find((d) => d.id === m.agentId)?.name
                            : "系统"}{" "}
                        · {m.mode === "demo" ? "示例" : "实时"}
                        <time>
                          {new Date(m.createdAt).toLocaleString("zh-CN")}
                        </time>
                      </div>
                      <div className="bubble">
                        {m.content}
                        {(record.runs.find((run) => run.id === m.runId)?.validationCorrections || 0) > 0 && (
                          <p className="small muted">
                            校验纠正 {record.runs.find((run) => run.id === m.runId)?.validationCorrections} 次
                          </p>
                        )}
                        {m.citations.map((c, i) => (
                          <button
                            className="citation"
                            key={i}
                            onClick={() =>
                              go("evidence-detail/" + c.evidenceId)
                            }
                            title={c.quote}
                          >
                            {record.evidence.find((e) => e.id === c.evidenceId)
                              ?.code || "材料引用"}
                          </button>
                        ))}
                        {m.result && (
                          <div className="result-card">
                            <h4>协作结果</h4>
                            {m.result.missingEvidence.map((x) => (
                              <p key={x}>待补充：{x}</p>
                            ))}
                            {m.result.suggestedMembers.map((id) => (
                              <button
                                key={id}
                                onClick={() =>
                                  mutate(`/cases/${record.id}`, "PATCH", {
                                    members: [
                                      ...new Set([...record.members, id]),
                                    ],
                                  })
                                }
                              >
                                邀请 {ducks.find((d) => d.id === id)?.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              )}
              {busy && (
                <div className="notice">
                  <span className="spinner" />
                  {event?.agentId
                    ? ducks.find((d) => d.id === event.agentId)?.name
                    : "管家鸭"}
                  正在处理真实材料…
                </div>
              )}
              {event?.type === "cancelled" && <div className="notice" role="status">本次处理已取消，已保存的材料与结果保留。</div>}
              {error && (
                <div className="notice red" role="alert">
                  {error}
                  {failedRun ? (
                    <button onClick={() => send(failedRun.id)}>
                      重试失败任务
                    </button>
                  ) : (
                    <button disabled={!text.trim()} onClick={() => send()}>
                      重新尝试发送
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="chat-composer">
              <textarea
                aria-label="聊天消息"
                placeholder="说说新情况，或选择一只鸭鸭继续处理…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (text.trim() && !busy) void send();
                  }
                }}
              />
              <div className="composer-actions">
                <div className="composer-tools">
                  <button onClick={() => go("evidence")}>
                    <Paperclip size={15} /> 上传截图
                  </button>
                  <select
                    aria-label="指定鸭鸭"
                    value={target || ""}
                    onChange={(e) =>
                      setTarget((e.target.value as AgentId) || undefined)
                    }
                  >
                    {(!role || role === "butler") && <option value="">@ 自动分工</option>}
                    {ducks.map((d) => (
                      <option key={d.id} value={d.id}>
                        @ {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                {busy ? (
                  <button
                    onClick={async () => {
                      try {
                        if ((workflowId.current || event?.runId) && record)
                          await api(`/cases/${record.id}/runs/${workflowId.current || event?.runId}/cancel`,"POST");
                        setEvent({type:"cancelled",message:"你已取消本次处理"});
                        notify("已取消处理，已有材料仍保留");
                      } catch(e) {
                        notify((e as Error).message);
                      } finally {
                        controller?.abort();
                        setBusy(false);
                        await refresh().catch(e=>setError(e.message));
                      }
                    }}
                  >
                    取消
                  </button>
                ) : (
                  <button
                    className="primary"
                    disabled={!record || !text.trim()}
                    onClick={() => send()}
                  >
                    发送 <Send size={15} />
                  </button>
                )}
              </div>
              <div className="privacy-note">
                Ctrl + Enter 发送 · AI 处理需要同意第三方模型处理 ·
                草稿由你核对后自行使用
              </div>
            </div>
          </div>
          <aside className="case-panel">
            <CasePanel record={record} go={go} mutate={mutate} />
          </aside>
        </div>
      </section>
      {modal && (
        <Modal
          title={
            modal === "members"
              ? "邀请鸭鸭"
              : modal === "consent"
                ? "AI 材料处理授权"
                : "鸭鸭办事单"
          }
          close={() => setModal("")}
        >
          {modal === "members" ? (
            ducks.map((d) => (
              <label className="member-row" key={d.id}>
                <img src={avatar(d.id)} alt={d.name} />
                <div>
                  <h4>{d.name}</h4>
                  <p>{d.role}</p>
                </div>
                <input
                  type="checkbox"
                  checked={record?.members.includes(d.id) || false}
                  disabled={!record || d.id === "butler"}
                  onChange={(e) =>
                    record &&
                    mutate(`/cases/${record.id}`, "PATCH", {
                      members: e.target.checked
                        ? [...record.members, d.id]
                        : record.members.filter((id) => id !== d.id),
                    })
                  }
                />
              </label>
            ))
          ) : modal === "consent" ? (
            <>
              <p>
                同意后，你主动提交的案件文字及图片会发送给已配置的第三方 AI
                模型，用于分析。请先去掉不必要的个人信息。
              </p>
              <button
                className="primary"
                onClick={async () => {
                  try {
                    await api("/profile", "PATCH", { aiConsent: true });
                    notify("已同意，请再次发送");
                    setModal("");
                    await refresh();
                  } catch (e) {
                    notify((e as Error).message);
                  }
                }}
              >
                同意 AI 处理
              </button>
              <button onClick={() => setModal("")}>暂不使用</button>
            </>
          ) : (
            <CasePanel record={record} go={go} mutate={mutate} />
          )}
        </Modal>
      )}
    </>
  );
}
export function CasePanel({
  record,
  go,
  mutate,
}: {
  record: CaseRecord | null;
  go: (r: string) => void;
  mutate: Mutate;
}) {
  return (
    <>
      <section className="panel-section">
        <h3>鸭鸭办事单</h3>
        <div className="case-summary">
          <h4>{record?.title || "还没有选择案件"}</h4>
          <p>
            事实版本 {record?.factRevision || 0} ·{" "}
            {record?.demo ? "示例" : "私有案件"}
          </p>
        </div>
        {record?.tasks.map((t) => (
          <div className="task" key={t.id}>
            <input
              aria-label={"完成 " + t.title}
                type="checkbox"
                disabled={t.status === "proposed"}
                checked={t.status === "done"}
              onChange={(e) =>
                mutate(`/cases/${record.id}/tasks/${t.id}`, "PATCH", {
                  status: e.target.checked ? "done" : "pending",
                })
              }
            />
            <div>
              <strong>{t.title}</strong>
              <p>
                {t.status === "proposed"
                  ? "AI 建议，待确认"
                  : t.status === "done"
                    ? "已完成"
                    : "待办"}{" "}
                {t.dueAt && new Date(t.dueAt).toLocaleDateString("zh-CN")}
              </p>
              {t.status === "proposed" && (
                <button
                  onClick={() =>
                    mutate(`/cases/${record.id}/tasks/${t.id}`, "PATCH", {
                      status: "pending",
                    })
                  }
                >
                  确认任务
                </button>
              )}
            </div>
          </div>
        ))}
      </section>
      <section className="panel-section">
        <h3>消费凭证盒</h3>
        {record?.evidence.map((e) => (
          <button
            className="evidence-mini"
            key={e.id}
            onClick={() => go("evidence-detail/" + e.id)}
          >
            {e.code} · {e.filename}
            <br />
            {e.confirmed ? "已确认" : "待核对"}
          </button>
        ))}
        <button onClick={() => go("evidence")}>
          <Plus size={14} /> 补充材料
        </button>
      </section>
      <button onClick={() => go("drafts")}>
        <Copy size={14} /> 沟通草稿
      </button>
      <button onClick={() => go("report")}>核对并导出报告</button>
    </>
  );
}
