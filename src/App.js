import React, { useRef, useState } from "react";
import {
  ShieldCheck,
  Lock,
  Unlock,
  Upload,
  FileText,
  X,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Moon,
  Sun,
  KeyRound,
  Cpu,
  Shield,
  Download,
} from "lucide-react";
import "./index.css";

/* =========================
   CRYPTO HELPERS
========================= */

const encoder = new TextEncoder();

const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
};

const base64ToBuffer = (base64) => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
};

const createKey = async (password, salt) => {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
};

const encryptPDF = async (file, password) => {
  const data = await file.arrayBuffer();

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await createKey(password, salt);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    data
  );

  const secureData = {
    type: "SECUREPDF",
    version: 1,
    originalName: file.name,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    data: bufferToBase64(encrypted),
  };

  return new Blob([JSON.stringify(secureData)], {
    type: "application/json",
  });
};

const decryptPDF = async (file, password) => {
  const text = await file.text();
  const secureData = JSON.parse(text);

  if (secureData.type !== "SECUREPDF") {
    throw new Error("Invalid encrypted file.");
  }

  const salt = new Uint8Array(base64ToBuffer(secureData.salt));
  const iv = new Uint8Array(base64ToBuffer(secureData.iv));
  const encrypted = base64ToBuffer(secureData.data);

  const key = await createKey(password, salt);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encrypted
  );

  return {
    blob: new Blob([decrypted], {
      type: "application/pdf",
    }),
    name: secureData.originalName || "decrypted.pdf",
  };
};

/* =========================
   COMPONENT
========================= */

