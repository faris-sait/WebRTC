import React, { forwardRef, useEffect, useState } from 'react';

const VideoStream = forwardRef((props, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDimensions({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [ref]);

  return (
    <div className="video-stream">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className="video-element"
        onCanPlay={() => ref.current?.play()}
      />

      <div className="video-info">
        <div className={`status-indicator ${isPlaying ? 'live' : 'stopped'}`}>
          {isPlaying ? '🔴 LIVE' : '⏸️ STOPPED'}
        </div>

        {dimensions.width > 0 && (
          <div className="video-dimensions">
            {dimensions.width}×{dimensions.height}
          </div>
        )}
      </div>
    </div>
  );
});

VideoStream.displayName = 'VideoStream';

export default VideoStream;