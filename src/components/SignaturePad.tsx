import React, { useRef, useEffect, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  label: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, label }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 150 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth } = containerRef.current;
        // We set a fixed height or a ratio. 150px is usually good for signatures.
        setDimensions({ width: clientWidth, height: 150 });
      }
    };

    // Initial size
    updateDimensions();

    // Observe resizes
    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const save = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;
    try {
      const canvas = sigCanvas.current.getTrimmedCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    } catch (e) {
      console.error("Error trimming canvas, using full canvas:", e);
      const canvas = sigCanvas.current.getCanvas();
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  };

  return (
    <div className="flex flex-col gap-2 border border-gray-300 p-3 bg-white rounded-lg shadow-sm">
      <label className="text-xs font-bold uppercase text-gray-500 tracking-wider">{label}</label>
      <div ref={containerRef} className="border-2 border-dashed border-gray-200 bg-gray-50 rounded-md overflow-hidden touch-none">
        {dimensions.width > 0 && (
          <SignatureCanvas
            ref={sigCanvas}
            penColor="black"
            canvasProps={{
              width: dimensions.width,
              height: dimensions.height,
              className: 'signature-canvas'
            }}
          />
        )}
      </div>
      <div className="flex gap-2 justify-end mt-1">
        <button
          type="button"
          onClick={clear}
          className="text-[10px] px-3 py-1.5 border border-gray-300 hover:bg-gray-100 uppercase font-bold rounded transition-colors text-gray-600"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={save}
          className="text-[10px] px-3 py-1.5 bg-black text-white hover:bg-gray-800 uppercase font-bold rounded transition-colors shadow-sm"
        >
          Confirmar Firma
        </button>
      </div>
    </div>
  );
};
