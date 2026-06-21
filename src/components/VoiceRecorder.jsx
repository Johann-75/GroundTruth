import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, RotateCcw, Sparkles, AlertTriangle, Loader, Trash2 } from 'lucide-react';
import { transcribeAudio } from '../services/whisper';
import './VoiceRecorder.css';


/**
 * Check if the browser supports MediaRecorder + getUserMedia.
 * @returns {boolean}
 */
const isMediaRecorderSupported = () => {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices !== 'undefined' &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.MediaRecorder !== 'undefined'
  );
};

/**
 * Format seconds into mm:ss display string.
 * @param {number} totalSeconds
 * @returns {string}
 */
const formatDuration = (totalSeconds) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

/**
 * VoiceRecorder — records audio via the native MediaRecorder API and
 * optionally transcribes it to text using Groq Whisper.
 *
 * @param {object} props
 * @param {(text: string) => void}  props.onTranscription  — called with the transcribed text
 * @param {(blob: Blob) => void}    props.onAudioCaptured  — called with the raw audio blob
 * @param {boolean}                 [props.disabled=false]  — disables the recorder
 */
export default function VoiceRecorder({ onTranscription, onAudioCaptured, disabled = false }) {
    // ── State ──────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState(''); // 'transcribing' | 'polishing' | ''
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Refs ───────────────────────────────────────────────────
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const streamRef = useRef(null);

  const audioUrlRef = useRef(null);

  useEffect(() => {
    audioUrlRef.current = audioUrl;
  }, [audioUrl]);

  // ── Cleanup on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      clearInterval(timerIntervalRef.current);
      // Stop any active media tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      // Revoke object URLs to prevent memory leaks
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
    };
  }, []);

  /**
   * Start recording audio from the user's microphone.
   */
  const startRecording = useCallback(async () => {
    setError('');
    setTranscription('');
    setAudioBlob(null);

    // Revoke old URL if any
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);

        setAudioBlob(blob);
        setAudioUrl(url);
        setIsRecording(false);

        // Notify parent
        if (onAudioCaptured) {
          onAudioCaptured(blob);
        }

        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        // Stop timer
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      };

      mediaRecorder.onerror = () => {
        setError('Recording failed. Please try again.');
        setIsRecording(false);
        clearInterval(timerIntervalRef.current);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      // Start timer (updates every second)
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone access denied. Please allow microphone permissions in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone and try again.');
      } else {
        setError(`${'Could not start recording:'} ${err.message}`);
      }
    }
  }, [audioUrl, onAudioCaptured]);

  /**
   * Stop the current recording.
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  /**
   * Reset everything so the user can record again.
   */
  const recordAgain = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setTranscription('');
    setError('');
    setDuration(0);
    setIsTranscribing(false);
    if (onAudioCaptured) {
      onAudioCaptured(null);
    }
  }, [audioUrl, onAudioCaptured]);

  /**
   * Transcribe the recorded audio via Groq Whisper and polish it with Llama.
   */
  const handleTranscribe = useCallback(async () => {
    if (!audioBlob) return;

    setIsTranscribing(true);
    setTranscribeStatus('transcribing');
    setError('');

    try {
      const rawText = await transcribeAudio(audioBlob);
      setTranscription(rawText);

      if (onTranscription) {
        onTranscription(rawText);
      }
    } catch (err) {
      setError(err.message || 'Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
      setTranscribeStatus('');
    }
  }, [audioBlob, onTranscription]);

  // ── Unsupported browser fallback ───────────────────────────
  if (!isMediaRecorderSupported()) {
    return (
      <div className="voice-recorder" id="voice-recorder">
        <div className="voice-recorder-unsupported">
          <AlertTriangle size={32} className="voice-recorder-unsupported-icon" />
          <p>
            {'Voice recording is not supported in this browser.'}
            <br />
            {'Please use a modern browser like Chrome, Firefox, or Edge on your device.'}
          </p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="voice-recorder" id="voice-recorder">
      {/* ── Offline Banner ── */}
      {!online && (
        <div className="voice-recorder-offline-notice" id="voice-recorder-offline-notice">
          <Mic size={24} style={{ color: 'var(--color-text-muted)', opacity: 0.5, marginBottom: '8px' }} />
          <p className="voice-recorder-offline-text">
            {'Voice recording is unavailable offline. Please type directly in the notes box above, or use your device keyboard\'s built-in voice typing.'}
          </p>
        </div>
      )}

      {/* ── Idle state: show mic button ── */}
      {online && !isRecording && !audioBlob && (
        <>
          <button
            id="voice-recorder-start-btn"
            className="voice-recorder-btn"
            onClick={startRecording}
            disabled={disabled}
            aria-label={'Start recording'}
            type="button"
          >
            <Mic size={28} />
          </button>
          <span className="voice-recorder-label">{'Tap to record'}</span>
        </>
      )}

      {/* ── Recording state: show timer + stop button ── */}
      {isRecording && (
        <>
          <button
            id="voice-recorder-stop-btn"
            className="voice-recorder-btn voice-recorder-btn-recording"
            onClick={stopRecording}
            aria-label={'Stop recording'}
            type="button"
          >
            <Square size={24} />
          </button>
          <span className="voice-recorder-timer">{formatDuration(duration)}</span>
          <span className="voice-recorder-label">{'Recording… tap to stop'}</span>
        </>
      )}

      {/* ── Post-recording: player + actions ── */}
      {!isRecording && audioBlob && (
        <>
          {/* Audio player */}
          <div className="voice-recorder-player">
            <audio src={audioUrl} controls preload="metadata" id="voice-recorder-audio" />
          </div>

          {/* Action buttons */}
          <div className="voice-recorder-controls">
            <button
              id="voice-recorder-record-again-btn"
              className="btn btn-secondary"
              onClick={recordAgain}
              disabled={isTranscribing}
              type="button"
            >
              <RotateCcw size={16} />
              {'Record Again'}
            </button>

            <button
              id="voice-recorder-discard-btn"
              className="btn btn-danger"
              onClick={recordAgain}
              disabled={isTranscribing}
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={16} />
              {'Discard'}
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
                    {transcribeStatus === 'polishing' ? 'Polishing…' : 'Transcribing…'}
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    {'Transcribe with AI'}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Loading indicator */}
          {isTranscribing && (
            <div className="voice-recorder-loading">
              <Loader size={18} />
              {transcribeStatus === 'polishing'
                ? 'Polishing transcription grammar & punctuation…'
                : 'Transcribing your audio…'}
            </div>
          )}

          {/* Transcription result */}
          {transcription && (
            <div className="voice-recorder-transcription" id="voice-recorder-transcription">
              <div className="voice-recorder-transcription-label">{'Transcription'}</div>
              <div className="voice-recorder-transcription-text">{transcription}</div>
            </div>
          )}
        </>
      )}

      {/* ── Error message ── */}
      {error && (
        <div className="voice-recorder-error" id="voice-recorder-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
