const express = require('express');
const { createServer } = require("http");
const { Server } = require("socket.io");
const port = 3000;
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer)

io.on('connection', (socket) => {
  console.log('New client connected'); 

  socket.on('message', (data) =>{
    console.log('Message received from ESP32:', data);
    io.emit('flutter', data);
  });
});

io.on('message', (data) => {
  console.log('Message received from ESP32:', data);
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from the server!' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Hi' });
  io.emit('server_message', 'Hello from the server!');

});

app.post('/api/data', (req, res) => {
  const receivedData = req.body; 
  console.log('Received data:', receivedData);
  res.status(200).json({ message: 'Data received successfully!' });
});

httpServer.listen(port, () => {
  console.log(`Server listening on ws://localhost:${port}`);
});