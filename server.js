const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// स्टैटिक फाइलों और एसेट्स को लोड करने के लिए
app.use(express.static(__dirname));

// मुख्य होमपेज के लिए index.html सर्व करेगा
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// लाइव रिजल्ट स्टेट जो tgdream.pro से सिंक करेगा
let liveGameData = {
  period: "20261115100010460",
  number: "3",
  size: "Small",
  color: "Green",
  timer: 30,
  updatedAt: Date.now()
};

// बोट फंक्शन: tgdream.pro को ट्रैक करने के लिए
async function pollTirangaLive() {
  try {
    const response = await axios.get('https://tgdream.pro/api/web/GetGameIssue', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://tgdream.post/'
      },
      timeout: 3000
    });

    if (response.data && response.data.data) {
      var item = response.data.data;
      liveGameData.period = item.issueNumber || liveGameData.period;
      var num = Number(item.number || Math.floor(Math.random()*10));
      liveGameData.number = String(num);
      liveGameData.size = num >= 5 ? "Big" : "Small";
      liveGameData.color = num % 2 === 0 ? "Red" : "Green";
      if(num === 0 || num === 5) liveGameData.color = "Violet";
      liveGameData.updatedAt = Date.now();
    }
  } catch (err) {
    // फॉलबैक सिमुलेशन ताकि गेम हमेशा चलता रहे
    var d = new Date();
    var tot = d.getHours()*3600 + d.getMinutes()*60 + d.getSeconds();
    var idx = Math.floor(tot / 30);
    var simulatedNum = (idx * 73) % 10;
    liveGameData.period = "202611151000" + (50000 + idx);
    liveGameData.number = String(simulatedNum);
    liveGameData.size = simulatedNum >= 5 ? "Big" : "Small";
    liveGameData.color = simulatedNum % 2 === 0 ? "Red" : "Green";
  }
}

// हर 1.5 सेकंड में पोलिंग बोट रन होगा
setInterval(pollTirangaLive, 1500);

// वेबसाइट के लिए लाइव API Endpoint
app.get('/api/tiranga-sync', (req, res) => {
  res.json({
    success: true,
    source: "tgdream.pro-bridge",
    data: liveGameData
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`StarWinn Bridge Server running on port ${PORT}`);
});
