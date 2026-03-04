#!/usr/bin/env node

import { select, input } from '@inquirer/prompts';
import logUpdate from 'log-update';
import consola from 'consola';

let WORK_TIME = 25 * 60;
let SHORT_BREAK = 5 * 60;
let LONG_BREAK = 15 * 60;
const SESSIONS_BEFORE_LONG_BREAK = 4;

const STATE = {
  IDLE: 'idle',
  WORKING: 'working',
  BREAK: 'break',
};

let timerState = {
  state: STATE.IDLE,
  remaining: WORK_TIME,
  session: 1,
  totalSessions: SESSIONS_BEFORE_LONG_BREAK,
  isPaused: false,
};

// ANSI helpers
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[97m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgCyan: '\x1b[46m',
};

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function getProgressBar(remaining, total, width = 24) {
  const ratio = Math.max(0, Math.min(1, (total - remaining) / total));
  const filled = Math.floor(ratio * width);
  const empty = width - filled;
  return `${c.green}${'█'.repeat(filled)}${c.reset}${c.dim}${'░'.repeat(empty)}${c.reset}`;
}

// Pad a raw string (with ANSI codes) to visible length `len`
function padVisible(str, len, char = ' ') {
  const visible = str.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, len - visible.length);
  return str + char.repeat(pad);
}

function renderTimer() {
  const { state, remaining, session, totalSessions, isPaused } = timerState;

  // ── State-specific config ─────────────────────────────
  let stateLabel, accentColor, totalTime;
  switch (state) {
    case STATE.WORKING:
      stateLabel = '作業中  🍅';
      accentColor = c.red;
      totalTime = WORK_TIME;
      break;
    case STATE.BREAK:
      stateLabel = '休憩中  ☕';
      accentColor = c.green;
      totalTime = remaining <= SHORT_BREAK ? SHORT_BREAK : LONG_BREAK;
      break;
    default:
      stateLabel = '待機中  💤';
      accentColor = c.cyan;
      totalTime = WORK_TIME;
  }

  const timeStr = `${c.bold}${accentColor}${formatTime(remaining)}${c.reset}`;
  const bar = getProgressBar(remaining, totalTime);
  const sessionStr = state !== STATE.IDLE
    ? `${c.dim}${session}/${totalSessions}${c.reset}`
    : `${c.dim}─/─${c.reset}`;
  const pauseStr = isPaused
    ? `  ${c.yellow}⏸ 停止中${c.reset}`
    : '';

  // Inner width (visible chars between │ and │, including 2-space indent each side)
  const W = 33;

  const line = (inner) => ` │ ${padVisible(inner, W - 2)} │`;

  const sep = ` ├${'─'.repeat(W)}┤`;
  const top = ` ╭${'─'.repeat(W)}╮`;
  const bot = ` ╰${'─'.repeat(W)}╯`;

  const title = `${c.bold}${c.white}🍅  Pomodoro Timer  🍅${c.reset}`;

  const rows = [
    '',
    top,
    line(padVisible(title, W - 2)),        // title (centered manually via spaces)
    sep,
    line(''),
    line(`  ${timeStr}   ${sessionStr}${pauseStr}`),
    line(`  ${bar}`),
    line(`  ${stateLabel}`),
    line(''),
    bot,
    '',
  ];

  logUpdate(rows.join('\n'));
}

async function tick() {
  if (timerState.state === STATE.IDLE || timerState.isPaused) return;

  timerState.remaining--;
  renderTimer();

  if (timerState.remaining <= 0) {
    await handleTimerComplete();
  }
}

async function handleTimerComplete() {
  const wasWorking = timerState.state === STATE.WORKING;

  if (wasWorking) {
    if (timerState.session >= SESSIONS_BEFORE_LONG_BREAK) {
      timerState.state = STATE.BREAK;
      timerState.remaining = LONG_BREAK;
      consola.success('🎉 4セッション完了！長い休憩に入りましょう (15分)');
      timerState.session = 1;
    } else {
      timerState.state = STATE.BREAK;
      timerState.remaining = SHORT_BREAK;
      consola.success(`🍅 セッション${timerState.session}完了！休憩しましょう (5分)`);
      timerState.isPaused = false;
    }
  } else {
    if (timerState.remaining === LONG_BREAK) {
      consola.success('長い休憩終了！新しいポモドーロを始めましょう');
      timerState.state = STATE.IDLE;
      timerState.isPaused = false;
    } else {
      if (timerState.session < SESSIONS_BEFORE_LONG_BREAK) {
        timerState.session++;
      }
      timerState.state = STATE.WORKING;
      timerState.remaining = WORK_TIME;
      timerState.isPaused = false;
    }
  }

  renderTimer();
}

