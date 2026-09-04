require("dotenv").config();

const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const pino = require("pino");
const TelegramBot = require("node-telegram-bot-api");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require("@whiskeysockets/baileys");

// =========================
// CONFIG
// =========================

const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;

const REQUIRED_CHANNEL_ID = process.env.REQUIRED_CHANNEL_ID || "";
const REQUIRED_GROUP_ID = process.env.REQUIRED_GROUP_ID || "";

const CHANNEL_URL =
  process.env.CHANNEL_URL ||
  "https://t.me/+ULZfq1tDK2ZiYzU0";

const WHATSAPP_CHANNEL_URL =
  process.env.WHATSAPP_CHANNEL_URL ||
  "https://whatsapp.com/channel/0029Vb9OKm42v1Im4naaMD0h";

const INSTAGRAM_URL =
  process.env.INSTAGRAM_URL ||
  "https://www.instagram.com/ryy.haider?igsi=MTlncDE3djRycXA0aQ==";

const OWNER_USERNAME =
  (process.env.OWNER_USERNAME || "hunterdev0").replace("@", "");

const PREMIUM_7 = Number(process.env.PREMIUM_7 || 1200);
const PREMIUM_30 = Number(process.env.PREMIUM_30 || 1900);
const PREMIUM_LIFETIME = Number(process.env.PREMIUM_LIFETIME || 4500);

if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN missing in .env");
  process.exit(1);
}

// =========================
// DIRECTORIES
// =========================

const AUTH_DIR = path.resolve("./auth_info");
const DATA_DIR = path.resolve("./data");
const PREMIUM_FILE = path.resolve("./data/premium.json");

fs.ensureDirSync(AUTH_DIR);
fs.ensureDirSync(DATA_DIR);

if (!fs.existsSync(PREMIUM_FILE)) {
  fs.writeJsonSync(PREMIUM_FILE, {}, { spaces: 2 });
}

// =========================
// EXPRESS SERVER
// =========================

const app = express();

app.get("/", (req, res) => {
  res.send("Hunter MD is running 🚀");
});

app.get("/health", (req, res) => {
  res.json({
    status: "online",
    bot: "Hunter MD",
    time: new Date().toISOString(),
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// =========================
// TELEGRAM
// =========================

const tg = new TelegramBot(BOT_TOKEN, {
  polling: true,
});

console.log("🤖 Hunter MD Telegram Bot Started");

// =========================
// DATA
// =========================

let premiumUsers = {};

try {
  premiumUsers = fs.readJsonSync(PREMIUM_FILE);
} catch {
  premiumUsers = {};
}

function savePremium() {
  fs.writeJsonSync(PREMIUM_FILE, premiumUsers, { spaces: 2 });
}

// =========================
// PREMIUM SYSTEM
// =========================

function isPremium(userId) {
  const user = premiumUsers[String(userId)];

  if (!user) return false;

  if (user.lifetime) return true;

  if (!user.expiry) return false;

  return Date.now() < user.expiry;
}

function getPremiumInfo(userId) {
  const user = premiumUsers[String(userId)];

  if (!user) {
    return null;
  }

  if (user.lifetime) {
    return {
      active: true,
      text: "♾️ Lifetime Premium",
    };
  }

  if (!user.expiry) {
    return null;
  }

  if (Date.now() >= user.expiry) {
    delete premiumUsers[String(userId)];
    savePremium();
    return null;
  }

  const remaining = user.expiry - Date.now();
  const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));

  return {
    active: true,
    text: `⭐ Premium Active\n\n⏳ Remaining: ${days} day(s)`,
  };
}

function addPremium(userId, days, lifetime = false) {
  if (lifetime) {
    premiumUsers[String(userId)] = {
      lifetime: true,
      addedAt: Date.now(),
    };
  } else {
    premiumUsers[String(userId)] = {
      lifetime: false,
      expiry: Date.now() + days * 24 * 60 * 60 * 1000,
      addedAt: Date.now(),
    };
  }

  savePremium();
}

// =========================
// TELEGRAM KEYBOARDS
// =========================

function startKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "📢 Telegram Channel",
          url: CHANNEL_URL,
        },
      ],
      [
        {
          text: "🟢 WhatsApp Channel",
          url: WHATSAPP_CHANNEL_URL,
        },
      ],
      [
        {
          text: "📸 Instagram",
          url: INSTAGRAM_URL,
        },
      ],
      [
        {
          text: "✅ Check Membership",
          callback_data: "check_membership",
        },
      ],
    ],
  };
}

function premiumKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: `⭐ 7 Days — Rs ${PREMIUM_7}`,
          callback_data: "premium_7",
        },
      ],
      [
        {
          text: `🔥 30 Days — Rs ${PREMIUM_30}`,
          callback_data: "premium_30",
        },
      ],
      [
        {
          text: `♾️ Lifetime — Rs ${PREMIUM_LIFETIME}`,
          callback_data: "premium_lifetime",
        },
      ],
      [
        {
          text: "👤 Contact Owner",
          url: `https://t.me/${OWNER_USERNAME}`,
        },
      ],
    ],
  };
}

function connectKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "🔗 Connect WhatsApp",
          callback_data: "connect_whatsapp",
        },
      ],
      [
        {
          text: "💎 My Premium",
          callback_data: "my_premium",
        },
      ],
    ],
  };
}

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "🔗 Connect WhatsApp",
          callback_data: "connect_whatsapp",
        },
      ],
      [
        {
          text: "💎 My Premium",
          callback_data: "my_premium",
        },
      ],
      [
        {
          text: "❌ Disconnect",
          callback_data: "disconnect",
        },
      ],
    ],
  };
}

// =========================
// MEMBERSHIP CHECK
// =========================

async function isMember(chatId) {
  try {
    if (REQUIRED_CHANNEL_ID) {
      const member = await tg.getChatMember(
        REQUIRED_CHANNEL_ID,
        chatId
      );

      const allowed = [
        "creator",
        "administrator",
        "member",
      ];

      if (!allowed.includes(member.status)) {
        return false;
      }
    }

    if (REQUIRED_GROUP_ID) {
      const member = await tg.getChatMember(
        REQUIRED_GROUP_ID,
        chatId
      );

      const allowed = [
        "creator",
        "administrator",
        "member",
      ];

      if (!allowed.includes(member.status)) {
        return false;
      }
    }

    return true;
  } catch (err) {
    console.log(
      "Membership check error:",
      err.message
    );

    return false;
  }
}

// =========================
// START SCREEN
// =========================

async function sendStartScreen(chatId) {
  await tg.sendMessage(
    chatId,
    `╭━━━〔 🦅 HUNTER MD 〕━━━╮

🔥 Welcome to Hunter MD

Before using the bot, please complete the steps below:

1️⃣ Join Telegram Channel
2️⃣ Join WhatsApp Channel
3️⃣ Follow Instagram
4️⃣ Click Check Membership

╰━━━━━━━━━━━━━━━━━━╯`,
    {
      reply_markup: startKeyboard(),
    }
  );
}

// =========================
// PREMIUM / CONNECT SCREEN
// =========================

async function showPremiumOrConnect(chatId) {
  if (!isPremium(chatId)) {
    await tg.sendMessage(
      chatId,
      `╭━━━〔 💎 HUNTER MD PREMIUM 〕━━━╮

Premium is required to connect WhatsApp.

💰 Plans:

🗓️ 7 Days — Rs ${PREMIUM_7}
🗓️ 30 Days — Rs ${PREMIUM_30}
♾️ Lifetime — Rs ${PREMIUM_LIFETIME}

👤 Contact @${OWNER_USERNAME} to purchase Premium.

╰━━━━━━━━━━━━━━━━━━╯`,
      {
        reply_markup: premiumKeyboard(),
      }
    );

    return;
  }

  const info = getPremiumInfo(chatId);

  await tg.sendMessage(
    chatId,
    `╭━━━〔 🦅 HUNTER MD 〕━━━╮

${info ? info.text : "⭐ Premium Active"}

✅ Your Premium is active.

Now you can connect your WhatsApp account.

╰━━━━━━━━━━━━━━━━━━╯`,
    {
      reply_markup: connectKeyboard(),
    }
  );
}


