import React, { useState, useEffect } from 'react';

const MetricsPanel = ({ metrics }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [realtimeStats, setRealtimeStats] = useState(null);

  useEffect(() => {
    // Update realtime stats from metrics
    if (metrics) {
      setRealtimeStats({
        fps: metrics.summary?.processed_fps || 0,
        latency: metrics.latency?.e2e?.median || 0,
        processed: metrics.summary?.processed_frames || 0,
        dropped: metrics.summary?.dropped_frames || 0
      });
    }
  }, [metrics]);

  const formatLatency = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatBandwidth = (kbps) => {
    if (kbps < 1000) return `${kbps} kbps`;
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  };

  const getLatencyColor = (latency) => {
    if (latency < 100) return '#4ECDC4'; // Good
    if (latency < 300) return '#FFEAA7'; // OK
    return '#FF6B6B'; // Poor
  };

  const getFPSColor = (fps) => {
    if (fps >= 15) return '#4ECDC4'; // Good
    if (fps >= 10) return '#FFEAA7'; // OK
    return '#FF6B6B'; // Poor
  };

  return (
    <div className="metrics-panel">
      <div
        className="metrics-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3>📊 Performance Metrics</h3>
        <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {/* Realtime stats (always visible) */}
      <div className="realtime-stats">
        {realtimeStats && (
          <>
            <div className="stat-item">
              <span className="stat-label">FPS:</span>
              <span
                className="stat-value"
                style={{ color: getFPSColor(realtimeStats.fps) }}
              >
                {realtimeStats.fps.toFixed(1)}
              </span>
            </div>

            <div className="stat-item">
              <span className="stat-label">Latency:</span>
              <span
                className="stat-value"
                style={{ color: getLatencyColor(realtimeStats.latency) }}
              >
                {formatLatency(realtimeStats.latency)}
              </span>
            </div>

            <div className="stat-item">
              <span className="stat-label">Processed:</span>
              <span className="stat-value">{realtimeStats.processed}</span>
            </div>

            {realtimeStats.dropped > 0 && (
              <div className="stat-item">
                <span className="stat-label">Dropped:</span>
                <span className="stat-value dropped">{realtimeStats.dropped}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detailed metrics (expandable) */}
      {isExpanded && metrics && (
        <div className="detailed-metrics">
          <div className="metrics-section">
            <h4>Summary</h4>
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-label">Duration:</span>
                <span className="metric-value">
                  {metrics.summary?.run_duration_s || 0}s
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Total Frames:</span>
                <span className="metric-value">
                  {metrics.summary?.total_frames || 0}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Drop Rate:</span>
                <span className="metric-value">
                  {metrics.summary?.drop_rate || 0}%
                </span>
              </div>
            </div>
          </div>

          <div className="metrics-section">
            <h4>Latency Analysis</h4>
            <div className="latency-grid">
              <div className="latency-metric">
                <span className="metric-label">End-to-End:</span>
                <div className="latency-values">
                  <span className="median">
                    Med: {formatLatency(metrics.latency?.e2e?.median || 0)}
                  </span>
                  <span className="p95">
                    95%: {formatLatency(metrics.latency?.e2e?.p95 || 0)}
                  </span>
                </div>
              </div>
              
              <div className="latency-metric">
                <span className="metric-label">Server Processing:</span>
                <div className="latency-values">
                  <span className="median">
                    Med: {formatLatency(metrics.latency?.server?.median || 0)}
                  </span>
                  <span className="p95">
                    95%: {formatLatency(metrics.latency?.server?.p95 || 0)}
                  </span>
                </div>
              </div>

              <div className="latency-metric">
                <span className="metric-label">Network:</span>
                <div className="latency-values">
                  <span className="median">
                    Med: {formatLatency(metrics.latency?.network?.median || 0)}
                  </span>
                  <span className="p95">
                    95%: {formatLatency(metrics.latency?.network?.p95 || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {metrics.bandwidth && (
            <div className="metrics-section">
              <h4>Bandwidth Usage</h4>
              <div className="bandwidth-grid">
                <div className="bandwidth-metric">
                  <span className="metric-label">Uplink:</span>
                  <div className="bandwidth-values">
                    <span className="median">
                      Med: {formatBandwidth(metrics.bandwidth?.uplink_kbps?.median || 0)}
                    </span>
                    <span className="p95">
                      95%: {formatBandwidth(metrics.bandwidth?.uplink_kbps?.p95 || 0)}
                    </span>
                  </div>
                </div>
                
                <div className="bandwidth-metric">
                  <span className="metric-label">Downlink:</span>
                  <div className="bandwidth-values">
                    <span className="median">
                      Med: {formatBandwidth(metrics.bandwidth?.downlink_kbps?.median || 0)}
                    </span>
                    <span className="p95">
                      95%: {formatBandwidth(metrics.bandwidth?.downlink_kbps?.p95 || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="metrics-section">
            <h4>Performance Score</h4>
            <div className="performance-score">
              {(() => {
                const latency = metrics.latency?.e2e?.median || 0;
                const fps = metrics.summary?.processed_fps || 0;
                const dropRate = metrics.summary?.drop_rate || 0;
                
                let score = 100;
                if (latency > 300) score -= 30;
                else if (latency > 100) score -= 15;
                
                if (fps < 10) score -= 25;
                else if (fps < 15) score -= 10;
                
                if (dropRate > 10) score -= 20;
                else if (dropRate > 5) score -= 10;
                
                score = Math.max(0, score);
                
                let grade = 'A';
                let color = '#4ECDC4';
                if (score < 70) { grade = 'C'; color = '#FFEAA7'; }
                if (score < 50) { grade = 'D'; color = '#FF6B6B'; }
                if (score >= 85) grade = 'A+';
                else if (score >= 80) grade = 'A';
                else if (score >= 70) grade = 'B';
                
                return (
                  <div className="score-display">
                    <div 
                      className="score-circle"
                      style={{ borderColor: color, color }}
                    >
                      <span className="score-number">{score}</span>
                      <span className="score-grade">{grade}</span>
                    </div>
                    <div className="score-breakdown">
                      <div className="score-item">
                        <span>Latency:</span>
                        <span style={{ color: getLatencyColor(latency) }}>
                          {latency < 100 ? '✓' : latency < 300 ? '~' : '✗'}
                        </span>
                      </div>
                      <div className="score-item">
                        <span>FPS:</span>
                        <span style={{ color: getFPSColor(fps) }}>
                          {fps >= 15 ? '✓' : fps >= 10 ? '~' : '✗'}
                        </span>
                      </div>
                      <div className="score-item">
                        <span>Stability:</span>
                        <span style={{ color: dropRate < 5 ? '#4ECDC4' : dropRate < 10 ? '#FFEAA7' : '#FF6B6B' }}>
                          {dropRate < 5 ? '✓' : dropRate < 10 ? '~' : '✗'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {!metrics && (
        <div className="no-metrics">
          <p>📈 Click "Get Metrics" to see performance data</p>
        </div>
      )}
    </div>
  );
};

export default MetricsPanel;