import React, { useState, useEffect } from 'react'
import { 
  RefreshCcw, MapPin, ChevronLeft, Search, Calendar, User, 
  ExternalLink, Ruler, Image as ImageIcon, X, Maximize2, Layers, 
  AlertTriangle, CheckCircle2, Trash2, Edit3, Loader 
} from 'lucide-react'
import { Preferences } from '@capacitor/preferences'
import { apiFetch } from '../lib/apiFetch'
import './LogScreen.css'

export interface Report {
  id: number;
  folio: string;
  contractid?: string;
  contractId?: string;
  empresaname?: string;
  empresaName?: string;
  locationdesc?: string;
  locationDesc?: string;
  delegacion: string;
  colonia: string;
  lat?: number;
  lng?: number;
  largo?: number;
  ancho?: number;
  profundidad?: number;
  m2?: number;
  tipoBache?: string;
  tipobache?: string;
  status: string;
  created_at: string;
  created_by?: string;
  updated_by?: string;
  photoUrl?: string;
  photourl?: string;
  photoCaja?: string;
  photocaja?: string;
  photoFinal?: string;
  photofinal?: string;
  calle_1?: string;
  calle1?: string;
  calle_2?: string;
  calle2?: string;
  isOffline?: boolean;
}

export interface CorrectionRequest {
  id: string;
  folio: string;
  requestedBy: string;
  requestedAt: string;
  status: string;
  originalData: any;
  proposedData: any;
  reason?: string;
}

interface LogScreenProps {
  userProfile?: any;
  initialFilter?: 'ALL' | 'TERMINADO' | 'EN PROCESO' | 'DETECTADO' | 'CORRECCION';
  onFilterHandled?: () => void;
  onCorrectionsChanged?: () => void;
}

/**
 * Transforms Google Drive webViewLink or Drive file IDs into direct image URLs
 * accessible by HTML <img> tags without CORS blocks.
 */
function formatDriveImageUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  const url = String(rawUrl).trim();
  if (!url) return null;

  if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('indexeddb://')) {
    return url;
  }

  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return url;
}