function App() {
  const [mode, setMode] = useState("encrypt");
  const [file, setFile] = useState(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  const [darkMode, setDarkMode] = useState(true);

  const fileInputRef = useRef(null);

  const isEncrypt = mode === "encrypt";

  /* =========================
     FILE HANDLING
  ========================= */

  const selectFile = (selectedFile) => {
    if (!selectedFile) return;

    setMessage("");
    setMessageType("");

    if (isEncrypt) {
      if (selectedFile.type !== "application/pdf") {
        setMessage("Please select a PDF file.");
        setMessageType("error");
        return;
      }

      if (selectedFile.size > 50 * 1024 * 1024) {
        setMessage("File size must be below 50 MB.");
        setMessageType("error");
        return;
      }
    } else {
      if (!selectedFile.name.toLowerCase().endsWith(".securepdf")) {
        setMessage("Please select a .securepdf file.");
        setMessageType("error");
        return;
      }
    }

    setFile(selectedFile);
  };

  const handleFileChange = (e) => {
    selectFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    selectFile(droppedFile);
  };

  const removeFile = () => {
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* =========================
     MODE
  ========================= */

  const changeMode = (newMode) => {
    setMode(newMode);
    setFile(null);
    setPassword("");
    setConfirmPassword("");
    setMessage("");
    setMessageType("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /* =========================
     PASSWORD
  ========================= */

  const passwordStrength = () => {
    if (!password) return 0;

    let score = 0;

    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    return Math.min(score, 5);
  };

  const strength = passwordStrength();

  const strengthLabel = () => {
    if (!password) return "";
    if (strength <= 1) return "Weak";
    if (strength <= 3) return "Medium";
    return "Strong";
  };

  /* =========================
     PROCESS
  ========================= */

  const handleSubmit = async () => {
    setMessage("");
    setMessageType("");

    if (!file) {
      setMessage(
        isEncrypt
          ? "Select a PDF file first."
          : "Select an encrypted file first."
      );
      setMessageType("error");
      return;
    }

    if (!password) {
      setMessage("Enter your password.");
      setMessageType("error");
      return;
    }

    if (password.length < 8) {
      setMessage("Password must contain at least 8 characters.");
      setMessageType("error");
      return;
    }

    if (isEncrypt && password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setMessageType("error");
      return;
    }

    setProcessing(true);

    try {
      if (isEncrypt) {
        const encryptedBlob = await encryptPDF(file, password);

        const url = URL.createObjectURL(encryptedBlob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `${file.name}.securepdf`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        setMessage("Your PDF has been encrypted successfully.");
        setMessageType("success");
      } else {
        const result = await decryptPDF(file, password);

        const url = URL.createObjectURL(result.blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = result.name;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        setMessage("Your PDF has been decrypted successfully.");
        setMessageType("success");
      }
    } catch (error) {
      console.error(error);

      if (isEncrypt) {
        setMessage("Encryption failed. Please try again.");
      } else {
        setMessage("Incorrect password or invalid encrypted file.");
      }

      setMessageType("error");
    } finally {
      setProcessing(false);
    }
  };

  /* =========================
     FORMAT
  ========================= */

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className={darkMode ? "app dark" : "app light"}>
      <div className="background-grid" />
      <div className="ambient-glow glow-one" />
      <div className="ambient-glow glow-two" />

      {/* NAVBAR */}
      <nav className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={22} />
          </div>

          <div>
            <div className="brand-name">SecurePDF</div>
            <div className="brand-subtitle">Document Security</div>
          </div>
        </div>

        <div className="nav-right">
          <div className="security-status">
            <span className="status-dot" />
            Local Processing
          </div>

          <button
            className="theme-button"
            onClick={() => setDarkMode(!darkMode)}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>

      {/* MAIN */}
      <main className="main-container">
        <section className="hero-section">
          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={15} />
              PRIVATE DOCUMENT PROTECTION
            </div>

            <h1>
              Secure your documents
              <span> without compromise.</span>
            </h1>

            <p>
              Encrypt sensitive PDF files with strong AES-256-GCM protection
              directly in your browser.
            </p>

            <div className="hero-tags">
              <div>
                <Shield size={15} />
                AES-256
              </div>

              <div>
                <KeyRound size={15} />
                PBKDF2
              </div>

              <div>
                <Cpu size={15} />
                Local Processing
              </div>
            </div>
          </div>
        </section>

        {/* WORKSPACE */}
        <section className="workspace">
          {/* LEFT VISUAL */}
          <div className="security-visual">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="visual-orbit orbit-three" />

            <div className="visual-card">
              <div className="visual-top">
                <span>SECUREPDF</span>

                <span className="live-indicator">
                  <span />
                  ACTIVE
                </span>
              </div>

              <div
                className={`pdf-visual ${
                  isEncrypt ? "locked" : "unlocked"
                }`}
              >
                <div className="pdf-sheet">
                  <div className="pdf-fold" />

                  <div className="pdf-logo">
                    <FileText size={38} />
                  </div>

                  <div className="pdf-lines">
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>

                  <span className="pdf-label">
                    {isEncrypt ? "PRIVATE" : "OPEN"}
                  </span>
                </div>

                <div className="lock-circle">
                  {isEncrypt ? (
                    <Lock size={35} strokeWidth={2} />
                  ) : (
                    <Unlock size={35} strokeWidth={2} />
                  )}
                </div>
              </div>

              <div className="visual-footer">
                <div>
                  <small>PROTECTION</small>
                  <strong>AES-256-GCM</strong>
                </div>

                <div>
                  <small>KEY DERIVATION</small>
                  <strong>PBKDF2</strong>
                </div>
              </div>
            </div>

            <div className="floating-chip chip-one">
              <ShieldCheck size={16} />
              <span>Secure</span>
            </div>

            <div className="floating-chip chip-two">
              <Lock size={16} />
              <span>Encrypted</span>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="workspace-panel">
            <div className="panel-header">
              <div>
                <div className="panel-kicker">DOCUMENT TOOL</div>

                <h2>{isEncrypt ? "Encrypt PDF" : "Decrypt PDF"}</h2>

                <p>
                  {isEncrypt
                    ? "Protect your PDF with a password."
                    : "Restore your protected PDF."}
                </p>
              </div>

              <div
                className={`mode-icon ${
                  isEncrypt ? "locked" : "unlocked"
                }`}
              >
                {isEncrypt ? <Lock size={22} /> : <Unlock size={22} />}
              </div>
            </div>

            {/* MODE SWITCH */}
            <div className="mode-switch">
              <button
                className={isEncrypt ? "active" : ""}
                onClick={() => changeMode("encrypt")}
              >
                <Lock size={16} />
                Encrypt
              </button>

              <button
                className={!isEncrypt ? "active" : ""}
                onClick={() => changeMode("decrypt")}
              >
                <Unlock size={16} />
                Decrypt
              </button>
            </div>

            {/* UPLOAD */}
            <div
              className={`upload-zone ${dragActive ? "dragging" : ""} ${
                file ? "has-file" : ""
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => {
                if (!file) {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={
                  isEncrypt
                    ? ".pdf,application/pdf"
                    : ".securepdf"
                }
                onChange={handleFileChange}
                hidden
              />

              {!file ? (
                <>
                  <div className="upload-icon">
                    <Upload size={25} />
                  </div>

                  <div className="upload-text">
                    <strong>
                      Drop your {isEncrypt ? "PDF" : "secure file"} here
                    </strong>

                    <span>
                      or <b>browse files</b>
                    </span>
                  </div>

                  <div className="upload-limit">
                    {isEncrypt
                      ? "PDF • MAX 50 MB"
                      : "SECUREPDF FILE"}
                  </div>
                </>
              ) : (
                <div className="selected-file">
                  <div className="selected-file-icon">
                    <FileText size={25} />
                  </div>

                  <div className="file-details">
                    <strong>{file.name}</strong>
                    <span>{formatSize(file.size)}</span>
                  </div>

                  <button
                    className="remove-file"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                  >
                    <X size={17} />
                  </button>
                </div>
              )}
            </div>

            {/* PASSWORD */}
            <div className="password-section">
              <div className="section-title">
                <span>Password</span>
                <small>MIN. 8 CHARACTERS</small>
              </div>

              <div className="password-input">
                <KeyRound size={18} />

                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <button
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  type="button"
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>

              {password && (
                <div className="strength-container">
                  <div className="strength-bars">
                    {[1, 2, 3, 4, 5].map((item) => (
                      <span
                        key={item}
                        className={
                          item <= strength ? "filled" : ""
                        }
                      />
                    ))}
                  </div>

                  <span
                    className={`strength-label strength-${strength}`}
                  >
                    {strengthLabel()}
                  </span>
                </div>
              )}

              {isEncrypt && (
                <div className="password-input confirm-input">
                  <KeyRound size={18} />

                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) =>
                      setConfirmPassword(e.target.value)
                    }
                  />

                  <button
                    onClick={() =>
                      setShowConfirm(!showConfirm)
                    }
                    type="button"
                  >
                    {showConfirm ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* ACTION */}
            <button
              className={`action-button ${
                isEncrypt ? "encrypt" : "decrypt"
              }`}
              onClick={handleSubmit}
              disabled={processing}
            >
              {processing ? (
                <>
                  <span className="spinner" />
                  Processing...
                </>
              ) : (
                <>
                  {isEncrypt ? (
                    <Lock size={19} />
                  ) : (
                    <Unlock size={19} />
                  )}

                  {isEncrypt
                    ? "Encrypt PDF"
                    : "Decrypt PDF"}

                  <ArrowRight size={19} />
                </>
              )}
            </button>

            {/* MESSAGE */}
            {message && (
              <div className={`message ${messageType}`}>
                {messageType === "success" ? (
                  <CheckCircle2 size={19} />
                ) : (
                  <AlertCircle size={19} />
                )}

                <span>{message}</span>

                {messageType === "success" && (
                  <Download
                    size={17}
                    className="message-download"
                  />
                )}
              </div>
            )}

            <div className="privacy-note">
              <ShieldCheck size={16} />
              <span>
                Your files are processed locally in your browser.
              </span>
            </div>
          </div>
        </section>

        {/* SECURITY FEATURES */}
        <section className="security-features">
          <div className="feature">
            <div className="feature-icon">
              <Lock size={20} />
            </div>

            <div>
              <strong>AES-256-GCM</strong>
              <span>Authenticated encryption</span>
            </div>
          </div>

          <div className="feature">
            <div className="feature-icon">
              <KeyRound size={20} />
            </div>

            <div>
              <strong>PBKDF2</strong>
              <span>Password-based key derivation</span>
            </div>
          </div>

          <div className="feature">
            <div className="feature-icon">
              <ShieldCheck size={20} />
            </div>

            <div>
              <strong>Private by design</strong>
              <span>No PDF upload required</span>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <span>© 2026 SecurePDF</span>
        <span>Private • Secure • Local</span>
      </footer>
    </div>
  );
}

export default App;