const express = require("express");
const multer = require("multer");
const path = require("path");
const bcrypt = require('bcryptjs');
const cors = require('cors'); // Agregado para habilitar CORS
const { Op } = require('sequelize'); // Importar Op para operaciones de Sequelize como 'not equal'

// Importar todos los modelos, incluyendo PicoPlaca, desde index.js
const { sequelize, Usuario, Vehiculo, Entrada, Celda, HistorialParqueo, Perfil, PicoPlaca } = require("./models");

// Importar controladores (asumiendo que los tienes)
const { registrarVehiculo } = require("./controllers/vehiculo.controller");
const parqueoController = require("./controllers/parqueo.controller"); // <-- Aquí se importa

const app = express();
const upload = multer();

// Habilitar CORS para todas las solicitudes (considera configurarlo de forma más restrictiva en producción)
app.use(cors());

// Sincronizar la base de datos con Sequelize (creará/alterará tablas según los modelos)
sequelize.sync({ alter: true })
  .then(() => console.log("✅ Sincronización de la base de datos realizada con éxito."))
  .catch((err) => console.error("❌ Error al sincronizar la base de datos:", err));

// Conexión con MySQL
sequelize.authenticate()
  .then(() => console.log("✅ Conectado a MySQL"))
  .catch((err) => console.error("❌ Error al conectar a MySQL:", err.message));

app.use(express.json()); // Middleware para que Express analice los cuerpos de las solicitudes JSON
app.use(express.static(path.join(__dirname, 'public'))); // Servir archivos estáticos desde el directorio 'public'

// Función para obtener el ID del perfil basado en el tipo de usuario (usado en el registro)
async function getPerfilId(tipoUsuario) {
  try {
    // Se busca por 'nombre' en el modelo Perfil, que es el campo que contiene 'Administrador', 'Usuario', etc.
    const perfil = await Perfil.findOne({ where: { nombre: tipoUsuario } });
    return perfil ? perfil.id : null;
  } catch (error) {
    console.error("Error al obtener ID de perfil:", error);
    throw new Error("No se pudo obtener el ID del perfil.");
  }
}

// Ruta para el registro de usuarios
app.post("/api/registro", upload.none(), async (req, res) => {
  try {
    const {
      primer_nombre, segundo_nombre, primer_apellido,
      segundo_apellido, tipo_documento, numero_documento,
      correo, clave, celular, rol
    } = req.body;

    // Verificar si el correo o el número de documento ya existen
    const usuarioExistente = await Usuario.findOne({
      where: {
        [Op.or]: [{ correo: correo }, { numero_documento: numero_documento }]
      }
    });

    if (usuarioExistente) {
      return res.status(409).json({ mensaje: "El correo o el número de documento ya están registrados." });
    }

    const hashedPassword = await bcrypt.hash(clave, 10);
    const perfilId = await getPerfilId(rol);

    if (!perfilId) {
      return res.status(400).json({ mensaje: "Rol de usuario inválido." });
    }

    const nuevoUsuario = await Usuario.create({
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      tipo_documento,
      numero_documento,
      correo,
      clave: hashedPassword,
      celular,
      PERFIL_id: perfilId // Asignar el ID del perfil
    });

    res.status(201).json({ mensaje: "Usuario registrado con éxito.", usuario: nuevoUsuario });
  } catch (error) {
    console.error("Error en el registro de usuario:", error);
    res.status(500).json({ mensaje: "Error interno del servidor durante el registro." });
  }
});

// Ruta para el login de usuarios
app.post("/api/login", upload.none(), async (req, res) => {
  const { correo, clave } = req.body;
  try {
    const usuario = await Usuario.findOne({
      where: { correo: correo },
      include: [{ model: Perfil, as: 'perfil' }] // Incluir el perfil para obtener el rol
    });

    if (!usuario) {
      return res.status(401).json({ mensaje: "Credenciales inválidas." });
    }

    const isMatch = await bcrypt.compare(clave, usuario.clave);
    if (!isMatch) {
      return res.status(401).json({ mensaje: "Credenciales inválidas." });
    }

    // --- AJUSTE CLAVE AQUÍ: Enviar las propiedades del usuario directamente en la respuesta ---
    // Esto coincide con la expectativa de login.js de que 'data.id', 'data.rol', etc. existan.
    res.status(200).json({
      mensaje: "Inicio de sesión exitoso.",
      id: usuario.id,
      primer_nombre: usuario.primer_nombre,
      apellidos: `${usuario.primer_apellido} ${usuario.segundo_apellido || ''}`.trim(),
      correo: usuario.correo,
      rol: usuario.perfil ? usuario.perfil.nombre : 'Desconocido', // Obtener el nombre del rol
      identificacion: usuario.numero_documento, // Añadir identificación
      telefono: usuario.celular // Añadir teléfono
      // No se incluyen placa, celda, fecha aquí, ya que no son propiedades directas del usuario en el login.
      // Si se necesitan, deben obtenerse en el frontend después de un login exitoso.
    });

  } catch (error) {
    console.error("Error en el inicio de sesión:", error);
    res.status(500).json({ mensaje: "Error interno del servidor durante el inicio de sesión." });
  }
});

