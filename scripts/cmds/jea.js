const axios = require("axios");

// ======================
// GLOBAL STATE
// ======================
let simEnabled = false;
const cooldown = new Map();

// ======================
// AI FUNCTION
// ======================
async function getSimReply(api, event, prompt) {
  try {
    const uid = event.senderID;
    let name = "User";

    // SAFE get name
    try {
      const threadInfo = await api.getThreadInfo(event.threadID);
      const user = threadInfo.userInfo?.find(u => u.id === uid);

      if (user?.name && user.name !== "Facebook User") {
        name = user.name.split(" ")[0];
      }

      if (threadInfo.nicknames?.[uid]) {
        name = threadInfo.nicknames[uid];
      }
    } catch {
      // ignore
    }

    if (!name || name === "Facebook User") {
      name = `User_${String(uid).slice(-4)}`;
    }

    const apiBase = "https://norch-project.gleeze.com/api/jea";

    const res = await axios.get(apiBase, {
      params: { prompt, uid, name },
      timeout: 15000
    });

    if (!res.data?.reply) return null;

    return res.data.reply;

  } catch (err) {
    console.error("[JEA API ERROR]", err.message);
    return null;
  }
}

// ======================
// MODULE EXPORT
// ======================
module.exports = {
  config: {
    name: "jea",
    version: "3.1.0",
    author: "April Manalo (fixed)",
    role: 0,
    category: "ai",
    guide: "-jea on | off | <message>"
  },

  // ======================
  // COMMAND
  // ======================
  onStart: async function ({ api, event, args }) {
    try {
      const action = args[0]?.toLowerCase();

      if (action === "on") {
        simEnabled = true;
        return api.sendMessage(
          "✅ Jea auto-reply is now ON.",
          event.threadID,
          event.messageID
        );
      }

      if (action === "off") {
        simEnabled = false;
        return api.sendMessage(
          "❌ Jea auto-reply is now OFF.",
          event.threadID,
          event.messageID
        );
      }

      const prompt = args.join(" ").trim();
      if (!prompt) {
        return api.sendMessage(
          "⚠️ Usage:\n-jea on\n-jea off\n-jea <message>",
          event.threadID,
          event.messageID
        );
      }

      const reply = await getSimReply(api, event, prompt);
      if (!reply) {
        return api.sendMessage(
          "⚠️ Jea is unavailable.",
          event.threadID,
          event.messageID
        );
      }

      return api.sendMessage(
        reply,
        event.threadID,
        event.messageID
      );

    } catch (err) {
      console.error("[JEA onStart ERROR]", err);
    }
  },

  // ======================
  // AUTO CHAT
  // ======================
  onChat: async function ({ api, event }) {
    try {
      // must be enabled
      if (!simEnabled) return;

      // ignore bot itself
      if (event.senderID === api.getCurrentUserID()) return;

      // ignore non-text
      if (!event.body || typeof event.body !== "string") return;

      const body = event.body.trim();

      // ignore commands
      if (body.startsWith("-")) return;

      // ignore very short
      if (body.length < 2) return;

      // cooldown (5 sec per user)
      const now = Date.now();
      if (cooldown.get(event.senderID) > now - 5000) return;
      cooldown.set(event.senderID, now);

      console.log("[JEA] Auto-reply:", body);

      const reply = await getSimReply(api, event, body);
      if (!reply) return;

      await api.sendMessage(
        reply,
        event.threadID,
        event.messageID
      );

    } catch (err) {
      console.error("[JEA onChat ERROR]", err);
    }
  }
};
