import numpy as np
import pytest
from main import analyze_vitals

def test_analyze_vitals_insufficient_data():
    # データが少なすぎる場合のテスト
    data = {
        "forehead": {"r": [1.0]*10, "g": [1.0]*10, "b": [1.0]*10}
    }
    result = analyze_vitals(data)
    assert result["status"] == "error"
    assert "Insufficient" in result["message"]

def test_analyze_vitals_normal_data():
    # 疑似的な心拍波形を生成 (72bpm = 1.2Hz)
    fps = 30
    duration = 10 # seconds
    t = np.linspace(0, duration, fps * duration)
    signal = 100 + 5 * np.sin(2 * np.pi * 1.2 * t)
    
    data = {
        "forehead": {"r": signal.tolist(), "g": signal.tolist(), "b": signal.tolist()},
        "left_cheek": {"r": signal.tolist(), "g": signal.tolist(), "b": signal.tolist()},
        "right_cheek": {"r": signal.tolist(), "g": signal.tolist(), "b": signal.tolist()}
    }
    
    result = analyze_vitals(data)
    assert result["status"] == "success"
    # 72bpmに近い値が出るか確認
    assert 70 <= result["heart_rate_bpm"] <= 74
    assert result["confidence"] > 0