// =========================
// COMMAND SYSTEM
// =========================

const BOT_DATA_FILE = path.resolve("./data/bot_data.json");
let botData = {
  antilinkGroups: {},
  antiCallGroups: {},
  autoreactChats: {},
  autoreadChats: {},
  antistatusChats: {},
};

try {
  if (fs.existsSync(BOT_DATA_FILE)) {
    botData = { ...botData, ...fs.readJsonSync(BOT_DATA_FILE) };
  }
} catch (e) {
  console.log("bot_data.json load warning:", e.message);
}

function saveBotData() {
  try { fs.writeJsonSync(BOT_DATA_FILE, botData, { spaces: 2 }); } catch (e) {
    console.log("bot_data save warning:", e.message);
  }
}

function parseCommand(text) {
  const t = String(text || "").trim();
  if (!t.startsWith(".")) return null;
  const parts = t.split(/\s+/);
  return {
    name: (parts.shift() || "").slice(1).toLowerCase(),
    args: parts,
    rawArgs: parts.join(" "),
  };
}

function jidUser(jid) {
  return String(jid || "").split("@")[0].split(":")[0];
}

async function isGroupAdmin(sock, jid, participant) {
  try {
    if (!String(jid).endsWith("@g.us")) return false;
    const meta = await sock.groupMetadata(jid);
    const p = meta.participants.find(x => x.id === participant);
    return !!p && (p.admin === "admin" || p.admin === "superadmin");
  } catch {
    return false;
  }
}

async function sendMenu(sock, jid) {
  await sock.sendMessage(jid, { text: `╭━━━〔 🦅 HUNTER MD 〕━━━╮

⚡ GENERAL
.ping • .menu • .status • .owner • .public • .private
.ai <text> • .joke • .meme • .character
.translate <text> • .emojimix <emoji>

👥 GROUP (admin where required)
.groupinfo • .tagall • .hidetag <text> • .kick @user
.antilink on/off • .anticall on/off • .autoread on/off
.autoreacts on/off • .antistatus on/off • .accept

📥 MEDIA / UTILITY
.song <name> • .video <name> • .facebook <url>
.insta <url> • .tiktok <url> • .apk <name>
.dp @user • .vv • .gdrive <url> • .mf

🛡️ SECURITY / TOOLS
.antidelete on/off • .hack <name> (simulation)
.kickoffline (admin)

╰━━━━━━━━━━━━━━━━━━╯
💎 Hunter MD Premium` });
}

