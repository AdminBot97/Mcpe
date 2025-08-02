const axios = require("axios");

module.exports = {
  config: {
    name: "ms",
    aliases: [],
    version: "1.0",
    author: "EcholesFire",
    countDown: 5,
    role: 0,
    shortDescription: "গান শোনাও",
    longDescription: "YouTube MP3 API ব্যবহার করে গান শোনায়",
    category: "Media",
    guide: {
      en: "{pn} গাননাম"
    }
  },

  onStart: async function ({ message, args }) {
    if (!args[0]) return message.reply("🎵 একটি গানের নাম লিখুন। যেমন: /ms Tum Hi Ho");

    const query = args.join(" ");
    const apiUrl = `https://yt-api.vercel.app/api/mp3?query=${encodeURIComponent(query)}`;

    try {
      const res = await axios.get(apiUrl);
      const data = res.data;

      if (!data || !data.url) {
        return message.reply("⚠️ গান খুঁজে পাওয়া যায়নি।");
      }

      return message.reply({
        body: `🎶 ${data.title}`,
        attachment: await global.utils.getStreamFromURL(data.url)
      });

    } catch (err) {
      console.error("MP3 fetch error:", err.message);
      return message.reply("❌ গান আনতে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।");
    }
  }
};function sendAudio(recipientId, audioUrl) {
  const PAGE_ACCESS_TOKEN = "YOUR_PAGE_ACCESS_TOKEN"; // 🔁 এখানে তোমার বটের টোকেন বসাও

  const messageData = {
    recipient: { id: recipientId },
    message: {
      attachment: {
        type: "audio",
        payload: {
          url: audioUrl,
          is_reusable: true
        }
      }
    }
  };

  request({
    uri: "https://graph.facebook.com/v13.0/me/messages",
    qs: { access_token: PAGE_ACCESS_TOKEN },
    method: "POST",
    json: messageData
  }, (err, res, body) => {
    if (!err) {
      console.log("✅ MP3 পাঠানো হয়েছে");
    } else {
      console.error("❌ MP3 পাঠাতে সমস্যা:", err);
    }
  });
}
