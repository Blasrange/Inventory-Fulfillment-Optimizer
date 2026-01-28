# Optimizador de Surtido de Inventario

Esta aplicación Next.js te ayuda a optimizar el reabastecimiento de tu inventario analizando los datos de ventas e inventario para generar sugerencias de surtido y archivos listos para tu WMS.

## Cómo ejecutar el proyecto localmente

Para ejecutar esta aplicación en tu computadora local usando Visual Studio Code, sigue estos pasos.

### Prerrequisitos

1.  **Node.js:** Asegúrate de tener instalado Node.js (versión 18 o superior). Puedes descargarlo desde [nodejs.org](https://nodejs.org/).
2.  **Editor de Código:** Visual Studio Code es recomendado.

### 1. Instalar Dependencias

Abre una terminal en la raíz del proyecto (puedes usar la terminal integrada de VS Code) y ejecuta el siguiente comando para instalar todos los paquetes necesarios:

```bash
npm install
```

### 2. Configurar Variables de Entorno

El framework de IA (Genkit) utilizado en este proyecto requiere una clave de API para inicializarse correctamente, aunque la lógica principal ahora se ejecuta localmente para mayor velocidad.

1.  Crea un archivo llamado `.env` en la raíz de tu proyecto.
2.  Añade la siguiente línea al archivo `.env`:

```
GEMINI_API_KEY=TU_API_KEY_AQUI
```

3.  Reemplaza `TU_API_KEY_AQUI` con una clave de API de Google AI. Puedes obtener una de forma gratuita en [Google AI Studio](https://aistudio.google.com/app/apikey).

### 3. Ejecutar los Servidores de Desarrollo

Necesitas ejecutar dos procesos en paralelo en dos terminales separadas.

**Terminal 1: Iniciar la aplicación Next.js (Frontend)**

```bash
npm run dev
```

Este comando iniciará la interfaz de usuario. Una vez que se inicie, estará disponible en **http://localhost:9002**.

**Terminal 2: Iniciar el servidor de Genkit (Backend)**

```bash
npm run genkit:dev
```

Este comando inicia el "motor" de análisis que procesa tus archivos. La interfaz de usuario se comunicará con este servicio en segundo plano.

### ¡Listo!

Ahora puedes abrir tu navegador en `http://localhost:9002` y usar la aplicación. ¡Asegúrate de que ambos servidores (Next.js y Genkit) sigan ejecutándose mientras trabajas!

git add . 
git commit -m "Actualización del proyecto" 
git push origin main

git add .; git commit -m "Actualización del proyecto"; git push origin main
