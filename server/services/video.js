// Historias animadas: el navegador graba la animación (WebM o MP4) y aquí se
// convierte con ffmpeg al formato que pide Instagram (MP4 H.264 + AAC, 30 fps,
// 1080×1920). Si se manda una pista de audio se mezcla (con fundido al final);
// si no, se añade una pista de audio en silencio para máxima compatibilidad.
import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';

let available = null;
export function ffmpegAvailable() {
  if (available !== null) return Promise.resolve(available);
  return new Promise(resolve => {
    execFile('ffmpeg', ['-version'], { timeout: 5000 }, err => {
      available = !err;
      if (!available) console.log('[video] ffmpeg no está instalado: las historias animadas están desactivadas');
      resolve(available);
    });
  });
}

const EXT = { 'video/webm': 'webm', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/ogg': 'ogg', 'audio/webm': 'webm' };

function run(args, timeout) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { timeout, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).split('\n').slice(-4).join(' ').trim()));
      else resolve();
    });
  });
}

// video/audio: { buffer, mimetype } (multer). Devuelve el MP4 como Buffer.
export async function toInstagramMp4(video, audio, durationSec) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qc-video-'));
  const id = crypto.randomBytes(6).toString('hex');
  const inV = path.join(dir, `${id}-in.${EXT[video.mimetype] || 'webm'}`);
  const out = path.join(dir, `${id}-out.mp4`);
  try {
    fs.writeFileSync(inV, video.buffer);
    const args = ['-y', '-i', inV];
    const dur = Math.max(3, Math.min(Number(durationSec) || 7, 15));
    if (audio) {
      const inA = path.join(dir, `${id}-audio.${EXT[audio.mimetype] || 'mp3'}`);
      fs.writeFileSync(inA, audio.buffer);
      args.push('-i', inA);
    } else {
      args.push('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo');
    }
    args.push(
      '-map', '0:v:0', '-map', '1:a:0',
      '-t', String(dur),
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'superfast', '-crf', '21', '-profile:v', 'high', '-level', '4.1',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
      '-af', `afade=t=out:st=${Math.max(0, dur - 1)}:d=1`,
      '-shortest', '-movflags', '+faststart', out
    );
    await run(args, 120000);
    return fs.readFileSync(out);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
