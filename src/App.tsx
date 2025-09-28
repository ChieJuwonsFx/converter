import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { LoaderCircle, ImagePlus, CheckCircle2, AlertTriangle } from "lucide-react";

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState("webp");
  const [outputFilename, setOutputFilename] = useState<string>("");
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isRecaptchaReady, setIsRecaptchaReady] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const API_URL = `${import.meta.env.VITE_API_BASE_URL}/convert/`;

  useEffect(() => {
    if (!SITE_KEY) {
      setError("reCAPTCHA configuration missing");
      return;
    }

    const loadRecaptcha = () => {
      if (window.grecaptcha) {
        setIsRecaptchaReady(true);
        return;
      }

      console.log("Loading reCAPTCHA with site key:", SITE_KEY);
      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`;
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log("reCAPTCHA script loaded");
        const checkRecaptcha = () => {
          if (window.grecaptcha && window.grecaptcha.ready) {
            window.grecaptcha.ready(() => {
              console.log("reCAPTCHA is ready");
              setIsRecaptchaReady(true);
            });
          } else {
            setTimeout(checkRecaptcha, 100);
          }
        };
        checkRecaptcha();
      };

      script.onerror = (e) => {
        console.error("Failed to load reCAPTCHA script:", e);
        setError("Failed to load reCAPTCHA. Please refresh the page.");
      };

      document.head.appendChild(script);

      return () => {
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    };

    loadRecaptcha();
  }, [SITE_KEY]);

  if (!SITE_KEY) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-600 mb-2">Configuration Error</h2>
          <p className="text-gray-600">reCAPTCHA site key is missing. Please check your environment variables.</p>
        </div>
      </div>
    );
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
      setSuccessMsg(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setError("Pilih file gambar terlebih dahulu.");
      return;
    }

    if (!isRecaptchaReady) {
      setError("reCAPTCHA belum siap. Silakan tunggu sebentar dan coba lagi.");
      return;
    }

    setIsConverting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (!window.grecaptcha || !window.grecaptcha.execute) {
        throw new Error("reCAPTCHA tidak tersedia");
      }

      console.log("Executing reCAPTCHA...");
      const token = await window.grecaptcha.execute(SITE_KEY, { action: "submit" });
      
      if (!token) {
        throw new Error("reCAPTCHA token kosong");
      }

      console.log("reCAPTCHA token generated:", token ? "✓" : "✗");

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("target_format", targetFormat);
      formData.append("g-recaptcha-response", token);
      if (outputFilename) formData.append("output_filename", outputFilename);

      console.log("Sending request to:", API_URL);
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error:", response.status, errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `converted.${targetFormat}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (filenameMatch && filenameMatch.length > 1) {
          filename = filenameMatch[1].replace(/^"+|"+$/g, "").trim();
        }
      }

      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setSuccessMsg(`File berhasil dikonversi menjadi ${filename}`);
    } catch (err) {
      console.error("Conversion error:", err);
      if (err instanceof Error) {
        setError(`Error: ${err.message}`);
      } else {
        setError("Konversi gagal. Silakan coba lagi atau periksa koneksi internet Anda.");
      }
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="bg-gray-100 min-h-screen min-w-screen flex flex-col items-center justify-center font-sans text-gray-900 p-4">
      <div className="w-full max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-800">Image Converter</h1>
          <p className="text-gray-600 mt-3 text-lg">Konversi gambar ke berbagai format.</p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-lg border border-gray-200">
          {!isRecaptchaReady && (
            <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg flex items-center gap-2">
              <LoaderCircle className="h-5 w-5 text-yellow-600 animate-spin" />
              <span className="text-yellow-700">Loading reCAPTCHA...</span>
            </div>
          )}

          <div className="space-y-6">
            <div
              className="border-2 border-dashed border-gray-300 hover:border-indigo-500 transition-all duration-300 rounded-xl p-8 text-center cursor-pointer group"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              {!previewUrl ? (
                <>
                  <ImagePlus className="mx-auto h-12 w-12 text-gray-400 group-hover:text-indigo-500 transition-colors" strokeWidth={1.5} />
                  <p className="mt-2 text-gray-500 group-hover:text-indigo-600 transition-colors">
                    Klik atau jatuhkan file gambar di sini
                  </p>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-40 rounded-lg shadow-md mb-3 border border-gray-300"
                  />
                  <p className="text-sm font-medium text-gray-700 break-all">{selectedFile?.name}</p>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="format" className="block text-sm font-semibold text-gray-700 mb-2">
                Konversi ke format:
              </label>
              <select
                id="format"
                value={targetFormat}
                onChange={(e) => setTargetFormat(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              >
                <option value="webp">WebP</option>
                <option value="jpeg">JPEG</option>
                <option value="png">PNG</option>
                <option value="gif">GIF</option>
                <option value="ico">ICO (Icon)</option>
              </select>
            </div>

            <div>
              <label htmlFor="filename" className="block text-sm font-semibold text-gray-700 mb-2">
                Nama file baru (opsional)
              </label>
              <input
                type="text"
                id="filename"
                value={outputFilename}
                onChange={(e) => setOutputFilename(e.target.value)}
                placeholder={selectedFile ? selectedFile.name.split(".").slice(0, -1).join(".") : "hasil_konversi"}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg p-3 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={!selectedFile || isConverting || !isRecaptchaReady}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isConverting ? (
                <>
                  <LoaderCircle className="h-6 w-6 animate-spin" />
                  <span>Mengonversi...</span>
                </>
              ) : (
                "Konversi & Unduh"
              )}
            </button>

            {error && (
              <div className="flex items-center gap-2 text-red-700 bg-red-100 border border-red-300 p-3 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2 text-green-700 bg-green-100 border border-green-300 p-3 rounded-lg">
                <CheckCircle2 className="h-5 w-5" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>
        </div>

        <footer className="text-center mt-6 text-gray-500 text-sm">
          Created by <span className="font-semibold text-gray-600">InnoVixus</span>
        </footer>
      </div>
    </div>
  );
}

export default App;