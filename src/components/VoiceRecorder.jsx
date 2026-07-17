import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Mic, Square, RotateCcw, Sparkles, AlertTriangle, Loader, Trash2 } from 'lucide-react';
import { transcribeAudio } from '../services/whisper';
import './VoiceRecorder.css';

/** Returns true if the browser supports MediaRecorder + getUserMedia. */
const isBrowserSupported = () =>
  typeof window !== 'undefined' &&
  typeof navigator?.mediaDevices?.getUserMedia === 'function' &&
  typeof window.MediaRecorder !== 'undefined';

/**
 * Format seconds as mm:ss.
 * @param {number} totalSeconds
 * @returns {string}
 */
const formatDuration = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * VoiceRecorder — records audio via MediaRecorder and optionally transcribes
 * it using Groq Whisper.
 *
 * @param {{ onTranscription: (text: string) => void, onAudioCaptured?: (blob: Blob | null) => void, disabled?: boolean }} props
 */
const VoiceRecorder = forwardRef(function VoiceRecorder({ onTranscription, onAudioCaptured, onRecordingStateChange, disabled = false }, ref) {
  const [isRecording,   setIsRecording]   = useState(false);
  const [audioBlob,     setAudioBlob]     = useState(null);
  const [audioUrl,      setAudioUrl]      = useState(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error,         setError]         = useState('');
  const [duration,      setDuration]      = useState(0);
  const [online,        setOnline]        = useState(navigator?.onLine ?? true);

  useEffect(() => {
    onRecordingStateChange?.(isRecording);
  }, [isRecording, onRecordingStateChange]);

  useEffect(() => {
    const setTrue  = () => setOnline(true);
    const setFalse = () => setOnline(false);
    window.addEventListener('online',  setTrue);
    window.addEventListener('offline', setFalse);
    return () => {
      window.removeEventListener('online',  setTrue);
      window.removeEventListener('offline', setFalse);
    };
  }, []);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const timerIntervalRef = useRef(null);
  const streamRef        = useRef(null);
  const audioUrlRef      = useRef(null);

  // Keep audioUrlRef in sync so the cleanup effect below always sees the latest URL
  useEffect(() => { audioUrlRef.current = audioUrl; }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerIntervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);

  /** Start recording from the user's microphone. */
  const startRecording = useCallback(async () => {
    setError('');
    setTranscription('');
    setAudioBlob(null);

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current   = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setIsRecording(false);
        onAudioCaptured?.(blob);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      };

      recorder.onerror = () => {
        setError('Recording failed. Please try again.');
        setIsRecording(false);
        clearInterval(timerIntervalRef.current);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      setIsRecording(true);
      setDuration(0);
      timerIntervalRef.current = setInterval(() => {
        setDuration((d) => {
          if (d >= 300) {
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
            return d;
          }
          return d + 1;
        });
      }, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Allow microphone permissions in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError(`Could not start recording: ${err.message}`);
      }
    }
  }, [audioUrl, onAudioCaptured]);

  /** Stop the current recording. */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  /** Reset state so the user can record again. */
  const recordAgain = useCallback(() => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscription('');
    setError('');
    setDuration(0);
    setIsTranscribing(false);
    onAudioCaptured?.(null);
  }, [audioUrl, onAudioCaptured]);

  /** Transcribe the recorded audio using Groq Whisper. */
  const handleTranscribe = useCallback(async () => {
    if (!audioBlob) return;
    setIsTranscribing(true);
    setError('');
    try {
      const text = await transcribeAudio(audioBlob);
      setTranscription(text);
      onTranscription?.(text);
    } catch (err) {
      setError(err.message || 'Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  }, [audioBlob, onTranscription]);

  useImperativeHandle(ref, () => ({
    startRecording,
    stopRecording
  }), [startRecording, stopRecording]);

  // Unsupported browser fallback
  if (!isBrowserSupported()) {
    return (
      <div className="voice-recorder" id="voice-recorder">
        <div className="voice-recorder-unsupported">
          <AlertTriangle size={32} className="voice-recorder-unsupported-icon" />
          <p>
            Voice recording is not supported in this browser.
            <br />
            Please use a modern browser like Chrome, Firefox, or Edge.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-recorder" id="voice-recorder">
      {/* Offline notice */}
      {!online && (
        <div className="voice-recorder-offline-notice" id="voice-recorder-offline-notice">
          <Mic size={24} style={{ color: 'var(--color-text-muted)', opacity: 0.5, marginBottom: '8px' }} />
          <p className="voice-recorder-offline-text">
            Voice recording requires an internet connection for transcription. Type directly in the notes box above,
            or use your device keyboard's built-in voice typing.
          </p>
        </div>
      )}

      {/* Idle: show mic button */}
      {online && !isRecording && !audioBlob && (
        <>
          <button
            id="voice-recorder-start-btn"
            className="voice-recorder-btn"
            onClick={startRecording}
            disabled={disabled}
            aria-label="Start recording"
            type="button"
          >
            <Mic size={28} />
          </button>
          <span className="voice-recorder-label">Tap to record</span>
        </>
      )}

      {/* Recording: timer + stop */}
      {isRecording && (
        <>
          <button
            id="voice-recorder-stop-btn"
            className="voice-recorder-btn voice-recorder-btn-recording"
            onClick={stopRecording}
            aria-label="Stop recording"
            type="button"
          >
            <Square size={24} />
          </button>
          <span className="voice-recorder-timer">{formatDuration(duration)}</span>
          <span className="voice-recorder-label">Recording… tap to stop</span>
        </>
      )}

      {/* Post-recording: player + actions */}
      {!isRecording && audioBlob && (
        <>
          <div className="voice-recorder-player">
            <audio src={audioUrl} controls preload="metadata" id="voice-recorder-audio" />
          </div>

          <div className="voice-recorder-controls">
            <button
              id="voice-recorder-record-again-btn"
              className="btn btn-secondary"
              onClick={recordAgain}
              disabled={isTranscribing}
              type="button"
            >
              <RotateCcw size={16} />
              Record Again
            </button>

            <button
              id="voice-recorder-discard-btn"
              className="btn btn-danger"
              onClick={recordAgain}
              disabled={isTranscribing}
              type="button"
            >
              <Trash2 size={16} />
              Discard
            </button>

            {!transcription && (
              <button
                id="voice-recorder-transcribe-btn"
                className="btn btn-primary"
                onClick={handleTranscribe}
                disabled={isTranscribing}
                type="button"
              >
                {isTranscribing ? (
                  <>
                    <Loader size={16} className="animate-pulse" />
                    Transcribing…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Transcribe with AI
                  </>
                )}
              </button>
            )}
          </div>

          {isTranscribing && (
            <div className="voice-recorder-loading">
              <Loader size={18} />
              Transcribing your audio…
            </div>
          )}

          {transcription && (
            <div className="voice-recorder-transcription" id="voice-recorder-transcription">
              <div className="voice-recorder-transcription-label">Transcription</div>
              <div className="voice-recorder-transcription-text">{transcription}</div>
            </div>
          )}
        </>
      )}

      {/* Error */}
      {error && (
        <div className="voice-recorder-error" id="voice-recorder-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
});

export default VoiceRecorder;
