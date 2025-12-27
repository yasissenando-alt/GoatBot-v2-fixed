const axios = require("axios");

/**
 * 🔴 ROOT FIX
 * GoatBot V2 DOES NOT auto-create handleReply
 */
if (!global.client.handleReply) {
  global.client.handleReply = [];
}

module.exports = {
  config: {
    name: "music",
    version: "2.2.0",
    author: "April Manalo (YT Search + YTMP3)",
    role: 0,
    category: "music",
    guide: "-music <song name>"
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID } = event;
    const query = args.join(" ").trim();

    try {
      if (!query) {
        return api.sendMessage(
          "⚠️ Usage: -music <song name>\nExample: -music hiling mark carpio",
          threadID
        );
      }

      await api.sendMessage("🔎 Searching music on YouTube...", threadID);

      // 🔍 YOUTUBE SEARCH
      const searchRes = await axios.get(
        "https://norch-project.gleeze.com/api/youtube",
        { params: { q: query } }
      );

      const results = searchRes.data?.results;

      if (!results || results.length === 0) {
        return api.sendMessage("❌ No results found.", threadID);
      }

      // Show top 5 results
      const topResults = results.slice(0, 5);
      let msg = "🎵 Select a song to download:\n\n";
      topResults.forEach((video, index) => {
        msg += `${index + 1}. ${video.title}\n📺 ${video.channel}\n⏱ ${video.duration}\n\n`;
      });
      msg += "Reply with the number of your choice (1-5).";

      api.sendMessage(msg, threadID, (err, info) => {
        if (err) return console.error(err);
        global.GoatBot.onReply.set(info.messageID, {
          commandName: this.config.name,
          messageID: info.messageID,
          author: event.senderID,
          results: topResults
        });
      }, messageID);

    } catch (err) {
      console.error("[MUSIC ERROR]", err);
      api.sendMessage("❌ Error while searching. Try again later.", threadID);
    }
  },

  onReply: async function ({ api, event, Reply }) {
    const { threadID, messageID, body, senderID } = event;
    const { author, results } = Reply;

    if (senderID !== author) return;

    const choice = parseInt(body);
    if (isNaN(choice) || choice < 1 || choice > results.length) {
      return api.sendMessage(`⚠️ Invalid choice. Please reply with a number between 1 and ${results.length}.`, threadID, messageID);
    }

    const video = results[choice - 1];
    
    // Attempt to unsend the selection menu
    try {
      api.unsendMessage(Reply.messageID);
    } catch (e) {}

    try {
      await api.sendMessage(
        `✅ Selected: ${video.title}\n⬇️ Downloading audio...`,
        threadID
      );

      // ⬇️ YTMP3 DOWNLOAD
      const dlRes = await axios.get(
        "https://norch-project.gleeze.com/api/ytmp3",
        { params: { url: video.url } }
      );

      const data = dlRes.data?.result;

      if (!data || !data.downloadUrl) {
        return api.sendMessage("❌ Failed to get MP3 download link.", threadID);
      }

      // 🖼 SEND COVER
      if (data.cover) {
        await api.sendMessage(
          {
            body: `🎧 ${data.title}\n⏱ ${data.duration}\n🎼 MP3 ${data.quality}kbps`,
            attachment: await global.utils.getStreamFromURL(data.cover)
          },
          threadID
        );
      }

      // 🎵 SEND MP3 FILE
      await api.sendMessage(
        {
          body: "📁 Here is your audio:",
          attachment: await global.utils.getStreamFromURL(data.downloadUrl)
        },
        threadID
      );

      await api.sendMessage("✅ Download complete! 🎉", threadID);
      
    } catch (err) {
      console.error("[MUSIC ERROR]", err);
      api.sendMessage("❌ Error while downloading. Try again later.", threadID);
    }
    
    global.GoatBot.onReply.delete(Reply.messageID);
  }
};