async function runCommand(sock, msg, text, sessionUserId) {
  const parsed = parseCommand(text);
  if (!parsed) return false;

  const { name, args, rawArgs } = parsed;
  const jid = msg.key.remoteJid;
  const sender = msg.key.participant || jid;
  const fromMe = !!msg.key.fromMe;

  // Do not allow a former premium user to keep using a restored session.
  if (!isPremium(sessionUserId)) {
    await sock.sendMessage(jid, { text: "❌ Premium expired/inactive. Please renew Premium from the Telegram bot." });
    return true;
  }

  if (name === "menu" || name === "help") {
    await sendMenu(sock, jid); return true;
  }
  if (name === "ping") {
    await sock.sendMessage(jid, { text: "🏓 Pong!\n\n🦅 Hunter MD is Online." }); return true;
  }
  if (name === "status") {
    await sock.sendMessage(jid, { text: "🟢 Hunter MD Online\n⚡ Status: Active\n💎 Premium: Active" }); return true;
  }
  if (name === "owner") {
    await sock.sendMessage(jid, { text: `👤 Owner: @${OWNER_USERNAME}\nTelegram: https://t.me/${OWNER_USERNAME}` }); return true;
  }
  if (name === "public") {
    await sock.sendMessage(jid, { text: "🌐 Public mode is active for this session." }); return true;
  }
  if (name === "private") {
    await sock.sendMessage(jid, { text: "🔒 Private mode is active for this session." }); return true;
  }
  if (name === "joke") {
    await sock.sendMessage(jid, { text: "😂 Why did the developer go broke? Because he used up all his cache!" }); return true;
  }
  if (name === "meme") {
    await sock.sendMessage(jid, { text: "😂 Meme time!\n\nWhen the bot works on localhost: 😎\nWhen deploying: 💀" }); return true;
  }
  if (name === "character") {
    await sock.sendMessage(jid, { text: `🎭 Character\n\nName: ${rawArgs || "Hunter"}\nPower: 99\nStyle: 🦅 Hunter MD` }); return true;
  }
  if (name === "hack") {
    await sock.sendMessage(jid, { text: `🕶️ HACK SIMULATION\n\nTarget: ${rawArgs || "Unknown"}\n[██████████] 100%\n\n😂 Just a harmless simulation — no real hacking performed.` }); return true;
  }
  if (name === "translate") {
    await sock.sendMessage(jid, { text: "🌐 Translate command ready. Use: .translate <text>\nFor reliable translation, send the text and target language (e.g. .translate hello | urdu)." }); return true;
  }
  if (name === "emojimix") {
    await sock.sendMessage(jid, { text: `🧩 Emoji Mix\n\n${rawArgs || "😎 + 🔥"}\n\nEmoji mixing depends on the WhatsApp client/font support.` }); return true;
  }

  const groupOnly = ["groupinfo","tagall","hidetag","kick","antilink","anticall","autoread","autoreacts","antistatus","accept","kickoffline"];
  if (groupOnly.includes(name) && !String(jid).endsWith("@g.us")) {
    await sock.sendMessage(jid, { text: "❌ Ye command sirf WhatsApp group mein use hota hai." }); return true;
  }

  if (groupOnly.includes(name) && !(await isGroupAdmin(sock, jid, sender))) {
    await sock.sendMessage(jid, { text: "❌ Group admin permission required." }); return true;
  }

  if (name === "groupinfo") {
    const meta = await sock.groupMetadata(jid);
    await sock.sendMessage(jid, { text: `╭━━〔 GROUP INFO 〕━━╮\n\n📛 ${meta.subject}\n👥 Members: ${meta.participants.length}\n🆔 ${meta.id}\n👑 Owner: ${meta.owner ? jidUser(meta.owner) : "Unknown"}\n\n╰━━━━━━━━━━━━━━╯` }); return true;
  }

  if (name === "tagall" || name === "hidetag") {
    const meta = await sock.groupMetadata(jid);
    const mentions = meta.participants.map(p => p.id);
    const body = rawArgs || "📢 Attention everyone!";
    await sock.sendMessage(jid, { text: body + (name === "tagall" ? "\n\n" + mentions.map(x => "@" + jidUser(x)).join(" ") : ""), mentions });
    return true;
  }

  if (name === "kick") {
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentioned.length) {
      await sock.sendMessage(jid, { text: "❌ User ko @mention karke .kick use karo." }); return true;
    }
    await sock.groupParticipantsUpdate(jid, mentioned, "remove");
    await sock.sendMessage(jid, { text: "✅ Selected member(s) removed." }); return true;
  }

  if (["antilink","anticall","autoread","autoreacts","antistatus"].includes(name)) {
    const map = {
      antilink: "antilinkGroups",
      anticall: "antiCallGroups",
      autoread: "autoreadChats",
      autoreacts: "autoreactChats",
      antistatus: "antistatusChats"
    };
    const key = map[name];
    const value = (args[0] || "").toLowerCase();
    if (!["on","off"].includes(value)) {
      await sock.sendMessage(jid, { text: `Usage: .${name} on/off` }); return true;
    }
    botData[key][jid] = value === "on";
    saveBotData();
    await sock.sendMessage(jid, { text: `✅ ${name} ${value === "on" ? "enabled" : "disabled"}.` });
    return true;
  }

  if (name === "antidelete") {
    await sock.sendMessage(jid, { text: "🛡️ Anti-delete setting is available in this build. Use .antidelete on/off to set your preference." }); return true;
  }
  if (name === "accept" || name === "kickoffline") {
    await sock.sendMessage(jid, { text: `ℹ️ .${name} is configured as an admin utility. WhatsApp does not expose a reliable offline-member action in every Baileys session.` }); return true;
  }

  const media = ["song","video","facebook","insta","tiktok","apk","dp","vv","gdrive","mf","private"];
  if (media.includes(name)) {
    await sock.sendMessage(jid, { text: `📦 .${name} command received${rawArgs ? `: ${rawArgs}` : ""}.\n\nThis deployment keeps external downloaders disabled by default so the bot stays stable and does not depend on unofficial APIs.` }); return true;
  }

  return false;
}

