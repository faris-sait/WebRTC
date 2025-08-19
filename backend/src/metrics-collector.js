const fs = require('fs');
const path = require('path');

class MetricsCollector {
    constructor() {
        this.frameMetrics = [];
        this.startTime = Date.now();
        this.totalFrames = 0;
        this.droppedFrames = 0;
        this.bandwidthData = {
            uplink: [],
            downlink: []
        };
    }

    recordFrame(frameData) {
        this.frameMetrics.push({
            frameId: frameData.frameId,
            capture_ts: frameData.capture_ts,
            recv_ts: frameData.recv_ts,
            inference_ts: frameData.inference_ts,
            e2e_latency: frameData.e2e_latency,
            server_latency: frameData.server_latency,
            network_latency: frameData.network_latency,
            timestamp: Date.now()
        });

        this.totalFrames++;

        // Keep only last 1000 frames to prevent memory issues
        if (this.frameMetrics.length > 1000) {
            this.frameMetrics.shift();
        }
    }

    recordDroppedFrame() {
        this.droppedFrames++;
    }

    recordBandwidth(uplink, downlink) {
        const timestamp = Date.now();
        this.bandwidthData.uplink.push({ timestamp, value: uplink });
        this.bandwidthData.downlink.push({ timestamp, value: downlink });

        // Keep only last 100 measurements
        if (this.bandwidthData.uplink.length > 100) {
            this.bandwidthData.uplink.shift();
            this.bandwidthData.downlink.shift();
        }
    }

    getMetrics() {
        const now = Date.now();
        const runDuration = (now - this.startTime) / 1000; // seconds

        if (this.frameMetrics.length === 0) {
            return {
                summary: {
                    run_duration_s: runDuration,
                    total_frames: this.totalFrames,
                    processed_frames: 0,
                    dropped_frames: this.droppedFrames,
                    processed_fps: 0,
                    drop_rate: 0
                },
                latency: {
                    e2e: { median: 0, p95: 0 },
                    server: { median: 0, p95: 0 },
                    network: { median: 0, p95: 0 }
                },
                bandwidth: {
                    uplink_kbps: { median: 0, p95: 0 },
                    downlink_kbps: { median: 0, p95: 0 }
                }
            };
        }

        // Calculate latency percentiles
        const e2eLatencies = this.frameMetrics.map(f => f.e2e_latency).sort((a, b) => a - b);
        const serverLatencies = this.frameMetrics.map(f => f.server_latency).sort((a, b) => a - b);
        const networkLatencies = this.frameMetrics.map(f => f.network_latency).sort((a, b) => a - b);

        const getPercentile = (arr, percentile) => {
            const index = Math.floor((percentile / 100) * arr.length);
            return arr[Math.min(index, arr.length - 1)] || 0;
        };

        // Calculate bandwidth percentiles
        const uplinkSpeeds = this.bandwidthData.uplink.map(b => b.value).sort((a, b) => a - b);
        const downlinkSpeeds = this.bandwidthData.downlink.map(b => b.value).sort((a, b) => a - b);

        const processedFPS = this.frameMetrics.length / runDuration;
        const dropRate = this.droppedFrames / (this.totalFrames || 1);

        return {
            summary: {
                run_duration_s: Math.round(runDuration * 100) / 100,
                total_frames: this.totalFrames,
                processed_frames: this.frameMetrics.length,
                dropped_frames: this.droppedFrames,
                processed_fps: Math.round(processedFPS * 100) / 100,
                drop_rate: Math.round(dropRate * 10000) / 100 // percentage
            },
            latency: {
                e2e: {
                    median: Math.round(getPercentile(e2eLatencies, 50)),
                    p95: Math.round(getPercentile(e2eLatencies, 95))
                },
                server: {
                    median: Math.round(getPercentile(serverLatencies, 50)),
                    p95: Math.round(getPercentile(serverLatencies, 95))
                },
                network: {
                    median: Math.round(getPercentile(networkLatencies, 50)),
                    p95: Math.round(getPercentile(networkLatencies, 95))
                }
            },
            bandwidth: {
                uplink_kbps: {
                    median: Math.round(getPercentile(uplinkSpeeds, 50)),
                    p95: Math.round(getPercentile(uplinkSpeeds, 95))
                },
                downlink_kbps: {
                    median: Math.round(getPercentile(downlinkSpeeds, 50)),
                    p95: Math.round(getPercentile(downlinkSpeeds, 95))
                }
            },
            timestamp: now
        };
    }

    exportMetrics(filename = 'metrics.json') {
        const metrics = this.getMetrics();
        const outputPath = path.join(__dirname, '../../', filename);

        try {
            fs.writeFileSync(outputPath, JSON.stringify(metrics, null, 2));
            console.log(`📊 Metrics exported to ${outputPath}`);
            return outputPath;
        } catch (error) {
            console.error('Error exporting metrics:', error);
            throw error;
        }
    }

    reset() {
        this.frameMetrics = [];
        this.startTime = Date.now();
        this.totalFrames = 0;
        this.droppedFrames = 0;
        this.bandwidthData = {
            uplink: [],
            downlink: []
        };
    }

    // Real-time metrics for monitoring
    getCurrentStats() {
        const recentFrames = this.frameMetrics.slice(-30); // Last 30 frames
        if (recentFrames.length === 0) return null;

        const avgLatency = recentFrames.reduce((sum, f) => sum + f.e2e_latency, 0) / recentFrames.length;
        const recentFPS = recentFrames.length / ((Date.now() - recentFrames[0].timestamp) / 1000);

        return {
            recent_fps: Math.round(recentFPS * 100) / 100,
            avg_latency_ms: Math.round(avgLatency),
            total_processed: this.frameMetrics.length,
            total_dropped: this.droppedFrames
        };
    }
}

module.exports = MetricsCollector;