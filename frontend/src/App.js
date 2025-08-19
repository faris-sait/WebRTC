import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import QRCode from 'qrcode';
import VideoStream from './components/VideoStream';
import DetectionOverlay from './components/DetectionOverlay';
import MetricsPanel from './components/MetricsPanel';
import ConnectionPanel from './components/ConnectionPanel';
import WASMInference from './utils/WASMInference';
import './App.css';

function App() {
  const [mode, setMode] = useState('wasm');
  const [isConnected, setIsConnected] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [detections, setDetections] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState(null);
  const [isInferenceReady, setIsInferenceReady] = useState(false);

  const socketRef = useRef(null);
  const wasmInferenceRef = useRef(null);
  const videoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const frameQueueRef = useRef([]);
  const processingRef = useRef(false);

  useEffect(() => {
    initializeApp();
    return () => {
      cleanup();
    };
  }, []);

  const initializeApp = async () => {
    try {
      // Get current mode from server
      const response = await fetch('/api/mode');
      const data = await response.json();
      setMode(data.mode);

      // Initialize socket connection
      initializeSocket();

      // Generate QR code for phone connection
      const currentUrl = window.location.href;
      const qrDataUrl = await QRCode.toDataURL(currentUrl);
      setQrCodeUrl(qrDataUrl);

      // Initialize WASM inference if in WASM mode
      if (data.mode === 'wasm') {
        await initializeWASMInference();
      }

    } catch (error) {
      console.error('Initialization error:', error);
      setError('Failed to initialize application');
    }
  };

  const initializeSocket = () => {
    socketRef.current = io();

    socketRef.current.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    socketRef.current.on('detection_result', (result) => {
      // Handle detection results from server mode
      if (mode === 'server') {
        setDetections(result.detections);
        updateMetricsFromResult(result);
      }
    });

    socketRef.current.on('metrics_data', (metricsData) => {
      setMetrics(metricsData);
    });

    socketRef.current.on('webrtc_answer', async (data) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(data.answer);
      }
    });

    socketRef.current.on('webrtc_error', (data) => {
      console.error('WebRTC error:', data.error);
      setError(`WebRTC error: ${data.error}`);
    });
  };

  const initializeWASMInference = async () => {
    try {
      wasmInferenceRef.current = new WASMInference();
      await wasmInferenceRef.current.initialize();
      setIsInferenceReady(true);
      console.log('WASM inference initialized');
    } catch (error) {
      console.error('WASM initialization error:', error);
      setError('Failed to initialize WASM inference');
    }
  };

  const startVideoStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Set up WebRTC for server mode or direct processing for WASM mode
      if (mode === 'server') {
        await setupWebRTC(stream);
      } else {
        setupWASMProcessing(stream);
      }

    } catch (error) {
      console.error('Error accessing camera:', error);
      setError('Failed to access camera. Please ensure camera permissions are granted.');
    }
  };

  const setupWebRTC = async (stream) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    peerConnectionRef.current = pc;

    // Add video track
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('webrtc_ice_candidate', {
          candidate: event.candidate
        });
      }
    };

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // Send offer to server
    socketRef.current.emit('webrtc_offer', { offer });
  };

  const setupWASMProcessing = (stream) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 320;
    canvas.height = 240;

    const processFrame = async () => {
      if (!wasmInferenceRef.current || processingRef.current) return;

      try {
        processingRef.current = true;

        // Capture frame from video
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const imageData = ctx.getImageData(0, 0, 320, 240);

        // Run inference
        const result = await wasmInferenceRef.current.detectObjects(imageData);

        setDetections(result.detections);
        updateMetricsFromResult(result);

      } catch (error) {
        console.error('Frame processing error:', error);
      } finally {
        processingRef.current = false;
      }
    };

    // Process frames at target FPS
    const targetFPS = 15;
    setInterval(processFrame, 1000 / targetFPS);
  };

  const updateMetricsFromResult = (result) => {
    // Update local metrics tracking
    const now = Date.now();
    const e2eLatency = now - result.capture_ts;

    // Simple metrics aggregation (for display purposes)
    setMetrics(prev => ({
      ...prev,
      recent_latency: e2eLatency,
      last_update: now
    }));
  };

  const cleanup = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const handleStartStream = () => {
    startVideoStream();
  };

  const handleGetMetrics = () => {
    if (socketRef.current) {
      socketRef.current.emit('get_metrics');
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>📱 WebRTC Multi-Object Detection</h1>
        <div className="mode-indicator">
          Mode: <span className={`mode ${mode}`}>{mode.toUpperCase()}</span>
          {mode === 'wasm' && (
            <span className={`status ${isInferenceReady ? 'ready' : 'loading'}`}>
              {isInferenceReady ? '✅ Ready' : '⏳ Loading...'}
            </span>
          )}
        </div>
      </header>

      <main className="app-main">
        {error && (
          <div className="error-banner">
            ⚠️ {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <div className="content-grid">
          <div className="video-section">
            <div className="video-container">
              <VideoStream ref={videoRef} />
              <DetectionOverlay detections={detections} />
            </div>

            <div className="controls">
              <button
                onClick={handleStartStream}
                className="start-button"
                disabled={mode === 'wasm' && !isInferenceReady}
              >
                📹 Start Camera
              </button>
              <button onClick={handleGetMetrics} className="metrics-button">
                📊 Get Metrics
              </button>
            </div>
          </div>

          <div className="info-section">
            <ConnectionPanel
              isConnected={isConnected}
              qrCodeUrl={qrCodeUrl}
              mode={mode}
            />

            <MetricsPanel metrics={metrics} />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>
          📱 Scan QR code with your phone to stream video |
          🖥️ Use laptop camera for direct testing
        </p>
      </footer>
    </div>
  );
}

export default App;