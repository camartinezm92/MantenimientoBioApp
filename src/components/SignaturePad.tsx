import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
  label: string;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, label }) => {
  const sigCanvas = useRef<SignatureCanvas>(null);

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const save = () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;
    try {
      // Use getTrimmedCanvas if available, fallback to getCanvas
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
    <div className="flex flex-col gap-2 border border-gray-300 p-2 bg-white">
      <label className="text-xs font-bold uppercase text-gray-600">{label}</label>
      <div className="border border-dashed border-gray-400 bg-gray-50">
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{
            width: 300,
            height: 100,
            className: 'signature-canvas w-full'
          }}
        />
      </div>
      <div className="flex gap-2 justify-end mt-1">
        <button
          type="button"
          onClick={clear}
          className="text-[10px] px-2 py-1 border border-gray-300 hover:bg-gray-100 uppercase font-bold"
        >
          Limpiar
        </button>
        <button
          type="button"
          onClick={save}
          className="text-[10px] px-2 py-1 bg-black text-white hover:bg-gray-800 uppercase font-bold"
        >
          Guardar Firma
        </button>
      </div>
    </div>
  );
};
