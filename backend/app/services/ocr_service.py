"""FINVORA PaddleOCR Service.

Provides a lazy-loaded singleton for PaddleOCR and exposes
extract_text(image_path_or_bytes) returning extracted text and confidence score.
"""

from __future__ import annotations
import io
import os
import logging
from pathlib import Path
from typing import NamedTuple, Union, Optional, Any, List
from dotenv import load_dotenv
import numpy as np
from PIL import Image

# Ensure environment variables are loaded
load_dotenv()

logger = logging.getLogger("finvora.ocr_service")


class OCRResult(NamedTuple):
    text: str
    confidence: float

    def __repr__(self) -> str:
        return f"OCRResult(text={self.text!r}, confidence={self.confidence:.4f})"


_ocr_engine_instance: Optional[Any] = None


def get_ocr_engine() -> Any:
    """Lazy-loads and returns the singleton PaddleOCR instance initialized with .env values."""
    global _ocr_engine_instance
    if _ocr_engine_instance is None:
        try:
            from paddleocr import PaddleOCR
        except ImportError as e:
            logger.error("Failed to import PaddleOCR: %s", e)
            raise RuntimeError(
                "PaddleOCR is not installed. Please install paddlepaddle and paddleocr in the virtual environment."
            ) from e

        lang = os.getenv("PADDLE_OCR_LANG", "en")
        use_angle_cls = os.getenv("PADDLE_OCR_USE_ANGLE_CLS", "true").strip().lower() in ("true", "1", "yes")
        use_gpu = os.getenv("PADDLE_OCR_USE_GPU", "false").strip().lower() in ("true", "1", "yes")
        device_str = "gpu" if use_gpu else "cpu"

        logger.info(
            "Initializing PaddleOCR singleton (lang=%s, use_angle_cls=%s, device=%s, enable_mkldnn=False)...",
            lang,
            use_angle_cls,
            device_str,
        )

        # Initialize PaddleOCR with CPU/GPU safe options
        try:
            # Modern PaddleOCR 3.x API
            _ocr_engine_instance = PaddleOCR(
                lang=lang,
                use_textline_orientation=use_angle_cls,
                device=device_str,
                enable_mkldnn=False,
            )
        except (TypeError, ValueError) as init_err:
            logger.warning("Modern PaddleOCR initialization fell back: %s", init_err)
            try:
                _ocr_engine_instance = PaddleOCR(
                    lang=lang,
                    use_angle_cls=use_angle_cls,
                    use_gpu=use_gpu,
                )
            except Exception as fallback_err:
                logger.error("PaddleOCR fallback initialization failed: %s", fallback_err)
                raise fallback_err

        logger.info("PaddleOCR singleton initialized successfully.")

    return _ocr_engine_instance


def extract_text(image_path_or_bytes: Union[str, Path, bytes, Image.Image, np.ndarray]) -> OCRResult:
    """
    Extracts text and average recognition confidence from an image.

    Args:
        image_path_or_bytes: File path (str or Path), raw image bytes, PIL Image, or numpy array.

    Returns:
        OCRResult(text=extracted_text, confidence=average_confidence_between_0_and_1)
    """
    ocr = get_ocr_engine()

    # Convert input to RGB numpy array
    img_input: Any = None

    if isinstance(image_path_or_bytes, (str, Path)):
        p = Path(image_path_or_bytes)
        if not p.exists():
            raise FileNotFoundError(f"Image file not found: {image_path_or_bytes}")
        try:
            pil_img = Image.open(p).convert("RGB")
            img_input = np.array(pil_img)
        except Exception as e:
            logger.error("Failed to open image file %s: %s", image_path_or_bytes, e)
            raise
    elif isinstance(image_path_or_bytes, bytes):
        try:
            pil_img = Image.open(io.BytesIO(image_path_or_bytes)).convert("RGB")
            img_input = np.array(pil_img)
        except Exception as e:
            logger.error("Failed to decode image bytes: %s", e)
            raise ValueError("Invalid image bytes provided to extract_text.") from e
    elif isinstance(image_path_or_bytes, Image.Image):
        img_input = np.array(image_path_or_bytes.convert("RGB"))
    elif isinstance(image_path_or_bytes, np.ndarray):
        img_input = image_path_or_bytes
    else:
        raise TypeError(f"Unsupported image type: {type(image_path_or_bytes)}")

    # Execute OCR inference
    try:
        raw_results = ocr.ocr(img_input)
    except Exception as e:
        logger.error("PaddleOCR inference failed: %s", e)
        raise RuntimeError(f"PaddleOCR execution error: {e}") from e

    extracted_lines: List[str] = []
    confidence_scores: List[float] = []

    if not raw_results:
        return OCRResult(text="", confidence=0.0)

    # Parse results across both PaddleX (dict-based) and classic (list-of-tuples) output formats
    for item in raw_results:
        if not item:
            continue

        # Format 1: PaddleX dict results with 'rec_texts' and 'rec_scores'
        if isinstance(item, dict):
            rec_texts = item.get("rec_texts", [])
            rec_scores = item.get("rec_scores", [])
            for text_line, score_val in zip(rec_texts, rec_scores):
                if text_line:
                    extracted_lines.append(str(text_line).strip())
                    try:
                        confidence_scores.append(float(score_val))
                    except (ValueError, TypeError):
                        pass

        # Format 2: Classic PaddleOCR [[[box, (text, score)], ...]]
        elif isinstance(item, (list, tuple)):
            for line_entry in item:
                if not line_entry:
                    continue
                if isinstance(line_entry, (list, tuple)) and len(line_entry) >= 2:
                    text_meta = line_entry[1]
                    if isinstance(text_meta, (list, tuple)) and len(text_meta) >= 2:
                        txt, score = text_meta[0], text_meta[1]
                        if txt:
                            extracted_lines.append(str(txt).strip())
                            try:
                                confidence_scores.append(float(score))
                            except (ValueError, TypeError):
                                pass
                    elif isinstance(text_meta, str):
                        extracted_lines.append(text_meta.strip())

    combined_text = "\n".join(extracted_lines).strip()
    avg_confidence = float(np.mean(confidence_scores)) if confidence_scores else 0.0

    return OCRResult(text=combined_text, confidence=round(avg_confidence, 4))
