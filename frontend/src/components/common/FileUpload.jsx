import { useState, useRef } from "react";
import { Upload, X, File, Image as ImageIcon, AlertCircle } from "lucide-react";
import { toast } from "react-hot-toast";

const FileUpload = ({
  onFilesSelected,
  maxFiles = 5,
  maxSizeMB = 10,
  allowedTypes = ["image/jpeg", "image/png", "application/pdf", "text/plain"],
}) => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileValidation = (files) => {
    const validFiles = [];
    const errors = [];

    if (selectedFiles.length + files.length > maxFiles) {
      toast.error(`You can only upload a maximum of ${maxFiles} files`);
      return;
    }

    Array.from(files).forEach((file) => {
      // Size check
      if (file.size > maxSizeMB * 1024 * 1024) {
        errors.push(`${file.name} is too large (max ${maxSizeMB}MB)`);
      }
      // Type check
      else if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
        errors.push(`${file.name} has an unsupported file type`);
      } else {
        validFiles.push(file);
      }
    });

    errors.forEach((err) => toast.error(err));

    const newFiles = [...selectedFiles, ...validFiles];
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const onFileChange = (e) => {
    if (e.target.files) {
      handleFileValidation(e.target.files);
    }
  };

  const removeFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
    onFilesSelected(newFiles);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileValidation(e.dataTransfer.files);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Upload attachments. Maximum ${maxFiles} files, ${maxSizeMB}MB each.`}
        className={`
          border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer
          flex flex-col items-center justify-center space-y-2
          ${isDragging ? "border-primary bg-blue-50" : "border-gray-300 hover:border-primary hover:bg-gray-50"}
        `}
      >
        <Upload
          className={`h-10 w-10 ${isDragging ? "text-primary" : "text-gray-400"}`}
        />
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            PNG, JPG, PDF, or TXT (max {maxSizeMB}MB per file)
          </p>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          multiple
          className="hidden"
          accept={allowedTypes.join(",")}
        />
      </div>

      {/* File List */}
      {selectedFiles.length > 0 && (
        <ul
          className="divide-y border rounded-md bg-white"
          aria-live="polite"
          aria-label="Selected files"
        >
          {selectedFiles.map((file, index) => (
            <li key={index} className="flex items-center justify-between p-3">
              <div className="flex items-center space-x-3 overflow-hidden">
                {file.type.startsWith("image/") ? (
                  <ImageIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />
                ) : (
                  <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                aria-label={`Remove ${file.name}`}
                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selectedFiles.length === 0 && (
        <div className="flex items-center space-x-2 text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-100">
          <AlertCircle className="h-4 w-4" />
          <span className="text-xs">
            No files selected. Attachments help resolve issues faster.
          </span>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
