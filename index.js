const express = require('express');
const app = express();
const port = 3000;

app.use(express.json()); 

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from the server!' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Hi' });
});

app.post('/api/data', (req, res) => {
  const receivedData = req.body; 
  console.log('Received data:', receivedData);
  res.status(200).json({ message: 'Data received successfully!' });
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
