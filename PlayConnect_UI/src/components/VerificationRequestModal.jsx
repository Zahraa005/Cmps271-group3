import React, { useState } from "react";
import { FileText, Image, X, Paperclip, ChevronDown, ChevronUp } from "lucide-react";
import axios from "axios";
import API_BASE_URL from "../Api/config";


export default function VerificationRequestModal({ isOpen, onClose, coachId }) {
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [showFiles, setShowFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  

  // ✅ allow multiple files
  const handleFilesChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selectedFiles]);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!message.trim()) {
      setError("Please enter a short message for verification.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const id = coachId || Number(localStorage.getItem("user_id"));
      if (!id) {
        setError("Missing coach ID — please log in again.");
        return;
      }

      // ✅ FormData for multiple files
      const formData = new FormData();
      formData.append("coach_id", id);
      formData.append("message", message);
      files.forEach((file) => formData.append("documents", file)); // backend expects 'documents'

      // ✅ send to correct backend route
      const res = await axios.post(`${API_BASE_URL}/coaches/request-verification`, formData, {

        headers: { "Content-Type": "multipart/form-data" },
      });

      // ✅ success flow
      setSuccess(true);
      alert(res.data?.message || "Verification request submitted successfully!");

      setTimeout(() => {
        setMessage("");
        setFiles([]);
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || "Error submitting verification request.");
    } finally {
      setSubmitting(false);
    }
  };

  const getFileIcon = (type) => {
    if (type.includes("image")) return <Image size={16} className="text-fuchsia-400" />;
    if (type.includes("pdf")) return <FileText size={16} className="text-red-400" />;
    return <Paperclip size={16} className="text-indigo-400" />;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 w-[90%] max-w-md text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-neutral-400 hover:text-white text-xl leading-none"
        >
          ×
        </button>

        <h2 className="text-2xl font-bold text-fuchsia-300 mb-6">
          Request Verification
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-neutral-400 text-sm mb-2">
            Write a short message and attach all relevant certification documents.
          </p>

          {/* Message Input */}
          <textarea
            className={`w-full bg-neutral-800 border ${
              error && !message.trim() ? "border-red-500" : "border-neutral-700"
            } rounded-lg px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-fuchsia-500 outline-none transition resize-y min-h-[140px]`}
            placeholder="Write your verification message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />

          {/* File Upload */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-neutral-300">
                Upload documents (multiple allowed)
              </label>
              <span className="text-xs text-neutral-500">
                {files.length > 0
                  ? `${files.length} file${files.length > 1 ? "s" : ""} uploaded`
                  : "No files yet"}
              </span>
            </div>

            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              multiple
              onChange={handleFilesChange}
              className="w-full text-sm bg-neutral-800 border border-neutral-700 rounded-lg p-2 text-neutral-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-indigo-500 file:to-fuchsia-500 file:text-white hover:file:opacity-90"
            />

            {files.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowFiles(!showFiles)}
                  className="w-full flex items-center justify-between bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-4 py-2 rounded-lg text-sm transition"
                >
                  <span>View uploaded files</span>
                  {showFiles ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showFiles && (
                  <div className="mt-3 bg-neutral-800 border border-neutral-700 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                    {files.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-2 text-neutral-300 truncate">
                          {getFileIcon(file.type || file.name)}
                          <span className="truncate">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          className="text-neutral-400 hover:text-red-400 transition"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error & Success */}
          {error && (
            <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
              Verification request submitted successfully!
            </div>
          )}

          {/* Buttons */}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-2 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
              submitting
                ? "bg-neutral-800 text-neutral-400 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-600 hover:to-fuchsia-600 text-white shadow-md shadow-fuchsia-500/20 mb-1"
            }`}
          >
            {submitting ? "Submitting..." : "Submit Request"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full mt-2 bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded-lg font-semibold transition"
          >
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}
