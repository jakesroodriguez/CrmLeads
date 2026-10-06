# JRG Agency CRM — Sales Pipeline & Leads Management

Sistema interno de prospección comercial y pipeline de ventas para **JRG Agency** (https://jrgagency.eus). Centraliza la gestión de oportunidades, presupuestación rápida y seguimiento de clientes potenciales.

---

## 💼 Servicios y Tarifas

| Servicio | Modelo | Importe |
| :--- | :--- | :--- |
| **Desarrollo Web** | Pago único | **460 €** |
| **Chatbots IA (WhatsApp 24/7)** | Alta + Recurrente | **530 €** (+ **25 €/mes** de mantenimiento) |
| **Automatizaciones de Procesos** | Proyecto | **900 € – 1.400 €** (según complejidad) |

*El CRM permite la selección de múltiples servicios por cliente, calculando al instante el pago inicial y la cuota recurrente mensual (MRR).*

---

## 🚀 Características

- **Tablero Kanban:** Seguimiento en 6 fases (`INBOX / LEADS`, `CALIFICACIÓN`, `PROPUESTA ENVIADA`, `EN SPRINT`, `CERRADO GANADO` y `EN ESPERA`).
- **Generador de Propuestas & WhatsApp:** Redacción instantánea de mensajes comerciales con desglose exacto de servicios y precios para enviar con un clic.
- **Métricas:** Dashboard con valor total de pipeline (pago único), ingresos recurrentes mensuales (MRR), volumen de leads y distribución por servicios.
- **Configurador de Servicios:** Checkboxes independientes y selector interactivo para ajustar presupuestos de automatización entre 900 € y 1.400 €.
- **Exportación:** Descarga completa de leads filtrados a formato CSV/Excel.
- **Control de Acceso:** Pasarela de autenticación previa para proteger los datos comerciales del equipo.
- **Persistencia Local:** Sincronización continua de estados, presupuestos y notas privadas en LocalStorage.

---

## 🛠️ Stack Técnico

- **Frontend:** HTML5 Semántico, CSS3 (Grid & Flexbox), Vanilla JavaScript (ES6+).
- **Tipografía:** Geist & Geist Mono.
- **Datos:** Dataset estructurado en `leads_data.js` con soporte para persistencia en cliente.
- **Compatibilidad:** Despliegue estático en Vercel, Netlify, Cloudflare Pages o ejecución local.

---

## 📦 Estructura del Proyecto

```text
├── assets/
│   └── logo.png          # Logotipo oficial JRG Agency
├── index.html            # Interfaz principal de la aplicación
├── crm_styles.css        # Hoja de estilos y componentes UI
├── crm_app.js            # Controlador del CRM, pipeline y cálculos
├── leads_data.js         # Base de datos comercial consolidada
├── vercel.json           # Configuración para despliegue en Vercel
└── README.md             # Documentación técnica
```

---

## 🌐 Despliegue

### En la nube (Vercel)
1. Conectar el repositorio en [Vercel](https://vercel.com).
2. Framework Preset: **Other**.
3. El archivo `vercel.json` configurará las rutas automáticamente.

### En local
Abrir directamente `index.html` en cualquier navegador web moderno.
