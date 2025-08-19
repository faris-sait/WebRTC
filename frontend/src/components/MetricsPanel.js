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
                <span className="metric-value