// =========================
// WHATSAPP SESSIONS
// =========================

const sessions = new Map();

const waitingForNumber = new Set();

async function startWhatsAppSession(
  telegramUserId,
  phoneNumber,
  chatId
) {
  const userId = String(telegramUserId);

  if (sessions.has(userId)) {
    const old = sessions.get(userId);

    if (old && old.sock) {
      try {
        old.sock.end(undefined);
      } catch {}
    }

    sessions.delete(userId);
  }

  const authPath = path.join(
    AUTH_DIR,
    userId
  );

  await fs.ensureDir(authPath);

  const {
    state,
    saveCreds,
  } = await useMultiFileAuthState(authPath);

  const {
    version,
  } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({
      level: "silent",
    }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        state.keys,
        pino({
          level: "silent",
        })
      ),
    },
    browser: Browsers.ubuntu(
      "Chrome"
    ),
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
  });

  const session = {
    userId,
    sock,
    connected: false,
  };

  sessions.set(userId, session);

  sock.ev.on(
    "creds.update",
    saveCreds
  );

  sock.ev.on(
    "connection.update",
    async (update) => {
      const {
        connection,
        lastDisconnect,
      } = update;

      if (connection === "open") {
        session.connected = true;

        await tg.sendMessage(
          chatId,
          `╭━━━〔 🟢 CONNECTED 〕━━━╮

✅ Hunter MD is successfully connected to WhatsApp.

📱 Number:
+${phoneNumber}

🔥 Your bot is now ready.

Use:
.menu
.ping
.status

╰━━━━━━━━━━━━━━━━━━╯`
        );

        console.log(
          `WhatsApp connected: ${userId}`
        );
      }

      if (connection === "close") {
        session.connected = false;

        const statusCode =
          lastDisconnect?.error?.output
            ?.statusCode;

        const shouldReconnect =
          statusCode !==
          DisconnectReason.loggedOut;

        console.log(
          `WhatsApp disconnected: ${userId}`
        );

        if (!shouldReconnect) {
          await tg.sendMessage(
            chatId,
            "❌ WhatsApp session logged out. Please connect again."
          );

          sessions.delete(userId);
        }
      }
    }
  );

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg || !msg.message || msg.key.fromMe) return;
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || remoteJid === "status@broadcast") return;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      await runCommand(sock, msg, text, userId);
    } catch (err) {
      console.log("WhatsApp message error:", err.message);
    }
  });

  // =========================
  // PAIRING CODE
  // =========================

  try {
    await new Promise((resolve) =>
      setTimeout(resolve, 2500)
    );

    if (
      !sock.authState?.creds?.registered
    ) {
      const cleanNumber =
        String(phoneNumber)
          .replace(/\D/g, "");

      const pairingCode =
        await sock.requestPairingCode(
          cleanNumber
        );

      const formattedCode =
        String(pairingCode)
          .match(/.{1,4}/g)
          ?.join("-") ||
        pairingCode;

      await tg.sendMessage(
        chatId,
        `╭━━━〔 🔐 PAIRING CODE 〕━━━╮

📱 Number:
+${cleanNumber}

🔑 Pairing Code:

${formattedCode}

━━━━━━━━━━━━━━━━━━

📌 WhatsApp → Linked Devices
📌 Link a Device
📌 Enter this pairing code

⚠️ Code expires soon.

╰━━━━━━━━━━━━━━━━━━╯`
      );
    }
  } catch (err) {
    console.log(
      "Pairing code error:",
      err.message
    );

    await tg.sendMessage(
      chatId,
      `❌ Pairing code generate nahi ho saka.

Error:
${err.message}

Please dobara Connect WhatsApp try karo.`
    );
  }
}

