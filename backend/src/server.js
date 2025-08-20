const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Removed WebRTCGateway & wrtc-based inference
// const WebRTCGateway = require('./webrtc-gateway');
// const InferenceEngine = require('./inference-engine');
// const MetricsCollector = require('./metrics-collector');

class DetectionServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.mode = process.env.MODE || 'wasm';
        this.port = process.env.PORT || 3001;

        // Connected clients
        this.clients = new Map();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    setupMiddleware() {
        this.app.use(compression());
        this.app.use(cors());
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.static(path.join(__dirname, '../../frontend/build')));
    }

    setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'ok',
                mode: this.mode,
                timestamp: Date.now(),
                clients: this.clients.size
            });
        });

        // Serve React app
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);
            this.clients.set(socket.id, socket);

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
                this.clients.delete(socket.id);
            });

            // WebRTC signaling (just relays between peers)
            socket.on('signal', (data) => {
                console.log("Signal message:", data);
                if (data.to) {
                    this.io.to(data.to).emit('signal', {
                        from: socket.id,
                        ...data
                    });
                }
            });

            socket.on('join', (room) => {
                socket.join(room);
                socket.to(room).emit('new-peer', socket.id);
            });
        });
    }

    async start() {
        this.server.listen(this.port, () => {
            console.log(`🚀 Signaling server running on port ${this.port}`);
            console.log(`📱 Mode: ${this.mode}`);
        });
    }
}

// Start server
const server = new DetectionServer();
server.start().catch(console.error);

module.exports = DetectionServer;
