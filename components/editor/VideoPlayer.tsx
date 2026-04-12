'use client';

import { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Captions, CaptionsOff } from 'lucide-react';
import { formatDuration } from '@/lib/utils/video';
import { TranscriptionSegment } from '@/types';
import { SubtitleOverlay, SubtitleDisplayStyle, SubtitleFontSize } from './SubtitleOverlay';
import { cn } from '@/lib/utils';

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

const STYLE_LABELS: { key: SubtitleDisplayStyle; label: string }[] = [
  { key: 'capcut',  label: 'CapCut' },
  { key: 'filled',  label: 'Relleno' },
  { key: 'karaoke', label: 'Karaoke' },
  { key: 'minimal', label: 'Minimal' },
];

const POSITION_OPTS = [
  { key: 'top' as const,    icon: '⬆', label: 'Arriba' },
  { key: 'middle' as const, icon: '↕', label: 'Centro' },
  { key: 'bottom' as const, icon: '⬇', label: 'Abajo' },
];

const SIZE_OPTS: { key: SubtitleFontSize; label: string }[] = [
  { key: 'sm', label: 'S' },
  { key: 'md', label: 'M' },
  { key: 'lg', label: 'L' },
  { key: 'xl', label: 'XL' },
];

interface Props {
  url: string;
  title?: string;
  segments?: TranscriptionSegment[];
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { url, title, segments = [] },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [played, setPlayed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [subsOn, setSubsOn] = useState(true);
  const [subStyle, setSubStyle] = useState<SubtitleDisplayStyle>('capcut');
  const [subPosition, setSubPosition] = useState<'bottom' | 'top' | 'middle'>('bottom');
  const [subFontSize, setSubFontSize] = useState<SubtitleFontSize>('md');
  const [showStylePicker, setShowStylePicker] = useState(false);

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
    if (playing) { videoRef.current.pause(); } else { videoRef.current.play(); }
    setPlaying((p) => !p);
  };

  const toggleMute = () => {
    if (videoRef.current) videoRef.current.muted = !muted;
    setMuted((m) => !m);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = val * duration;
    setPlayed(val);
  };

  const hasSegments = segments.length > 0;

  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-medium text-zinc-300 truncate">{title}</p>}

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
            setVideoError(`Error ${v.error?.code ?? 0}: ${v.error?.message ?? 'desconocido'}`);
          }}
          playsInline
        />

        {/* Subtitle overlay */}
        {hasSegments && subsOn && (
          <SubtitleOverlay
            segments={segments}
            currentTime={currentTime}
            style={subStyle}
            position={subPosition}
            fontSize={subFontSize}
          />
        )}

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
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs text-zinc-500 w-10 text-right tabular-nums">
            {formatDuration(currentTime)}
          </span>
          <input
            type="range" min={0} max={1} step={0.001} value={played}
            onChange={handleSeek}
            className="flex-1 h-1.5 accent-amber-500 cursor-pointer"
          />
          <span className="text-xs text-zinc-500 w-10 tabular-nums">
            {formatDuration(duration)}
          </span>
        </div>

        <button
          onClick={toggleMute}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
        >
          {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Subtitle toggle + style picker */}
        {hasSegments && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowStylePicker((v) => !v); }}
              title="Estilo de subtítulos"
              className={cn(
                'p-1.5 rounded-lg transition-colors text-xs font-medium flex items-center gap-1',
                subsOn
                  ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                  : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
              )}
            >
              {subsOn ? <Captions className="w-4 h-4" /> : <CaptionsOff className="w-4 h-4" />}
            </button>

            {showStylePicker && (
              <div
                className="absolute bottom-9 right-0 bg-zinc-900 border border-zinc-700 rounded-xl p-3 flex flex-col gap-3 w-52 shadow-xl z-20"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Toggle on/off */}
                <button
                  onClick={() => { setSubsOn((v) => !v); setShowStylePicker(false); }}
                  className="text-left px-2 py-1 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  {subsOn ? 'Ocultar subtítulos' : 'Mostrar subtítulos'}
                </button>
                <div className="h-px bg-zinc-800" />

                {/* Style */}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Estilo</p>
                  <div className="grid grid-cols-2 gap-1">
                    {STYLE_LABELS.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => { setSubStyle(key); setSubsOn(true); }}
                        className={cn(
                          'px-2 py-1.5 rounded-lg text-xs transition-colors text-center',
                          subStyle === key && subsOn
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Position */}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Posición</p>
                  <div className="flex gap-1">
                    {POSITION_OPTS.map(({ key, icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setSubPosition(key)}
                        title={label}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-sm transition-colors',
                          subPosition === key
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent'
                        )}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size */}
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1.5">Tamaño</p>
                  <div className="flex gap-1">
                    {SIZE_OPTS.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setSubFontSize(key)}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors',
                          subFontSize === key
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent'
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
