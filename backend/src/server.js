const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const WebRTCGateway = require('./webrtc-gateway');
const InferenceEngine = require('./inference-engine');
const MetricsCollector = require('./metrics-collector');

class DetectionServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });

        this.mode = process.env.MODE || 'wasm';
        this.port = process.env.PORT || 3001;

        // Initialize components
        this.webrtcGateway = new WebRTCGateway();
        this.inferenceEngine = new InferenceEngine(this.mode);
        this.metricsCollector = new MetricsCollector();

        // Connected clients
        this.clients = new Map();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebRTC();
        this.setupSocketHandlers();
    }

    setupMiddleware() {
        this.app.use(compression());
        this.app.use(cors());
        this.app.use(express.json({ limit: '50mb' }));
        this.app.use(express.static(path.join(__dirname, '../../frontend/build')));
        this.app.use('/models', express.static(path.join(__dirname, '../../models')));
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

        // Get current mode
        this.app.get('/api/mode', (req, res) => {
            res.json({ mode: this.mode });
        });

        // WebRTC signaling endpoint
        this.app.post('/api/webrtc/offer', async (req, res) => {
            try {
                const { offer, clientId } = req.body;
                const answer = await this.webrtcGateway.handleOffer(offer, clientId);
                res.json({ answer });
            } catch (error) {
                console.error('WebRTC offer error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // ICE candidate endpoint
        this.app.post('/api/webrtc/ice-candidate', async (req, res) => {
            try {
                const { candidate, clientId } = req.body;
                await this.webrtcGateway.addIceCandidate(candidate, clientId);
                res.json({ success: true });
            } catch (error) {
                console.error('ICE candidate error:', error);
                res.status(500).json({ error: error.message });
            }
        });

        // Metrics endpoint
        this.app.get('/api/metrics', (req, res) => {
            const metrics = this.metricsCollector.getMetrics();
            res.json(metrics);
        });

        // Serve React app for all other routes
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../../frontend/build/index.html'));
        });
    }

    setupWebRTC() {
        // Handle incoming video frames from WebRTC
        this.webrtcGateway.on('frame', async (frameData, clientId) => {
            try {
                const startTime = Date.now();
                const frameId = uuidv4();

                // Record frame receive time
                const recv_ts = Date.now();

                // Only process if we're in server mode
                if (this.mode === 'server') {
                    // Run inference
                    const inferenceStart = Date.now();
                    const detections = await this.inferenceEngine.detectObjects(frameData);
                    const inference_ts = Date.now();

                    // Prepare detection result
                    const result = {
                        frame_id: frameId,
                        capture_ts: frameData.capture_ts || recv_ts,
                        recv_ts,
                        inference_ts,
                        detections
                    };

                    // Send result back to client
                    const client = this.clients.get(clientId);
                    if (client) {
                        client.emit('detection_result', result);
                    }

                    // Collect metrics
                    this.metricsCollector.recordFrame({
                        frameId,
                        capture_ts: result.capture_ts,
                        recv_ts,
                        inference_ts,
                        e2e_latency: Date.now() - result.capture_ts,
                        server_latency: inference_ts - recv_ts,
                        network_latency: recv_ts - result.capture_ts
                    });
                }
            } catch (error) {
                console.error('Frame processing error:', error);
            }
        });
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('Client connected:', socket.id);
            this.clients.set(socket.id, socket);

            socket.on('disconnect', () => {
                console.log('Client disconnected:', socket.id);
                this.clients.delete(socket.id);
                this.webrtcGateway.removeClient(socket.id);
            });

            // Handle WebRTC signaling through socket.io as fallback
            socket.on('webrtc_offer', async (data) => {
                try {
                    const answer = await this.webrtcGateway.handleOffer(data.offer, socket.id);
                    socket.emit('webrtc_answer', { answer });
                } catch (error) {
                    socket.emit('webrtc_error', { error: error.message });
                }
            });

            socket.on('webrtc_ice_candidate', async (data) => {
                try {
                    await this.webrtcGateway.addIceCandidate(data.candidate, socket.id);
                } catch (error) {
                    console.error('ICE candidate error:', error);
                }
            });

            // Handle metrics requests
            socket.on('get_metrics', () => {
                const metrics = this.metricsCollector.getMetrics();
                socket.emit('metrics_data', metrics);
            });
        });
    }

    async start() {
        try {
            // Initialize inference engine
            await this.inferenceEngine.initialize();

            this.server.listen(this.port, () => {
                console.log(`🚀 Detection server running on port ${this.port}`);
                console.log(`📱 Mode: ${this.mode}`);
                console.log(`🔗 Open http://localhost:${this.port} to start`);

                if (this.mode === 'wasm') {
                    console.log('📦 WASM mode: inference will run in browser');
                } else {
                    console.log('🖥️  Server mode: inference running on server');
                }
            });
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    }
}

// Start server
const server = new DetectionServer();
server.start().catch(console.error);

module.exports = DetectionServer;