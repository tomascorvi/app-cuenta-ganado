import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sliders, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Cpu, 
  Settings, 
  Bell, 
  History, 
  TrendingUp, 
  Lock,
  ChevronRight,
  Info,
  Copy,
  Check
} from 'lucide-react';

// Datos iniciales de historial para dar vida al diseño en la primera carga
const INITIAL_LOGS = [
  { id: 1, type: 'in', time: '18:42:15', date: 'Hoy', countAfter: 8 },
  { id: 2, type: 'out', time: '18:35:10', date: 'Hoy', countAfter: 7 },
  { id: 3, type: 'in', time: '18:15:22', date: 'Hoy', countAfter: 8 },
  { id: 4, type: 'in', time: '17:58:01', date: 'Hoy', countAfter: 7 },
  { id: 5, type: 'out', time: '17:40:12', date: 'Hoy', countAfter: 6 },
];

const HOURLY_DATA = [
  { hour: '10:00', entries: 4, exits: 2, occupancy: 2 },
  { hour: '12:00', entries: 12, exits: 8, occupancy: 6 },
  { hour: '14:00', entries: 8, exits: 10, occupancy: 4 },
  { hour: '16:00', entries: 18, exits: 12, occupancy: 10 },
  { hour: '18:00', entries: 22, exits: 14, occupancy: 18 },
  { hour: '20:00', entries: 5, exits: 15, occupancy: 8 },
];

