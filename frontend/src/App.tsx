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
type Language = "en" | "zh" | "ja";

const DEFAULT_NAME = "";
const ROOM_INTENT_KEY = "agile-poker:room-intent";
const LANGUAGE_KEY = "agile-poker:language";

const LANGUAGE_OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" }
];

const STRINGS: Record<Language, Record<string, string>> = {
  en: {
    appTitle: "Scrum Poker Room",
    homeTitle: "Start from one link.",
    homeLede: "No login needed. Create a room, join by link, vote, and reveal fast.",
    createRoom: "Create room",
    createRoomDesc: "Make a room and enter as host.",
    joinRoom: "Join an existing room",
    joinRoomDesc: "Enter a room ID, then set your name.",
    languageLabel: "Language",
    languageHelp: "This preference stays on your device only.",
    connectionWarning: "Live connection is unavailable. You can keep using the page.",
    socketNotReadyError: "The live connection is not ready yet. Please try again shortly.",
    createRoomError: "Failed to create the room. Please try again later.",
    enterRoomIdError: "Please enter a room ID.",
    verifyRoomError: "Unable to verify the room right now. Please try again later.",
    roomMissingError: "The room does not exist. Please check the room ID.",
    joinTitle: "Enter room ID",
    joinLede: "We will verify the room exists before moving to the name page.",
    roomId: "Room ID",
    continue: "Continue",
    back: "Back",
    roomLabel: "Room",
    enterNameTitle: "Enter your display name to join the room",
    enterNameLedeCreate: "After entering, you will be placed at the table automatically as the host.",
    enterNameLedeJoin: "After entering, the host will control the ticket and the reveal flow.",
    nickname: "Display name",
    enterRoom: "Enter room",
    backHome: "Back to home",
    statusOnline: "Online",
    statusConnecting: "Connecting",
    statusClosed: "Disconnected",
    copyInvite: "Copy invite link",
    roomInfo: "Room info",
    connected: "online",
    currentPhase: "Current phase",
    votingPhase: "Voting",
    revealedPhase: "Revealed",
    waitingPhase: "Waiting to start",
    countdownPhase: "Reveal in {countdown}",
    voted: "Voted",
    myRole: "My role",
    host: "Host",
    member: "Member",
    hostControls: "Host controls",
    ready: "Editable",
    readOnly: "Read only",
    currentTicket: "Current ticket",
    ticketPlaceholder: "For example: PAY-1842 fix refund flow",
    updateTicket: "Update ticket",
    startRound: "Start new round",
    reveal: "Reveal",
    revealTable: "Scrum Poker Table",
    waitingTopic: "Waiting for the ticket",
    tableStats: "Statistics",
    statsReady: "Open",
    statsWaiting: "Waiting to reveal",
    overallAverage: "Overall arithmetic average",
    validVotes: "Valid votes",
    voteBreakdown: "Breakdown",
    voteUnit: "votes",
    afterRevealStats: "After revealing, you will see the arithmetic average and the frequency of each value.",
    voteCards: "Vote cards",
    optionalModifier: "Optional modifier",
    optionalModifierHelp: "If your estimate sits between two numbers, choose a modifier to mark it as slightly lower or higher without reaching the next size.",
    modifierFlat: "Less",
    modifierBase: "Base",
    modifierSharp: "More",
    clearVote: "Clear",
    voteNotCast: "Not voted",
    online: "Online",
    offline: "Offline",
    participantHost: "Host",
    stageCountdown: "Reveal in {countdown}",
    stageVoting: "Voting",
    stageRevealed: "Revealed",
    stageWaiting: "Waiting to start"
  },
  zh: {
    appTitle: "Scrum Poker 房间",
    homeTitle: "从一个分享链接开始，把 sizing 讨论放回桌面中央。",
    homeLede: "无需登录。主持人建房，团队成员拿着链接直接进场，围桌投票、翻牌讨论、即时统计。",
    createRoom: "新建房间",
    createRoomDesc: "生成一个新的会议桌，并在进入后自动成为主持人。",
    joinRoom: "加入已有房间",
    joinRoomDesc: "输入房间 ID，校验成功后再填写昵称进入。",
    languageLabel: "语言",
    languageHelp: "该偏好只保存在当前设备上。",
    connectionWarning: "实时连接暂时不可用，你仍然可以继续使用页面。",
    socketNotReadyError: "实时连接尚未准备好，请稍后再试。",
    createRoomError: "创建房间失败，请稍后再试。",
    enterRoomIdError: "请输入房间 ID。",
    verifyRoomError: "暂时无法校验房间，请稍后再试。",
    roomMissingError: "房间不存在，请检查房间 ID。",
    joinTitle: "输入房间 ID",
    joinLede: "校验房间存在后，我们会跳转到昵称页。",
    roomId: "房间 ID",
    continue: "继续",
    back: "返回",
    roomLabel: "房间",
    enterNameTitle: "输入昵称进入房间",
    enterNameLedeCreate: "进入后你会在桌边自动排座，并作为主持人进入。",
    enterNameLedeJoin: "进入后主持人会控制议题与翻牌流程。",
    nickname: "昵称",
    enterRoom: "进入房间",
    backHome: "返回首页",
    statusOnline: "在线",
    statusConnecting: "连接中",
    statusClosed: "已断开",
    copyInvite: "复制邀请链接",
    roomInfo: "房间信息",
    connected: "在线",
    currentPhase: "当前阶段",
    votingPhase: "投票中",
    revealedPhase: "已翻牌",
    waitingPhase: "待开始",
    countdownPhase: "翻牌倒计时 {countdown}",
    voted: "已投票",
    myRole: "我的身份",
    host: "主持人",
    member: "成员",
    hostControls: "主持人控制",
    ready: "可操作",
    readOnly: "只读",
    currentTicket: "当前议题",
    ticketPlaceholder: "例如：PAY-1842 修复退款流程",
    updateTicket: "更新议题",
    startRound: "开启新一轮",
    reveal: "翻牌",
    revealTable: "Scrum Poker Table",
    waitingTopic: "等待主持人设置议题",
    tableStats: "统计结果",
    statsReady: "已开放",
    statsWaiting: "待翻牌",
    overallAverage: "全局算术平均",
    validVotes: "有效票数",
    voteBreakdown: "频率分布",
    voteUnit: "票",
    afterRevealStats: "翻牌后会展示全局算术平均和所有出现值的频率分布。",
    voteCards: "投票卡",
    optionalModifier: "可选升降号",
    optionalModifierHelp: "如果介乎两个数字之间，可以选择升降号表示比所选数字多或少，但不足以达到相邻 size。",
    modifierFlat: "♭ 略小",
    modifierBase: "标准",
    modifierSharp: "♯ 略大",
    clearVote: "清空",
    voteNotCast: "未投票",
    online: "在线",
    offline: "离线",
    participantHost: "主持人",
    stageCountdown: "翻牌倒计时 {countdown}",
    stageVoting: "投票中",
    stageRevealed: "已翻牌",
    stageWaiting: "待开始"
  },
  ja: {
    appTitle: "スクラムポーカー ルーム",
    homeTitle: "共有リンクひとつで、見積もりの会話をテーブルの中央に戻します。",
    homeLede: "ログイン不要。ホストが部屋を作成し、チームはリンクで参加、円卓で投票し、公開して即時集計を確認できます。",
    createRoom: "部屋を作成",
    createRoomDesc: "新しい会議テーブルを生成し、入室後に自動でホストになります。",
    joinRoom: "既存の部屋に参加",
    joinRoomDesc: "部屋 ID を入力し、存在確認のあとで表示名を設定します。",
    languageLabel: "言語",
    languageHelp: "この設定はこの端末のみに保存されます。",
    connectionWarning: "リアルタイム接続は利用できません。ページはそのまま使えます。",
    socketNotReadyError: "リアルタイム接続はまだ準備できていません。しばらくしてから再試行してください。",
    createRoomError: "部屋の作成に失敗しました。後でもう一度お試しください。",
    enterRoomIdError: "部屋 ID を入力してください。",
    verifyRoomError: "現在、部屋を確認できません。後でもう一度お試しください。",
    roomMissingError: "部屋が存在しません。部屋 ID を確認してください。",
    joinTitle: "部屋 ID を入力",
    joinLede: "部屋の存在を確認してから、名前入力画面へ進みます。",
    roomId: "部屋 ID",
    continue: "続ける",
    back: "戻る",
    roomLabel: "部屋",
    enterNameTitle: "表示名を入力して参加",
    enterNameLedeCreate: "入室後、あなたはホストとして自動的にテーブルに配置されます。",
    enterNameLedeJoin: "入室後は、ホストが議題と公開の流れを管理します。",
    nickname: "表示名",
    enterRoom: "入室する",
    backHome: "ホームへ戻る",
    statusOnline: "オンライン",
    statusConnecting: "接続中",
    statusClosed: "切断済み",
    copyInvite: "招待リンクをコピー",
    roomInfo: "ルーム情報",
    connected: "オンライン",
    currentPhase: "現在のフェーズ",
    votingPhase: "投票中",
    revealedPhase: "公開済み",
    waitingPhase: "開始待ち",
    countdownPhase: "公開まで {countdown}",
    voted: "投票済み",
    myRole: "自分の役割",
    host: "ホスト",
    member: "メンバー",
    hostControls: "ホスト操作",
    ready: "編集可",
    readOnly: "閲覧のみ",
    currentTicket: "現在のチケット",
    ticketPlaceholder: "例: PAY-1842 返金フローを修正",
    updateTicket: "チケットを更新",
    startRound: "新しいラウンドを開始",
    reveal: "公開",
    revealTable: "スクラムポーカーテーブル",
    waitingTopic: "議題を待機中",
    tableStats: "統計",
    statsReady: "公開中",
    statsWaiting: "公開待ち",
    overallAverage: "全体の算術平均",
    validVotes: "有効票数",
    voteBreakdown: "内訳",
    voteUnit: "票",
    afterRevealStats: "公開後に、算術平均と各値の出現頻度を表示します。",
    voteCards: "投票カード",
    optionalModifier: "任意の修飾",
    optionalModifierHelp: "2つの数字の間くらいなら、隣のサイズに届かない少し小さい・大きいを示すために修飾を選べます。",
    modifierFlat: "♭ 少し小さい",
    modifierBase: "標準",
    modifierSharp: "♯ 少し大きい",
    clearVote: "クリア",
    voteNotCast: "未投票",
    online: "オンライン",
    offline: "オフライン",
    participantHost: "ホスト",
    stageCountdown: "公開まで {countdown}",
    stageVoting: "投票中",
    stageRevealed: "公開済み",
    stageWaiting: "開始待ち"
  }
};

