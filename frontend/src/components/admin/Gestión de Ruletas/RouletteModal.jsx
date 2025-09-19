// src/components/admin/Gestión de Ruletas/RouletteModal.jsx
// ================================================================
// IMPORTS Y CONSTANTES
// ================================================================
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  X, Upload, ImageIcon, Trash2, Save, Calendar,
  AlertCircle, Info, Clock, FileText, Eye,
  AtSign, Hash, Flag
} from "lucide-react";

const MAX_MB = 5;
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_NAME_LENGTH = 200;

// ================================================================
// HELPERS DE FECHA
// ================================================================
const formatDateTimeLocal = (dateString) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const i = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}T${h}:${i}`;
  } catch {
    return "";
  }
};

const parseDateTimeLocal = (localStr) => {
  if (!localStr) return null;
  try { return new Date(localStr).toISOString(); } catch { return null; }
};

// Normalizador robusto para cualquier formato común del backend/inputs
const normalizeToDate = (val) => {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  const raw = String(val).trim();

  // "YYYY-MM-DD HH:mm[:ss]" -> con "T"
  const maybeLocal = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(raw)
    ? raw.replace(/\s+/, "T")
    : raw;

  const d = new Date(maybeLocal);
  if (!isNaN(d.getTime())) return d;

  const alt = new Date(maybeLocal.replace(/\//g, "-"));
  return isNaN(alt.getTime()) ? null : alt;
};

// ================================================================
// COUNTDOWN TIMER
// ================================================================
const CountdownTimer = ({ targetDate, label, className = "" }) => {
  const parsedTargetDate = useMemo(() => normalizeToDate(targetDate), [targetDate]);
  const [timeLeft, setTimeLeft] = useState({
    days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false, isActive: false
  });

  useEffect(() => {
    if (!parsedTargetDate) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false, isActive: false });
      return;
    }
    const tick = () => {
      const diff = parsedTargetDate.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, isActive: false });
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ days, hours, minutes, seconds, isExpired: false, isActive: true });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [parsedTargetDate]);

  if (!parsedTargetDate || (!timeLeft.isActive && !timeLeft.isExpired)) return null;

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <Clock className="h-4 w-4 text-blue-600" />
      <span className="text-sm font-medium text-gray-700">{label}:</span>
      {timeLeft.isExpired ? (
        <span className="text-sm font-bold text-red-600">Tiempo terminado</span>
      ) : (
        <div className="flex items-center space-x-1 text-sm font-mono">
          {timeLeft.days > 0 && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{timeLeft.days}d</span>}
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{String(timeLeft.hours).padStart(2,"0")}h</span>
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{String(timeLeft.minutes).padStart(2,"0")}m</span>
          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-bold">{String(timeLeft.seconds).padStart(2,"0")}s</span>
        </div>
      )}
    </div>
  );
};

// ================================================================
// EDITOR SIMPLE (con autolinks/@/# y vista previa)
// ================================================================
const SimpleTextEditor = React.memo(({ value, onChange, placeholder, disabled, maxLength, validationError, onValidationChange }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef(null);

  const processText = useCallback((text) => {
    if (!text || typeof text !== "string") return "";
    let s = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    const processed = [];
    const seen = (a,b)=>processed.some(r=>(a>=r[0]&&a<=r[1])||(b>=r[0]&&b<=r[1])||(a<=r[0]&&b>=r[1]));
    const mark=(a,b)=>processed.push([a,b]);

    const patterns = [
      { re:/\b(https?:\/\/[^\s<>"']+)/gi, to:(m)=>`<a href="${m.replace(/[.,;!?)\]}>]+$/,'')}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:no-underline font-medium bg-blue-50 px-1 rounded">${m}</a>` },
      { re:/\b(www\.[^\s<>"']+)/gi, to:(m)=>`<a href="https://${m.replace(/[.,;!?)\]}>]+$/,'')}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline hover:no-underline font-medium bg-blue-50 px-1 rounded">${m}</a>`, skip:(t,i)=>t.substring(Math.max(0,i-10),i).includes('href="') },
      { re:/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g, to:(m)=>`<a href="mailto:${m}" class="text-green-600 underline hover:no-underline font-medium bg-green-50 px-1 rounded">${m}</a>`, skip:(t,i)=>t.substring(Math.max(0,i-10),i).includes('href="') },
      { re:/\B@([a-zA-Z0-9_-]{1,30})\b/g, to:(m)=>`<span class="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-sm font-semibold border border-purple-200 inline-flex items-center"><span class="w-1.5 h-1.5 bg-purple-500 rounded-full mr-1"></span>${m}</span>` },
      { re:/\B#([a-zA-Z0-9_-]{1,30})\b/g, to:(m)=>`<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-semibold border border-green-200 inline-flex items-center"><span class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>${m}</span>` },
    ];

    patterns.forEach(p=>{
      p.re.lastIndex=0; let m;
      while((m=p.re.exec(s))!==null){
        const full=m[0], a=m.index, b=a+full.length;
        if ((p.skip && p.skip(s,a)) || seen(a,b)) continue;
        const rep=p.to(full); s=s.substring(0,a)+rep+s.substring(b); p.re.lastIndex=b+(rep.length-full.length); mark(a,a+rep.length);
      }
    });
    return s.replace(/\n/g,"<br/>");
  },[]);

  const handleChange = useCallback((e)=>{
    const nv=e.target.value;
    if (maxLength && nv.length>maxLength){ onValidationChange?.(true); return; }
    onValidationChange?.(false); onChange(nv);
  },[onChange,maxLength,onValidationChange]);

  const preview = useMemo(()=> value ? processText(value) : "", [value,processText]);

  const insertText = useCallback((t)=>{
    const ta=textareaRef.current; if(!ta) return;
    const {selectionStart:s, selectionEnd:e}=ta; const cur=value||"";
    const nv=cur.substring(0,s)+t+cur.substring(e); onChange(nv);
    setTimeout(()=>{ ta.focus(); ta.setSelectionRange(s+t.length,s+t.length); },0);
  },[value,onChange]);

  return (
    <div className={`bg-white rounded-lg border-2 transition-all ${isFocused?"border-blue-500 ring-4 ring-blue-100 shadow-lg":validationError?"border-red-300 ring-2 ring-red-100":"border-gray-300 hover:border-gray-400"}`}>
      <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-700 font-medium">
              <FileText className="h-4 w-4 mr-2 text-blue-600" /> Detección automática habilitada
            </div>
            <div className="flex items-center space-x-1">
              <button type="button" onClick={()=>insertText("@")} className="p-2 rounded-md hover:bg-blue-100 text-gray-600 hover:text-purple-700" title="Insertar @"><AtSign className="h-4 w-4"/></button>
              <button type="button" onClick={()=>insertText("#")} className="p-2 rounded-md hover:bg-green-100 text-gray-600 hover:text-green-700" title="Insertar #"><Hash className="h-4 w-4"/></button>
              <button type="button" onClick={()=>insertText("TODO: ")} className="p-2 rounded-md hover:bg-yellow-100 text-gray-600 hover:text-yellow-700" title="Insertar TODO"><Flag className="h-4 w-4"/></button>
            </div>
          </div>
          <button type="button" onClick={()=>setShowPreview(p=>!p)} className={`flex items-center text-sm px-3 py-1.5 rounded-md ${showPreview?"bg-blue-600 text-white shadow-md":"bg-white text-blue-600 border border-blue-200 hover:bg-blue-50"}`}>
            <Eye className="h-4 w-4 mr-1.5" /> {showPreview ? "Editor" : "Vista previa"}
          </button>
        </div>
      </div>

      {showPreview ? (
        <div className="p-6">
          <div className="flex items-center text-sm text-blue-700 mb-4 bg-blue-50 px-3 py-2 rounded-lg">
            <Eye className="h-4 w-4 mr-2" /> Vista previa con detección automática aplicada
          </div>
          <div className="min-h-[200px] p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 text-sm leading-relaxed"
               style={{lineHeight:"1.8"}}
               dangerouslySetInnerHTML={{__html: preview || '<span class="text-gray-400 italic">Escribe algo para ver la vista previa...</span>'}} />
        </div>
      ) : (
        <div className="p-6">
          <textarea
            ref={textareaRef}
            value={value || ""}
            onChange={handleChange}
            onFocus={()=>setIsFocused(true)}
            onBlur={()=>setIsFocused(false)}
            className={`w-full border-0 focus:ring-0 focus:outline-none resize-none min-h-[200px] ${validationError?"bg-red-50 text-red-800":"bg-transparent text-gray-800"}`}
            placeholder={placeholder}
            disabled={disabled}
            style={{fontFamily:'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace', fontSize:"14px", lineHeight:"1.6"}}
          />
        </div>
      )}

      <div className="border-t border-gray-100 px-6 py-3 bg-gray-50 rounded-b-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6 text-xs text-gray-600">
            <span className="flex items-center"><span className="w-2 h-2 bg-blue-500 rounded-full mr-1.5"></span>URLs y emails clicables</span>
            <span className="flex items-center"><span className="w-2 h-2 bg-purple-500 rounded-full mr-1.5"></span>@menciones destacadas</span>
            <span className="flex items-center"><span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>#hashtags resaltados</span>
          </div>
          {maxLength && (
            <span className={`text-xs ${(value?.length||0)>maxLength*0.9 ? "text-orange-600 font-medium":"text-gray-500"}`}>
              {value?.length||0}/{maxLength}
            </span>
          )}
        </div>
      </div>

      {validationError && (
        <div className="border-t border-red-200 bg-red-50 px-6 py-3 flex items-center">
          <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
          <span className="text-sm text-red-700 font-medium">Límite de caracteres excedido</span>
        </div>
      )}
    </div>
  );
});