// Endpoint para registrar un nuevo vehículo (reutilizando el controlador)
app.post("/api/vehiculos", upload.none(), registrarVehiculo);

// Endpoint para obtener el estado actual de las celdas
app.get('/api/celdas/estado', async (req, res) => {
  try {
    const celdas = await Celda.findAll();
    const ocupadas = celdas.filter(celda => celda.estado === 'ocupado').length;
    const libres = celdas.filter(celda => celda.estado === 'libre').length;
    const total = celdas.length;

    res.json({
      ocupadas: ocupadas,
      libres: libres,
      total: total,
      detalles: celdas.map(celda => ({
        id: celda.id,
        nombre: celda.nombre,
        tipo: celda.tipoVehiculo,
        estado: celda.estado
      }))
    });
  } catch (error) {
    console.error("Error al obtener el estado de las celdas:", error);
    res.status(500).json({ mensaje: "Error interno del servidor al obtener el estado de las celdas." });
  }
});

// Endpoint para registrar la entrada de un vehículo
app.post('/api/parqueo/entrada', upload.none(), parqueoController.registrarEntrada);

// Endpoint para registrar la salida de un vehículo
app.post('/api/parqueo/salida', upload.none(), parqueoController.registrarSalida);

// Endpoint para obtener vehículos actualmente estacionados
app.get('/api/parqueo/estacionados', async (req, res) => {
  try {
    const vehiculosEstacionados = await Entrada.findAll({
      where: { fecha_salida: null }, // Vehículos que aún no han salido
      include: [
        { model: Vehiculo, as: 'vehiculoInfo', attributes: ['placa'] },
        { model: Celda, as: 'celdaInfo', attributes: ['nombre'] }
      ]
    });

    const formattedVehiculos = vehiculosEstacionados.map(entrada => ({
      id: entrada.id,
      placa: entrada.vehiculoInfo ? entrada.vehiculoInfo.placa : 'N/A',
      celda: entrada.celdaInfo ? entrada.celdaInfo.nombre : 'N/A',
      horaIngreso: new Date(entrada.fecha_ingreso).toLocaleString()
    }));

    res.json(formattedVehiculos);
  } catch (error) {
    console.error("❌ Error al obtener los vehículos estacionados:", error);
    res.status(500).json({ mensaje: "Error interno del servidor al obtener los vehículos estacionados." });
  }
});

// Endpoint para obtener el historial completo de parqueo
app.get("/api/historial", async (req, res) => {
    try {
        const historial = await HistorialParqueo.findAll({
            include: [
                {
                    model: Usuario,
                    as: 'usuario',
                    attributes: ['primer_nombre', 'primer_apellido'] // Incluir el nombre del usuario
                },
                {
                    model: Vehiculo,
                    as: 'vehiculo',
                    attributes: ['placa'] // Incluir la placa del vehículo
                },
                {
                    model: Celda,
                    as: 'celda',
                    attributes: ['nombre'] // Incluir el nombre de la celda
                }
            ],
            order: [['fecha_ingreso', 'DESC']] // Ordenar por las entradas más recientes
        });

        // Mapear los datos a un formato más amigable para el frontend
        const formattedHistorial = historial.map(item => ({
            id: item.id,
            fecha_ingreso: item.fecha_ingreso,
            fecha_salida: item.fecha_salida,
            tiempo_estadia: item.tiempo_estadia,
            placa_vehiculo: item.vehiculo ? item.vehiculo.placa : 'N/A',
            nombre_celda: item.celda ? item.celda.nombre : 'N/A',
            usuario_nombre: item.usuario ? `${item.usuario.primer_nombre} ${item.usuario.primer_apellido || ''}`.trim() : 'N/A'
        }));

        res.json(formattedHistorial);
    } catch (error) {
        console.error("❌ Error al obtener el historial de parqueo:", error);
        res.status(500).json({ mensaje: "Error interno del servidor al obtener el historial." });
    }
});

// Ruta para el inicio de la aplicación
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Ruta para servir las páginas del panel de usuario y administrador
app.get("/index.html", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get("/panelAdmin.html", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panelAdmin.html'));
});

app.get("/CrearNuevoUsuario.html", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'CrearNuevoUsuario.html'));
});

app.get("/ListarUsuarios.html", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ListarUsuarios.html'));
});

app.get("/GestionCeldas.html", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'GestionCeldas.html'));
});

app.get("/GestionTarifas.html", (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'GestionTarifas.html'));
});

app.get("/historial.html", (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'historial.html'));
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express funcionando en http://localhost:${PORT}`);
});
