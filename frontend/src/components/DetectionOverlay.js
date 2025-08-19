import React, { useRef, useEffect } from 'react';

const DetectionOverlay = ({ detections = [] }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw detection boxes
    detections.forEach((detection, index) => {
      drawDetection(ctx, detection, width, height, index);
    });
  }, [detections]);

  const drawDetection = (ctx, detection, canvasWidth, canvasHeight, index) => {
    const { label, score, xmin, ymin, xmax, ymax } = detection;

    // Convert normalized coordinates to canvas coordinates
    const x = xmin * canvasWidth;
    const y = ymin * canvasHeight;
    const w = (xmax - xmin) * canvasWidth;
    const h = (ymax - ymin) * canvasHeight;

    // Choose color based on detection index
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#F4A460', '#98D8C8'
    ];
    const color = colors[index % colors.length];

    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);

    // Draw label background
    const labelText = `${label} ${(score * 100).toFixed(0)}%`;
    ctx.font = '14px Arial';
    const textMetrics = ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    const textHeight = 18;

    // Background for label
    ctx.fillStyle = color;
    ctx.fillRect(x, y - textHeight - 4, textWidth + 8, textHeight + 4);

    // Label text
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(labelText, x + 4, y - 6);

    // Draw confidence indicator
    const confidenceBarWidth = 60;
    const confidenceBarHeight = 4;
    const confidenceX = x;
    const confidenceY = y + h + 8;

    // Background bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(confidenceX, confidenceY, confidenceBarWidth, confidenceBarHeight);

    // Confidence level
    ctx.fillStyle = color;
    ctx.fillRect(confidenceX, confidenceY, confidenceBarWidth * score, confidenceBarHeight);
  };

  const handleCanvasResize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
  };

  useEffect(() => {
    handleCanvasResize();
    window.addEventListener('resize', handleCanvasResize);
    return () => window.removeEventListener('resize', handleCanvasResize);
  }, []);

  return (
    <div className="detection-overlay">
      <canvas
        ref={canvasRef}
        className="overlay-canvas"
      />

      {detections.length > 0 && (
        <div className="detection-count">
          {detections.length} object{detections.length !== 1 ? 's' : ''} detected
        </div>
      )}
    </div>
  );
};

export default DetectionOverlay;