// ✅ pruebas_unitarias.js
// Ejecutar con: node pruebas_unitarias.js

const Celda = require("./Celda");
const Incidencia = require("./Incidencias");
const HistorialParqueo = require("./HistorialParqueo");
const PicoPlaca = require("./RestriccionesPicoPlaca");
const ReporteIncidencia = require("./ReporteIncidencia");

async function ejecutarPruebas() {
  console.log("================ PRUEBAS UNITARIAS =================");

  // CELDA
  try {
    const celda = new Celda(null, "Carro", "libre");
    const resultado = await celda.guardar();
    console.log("✅ Celda creada:", resultado);
  } catch (e) {
    console.error("❌ Error en creación de celda:", e.message);
  }

  // INCIDENCIA
  try {
    const incidencia = new Incidencia(null, "Vehículo mal estacionado");
    const resultado = await incidencia.guardar();
    console.log("✅ Incidencia creada:", resultado);
  } catch (e) {
    console.error("❌ Error en creación de incidencia:", e.message);
  }

  // PICO Y PLACA
  try {
    const regla = new PicoPlaca(null, "Carro", "7", "Lunes");
    const resultado = await regla.guardar();
    console.log("✅ Regla Pico y Placa creada:", resultado);
  } catch (e) {
    console.error("❌ Error en creación de Pico y Placa:", e.message);
  }

  // HISTORIAL PARQUEO (⚠️ Necesita celdaId y vehiculoId válidos)
  try {
    const historial = new HistorialParqueo(1, 1, new Date());
    const resultado = await historial.guardar();
    console.log("✅ Historial de parqueo creado:", resultado);
  } catch (e) {
    console.error("⚠️ Error en historial (verifica IDs reales):", e.message);
  }

  // REPORTE INCIDENCIA (⚠️ Necesita vehiculoId e incidenciaId válidos)
  try {
    const reporte = new ReporteIncidencia(1, 1, new Date());
    const resultado = await reporte.guardar();
    console.log("✅ Reporte de incidencia creado:", resultado);
  } catch (e) {
    console.error("⚠️ Error en reporte de incidencia (verifica IDs reales):", e.message);
  }

  console.log("====================================================");
}

ejecutarPruebas();