// ================================================================
// HELPERS ARCHIVOS
// ================================================================
const getFileExtension = (name = "") =>
  name && name.includes(".") ? name.toLowerCase().slice(name.lastIndexOf(".")) : "";

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================
const RouletteModal = ({ isOpen, onClose, editing, setEditing, onSave, loading, error = null }) => {
  const fileRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [descriptionValidationError, setDescriptionValidationError] = useState(false);

  const defaultEditing = useMemo(()=>({
    id:null, name:"", description:"", status:"draft",
    cover_image:null, cover_preview:"", cover_url:"", cover_delete:false,
    participation_start:"", participation_end:"", scheduled_date:""
  }),[]);

  const currentEditing = editing || defaultEditing;

  const getDefaultDescription = useCallback(()=>(
``
  ),[]);

  // ---------- Validaciones ----------
  const getValidationErrors = useCallback(()=>{
    const errors = {};
    const nameTrim=(currentEditing.name||"").trim();
    if (!nameTrim) errors.name="El título es obligatorio";
    else if (nameTrim.length<3) errors.name="El título debe tener al menos 3 caracteres";
    else if (nameTrim.length>MAX_NAME_LENGTH) errors.name=`El título no puede exceder ${MAX_NAME_LENGTH} caracteres`;

    if (currentEditing.description && currentEditing.description.length>MAX_DESCRIPTION_LENGTH)
      errors.description=`La descripción no puede exceder ${MAX_DESCRIPTION_LENGTH.toLocaleString()} caracteres`;

    const now = new Date();
    const isEditing = !!currentEditing.id;

    const s = normalizeToDate(currentEditing.participation_start);
    const e = normalizeToDate(currentEditing.participation_end);
    const d = normalizeToDate(currentEditing.scheduled_date);

    if (s && e && s >= e) errors.participation_end = "La fecha de fin debe ser posterior al inicio";
    if (d && e && d <= e) errors.scheduled_date = "El sorteo debe ser después del fin de participación";

    if (!isEditing) {
      if (s && s <= now) errors.participation_start = "El inicio debe ser futuro para nuevas ruletas";
      if (d && d <= now) errors.scheduled_date = "La fecha de sorteo debe ser futura para nuevas ruletas";
    }
    return errors;
  },[currentEditing]);

  const isFormValid = useMemo(()=>{
    const errs=getValidationErrors(); const nameTrim=(currentEditing.name||"").trim();
    return nameTrim.length>=3 && nameTrim.length<=MAX_NAME_LENGTH && !descriptionValidationError && Object.keys(errs).length===0;
  },[currentEditing,descriptionValidationError,getValidationErrors]);

  // ---------- Inicialización ----------
  useEffect(()=>{
    if (!isOpen) { setValidationErrors({}); setDescriptionValidationError(false); return; }
    if (!currentEditing.id && !currentEditing.description && setEditing) {
      setEditing(prev=>({ ...defaultEditing, ...prev, description:getDefaultDescription() }));
    }
  },[isOpen,currentEditing.id,currentEditing.description,setEditing,defaultEditing,getDefaultDescription]);

  // ---------- Imagen ----------
  const onPickFile = useCallback(()=>fileRef.current?.click(),[]);
  const onFileChange = useCallback((e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    const ext=getFileExtension(file.name);
    if(!ALLOWED_EXTENSIONS.includes(ext)){ alert(`Formato no permitido: ${ext}`); e.target.value=""; return; }
    if(file.size>MAX_MB*1024*1024){ alert(`Archivo demasiado grande. Máximo ${MAX_MB} MB.`); e.target.value=""; return; }
    const reader=new FileReader();
    reader.onload=(ev)=> setEditing?.(prev=>({...(prev||defaultEditing), cover_image:file, cover_preview:String(ev.target?.result||""), cover_delete:false}));
    reader.onerror=()=>{ alert("Error al leer el archivo."); e.target.value=""; };
    reader.readAsDataURL(file);
  },[setEditing,defaultEditing]);

  const clearCover = useCallback(()=>{
    if (!setEditing) return;
    if (currentEditing.cover_url && !currentEditing.cover_image) {
      setEditing(prev=>({...(prev||defaultEditing), cover_delete:true, cover_preview:"", cover_image:null}));
    } else {
      setEditing(prev=>({...(prev||defaultEditing), cover_image:null, cover_preview:"", cover_delete:false}));
    }
    if (fileRef.current) fileRef.current.value="";
  },[setEditing,currentEditing,defaultEditing]);

  const previewSrc = useMemo(()=>{
    if (currentEditing.cover_preview) return currentEditing.cover_preview;
    if (currentEditing.cover_delete) return null;
    if (currentEditing.cover_url) return currentEditing.cover_url;
    return null;
  },[currentEditing]);

  // ---------- Guardar ----------
  const handleSave = useCallback(()=>{
    const errors=getValidationErrors(); setValidationErrors(errors);
    if (Object.keys(errors).length>0){
      const first=Object.keys(errors)[0]; const el=document.querySelector(`[data-field="${first}"]`);
      el?.scrollIntoView?.({behavior:"smooth", block:"center"}); el?.querySelector?.("input,textarea,select,button")?.focus?.();
      return;
    }
    const dataToSend={
      id: currentEditing.id || undefined,
      name: currentEditing.name?.trim(),
      description: currentEditing.description || "",
      status: currentEditing.status,
      participation_start: currentEditing.participation_start ? parseDateTimeLocal(currentEditing.participation_start) : null,
      participation_end:   currentEditing.participation_end   ? parseDateTimeLocal(currentEditing.participation_end)   : null,
      scheduled_date:      currentEditing.scheduled_date      ? parseDateTimeLocal(currentEditing.scheduled_date)      : null,
    };
    if (currentEditing.cover_image) dataToSend.cover_image=currentEditing.cover_image;
    else if (currentEditing.cover_delete) dataToSend.cover_delete=true;
    onSave(dataToSend);
  },[currentEditing,getValidationErrors,onSave]);

  const statusOptions = useMemo(()=>[
    { value:"draft",     label:"Borrador",   color:"text-gray-600",  description:"Ruleta en construcción, no visible públicamente" },
    { value:"active",    label:"Activa",     color:"text-green-600", description:"Ruleta activa, usuarios pueden participar" },
    { value:"scheduled", label:"Programada", color:"text-blue-600",  description:"Programada para sorteo automático" },
    { value:"completed", label:"Completada", color:"text-purple-600",description:"Sorteo realizado, tiene ganador" },
    { value:"cancelled", label:"Cancelada",  color:"text-red-600",   description:"Ruleta cancelada, no se realizará sorteo" },
  ],[]);
  const currentStatus = statusOptions.find(s=>s.value===currentEditing.status);

  if (!isOpen) return null;

  // Para mostrar u ocultar el bloque de cronómetros con fechas ya normalizadas
  const hasEnd  = !!normalizeToDate(currentEditing.participation_end);
  const hasDraw = !!normalizeToDate(currentEditing.scheduled_date);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-7xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center"><Save className="h-5 w-5 text-white"/></div>
            <div>
              <h3 className="text-xl font-semibold text-white">{currentEditing.id ? "Editar Ruleta" : "Crear Nueva Ruleta"}</h3>
              <p className="text-blue-100 text-sm">{currentEditing.id ? `ID: ${currentEditing.id}` : "Formulario de creación"}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {currentEditing.id && currentStatus && (
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                currentStatus.color==="text-green-600"?"bg-green-100 text-green-800":
                currentStatus.color==="text-blue-600"?"bg-blue-100 text-blue-800":
                currentStatus.color==="text-purple-600"?"bg-purple-100 text-purple-800":
                currentStatus.color==="text-red-600"?"bg-red-100 text-red-800":"bg-gray-100 text-gray-800"}`}>
                {currentStatus.label}
              </div>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/20 text-white" disabled={loading}><X className="h-5 w-5"/></button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
            <div className="flex items-start space-x-3"><AlertCircle className="h-5 w-5 text-red-600 mt-0.5"/><div className="flex-1"><h4 className="text-sm font-bold text-red-800 mb-1">Error al procesar la solicitud</h4><p className="text-sm text-red-700">{error}</p></div></div>
          </div>
        )}

        {/* Contenido */}
        <div className="p-6">

          {/* Información básica */}
          <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className="text-xl font-bold text-slate-800 mb-1">Información Básica</h4>
                <p className="text-sm text-slate-600">Datos principales de la ruleta</p>
              </div>
              <div className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full">Campos obligatorios (*)</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Título */}
              <div className="lg:col-span-1" data-field="name">
                <label className="block text-sm font-bold text-gray-700 mb-3">Título de la Ruleta *</label>
                <input
                  value={currentEditing.name || ""}
                  onChange={(e)=>{ setEditing?.(prev=>({...(prev||defaultEditing), name:e.target.value})); if(validationErrors.name) setValidationErrors(p=>({...p,name:null})); }}
                  className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all ${validationErrors.name?"border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-200":"border-gray-300 hover:border-gray-400"}`}
                  placeholder="ej: Ruleta de Navidad 2025 - ¡Grandes premios!"
                  maxLength={MAX_NAME_LENGTH}
                  disabled={loading}
                  required
                />
                <div className="flex items-center justify-between mt-2">
                  {validationErrors.name && <p className="text-sm text-red-600 flex items-center"><AlertCircle className="h-4 w-4 mr-1"/>{validationErrors.name}</p>}
                  <span className={`text-xs ${(currentEditing.name?.length||0)>MAX_NAME_LENGTH*0.9?"text-orange-600 font-medium":"text-gray-500"}`}>{currentEditing.name?.length || 0}/{MAX_NAME_LENGTH} caracteres</span>
                </div>
              </div>

              {/* Estado */}
              <div data-field="status">
                <label className="block text-sm font-bold text-gray-700 mb-3">Estado de la Ruleta *</label>
                <div className="relative">
                  <select value={currentEditing.status || "draft"} onChange={(e)=>setEditing?.(prev=>({...(prev||defaultEditing), status:e.target.value}))}
                          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-gray-400 bg-white"
                          disabled={loading}>
                    {statusOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                {currentStatus && <p className="mt-2 text-xs text-gray-600 bg-white px-3 py-2 rounded-lg border"><Info className="h-3 w-3 inline mr-1"/>{currentStatus.description}</p>}
              </div>
            </div>

            {/* Descripción */}
            <div className="mt-6" data-field="description">
              <label className="block text-sm font-bold text-gray-700 mb-3">Descripción de la Ruleta</label>
              <SimpleTextEditor
                value={currentEditing.description || ""}
                onChange={(v)=>{ setEditing?.(prev=>({...(prev||defaultEditing), description:v})); if(validationErrors.description) setValidationErrors(p=>({...p,description:null})); }}
                placeholder={getDefaultDescription()}
                disabled={loading}
                maxLength={MAX_DESCRIPTION_LENGTH}
                validationError={validationErrors.description || descriptionValidationError}
                onValidationChange={setDescriptionValidationError}
              />
              <div className="mt-3 flex items-center gap-2">
                <button type="button" onClick={()=>setEditing?.(prev=>({...(prev||defaultEditing), description:getDefaultDescription()}))}
                        className="text-xs px-3 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200" disabled={loading}>
                  Usar plantilla
                </button>
              </div>
              {validationErrors.description && (
                <div className="mt-3 p-4 bg-red-50 border-l-4 border-red-400 rounded-r-lg">
                  <div className="flex items-start space-x-2"><AlertCircle className="h-5 w-5 text-red-600 mt-0.5"/><div><p className="text-sm font-bold text-red-800">Error en la descripción</p><p className="text-sm text-red-600 mt-1">{validationErrors.description}</p></div></div>
                </div>
              )}
            </div>
          </div>

          {/* Imagen de portada */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div><h4 className="text-xl font-bold text-slate-800 mb-1">Imagen de Portada</h4><p className="text-sm text-slate-600">Imagen principal que representa tu ruleta (opcional)</p></div>
              <div className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full">Opcional</div>
            </div>
            <div className="flex flex-col xl:flex-row items-start gap-6">
              <div className="w-full xl:w-80 h-48 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center border-2 border-dashed border-gray-300 relative group">
                {previewSrc ? (
                  <>
                    <img src={previewSrc} alt="Vista previa" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onError={(e)=>{ e.target.style.display="none"; }}/>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center"><div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-white/90 px-3 py-2 rounded-lg text-sm font-medium text-gray-700">Vista previa</div></div>
                  </>
                ) : (
                  <div className="text-gray-400 text-center p-6"><ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-60"/><p className="text-sm font-medium mb-1">Sin imagen de portada</p><p className="text-xs">Sube una imagen atractiva</p></div>
                )}
              </div>
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" onClick={onPickFile} disabled={loading} className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold hover:from-blue-700 hover:to-blue-800 transition-all shadow-md">
                    <Upload className="h-4 w-4 mr-2" /> {currentEditing.cover_image || currentEditing.cover_url ? "Cambiar" : "Subir"}
                  </button>
                  {(currentEditing.cover_image || (!currentEditing.cover_delete && currentEditing.cover_url)) && (
                    <button type="button" onClick={clearCover} disabled={loading} className="inline-flex items-center justify-center px-4 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold hover:bg-gray-200 transition-all">
                      <Trash2 className="h-4 w-4 mr-2" /> Quitar
                    </button>
                  )}
                </div>
                <div className="bg-white p-3 rounded-lg border text-xs text-gray-600">
                  <div className="grid grid-cols-2 gap-3"><div><span className="font-medium">Formatos:</span> JPG, PNG, WebP</div><div><span className="font-medium">Máx.:</span> {MAX_MB} MB</div></div>
                </div>
                <input ref={fileRef} type="file" accept={ALLOWED_EXTENSIONS.join(",")} className="hidden" onChange={onFileChange}/>
              </div>
            </div>
          </div>

          {/* Programación temporal */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Calendar className="h-5 w-5 text-blue-600"/></div>
                <div><h4 className="text-xl font-bold text-slate-800 mb-1">Programación Temporal</h4><p className="text-sm text-slate-600">Configura cuándo pueden participar y cuándo se realiza el sorteo</p></div>
              </div>
              <div className="text-xs text-slate-500 bg-white px-3 py-1 rounded-full">Todas opcionales</div>
            </div>

            {/* Cronómetros en tiempo real (solo si hay fechas válidas) */}
            {(hasEnd || hasDraw) && (
              <div className="mb-6 p-4 bg-white rounded-xl border border-blue-200 shadow-sm">
                <h5 className="text-sm font-bold text-blue-800 mb-3 flex items-center"><Clock className="h-4 w-4 mr-2" /> Cronómetros en Tiempo Real</h5>
                <div className="space-y-3">
                  {hasEnd  && <CountdownTimer targetDate={currentEditing.participation_end} label="Fin de participación" className="block" />}
                  {hasDraw && <CountdownTimer targetDate={currentEditing.scheduled_date}      label="Sorteo programado"     className="block" />}
                </div>
              </div>
            )}

            {/* Campos de fecha */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Inicio */}
              <div data-field="participation_start">
                <label className="block text-sm font-bold text-gray-700 mb-3">Inicio de Participación <span className="text-xs text-gray-500 ml-1">(Opcional)</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Calendar className="h-5 w-5 text-gray-400"/></div>
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(currentEditing.participation_start)}
                    onChange={(e)=>{ const v=e.target.value; setEditing?.(prev=>({...(prev||defaultEditing), participation_start:v})); if(validationErrors.participation_start) setValidationErrors(p=>({...p, participation_start:null})); }}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-gray-400 bg-white ${validationErrors.participation_start?"border-red-300 bg-red-50":"border-gray-300"}`}
                    disabled={loading}
                  />
                </div>
                {validationErrors.participation_start && <p className="mt-2 text-xs text-red-600 flex items-center bg-red-50 px-3 py-2 rounded-lg"><AlertCircle className="h-3 w-3 mr-1"/>{validationErrors.participation_start}</p>}
                <p className="mt-2 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg"><Clock className="h-3 w-3 inline mr-1"/>Desde cuándo pueden participar</p>
              </div>

              {/* Fin */}
              <div data-field="participation_end">
                <label className="block text-sm font-bold text-gray-700 mb-3">Fin de Participación <span className="text-xs text-gray-500 ml-1">(Opcional)</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Calendar className="h-5 w-5 text-gray-400"/></div>
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(currentEditing.participation_end)}
                    onChange={(e)=>{ const v=e.target.value; setEditing?.(prev=>({...(prev||defaultEditing), participation_end:v})); if(validationErrors.participation_end) setValidationErrors(p=>({...p, participation_end:null})); }}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-gray-400 bg-white ${validationErrors.participation_end?"border-red-300 bg-red-50":"border-gray-300"}`}
                    disabled={loading}
                  />
                </div>
                {validationErrors.participation_end && <p className="mt-2 text-xs text-red-600 flex items-center bg-red-50 px-3 py-2 rounded-lg"><AlertCircle className="h-3 w-3 mr-1"/>{validationErrors.participation_end}</p>}
                <p className="mt-2 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg"><Clock className="h-3 w-3 inline mr-1"/>Fecha límite para participar</p>
              </div>

              {/* Sorteo programado */}
              <div data-field="scheduled_date">
                <label className="block text-sm font-bold text-gray-700 mb-3">Sorteo Programado <span className="text-xs text-gray-500 ml-1">(Opcional)</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Calendar className="h-5 w-5 text-gray-400"/></div>
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(currentEditing.scheduled_date)}
                    onChange={(e)=>{ const v=e.target.value; setEditing?.(prev=>({...(prev||defaultEditing), scheduled_date:v})); if(validationErrors.scheduled_date) setValidationErrors(p=>({...p, scheduled_date:null})); }}
                    className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none hover:border-gray-400 bg-white ${validationErrors.scheduled_date?"border-red-300 bg-red-50":"border-gray-300"}`}
                    disabled={loading}
                  />
                </div>
                {validationErrors.scheduled_date && <p className="mt-2 text-xs text-red-600 flex items-center bg-red-50 px-3 py-2 rounded-lg"><AlertCircle className="h-3 w-3 mr-1"/>{validationErrors.scheduled_date}</p>}
                <p className="mt-2 text-xs text-gray-500 bg-white px-3 py-2 rounded-lg"><Clock className="h-3 w-3 inline mr-1"/>Fecha para sorteo automático</p>
              </div>
            </div>

            {/* Info */}
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0"><Info className="h-4 w-4 text-blue-600"/></div>
                <div className="flex-1 text-xs text-blue-700 space-y-1">
                  <h5 className="text-sm font-bold text-blue-800 mb-2">Configuración de fechas:</h5>
                  <p>• <strong>Sin fechas:</strong> Participación inmediata, sorteo manual</p>
                  <p>• <strong>Solo fin:</strong> Participación hasta fecha límite, sorteo manual</p>
                  <p>• <strong>Programado:</strong> Sorteo automático en fecha especificada</p>
                  <p>• <strong>Todas las fechas:</strong> Control total del proceso</p>
                  {currentEditing.id && <p className="text-blue-600 bg-blue-50 p-2 rounded mt-2">• <strong>Modo edición:</strong> Se permiten fechas pasadas para ruletas existentes</p>}
                  <p className="text-green-600 bg-green-50 p-2 rounded mt-2">• <strong>Cronómetro:</strong> aparece automáticamente con fin y/o sorteo programado válidos</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 flex items-center justify-between sticky bottom-0 backdrop-blur-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-sm text-gray-500"><Info className="h-4 w-4 mr-2"/>Los campos marcados con (*) son obligatorios</div>
            {!isFormValid && <div className="flex items-center text-sm text-amber-600 bg-amber-50 px-3 py-1 rounded-full"><AlertCircle className="h-4 w-4 mr-2"/>Faltan campos obligatorios</div>}
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="px-6 py-3 rounded-xl bg-white text-gray-700 border-2 border-gray-300 hover:bg-gray-50 hover:border-gray-400 font-medium" disabled={loading}>Cancelar</button>
            <button onClick={handleSave} disabled={loading || !isFormValid}
              className="inline-flex items-center px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 disabled:opacity-50 shadow-lg">
              {loading ? (<><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div><span>Guardando...</span></>) : (<><Save className="h-5 w-5 mr-2"/><span>{currentEditing.id ? "Actualizar Ruleta" : "Crear Ruleta"}</span></>)}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RouletteModal;