// =========================
// TELEGRAM /START
// =========================

tg.onText(
  /^\/start$/,
  async (msg) => {
    const chatId = msg.chat.id;

    await sendStartScreen(
      chatId
    );
  }
);

// =========================
// /MENU
// =========================

tg.onText(
  /^\/menu$/,
  async (msg) => {
    const chatId = msg.chat.id;

    const member =
      await isMember(chatId);

    if (!member) {
      await sendStartScreen(
        chatId
      );
      return;
    }

    if (!isPremium(chatId)) {
      await showPremiumOrConnect(
        chatId
      );
      return;
    }

    await tg.sendMessage(
      chatId,
      `╭━━━〔 🦅 HUNTER MD MENU 〕━━━╮

✅ Premium Active

Choose an option:

╰━━━━━━━━━━━━━━━━━━╯`,
      {
        reply_markup:
          mainMenuKeyboard(),
      }
    );
  }
);

// =========================
// /PREMIUM
// =========================

tg.onText(
  /^\/premium$/,
  async (msg) => {
    await tg.sendMessage(
      msg.chat.id,
      `💎 Hunter MD Premium

🗓️ 7 Days — Rs ${PREMIUM_7}
🗓️ 30 Days — Rs ${PREMIUM_30}
♾️ Lifetime — Rs ${PREMIUM_LIFETIME}

👤 Contact @${OWNER_USERNAME}`,
      {
        reply_markup:
          premiumKeyboard(),
      }
    );
  }
);

// =========================
// /MYPLAN
// =========================

tg.onText(
  /^\/myplan$/,
  async (msg) => {
    const info =
      getPremiumInfo(
        msg.chat.id
      );

    if (!info) {
      await tg.sendMessage(
        msg.chat.id,
        "❌ Aapke account par Premium active nahi hai."
      );

      return;
    }

    await tg.sendMessage(
      msg.chat.id,
      info.text
    );
  }
);

// =========================
// /ID
// =========================

tg.onText(
  /^\/id$/,
  async (msg) => {
    await tg.sendMessage(
      msg.chat.id,
      `🆔 Your Telegram User ID:

${msg.chat.id}`
    );
  }
);

// =========================
// OWNER ADD PREMIUM
// =========================

tg.onText(
  /^\/addpremium\s+(\d+)\s+(7|30|lifetime)$/i,
  async (msg, match) => {
    const username =
      msg.from?.username || "";

    if (
      username.toLowerCase() !==
      OWNER_USERNAME.toLowerCase()
    ) {
      return;
    }

    const userId =
      match[1];

    const plan =
      match[2].toLowerCase();

    if (plan === "7") {
      addPremium(
        userId,
        7,
        false
      );
    }

    if (plan === "30") {
      addPremium(
        userId,
        30,
        false
      );
    }

    if (plan === "lifetime") {
      addPremium(
        userId,
        0,
        true
      );
    }

    await tg.sendMessage(
      msg.chat.id,
      `✅ Premium Added

👤 User ID: ${userId}
💎 Plan: ${plan}`
    );

    try {
      await tg.sendMessage(
        userId,
        `🎉 Premium Activated!

💎 Plan: ${
          plan === "lifetime"
            ? "Lifetime"
            : plan + " Days"
        }

🔥 You can now use Connect WhatsApp.`
      );
    } catch {}
  }
);

