# 📦 Surtido Inteligente

Sistema de cruce y análisis de inventarios y ventas para optimizar el abastecimiento y generar archivos compatibles con el WMS.

Este proyecto fue desarrollado para mejorar el control de stock, reducir quiebres y apoyar la toma de decisiones en los procesos logísticos.

---

## 🚀 Características Principales

- Cruce automático entre inventario y ventas.
- Análisis de rotación de productos.
- Generación de sugerencias de surtido.
- Creación de archivos listos para cargar en el WMS.
- Interfaz web intuitiva.
- Procesamiento local de datos.

---

## 🛠️ Tecnologías Utilizadas

- Node.js
- Next.js
- JavaScript / TypeScript
- Genkit (motor de procesamiento)
- Git / GitHub

---

## 💻 Requisitos Previos

Antes de ejecutar el proyecto, asegúrate de tener instalado:

- Node.js (versión 18 o superior)
- Visual Studio Code u otro editor de código
- Git

Puedes descargar Node.js desde:
[https://nodejs.org/](https://nodejs.org/)

---

## 📥 Instalación

1. Clona el repositorio:

```bash
git clone <URL_DEL_REPOSITORIO>
```

2. Ingresa a la carpeta del proyecto:

```bash
cd surtido-inteligente
```

3. Instala las dependencias:

```bash
npm install
```

---

## ⚙️ Configuración de Variables de Entorno

1. En la raíz del proyecto, crea un archivo llamado `.env`.
2. Agrega la siguiente variable:

```
GEMINI_API_KEY=TU_API_KEY_AQUI
```

3. Reemplaza el valor por tu clave correspondiente.

> Nota: Esta variable es requerida para el funcionamiento interno del sistema.

---

## ▶️ Ejecución del Proyecto

El sistema requiere ejecutar dos procesos en paralelo.

### Terminal 1: Aplicación Web

```bash
npm run dev
```

La aplicación estará disponible en:

```
http://localhost:9002
```

---

### Terminal 2: Motor de Procesamiento

```bash
npm run genkit:dev
```

Este servicio se encarga del análisis de archivos y procesamiento de datos.

---

## 📂 Flujo de Uso

1. Inicia ambos servidores.
2. Ingresa a la aplicación desde el navegador.
3. Carga los archivos de inventario y ventas.
4. Ejecuta el análisis.
5. Revisa las sugerencias generadas.
6. Descarga los archivos para el WMS.

---

## 📤 Control de Versiones

Para guardar cambios en el repositorio:

```bash
git add .
git commit -m "Actualización del proyecto"
git push origin main
```

O en una sola línea:

```bash
git add .; git commit -m "Actualización del proyecto"; git push origin main
```

---

## 📈 Objetivo del Proyecto

Surtido Inteligente fue desarrollado con el objetivo de:

- Optimizar el manejo de inventarios.
- Reducir reprocesos.
- Mejorar la planificación de surtido.
- Apoyar las operaciones logísticas.
- Fortalecer la gestión de información.

---

## 👤 Autor

Desarrollado por: **Blas Rangel**

Área: Soporte y Sistemas Logísticos

---

## 📄 Licencia

Este proyecto es de uso interno. Su distribución o modificación debe ser autorizada por el desarrollador.