export default function LogScreen({ 
  userProfile, 
  initialFilter, 
  onFilterHandled, 
  onCorrectionsChanged 
}: LogScreenProps) {
  const [reports, setReports] = useState<Report[]>([])
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TERMINADO' | 'EN PROCESO' | 'DETECTADO' | 'CORRECCION'>('ALL')

  const isAdmin = userProfile?.email?.toLowerCase() === 'juanpablobumblebee@gmail.com';

  useEffect(() => {
    if (initialFilter) {
      setStatusFilter(initialFilter);
      onFilterHandled?.();
    }
  }, [initialFilter]);

  const fetchReportsAndCorrections = async () => {
    setLoading(true)
    try {
      // 1. Fetch Reports
      let apiReports: Report[] = []
      try {
        const response = await apiFetch('/api/reports')
        if (response.ok) {
          const json = await response.json()
          apiReports = Array.isArray(json) ? json : []
          await Preferences.set({ key: 'cached_reports_list', value: JSON.stringify(apiReports) })
        }
      } catch {
        console.warn('[OFFLINE] Cargando reportes guardados en caché local.')
        const { value } = await Preferences.get({ key: 'cached_reports_list' })
        if (value) {
          try {
            apiReports = JSON.parse(value)
          } catch {
            apiReports = []
          }
        }
      }
      setReports(apiReports)

      // 2. Fetch Corrections
      try {
        const corrRes = await apiFetch('/api/corrections')
        if (corrRes.ok) {
          const corrJson = await corrRes.json()
          setCorrections(Array.isArray(corrJson) ? corrJson : [])
        }
      } catch (e) {
        console.warn('[CORRECTIONS] Error cargando correcciones:', e)
      }
    } catch {
      console.error('[SYNC ERROR] No se pudieron cargar los datos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReportsAndCorrections()
  }, [])

  // Filtered reports calculation
  const filteredReports = reports.filter(r => {
    const rFolio = String(r.folio || '').trim();
    const hasCorrection = corrections.some(c => String(c.folio).trim() === rFolio);

    if (statusFilter === 'CORRECCION') {
      if (!hasCorrection) return false;
    } else if (statusFilter !== 'ALL') {
      if (r.status !== statusFilter) return false;
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      const folioMatch = (r.folio || '').toLowerCase().includes(q);
      const calleMatch = (r.locationdesc || r.locationDesc || r.calle_1 || r.calle1 || '').toLowerCase().includes(q);
      const coloniaMatch = (r.colonia || '').toLowerCase().includes(q);
      const delegacionMatch = (r.delegacion || '').toLowerCase().includes(q);
      return folioMatch || calleMatch || coloniaMatch || delegacionMatch;
    }

    return true;
  });

  return (
    <div className="log-screen-wrapper">
      {selectedReport ? (
        <DossierView 
          key={`dossier-${selectedReport.folio}`}
          report={selectedReport}
          corrections={corrections}
          isAdmin={isAdmin}
          onBack={() => setSelectedReport(null)}
          onReportUpdated={(updated) => {
            setSelectedReport(updated);
            fetchReportsAndCorrections();
            onCorrectionsChanged?.();
          }}
          onRefreshNeeded={() => {
            fetchReportsAndCorrections();
            onCorrectionsChanged?.();
          }}
        />
      ) : (
        <ListView 
          key="list-view"
          reports={filteredReports}
          totalCount={reports.length}
          corrections={corrections}
          loading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onSelectReport={(r) => setSelectedReport(r)}
          onRefresh={fetchReportsAndCorrections}
        />
      )}
    </div>
  )
}

// -------------------------------------------------------------
// DOSSIER DETAIL VIEW COMPONENT
// -------------------------------------------------------------
function DossierView({
  report,
  corrections,
  isAdmin,
  onBack,
  onReportUpdated,
  onRefreshNeeded
}: {
  report: Report;
  corrections: CorrectionRequest[];
  isAdmin: boolean;
  onBack: () => void;
  onReportUpdated: (updated: Report) => void;
  onRefreshNeeded: () => void;
}) {
  const [activePhotoTab, setActivePhotoTab] = useState<'inicial' | 'caja' | 'final'>('inicial');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Correction Modal Form State
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({
    locationDesc: false,
    calle1: false,
    calle2: false,
    delegacion: false,
    colonia: false,
    largo: false,
    ancho: false,
    profundidad: false
  });
  const [correctionForm, setCorrectionForm] = useState<Record<string, any>>({});
  const [correctionReason, setCorrectionReason] = useState('');

  const photoInicial = formatDriveImageUrl(report.photourl || report.photoUrl);
  const photoCaja = formatDriveImageUrl(report.photocaja || report.photoCaja);
  const photoFinal = formatDriveImageUrl(report.photofinal || report.photoFinal);

  const activePhotoUrl = activePhotoTab === 'inicial' ? photoInicial : (activePhotoTab === 'caja' ? photoCaja : photoFinal);

  const lat = report.lat || 0;
  const lng = report.lng || 0;
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  const activeCorrection = corrections.find(
    c => String(c.folio).trim() === String(report.folio).trim()
  );
  const prop = activeCorrection?.proposedData || {};

  const openCorrectionModal = () => {
    setCorrectionForm({
      locationDesc: report.locationdesc || report.locationDesc || '',
      calle1: report.calle_1 || report.calle1 || '',
      calle2: report.calle_2 || report.calle2 || '',
      delegacion: report.delegacion || 'TOLUCA',
      colonia: report.colonia || 'CENTRO',
      largo: report.largo || '',
      ancho: report.ancho || '',
      profundidad: report.profundidad || ''
    });
    setSelectedFields({
      locationDesc: false,
      calle1: false,
      calle2: false,
      delegacion: false,
      colonia: false,
      largo: false,
      ancho: false,
      profundidad: false
    });
    setCorrectionReason('');
    setShowCorrectionModal(true);
  };

  const handleSubmitCorrection = async () => {
    const proposedData: Record<string, any> = {};
    const originalData: Record<string, any> = {};

    Object.keys(selectedFields).forEach(k => {
      if (selectedFields[k]) {
        proposedData[k] = correctionForm[k];
        originalData[k] = (report as any)[k] || '';
      }
    });

    if (Object.keys(proposedData).length === 0) {
      alert('Por favor selecciona al menos un campo para corregir.');
      return;
    }

    if (proposedData.profundidad !== undefined) {
      const profNum = parseFloat(proposedData.profundidad) || 0;
      proposedData.tipoBache = profNum > 0.07 ? 'PROFUNDO' : 'SUPERFICIAL';
    }

    setIsActionLoading(true);
    try {
      const res = await apiFetch('/api/corrections', {
        method: 'POST',
        body: JSON.stringify({
          folio: report.folio,
          originalData,
          proposedData,
          reason: correctionReason
        })
      });

      if (res.ok) {
        alert('✅ Solicitud de corrección enviada. El administrador revisará los cambios.');
        setShowCorrectionModal(false);
        onRefreshNeeded();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Error: ${err.error || 'No se pudo enviar la solicitud'}`);
      }
    } catch (e: any) {
      alert(`Error de red: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApproveCorrection = async (correctionId: string) => {
    setIsActionLoading(true);
    try {
      const res = await apiFetch(`/api/corrections/${correctionId}/approve`, {
        method: 'POST'
      });

      if (res.ok) {
        alert('✅ ¡Corrección aprobada con éxito! Los datos se actualizaron en Google Sheets.');
        onReportUpdated({
          ...report,
          ...prop
        });
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Error al aprobar: ${err.error || 'Fallo del servidor'}`);
      }
    } catch (e: any) {
      alert(`Error de red: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDiscardCorrection = async (correctionId: string) => {
    setIsActionLoading(true);
    try {
      const res = await apiFetch(`/api/corrections/${correctionId}/discard`, {
        method: 'POST'
      });

      if (res.ok) {
        alert('Solicitud de corrección descartada sin alterar la base de datos.');
        setShowDiscardConfirm(false);
        onRefreshNeeded();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Error al descartar: ${err.error || 'Fallo del servidor'}`);
      }
    } catch (e: any) {
      alert(`Error de red: ${e.message}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="log-container dossier-view">
      {/* Back Button */}
      <button className="back-btn-nordic" onClick={onBack}>
        <ChevronLeft size={16} /> REGRESAR A BITÁCORA
      </button>

      {/* Pending Correction Alert Banner */}
      {activeCorrection && (
        <div style={{
          background: '#fffbeb',
          border: '2px solid #f59e0b',
          borderRadius: '16px',
          padding: '0.85rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.15)'
        }}>
          <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#b45309', textTransform: 'uppercase' }}>
                ⚠️ Solicitud de Corrección Pendiente
              </span>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#92400e' }}>
                Por: {activeCorrection.requestedBy}
              </span>
            </div>
            {activeCorrection.reason && (
              <p style={{ fontSize: '0.75rem', color: '#78350f', margin: '0.25rem 0 0 0', fontWeight: 600 }}>
                Motivo: "{activeCorrection.reason}"
              </p>
            )}
          </div>
        </div>
      )}

      {/* Dossier Card 1: Main Header Info */}
      <div className="dossier-card">
        <div className="dossier-header">
          <div>
            <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase block">EXPEDIENTE DIGITAL</span>
            <h2 className="dossier-folio">Folio {report.folio}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {activeCorrection && (
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 900,
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fcd34d',
                padding: '0.25rem 0.55rem',
                borderRadius: '9999px'
              }}>
                CORRECCIÓN
              </span>
            )}
            <span className={`status-tag ${report.status === 'DETECTADO' ? 'status-detected' : (report.status === 'EN PROCESO' ? 'status-process' : 'status-finished')}`}>
              {report.status}
            </span>
          </div>
        </div>

        <div className="dossier-meta">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-cyan-600" />
            <span>Capturado el {report.created_at || 'Fecha no disponible'}</span>
          </div>
          <div className="flex items-center gap-2">
            <User size={14} className="text-cyan-600" />
            <span>Responsable: {report.created_by || report.updated_by || 'Servicios Públicos'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-cyan-600" />
            <span>{report.empresaname || report.empresaName || 'Servicios Públicos Toluca'}</span>
          </div>
        </div>
      </div>

      {/* Dossier Card 2: Interactive Live Photo Gallery */}
      <div className="dossier-card">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
            <ImageIcon size={14} className="text-cyan-600" /> Registro Fotográfico en Vivo
          </h3>
        </div>

        {/* Phase Tabs */}
        <div className="gallery-tabs">
          <button 
            className={`gallery-tab ${activePhotoTab === 'inicial' ? 'active' : ''}`}
            onClick={() => setActivePhotoTab('inicial')}
          >
            1. Inicial {photoInicial ? '✅' : '⏳'}
          </button>
          <button 
            className={`gallery-tab ${activePhotoTab === 'caja' ? 'active' : ''}`}
            onClick={() => setActivePhotoTab('caja')}
          >
            2. Caja {photoCaja ? '✅' : '⏳'}
          </button>
          <button 
            className={`gallery-tab ${activePhotoTab === 'final' ? 'active' : ''}`}
            onClick={() => setActivePhotoTab('final')}
          >
            3. Final {photoFinal ? '✅' : '⏳'}
          </button>
        </div>

        {/* Image Display Container */}
        <div className="photo-preview-box">
          {activePhotoUrl ? (
            <>
              <img 
                src={activePhotoUrl} 
                alt={`Fase ${activePhotoTab}`} 
                className="photo-preview-img"
                onClick={() => setLightboxImage(activePhotoUrl)}
                onError={(e) => {
                  const target = e.currentTarget;
                  const fileIdMatch = activePhotoUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                  if (fileIdMatch && fileIdMatch[1]) {
                    target.src = `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w1000`;
                  }
                }}
              />
              <div className="photo-zoom-hint">
                <Maximize2 size={12} /> Toca para ampliar
              </div>
            </>
          ) : (
            <div className="no-photo-box">
              <ImageIcon size={32} opacity={0.3} />
              <span>Fotografía no registrada para fase {activePhotoTab.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Dossier Card 3: Technical Metrics */}
      <div className="dossier-card">
        <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
          <Ruler size={14} className="text-cyan-600" /> Cuantificación y Ficha Técnica
        </h3>

        {/* Diff Box if Measurements are proposed */}
        {(prop.largo !== undefined || prop.ancho !== undefined || prop.profundidad !== undefined) && (
          <div className="diff-blue-box">
            <div className="diff-blue-header">
              <span className="diff-blue-badge">NUEVAS MEDICIONES PROPUESTAS</span>
            </div>
            <div className="diff-blue-text">
              Largo: {prop.largo ?? report.largo} m | Ancho: {prop.ancho ?? report.ancho} m | Prof: {prop.profundidad ?? report.profundidad} m
            </div>
          </div>
        )}

        <div className="specs-grid">
          <div className="spec-item">
            <span className="spec-label">Largo</span>
            <span className="spec-val">{report.largo || '0'} m</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Ancho</span>
            <span className="spec-val">{report.ancho || '0'} m</span>
          </div>
          <div className="spec-item">
            <span className="spec-label">Profundidad</span>
            <span className="spec-val">{report.profundidad || '0'} m</span>
          </div>
          <div className="spec-item" style={{ background: 'rgba(2,132,199,0.06)' }}>
            <span className="spec-label" style={{ color: '#0284c7' }}>Área Total</span>
            <span className="spec-val highlight">{report.m2 || '0'} m²</span>
          </div>
        </div>

        {/* Diff Box if TipoBache is proposed */}
        {prop.tipoBache && (
          <div className="diff-blue-box mt-3">
            <div className="diff-blue-header">
              <span className="diff-blue-badge">NUEVA CLASIFICACIÓN TÉCNICA</span>
            </div>
            <div className="diff-blue-text">{prop.tipoBache}</div>
          </div>
        )}

        <div className="mt-3 flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Clasificación Técnica (Actual)</span>
          <span className="text-xs font-black text-cyan-600 uppercase">
            {(report.profundidad || 0) > 0.07 ? 'PROFUNDO' : (report.tipoBache || report.tipobache || 'SUPERFICIAL')}
          </span>
        </div>
      </div>

      {/* Dossier Card 4: Location & Maps */}
      <div className="dossier-card">
        <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
          <MapPin size={14} className="text-cyan-600" /> Ubicación y Georreferenciación
        </h3>

        {/* Diff Box for Delegacion/Colonia */}
        {(prop.delegacion || prop.colonia) && (
          <div className="diff-blue-box">
            <div className="diff-blue-header">
              <span className="diff-blue-badge">NUEVA ZONA PROPUESTA</span>
            </div>
            <div className="diff-blue-text">
              {prop.delegacion || report.delegacion} — {prop.colonia || report.colonia}
            </div>
          </div>
        )}

        {/* Diff Box for LocationDesc */}
        {prop.locationDesc && (
          <div className="diff-blue-box">
            <div className="diff-blue-header">
              <span className="diff-blue-badge">NUEVA CALLE PRINCIPAL</span>
            </div>
            <div className="diff-blue-text">{prop.locationDesc}</div>
          </div>
        )}

        {/* Diff Box for Entre Calles */}
        {(prop.calle1 || prop.calle2 || prop.calle_1 || prop.calle_2) && (
          <div className="diff-blue-box">
            <div className="diff-blue-header">
              <span className="diff-blue-badge">NUEVAS ENTRE CALLES</span>
            </div>
            <div className="diff-blue-text">
              {prop.calle1 || prop.calle_1 || report.calle_1 || ''} Y {prop.calle2 || prop.calle_2 || report.calle_2 || ''}
            </div>
          </div>
        )}

        {(() => {
          const c1 = report.calle_1 || report.calle1 || '';
          const c2 = report.calle_2 || report.calle2 || '';
          let entreCalles = '';
          if (c1 && c2) entreCalles = `${c1} Y ${c2}`;
          else if (c1) entreCalles = c1;
          else if (c2) entreCalles = c2;

          return (
            <div className="location-list">
              <div className="loc-item">
                <span className="loc-label">Delegación / Colonia</span>
                <span className="loc-val">{report.delegacion || 'TOLUCA'} — {report.colonia || 'CENTRO'}</span>
              </div>
              <div className="loc-item">
                <span className="loc-label">Calle Principal / Ubicación</span>
                <span className="loc-val">{report.locationdesc || report.locationDesc || 'No especificada'}</span>
              </div>
              {entreCalles && (
                <div className="loc-item">
                  <span className="loc-label">Entre Calles</span>
                  <span className="loc-val">{entreCalles}</span>
                </div>
              )}
              <div className="loc-item">
                <span className="loc-label">Coordenadas GPS</span>
                <span className="loc-val font-mono text-xs text-slate-500">{lat}, {lng}</span>
              </div>
            </div>
          );
        })()}

        {lat !== 0 && lng !== 0 && (
          <a 
            href={mapsUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="btn-maps-link"
          >
            <MapPin size={16} /> Abrir Ubicación en Google Maps <ExternalLink size={14} />
          </a>
        )}
      </div>

      {/* ADMIN ACTION CONTROLS */}
      {isAdmin && activeCorrection && (
        <div className="dossier-card" style={{ border: '2px solid #10b981', background: '#f0fdf4' }}>
          <h3 className="text-xs font-black uppercase text-emerald-800 tracking-wider flex items-center gap-2 mb-2">
            <CheckCircle2 size={16} className="text-emerald-600" /> Panel de Aprobación de Administrador
          </h3>
          <p className="text-xs text-emerald-700 font-medium mb-3">
            Revisa los datos azules propuestos arriba. Al aprobar, se actualizarán directamente en Google Sheets.
          </p>
          <div className="admin-correction-actions" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            <button 
              className="btn-approve-correction"
              onClick={() => handleApproveCorrection(activeCorrection.id)}
              disabled={isActionLoading}
            >
              {isActionLoading ? <Loader size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              APROBAR CAMBIOS EN BD
            </button>
            <button 
              className="btn-discard-correction"
              onClick={() => setShowDiscardConfirm(true)}
              disabled={isActionLoading}
              title="Descartar solicitud"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}

      {/* BUTTON TO REQUEST A NEW CORRECTION */}
      <button 
        className="btn-request-correction"
        onClick={openCorrectionModal}
      >
        <Edit3 size={14} /> SOLICITAR CORRECCIÓN / REPORTAR ERROR DE CAPTURA
      </button>

      {/* Modal: Solicitar Corrección */}
      {showCorrectionModal && (
        <div className="correction-modal-overlay" onClick={() => setShowCorrectionModal(false)}>
          <div className="correction-modal-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.62rem', fontWeight: 900, color: '#0284c7', textTransform: 'uppercase' }}>
                  FOLIO {report.folio}
                </span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#0f172a' }}>
                  Reportar Corrección de Datos
                </h3>
              </div>
              <button 
                onClick={() => setShowCorrectionModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.72rem', color: '#64748b', margin: '0 0 0.5rem 0', fontWeight: 600 }}>
              Selecciona qué dato(s) tienen error para ingresar la información correcta:
            </p>

            <div className="correction-chips-grid">
              {[
                { key: 'locationDesc', label: 'Calle Principal' },
                { key: 'calle1', label: 'Entre Calle 1' },
                { key: 'calle2', label: 'Entre Calle 2' },
                { key: 'delegacion', label: 'Delegación' },
                { key: 'colonia', label: 'Colonia' },
                { key: 'largo', label: 'Largo' },
                { key: 'ancho', label: 'Ancho' },
                { key: 'profundidad', label: 'Profundidad' }
              ].map(f => (
                <button
                  key={f.key}
                  type="button"
                  className={`correction-chip ${selectedFields[f.key] ? 'selected' : ''}`}
                  onClick={() => setSelectedFields(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                >
                  {selectedFields[f.key] ? '✓ ' : '+ '}{f.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: '0.5rem' }}>
              {selectedFields.locationDesc && (
                <div className="correction-input-group">
                  <label className="correction-input-label">Calle Principal / Ubicación Correcta</label>
                  <input 
                    className="correction-input-field" 
                    value={correctionForm.locationDesc || ''} 
                    onChange={e => setCorrectionForm(p => ({ ...p, locationDesc: e.target.value.toUpperCase() }))} 
                    placeholder="ESCRIBE LA CALLE CORRECTA..."
                  />
                </div>
              )}

              {selectedFields.calle1 && (
                <div className="correction-input-group">
                  <label className="correction-input-label">Entre Calle 1 Correcta</label>
                  <input 
                    className="correction-input-field" 
                    value={correctionForm.calle1 || ''} 
                    onChange={e => setCorrectionForm(p => ({ ...p, calle1: e.target.value.toUpperCase() }))} 
                    placeholder="CALLE 1..."
                  />
                </div>
              )}

              {selectedFields.calle2 && (
                <div className="correction-input-group">
                  <label className="correction-input-label">Entre Calle 2 Correcta</label>
                  <input 
                    className="correction-input-field" 
                    value={correctionForm.calle2 || ''} 
                    onChange={e => setCorrectionForm(p => ({ ...p, calle2: e.target.value.toUpperCase() }))} 
                    placeholder="CALLE 2..."
                  />
                </div>
              )}

              {selectedFields.delegacion && (
                <div className="correction-input-group">
                  <label className="correction-input-label">Delegación Correcta</label>
                  <input 
                    className="correction-input-field" 
                    value={correctionForm.delegacion || ''} 
                    onChange={e => setCorrectionForm(p => ({ ...p, delegacion: e.target.value.toUpperCase() }))} 
                  />
                </div>
              )}

              {selectedFields.colonia && (
                <div className="correction-input-group">
                  <label className="correction-input-label">Colonia Correcta</label>
                  <input 
                    className="correction-input-field" 
                    value={correctionForm.colonia || ''} 
                    onChange={e => setCorrectionForm(p => ({ ...p, colonia: e.target.value.toUpperCase() }))} 
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                {selectedFields.largo && (
                  <div className="correction-input-group">
                    <label className="correction-input-label">Largo (m)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="correction-input-field" 
                      value={correctionForm.largo || ''} 
                      onChange={e => setCorrectionForm(p => ({ ...p, largo: e.target.value }))} 
                    />
                  </div>
                )}
                {selectedFields.ancho && (
                  <div className="correction-input-group">
                    <label className="correction-input-label">Ancho (m)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="correction-input-field" 
                      value={correctionForm.ancho || ''} 
                      onChange={e => setCorrectionForm(p => ({ ...p, ancho: e.target.value }))} 
                    />
                  </div>
                )}
                {selectedFields.profundidad && (
                  <div className="correction-input-group">
                    <label className="correction-input-label">Prof. (m)</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      className="correction-input-field" 
                      value={correctionForm.profundidad || ''} 
                      onChange={e => setCorrectionForm(p => ({ ...p, profundidad: e.target.value }))} 
                    />
                  </div>
                )}
              </div>

              <div className="correction-input-group" style={{ marginTop: '0.5rem' }}>
                <label className="correction-input-label">Motivo o Razón del Cambio (Opcional)</label>
                <textarea 
                  className="correction-input-field" 
                  rows={2} 
                  value={correctionReason} 
                  onChange={e => setCorrectionReason(e.target.value)} 
                  placeholder="Ej. Error de dedo en nombre de calle..."
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button 
                type="button" 
                onClick={() => setShowCorrectionModal(false)}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  borderRadius: '12px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#64748b',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                onClick={handleSubmitCorrection}
                disabled={isActionLoading}
                style={{
                  flex: 2,
                  padding: '0.8rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#0284c7',
                  color: 'white',
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
                }}
              >
                {isActionLoading ? 'Enviando...' : 'ENVIAR CORRECCIÓN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmación de Descarte */}
      {showDiscardConfirm && activeCorrection && (
        <div className="correction-modal-overlay" onClick={() => setShowDiscardConfirm(false)}>
          <div className="correction-modal-card" style={{ maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: 900, color: '#0f172a' }}>
              ¿Descartar Solicitud?
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1.25rem 0' }}>
              Se eliminará la solicitud de cambio y la base de datos no será alterada.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => setShowDiscardConfirm(false)}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontWeight: 800, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleDiscardCorrection(activeCorrection.id)}
                disabled={isActionLoading}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '12px', border: 'none', background: '#ef4444', color: 'white', fontWeight: 900, cursor: 'pointer' }}
              >
                {isActionLoading ? 'Eliminando...' : 'Sí, Descartar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Fullscreen Modal */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <button className="lightbox-close" onClick={() => setLightboxImage(null)}>
            <X size={24} />
          </button>
          <img src={lightboxImage} alt="Vista ampliada" className="lightbox-img" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// LIST VIEW COMPONENT
// -------------------------------------------------------------
function ListView({
  reports,
  totalCount,
  corrections,
  loading,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  onSelectReport,
  onRefresh
}: {
  reports: Report[];
  totalCount: number;
  corrections: CorrectionRequest[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: 'ALL' | 'TERMINADO' | 'EN PROCESO' | 'DETECTADO' | 'CORRECCION';
  setStatusFilter: (s: 'ALL' | 'TERMINADO' | 'EN PROCESO' | 'DETECTADO' | 'CORRECCION') => void;
  onSelectReport: (r: Report) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="log-container animate-in">
      {/* Header */}
      <div className="log-header">
        <div>
          <h1 className="title-main">Bitácora</h1>
          <p className="subtitle-main">Consultor de Folios en Vivo</p>
        </div>
        <button 
          onClick={onRefresh} 
          className="p-2 bg-slate-100 text-cyan-600 rounded-xl hover:bg-slate-200 transition" 
          title="Actualizar datos"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Search & Filter Controls */}
      <div className="search-filter-box">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Buscar por folio, calle o colonia..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              className="absolute right-3 text-slate-400 hover:text-slate-600" 
              onClick={() => setSearchQuery('')}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="filter-pills">
          <button 
            className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            Todos ({totalCount})
          </button>
          <button 
            className={`filter-pill ${statusFilter === 'TERMINADO' ? 'active' : ''}`}
            onClick={() => setStatusFilter('TERMINADO')}
          >
            Terminados ({reports.filter(r => r.status === 'TERMINADO').length})
          </button>
          <button 
            className={`filter-pill ${statusFilter === 'EN PROCESO' ? 'active' : ''}`}
            onClick={() => setStatusFilter('EN PROCESO')}
          >
            En Proceso ({reports.filter(r => r.status === 'EN PROCESO').length})
          </button>
          <button 
            className={`filter-pill ${statusFilter === 'DETECTADO' ? 'active' : ''}`}
            onClick={() => setStatusFilter('DETECTADO')}
          >
            Detectados ({reports.filter(r => r.status === 'DETECTADO').length})
          </button>
          <button 
            className={`filter-pill ${statusFilter === 'CORRECCION' ? 'active' : ''}`}
            onClick={() => setStatusFilter('CORRECCION')}
            style={corrections.length > 0 ? { borderColor: '#f59e0b', color: statusFilter === 'CORRECCION' ? 'white' : '#b45309' } : {}}
          >
            ⚠️ Corrección ({corrections.length})
          </button>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 font-bold text-sm">
          Cargando expedientes...
        </div>
      ) : reports.length === 0 ? (
        <div className="py-12 px-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl text-center">
          <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">
            {searchQuery ? 'No se encontraron folios con el criterio de búsqueda' : 'No hay expedientes en esta categoría'}
          </p>
        </div>
      ) : (
        <div className="log-list">
          {reports.map((report) => {
            const photoInicial = formatDriveImageUrl(report.photourl || report.photoUrl);
            const photoCaja = formatDriveImageUrl(report.photocaja || report.photoCaja);
            const photoFinal = formatDriveImageUrl(report.photofinal || report.photoFinal);
            const hasPendingCorr = corrections.some(c => String(c.folio).trim() === String(report.folio).trim());

            return (
              <div 
                key={`card-${report.folio}`} 
                className="report-card"
                onClick={() => onSelectReport(report)}
                style={hasPendingCorr ? { border: '1.5px solid #fcd34d', background: '#fffef9' } : {}}
              >
                <div className="card-top">
                  <div>
                    <span className="folio-tag">Folio {report.folio}</span>
                    <p className="text-[10px] font-bold text-slate-400">
                      {report.created_at ? report.created_at.split(',')[0] : 'Fecha rec.'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {hasPendingCorr && (
                      <span style={{
                        fontSize: '0.58rem',
                        fontWeight: 900,
                        background: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fcd34d',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '9999px'
                      }}>
                        ⚠️ CORRECCIÓN
                      </span>
                    )}
                    <span className={`status-tag ${report.status === 'DETECTADO' ? 'status-detected' : (report.status === 'EN PROCESO' ? 'status-process' : 'status-finished')}`}>
                      {report.status}
                    </span>
                  </div>
                </div>

                <div className="card-body">
                  <div className="location-snippet">
                    <MapPin size={14} className="text-cyan-600 flex-shrink-0" />
                    <span className="truncate">{report.locationdesc || report.locationDesc || report.calle_1 || 'Ubicación sin referencia'}</span>
                  </div>

                  <div className="zone-chips">
                    <span className="chip">{report.delegacion || 'TOLUCA'}</span>
                    <span className="chip">{report.colonia || 'CENTRO'}</span>
                  </div>

                  <div className="card-footer-info">
                    <span className="m2-badge">{report.m2 || '0'} m²</span>
                    <div className="photo-dots">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Fotos:</span>
                      <span className={`photo-dot ${photoInicial ? 'active' : ''}`} title="Inicial" />
                      <span className={`photo-dot ${photoCaja ? 'active' : ''}`} title="Caja" />
                      <span className={`photo-dot ${photoFinal ? 'active' : ''}`} title="Final" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  );
}
