const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// स्टेटिक फाइलें सर्व करने के लिए
app.use(express.static(__dirname));

// होमपेज रूट
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`StarWinn Server running on port ${PORT}`);
});
