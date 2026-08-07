import React, { useState, useEffect } from 'react'
import { RefreshCcw, MapPin, ChevronLeft, Search, Calendar, User, ExternalLink, Ruler, Image as ImageIcon, X, Maximize2, Layers } from 'lucide-react'
import { Preferences } from '@capacitor/preferences'
import { apiFetch } from '../lib/apiFetch'
import './LogScreen.css'

interface Report {
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

/**
 * Transforms Google Drive webViewLink or Drive file IDs into direct image URLs
 * accessible by HTML <img> tags without CORS or HTML webpage wrapper blocks.
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

export default function LogScreen({ userProfile }: { userProfile?: any }) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'TERMINADO' | 'EN PROCESO' | 'DETECTADO'>('ALL')
  
  // Dossier view states
  const [activePhotoTab, setActivePhotoTab] = useState<'inicial' | 'caja' | 'final'>('inicial')
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)

  const fetchReports = async () => {
    setLoading(true)
    try {
      let apiReports: Report[] = []
      try {
        const response = await apiFetch('/api/reports')
        if (response.ok) {
          const json = await response.json()
          apiReports = Array.isArray(json) ? json : []
          await Preferences.set({ key: 'cached_reports_list', value: JSON.stringify(apiReports) })
        }
      } catch (e) {
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
    } catch (err) {
      console.error('[SYNC ERROR] No se pudieron cargar los reportes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  // Filtered reports calculation
  const filteredReports = reports.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;

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

  // Photo URLs extractor with Drive URL Formatter
  const getPhotoForPhase = (report: Report, phase: 'inicial' | 'caja' | 'final'): string | null => {
    let raw: string | null = null;
    if (phase === 'inicial') raw = report.photourl || report.photoUrl || null;
    if (phase === 'caja') raw = report.photocaja || report.photoCaja || null;
    if (phase === 'final') raw = report.photofinal || report.photoFinal || null;
    return formatDriveImageUrl(raw);
  }

  // --- DOSSIER DETAIL VIEW ---
  if (selectedReport) {
    const photoInicial = getPhotoForPhase(selectedReport, 'inicial');
    const photoCaja = getPhotoForPhase(selectedReport, 'caja');
    const photoFinal = getPhotoForPhase(selectedReport, 'final');

    const activePhotoUrl = getPhotoForPhase(selectedReport, activePhotoTab);

    const lat = selectedReport.lat || 0;
    const lng = selectedReport.lng || 0;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    return (
      <div className="log-container dossier-view">
        {/* Back Button */}
        <button 
          className="back-btn-nordic" 
          onClick={() => setSelectedReport(null)}
        >
          <ChevronLeft size={16} /> REGRESAR A BITÁCORA
        </button>

        {/* Dossier Card 1: Main Header Info */}
        <div className="dossier-card">
          <div className="dossier-header">
            <div>
              <span className="text-[10px] font-black text-slate-400 tracking-wider uppercase block">EXPEDIENTE DIGITAL</span>
              <h2 className="dossier-folio">Folio {selectedReport.folio}</h2>
            </div>
            <span className={`status-tag ${selectedReport.status === 'DETECTADO' ? 'status-detected' : (selectedReport.status === 'EN PROCESO' ? 'status-process' : 'status-finished')}`}>
              {selectedReport.status}
            </span>
          </div>

          <div className="dossier-meta">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-cyan-600" />
              <span>Capturado el {selectedReport.created_at || 'Fecha no disponible'}</span>
            </div>
            <div className="flex items-center gap-2">
              <User size={14} className="text-cyan-600" />
              <span>Responsable: {selectedReport.created_by || selectedReport.updated_by || 'Servicios Públicos'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-cyan-600" />
              <span>{selectedReport.empresaname || selectedReport.empresaName || 'Servicios Públicos Toluca'}</span>
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
                    // Fallback to Google Drive thumbnail endpoint if CDN fails
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

          <div className="specs-grid">
            <div className="spec-item">
              <span className="spec-label">Largo</span>
              <span className="spec-val">{selectedReport.largo || '0'} m</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Ancho</span>
              <span className="spec-val">{selectedReport.ancho || '0'} m</span>
            </div>
            <div className="spec-item">
              <span className="spec-label">Profundidad</span>
              <span className="spec-val">{selectedReport.profundidad || '0'} m</span>
            </div>
            <div className="spec-item" style={{ background: 'rgba(2,132,199,0.06)' }}>
              <span className="spec-label" style={{ color: '#0284c7' }}>Área Total</span>
              <span className="spec-val highlight">{selectedReport.m2 || '0'} m²</span>
            </div>
          </div>

          <div className="mt-3 flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Clasificación Técnica</span>
            <span className="text-xs font-black text-cyan-600 uppercase">
              {(selectedReport.profundidad || 0) > 0.07 ? 'PROFUNDO' : (selectedReport.tipoBache || selectedReport.tipobache || 'SUPERFICIAL')}
            </span>
          </div>
        </div>

        {/* Dossier Card 4: Location & Maps */}
        <div className="dossier-card">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
            <MapPin size={14} className="text-cyan-600" /> Ubicación y Georreferenciación
          </h3>

          {(() => {
            const c1 = selectedReport.calle_1 || selectedReport.calle1 || '';
            const c2 = selectedReport.calle_2 || selectedReport.calle2 || '';
            let entreCalles = '';
            if (c1 && c2) entreCalles = `${c1} Y ${c2}`;
            else if (c1) entreCalles = c1;
            else if (c2) entreCalles = c2;

            return (
              <div className="location-list">
                <div className="loc-item">
                  <span className="loc-label">Delegación / Colonia</span>
                  <span className="loc-val">{selectedReport.delegacion || 'TOLUCA'} — {selectedReport.colonia || 'CENTRO'}</span>
                </div>
                <div className="loc-item">
                  <span className="loc-label">Calle Principal / Ubicación</span>
                  <span className="loc-val">{selectedReport.locationdesc || selectedReport.locationDesc || 'No especificada'}</span>
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
    )
  }

  // --- MAIN CONSULTOR LIST VIEW ---
  return (
    <div className="log-container animate-in">
      {/* Header */}
      <div className="log-header">
        <div>
          <h1 className="title-main">Bitácora</h1>
          <p className="subtitle-main">Consultor de Folios en Vivo</p>
        </div>
        <button 
          onClick={fetchReports} 
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
            Todos ({reports.length})
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
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 font-bold text-sm">
          Cargando expedientes...
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="py-12 px-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl text-center">
          <p className="text-slate-400 font-bold text-xs uppercase tracking-wider">
            {searchQuery ? 'No se encontraron folios con el criterio de búsqueda' : 'No hay expedientes registrados'}
          </p>
        </div>
      ) : (
        <div className="log-list">
          {filteredReports.map((report) => {
            const photoInicial = getPhotoForPhase(report, 'inicial');
            const photoCaja = getPhotoForPhase(report, 'caja');
            const photoFinal = getPhotoForPhase(report, 'final');

            return (
              <div 
                key={report.folio} 
                className="report-card"
                onClick={() => setSelectedReport(report)}
              >
                <div className="card-top">
                  <div>
                    <span className="folio-tag">Folio {report.folio}</span>
                    <p className="text-[10px] font-bold text-slate-400">
                      {report.created_at ? report.created_at.split(',')[0] : 'Fecha rec.'}
                    </p>
                  </div>
                  <span className={`status-tag ${report.status === 'DETECTADO' ? 'status-detected' : (report.status === 'EN PROCESO' ? 'status-process' : 'status-finished')}`}>
                    {report.status}
                  </span>
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
  )
}