export default function App() {
  // Estado principal de la App
  const [currentOccupancy, setCurrentOccupancy] = useState(8);
  const [maxCapacity, setMaxCapacity] = useState(15);
  const [totalEntries, setTotalEntries] = useState(48);
  const [totalExits, setTotalExits] = useState(40);
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'analytics', 'settings', 'hardware'
  const [isWifiConnected, setIsWifiConnected] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [notification, setNotification] = useState(null);

  // Estados del Simulador de Hardware Externo (para pruebas)
  const [simStep, setSimStep] = useState('idle'); // 'idle', 'sensorA', 'sensorB'
  const [simDirection, setSimDirection] = useState(null); // 'in' o 'out'

  // Función para disparar notificaciones temporales estilo Toast de celular
  const showToast = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Simulación de la llegada de un evento Wi-Fi desde el ESP32
  const handleHardwareTrigger = (direction) => {
    const timeString = new Date().toTimeString().split(' ')[0];
    let newOccupancy = currentOccupancy;

    if (direction === 'in') {
      newOccupancy += 1;
      setTotalEntries(prev => prev + 1);
      setCurrentOccupancy(newOccupancy);
      setLogs(prev => [
        { id: Date.now(), type: 'in', time: timeString, date: 'Hoy', countAfter: newOccupancy },
        ...prev
      ]);
      showToast("¡Cliente detectado entrando! +1", "success");
    } else if (direction === 'out') {
      if (currentOccupancy > 0) {
        newOccupancy -= 1;
        setTotalExits(prev => prev + 1);
        setCurrentOccupancy(newOccupancy);
        setLogs(prev => [
          { id: Date.now(), type: 'out', time: timeString, date: 'Hoy', countAfter: newOccupancy },
          ...prev
        ]);
        showToast("Cliente saliendo detectado. -1", "info");
      } else {
        showToast("Intento de salida, pero el local ya estaba vacío.", "warning");
      }
    }

    // Alerta de capacidad máxima
    if (newOccupancy >= maxCapacity) {
      showToast("⚠️ ¡CAPACIDAD MÁXIMA ALCANZADA!", "danger");
    }
  };

  // Simulador interactivo paso a paso de corte de haz de luz
  const runStepByStepSim = (direction) => {
    setSimDirection(direction);
    if (direction === 'in') {
      setSimStep('sensorA');
      showToast("Paso 1: Cliente corta el Sensor A (Entrada)");
      setTimeout(() => {
        setSimStep('both');
        showToast("Paso 2: Ambos sensores cortados temporalmente");
        setTimeout(() => {
          setSimStep('sensorB');
          showToast("Paso 3: Sensor A liberado, Sensor B sigue cortado");
          setTimeout(() => {
            setSimStep('idle');
            handleHardwareTrigger('in');
          }, 600);
        }, 600);
      }, 600);
    } else {
      setSimStep('sensorB');
      showToast("Paso 1: Cliente corta el Sensor B (Salida)");
      setTimeout(() => {
        setSimStep('both');
        showToast("Paso 2: Ambos sensores cortados temporalmente");
        setTimeout(() => {
          setSimStep('sensorA');
          showToast("Paso 3: Sensor B liberado, Sensor A sigue cortado");
          setTimeout(() => {
            setSimStep('idle');
            handleHardwareTrigger('out');
          }, 600);
        }, 600);
      }, 600);
    }
  };

  const handleReset = () => {
    setCurrentOccupancy(0);
    setTotalEntries(0);
    setTotalExits(0);
    setLogs([]);
    showToast("Contador local e historial reiniciados", "warning");
  };

  // Código real de ESP32 que podrán usar más adelante
  const arduinoCode = `// Código para enviar datos a la App Cuenta Ganado mediante Wi-Fi
#include <WiFi.h>
#include <HTTPClient.h>

const char* ssid = "TU_WIFI_DE_NIVEL";
const char* password = "TU_CONTRASEÑA";
const char* serverUrl = "https://api.tu-servidor-o-firebase.com/conteo";

const int PIN_SENSOR_A = 12;
const int PIN_SENSOR_B = 13;

bool estadoA = HIGH;
bool estadoB = HIGH;
String secuencia = "";

void setup() {
  Serial.begin(115200);
  pinMode(PIN_SENSOR_A, INPUT_PULLUP);
  pinMode(PIN_SENSOR_B, INPUT_PULLUP);
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nConectado a Wi-Fi!");
}

void loop() {
  bool lecturaA = digitalRead(PIN_SENSOR_A);
  bool lecturaB = digitalRead(PIN_SENSOR_B);

  // Lógica de detección de secuencia
  if (lecturaA == LOW && secuencia == "") {
    secuencia = "A";
    delay(100);
  } else if (lecturaB == LOW && secuencia == "") {
    secuencia = "B";
    delay(100);
  }

  if (lecturaB == LOW && secuencia == "A") {
    enviarEvento("entrada");
    secuencia = "";
    delay(1000); // Evitar rebotes de doble conteo
  } else if (lecturaA == LOW && secuencia == "B") {
    enviarEvento("salida");
    secuencia = "";
    delay(1000);
  }
}

void enviarEvento(String tipo) {
  if(WiFi.status() == WL_CONNECTED){
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    String jsonPayload = "{\\"evento\\":\\"" + tipo + "\\"\\}";
    int httpResponseCode = http.POST(jsonPayload);
    http.end();
  }
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(arduinoCode);
    setCopiedCode(true);
    showToast("Código Arduino copiado al portapapeles", "success");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col md:flex-row font-sans">
      
      {/* SECCIÓN IZQUIERDA: SIMULADOR DE HARDWARE (MUNDO FÍSICO) */}
      <div className="w-full md:w-1/3 bg-slate-800 p-6 border-b md:border-b-0 md:border-r border-slate-700 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Simulador Físico (ESP32)</h2>
              <p className="text-xs text-slate-400">Prueba tu código antes de armarlo</p>
            </div>
          </div>

          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-700 mb-6">
            <h3 className="text-sm font-semibold mb-3 text-slate-300">Paso de Peatón Simulado</h3>
            
            {/* Visualización física interactiva de los sensores */}
            <div className="relative h-28 bg-slate-950 rounded-lg overflow-hidden flex items-center justify-around border border-slate-800">
              {/* Carril de caminata */}
              <div className="absolute inset-x-0 h-10 bg-slate-900 border-y border-slate-800"></div>

              {/* Sensor A */}
              <div className="flex flex-col items-center z-10">
                <span className="text-[10px] font-bold text-slate-500 mb-1">SENSOR A (D12)</span>
                <div className={`w-4 h-12 rounded transition-colors duration-200 flex items-center justify-center ${
                  simStep === 'sensorA' || simStep === 'both' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-slate-700'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-slate-950"></div>
                </div>
              </div>

              {/* Persona de prueba caminando */}
              {simStep !== 'idle' && (
                <div className={`absolute w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center font-bold text-xs shadow-lg shadow-indigo-500/50 z-20 transition-all duration-500 ${
                  simStep === 'sensorA' ? 'left-[20%]' :
                  simStep === 'both' ? 'left-[45%]' :
                  simStep === 'sensorB' ? 'left-[70%]' : 'left-[-50px]'
                }`}>
                  🚶
                </div>
              )}

              {/* Sensor B */}
              <div className="flex flex-col items-center z-10">
                <span className="text-[10px] font-bold text-slate-500 mb-1">SENSOR B (D13)</span>
                <div className={`w-4 h-12 rounded transition-colors duration-200 flex items-center justify-center ${
                  simStep === 'sensorB' || simStep === 'both' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-slate-700'
                }`}>
                  <div className="w-2 h-2 rounded-full bg-slate-950"></div>
                </div>
              </div>
            </div>

            {/* Acciones de simulación rápida */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button 
                onClick={() => runStepByStepSim('in')}
                disabled={simStep !== 'idle'}
                className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20"
              >
                <ArrowUpRight className="w-4 h-4" /> Simular Entrada
              </button>
              <button 
                onClick={() => runStepByStepSim('out')}
                disabled={simStep !== 'idle'}
                className="py-2.5 px-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded-lg font-medium text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <ArrowDownRight className="w-4 h-4" /> Simular Salida
              </button>
            </div>
          </div>

          {/* Información Técnica de Valor */}
          <div className="space-y-3 text-xs text-slate-400">
            <div className="flex justify-between border-b border-slate-700/50 pb-2">
              <span>Tipo de Conexión:</span>
              <span className="text-emerald-400 font-mono">Wi-Fi (HTTPS POST)</span>
            </div>
            <div className="flex justify-between border-b border-slate-700/50 pb-2">
              <span>Sensores detectados:</span>
              <span className="text-slate-200">2x Infrarrojo de Relé</span>
            </div>
            <div className="flex justify-between">
              <span>Asignación de Pines:</span>
              <span className="text-indigo-300 font-mono">D12 (A) y D13 (B)</span>
            </div>
          </div>
        </div>

        <div className="mt-6 p-3 bg-indigo-950/40 border border-indigo-800/30 rounded-lg text-xs text-indigo-300 flex gap-2">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Al pulsar "Simular Entrada" verás cómo la app móvil del medio responde tal cual lo hará en el local comercial al cruzar la puerta.
          </p>
        </div>
      </div>

      {/* SECCIÓN CENTRAL: LA APLICACIÓN MÓVIL (VISTA DEL CELULAR DEL BOUTIQUE) */}
      <div className="flex-1 bg-slate-950 flex justify-center items-center p-4 py-8 relative">
        
        {/* Toast Notificación flotante móvil */}
        {notification && (
          <div className={`absolute top-6 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border text-sm font-semibold transition-all duration-300 animate-bounce ${
            notification.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500' :
            notification.type === 'danger' ? 'bg-rose-950/90 text-rose-300 border-rose-500' :
            notification.type === 'warning' ? 'bg-amber-950/90 text-amber-300 border-amber-500' :
            'bg-indigo-950/90 text-indigo-300 border-indigo-500'
          }`}>
            <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
            {notification.message}
          </div>
        )}

        {/* Marco de Celular Ficticio para simular la app de forma hiper-realista */}
        <div className="w-full max-w-[390px] h-[780px] bg-slate-900 rounded-[48px] shadow-[0_0_0_12px_rgba(30,41,59,0.8),0_25px_50px_-12px_rgba(0,0,0,0.5)] border-4 border-slate-950 overflow-hidden flex flex-col justify-between relative">
          
          {/* Cabezal del Celular (Notch / Isla Dinámica) */}
          <div className="bg-slate-950 w-full h-8 flex justify-between items-center px-8 text-xs text-slate-400 font-medium select-none shrink-0 z-30">
            <span>19:42</span>
            <div className="w-24 h-4.5 bg-black rounded-full absolute left-1/2 -translate-x-1/2 top-1.5 flex items-center justify-around px-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
              <div className="w-8 h-1.5 bg-slate-800 rounded-full"></div>
            </div>
            <div className="flex items-center gap-1.5">
              {isWifiConnected ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
              )}
              <div className="w-5 h-2.5 border border-slate-500 rounded-sm p-0.5 flex items-center">
                <div className="bg-slate-400 h-full w-4 rounded-2xs"></div>
              </div>
            </div>
          </div>

          {/* CUERPO CENTRAL DE LA APP (PANTALLA DINÁMICA DE LA APLICACIÓN) */}
          <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-thumb-slate-800">
            
            {/* CABECERA DE LA MARCA */}
            <div className="flex justify-between items-center mb-6">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold">Aura Boutique</span>
                <h1 className="text-xl font-black text-white flex items-center gap-1.5">
                  AuraControl <span className="text-xs bg-indigo-500/20 text-indigo-300 font-normal px-2 py-0.5 rounded-full">v1.2</span>
                </h1>
              </div>
              <button 
                onClick={() => setIsWifiConnected(!isWifiConnected)}
                className={`p-2 rounded-xl transition-colors ${
                  isWifiConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}
                title="Simular pérdida de Wi-Fi de la tienda"
              >
                <Wifi className="w-5 h-5" />
              </button>
            </div>

            {/* PANTALLA 1: DASHBOARD PRINCIPAL */}
            {activeTab === 'dashboard' && (
              <div className="space-y-5">
                
                {/* TARJETA DE OCUPACIÓN REAL-TIME */}
                <div className="bg-gradient-to-br from-indigo-950 to-slate-900 rounded-3xl p-6 border border-indigo-500/20 relative overflow-hidden shadow-xl">
                  <div className="absolute right-0 bottom-0 translate-x-1/3 translate-y-1/3 w-32 h-32 bg-indigo-500/10 rounded-full blur-xl"></div>
                  
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs text-indigo-300 font-medium">Aforo en Tiempo Real</span>
                    <span className="flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                      Activo
                    </span>
                  </div>

                  <div className="flex items-baseline gap-1.5 justify-center my-6">
                    <span className={`text-6xl font-black tracking-tighter transition-colors duration-300 ${
                      currentOccupancy >= maxCapacity ? 'text-rose-400' : 
                      currentOccupancy >= maxCapacity * 0.8 ? 'text-amber-400' : 'text-white'
                    }`}>
                      {currentOccupancy}
                    </span>
                    <span className="text-slate-400 text-lg font-semibold">/ {maxCapacity}</span>
                  </div>

                  {/* Barra de progreso visual */}
                  <div className="space-y-1.5">
                    <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${
                          currentOccupancy >= maxCapacity ? 'bg-rose-500' : 
                          currentOccupancy >= maxCapacity * 0.8 ? 'bg-amber-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${Math.min((currentOccupancy / maxCapacity) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Capacidad actual</span>
                      <span>{Math.round((currentOccupancy / maxCapacity) * 100)}% ocupado</span>
                    </div>
                  </div>
                </div>

                {/* METRICAS DEL DÍA */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-400 font-medium">Entradas hoy</span>
                      <div className="p-1 bg-emerald-500/10 text-emerald-400 rounded-lg">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                    </div>
                    <span className="text-2xl font-bold tracking-tight">{totalEntries}</span>
                  </div>

                  <div className="bg-slate-800/60 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-slate-400 font-medium">Salidas hoy</span>
                      <div className="p-1 bg-indigo-500/10 text-indigo-400 rounded-lg">
                        <ArrowDownRight className="w-4 h-4" />
                      </div>
                    </div>
                    <span className="text-2xl font-bold tracking-tight">{totalExits}</span>
                  </div>
                </div>

                {/* ÚLTIMA ACTIVIDAD (HISTORIAL RECIENTE) */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-200">Historial Reciente</h3>
                    <button 
                      onClick={() => setActiveTab('analytics')} 
                      className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center font-semibold"
                    >
                      Ver todos <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {logs.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs">
                        Esperando las primeras lecturas del sensor...
                      </div>
                    ) : (
                      logs.slice(0, 3).map((log) => (
                        <div key={log.id} className="bg-slate-800/40 border border-slate-800 px-4 py-3 rounded-xl flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              log.type === 'in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
                            }`}>
                              {log.type === 'in' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            </div>
                            <div>
                              <p className="text-xs font-semibold">{log.type === 'in' ? 'Cliente ingresó' : 'Cliente salió'}</p>
                              <p className="text-[10px] text-slate-500">{log.time} - {log.date}</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-400">Aforo: {log.countAfter}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* PANTALLA 2: GRÁFICOS Y ANALÍTICA */}
            {activeTab === 'analytics' && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-extrabold">Flujo del Día</h2>
                  <span className="text-xs text-slate-400 font-medium">Hoy lunes</span>
                </div>

                {/* GRÁFICO PERSONALIZADO SVG */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
                  <h3 className="text-xs font-bold text-slate-300 mb-4">Ocupación por Hora</h3>
                  <div className="relative h-44 w-full">
                    {/* Líneas de guía de fondo */}
                    <div className="absolute inset-x-0 top-0 border-t border-slate-700/30 h-10"></div>
                    <div className="absolute inset-x-0 top-1/4 border-t border-slate-700/30 h-10"></div>
                    <div className="absolute inset-x-0 top-2/4 border-t border-slate-700/30 h-10"></div>
                    <div className="absolute inset-x-0 top-3/4 border-t border-slate-700/30 h-10"></div>

                    {/* Barras de gráfico */}
                    <div className="absolute inset-0 flex items-end justify-between px-2 pt-4">
                      {HOURLY_DATA.map((d, idx) => {
                        const heightPct = Math.min((d.occupancy / maxCapacity) * 100, 100);
                        return (
                          <div key={idx} className="flex flex-col items-center flex-1 group">
                            {/* Valor flotante */}
                            <span className="text-[10px] font-bold text-indigo-300 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {d.occupancy}
                            </span>
                            {/* Barra */}
                            <div 
                              className="w-4 bg-indigo-500 rounded-t-sm transition-all duration-500 hover:bg-indigo-400"
                              style={{ height: `${Math.max(heightPct, 5)}%` }}
                            ></div>
                            {/* Hora */}
                            <span className="text-[9px] text-slate-500 mt-2 font-medium">{d.hour}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* HISTORIAL COMPLETO DE CONTEOS */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <History className="w-4 h-4 text-indigo-400" /> Registro Completo
                  </h3>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {logs.map((log) => (
                      <div key={log.id} className="bg-slate-800/30 border border-slate-800/80 px-4 py-3 rounded-xl flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${
                            log.type === 'in' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'
                          }`}>
                            {log.type === 'in' ? <ArrowUpRight className="w-4.5 h-4.5" /> : <ArrowDownRight className="w-4.5 h-4.5" />}
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{log.type === 'in' ? 'Entrada' : 'Salida'}</p>
                            <p className="text-[9px] text-slate-500">{log.time} - {log.date}</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-slate-300">Aforo: {log.countAfter}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PANTALLA 3: CONFIGURACIÓN */}
            {activeTab === 'settings' && (
              <div className="space-y-5 animate-fadeIn">
                <h2 className="text-lg font-extrabold mb-4">Ajustes del Local</h2>

                {/* Ajustar aforo */}
                <div className="bg-slate-800/40 border border-slate-700/40 p-4 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-xs font-bold text-slate-200">Capacidad Máxima</h3>
                      <p className="text-[10px] text-slate-500">Alerta de aforo para el local</p>
                    </div>
                    <span className="bg-indigo-500/20 text-indigo-300 text-sm font-bold px-3 py-1 rounded-full">
                      {maxCapacity} personas
                    </span>
                  </div>
                  
                  <input 
                    type="range" 
                    min="5" 
                    max="50" 
                    value={maxCapacity}
                    onChange={(e) => setMaxCapacity(parseInt(e.target.value))}
                    className="w-full accent-indigo-500 bg-slate-700 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Otras opciones de control */}
                <div className="space-y-2">
                  <div className="bg-slate-800/20 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/15 text-indigo-400 rounded-lg">
                        <Bell className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">Notificaciones Push</p>
                        <p className="text-[9px] text-slate-500">Alertas en tiempo real al celular</p>
                      </div>
                    </div>
                    <div className="w-8 h-4 bg-indigo-600 rounded-full p-0.5 cursor-pointer flex justify-end">
                      <div className="bg-white w-3 h-3 rounded-full"></div>
                    </div>
                  </div>

                  <div className="bg-slate-800/20 border border-slate-800 p-4 rounded-xl flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/15 text-indigo-400 rounded-lg">
                        <Lock className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold">Modo Privado</p>
                        <p className="text-[9px] text-slate-500">Requiere pin para reiniciar</p>
                      </div>
                    </div>
                    <div className="w-8 h-4 bg-slate-800 rounded-full p-0.5 cursor-pointer flex justify-start">
                      <div className="bg-slate-500 w-3 h-3 rounded-full"></div>
                    </div>
                  </div>
                </div>

                {/* Acciones de peligro */}
                <div className="pt-4">
                  <button 
                    onClick={handleReset}
                    className="w-full py-3 border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 font-bold text-xs rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-rose-500/5"
                  >
                    <RefreshCw className="w-4 h-4" /> Reiniciar todos los datos
                  </button>
                </div>
              </div>
            )}

            {/* PANTALLA 4: ESP32 ARDUINO CODE VIEW */}
            {activeTab === 'hardware' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-extrabold">Código ESP32</h2>
                  <button 
                    onClick={copyToClipboard}
                    className="text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedCode ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Copia este código y pégalo en tu programa **Arduino IDE** para configurar los pines de tus sensores infrarrojos de relé en la placa física.
                </p>

                <div className="relative">
                  <pre className="bg-slate-950 p-3.5 rounded-xl text-[10px] font-mono text-slate-300 overflow-x-auto max-h-[350px] border border-slate-800/80 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
                    <code>{arduinoCode}</code>
                  </pre>
                </div>
              </div>
            )}

          </div>

          {/* MENÚ DE NAVEGACIÓN INFERIOR (Pestañas móviles) */}
          <div className="bg-slate-950 border-t border-slate-800 w-full h-18 px-4 flex justify-around items-center shrink-0 z-30">
            
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'dashboard' ? 'text-indigo-400 scale-105' : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <Users className="w-5 h-5" />
              <span className="text-[9px] font-semibold">Monitor</span>
            </button>

            <button 
              onClick={() => setActiveTab('analytics')}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'analytics' ? 'text-indigo-400 scale-105' : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              <span className="text-[9px] font-semibold">Historial</span>
            </button>

            <button 
              onClick={() => setActiveTab('hardware')}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'hardware' ? 'text-indigo-400 scale-105' : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <Cpu className="w-5 h-5" />
              <span className="text-[9px] font-semibold">ESP32</span>
            </button>

            <button 
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 transition-all ${
                activeTab === 'settings' ? 'text-indigo-400 scale-105' : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[9px] font-semibold">Ajustes</span>
            </button>

          </div>

          {/* Barra Home Gestures iOS */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-800 rounded-full z-40 pointer-events-none"></div>

        </div>

      </div>

    </div>
  );
}
