const axios = require("axios");

module.exports = {
  config: {
    name: "spotify",
    version: "2.0.0",
    author: "April Manalo",
    role: 0,
    category: "music",
    guide: "spotify <song name>"
  },

  onStart: async function ({ api, event, args }) {
    const query = args.join(" ").trim();
    if (!query) {
      return api.sendMessage(
        "⚠️ Usage: spotify <song name>",
        event.threadID,
        event.messageID
      );
    }

    let searchMsg;
    try {
      searchMsg = await api.sendMessage(
        "🔎 Searching Spotify...",
        event.threadID,
        event.messageID
      );

      // 🔥 SEARCH API
      const res = await axios.get(
        "https://norch-project.gleeze.com/api/spotify",
        {
          params: { query },
          timeout: 15000
        }
      );

      if (!res.data || !Array.isArray(res.data.results) || res.data.results.length === 0) {
        return api.sendMessage("❌ No results found.", event.threadID);
      }

      const songs = res.data.results.slice(0, 5);

      let msg = "🎧 Spotify Results:\n\n";
      songs.forEach((s, i) => {
        msg += `${i + 1}. ${s.title}\n👤 ${s.artist}\n⏱ ${s.duration}\n\n`;
      });
      msg += "👉 Reply with number (1–5)";

      const listMsg = await api.sendMessage(msg, event.threadID);

      // ❗ REGISTER REPLY (MAP, NOT PUSH)
      global.GoatBot.onReply.set(listMsg.messageID, {
        commandName: this.config.name,
        author: event.senderID,
        songs
      });

    } catch (err) {
      console.error("[SPOTIFY SEARCH ERROR]", err);
      return api.sendMessage("❌ Failed to search Spotify.", event.threadID);
    }
  },

  onReply: async function ({ api, event, Reply }) {
    if (event.senderID !== Reply.author) return;

    const choice = parseInt(event.body);
    if (isNaN(choice) || choice < 1 || choice > Reply.songs.length) {
      return api.sendMessage("❌ Invalid choice (1–5 only).", event.threadID);
    }

    const song = Reply.songs[choice - 1];

    try {
      // 🧹 UNSEND CHOICES
      if (event.messageReply?.messageID) {
        api.unsendMessage(event.messageReply.messageID);
      }

      const loadingMsg = await api.sendMessage(
        `⏳ Downloading...\n\n🎵 ${song.title}\n👤 ${song.artist}`,
        event.threadID
      );

      // 🔥 DOWNLOAD API
      const dl = await axios.get(
        "https://norch-project.gleeze.com/api/spotifydl",
        {
          params: { url: song.url },
          timeout: 30000
        }
      );

      if (!dl.data || !dl.data.downloadUrl) {
        throw new Error("Invalid download response");
      }

      await api.sendMessage(
        {
          body: `🎶 ${song.title} - ${song.artist}`,
          attachment: await global.utils.getStreamFromURL(dl.data.downloadUrl)
        },
        event.threadID
      );

      api.unsendMessage(loadingMsg.messageID);

    } catch (err) {
      console.error("[SPOTIFY DOWNLOAD ERROR]", err);
      api.sendMessage("❌ Failed to download track.", event.threadID);
    } finally {
      // 🧼 CLEAN REPLY
      global.GoatBot.onReply.delete(event.messageReply.messageID);
    }
  }
};
