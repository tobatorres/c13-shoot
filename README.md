# 📸 C13 Shoot — Captura de Pantalla Completa, Editor Pro y Grabador 4K

![Version](https://img.shields.io/badge/version-1.0.0-6366f1?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-10b981?style=for-the-badge)
![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-f59e0b?style=for-the-badge)
![Price](https://img.shields.io/badge/100%25_Gratis-Open_Source-ec4899?style=for-the-badge)

**C13 Shoot** es una extensión para Google Chrome / Brave / Edge creada para ofrecer **todas las funciones "Pro"** de captura de pantalla y grabación de vídeo de forma **100% gratuita, sin suscripciones, sin marcas de agua, sin cuentas obligatorias y 100% local en tu navegador**.

---

## ✨ Todo incluido y desbloqueado (Sin versión de pago)

### 1. 🖼️ Captura de Pantalla Inteligente
- **Parte Visible (`Alt+Shift+V`)**: Captura instantánea en máxima resolución de lo que estás viendo.
- **Seleccionar Área (`Alt+Shift+S`)**: Arrastra un recuadro con visor de medidas en píxeles (`ancho × alto`) y decide al instante si quieres **Editar**, **Copiar al portapapeles** o **Descargar PNG**.
- **Página Completa con Auto-Scroll (`Alt+Shift+F`)**:
  - Recorre automáticamente webs y periódicos largos de arriba a abajo.
  - **Anti-menús repetidos**: Detecta y oculta las barras de navegación fijas (`fixed` / `sticky`) tras el primer tramo para que no salgan repetidas en mitad de la captura.
  - **Limpieza inteligente**: Carga imágenes diferidas (`lazy-loading`), oculta la barra de scroll y pliega huecos vacíos de publicidad bloqueada.
- **Temporizador integrado**: Disparo en `0s`, `3s` o `5s`.

### 2. 🎨 Estudio de Edición y Anotaciones Pro
- **Herramientas de dibujo**: Flechas, cuadros, círculos, lápiz libre, marcador fluorescente y texto.
- **Pasos numerados (`1, 2, 3...`)**: Crea guías y tutoriales en segundos con un solo clic.
- **Privacidad (`Difuminar / Pixelar`)**: Oculta datos personales, contraseñas o precios antes de compartir.
- **Recortar y ✨ Marco Pro**: Recorta la captura o añádele un fondo degradado con sombra de estudio lista para redes sociales o presentaciones.
- **Exportación libre**: Copia al portapapeles en 1 clic, descarga en **PNG** o exporta directamente a **PDF Pro** multipágina/ajustado sin marcas de agua.

### 3. 🎥 Grabador de Vídeo 4K Pro
- Graba **Escritorio completo, Ventana o Pestaña** en **720p, 1080p o 4K Ultra HD a 60 FPS**.
- Mezcla en vivo **Audio del Sistema + Micrófono**.
- **Cámara flotante (Picture-in-Picture)** y sin límite de minutos.

---

## 🚀 Cómo instalar C13 Shoot gratis en 30 segundos

1. Descarga este repositorio (botón verde **`<> Code`** ➔ **`Download ZIP`**) y descomprímelo en tu ordenador.
2. Abre Google Chrome (o Brave / Edge) y escribe en la barra de direcciones:
   ```text
   chrome://extensions/
   ```
3. Activa el interruptor **Modo de desarrollador** (*Developer mode*) arriba a la derecha.
4. Haz clic en **Cargar descomprimida** (*Load unpacked*) arriba a la izquierda y selecciona la carpeta `c13-shoot`.
5. ¡Listo! Fija el icono morado de **C13 Shoot** 📌 en tu barra superior y empieza a capturar.

---

## 🗂️ Estructura del Código (Vanilla JS • Cero Dependencias)

```text
c13-shoot/
├── manifest.json              # Configuración Manifest V3 y permisos locales
├── background/
│   └── service-worker.js      # Orquestador de capturas, almacenamiento y atajos
├── content/
│   └── content.js             # Selector de área, Auto-Scroll inteligente y cosido HiDPI
├── popup/
│   ├── popup.html             # Interfaz principal de C13 Shoot
│   ├── popup.css
│   └── popup.js
├── studio/
│   ├── studio.html            # Estudio de anotaciones y exportador PNG / PDF Pro
│   ├── studio.css
│   └── studio.js
└── recorder/
    ├── recorder.html          # Grabador de pantalla 4K 60fps + Webcam PiP
    ├── recorder.css
    └── recorder.js
```

## 🔒 Privacidad Total
**C13 Shoot** no utiliza servidores externos, ni analíticas ocultas, ni sube tus capturas a la nube de terceros. Todo el procesamiento gráfico (cosido de páginas, edición y generación de PDF/vídeo) ocurre **100% dentro de la memoria de tu ordenador**.

## 📄 Licencia
Distribuido bajo licencia **MIT**. Libre para usar, estudiar, mejorar y compartir.
