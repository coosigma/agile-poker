import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  MODIFIER_OPTIONS,
  NUMERIC_CARD_VALUES,
  RoomState,
  ServerMessage,
  SPECIAL_CARD_VALUES,
  VoteChoice,
  VoteModifier
} from "./types";

type Screen = "home" | "join-room" | "name-entry" | "room";

const DEFAULT_NAME = "";
const ROOM_INTENT_KEY = "agile-poker:room-intent";

function getInitialName() {
  return window.localStorage.getItem("agile-poker:name") ?? DEFAULT_NAME;
}

function randomRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getRoomIdFromUrl() {
  const url = new URL(window.location.href);
  return url.searchParams.get("room")?.trim().toUpperCase() ?? "";
}

function updateRoomInUrl(roomId: string) {
  const url = new URL(window.location.href);
  if (roomId) {
    url.searchParams.set("room", roomId);
  } else {
    url.searchParams.delete("room");
  }
  window.history.pushState({}, "", url);
}

function getRoomIntent(roomId: string) {
  if (!roomId) {
    return null;
  }
  const raw = window.sessionStorage.getItem(ROOM_INTENT_KEY);
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as { roomId: string; type: "create" | "join" };
    return value.roomId === roomId ? value : null;
  } catch {
    return null;
  }
}

function setRoomIntent(roomId: string, type: "create" | "join") {
  window.sessionStorage.setItem(ROOM_INTENT_KEY, JSON.stringify({ roomId, type }));
}

function clearRoomIntent() {
  window.sessionStorage.removeItem(ROOM_INTENT_KEY);
}

function voteLabel(vote: VoteChoice | null) {
  if (!vote) {
    return "未投票";
  }
  if (vote.kind === "special") {
    return vote.value;
  }
  const suffix = vote.modifier === "flat" ? "♭" : vote.modifier === "sharp" ? "♯" : "";
  return `${vote.base}${suffix}`;
}

function voteNumericValue(vote: VoteChoice | null) {
  if (!vote || vote.kind !== "estimate") {
    return null;
  }
  const sequence = NUMERIC_CARD_VALUES.map((value) => Number(value));
  const currentIndex = NUMERIC_CARD_VALUES.indexOf(vote.base);
  if (currentIndex === -1) {
    return null;
  }
  const currentValue = sequence[currentIndex];
  if (vote.modifier === "flat") {
    const previousValue = sequence[Math.max(0, currentIndex - 1)];
    return (previousValue + currentValue) / 2;
  }
  if (vote.modifier === "sharp") {
    const nextValue = sequence[Math.min(sequence.length - 1, currentIndex + 1)];
    return (currentValue + nextValue) / 2;
  }
  return currentValue;
}

function seatPosition(index: number, total: number) {
  if (total <= 1) {
    return { left: 50, top: 6 };
  }
  const angle = (-Math.PI / 2) + (index * (Math.PI * 2)) / total;
  const radiusX = 40;
  const radiusY = 33;
  return {
    left: 50 + radiusX * Math.cos(angle),
    top: 50 + radiusY * Math.sin(angle)
  };
}

function roomShareUrl(roomId: string) {
  return `${window.location.origin}${window.location.pathname}?room=${roomId}`;
}

