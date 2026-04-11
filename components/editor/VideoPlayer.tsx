'use client';

import { useRef, useState, useImperativeHandle, forwardRef } from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ReactPlayer = require('react-player').default;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useImperativeHandle(ref, () => ({
    seekTo(seconds: number) {
      playerRef.current?.seekTo(seconds, 'seconds');
      setPlaying(true);
    },
  }));

  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-medium text-slate-300 truncate">{title}</p>}

      <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
        <ReactPlayer
          ref={playerRef}
          url={url}
          playing={playing}
          muted={muted}
          width="100%"
          height="100%"
          onProgress={({ played, playedSeconds }: { played: number; playedSeconds: number }) => {
            setPlayed(played);
            setCurrentTime(playedSeconds);
          }}
          onDuration={setDuration}
          onEnded={() => setPlaying(false)}
          config={{ file: { attributes: { controlsList: 'nodownload' } } }}
        />
        {/* Click overlay to toggle play */}
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={() => setPlaying((p) => !p)}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPlaying((p) => !p)}
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
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setPlayed(val);
              playerRef.current?.seekTo(val);
            }}
            className="flex-1 h-1.5 accent-purple-500 cursor-pointer"
          />
          <span className="text-xs text-slate-500 w-10 tabular-nums">
            {formatDuration(duration)}
          </span>
        </div>

        <button
          onClick={() => setMuted((m) => !m)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
});
