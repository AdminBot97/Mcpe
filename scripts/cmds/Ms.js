const axios = require("axios");
const request = require("request");

module.exports = {
  name: "ms",
  description: "গানের mp3 পাঠাও",
  async execute(message, args) {
    if (!args.length) {
      return message.reply("🎵 গান খুঁজতে `/ms গাননাম` লিখো।");
    }

    const query = args.join(" ");
    const apiUrl = `https://yt-api.vercel.app/api/mp3?query=${encodeURIComponent(query)}`;

    try {
      const res = await axios.get(apiUrl);
      const data = res.data;

      if (!data || !data.url) {
        return message.reply("গান খুঁজে পাওয়া যায়নি।");
      }

      // Messenger API দিয়ে MP3 ফাইল voice হিসেবে পাঠানো
      sendAudio(message.sender.id, data.url);  // ✅ sender.id লাগবে

      // চাইলে text reply-ও দাও
      message.reply(`🎶 "${data.title}" গানটি পাঠানো হয়েছে!`);
      
    } catch (err) {
      console.error("❌ MP3 fetch error:", err.message);
      message.reply("MP3 আনতে সমস্যা হচ্ছে। পরে আবার চেষ্টা করো।");
    }
  }
};

// ✅ Messenger Send API দিয়ে MP3 পাঠানোর ফাংশন
function sendAudio(recipientId, audioUrl) {
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
