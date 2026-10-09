import { useEffect, useState } from "react";
import type {
  CaseRecord,
  Evidence,
  EvidenceExtraction,
  Draft,
} from "../shared/types";
import { ducks, avatar, uploadForm, evidenceDataUrl } from "./api";
import { Empty, Field } from "./components";
import type { Mutate } from "./Chat";
function EvidenceImage({path,evidence,original=false}:{path:string;evidence:Evidence;original?:boolean}) {
 const [source,setSource]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;setSource('');setError('');evidenceDataUrl(path).then(value=>{if(active)setSource(value);}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};},[path]);
 return <>{error?<p role="alert">{error}</p>:source?<img className={original?'original-image':undefined} src={source} alt={evidence.filename}/>:<p>正在加载原始材料…</p>}{original&&source&&<a className="link" href={source} download={evidence.filename}>下载原始文件</a>}</>;
}
export function CaseTools({
  page,
  record,
  mutate,
  go,
  notify,
}: {
  page: string;
  record: CaseRecord | null;
  mutate: Mutate;
  go: (r: string) => void;
  notify: (s: string) => void;
}) {
  const [uploadRequest, setUploadRequest] = useState<XMLHttpRequest | null>(
      null,
    ),
    [progress, setProgress] = useState<number | null>(null),
    [uploadError, setUploadError] = useState(""),
    [source, setSource] = useState(""),
    [sourceBusy, setSourceBusy] = useState(false),
    [filter, setFilter] = useState("all"),
    [task, setTask] = useState(""),
    [due, setDue] = useState(""),
    [tone, setTone] = useState<Draft["tone"]>("firm"),
    [text, setText] = useState(""),
    [draftId, setDraftId] = useState(""),
    [redact, setRedact] = useState(true),
    [reviewed, setReviewed] = useState(false),
    [factLabel, setFactLabel] = useState(""),
    [factValue, setFactValue] = useState(""),
    [factEvidence, setFactEvidence] = useState("");
  useEffect(() => {
    setReviewed(false);
  }, [record?.id, record?.updatedAt]);
  if (!record) return <Empty text="请选择一个案件，或先创建案件" />;
  const base = "/cases/" + record.id;
  function upload(file: File) {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setUploadError("仅支持 PNG/JPG/WebP，单张不超过 10 MB");
      return;
    }
    setProgress(0);
    setUploadError("");
    const xhr = new XMLHttpRequest();
    setUploadRequest(xhr);
    xhr.onloadend = () => setUploadRequest(null);
    xhr.onabort = () => {
      setProgress(null);
      setUploadError("已取消上传，可重新选择文件");
    };
    xhr.open("POST", "/api" + base + "/evidence");
    xhr.setRequestHeader("X-WhyDuck-Client", "web");
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status < 300) {
        void mutate(base, "GET");
        notify("材料已上传，等待人工核对");
      } else {
        try {
          setUploadError(JSON.parse(xhr.responseText).error.message);
        } catch {
          setUploadError("上传失败");
        }
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setUploadError("网络异常，请重试上传");
    };
    const data = new FormData();
    data.append("file", file);
    xhr.send(data);
  }
  if (page.startsWith("evidence-detail/")) {
    const evidence = record.evidence.find((e) => e.id === page.split("/")[1]);
    return evidence ? (
      <EvidenceDetail
        key={evidence.id}
        evidence={evidence}
        base={base}
        mutate={mutate}
      />
    ) : (
      <Empty text="材料不存在" />
    );
  }
  if (page === "evidence")
    return (
      <>
        <section
          className="upload-zone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) upload(e.dataTransfer.files[0]);
          }}
        >
          <strong>把订单、付款凭证或客服截图放这里</strong>
          <p>PNG、JPG、WebP · 单张不超过 10 MB · 私有存储</p>
          <label className="upload-button">
            选择文件
            <input
              aria-label="上传材料"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={progress !== null}
              onChange={(e) => {
                if (e.target.files?.[0]) upload(e.target.files[0]);
                e.target.value = "";
              }}
            />
          </label>
          {progress !== null && (
            <>
              <progress aria-label="上传进度" value={progress} max={100} />
              <button onClick={() => uploadRequest?.abort()}>取消上传</button>
            </>
          )}{" "}
          {uploadError && <p role="alert">{uploadError}</p>}
        </section>
        <div className="toolbar">
          <select
            aria-label="材料筛选"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">全部材料</option>
            <option value="proposed">待核对</option>
            <option value="confirmed">已确认</option>
          </select>
        </div>
        <div className="grid-three">
          {record.evidence
            .filter(
              (e) =>
                filter === "all" || e.confirmed === (filter === "confirmed"),
            )
            .map((e) => (
              <article className="card evidence-card" key={e.id}>
                <div className="evidence-preview">
                  {e.sourceType === "image" ? (
                    <EvidenceImage path={base+"/evidence/"+e.id+"/file"} evidence={e} />
                  ) : (
                    <p>{e.sourceText?.slice(0, 100)}</p>
                  )}
                </div>
                <h3>
                  {e.code} · {e.filename}
                </h3>
                <p>{e.confirmed ? "已人工确认" : "待人工核对"}</p>
                <button onClick={() => go("evidence-detail/" + e.id)}>
                  查看与核对
                </button>
              </article>
            ))}
        </div>
        <section className="card">
          <h3>添加文字材料</h3>
          <Field label="粘贴原始沟通记录">
            <textarea
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </Field>
          <button
            disabled={!source.trim() || sourceBusy}
            onClick={async () => {
              setSourceBusy(true);
              try {
                const form = new FormData();
                form.append("sourceText", source);
                form.append("filename", "用户提供的沟通记录.txt");
                await uploadForm(base + "/evidence", form);
                await mutate(base, "GET");
                setSource("");
                notify("原始记录已保存");
              } catch (e) {
                notify((e as Error).message);
              } finally {
                setSourceBusy(false);
              }
            }}
          >
            保存原始记录
          </button>
        </section>
      </>
    );
  if (page === "timeline" || page === "case-detail")
    return (
      <>
        {page === "case-detail" && (
          <section className="card">
            <h3>案件基础资料 · 用户记录</h3>
            {(
              [
                ["merchant", "商家"],
                ["product", "商品"],
                ["amount", "金额"],
                ["purchaseDate", "购买日期"],
                ["request", "主要诉求"],
                ["category", "问题类别"],
              ] as const
            ).map(([key, label]) => (
              <Field key={record.id + key} label={label}>
                <input
                  defaultValue={record[key]}
                  onBlur={(e) => {
                    if (e.target.value !== record[key])
                      void mutate(base, "PATCH", { [key]: e.target.value });
                  }}
                />
              </Field>
            ))}
            <Field label="处理状态">
              <select
                value={record.status}
                onChange={(e) =>
                  mutate(base, "PATCH", { status: e.target.value })
                }
              >
                <option value="active">处理中</option>
                <option value="waiting">等待回复</option>
                <option value="resolved">已解决</option>
                <option value="archived">已归档</option>
              </select>
            </Field>
            <p className="small muted">
              修改字段后离开输入框自动保存；确认事实请在下方逐条核对。
            </p>
          </section>
        )}
        <div className="horizontal-actions">
          <button onClick={() => go("meeting")}>继续处理</button>
          <button onClick={() => go("evidence")}>补充材料</button>
          <button onClick={() => go("drafts")}>沟通草稿</button>
        </div>
        <section className="card">
          <h3>案件事实与证据时间线</h3>
          <div className="timeline">
            {record.facts.map((f) => (
              <article className="timeline-item" key={f.id}>
                <span className="pill">
                  {f.status === "confirmed" ? "已确认" : "待确认"} ·{" "}
                  {f.origin === "ai" ? "AI 提取" : "用户记录"}
                </span>
                <h4>{f.label}</h4>
                <input
                  aria-label={"编辑事实 " + f.label}
                  defaultValue={f.value}
                  onBlur={(e) => {
                    if (e.target.value !== f.value)
                      void mutate(base + "/facts/" + f.id, "PATCH", {
                        value: e.target.value,
                        status: "proposed",
                      });
                  }}
                />
                {f.evidenceId && (
                  <button onClick={() => go("evidence-detail/" + f.evidenceId)}>
                    查看出处：
                    {record.evidence.find((e) => e.id === f.evidenceId)?.code}
                  </button>
                )}
                <p>{f.quote}</p>
                {f.status === "proposed" && (
                  <button
                    onClick={() =>
                      mutate(base + "/facts/" + f.id, "PATCH", {
                        status: "confirmed",
                      })
                    }
                  >
                    确认事实
                  </button>
                )}
                <button
                  className="danger"
                  onClick={() => {
                    if (confirm("删除这条事实？相关分析将需要重新核对。"))
                      void mutate(base + "/facts/" + f.id, "DELETE");
                  }}
                >
                  删除事实
                </button>
              </article>
            ))}
          </div>
          <Field label="事实名称">
            <input
              value={factLabel}
              onChange={(e) => setFactLabel(e.target.value)}
            />
          </Field>
          <Field label="事实内容">
            <input
              value={factValue}
              onChange={(e) => setFactValue(e.target.value)}
            />
          </Field>
          <Field label="关联原始材料">
            <select
              value={factEvidence}
              onChange={(e) => setFactEvidence(e.target.value)}
            >
              <option value="">用户描述（无材料）</option>
              {record.evidence.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.code} · {e.filename}
                </option>
              ))}
            </select>
          </Field>
          <button
            disabled={!factLabel.trim() || !factValue.trim()}
            onClick={async () => {
              await mutate(base + "/facts", "POST", {
                label: factLabel,
                value: factValue,
                evidenceId: factEvidence || undefined,
              });
              setFactLabel("");
              setFactValue("");
            }}
          >
            记录待核实事实
          </button>
        </section>
        <section className="card">
          <h3>原始材料入库</h3>
          {record.evidence.map((e) => (
            <div className="timeline-item" key={e.id}>
              <time>{new Date(e.createdAt).toLocaleString("zh-CN")}</time>
              <button onClick={() => go("evidence-detail/" + e.id)}>
                {e.code} · {e.filename}
              </button>
            </div>
          ))}
        </section>
      </>
    );
  if (page === "tasks")
    return (
      <>
        <div className="stat-strip">
          <div className="stat">
            <strong>
              {record.tasks.filter((t) => t.status === "pending").length}
            </strong>
            <span>待办任务</span>
          </div>
          <div className="stat">
            <strong>
              {record.tasks.filter((t) => t.status === "done").length}
            </strong>
            <span>已完成</span>
          </div>
          <div className="stat">
            <strong>
              {
                record.tasks.filter(
                  (t) =>
                    t.status !== "done" &&
                    t.dueAt &&
                    new Date(t.dueAt) < new Date(),
                ).length
              }
            </strong>
            <span>已到期</span>
          </div>
        </div>
        <section className="card">
          {record.tasks.map((t) => (
            <div className="followup-row" key={t.id}>
              <img
                className="avatar"
                src={avatar(t.agentId)}
                alt={ducks.find((d) => d.id === t.agentId)?.name}
              />
              <div className="row-content">
                <h4>{t.title}</h4>
                <p>
                  {t.dueAt
                    ? new Date(t.dueAt).toLocaleString("zh-CN")
                    : "未设置期限"}{" "}
                  ·{" "}
                  {t.status === "proposed"
                    ? "待你确认"
                    : t.status === "done"
                      ? "已完成"
                      : "待办"}
                  {t.status !== "done" &&
                  t.dueAt &&
                  new Date(t.dueAt) < new Date()
                    ? " · 已到期"
                    : ""}
                </p>
                <input
                  type="datetime-local"
                  aria-label={"修改到期时间 " + t.title}
                  onChange={(e) =>
                    e.target.value &&
                    mutate(base + "/tasks/" + t.id, "PATCH", {
                      dueAt: new Date(e.target.value).toISOString(),
                    })
                  }
                />
              </div>
              <button
                onClick={() =>
                  mutate(base + "/tasks/" + t.id, "PATCH", {
                    status:
                      t.status === "done"
                        ? "pending"
                        : t.status === "proposed"
                          ? "pending"
                          : "done",
                  })
                }
              >
                {t.status === "proposed"
                  ? "确认创建"
                  : t.status === "done"
                    ? "重新打开"
                    : "标记完成"}
              </button>
              <button
                className="danger"
                onClick={() => {
                  if (confirm("删除此任务？"))
                    void mutate(base + "/tasks/" + t.id, "DELETE");
                }}
              >
                删除
              </button>
            </div>
          ))}
          <Field label="新增跟进任务">
            <input value={task} onChange={(e) => setTask(e.target.value)} />
          </Field>
          <Field label="到期时间">
            <input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </Field>
          <button
            disabled={!task.trim()}
            onClick={async () => {
              await mutate(base + "/tasks", "POST", {
                title: task,
                agentId: "followup",
                priority: "normal",
                status: "pending",
                dueAt: due ? new Date(due).toISOString() : undefined,
              });
              setTask("");
            }}
          >
            添加任务
          </button>
          <p className="muted">到期提醒在应用内展示，鸭鸭不会自动联系商家。</p>
        </section>
      </>
    );
  if (page === "drafts")
    return (
      <div className="grid-two">
        <section className="card">
          <h3>沟通草稿 · 由你核对后使用</h3>
          <div className="tabs">
            {(
              [
                ["gentle", "温和商量"],
                ["firm", "理性坚定"],
                ["formal", "正式说明"],
              ] as const
            ).map(([id, label]) => (
              <button
                className={tone === id ? "selected" : ""}
                key={id}
                onClick={() => {
                  setTone(id);
                  const d = record.drafts.filter((d) => d.tone === id).at(-1);
                  setText(d?.text || "");
                  setDraftId(d?.id || "");
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <textarea
            className="draft-text"
            aria-label="沟通草稿"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="horizontal-actions">
            <button
              disabled={!text.trim()}
              onClick={async () => {
                if (
                  await mutate(
                    base + "/drafts" + (draftId ? "/" + draftId : ""),
                    draftId ? "PATCH" : "POST",
                    draftId
                      ? { text, tone, acknowledgeRevision: true }
                      : { text, tone },
                  )
                )
                  notify("草稿已保存");
              }}
            >
              保存已核对草稿
            </button>
            <button
              disabled={!text}
              onClick={() =>
                navigator.clipboard
                  .writeText(text)
                  .then(() => notify("已复制，请自行向商家发送"))
                  .catch(() => notify("复制失败，请手动选择文字"))
              }
            >
              复制草稿
            </button>
          </div>
        </section>
        <aside className="card">
          <h3>已保存版本</h3>
          {record.drafts.map((d) => (
            <article className="result-card" key={d.id}>
              <h4>
                {d.tone === "gentle"
                  ? "温和商量"
                  : d.tone === "firm"
                    ? "理性坚定"
                    : "正式说明"}{" "}
                {d.stale ? "· 事实更新，需要重新核对" : ""}
              </h4>
              <p>{d.text}</p>
              <button
                onClick={() => {
                  setTone(d.tone);
                  setText(d.text);
                  setDraftId(d.id);
                }}
              >
                编辑这个版本
              </button>
              <button className="danger" onClick={async()=>{
                if(confirm("删除这个已保存的草稿版本？")){
                  const ok=await mutate(base+"/drafts/"+d.id,"DELETE");
                  if(ok&&draftId===d.id){setDraftId("");setText("")}
                }
              }}>删除这个版本</button>
            </article>
          ))}
          {!record.drafts.length && (
            <p>
              可以自行起草，或请求退退退鸭生成。未配置 AI 时不会伪造模型草稿。
            </p>
          )}
        </aside>
      </div>
    );
  if (page === "report")
    return (
      <>
        <section className="report-sheet">
          <div className="eyebrow">WHYDUCK CASE REPORT</div>
          <h1>{record.title} · 办事报告</h1>
          <p>
            事实版本 {record.factRevision} ·{" "}
            {record.demo ? "示例案件" : "真实案件"}
          </p>
          <h3>关键事实</h3>
          {record.facts.map((f) => (
            <p key={f.id}>
              {f.label}：{redact ? "（默认脱敏导出）" : f.value} ·{" "}
              {f.status === "confirmed" ? "已确认" : "待核实"}
            </p>
          ))}
          <h3>材料与引用</h3>
          {record.evidence.map((e) => (
            <p key={e.id}>
              {e.code} · {e.filename} · {e.confirmed ? "已人工确认" : "待核对"}
            </p>
          ))}
          <h3>下一步</h3>
          {record.tasks.map((t) => (
            <p key={t.id}>
              {t.title} · {t.status === "proposed" ? "AI 建议，待你确认" : t.status === "done" ? "已完成" : "待办"}
            </p>
          ))}
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={redact}
                onChange={(e) => {
                  setRedact(e.target.checked);
                  setReviewed(false);
                }}
              />{" "}
              脱敏导出（默认开启）
            </span>
          </label>
          <label className="field">
            <span>
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />{" "}
              我已核对材料、待核实标签和脱敏选项
            </span>
          </label>
          <div className="horizontal-actions">
            {["markdown", "html"].map((format) => (
              <button
                disabled={!reviewed}
                key={format}
                onClick={() => {
                  const a = document.createElement("a");
                  a.href =
                    "/api" + base + `/report?format=${format}&redact=${redact}`;
                  a.download = "";
                  a.click();
                }}
              >
                下载 {format === "html" ? "HTML" : "Markdown"}
              </button>
            ))}
          </div>
          <p className="legal-footnote">
            报告用于整理材料，不构成法律裁决，也不保证退款结果。
          </p>
        </section>
      </>
    );
  return null;
}
function EvidenceDetail({
  evidence,
  base,
  mutate,
}: {
  evidence: Evidence;
  base: string;
  mutate: Mutate;
}) {
  const [data, setData] = useState<EvidenceExtraction>(
    evidence.extraction || {},
  );
  const path = base + "/evidence/" + evidence.id;
  return (
    <div className="evidence-layout">
      <section className="card">
        <h3>{evidence.code} · 原始材料</h3>
        {evidence.sourceType === "image" ? (
          <EvidenceImage path={path+"/file"} evidence={evidence} original />
        ) : (
          <pre className="source-text">{evidence.sourceText}</pre>
        )}
        {evidence.sourceType==='text'&&<a className="link" target="_blank" rel="noreferrer" href={"/api"+path+"/file"}>打开原始文件</a>}
        <p className="small muted">SHA-256：{evidence.sha256}</p>
      </section>
      <section className="card">
        <h3>提取结果 · {evidence.confirmed ? "已人工确认" : "待人工核对"}</h3>
        <div className="notice">
          没有提取结果时请先人工录入，或在聊天中请求据理力争鸭识别。材料文字不作为系统指令。
        </div>
        {(
          [
            ["merchant", "商家"],
            ["product", "商品"],
            ["amount", "金额"],
            ["date", "购买日期"],
            ["orderNumber", "订单号"],
            ["refundStatus", "售后状态"],
          ] as const
        ).map(([key, label]) => (
          <Field label={label} key={key}>
            <input
              value={data[key] || ""}
              onChange={(e) => setData({ ...data, [key]: e.target.value })}
            />
          </Field>
        ))}
        <Field label="原文引文，每行一条">
          <textarea
            value={data.quotes?.join("\n") || ""}
            onChange={(e) =>
              setData({
                ...data,
                quotes: e.target.value.split("\n").filter(Boolean),
              })
            }
          />
        </Field>
        {data.uncertainties?.map((u) => (
          <p className="notice" key={u}>
            待核实：{u}
          </p>
        ))}
        <button
          onClick={() =>
            mutate(path, "PATCH", { extraction: data, confirmed: false })
          }
        >
          保存待核实信息
        </button>
        <button
          className="primary"
          onClick={() =>
            mutate(path, "PATCH", { extraction: data, confirmed: true })
          }
        >
          已对照原图，确认信息
        </button>
        <button
          className="danger"
          onClick={() => {
            if (confirm("永久删除此原始材料？相关引用将失去出处。"))
              void mutate(path, "DELETE", { confirmation: evidence.id });
          }}
        >
          删除材料
        </button>
      </section>
    </div>
  );
}
