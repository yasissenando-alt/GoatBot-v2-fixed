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
    name: "spotify",
    version: "1.0.2",
    author: "April Manalo (final fixed)",
    role: 0,
    category: "music",
    guide: "-spotify <song name>"
  },

  // ==========================
  // START COMMAND
  // ==========================
  onStart: async function ({ api, event, args }) {
    try {
      const { threadID, senderID } = event;
      const query = args.join(" ").trim();

      console.log("[SPOTIFY] onStart triggered:", query);

      if (!query) {
        return api.sendMessage(
          "⚠️ Usage: -spotify <song name>",
          threadID
        );
      }

      await api.sendMessage("🔎 Searching Spotify...", threadID);

      const res = await axios.get(
        "https://norch-project.gleeze.com/api/spotify",
        { params: { q: query } }
      );

      const songs = res.data?.results?.slice(0, 5);

      console.log("[SPOTIFY] Search results:", songs?.length);

      if (!songs || !songs.length) {
        return api.sendMessage("❌ No results found.", threadID);
      }

      let text = "🎧 Spotify Results:\n\n";
      songs.forEach((s, i) => {
        text += `${i + 1}. ${s.title} - ${s.artist}\n⏱ ${s.duration}\n\n`;
      });
      text += "👉 Reply with a number (1–5)";

      const listMsg = await api.sendMessage(text, threadID);

      console.log("[SPOTIFY] Register handleReply:", listMsg.messageID);

      global.client.handleReply.push({
        name: this.config.name,
        type: "spotify_selection",
        messageID: listMsg.messageID,
        author: senderID,
        songs
      });

    } catch (err) {
      console.error("[SPOTIFY onStart ERROR]", err);
    }
  },

  // ==========================
  // REPLY HANDLER
  // ==========================
  onReply: async function ({ api, event, handleReply }) {
    try {
      console.log("[SPOTIFY] onReply fired");

      if (!handleReply) {
        console.log("[SPOTIFY] handleReply is UNDEFINED");
        return;
      }

      const { threadID, senderID, body } = event;

      console.log("[SPOTIFY] Reply body:", body);
      console.log("[SPOTIFY] handleReply data:", handleReply);

      if (senderID !== handleReply.author) {
        console.log("[SPOTIFY] Sender mismatch");
        return;
      }

      if (handleReply.type !== "spotify_selection") {
        console.log("[SPOTIFY] Wrong type:", handleReply.type);
        return;
      }

      const index = parseInt(body);
      console.log("[SPOTIFY] Parsed index:", index);

      if (isNaN(index) || index < 1 || index > handleReply.songs.length) {
        return api.sendMessage("❌ Invalid number.", threadID);
      }

      const song = handleReply.songs[index - 1];
      console.log("[SPOTIFY] Selected song:", song);

      if (!song.spotify_url) {
        throw new Error("spotify_url is missing");
      }

      await api.sendMessage(
        `⬇️ Downloading\n🎵 ${song.title}\n👤 ${song.artist}`,
        threadID
      );

      const dl = await axios.get(
        "https://norch-project.gleeze.com/api/spotify-dl-v2",
        { params: { url: song.spotify_url } }
      );

      const track = dl.data?.trackData?.[0];
      console.log("[SPOTIFY] Download response:", track);

      if (!track?.download_url) {
        throw new Error("No download_url");
      }

      // 🎨 Cover image
      if (track.image) {
        await api.sendMessage(
          {
            body: `🎧 ${track.name}\n👤 ${track.artists}`,
            attachment: await global.utils.getStreamFromURL(track.image)
          },
          threadID
        );
      }

      // 🎵 MP3
      await api.sendMessage(
        {
          attachment: await global.utils.getStreamFromURL(
            track.download_url
          )
        },
        threadID
      );

      // 🧹 CLEANUP
      global.client.handleReply =
        global.client.handleReply.filter(
          r => r.messageID !== handleReply.messageID
        );

      console.log("[SPOTIFY] Done & cleaned");

    } catch (err) {
      console.error("[SPOTIFY onReply ERROR]", err);
      api.sendMessage("❌ Download failed. Check logs.", event.threadID);
    }
  }
};
