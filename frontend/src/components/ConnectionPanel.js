import React, { useState } from 'react';

const ConnectionPanel = ({ isConnected, qrCodeUrl, mode }) => {
  const [isQRExpanded, setIsQRExpanded] = useState(false);

  const getConnectionStatus = () => {
    if (isConnected) {
      return {
        text: 'Connected',
        icon: '🟢',
        className: 'connected'
      };
    } else {
      return {
        text: 'Disconnected',
        icon: '🔴',
        className: 'disconnected'
      };
    }
  };

  const getModeInfo = () => {
    switch (mode) {
      case 'wasm':
        return {
          name: 'WASM Mode',
          description: 'Inference runs in your browser',
          icon: '🌐',
          benefits: [
            'Lower server load',
            'Privacy-friendly',
            'Reduced latency'
          ]
        };
      case 'server':
        return {
          name: 'Server Mode',
          description: 'Inference runs on server',
          icon: '🖥️',
          benefits: [
            'Higher accuracy',
            'Better performance',
            'GPU acceleration'
          ]
        };
      default:
        return {
          name: 'Unknown Mode',
          description: 'Mode not detected',
          icon: '❓',
          benefits: []
        };
    }
  };

  const status = getConnectionStatus();
  const modeInfo = getModeInfo();

  return (
    <div className="connection-panel">
      <div className="panel-header">
        <h3>🔗 Connection & Mode</h3>
      </div>

      {/* Connection Status */}
      <div className="connection-status">
        <div className={`status-indicator ${status.className}`}>
          <span className="status-icon">{status.icon}</span>
          <span className="status-text">{status.text}</span>
        </div>
        
        {!isConnected && (
          <div className="connection-help">
            <p className="help-text">
              Waiting for connection to server...
            </p>
          </div>
        )}
      </div>

      {/* Mode Information */}
      <div className="mode-info">
        <div className="mode-header">
          <span className="mode-icon">{modeInfo.icon}</span>
          <div className="mode-details">
            <h4>{modeInfo.name}</h4>
            <p className="mode-description">{modeInfo.description}</p>
          </div>
        </div>

        {modeInfo.benefits.length > 0 && (
          <div className="mode-benefits">
            <h5>Benefits:</h5>
            <ul>
              {modeInfo.benefits.map((benefit, index) => (
                <li key={index}>• {benefit}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* QR Code Section */}
      {qrCodeUrl && (
        <div className="qr-section">
          <div 
            className="qr-header"
            onClick={() => setIsQRExpanded(!isQRExpanded)}
          >
            <h4>📱 Mobile Connection</h4>
            <span className="expand-icon">
              {isQRExpanded ? '▼' : '▶'}
            </span>
          </div>

          {isQRExpanded && (
            <div className="qr-content">
              <div className="qr-code-container">
                <img 
                  src={qrCodeUrl} 
                  alt="QR Code for mobile connection"
                  className="qr-code"
                />
              </div>
              <div className="qr-instructions">
                <p>Scan with your phone camera to:</p>
                <ul>
                  <li>• Stream video from mobile camera</li>
                  <li>• Test detection on different devices</li>
                  <li>• Access the app on mobile</li>
                </ul>
                <div className="qr-note">
                  <small>
                    📱 Make sure your phone and computer are on the same network
                  </small>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Connection Tips */}
      <div className="connection-tips">
        <h4>💡 Quick Tips</h4>
        <div className="tips-list">
          <div className="tip-item">
            <span className="tip-icon">📹</span>
            <span className="tip-text">Grant camera permissions when prompted</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🔒</span>
            <span className="tip-text">Use HTTPS for full WebRTC features</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">⚡</span>
            <span className="tip-text">Close other video apps for better performance</span>
          </div>
          <div className="tip-item">
            <span className="tip-icon">🌐</span>
            <span className="tip-text">Strong WiFi recommended for stable streaming</span>
          </div>
        </div>
      </div>

      {/* Troubleshooting */}
      <div className="troubleshooting">
        <details>
          <summary>🔧 Troubleshooting</summary>
          <div className="troubleshoot-content">
            <div className="issue">
              <strong>Camera not working?</strong>
              <ul>
                <li>• Check browser permissions</li>
                <li>• Try refreshing the page</li>
                <li>• Ensure camera isn't used by other apps</li>
              </ul>
            </div>
            
            <div className="issue">
              <strong>Poor performance?</strong>
              <ul>
                <li>• Switch between WASM/Server modes</li>
                <li>• Check network connection</li>
                <li>• Close unnecessary browser tabs</li>
              </ul>
            </div>

            <div className="issue">
              <strong>Connection failed?</strong>
              <ul>
                <li>• Verify server is running</li>
                <li>• Check firewall settings</li>
                <li>• Try a different browser</li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};

export default ConnectionPanel;