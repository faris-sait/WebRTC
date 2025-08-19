const wrtc = require('wrtc');
const { EventEmitter } = require('events');

class WebRTCGateway extends EventEmitter {
    constructor() {
        super();
        this.peerConnections = new Map();
        this.iceCandidateQueue = new Map();
    }

    async handleOffer(offer, clientId) {
        try {
            const pc = new wrtc.RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });

            this.peerConnections.set(clientId, pc);

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    this.emit('ice_candidate', {
                        candidate: event.candidate,
                        clientId
                    });
                }
            };

            // Handle incoming video tracks
            pc.ontrack = (event) => {
                console.log('Received track:', event.track.kind);
                if (event.track.kind === 'video') {
                    this.setupVideoTrackProcessor(event.track, clientId);
                }
            };

            // Set remote description
            await pc.setRemoteDescription(new wrtc.RTCSessionDescription(offer));

            // Create answer
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            // Process any queued ICE candidates
            const queuedCandidates = this.iceCandidateQueue.get(clientId) || [];
            for (const candidate of queuedCandidates) {
                await pc.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
            }
            this.iceCandidateQueue.delete(clientId);

            return answer;
        } catch (error) {
            console.error('Error handling offer:', error);
            throw error;
        }
    }

    async addIceCandidate(candidate, clientId) {
        const pc = this.peerConnections.get(clientId);

        if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
        } else {
            // Queue candidate for later
            if (!this.iceCandidateQueue.has(clientId)) {
                this.iceCandidateQueue.set(clientId, []);
            }
            this.iceCandidateQueue.get(clientId).push(candidate);
        }
    }

    setupVideoTrackProcessor(track, clientId) {
        // Create a video frame processor
        const frameProcessor = new VideoFrameProcessor(track, clientId);

        frameProcessor.on('frame', (frameData) => {
            this.emit('frame', frameData, clientId);
        });

        frameProcessor.start();
    }

    removeClient(clientId) {
        const pc = this.peerConnections.get(clientId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(clientId);
        }
        this.iceCandidateQueue.delete(clientId);
    }
}

class VideoFrameProcessor extends EventEmitter {
    constructor(track, clientId) {
        super();
        this.track = track;
        this.clientId = clientId;
        this.frameCount = 0;
        this.targetFPS = 15; // Process at 15 FPS max
        this.frameInterval = 1000 / this.targetFPS;
        this.lastFrameTime = 0;
    }

    start() {
        // For server-side processing, we need to use MediaStreamTrackProcessor
        // This is a simplified version - in reality you'd need a more sophisticated
        // frame extraction mechanism

        const mediaStream = new wrtc.MediaStream([this.track]);
        this.processFrames(mediaStream);
    }

    async processFrames(mediaStream) {
        // This is a placeholder for frame processing
        // In a real implementation, you'd use libraries like node-ffmpeg
        // or extract frames from the MediaStream

        const processFrame = () => {
            const now = Date.now();

            if (now - this.lastFrameTime >= this.frameInterval) {
                this.lastFrameTime = now;
                this.frameCount++;

                // Simulate frame extraction
                const frameData = {
                    width: 320,
                    height: 240,
                    data: Buffer.alloc(320 * 240 * 3), // RGB data placeholder
                    capture_ts: now,
                    frame_id: this.frameCount
                };

                this.emit('frame', frameData);
            }

            // Continue processing if track is live
            if (this.track.readyState === 'live') {
                setTimeout(processFrame, 1000 / 60); // Check at 60 FPS
            }
        };

        processFrame();
    }
}

module.exports = WebRTCGateway;