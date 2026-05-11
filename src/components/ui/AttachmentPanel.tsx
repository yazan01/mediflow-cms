"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { apiFetch } from "@/lib/hooks/useDataFetch";

interface Attachment {
  id: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  uploadedBy: string | null;
  createdAt: string | null;
}

interface Props {
  entityType: "patient" | "emr" | "lab_order" | "radiology_order" | "invoice";
  entityId: string;
}

function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)mediflow_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mime: string): { icon: string; color: string; bg: string } {
  if (mime === "application/pdf")
    return { icon: "picture_as_pdf", color: "text-[#ba1a1a]", bg: "bg-[#ffdad6]" };
  if (mime.startsWith("image/"))
    return { icon: "image", color: "text-[#1960a3]", bg: "bg-[#d3e4ff]" };
  if (mime.includes("word") || mime.includes("document"))
    return { icon: "description", color: "text-[#1960a3]", bg: "bg-[#d3e4ff]" };
  if (mime.includes("excel") || mime.includes("spreadsheet"))
    return { icon: "table_chart", color: "text-[#0d9488]", bg: "bg-[#ccfbf1]" };
  return { icon: "attach_file", color: "text-[var(--txt2)]", bg: "bg-[var(--surface2)]" };
}

export function AttachmentPanel({ entityType, entityId }: Props) {
  const { t } = useLanguage();
  const a = t.attachments;

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [dragging, setDragging] = useState(false);
  const [confirmDeleteAtt, setConfirmDeleteAtt] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    if (!entityId) return;
    setLoading(true);
    fetch(`/api/attachments?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setAttachments)
      .catch(() => setAttachments([]))
      .finally(() => setLoading(false));
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  async function upload(file: File) {
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const csrf = getCsrfToken();
      const res = await fetch(
        `/api/attachments?entityType=${entityType}&entityId=${entityId}`,
        {
          method: "POST",
          body: formData,
          headers: csrf ? { "X-CSRF-Token": csrf } : {},
        }
      );
      if (res.status === 413) { setError(a.fileTooLarge); return; }
      if (res.status === 422) { setError(a.fileTypeNotAllowed); return; }
      if (!res.ok) { setError(a.uploadFailed); return; }
      load();
      showToast(a.upload);
    } catch {
      setError(a.uploadFailed);
    } finally {
      setUploading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  function handleDelete(att: Attachment) {
    setConfirmDeleteAtt(att);
  }

  async function doDelete() {
    if (!confirmDeleteAtt) return;
    const id = confirmDeleteAtt.id;
    setConfirmDeleteAtt(null);
    await apiFetch(`/api/attachments/${id}`, { method: "DELETE" });
    setAttachments((prev) => prev.filter((x) => x.id !== id));
    showToast(a.deleteSuccess);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] shadow-[var(--sh-sm)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--blue)] text-[20px]">attach_file</span>
          <h3 className="text-sm font-semibold text-[var(--txt1)]">{a.title}</h3>
          {attachments.length > 0 && (
            <span className="text-xs font-semibold text-[var(--blue)] bg-[var(--blue-bg)] px-2 py-0.5 rounded-full">
              {attachments.length}
            </span>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-sm font-semibold text-[var(--blue)] hover:bg-[var(--blue-bg)] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <span className="w-4 h-4 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
          ) : (
            <span className="material-symbols-outlined text-[18px]">upload</span>
          )}
          {uploading ? a.uploading : a.upload}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          aria-label={a.upload}
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt"
          onChange={onFileChange}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="px-5 py-2.5 bg-[var(--err-bg)] text-[var(--err)] text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="ms-2">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="px-5 py-2.5 bg-[var(--ok-bg)] text-[var(--ok)] text-sm font-semibold">{toast}</div>
      )}

      {/* Body */}
      {loading ? (
        <div className="p-8 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-[#1960a3]/30 border-t-[#1960a3] rounded-full animate-spin" />
        </div>
      ) : attachments.length === 0 ? (
        /* Drop zone */
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`m-4 border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
            dragging ? "border-[#1960a3] bg-[#d3e4ff]/20" : "border-[var(--border)] hover:border-[#1960a3]/50 hover:bg-[var(--surface2)]"
          }`}
        >
          <span className="material-symbols-outlined text-[var(--txt2)] text-[36px]">cloud_upload</span>
          <p className="text-sm font-semibold text-[var(--txt2)]">{a.noFiles}</p>
          <p className="text-xs text-[var(--txt2)] text-center">{a.dropHere}</p>
          <p className="text-[10px] text-[var(--txt2)] mt-1">PDF · JPG · PNG · DOC · XLS · TXT — max 20 MB</p>
        </div>
      ) : (
        <div>
          {/* Drop zone hint at top */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`mx-4 mt-3 mb-1 border border-dashed rounded-lg px-4 py-2 flex items-center gap-2 text-xs text-[var(--txt2)] cursor-pointer transition-colors ${
              dragging ? "border-[#1960a3] bg-[#d3e4ff]/20 text-[#1960a3]" : "border-[var(--border)] hover:border-[#1960a3]/40"
            }`}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            {a.dropHere}
          </div>
          {/* File list */}
          <div className="divide-y divide-[var(--border)]">
            {attachments.map((att) => {
              const { icon, color, bg } = fileIcon(att.mimeType);
              return (
                <div key={att.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[var(--surface2)] transition-colors group">
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <span className={`material-symbols-outlined ${color} text-[18px]`}>{icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--txt1)] truncate">{att.originalName}</p>
                    <p className="text-xs text-[var(--txt2)]">
                      {formatBytes(att.fileSize)}
                      {att.uploadedBy && ` · ${att.uploadedBy}`}
                      {att.createdAt && ` · ${new Date(att.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <a
                    href={`/api/attachments/${att.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-[var(--blue-bg)] text-[var(--txt2)] hover:text-[var(--blue)] transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Download"
                    title="Download"
                  >
                    <span className="material-symbols-outlined text-[16px]">download</span>
                  </a>
                  <button
                    onClick={() => handleDelete(att)}
                    className="p-1.5 rounded-lg hover:bg-[var(--err-bg)] text-[var(--txt2)] hover:text-[var(--err)] transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Delete"
                    title="Delete"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDeleteAtt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="att-del-title"
          onKeyDown={(e) => e.key === "Escape" && setConfirmDeleteAtt(null)}
        >
          <div className="bg-[var(--surface)] rounded-2xl shadow-[var(--sh-xl)] w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[var(--err)] text-[28px]">delete</span>
              <h2 id="att-del-title" className="text-base font-semibold text-[var(--txt1)]">{a.deleteConfirm}</h2>
            </div>
            <p className="text-sm text-[var(--txt2)] truncate">{confirmDeleteAtt.originalName}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setConfirmDeleteAtt(null)}
                className="btn-secondary"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={doDelete}
                className="btn-danger"
              >
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