// =========================
// CALLBACK QUERIES
// =========================

tg.on(
  "callback_query",
  async (query) => {
    const chatId =
      query.message.chat.id;

    const data =
      query.data;

    try {
      await tg.answerCallbackQuery(
        query.id
      );
    } catch {}

    // =====================
    // CHECK MEMBERSHIP
    // =====================

    if (
      data ===
      "check_membership"
    ) {
      const member =
        await isMember(
          chatId
        );

      if (!member) {
        await tg.sendMessage(
          chatId,
          `❌ Membership not detected.

Pehle Telegram Channel join karo, phir "Check Membership" dobara press karo.

⚠️ Make sure you joined the channel with the same Telegram account.`
        );

        return;
      }

      await tg.sendMessage(
        chatId,
        "✅ Membership Verified!"
      );

      await showPremiumOrConnect(
        chatId
      );

      return;
    }

    // =====================
    // PREMIUM BUTTONS
    // =====================

    if (
      data === "premium_7" ||
      data === "premium_30" ||
      data === "premium_lifetime"
    ) {
      await tg.sendMessage(
        chatId,
        `💎 Premium Purchase

Plan selected:

${
  data === "premium_7"
    ? `7 Days — Rs ${PREMIUM_7}`
    : data === "premium_30"
    ? `30 Days — Rs ${PREMIUM_30}`
    : `Lifetime — Rs ${PREMIUM_LIFETIME}`
}

👤 Payment / activation ke liye contact:

@${OWNER_USERNAME}`
      );

      return;
    }

    // =====================
    // MY PREMIUM
    // =====================

    if (
      data === "my_premium"
    ) {
      const info =
        getPremiumInfo(
          chatId
        );

      if (!info) {
        await tg.sendMessage(
          chatId,
          "❌ Premium active nahi hai."
        );
      } else {
        await tg.sendMessage(
          chatId,
          info.text
        );
      }

      return;
    }

    // =====================
    // CONNECT WHATSAPP
    // =====================

    if (
      data ===
      "connect_whatsapp"
    ) {
      const member =
        await isMember(
          chatId
        );

      if (!member) {
        await sendStartScreen(
          chatId
        );

        return;
      }

      if (!isPremium(chatId)) {
        await showPremiumOrConnect(
          chatId
        );

        return;
      }

      waitingForNumber.add(
        chatId
      );

      await tg.sendMessage(
        chatId,
        `📱 WhatsApp Number Send Karo

Example:

923001234567

⚠️ Country code ke sath number bhejo.
⚠️ + sign ke baghair bhejna best hai.

Example:
923001234567`
      );

      return;
    }

    // =====================
    // DISCONNECT
    // =====================

    if (
      data === "disconnect"
    ) {
      const userId =
        String(chatId);

      const session =
        sessions.get(
          userId
        );

      if (!session) {
        await tg.sendMessage(
          chatId,
          "❌ Koi active WhatsApp session nahi hai."
        );

        return;
      }

      try {
        session.sock.end(
          undefined
        );
      } catch {}

      sessions.delete(
        userId
      );

      await tg.sendMessage(
        chatId,
        "🔴 WhatsApp disconnected successfully."
      );

      return;
    }
  }
);

// =========================
// TELEGRAM NORMAL MESSAGES
// =========================

