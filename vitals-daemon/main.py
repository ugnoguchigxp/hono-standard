import socket
import os
import sys
import json
import time
import numpy as np
from scipy import signal

SOCKET_PATH = "/tmp/vitals_daemon.sock"

def analyze_vitals(data):
    """
    究極の顔解析: バイタル + 美容 + 生理状態 + 疲労・ストレス
    """
    try:
        def get_rgb(name):
            return {
                'r': np.array(data.get(name, {}).get('r', [])),
                'g': np.array(data.get(name, {}).get('g', [])),
                'b': np.array(data.get(name, {}).get('b', []))
            }

        forehead = get_rgb('forehead')
        left_cheek = get_rgb('left_cheek')
        right_cheek = get_rgb('right_cheek')
        lips = get_rgb('lips')
        
        geometry = data.get('geometry', {})
        eye_apertures = np.array(geometry.get('eye_aperture', []))
        face_widths = np.array(geometry.get('face_width', []))
        face_heights = np.array(geometry.get('face_height', []))

        if len(forehead['g']) < 100:
            return {"status": "error", "message": "Insufficient data points"}

        fps = 30.0
        nyq = 0.5 * fps
        
        # --- 1. 基本バイタル ---
        gn = forehead['g'] / np.mean(forehead['g'])
        b_filt, a_filt = signal.butter(4, [0.75 / nyq, 4.0 / nyq], btype='band')
        h_filtered = signal.filtfilt(b_filt, a_filt, gn)
        
        freqs = np.fft.rfftfreq(len(h_filtered), d=1/fps)
        fft_values = np.abs(np.fft.rfft(h_filtered))
        valid_idx = np.where((freqs >= 0.75) & (freqs <= 3.0))[0]
        heart_rate = freqs[valid_idx[np.argmax(fft_values[valid_idx])]] * 60
        
        # --- 2. 自律神経 (HRV) ---
        peaks, _ = signal.find_peaks(h_filtered, distance=fps/3)
        lf, hf, rmssd, sdnn = 0.0, 0.0, 0.0, 0.0
        if len(peaks) > 5:
            ibi = np.diff(peaks) / fps * 1000
            rmssd = np.sqrt(np.mean(np.square(np.diff(ibi))))
            sdnn = np.std(ibi)
            if len(ibi) > 10:
                f, psd = signal.welch(ibi, fs=1.0/(np.mean(ibi)/1000.0), nperseg=len(ibi))
                lf = np.trapz(psd[(f >= 0.04) & (f <= 0.15)])
                hf = np.trapz(psd[(f >= 0.15) & (f <= 0.4)])
        
        lf_hf_ratio = lf / hf if hf > 0 else 1.0

        # --- 3. 状態推定 (眠気・酩酊・貧血) ---
        # 眠気
        if len(eye_apertures) > 0:
            perclos = np.sum(eye_apertures < 0.1) / len(eye_apertures)
            blinks = len(signal.find_peaks(-eye_apertures, distance=fps/5, prominence=0.05)[0])
            drowsiness_index = (perclos * 100.0) + (blinks * 2.0)
        else:
            perclos, drowsiness_index = 0.0, 0.0

        # 酩酊
        cheek_r = (np.mean(left_cheek['r']) + np.mean(right_cheek['r'])) / 2.0
        cheek_g = (np.mean(left_cheek['g']) + np.mean(right_cheek['g'])) / 2.0
        redness_ratio = cheek_r / max(1.0, cheek_g)
        inebriation_level = max(0.0, (redness_ratio - 1.1) * 100.0 + (heart_rate - 70.0) * 0.5)

        # 貧血
        lip_redness = np.mean(lips['r']) / max(1.0, np.mean(lips['g']))
        anemia_index = max(0.0, (1.4 - lip_redness) * 100.0)

        # --- 4. 疲れ・ストレス (新指標) ---
        # ストレス度 (LF/HFベース)
        stress_level = min(100.0, lf_hf_ratio * 15.0)
        
        # 疲労度 (RMSSDの低下、目の腫れ、心拍数から総合判断)
        avg_apt = np.mean(eye_apertures) if len(eye_apertures) > 0 else 0.25
        puffiness = max(0.0, (0.25 - avg_apt) * 400.0)
        fatigue_index = (100.0 - min(100.0, rmssd)) * 0.4 + (heart_rate - 60.0) * 0.2 + puffiness * 0.3

        # --- その他指標 ---
        dark_circle_index = max(0.0, (cheek_g - np.mean(data.get('under_eye_left', {}).get('g', [cheek_g]))) / max(1.0, cheek_g) * 100.0)
        aspect_ratio = np.mean(face_widths) / np.mean(face_heights) if len(face_widths) > 0 else 0.75
        edema_index = max(0.0, (aspect_ratio - 0.75) * 200.0)

        return {
            "status": "success",
            "heart_rate_bpm": float(heart_rate),
            "respiratory_rate": 0.0,
            "quality_score": 1.0,
            "confidence": 0.9,
            "rmssd": float(rmssd),
            "sdnn": float(sdnn),
            "lf_hf_ratio": float(lf_hf_ratio),
            "stress_level": float(stress_level),
            "fatigue_index": float(min(100.0, fatigue_index)),
            "drowsiness_index": float(min(100.0, drowsiness_index)),
            "inebriation_level": float(min(100.0, inebriation_level)),
            "anemia_index": float(min(100.0, anemia_index)),
            "dark_circle_index": float(dark_circle_index),
            "edema_index": float(edema_index)
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

def main():
    if os.path.exists(SOCKET_PATH): os.remove(SOCKET_PATH)
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    server.bind(SOCKET_PATH)
    server.listen(1)
    print(f"Vitals Daemon started. Listening on {SOCKET_PATH}...")
    try:
        while True:
            conn, _ = server.accept()
            try:
                raw_data = conn.recv(4 * 1024 * 1024)
                if not raw_data: continue
                request = json.loads(raw_data.decode('utf-8'))
                result = analyze_vitals(request.get('data', {}))
                conn.sendall(json.dumps(result).encode('utf-8'))
            except Exception as e:
                conn.sendall(json.dumps({"status": "error", "message": str(e)}).encode('utf-8'))
            finally:
                conn.close()
    except KeyboardInterrupt: pass
    finally:
        server.close()
        if os.path.exists(SOCKET_PATH): os.remove(SOCKET_PATH)

if __name__ == "__main__": main()
