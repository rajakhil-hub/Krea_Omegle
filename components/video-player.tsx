"use client";

import { useEffect, useRef, useState } from "react";

interface VideoPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  label: string;
}

export function VideoPlayer({ stream, muted = false, label }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsInteraction, setNeedsInteraction] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    video.srcObject = stream;

    // Browsers block autoplay with audio — try to play, show tap prompt if blocked
    video.play().catch(() => {
      if (!muted) {
        setNeedsInteraction(true);
      }
    });
  }, [stream, muted]);

  const handleUnmute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.play().catch(() => {});
    }
    setNeedsInteraction(false);
  };

  return (
    <div className="relative rounded-xl overflow-hidden bg-[var(--card)] border border-[var(--card-border)] aspect-video">
      {stream ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted || needsInteraction}
            className="w-full h-full object-cover"
          />
          {needsInteraction && (
            <button
              onClick={handleUnmute}
              className="absolute inset-0 flex items-center justify-center bg-black/40 z-10"
            >
              <span className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white">
                Tap to unmute
              </span>
            </button>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center w-full h-full text-[var(--muted)]">
          <div className="text-center">
            <div className="text-4xl mb-2">📷</div>
            <p className="text-sm">Waiting for video...</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/60 text-xs text-white">
        {label}
      </div>
    </div>
  );
}
