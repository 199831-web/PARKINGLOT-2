// actualizarFechaIngreso.js

const db = require('./models'); // Asegúrate que index.js exporta sequelize y modelos correctamente

async function actualizarFechaIngreso() {
  try {
    await db.sequelize.authenticate();
    console.log('✅ Conectado a la base de datos');

    const [registrosActualizados] = await db.HistorialParqueo.update(
      { fecha_ingreso: new Date() },
      { where: { fecha_ingreso: null } }
    );

    console.log(`✅ Registros actualizados: ${registrosActualizados}`);
  } catch (error) {
    console.error('❌ Error al actualizar registros:', error);
  } finally {
    await db.sequelize.close();
    console.log('🔌 Conexión cerrada');
  }
}

actualizarFechaIngreso();
