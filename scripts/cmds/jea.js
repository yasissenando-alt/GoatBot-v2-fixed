const axios = require("axios");

let simEnabled = false;

async function getSimReply(api, event, prompt) {
  const uid = event.senderID;
  let name = "User";

  // ✅ ws3-fca SAFE NAME DETECTION
  try {
    const threadInfo = await api.getThreadInfo(event.threadID);

    // real FB name
    const user = threadInfo.userInfo?.find(u => u.id === uid);
    if (user?.name && user.name !== "Facebook User") {
      name = user.name.split(" ")[0];
    }

    // nickname override
    if (threadInfo.nicknames && threadInfo.nicknames[uid]) {
      name = threadInfo.nicknames[uid];
    }
  } catch (e) {
    console.warn("[SIM] getThreadInfo failed");
  }

  // final fallback
  if (!name || name === "Facebook User") {
    name = `User_${String(uid).slice(-4)}`;
  }

  const apiBase = "https://norch-project.gleeze.com/api/jea";
  const usePost = prompt.length > 800;

  try {
    let data;

    if (usePost) {
      const res = await axios.post(
        apiBase,
        { prompt, uid, name },
        { timeout: 12000 }
      );
      data = res.data;
    } else {
      const res = await axios.get(apiBase, {
        params: { prompt, uid, name },
        timeout: 12000
      });
      data = res.data;
    }

    if (!data?.reply) {
      throw new Error("Invalid API response");
    }

    return data.reply;

  } catch (err) {
    console.error("[SIM API ERROR]", err?.message || err);
    return null;
  }
}

module.exports = {
  config: {
    name: "Jea",
    version: "3.0.0",
    author: "April Manalo",
    role: 0,
    category: "ai",
    guide: "jea [on | off | message]: Enable/disable auto-reply or send a message"
  },

  onStart: async function ({ api, event, args }) {
    const action = args[0]?.toLowerCase();

    // Toggle on/off
    if (action === "on") {
      simEnabled = true;
      return api.sendMessage(
        "✅ Jea auto-reply is now ON. I'll respond to all messages automatically.",
        event.threadID,
        String(event.messageID)
      );
    }

    if (action === "off") {
      simEnabled = false;
      return api.sendMessage(
        "❌ Jea auto-reply is now OFF. Use -jea <message> to ask me.",
        event.threadID,
        String(event.messageID)
      );
    }

    // If no args or first arg is not on/off, treat entire input as prompt
    const prompt = args.join(" ").trim();
    if (!prompt) {
      return api.sendMessage(
        "⚠️ Please type a message.\nExample: -jea hello\n\nOr toggle auto-reply:\n-jea on\n-sim off",
        event.threadID,
        String(event.messageID)
      );
    }

    // Get sim response
    const reply = await getSimReply(api, event, prompt);
    if (reply) {
      return api.sendMessage(
        reply,
        event.threadID,
        String(event.messageID)
      );
    } else {
      return api.sendMessage(
        "⚠️ jea is currently unavailable.",
        event.threadID,
        String(event.messageID)
      );
    }
  },

  onChat: async function ({ api, event }) {
    if (simEnabled && event.senderID !== api.getCurrentUserID()) {
      const prompt = event.body?.trim();
      
      if (!prompt) return;

      // Get sim response
      const reply = await getSimReply(api, event, prompt);
      if (reply) {
        api.sendMessage(reply, event.threadID, String(event.messageID));
      }
    }
  }
};
