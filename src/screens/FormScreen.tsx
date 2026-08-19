import React, { useState, useRef, useEffect } from 'react'
import { MapPin, CheckCircle, Upload, Trash2, Loader, Compass } from 'lucide-react'
import { apiFetch } from '../lib/apiFetch'
import { compressImage } from '../lib/imageUtils'
import SuccessModal from '../components/SuccessModal'
import './FormScreen.css'

type PhotoType = 'inicial' | 'caja' | 'final';

export default function FormScreen({ userProfile }: { userProfile: any }) {
  const [formData, setFormData] = useState({
    coordsInput: '',
    locationDesc: '',
    calle1: '',
    calle2: '',
    delegacion: '---',
    colonia: '---',
    lat: 0,
    lng: 0,
    tipoBache: 'SUPERFICIAL',
    largo: '',
    ancho: '',
    profundidad: ''
  })

  // Photos State
  const [photos, setPhotos] = useState<{
    inicial: { file: File | null; preview: string | null };
    caja: { file: File | null; preview: string | null };
    final: { file: File | null; preview: string | null };
  }>({
    inicial: { file: null, preview: null },
    caja: { file: null, preview: null },
    final: { file: null, preview: null }
  })

  const [dragOver, setDragOver] = useState<Record<PhotoType, boolean>>({
    inicial: false,
    caja: false,
    final: false
  })

  const [lastRegisteredFolio, setLastRegisteredFolio] = useState<string>('');
  const [autoFolio, setAutoFolio] = useState<string>('5000001');
  const [isLoadingNextFolio, setIsLoadingNextFolio] = useState<boolean>(true);

  const [isUploading, setIsUploading] = useState(false)
  const [isRadarLoading, setIsRadarLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const fetchNextFolio = async () => {
    setIsLoadingNextFolio(true);
    try {
      const res = await apiFetch('/api/reports/next-folio');
      if (res.ok) {
        const data = await res.json();
        if (data.nextFolio) {
          setAutoFolio(data.nextFolio);
        }
      }
    } catch (err) {
      console.warn('[FOLIO AUTO] No se pudo obtener siguiente folio:', err);
    } finally {
      setIsLoadingNextFolio(false);
    }
  };

  useEffect(() => {
    fetchNextFolio();
  }, []);

  const fileInputRefInicial = useRef<HTMLInputElement>(null)
  const fileInputRefCaja = useRef<HTMLInputElement>(null)
  const fileInputRefFinal = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    let { name, value } = e.target
    if (['locationDesc', 'calle1', 'calle2'].includes(name)) {
      value = value.toUpperCase()
    }
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Coordenadas autoprocesadas al escribir o pegar
  const handleCoordsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    setFormData(prev => ({ ...prev, coordsInput: rawVal }));

    // Detect lat, lng pattern (e.g., 19.2925, -99.6569)
    const match = rawVal.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        processRadarCoords(lat, lng);
      }
    }
  }

  const processRadarCoords = async (latitude: number, longitude: number) => {
    setIsRadarLoading(true);
    try {
      const response = await apiFetch('/api/radar', {
        method: 'POST',
        body: JSON.stringify({ lat: latitude, lng: longitude })
      });
      const data = await response.json();
      if (response.ok) {
        setFormData(prev => ({
          ...prev,
          delegacion: data.delegacion || 'TOLUCA',
          colonia: data.name || '---',
          lat: latitude,
          lng: longitude
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          lat: latitude,
          lng: longitude
        }));
      }
    } catch (err) {
      console.error('Error al procesar radar:', err);
    } finally {
      setIsRadarLoading(false);
    }
  }

  const handleFileSelect = (type: PhotoType, file: File | null) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotos(prev => ({
      ...prev,
      [type]: { file, preview: previewUrl }
    }));
  }

  const handleDrop = (type: PhotoType, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: false }));
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFileSelect(type, file);
    }
  }

  const handleDragOver = (type: PhotoType, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: true }));
  }

  const handleDragLeave = (type: PhotoType, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(prev => ({ ...prev, [type]: false }));
  }

  const removePhoto = (type: PhotoType) => {
    setPhotos(prev => ({
      ...prev,
      [type]: { file: null, preview: null }
    }));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!photos.inicial.file && !photos.caja.file && !photos.final.file) {
      alert('Por favor selecciona al menos una fotografía.');
      return;
    }

    setIsUploading(true)
    const folioToSubmit = autoFolio;

    const submission = new FormData();
    submission.append('folio', folioToSubmit);
    submission.append('contractId', 'SP-TOLUCA');
    submission.append('empresaName', 'Servicios Públicos Toluca');
    submission.append('lat', formData.lat.toString());
    submission.append('lng', formData.lng.toString());
    submission.append('locationDesc', formData.locationDesc);
    submission.append('calle1', formData.calle1);
    submission.append('calle2', formData.calle2);
    submission.append('delegacion', formData.delegacion);
    submission.append('colonia', formData.colonia);
    
    const profNum = parseFloat(formData.profundidad) || 0;
    const calculatedTipoBache = profNum > 0.07 ? 'PROFUNDO' : 'SUPERFICIAL';
    submission.append('tipoBache', calculatedTipoBache);
    
    if (formData.largo) submission.append('largo', formData.largo);
    if (formData.ancho) submission.append('ancho', formData.ancho);
    if (formData.profundidad) submission.append('profundidad', formData.profundidad);

    const m2 = (parseFloat(formData.largo) || 0) * (parseFloat(formData.ancho) || 0);
    if (m2 > 0) submission.append('m2', m2.toString());

    // Attach photos
    if (photos.inicial.file) {
      const compressed = await compressImage(photos.inicial.file);
      submission.append('photoInicial', compressed, 'inicial.jpg');
    }
    if (photos.caja.file) {
      const compressed = await compressImage(photos.caja.file);
      submission.append('photoCaja', compressed, 'caja.jpg');
    }
    if (photos.final.file) {
      const compressed = await compressImage(photos.final.file);
      submission.append('photoFinal', compressed, 'final.jpg');
    }

    try {
      const response = await apiFetch('/api/reports', {
        method: 'POST',
        body: submission,
      });

      if (response.ok) {
        const json = await response.json().catch(() => ({}));
        const registered = json.folio || folioToSubmit;
        setLastRegisteredFolio(registered);
        setShowSuccessModal(true);
        resetForm();
        fetchNextFolio();
      } else {
        const errJson = await response.json().catch(() => ({}));
        alert(`Error al guardar: ${errJson.error || 'Fallo del servidor'}`);
      }
    } catch (err: any) {
      alert(`Error de red: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }

  const resetForm = () => {
    setPhotos({
      inicial: { file: null, preview: null },
      caja: { file: null, preview: null },
      final: { file: null, preview: null }
    });
    setFormData({ 
      coordsInput: '',
      locationDesc: '', 
      calle1: '', 
      calle2: '',
      largo: '',
      ancho: '',
      profundidad: '',
      delegacion: '---',
      colonia: '---',
      lat: 0,
      lng: 0,
      tipoBache: 'SUPERFICIAL'
    });
  }

  return (
    <div className="form-container animate-in">
      <div className="form-header">
        <h1 className="text-2xl font-black">SP REGIS - Captura de Oficina</h1>
        <p className="text-xs text-slate-400">Dirección General de Servicios Públicos de Toluca</p>
      </div>

      {showSuccessModal && (
        <SuccessModal 
          onClose={() => setShowSuccessModal(false)} 
          subtitle={`Folio ${lastRegisteredFolio || '50' + folioSuffix} registrado en Google Sheets y Drive correctamente`}
        />
      )}

      <form onSubmit={handleSubmit}>
        {/* 1. BARRA DE COORDENADAS Y AUTODETECCIÓN DE ZONA */}
        <div className="input-group">
          <label className="field-label">Coordenadas de Geolocalización (Ej: 19.2925, -99.6569)*</label>
          <div className="relative flex items-center">
            <input 
              name="coordsInput"
              className="input-main pl-10"
              placeholder="PEGA O ESCRIBE LAS COORDENADAS (LAT, LNG)..."
              value={formData.coordsInput}
              onChange={handleCoordsChange}
              required
            />
            {isRadarLoading && (
              <span className="absolute right-3 text-cyan-400">
                <Loader size={16} className="spin-icon" />
              </span>
            )}
          </div>
        </div>

        <div className="readonly-grid mb-4">
          <div className="readonly-box">
            <span className="field-label">Delegación (Auto-detectada)</span>
            <div className="field-value text-cyan-400">{formData.delegacion}</div>
          </div>
          <div className="readonly-box">
            <span className="field-label">UT / Colonia (Auto-detectada)</span>
            <div className="field-value text-cyan-400">{formData.colonia}</div>
          </div>
        </div>

        {/* 2. FOLIO AUTOGENERADO AUTOMÁTICO */}
        <div className="input-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <label className="field-label" style={{ marginBottom: 0 }}>Folio del Bache (Autogenerado Consecutivo)*</label>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#0891b2', background: '#ecfeff', padding: '0.2rem 0.5rem', borderRadius: '9999px', border: '1px solid #cffafe' }}>
              🔒 AUTO-ASIGNADO
            </span>
          </div>
          <div className="folio-input-row" style={{ opacity: 0.95 }}>
            <span className="folio-prefix">50</span>
            <div className="folio-suffix-locked">
              {isLoadingNextFolio ? '...' : autoFolio.slice(2)}
            </div>
          </div>
        </div>

        {/* 3. CALLE Y CRUCES */}
        <div className="input-group mt-3">
          <label className="field-label">Calle del Bache* (MAYÚSCULAS)</label>
          <input 
            name="locationDesc"
            className="input-main"
            placeholder="NOMBRE DE LA CALLE..."
            value={formData.locationDesc}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="input-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          <div className="input-group">
            <label className="field-label">Entre Calle 1*</label>
            <input 
              name="calle1"
              className="input-main"
              placeholder="CALLE 1..."
              value={formData.calle1}
              onChange={handleInputChange}
              required
            />
          </div>
          <div className="input-group">
            <label className="field-label">Entre Calle 2*</label>
            <input 
              name="calle2"
              className="input-main"
              placeholder="CALLE 2..."
              value={formData.calle2}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        {/* 4. MEDICIONES OPCIONALES */}
        <div className="measurements-section mt-4 mb-6 p-3 bg-slate-900 border border-slate-800 rounded-xl">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2">Mediciones Técnicas (Opcional)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label className="field-label">Largo (m)</label>
              <input 
                name="largo" 
                type="number" 
                step="0.01" 
                className="input-main" 
                placeholder="0.00" 
                value={formData.largo} 
                onChange={handleInputChange} 
              />
            </div>
            <div>
              <label className="field-label">Ancho (m)</label>
              <input 
                name="ancho" 
                type="number" 
                step="0.01" 
                className="input-main" 
                placeholder="0.00" 
                value={formData.ancho} 
                onChange={handleInputChange} 
              />
            </div>
            <div>
              <label className="field-label">Prof. (m)</label>
              <input 
                name="profundidad" 
                type="number" 
                step="0.01" 
                className="input-main" 
                placeholder="0.00" 
                value={formData.profundidad} 
                onChange={handleInputChange} 
              />
            </div>
          </div>
        </div>

        {/* 5. DRAG & DROP PHOTOS SECTION (ABOVO SUBMIT BUTTON FOR BETTER COHESION) */}
        <div className="photos-drop-section mb-6">
          <label className="field-label mb-2 block font-bold text-slate-700">Fotografías del Folio (Arrastra las imágenes desde tu PC o selecciona de tus archivos)*</label>
          <div className="dropzones-grid">
            <DropzoneCard 
              type="inicial"
              title="1. Foto Inicial (Detectado)"
              photo={photos.inicial}
              dragOver={dragOver.inicial}
              inputRef={fileInputRefInicial}
              onDrop={(e) => handleDrop('inicial', e)}
              onDragOver={(e) => handleDragOver('inicial', e)}
              onDragLeave={(e) => handleDragLeave('inicial', e)}
              onFileSelect={(f) => handleFileSelect('inicial', f)}
              onRemove={() => removePhoto('inicial')}
            />

            <DropzoneCard 
              type="caja"
              title="2. Foto de Caja (En Proceso)"
              photo={photos.caja}
              dragOver={dragOver.caja}
              inputRef={fileInputRefCaja}
              onDrop={(e) => handleDrop('caja', e)}
              onDragOver={(e) => handleDragOver('caja', e)}
              onDragLeave={(e) => handleDragLeave('caja', e)}
              onFileSelect={(f) => handleFileSelect('caja', f)}
              onRemove={() => removePhoto('caja')}
            />

            <DropzoneCard 
              type="final"
              title="3. Foto Final (Terminado)"
              photo={photos.final}
              dragOver={dragOver.final}
              inputRef={fileInputRefFinal}
              onDrop={(e) => handleDrop('final', e)}
              onDragOver={(e) => handleDragOver('final', e)}
              onDragLeave={(e) => handleDragLeave('final', e)}
              onFileSelect={(f) => handleFileSelect('final', f)}
              onRemove={() => removePhoto('final')}
            />
          </div>
        </div>

        {/* 6. BOTÓN DE ENVÍO QUE TOMA EL ANCHO TOTAL DEL CONTENEDOR */}
        <div className="form-footer-full mt-6">
          <button 
            type="submit" 
            className="btn-submit-full" 
            disabled={isUploading || isLoadingNextFolio || (!photos.inicial.file && !photos.caja.file && !photos.final.file)}
          >
            {isUploading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Loader size={16} className="spin-icon" />
                REGISTRANDO FOLIO EN SP REGIS...
              </span>
            ) : `REGISTRAR FOLIO ${autoFolio}`}
          </button>
        </div>
      </form>
    </div>
  )
}

interface DropzoneProps {
  type: PhotoType;
  title: string;
  photo: { file: File | null; preview: string | null };
  dragOver: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (f: File | null) => void;
  onRemove: () => void;
}

function DropzoneCard({
  title, photo, dragOver, inputRef, onDrop, onDragOver, onDragLeave, onFileSelect, onRemove
}: DropzoneProps) {
  return (
    <div 
      className={`dropzone-card ${dragOver ? 'dropzone-active' : ''} ${photo.preview ? 'dropzone-has-file' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => !photo.preview && inputRef.current?.click()}
    >
      <input 
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
      />

      {photo.preview ? (
        <div className="dropzone-preview-box">
          <img src={photo.preview} alt={title} className="dropzone-img" />
          <div className="dropzone-overlay">
            <span className="text-[10px] font-bold text-white uppercase">{title}</span>
            <button 
              type="button" 
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="btn-remove-photo"
              title="Eliminar foto"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="dropzone-empty flex flex-col items-center justify-center p-3 text-center cursor-pointer">
          <Upload size={24} className="text-cyan-400 mb-1" />
          <span className="text-xs font-bold text-slate-200">{title}</span>
          <span className="text-[10px] text-slate-400 mt-1">Arrastra aquí o haz clic</span>
        </div>
      )}
    </div>
  )
}