export function App() {
  const initialRoomId = getRoomIdFromUrl();
  const [screen, setScreen] = useState<Screen>(initialRoomId ? "name-entry" : "home");
  const [roomId, setRoomId] = useState(initialRoomId);
  const [name, setName] = useState(getInitialName);
  const [nameDraft, setNameDraft] = useState(getInitialName);
  const [joinRoomDraft, setJoinRoomDraft] = useState("");
  const [state, setState] = useState<RoomState | null>(null);
  const [selfId, setSelfId] = useState("");
  const [ticketDraft, setTicketDraft] = useState("");
  const [modifier, setModifier] = useState<VoteModifier>("base");
  const [socketStatus, setSocketStatus] = useState<"connecting" | "open" | "closed">("closed");
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    window.localStorage.setItem("agile-poker:name", name);
  }, [name]);

  useEffect(() => {
    if (screen !== "room" || !roomId || !name) {
      return;
    }

    setSocketStatus("connecting");
    const socket = new WebSocket(`${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setSocketStatus("open");
      const intent = getRoomIntent(roomId);
      socket.send(
        JSON.stringify({
          type: "join_room",
          roomId,
          name,
          claimHost: intent?.type === "create"
        })
      );
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "error") {
        setError(message.message);
        return;
      }
      setState(message.state);
      setSelfId(message.selfId);
      setTicketDraft(message.state.ticketTitle);
      setError("");
      clearRoomIntent();
    });

    socket.addEventListener("close", () => {
      setSocketStatus("closed");
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    });

    return () => {
      socket.close();
    };
  }, [name, roomId, screen]);

  const self = state?.participants.find((participant) => participant.id === selfId) ?? null;
  const isHost = Boolean(self?.isHost);
  const participants = state?.participants ?? [];
  const connectedCount = participants.filter((participant) => participant.connected).length;
  const votedCount = participants.filter((participant) => participant.vote).length;

  const stats = useMemo(() => {
    if (state?.phase !== "revealed") {
      return null;
    }

    const buckets = new Map<string, number>();
    const numericVotes: number[] = [];
    const totalVotes = participants.filter((participant) => participant.vote).length;

    for (const participant of participants) {
      const label = voteLabel(participant.vote);
      if (participant.vote) {
        buckets.set(label, (buckets.get(label) ?? 0) + 1);
      }
      const numericValue = voteNumericValue(participant.vote);
      if (numericValue !== null) {
        numericVotes.push(numericValue);
      }
    }

    return {
      average: numericVotes.length > 0 ? (numericVotes.reduce((sum, value) => sum + value, 0) / numericVotes.length).toFixed(2) : "N/A",
      totalVotes,
      breakdown: [...buckets.entries()]
        .map(([label, count]) => ({
          label,
          count,
          ratio: totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(0) : "0"
        }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    };
  }, [participants, state?.phase]);

  const sendMessage = (payload: object) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("实时连接尚未准备好，请稍后再试。");
      return;
    }
    socket.send(JSON.stringify(payload));
  };

  const handleCreateRoom = async () => {
    const nextRoomId = randomRoomId();
    const response = await fetch(`/api/rooms/${nextRoomId}`, { method: "PUT" });
    if (!response.ok) {
      setError("创建房间失败，请稍后再试。");
      return;
    }
    updateRoomInUrl(nextRoomId);
    setRoomIntent(nextRoomId, "create");
    setRoomId(nextRoomId);
    setError("");
    setScreen("name-entry");
  };

  const handleCheckRoom = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedRoomId = joinRoomDraft.trim().toUpperCase();
    if (!normalizedRoomId) {
      setError("请输入房间 ID。");
      return;
    }

    const response = await fetch(`/api/rooms/${normalizedRoomId}`);
    if (!response.ok) {
      setError("暂时无法校验房间，请稍后再试。");
      return;
    }
    const payload = (await response.json()) as { exists: boolean };
    if (!payload.exists) {
      setError("房间不存在，请检查房间 ID。");
      return;
    }

    updateRoomInUrl(normalizedRoomId);
    setRoomIntent(normalizedRoomId, "join");
    setRoomId(normalizedRoomId);
    setError("");
    setScreen("name-entry");
  };

  const handleNameEntry = (event: FormEvent) => {
    event.preventDefault();
    const nextName = nameDraft.trim() || "匿名成员";
    setName(nextName);
    setError("");
    setScreen("room");
  };

  const handleBackHome = () => {
    updateRoomInUrl("");
    clearRoomIntent();
    setRoomId("");
    setState(null);
    setSelfId("");
    setError("");
    setScreen("home");
  };

  const handleTicketSubmit = (event: FormEvent) => {
    event.preventDefault();
    sendMessage({ type: "set_ticket", ticketTitle: ticketDraft.trim() });
  };

  const seats = participants.map((participant, index) => ({
    participant,
    ...seatPosition(index, participants.length)
  }));

  if (screen === "home") {
    return (
      <div className="app-shell landing-shell">
        <section className="landing-stage">
          <div className="landing-copy">
            <p className="eyebrow">Scrum Poker Room</p>
            <h1>从一个分享链接开始，把 sizing 讨论放回桌面中央。</h1>
            <p className="lede">无需登录。主持人建房，团队成员拿着链接直接进场，围桌投票、翻牌讨论、即时统计。</p>
          </div>
          <div className="choice-grid">
            <button className="mode-card mode-card-create" type="button" onClick={handleCreateRoom}>
              <span>新建房间</span>
              <strong>生成一个新的会议桌，并在进入后自动成为主持人。</strong>
            </button>
            <button className="mode-card mode-card-join" type="button" onClick={() => setScreen("join-room")}>
              <span>加入已有房间</span>
              <strong>输入房间 ID，校验成功后再填写昵称进入。</strong>
            </button>
          </div>
          {error ? <p className="error-text center-text">{error}</p> : null}
        </section>
      </div>
    );
  }

  if (screen === "join-room") {
    return (
      <div className="app-shell landing-shell">
        <section className="compact-card">
          <p className="eyebrow">Join Room</p>
          <h2>输入房间 ID</h2>
          <p className="lede">校验房间存在后，我们会跳转到昵称页。</p>
          <form className="stack" onSubmit={handleCheckRoom}>
            <label>
              房间 ID
              <input value={joinRoomDraft} onChange={(event) => setJoinRoomDraft(event.target.value.toUpperCase())} placeholder="例如：AB12CD" />
            </label>
            <button className="primary-button" type="submit">
              继续
            </button>
            <button className="ghost-button" type="button" onClick={handleBackHome}>
              返回
            </button>
          </form>
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </div>
    );
  }

  if (screen === "name-entry") {
    return (
      <div className="app-shell landing-shell">
        <section className="compact-card">
          <p className="eyebrow">Room {roomId}</p>
          <h2>输入昵称进入房间</h2>
          <p className="lede">进入后你会在桌边自动排座。{getRoomIntent(roomId)?.type === "create" ? "本次你将作为主持人进入。" : "主持人会控制议题与翻牌。"}</p>
          <form className="stack" onSubmit={handleNameEntry}>
            <label>
              昵称
              <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="例如：Alice" />
            </label>
            <button className="primary-button" type="submit">
              进入房间
            </button>
            <button className="ghost-button" type="button" onClick={handleBackHome}>
              返回首页
            </button>
          </form>
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell room-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">Room {roomId}</p>
          <h2 className="room-title">{state?.ticketTitle || "等待主持人设置议题"}</h2>
        </div>
        <div className="topbar-actions">
          <div className="status-pill">
            <span className={`status-dot ${socketStatus}`}></span>
            <span>{socketStatus === "open" ? "在线" : socketStatus === "connecting" ? "连接中" : "已断开"}</span>
          </div>
          <button
            className="secondary-button"
            onClick={async () => {
              await navigator.clipboard.writeText(roomShareUrl(roomId));
            }}
          >
            复制邀请链接
          </button>
        </div>
      </section>

      <section className="room-layout">
        <aside className="side-panel">
          <div className="panel">
            <div className="panel-header">
              <h3>房间信息</h3>
              <span className="badge">{connectedCount} 在线</span>
            </div>
            <div className="meta-list">
              <div>
                <span>当前阶段</span>
                <strong>{state?.phase === "countdown" ? `翻牌倒计时 ${state.countdownValue}` : state?.phase === "voting" ? "投票中" : state?.phase === "revealed" ? "已翻牌" : "待开始"}</strong>
              </div>
              <div>
                <span>已投票</span>
                <strong>
                  {votedCount}/{participants.length}
                </strong>
              </div>
              <div>
                <span>我的身份</span>
                <strong>{isHost ? "主持人" : "成员"}</strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>主持人控制</h3>
              <span className="badge muted-badge">{isHost ? "可操作" : "只读"}</span>
            </div>
            <form className="stack" onSubmit={handleTicketSubmit}>
              <label>
                当前议题
                <input
                  disabled={!isHost}
                  value={ticketDraft}
                  onChange={(event) => setTicketDraft(event.target.value)}
                  placeholder="例如：PAY-1842 修复退款流程"
                />
              </label>
              <button className="secondary-button" type="submit" disabled={!isHost}>
                更新议题
              </button>
            </form>
            <div className="stack">
              <button className="primary-button" type="button" disabled={!isHost} onClick={() => sendMessage({ type: "start_round" })}>
                开启新一轮
              </button>
              <button className="secondary-button" type="button" disabled={!isHost || votedCount === 0} onClick={() => sendMessage({ type: "reveal_votes" })}>
                翻牌
              </button>
            </div>
          </div>
        </aside>

        <main className="table-zone">
          <div className="table-frame">
            {state?.phase === "countdown" ? (
              <div className="countdown-overlay">
                <span>{state.countdownValue}</span>
                <small>即将翻牌</small>
              </div>
            ) : null}
            <div className="ellipse-table">
              <div className="table-center">
                <p>Scrum Poker Table</p>
                <strong>{state?.ticketTitle || "等待议题"}</strong>
              </div>
            </div>
            {seats.map(({ participant, left, top }) => (
              <article key={participant.id} className={`seat-card ${participant.id === selfId ? "self" : ""}`} style={{ left: `${left}%`, top: `${top}%` }}>
                <span className="seat-name">
                  {participant.name}
                  {participant.isHost ? " · Host" : ""}
                </span>
                <strong>{state?.phase === "revealed" ? voteLabel(participant.vote) : participant.vote ? "已投票" : "未投票"}</strong>
                <small>{participant.connected ? "在线" : "离线"}</small>
              </article>
            ))}
          </div>

          <div className="panel table-results-panel">
            <div className="panel-header">
              <h3>统计结果</h3>
              <span className="badge">{state?.phase === "revealed" ? "已开放" : "待翻牌"}</span>
            </div>
            {stats ? (
              <div className="results-grid">
                <div className="stats-highlight">
                  <span>全局算术平均</span>
                  <strong>{stats.average}</strong>
                </div>
                <div className="stats-highlight">
                  <span>有效票数</span>
                  <strong>{stats.totalVotes}</strong>
                </div>
                <div className="breakdown-strip">
                  {stats.breakdown.map((item) => (
                    <div key={item.label} className="breakdown-item">
                      <span>{item.label}</span>
                      <strong>{item.count} 票</strong>
                      <small>{item.ratio}%</small>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">翻牌后会展示全局算术平均和所有出现值的频率分布。</div>
            )}
          </div>
        </main>

        <aside className="side-panel">
          <div className="panel">
            <div className="panel-header">
              <h3>投票卡</h3>
              <span className="badge muted-badge">{voteLabel(self?.vote ?? null)}</span>
            </div>
            <div className="modifier-row modifier-near-cards">
              {MODIFIER_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`modifier-button ${modifier === option ? "active" : ""}`}
                  onClick={() => setModifier(option)}
                >
                  {option === "flat" ? "♭ 略小" : option === "sharp" ? "♯ 略大" : "标准"}
                </button>
              ))}
            </div>
            <div className="card-grid">
              {NUMERIC_CARD_VALUES.map((value) => {
                const active = self?.vote?.kind === "estimate" && self.vote.base === value && self.vote.modifier === modifier;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`vote-card ${active ? "active" : ""}`}
                    disabled={state?.phase !== "voting" && state?.phase !== "revealed"}
                    onClick={() =>
                      sendMessage({
                        type: "vote",
                        vote: {
                          kind: "estimate",
                          base: value,
                          modifier
                        }
                      })
                    }
                  >
                    <span>{value}</span>
                    <small>{modifier === "flat" ? "♭" : modifier === "sharp" ? "♯" : "·"}</small>
                  </button>
                );
              })}
              {SPECIAL_CARD_VALUES.map((value) => {
                const active = self?.vote?.kind === "special" && self.vote.value === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`vote-card special-card ${active ? "active" : ""}`}
                    disabled={state?.phase !== "voting" && state?.phase !== "revealed"}
                    onClick={() =>
                      sendMessage({
                        type: "vote",
                        vote: {
                          kind: "special",
                          value
                        }
                      })
                    }
                  >
                    {value}
                  </button>
                );
              })}
              <button className="vote-card clear-card" type="button" onClick={() => sendMessage({ type: "clear_vote" })}>
                清空
              </button>
            </div>
          </div>
        </aside>
      </section>
      {error ? <p className="error-text center-text">{error}</p> : null}
    </div>
  );
}