let intervalId = null;

function startTimerLoop() {
  if (intervalId) return;
  intervalId = setInterval(tick, 1000);
}

function stopTimerLoop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

async function showMenu() {
  return select({
    message: 'アクションを選択:',
    choices: [
      { name: '▶  開始 (Start)', value: 'start' },
      { name: '⏸  停止 (Pause)', value: 'stop' },
      { name: '🔄  リセット (Reset)', value: 'reset' },
      { name: '⚙   設定 (Settings)', value: 'settings' },
      { name: '❌  終了 (Exit)', value: 'exit' },
    ],
  });
}

async function handleSettings() {
  const currentValues = {
    work: Math.floor(WORK_TIME / 60),
    shortBreak: Math.floor(SHORT_BREAK / 60),
    longBreak: Math.floor(LONG_BREAK / 60),
    sessions: timerState.totalSessions,
  };

  const setting = await select({
    message: '設定を変更:',
    choices: [
      { name: `作業時間   (現在: ${currentValues.work}分)`, value: 'work' },
      { name: `短い休憩   (現在: ${currentValues.shortBreak}分)`, value: 'shortBreak' },
      { name: `長い休憩   (現在: ${currentValues.longBreak}分)`, value: 'longBreak' },
      { name: `セッション数 (現在: ${currentValues.sessions})`, value: 'sessions' },
      { name: '← 戻る', value: 'back' },
    ],
  });

  if (setting === 'back') return;

  const value = await input({
    message: `${setting} の値を入力 (分):`,
    default: currentValues[setting].toString(),
    validate: (v) => (!isNaN(v) && parseInt(v) > 0) || '正の数を入力してください',
  });

  const minutes = parseInt(value);

  switch (setting) {
    case 'work':
      WORK_TIME = minutes * 60;
      if (timerState.state === STATE.IDLE) timerState.remaining = WORK_TIME;
      consola.success(`作業時間を ${minutes} 分に設定しました`);
      break;
    case 'shortBreak':
      SHORT_BREAK = minutes * 60;
      consola.success(`短い休憩を ${minutes} 分に設定しました`);
      break;
    case 'longBreak':
      LONG_BREAK = minutes * 60;
      consola.success(`長い休憩を ${minutes} 分に設定しました`);
      break;
    case 'sessions':
      timerState.totalSessions = minutes;
      consola.success(`セッション数を ${minutes} に設定しました`);
      break;
  }
}

async function main() {
  startTimerLoop();
  renderTimer();

  while (true) {
    const choice = await showMenu();

    switch (choice) {
      case 'start':
        if (timerState.state === STATE.IDLE) {
          timerState.state = STATE.WORKING;
          timerState.remaining = WORK_TIME;
        }
        timerState.isPaused = false;
        consola.info('タイマーを開始しました');
        renderTimer();
        break;

      case 'stop':
        timerState.isPaused = true;
        consola.info('タイマーを停止しました');
        renderTimer();
        break;

      case 'reset':
        timerState.state = STATE.IDLE;
        timerState.remaining = WORK_TIME;
        timerState.session = 1;
        timerState.isPaused = false;
        logUpdate.clear();
        consola.info('タイマーをリセットしました');
        renderTimer();
        break;

      case 'settings':
        await handleSettings();
        renderTimer();
        break;

      case 'exit':
        stopTimerLoop();
        logUpdate.clear();
        consola.info('ポモドーロタイマーを終了します');
        process.exit(0);
    }
  }
}

process.on('SIGINT', () => {
  stopTimerLoop();
  logUpdate.clear();
  process.exit(0);
});

main();