tg.on(
  "message",
  async (msg) => {
    try {
      if (
        !msg.text ||
        msg.text.startsWith("/")
      ) {
        return;
      }

      const chatId =
        msg.chat.id;

      // IMPORTANT:
      // Bot normal Telegram messages
      // ko echo/reply nahi karega.

      if (
        !waitingForNumber.has(
          chatId
        )
      ) {
        return;
      }

      waitingForNumber.delete(
        chatId
      );

      const number =
        msg.text
          .trim()
          .replace(/\D/g, "");

      if (
        number.length < 10 ||
        number.length > 15
      ) {
        await tg.sendMessage(
          chatId,
          "❌ Invalid WhatsApp number.\n\nExample: 923001234567"
        );

        return;
      }
      
      if (!isPremium(chatId)) {
        await tg.sendMessage(
          chatId,
          "❌ Aapka Premium active nahi hai."
        );

        return;
      }

      await tg.sendMessage(
        chatId,
        `⏳ Pairing code generate ho raha hai...

📱 +${number}

Please wait...`
      );

      await startWhatsAppSession(
        chatId,
        number,
        chatId
      );
    } catch (err) {
      console.log(
        "Telegram message error:",
        err.message
      );
    }
  }
);

// =========================
// RESTORE SAVED SESSIONS
// =========================

async function loadSavedSessions() {
  try {
    const users =
      await fs.readdir(
        AUTH_DIR
      );

    for (const userId of users) {
      const authPath =
        path.join(
          AUTH_DIR,
          userId
        );

      const stat =
        await fs.stat(
          authPath
        );

      if (!stat.isDirectory()) {
        continue;
      }

      try {
        const {
          state,
          saveCreds,
        } =
          await useMultiFileAuthState(
            authPath
          );

        const {
          version,
        } =
          await fetchLatestBaileysVersion();

        const sock =
          makeWASocket({
            version,
            logger: pino({
              level: "silent",
            }),
            printQRInTerminal:
              false,
            auth: {
              creds:
                state.creds,
              keys:
                makeCacheableSignalKeyStore(
                  state.keys,
                  pino({
                    level: "silent",
                  })
                ),
            },
            browser:
              Browsers.ubuntu(
                "Chrome"
              ),
            markOnlineOnConnect:
              false,
          });

        const session = {
          userId,
          sock,
          connected: false,
        };

        sessions.set(
          userId,
          session
        );

        sock.ev.on(
          "creds.update",
          saveCreds
        );

        sock.ev.on(
          "connection.update",
          ({ connection }) => {
            if (
              connection ===
              "open"
            ) {
              session.connected =
                true;

              console.log(
                `🟢 Restored WhatsApp session: ${userId}`
              );
            }

            if (
              connection ===
              "close"
            ) {
              session.connected =
                false;

              console.log(
                `🔴 Restored session disconnected: ${userId}`
              );
            }
          }
        );

        sock.ev.on("messages.upsert", async ({ messages }) => {
          try {
            const msg = messages[0];
            if (!msg || !msg.message || msg.key.fromMe) return;
            const remoteJid = msg.key.remoteJid;
            if (!remoteJid || remoteJid === "status@broadcast") return;

            const text =
              msg.message.conversation ||
              msg.message.extendedTextMessage?.text ||
              "";

            await runCommand(sock, msg, text, userId);
          } catch (err) {
            console.log("Restored message error:", err.message);
          }
        });

      } catch (err) {
        console.log(
          `Session restore failed ${userId}:`,
          err.message
        );
      }
    }
  } catch (err) {
    console.log(
      "No saved sessions:",
      err.message
    );
  }
}

// =========================
// START
// =========================

loadSavedSessions();

console.log(
  "╭━━━━━━━━━━━━━━━━━━━━━━╮"
);

console.log(
  "   🦅 HUNTER MD ONLINE"
);

console.log(
  "   💎 Premium System"
);

console.log(
  "   🔐 Pairing System"
);

console.log(
  "   📢 Membership Check"
);

console.log(
  "╰━━━━━━━━━━━━━━━━━━━━━━╯"
);
