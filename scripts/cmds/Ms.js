const express = require('express');
const request = require('request');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const yts = require('yt-search');

const app = express();
app.use(express.json());

// আপনার Facebook Page Access Token এবং Verify Token
const PAGE_ACCESS_TOKEN = 'YOUR_PAGE_ACCESS_TOKEN';
const VERIFY_TOKEN = 'YOUR_VERIFY_TOKEN';

// Webhook verification
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// Message handling
app.post('/webhook', (req, res) => {
    const body = req.body;

    if (body.object === 'page') {
        body.entry.forEach((entry) => {
            const webhookEvent = entry.messaging[0];
            console.log(webhookEvent);

            const senderPsid = webhookEvent.sender.id;
            
            if (webhookEvent.message) {
                handleMessage(senderPsid, webhookEvent.message);
            }
        });

        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
    }
});

// Message handler function
async function handleMessage(senderPsid, receivedMessage) {
    let response;

    if (receivedMessage.text) {
        const messageText = receivedMessage.text.toLowerCase();

        // /ms command check
        if (messageText.startsWith('/ms ')) {
            const musicName = receivedMessage.text.substring(4); // Remove '/ms '
            await handleMusicRequest(senderPsid, musicName);
            return;
        } else {
            // Default response
            response = {
                "text": `আপনি লিখেছেন: "${receivedMessage.text}"\n\nমিউজিক শুনতে চাইলে টাইপ করুন: /ms [গানের নাম]`
            };
        }
    }

    callSendAPI(senderPsid, response);
}

// Music request handler
async function handleMusicRequest(senderPsid, musicName) {
    try {
        // First send a "searching" message
        const searchingResponse = {
            "text": `🎵 "${musicName}" খোঁজা হচ্ছে... অপেক্ষা করুন।`
        };
        callSendAPI(senderPsid, searchingResponse);

        // Search for music on YouTube
        const searchResults = await yts(musicName);
        
        if (searchResults.videos.length === 0) {
            const notFoundResponse = {
                "text": `😔 "${musicName}" নামে কোন গান পাওয়া যায়নি। অন্য নাম দিয়ে চেষ্টা করুন।`
            };
            callSendAPI(senderPsid, notFoundResponse);
            return;
        }

        const video = searchResults.videos[0];
        const videoUrl = video.url;
        
        console.log(`Found: ${video.title} - ${videoUrl}`);

        // Download and convert to audio
        await downloadAndSendAudio(senderPsid, videoUrl, video.title);

    } catch (error) {
        console.error('Error in music request:', error);
        const errorResponse = {
            "text": "❌ গান ডাউনলোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।"
        };
        callSendAPI(senderPsid, errorResponse);
    }
}

// Download and send audio function
async function downloadAndSendAudio(senderPsid, videoUrl, title) {
    try {
        const fileName = `music_${Date.now()}.mp3`;
        const filePath = path.join(__dirname, 'temp', fileName);

        // Create temp directory if it doesn't exist
        if (!fs.existsSync(path.join(__dirname, 'temp'))) {
            fs.mkdirSync(path.join(__dirname, 'temp'));
        }

        // Download audio using ytdl-core
        const audioStream = ytdl(videoUrl, {
            filter: 'audioonly',
            quality: 'lowestaudio',
        });

        const writeStream = fs.createWriteStream(filePath);
        audioStream.pipe(writeStream);

        writeStream.on('finish', async () => {
            console.log('Audio downloaded successfully');
            
            // Upload to Facebook and send
            await uploadAndSendAudio(senderPsid, filePath, title);
            
            // Clean up temp file
            fs.unlinkSync(filePath);
        });

        writeStream.on('error', (error) => {
            console.error('Error writing audio file:', error);
            const errorResponse = {
                "text": "❌ অডিও ফাইল তৈরি করতে সমস্যা হয়েছে।"
            };
            callSendAPI(senderPsid, errorResponse);
        });

    } catch (error) {
        console.error('Error downloading audio:', error);
        const errorResponse = {
            "text": "❌ গান ডাউনলোড করতে সমস্যা হয়েছে।"
        };
        callSendAPI(senderPsid, errorResponse);
    }
}

// Upload and send audio to Facebook
async function uploadAndSendAudio(senderPsid, filePath, title) {
    try {
        // First upload the audio file to Facebook
        const uploadUrl = `https://graph.facebook.com/v18.0/me/message_attachments?access_token=${PAGE_ACCESS_TOKEN}`;
        
        const formData = {
            message: JSON.stringify({
                attachment: {
                    type: "audio",
                    payload: {
                        is_reusable: false
                    }
                }
            }),
            filedata: fs.createReadStream(filePath)
        };

        request.post({
            url: uploadUrl,
            formData: formData
        }, (error, response, body) => {
            if (error) {
                console.error('Upload error:', error);
                return;
            }

            const uploadResponse = JSON.parse(body);
            
            if (uploadResponse.attachment_id) {
                // Send the uploaded audio
                const audioMessage = {
                    attachment: {
                        type: "audio",
                        payload: {
                            attachment_id: uploadResponse.attachment_id
                        }
                    }
                };

                callSendAPI(senderPsid, audioMessage);

                // Send success message
                const successMessage = {
                    "text": `🎵 "${title}" পাঠানো হয়েছে!`
                };
                callSendAPI(senderPsid, successMessage);
            } else {
                console.error('Upload failed:', uploadResponse);
                const errorResponse = {
                    "text": "❌ অডিও আপলোড করতে সমস্যা হয়েছে।"
                };
                callSendAPI(senderPsid, errorResponse);
            }
        });

    } catch (error) {
        console.error('Error uploading audio:', error);
        const errorResponse = {
            "text": "❌ অডিও পাঠাতে সমস্যা হয়েছে।"
        };
        callSendAPI(senderPsid, errorResponse);
    }
}

// Send message to Facebook Messenger
function callSendAPI(senderPsid, response) {
    const requestBody = {
        'recipient': {
            'id': senderPsid
        },
        'message': response
    };

    request({
        'uri': 'https://graph.facebook.com/v18.0/me/messages',
        'qs': { 'access_token': PAGE_ACCESS_TOKEN },
        'method': 'POST',
        'json': requestBody
    }, (err, res, body) => {
        if (!err) {
            console.log('Message sent!');
        } else {
            console.error('Unable to send message:' + err);
        }
    });
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    process.exit(0);
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
