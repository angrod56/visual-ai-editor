'use client';

import { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { formatDuration } from '@/lib/utils/video';

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface Props {
  url: string;
  title?: string;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { url, title },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      if (videoRef.current) {
        videoRef.current.currentTime = seconds;
        videoRef.current.play();
        setPlaying(true);
      }
    },
  }));

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying((p) => !p);
  };

  const toggleMute = () => {
    if (videoRef.current) videoRef.current.muted = !muted;
    setMuted((m) => !m);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = val * duration;
    }
    setPlayed(val);
  };

  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-medium text-slate-300 truncate">{title}</p>}

      <div
        className="relative bg-black rounded-xl overflow-hidden aspect-video cursor-pointer"
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={url}
          className="w-full h-full"
          onTimeUpdate={() => {
            if (!videoRef.current) return;
            setCurrentTime(videoRef.current.currentTime);
            setPlayed(
              videoRef.current.duration
                ? videoRef.current.currentTime / videoRef.current.duration
                : 0
            );
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
          }}
          onEnded={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onError={(e) => {
            const v = e.currentTarget;
            const code = v.error?.code ?? 0;
            const msg = v.error?.message ?? 'desconocido';
            setVideoError(`Error ${code}: ${msg} — src: ${v.currentSrc}`);
          }}
          playsInline
        />
        {videoError && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
            <p className="text-red-400 text-xs text-center break-all">{videoError}</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-slate-500 w-10 text-right tabular-nums">
            {formatDuration(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={played}
            onChange={handleSeek}
            className="flex-1 h-1.5 accent-purple-500 cursor-pointer"
          />
          <span className="text-xs text-slate-500 w-10 tabular-nums">
            {formatDuration(duration)}
          </span>
        </div>

        <button
          onClick={toggleMute}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
});
