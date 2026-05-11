import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import get_db
from auth import get_current_user, generate_id, log_audit
import models

router = APIRouter(prefix="/api/attachments", tags=["attachments"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"

ALLOWED_EXTENSIONS = {
    ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp",
    ".doc", ".docx", ".xls", ".xlsx", ".txt",
}

EXTENSION_MIME = {
    ".pdf":  "application/pdf",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".gif":  "image/gif",
    ".webp": "image/webp",
    ".doc":  "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls":  "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt":  "text/plain",
}

VALID_ENTITY_TYPES = {
    "patient", "emr", "lab_order", "radiology_order", "invoice",
}

MAX_SIZE = 20 * 1024 * 1024  # 20 MB


def _attachment_dict(a: models.Attachment) -> dict:
    return {
        "id": a.id,
        "entityType": a.entityType,
        "entityId": a.entityId,
        "originalName": a.originalName,
        "mimeType": a.mimeType,
        "fileSize": a.fileSize,
        "uploadedBy": a.uploader.name if a.uploader else None,
        "createdAt": a.createdAt.isoformat() if a.createdAt else None,
    }


@router.get("")
def list_attachments(
    entityType: str = Query(...),
    entityId: str = Query(...),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    if entityType not in VALID_ENTITY_TYPES:
        raise HTTPException(422, f"Invalid entityType. Allowed: {', '.join(sorted(VALID_ENTITY_TYPES))}")
    rows = (
        db.query(models.Attachment)
        .filter(
            models.Attachment.entityType == entityType,
            models.Attachment.entityId == entityId,
        )
        .order_by(models.Attachment.createdAt.desc())
        .all()
    )
    return [_attachment_dict(r) for r in rows]


@router.post("", status_code=201)
async def upload_attachment(
    entityType: str = Query(...),
    entityId: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if entityType not in VALID_ENTITY_TYPES:
        raise HTTPException(422, f"Invalid entityType. Allowed: {', '.join(sorted(VALID_ENTITY_TYPES))}")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(422, f"File type '{ext}' not allowed.")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(413, "File too large. Maximum size is 20 MB.")

    stored_name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = UPLOAD_DIR / entityType / entityId
    dest_dir.mkdir(parents=True, exist_ok=True)
    (dest_dir / stored_name).write_bytes(contents)

    att = models.Attachment(
        id=generate_id(),
        entityType=entityType,
        entityId=entityId,
        originalName=file.filename or stored_name,
        storedName=stored_name,
        mimeType=EXTENSION_MIME.get(ext, "application/octet-stream"),
        fileSize=len(contents),
        uploadedById=current_user.id,
    )
    db.add(att)
    db.commit()
    db.refresh(att)
    log_audit(db, current_user.id, "CREATE", "ATTACHMENTS", att.id, "Attachment",
              new_values={"entityType": entityType, "entityId": entityId, "file": att.originalName})
    return _attachment_dict(att)


@router.get("/{attachment_id}/download")
def download_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    att = db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(404, "Attachment not found")

    path = UPLOAD_DIR / att.entityType / att.entityId / att.storedName
    if not path.exists():
        raise HTTPException(404, "File not found on disk")

    return FileResponse(
        path=str(path),
        media_type=att.mimeType,
        filename=att.originalName,
        headers={"Content-Disposition": f'attachment; filename="{att.originalName}"'},
    )


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(
    attachment_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    att = db.query(models.Attachment).filter(models.Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(404, "Attachment not found")

    path = UPLOAD_DIR / att.entityType / att.entityId / att.storedName
    if path.exists():
        path.unlink()

    log_audit(db, current_user.id, "DELETE", "ATTACHMENTS", att.id, "Attachment",
              old_values={"file": att.originalName, "entityType": att.entityType})
    db.delete(att)
    db.commit()