function getInitialName() {
  return window.localStorage.getItem("agile-poker:name") ?? DEFAULT_NAME;
}

function getInitialLanguage(): Language {
  const stored = window.localStorage.getItem(LANGUAGE_KEY);
  if (stored === "en" || stored === "zh" || stored === "ja") {
    return stored;
  }
  return "en";
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

function formatText(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((output, [key, value]) => output.split(`{${key}}`).join(String(value)), template);
}

function voteLabel(vote: VoteChoice | null, language: Language) {
  if (!vote) {
    return STRINGS[language].voteNotCast;
  }
  if (vote.kind === "special") {
    return vote.value;
  }
  const suffix = vote.modifier === "flat" ? "♭" : vote.modifier === "sharp" ? "♯" : "";
  return `${vote.base}${suffix}`;
}

function getPhaseLabel(language: Language, phase: RoomState["phase"], countdownValue: number | null) {
  const copy = STRINGS[language];
  if (phase === "countdown") {
    return formatText(copy.stageCountdown, { countdown: countdownValue ?? "-" });
  }
  if (phase === "voting") {
    return copy.stageVoting;
  }
  if (phase === "revealed") {
    return copy.stageRevealed;
  }
  return copy.stageWaiting;
}

function LanguageSelector({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  const copy = STRINGS[language];
  return (
    <label className="language-picker">
      <span>{copy.languageLabel}</span>
      <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <small>{copy.languageHelp}</small>
    </label>
  );
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
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [socketStatus, setSocketStatus] = useState<"connecting" | "open" | "closed">("closed");
  const [connectionNotice, setConnectionNotice] = useState("");
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  const copy = STRINGS[language];

  useEffect(() => {
    window.localStorage.setItem("agile-poker:name", name);
  }, [name]);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  }, [language]);

  useEffect(() => {
    if (screen !== "room" || !roomId || !name) {
      return;
    }

    setSocketStatus("connecting");
    setConnectionNotice("");

    const socketUrl = new URL("/ws", window.location.href);
    socketUrl.searchParams.set("room", roomId);
    socketUrl.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

    let socket: WebSocket;
    try {
      socket = new WebSocket(socketUrl.toString());
    } catch {
      console.warn("WebSocket connection could not be created.");
      setSocketStatus("closed");
      setConnectionNotice(copy.connectionWarning);
      return;
    }

    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setSocketStatus("open");
      setConnectionNotice("");
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

    socket.addEventListener("error", () => {
      console.warn("WebSocket connection failed or was interrupted.");
      setSocketStatus("closed");
      setConnectionNotice(copy.connectionWarning);
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
      const label = voteLabel(participant.vote, language);
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
  }, [language, participants, state?.phase]);

  const sendMessage = (payload: object) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError(copy.socketNotReadyError);
      return;
    }
    socket.send(JSON.stringify(payload));
  };

  const handleCreateRoom = async () => {
    const nextRoomId = randomRoomId();
    const response = await fetch(`/api/rooms/${nextRoomId}`, { method: "PUT" });
    if (!response.ok) {
      setError(copy.createRoomError);
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
      setError(copy.enterRoomIdError);
      return;
    }

    const response = await fetch(`/api/rooms/${normalizedRoomId}`);
    if (!response.ok) {
      setError(copy.verifyRoomError);
      return;
    }
    const payload = (await response.json()) as { exists: boolean };
    if (!payload.exists) {
      setError(copy.roomMissingError);
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
          <div className="landing-toolbar">
            <LanguageSelector language={language} setLanguage={setLanguage} />
          </div>
          <div className="landing-copy">
            <p className="eyebrow">{copy.appTitle}</p>
            <h1>{copy.homeTitle}</h1>
            <p className="lede">{copy.homeLede}</p>
          </div>
          <div className="choice-grid">
            <button className="mode-card mode-card-create" type="button" onClick={handleCreateRoom}>
              <span>{copy.createRoom}</span>
              <strong>{copy.createRoomDesc}</strong>
            </button>
            <button className="mode-card mode-card-join" type="button" onClick={() => setScreen("join-room")}>
              <span>{copy.joinRoom}</span>
              <strong>{copy.joinRoomDesc}</strong>
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
          <div className="landing-toolbar compact-toolbar">
            <LanguageSelector language={language} setLanguage={setLanguage} />
          </div>
          <p className="eyebrow">{copy.joinRoom}</p>
          <h2>{copy.joinTitle}</h2>
          <p className="lede">{copy.joinLede}</p>
          <form className="stack" onSubmit={handleCheckRoom}>
            <label>
              {copy.roomId}
              <input value={joinRoomDraft} onChange={(event) => setJoinRoomDraft(event.target.value.toUpperCase())} placeholder="AB12CD" />
            </label>
            <button className="primary-button" type="submit">
              {copy.continue}
            </button>
            <button className="ghost-button" type="button" onClick={handleBackHome}>
              {copy.back}
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
          <div className="landing-toolbar compact-toolbar">
            <LanguageSelector language={language} setLanguage={setLanguage} />
          </div>
          <p className="eyebrow">
            {copy.roomLabel} {roomId}
          </p>
          <h2>{copy.enterNameTitle}</h2>
          <p className="lede">{getRoomIntent(roomId)?.type === "create" ? copy.enterNameLedeCreate : copy.enterNameLedeJoin}</p>
          <form className="stack" onSubmit={handleNameEntry}>
            <label>
              {copy.nickname}
              <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} placeholder="Alice" />
            </label>
            <button className="primary-button" type="submit">
              {copy.enterRoom}
            </button>
            <button className="ghost-button" type="button" onClick={handleBackHome}>
              {copy.backHome}
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
          <p className="eyebrow">
            {copy.roomLabel} {roomId}
          </p>
          <h2 className="room-title">{state?.ticketTitle || copy.waitingTopic}</h2>
        </div>
        <div className="topbar-actions">
          <LanguageSelector language={language} setLanguage={setLanguage} />
          <div className="status-pill">
            <span className={`status-dot ${socketStatus}`}></span>
            <span>{socketStatus === "open" ? copy.statusOnline : socketStatus === "connecting" ? copy.statusConnecting : copy.statusClosed}</span>
          </div>
          <button
            className="secondary-button"
            onClick={async () => {
              await navigator.clipboard.writeText(roomShareUrl(roomId));
            }}
          >
            {copy.copyInvite}
          </button>
        </div>
      </section>
      {connectionNotice ? <p className="error-text center-text">{connectionNotice}</p> : null}

      <section className="room-layout">
        <aside className="side-panel">
          <div className="panel">
            <div className="panel-header">
              <h3>{copy.roomInfo}</h3>
              <span className="badge">
                {connectedCount} {copy.connected}
              </span>
            </div>
            <div className="meta-list">
              <div>
                <span>{copy.currentPhase}</span>
                <strong>{getPhaseLabel(language, state?.phase ?? "lobby", state?.countdownValue ?? null)}</strong>
              </div>
              <div>
                <span>{copy.voted}</span>
                <strong>
                  {votedCount}/{participants.length}
                </strong>
              </div>
              <div>
                <span>{copy.myRole}</span>
                <strong>{isHost ? copy.host : copy.member}</strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>{copy.hostControls}</h3>
              <span className="badge muted-badge">{isHost ? copy.ready : copy.readOnly}</span>
            </div>
            <form className="stack" onSubmit={handleTicketSubmit}>
              <label>
                {copy.currentTicket}
                <input
                  disabled={!isHost}
                  value={ticketDraft}
                  onChange={(event) => setTicketDraft(event.target.value)}
                  placeholder={copy.ticketPlaceholder}
                />
              </label>
              <button className="secondary-button" type="submit" disabled={!isHost}>
                {copy.updateTicket}
              </button>
            </form>
            <div className="stack">
              <button className="primary-button" type="button" disabled={!isHost} onClick={() => sendMessage({ type: "start_round" })}>
                {copy.startRound}
              </button>
              <button className="secondary-button" type="button" disabled={!isHost || votedCount === 0} onClick={() => sendMessage({ type: "reveal_votes" })}>
                {copy.reveal}
              </button>
            </div>
          </div>
        </aside>

        <main className="table-zone">
          <div className="table-frame">
            {state?.phase === "countdown" ? (
              <div className="countdown-overlay">
                <span>{state.countdownValue}</span>
                <small>{formatText(copy.stageCountdown, { countdown: state.countdownValue ?? "-" })}</small>
              </div>
            ) : null}
            <div className="ellipse-table">
              <div className="table-center">
                <p>{copy.revealTable}</p>
                <strong>{state?.ticketTitle || copy.waitingTopic}</strong>
              </div>
            </div>
            {seats.map(({ participant, left, top }) => (
              <article key={participant.id} className={`seat-card ${participant.id === selfId ? "self" : ""}`} style={{ left: `${left}%`, top: `${top}%` }}>
                <span className="seat-name">
                  {participant.name}
                  {participant.isHost ? ` · ${copy.participantHost}` : ""}
                </span>
                <strong>{state?.phase === "revealed" ? voteLabel(participant.vote, language) : participant.vote ? copy.votedYes : copy.voteNotCast}</strong>
                <small>{participant.connected ? copy.online : copy.offline}</small>
              </article>
            ))}
          </div>

          <div className="panel table-results-panel">
            <div className="panel-header">
              <h3>{copy.tableStats}</h3>
              <span className="badge">{state?.phase === "revealed" ? copy.statsReady : copy.statsWaiting}</span>
            </div>
            {stats ? (
              <div className="results-grid">
                <div className="stats-highlight">
                  <span>{copy.overallAverage}</span>
                  <strong>{stats.average}</strong>
                </div>
                <div className="stats-highlight">
                  <span>{copy.validVotes}</span>
                  <strong>{stats.totalVotes}</strong>
                </div>
                <div className="breakdown-strip">
                  {stats.breakdown.map((item) => (
                    <div key={item.label} className="breakdown-item">
                      <span>{item.label}</span>
                      <strong>
                        {item.count} {copy.voteUnit}
                      </strong>
                      <small>{item.ratio}%</small>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">{copy.afterRevealStats}</div>
            )}
          </div>
        </main>

        <aside className="side-panel">
          <div className="panel">
            <div className="panel-header">
              <h3>{copy.voteCards}</h3>
              <span className="badge muted-badge">{voteLabel(self?.vote ?? null, language)}</span>
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
            </div>
            <div className="special-card-row">
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
            </div>
            <div className="modifier-section">
              <div className="modifier-copy">
                <strong>{copy.optionalModifier}</strong>
                <p>{copy.optionalModifierHelp}</p>
              </div>
              <div className="modifier-row">
                {MODIFIER_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`modifier-button ${modifier === option ? "active" : ""}`}
                    onClick={() => setModifier(option)}
                  >
                    {option === "flat" ? copy.modifierFlat : option === "sharp" ? copy.modifierSharp : copy.modifierBase}
                  </button>
                ))}
              </div>
            </div>
            <button className="vote-card clear-card" type="button" onClick={() => sendMessage({ type: "clear_vote" })}>
              {copy.clearVote}
            </button>
          </div>
        </aside>
      </section>
      {error ? <p className="error-text center-text">{error}</p> : null}
    </div>
  );
}
