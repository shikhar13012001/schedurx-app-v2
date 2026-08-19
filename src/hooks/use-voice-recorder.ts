"use client";

import { useRef, useState } from "react";

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result is "data:<mime>;base64,<data>" — strip the prefix.
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Minimal MediaRecorder wrapper shared by the "Recap" button and ambient
// capture — both are the same primitive (record, stop, get base64 audio),
// just triggered differently.
export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stop = (): Promise<{ base64: string; filename: string } | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder) return resolve(null);
      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (!chunksRef.current.length) return resolve(null);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const base64 = await blobToBase64(blob);
        resolve({ base64, filename: `clip.${recorder.mimeType?.includes("mp4") ? "mp4" : "webm"}` });
      };
      recorder.stop();
    });
  };

  return { recording, start, stop };
}
