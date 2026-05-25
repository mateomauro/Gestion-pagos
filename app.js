// Envolvemos todo en DOMContentLoaded para garantizar que el DOM y los scripts CDN estén listos
document.addEventListener('DOMContentLoaded', () => {

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://fcnvjpioswuiyogjjwlp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZjbnZqcGlvc3d1aXlvZ2pqd2xwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NTM0OTUsImV4cCI6MjA5NDUyOTQ5NX0.1NtMQSHYw-euiiF2Qb0PFKiaEda2J0-bf0Dg4uSDBhk';

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let clients = [];
let services = [];
let receipts = [];
let currentUser = null;

let wpTemplates = {
    pending: 'Hola {nombre}, te recuerdo que tu pago por "{servicio}" (${monto}) vence el {vencimiento}. ¡Gracias!',
    overdue: 'Hola {nombre}, te escribo para recordarte que tu pago por "{servicio}" (${monto}) venció el {vencimiento}. Por favor avísame cuando puedas regularizarlo. ¡Gracias!'
};

// --- AUTENTICACIÓN ---
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');

// Crear cuenta con Google
document.getElementById('btn-google-login').addEventListener('click', async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + '/app.html'
        }
    });
    if (error) showToast('Error al iniciar sesión con Google: ' + error.message, 'error');
});

// --- SUSCRIPCIONES ---
const SUPPORT_WP_BASE = 'https://wa.me/5492494374128';

// Devuelve { expired, daysLeft, tipo } o { expired: false, daysLeft: null } si no se puede determinar
const checkSubscription = async (userId) => {
    const { data, error } = await supabase
        .from('suscripciones')
        .select('tipo, vence_el')
        .eq('usuario_id', userId)
        .maybeSingle();

    if (error) {
        console.error('Error chequeando suscripción:', error);
        // Fail-open: no bloquear si hay un error transitorio
        return { expired: false, daysLeft: null, tipo: null };
    }

    if (!data) {
        // El trigger debería haberle creado una. Si no hay, bloquear (no romper la app).
        return { expired: true, daysLeft: 0, tipo: null };
    }

    if (data.tipo === 'cancelado') {
        return { expired: true, daysLeft: 0, tipo: 'cancelado' };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = data.vence_el.split('-');
    const venceDate = new Date(year, month - 1, day);
    venceDate.setHours(0, 0, 0, 0);

    const diffMs = venceDate - today;
    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
        expired: daysLeft <= 0,
        daysLeft,
        tipo: data.tipo
    };
};

const showTrialBanner = ({ daysLeft, tipo }) => {
    const banner = document.getElementById('trial-banner');
    const text = document.getElementById('trial-banner-text');
    const cta = document.getElementById('trial-banner-cta');
    if (!banner || daysLeft === null) return;

    // Si es pago y faltan más de 7 días, no mostrar nada
    if (tipo === 'pago' && daysLeft > 7) {
        banner.style.display = 'none';
        return;
    }

    const warning = daysLeft <= 7;
    banner.classList.toggle('warning', warning);

    if (tipo === 'pago') {
        text.textContent = `Tu plan vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}. Renová para no perder el acceso.`;
        cta.textContent = 'Renovar';
        cta.href = `${SUPPORT_WP_BASE}?text=${encodeURIComponent('Hola Mateo, quiero renovar mi plan de CobroGest')}`;
    } else {
        text.textContent = `Te quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'} de prueba gratis.`;
        cta.textContent = 'Pasar a plan pago';
        cta.href = `${SUPPORT_WP_BASE}?text=${encodeURIComponent('Hola Mateo, quiero pasar mi cuenta de CobroGest a plan pago')}`;
    }

    banner.style.display = 'flex';
};

const showExpiredScreen = ({ tipo }) => {
    document.getElementById('main-app').style.display = 'none';
    loginScreen.classList.remove('active');
    document.getElementById('expired-overlay').style.display = 'flex';

    if (tipo === 'cancelado') {
        document.getElementById('expired-title').textContent = 'Tu cuenta está pausada';
        document.getElementById('expired-message').textContent = 'Tu acceso fue suspendido temporalmente. Si pensás que es un error, escribime por WhatsApp y lo revisamos.';
    }
};

// Handlers de la pantalla bloqueada
document.getElementById('btn-expired-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    document.getElementById('expired-overlay').style.display = 'none';
    location.reload();
});

document.getElementById('btn-expired-export').addEventListener('click', async () => {
    if (!currentUser) return showToast('No hay sesión activa', 'error');

    const btn = document.getElementById('btn-expired-export');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="ph ph-spinner"></i> Generando…';
    btn.disabled = true;

    try {
        const [clientesRes, pagosRes] = await Promise.all([
            supabase.from('clientes')
                .select('id, nombre, telefono, servicio, monto_mensual, fecha_vencimiento, estado, fecha_creacion')
                .eq('usuario_id', currentUser.id),
            supabase.from('pagos')
                .select('id, cliente_id, monto_pagado, metodo_pago, fecha_pago')
                .eq('usuario_id', currentUser.id)
        ]);

        if (clientesRes.error || pagosRes.error) throw new Error('Error consultando Supabase');

        const clientes = clientesRes.data || [];
        const pagos = pagosRes.data || [];
        const statusNames = { 'al_dia': 'Al día', 'pendiente': 'Pendiente', 'vencido': 'Vencido' };
        const sections = [];

        sections.push('# CLIENTES');
        sections.push(['Nombre','Telefono','Servicio','Monto','Vencimiento','Estado','Creado']
            .map(h => `"${h}"`).join(','));
        clientes.forEach(c => {
            sections.push([
                c.nombre, c.telefono || '', c.servicio,
                c.monto_mensual, c.fecha_vencimiento,
                statusNames[c.estado] || c.estado, c.fecha_creacion || ''
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        });

        sections.push('');
        sections.push('# HISTORIAL DE PAGOS');
        sections.push(['Cliente','Monto','Metodo','Fecha']
            .map(h => `"${h}"`).join(','));
        const clientesById = Object.fromEntries(clientes.map(c => [c.id, c.nombre]));
        pagos.forEach(p => {
            sections.push([
                clientesById[p.cliente_id] || '(cliente eliminado)',
                p.monto_pagado, p.metodo_pago || '', p.fecha_pago
            ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        });

        const csvContent = sections.join('\n');
        const BOM = '﻿';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `cobrogest_backup_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        showToast(`Backup descargado: ${clientes.length} clientes, ${pagos.length} pagos 📦`);
    } catch (err) {
        console.error(err);
        showToast('Error generando el backup. Probá de nuevo.', 'error');
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
});

// Listener de estado de autenticación
supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[DEBUG] Auth event:', event, 'session?:', !!session);
    if (session) {
        const user = session.user;
        currentUser = user;
        console.log('[DEBUG] User ID:', user.id, 'email:', user.email);

        // --- Chequear suscripción ANTES de mostrar la app ---
        const sub = await checkSubscription(user.id);
        console.log('[DEBUG] Subscription result:', sub);
        if (sub.expired) {
            console.log('[DEBUG] Mostrando pantalla bloqueada');
            showExpiredScreen({ tipo: sub.tipo });
            return;
        }

        loginScreen.classList.remove('active');
        mainApp.style.display = 'flex';
        document.getElementById('expired-overlay').style.display = 'none';

        // Banner de días restantes si corresponde
        showTrialBanner(sub);

        const name = user.user_metadata?.full_name || user.email.split('@')[0];
        const avatar = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff`;

        document.querySelector('.user-name').textContent = name;
        const avatarEl = document.querySelector('.avatar');
        avatarEl.src = avatar;
        avatarEl.style.visibility = 'visible';

        loadData();
        loadServices();
        loadReceipts();
        loadTemplates();
    } else {
        currentUser = null;
        loginScreen.classList.add('active');
        mainApp.style.display = 'none';
        document.getElementById('expired-overlay').style.display = 'none';
        document.getElementById('trial-banner').style.display = 'none';
        clients = []; services = []; receipts = [];
    }
});

// --- Login con Email/Contraseña ---
document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const btn = document.getElementById('btn-login');
    btn.textContent = 'Ingresando...';
    btn.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    btn.textContent = 'Ingresar';
    btn.disabled = false;
    if (error) showToast('Error: ' + error.message, 'error');
});

// --- Crear Cuenta con Email ---
document.getElementById('btn-register').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    if (!email || password.length < 6) return showToast('Completá el email y una contraseña de al menos 6 caracteres', 'error');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) showToast('Error: ' + error.message, 'error');
    else showToast('¡Cuenta creada! Ya podés ingresar 🎉', 'success');
});

// --- Cerrar Sesión ---
document.getElementById('btn-logout').addEventListener('click', async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signOut();
    if (error) showToast('Error al cerrar sesión: ' + error.message, 'error');
});


// --- BASE DE DATOS (CRUD) ---
const loadData = async () => {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('clientes')
        .select('id, usuario_id, nombre, telefono, servicio, monto_mensual, fecha_vencimiento, estado, fecha_creacion')
        .eq('usuario_id', currentUser.id)
        .order('fecha_creacion', { ascending: false });

    console.log('[DEBUG] loadData →', { count: data?.length, error });

    if (error) {
        console.error('Error cargando clientes:', error);
        showToast('Error de conexión con la base de datos', 'error');
        return;
    }

    if (!data) {
        clients = [];
        updateUI();
        return;
    }

    // Auto-detección de vencidos: calcular promociones
    const today = new Date();
    today.setHours(0,0,0,0);

    const promotions = []; // { client, estadoAnterior, estadoNuevo }
    for (let c of data) {
        if (!c.fecha_vencimiento) continue;
        const [year, month, day] = c.fecha_vencimiento.split('-');
        const dueDate = new Date(year, month - 1, day);
        dueDate.setHours(0,0,0,0);

        if (dueDate < today) {
            if (c.estado === 'al_dia') {
                promotions.push({ client: c, estadoAnterior: 'al_dia', estadoNuevo: 'pendiente' });
            } else if (c.estado === 'pendiente') {
                promotions.push({ client: c, estadoAnterior: 'pendiente', estadoNuevo: 'vencido' });
            }
        }
    }

    // Persistir promociones primero; aplicar en memoria solo las que tuvieron éxito
    if (promotions.length > 0) {
        const results = await Promise.allSettled(
            promotions.map(p =>
                supabase.from('clientes')
                    .update({ estado: p.estadoNuevo })
                    .eq('id', p.client.id)
                    .eq('usuario_id', currentUser.id)
            )
        );

        let failures = 0;
        results.forEach((res, i) => {
            const failed = res.status === 'rejected' || (res.value && res.value.error);
            if (failed) {
                failures++;
                console.error('Error promoviendo estado:', promotions[i], res);
            } else {
                promotions[i].client.estado = promotions[i].estadoNuevo;
            }
        });

        if (failures > 0) {
            showToast(`${failures} estado${failures > 1 ? 's' : ''} no se pudieron actualizar`, 'error');
        }
    }

    clients = data;
    updateUI();
};


// --- UTILIDADES UI ---
// Escapa HTML para prevenir XSS al interpolar datos de usuario en innerHTML
const escapeHtml = (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
};

const formatDate = (dateString) => {
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

const getInitials = (name) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

const translateStatus = (status) => {
    return { 'al_dia': 'Al día', 'pendiente': 'Pendiente', 'vencido': 'Vencido' }[status] || status;
};

// Acepta YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, con años de 2 o 4 dígitos
// Devuelve null si no se puede parsear o la fecha es inválida (ej: 31 de febrero)
const parseFlexibleDate = (raw) => {
    if (!raw) return null;
    raw = String(raw).trim();

    // ISO directa
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const d = new Date(raw + 'T00:00:00');
        return isNaN(d.getTime()) ? null : raw;
    }

    // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (formato argentino)
    const m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (!m) return null;

    let [, day, month, year] = m;
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');
    if (year.length === 2) year = (parseInt(year, 10) > 50 ? '19' : '20') + year;

    const iso = `${year}-${month}-${day}`;
    const d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    // Verificar que no haya sobreflows (ej: 31/02/2024 → JS lo convierte en 02/03/2024)
    if (d.getDate() !== parseInt(day, 10) || d.getMonth() + 1 !== parseInt(month, 10)) return null;
    return iso;
};

// Limpia "$1.500,50", "1500", "1.500", "$ 2000", "ARS 1500.50" → número
const parseFlexibleAmount = (raw) => {
    if (raw === null || raw === undefined || raw === '') return NaN;
    let s = String(raw).trim();
    // Quitar símbolos de moneda, espacios y letras (ARS, $, etc)
    s = s.replace(/[^\d.,\-]/g, '');
    if (!s) return NaN;

    // Detectar si hay coma decimal (formato AR: 1.500,50) o no
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    if (lastComma > lastDot) {
        // Formato AR: punto = separador miles, coma = decimal
        s = s.replace(/\./g, '').replace(',', '.');
    } else if (lastDot > lastComma && (s.length - lastDot - 1) === 3 && lastComma === -1) {
        // Caso ambiguo "1.500" sin coma — asumir separador de miles
        s = s.replace(/\./g, '');
    }
    // Else: ya está OK (1500, 1500.50, 1,500 inglés sin decimales)
    s = s.replace(/,/g, '');

    const num = parseFloat(s);
    return isNaN(num) ? NaN : num;
};

// Mapeo flexible de estado desde texto libre
const normalizeEstado = (raw) => {
    if (!raw) return 'pendiente';
    const map = {
        'al dia': 'al_dia', 'al_dia': 'al_dia', 'al día': 'al_dia',
        'pagado': 'al_dia', 'paid': 'al_dia', 'cobrado': 'al_dia', 'pago': 'al_dia',
        'pendiente': 'pendiente', 'pending': 'pendiente', 'a cobrar': 'pendiente',
        'vencido': 'vencido', 'overdue': 'vencido', 'deudor': 'vencido',
        'debe': 'vencido', 'atrasado': 'vencido'
    };
    return map[String(raw).toLowerCase().trim()] || 'pendiente';
};

// --- GENERADOR DE RECIBO PDF ---
const generateReceiptPDF = ({ clientName, service, amount, method, paymentDate, nextDueDate, receiptId }) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ format: 'a5', unit: 'mm' });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header con barra de color
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 0, pageWidth, 28, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('CobroGest', 15, 15);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Comprobante de pago', 15, 22);

    const shortId = (receiptId || Math.random().toString(36)).replace(/-/g, '').substring(0, 8).toUpperCase();
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`#${shortId}`, pageWidth - 15, 18, { align: 'right' });

    // Cuerpo
    doc.setTextColor(40, 40, 40);
    let y = 45;

    const drawField = (label, value, valueSize = 12) => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(label, 15, y);
        doc.setFontSize(valueSize);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(String(value || '-'), 15, y + 6);
        y += 16;
    };

    drawField('FECHA DE EMISION', paymentDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }));
    drawField('CLIENTE', clientName, 14);
    drawField('SERVICIO', service);
    drawField('METODO DE PAGO', method);

    // Box monto
    y += 4;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(16, 185, 129);
    doc.roundedRect(15, y, pageWidth - 30, 26, 3, 3, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129);
    doc.text('MONTO PAGADO', pageWidth / 2, y + 9, { align: 'center' });

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const amountStr = '$ ' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(amount);
    doc.text(amountStr, pageWidth / 2, y + 19, { align: 'center' });

    y += 36;

    if (nextDueDate) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(80, 80, 80);
        doc.text(`Proximo vencimiento: ${formatDate(nextDueDate)}`, pageWidth / 2, y, { align: 'center' });
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generado con CobroGest', pageWidth / 2, pageHeight - 10, { align: 'center' });

    const safeName = String(clientName).replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`recibo_${safeName}_${shortId}.pdf`);
};

// --- MODAL CONFIRMACIÓN CUSTOM ---
// Reemplaza al confirm() nativo del navegador. Devuelve Promise<boolean>.
const customConfirm = (message, { title = '¿Estás seguro?', confirmText = 'Confirmar', danger = true } = {}) => {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirm-modal');
        const acceptBtn = document.getElementById('confirm-accept-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        const closeBtn = document.getElementById('close-confirm-modal');

        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        acceptBtn.textContent = confirmText;
        if (danger) {
            acceptBtn.style.background = 'var(--status-overdue)';
            acceptBtn.style.borderColor = 'var(--status-overdue)';
        } else {
            acceptBtn.style.background = '';
            acceptBtn.style.borderColor = '';
        }

        const cleanup = (result) => {
            modal.classList.remove('active');
            acceptBtn.removeEventListener('click', onAccept);
            cancelBtn.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            resolve(result);
        };
        const onAccept = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onBackdrop = (e) => { if (e.target === modal) cleanup(false); };

        acceptBtn.addEventListener('click', onAccept);
        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);

        modal.classList.add('active');
    });
};

// --- TOAST NOTIFICATIONS ---
const showToast = (message, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'ph-check-circle',
        error: 'ph-x-circle',
        info: 'ph-info'
    };
    
    const iconEl = document.createElement('i');
    iconEl.className = `ph ${icons[type]}`;
    const spanEl = document.createElement('span');
    spanEl.textContent = message;
    toast.appendChild(iconEl);
    toast.appendChild(spanEl);
    
    container.appendChild(toast);
    
    // Forzar reflow para animación
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Eliminar después de 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};


// --- RENDERIZADO UI ---
const renderKPIs = () => {
    const dashboardEmpty = document.getElementById('dashboard-empty');
    const kpiGrid = document.getElementById('kpi-grid');

    if (clients.length === 0) {
        dashboardEmpty.style.display = 'flex';
        kpiGrid.style.display = 'none';
        return;
    }

    dashboardEmpty.style.display = 'none';
    kpiGrid.style.display = 'grid';

    let collected = 0, pending = 0, overdue = 0;

    clients.forEach(client => {
        if (client.estado === 'al_dia') collected += Number(client.monto_mensual);
        if (client.estado === 'pendiente') pending += Number(client.monto_mensual);
        if (client.estado === 'vencido') overdue += Number(client.monto_mensual);
    });

    const total = collected + pending + overdue;

    document.getElementById('kpi-total').textContent = formatCurrency(total);
    document.getElementById('kpi-collected').textContent = formatCurrency(collected);
    document.getElementById('kpi-pending').textContent = formatCurrency(pending);
    document.getElementById('kpi-overdue').textContent = formatCurrency(overdue);

    document.querySelector('.collected-bar').style.width = total ? `${(collected / total) * 100}%` : '0%';
    document.querySelector('.pending-bar').style.width = total ? `${(pending / total) * 100}%` : '0%';
    document.querySelector('.overdue-bar').style.width = total ? `${(overdue / total) * 100}%` : '0%';
};

const renderTable = () => {
    const filterStatus = document.getElementById('status-filter').value;
    const searchQuery = document.getElementById('search-input').value.toLowerCase();
    const tbody = document.getElementById('clients-tbody');
    const thead = document.querySelector('#view-clientes .clients-table thead');
    tbody.innerHTML = '';

    // Empty state cuando NO hay clientes (estado inicial)
    if (clients.length === 0) {
        if (thead) thead.style.display = 'none';
        tbody.innerHTML = `
            <tr><td colspan="6" style="padding: 0;">
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ph ph-users-three"></i></div>
                    <h2 class="empty-state-title">Cargá tu primer cliente</h2>
                    <p class="empty-state-text">Acá vas a ver el estado de cada alumno: quién pagó, quién debe y a quién reclamarle. Empezá agregando uno a mano o importá tu lista desde un CSV.</p>
                    <button class="btn-primary" onclick="document.getElementById('add-client-btn').click()">
                        <i class="ph ph-plus"></i> Agregar cliente
                    </button>
                </div>
            </td></tr>
        `;
        return;
    }

    if (thead) thead.style.display = '';

    const filterMap = { 'paid': 'al_dia', 'pending': 'pendiente', 'overdue': 'vencido' };
    const mappedFilter = filterMap[filterStatus] || filterStatus;

    const filteredClients = clients.filter(client => {
        const matchesStatus = filterStatus === 'all' || client.estado === mappedFilter;
        const matchesSearch = client.nombre.toLowerCase().includes(searchQuery);
        return matchesStatus && matchesSearch;
    });

    if (filteredClients.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 32px;">No se encontraron resultados para tu búsqueda</td></tr>`;
        return;
    }

    const statusOrder = { 'vencido': 1, 'pendiente': 2, 'al_dia': 3 };
    filteredClients.sort((a, b) => statusOrder[a.estado] - statusOrder[b.estado]);

    // Lógica para calcular días
    const getDaysData = (dueDateStr) => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const [year, month, day] = dueDateStr.split('-');
        const dueDate = new Date(year, month - 1, day);
        dueDate.setHours(0,0,0,0);
        
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return { text: `Hace ${Math.abs(diffDays)} días`, css: 'overdue' };
        if (diffDays === 0) return { text: `¡Vence hoy!`, css: 'warning' };
        if (diffDays <= 5) return { text: `En ${diffDays} días`, css: 'warning' };
        return { text: `En ${diffDays} días`, css: 'ok' };
    };

    const statusNames = {
        'vencido': '🔴 Vencidos',
        'pendiente': '🟡 Pendientes de Cobro',
        'al_dia': '🟢 Cobrados (Al Día)'
    };

    let currentGroup = '';

    filteredClients.forEach(client => {
        // Insertar encabezado de grupo si cambia el estado
        if (client.estado !== currentGroup) {
            currentGroup = client.estado;
            const trHeader = document.createElement('tr');
            trHeader.className = 'group-header';
            trHeader.innerHTML = `<td colspan="6">${statusNames[currentGroup]}</td>`;
            tbody.appendChild(trHeader);
        }

        const tr = document.createElement('tr');
        const cssClass = { 'al_dia': 'paid', 'pendiente': 'pending', 'vencido': 'overdue' }[client.estado] || 'pending';

        const safeId = escapeHtml(client.id);
        let actionHTML = client.estado !== 'al_dia'
            ? `<button class="action-btn" onclick="openPaymentModal('${safeId}')">Registrar Pago</button>`
            : `<span style="color: var(--text-secondary); font-size: 13px; display: inline-block; width: 105px;">Pagado <i class="ph ph-check"></i></span>`;

        if (client.telefono) {
            let wpText = client.estado === 'vencido' ? wpTemplates.overdue : wpTemplates.pending;
            const dateStr = formatDate(client.fecha_vencimiento);

            // Reemplazar variables
            wpText = wpText.replace(/{nombre}/g, client.nombre)
                           .replace(/{servicio}/g, client.servicio)
                           .replace(/{monto}/g, client.monto_mensual)
                           .replace(/{vencimiento}/g, dateStr);

            const wpUrl = `https://wa.me/${encodeURIComponent(client.telefono)}?text=${encodeURIComponent(wpText)}`;
            actionHTML += `<a href="${escapeHtml(wpUrl)}" target="_blank" rel="noopener noreferrer" class="action-btn wp-btn" title="Enviar WhatsApp"><i class="ph ph-whatsapp-logo"></i></a>`;
        }

        actionHTML += `<button class="action-btn" onclick="openClientHistory('${safeId}')" title="Ver historial de pagos" style="margin-left: 8px;"><i class="ph ph-clock-counter-clockwise"></i></button>`;
        actionHTML += `<button class="action-btn" onclick="openEditModal('${safeId}')" title="Editar" style="margin-left: 8px;"><i class="ph ph-pencil"></i></button>`;
        actionHTML += `<button class="action-btn delete-btn" onclick="deleteClient('${safeId}')" title="Eliminar"><i class="ph ph-trash"></i></button>`;

        const daysData = getDaysData(client.fecha_vencimiento);

        tr.innerHTML = `
            <td>
                <div class="client-cell">
                    <div class="client-avatar">${escapeHtml(getInitials(client.nombre))}</div>
                    <div>
                        <div class="client-name">${escapeHtml(client.nombre)}</div>
                        ${client.telefono ? `<div class="client-email">${escapeHtml(client.telefono)}</div>` : ''}
                    </div>
                </div>
            </td>
            <td>${escapeHtml(client.servicio)}</td>
            <td>
                <div>${formatDate(client.fecha_vencimiento)}</div>
                <div class="days-badge ${daysData.css}">${daysData.text}</div>
            </td>
            <td style="font-weight: 500;">${formatCurrency(client.monto_mensual)}</td>
            <td><span class="status-badge ${cssClass}">${translateStatus(client.estado)}</span></td>
            <td style="white-space: nowrap;">${actionHTML}</td>
        `;
        tbody.appendChild(tr);
    });
};

const updateUI = () => {
    renderKPIs();
    renderTable();
};


// --- MODAL PAGOS ---
const paymentModal = document.getElementById('payment-modal');

window.openPaymentModal = (id) => {
    const client = clients.find(c => c.id === id);
    if (!client) return;
    document.getElementById('payment-client-id').value = client.id;
    document.getElementById('payment-amount').value = client.monto_mensual;
    document.getElementById('payment-client-name').textContent = client.nombre;
    document.getElementById('payment-amount-display').textContent = formatCurrency(client.monto_mensual);
    document.getElementById('payment-method').value = 'Efectivo';
    paymentModal.classList.add('active');
};

const closePaymentModal = () => {
    paymentModal.classList.remove('active');
    document.getElementById('payment-form').reset();
};

document.getElementById('close-payment-modal').addEventListener('click', closePaymentModal);
document.getElementById('cancel-payment').addEventListener('click', closePaymentModal);

document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Procesando...';
    btn.disabled = true;

    const id = document.getElementById('payment-client-id').value;
    const amount = parseFloat(document.getElementById('payment-amount').value);
    const method = document.getElementById('payment-method').value;
    
    const client = clients.find(c => c.id === id);
    if(!client) {
        btn.textContent = originalText;
        btn.disabled = false;
        return;
    }

    // Calcular próxima fecha de vencimiento sumando 1 mes
    const [year, month, day] = client.fecha_vencimiento.split('-');
    const currentDue = new Date(year, month - 1, day);
    currentDue.setMonth(currentDue.getMonth() + 1);
    
    const newDueDate = currentDue.getFullYear() + '-' + 
                       String(currentDue.getMonth() + 1).padStart(2, '0') + '-' + 
                       String(currentDue.getDate()).padStart(2, '0');

    const { error: err1 } = await supabase
        .from('clientes')
        .update({ estado: 'al_dia', fecha_vencimiento: newDueDate })
        .eq('id', id)
        .eq('usuario_id', currentUser.id);
        
    if (err1) {
        btn.textContent = originalText;
        btn.disabled = false;
        return showToast('Error al actualizar: ' + err1.message, 'error');
    }

    await supabase.from('pagos').insert([{ 
        cliente_id: id, 
        usuario_id: currentUser.id, 
        monto_pagado: amount,
        metodo_pago: method
    }]);
    
    showToast('¡Pago registrado con éxito! 💵');
    loadReceipts(); 
    client.estado = 'al_dia';
    client.fecha_vencimiento = newDueDate;
    updateUI();
    closePaymentModal();
    
    btn.textContent = originalText;
    btn.disabled = false;

    // --- Abrir modal de recibo (PDF + opcional WhatsApp) ---
    const receiptModalEl = document.getElementById('receipt-modal');
    const receiptSummary = document.getElementById('receipt-summary');
    const receiptPreview = document.getElementById('receipt-preview');
    const sendBtn = document.getElementById('btn-send-receipt-wp');
    const pdfBtn = document.getElementById('btn-download-receipt-pdf');

    const paymentDate = new Date();
    const receiptDateStr = paymentDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const nextDueFormatted = formatDate(newDueDate);

    receiptSummary.innerHTML = `Se registró el pago de <strong style="color: var(--text-primary);">${escapeHtml(client.nombre)}</strong> por <strong style="color: #10b981;">${formatCurrency(amount)}</strong> vía ${escapeHtml(method)}.`;

    const receiptMsg = `✅ *Comprobante de Pago*\n\nHola ${client.nombre}, confirmamos tu pago:\n\n💰 Monto: $${amount}\n📋 Servicio: ${client.servicio}\n💳 Método: ${method}\n📅 Fecha: ${receiptDateStr}\n\n📌 Tu próximo vencimiento es el ${nextDueFormatted}.\n\n¡Gracias por tu pago! 🙌`;

    receiptPreview.textContent = receiptMsg.replace(/\*/g, '');

    if (client.telefono) {
        sendBtn.href = `https://wa.me/${client.telefono}?text=${encodeURIComponent(receiptMsg)}`;
        sendBtn.style.display = 'flex';
    } else {
        sendBtn.style.display = 'none';
    }

    pdfBtn.onclick = () => {
        generateReceiptPDF({
            clientName: client.nombre,
            service: client.servicio,
            amount: amount,
            method: method,
            paymentDate: paymentDate,
            nextDueDate: newDueDate
        });
        showToast('Recibo PDF descargado 📄');
    };

    receiptModalEl.classList.add('active');
});

window.deleteClient = async (id) => {
    if (!currentUser) return;
    const client = clients.find(c => c.id === id);
    const nombre = client ? client.nombre : 'este cliente';
    const ok = await customConfirm(`Vas a eliminar a "${nombre}" y todo su historial de pagos. Esta acción no se puede deshacer.`, {
        title: 'Eliminar cliente',
        confirmText: 'Sí, eliminar'
    });
    if (!ok) return;

    const { error } = await supabase.from('clientes').delete()
        .eq('id', id)
        .eq('usuario_id', currentUser.id);
    if (error) return showToast('Error al eliminar: ' + error.message, 'error');

    showToast('Cliente eliminado');

    clients = clients.filter(c => c.id !== id);
    updateUI();
};


// --- MODAL NUEVO CLIENTE ---
const modal = document.getElementById('client-modal');

window.openEditModal = (id) => {
    const client = clients.find(c => c.id === id);
    if (!client) return;

    document.getElementById('modal-title').textContent = 'Editar Cliente';
    document.getElementById('edit-client-id').value = client.id;
    document.getElementById('client-name').value = client.nombre;
    document.getElementById('client-phone').value = client.telefono || '';
    document.getElementById('client-plan').value = client.servicio;
    document.getElementById('client-amount').value = client.monto_mensual;
    document.getElementById('client-date').value = client.fecha_vencimiento;
    
    const reverseEstadoMap = { 'al_dia': 'paid', 'pendiente': 'pending', 'vencido': 'overdue' };
    document.getElementById('client-status').value = reverseEstadoMap[client.estado] || 'pending';
    
    document.getElementById('btn-save-client').textContent = 'Actualizar Datos';
    modal.classList.add('active');
};

const openModal = () => {
    document.getElementById('modal-title').textContent = 'Nuevo Cliente';
    document.getElementById('edit-client-id').value = '';
    document.getElementById('btn-save-client').textContent = 'Guardar Cliente';
    document.getElementById('add-client-form').reset();
    document.getElementById('client-date').valueAsDate = new Date();
    modal.classList.add('active');
};

const closeModal = () => {
    modal.classList.remove('active');
    setTimeout(() => {
        document.getElementById('add-client-form').reset();
        document.getElementById('edit-client-id').value = '';
    }, 300);
};

document.getElementById('add-client-btn').addEventListener('click', openModal);

// CTA del empty state del dashboard: cambiar a vista Clientes y abrir modal
document.getElementById('dashboard-empty-cta').addEventListener('click', () => {
    document.getElementById('nav-clientes').click();
    setTimeout(openModal, 150);
});
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('cancel-client').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

document.getElementById('add-client-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const editId = document.getElementById('edit-client-id').value;
    const estadoMap = { 'paid': 'al_dia', 'pending': 'pendiente', 'overdue': 'vencido' };

    // Recoger y normalizar inputs
    const nombre = document.getElementById('client-name').value.trim();
    const telefono = document.getElementById('client-phone').value.trim().replace(/\s+/g, '');
    const servicio = document.getElementById('client-plan').value;
    const monto = parseFloat(document.getElementById('client-amount').value);
    const fecha = document.getElementById('client-date').value;

    // Validaciones (defensa además de los `required` del HTML, que se pueden saltear)
    if (!nombre) return showToast('El nombre no puede estar vacío', 'error');
    if (nombre.length > 100) return showToast('El nombre es demasiado largo (máx. 100)', 'error');
    if (!telefono) return showToast('El teléfono no puede estar vacío', 'error');
    if (!/^[0-9+\-()]{6,20}$/.test(telefono)) return showToast('El teléfono no es válido (solo números, paréntesis o guiones, entre 6 y 20 caracteres)', 'error');
    if (!servicio) return showToast('Tenés que elegir un servicio', 'error');
    if (isNaN(monto) || monto <= 0) return showToast('El monto debe ser un número mayor a 0', 'error');
    if (monto > 100000000) return showToast('Monto demasiado alto', 'error');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return showToast('La fecha no es válida', 'error');
    const fechaDate = new Date(fecha + 'T00:00:00');
    if (isNaN(fechaDate.getTime())) return showToast('La fecha no es válida', 'error');

    const clientData = {
        usuario_id: currentUser.id,
        nombre,
        telefono,
        servicio,
        monto_mensual: monto,
        fecha_vencimiento: fecha,
        estado: estadoMap[document.getElementById('client-status').value] || 'pendiente'
    };

    if (editId) {
        // ACTUALIZAR
        const { data, error } = await supabase.from('clientes')
            .update(clientData)
            .eq('id', editId)
            .eq('usuario_id', currentUser.id)
            .select();
        
        if (error) {
            console.error('Error Supabase:', error);
            return showToast('Error al actualizar: ' + error.message, 'error');
        }
        
        if (data && data.length > 0) {
            const idx = clients.findIndex(c => c.id === editId);
            if (idx !== -1) clients[idx] = data[0];
            showToast('Datos actualizados correctamente');
        } else {
            await loadData();
            showToast('Datos actualizados');
        }
    } else {
        const btnSave = document.getElementById('btn-save-client');
        const originalText = btnSave.textContent;
        btnSave.textContent = 'Guardando...';
        btnSave.disabled = true;

        const { data, error } = await supabase.from('clientes').insert([clientData]).select();
        
        btnSave.textContent = originalText;
        btnSave.disabled = false;

        if (error) return showToast('Error al guardar: ' + error.message, 'error');
        
        if (data && data[0]) {
            clients.unshift(data[0]);
            showToast('¡Cliente registrado! 🚀');
        }
    }

    closeModal();
    updateUI();
});


// --- MODAL RECIBO WHATSAPP ---
const receiptModal = document.getElementById('receipt-modal');
document.getElementById('close-receipt-modal').addEventListener('click', () => receiptModal.classList.remove('active'));
document.getElementById('btn-skip-receipt').addEventListener('click', () => receiptModal.classList.remove('active'));
receiptModal.addEventListener('click', (e) => { if (e.target === receiptModal) receiptModal.classList.remove('active'); });

// --- MODAL HISTORIAL CLIENTE ---
const historyModal = document.getElementById('history-modal');
document.getElementById('close-history-modal').addEventListener('click', () => historyModal.classList.remove('active'));
historyModal.addEventListener('click', (e) => { if (e.target === historyModal) historyModal.classList.remove('active'); });

window.openClientHistory = async (id) => {
    const client = clients.find(c => c.id === id);
    if (!client) return;

    window._historyClient = client;

    document.getElementById('history-title').textContent = `Historial de ${client.nombre}`;
    const body = document.getElementById('history-body');
    body.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 32px;">Cargando...</p>';
    historyModal.classList.add('active');

    const { data, error } = await supabase
        .from('pagos')
        .select('id, monto_pagado, fecha_pago, metodo_pago')
        .eq('cliente_id', id)
        .eq('usuario_id', currentUser.id)
        .order('fecha_pago', { ascending: false });

    if (error) {
        body.innerHTML = '<p style="text-align: center; color: #ef4444; padding: 32px;">Error al cargar historial</p>';
        return;
    }

    const payments = data || [];
    window._historyPayments = payments;

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.monto_pagado), 0);
    const lastPayment = payments[0];
    const lastPaymentStr = lastPayment
        ? new Date(lastPayment.fecha_pago).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';

    let html = `
        <div class="history-stats-grid">
            <div class="history-stat">
                <span class="history-stat-label">Total pagado</span>
                <span class="history-stat-value" style="color: #10b981;">${formatCurrency(totalPaid)}</span>
            </div>
            <div class="history-stat">
                <span class="history-stat-label">Pagos</span>
                <span class="history-stat-value">${payments.length}</span>
            </div>
            <div class="history-stat">
                <span class="history-stat-label">Último pago</span>
                <span class="history-stat-value" style="font-size: 16px;">${lastPaymentStr}</span>
            </div>
        </div>
        <div style="background: rgba(99,102,241,0.08); border: 1px solid rgba(99,102,241,0.25); border-radius: 10px; padding: 12px 16px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
            <span style="color: var(--text-secondary); font-size: 13px;">Próximo vencimiento</span>
            <span style="font-weight: 600; color: #a5b4fc;">${formatDate(client.fecha_vencimiento)}</span>
        </div>
    `;

    if (payments.length === 0) {
        html += '<p style="text-align: center; color: var(--text-secondary); padding: 32px 16px 8px;">Este cliente todavía no tiene pagos registrados.</p>';
    } else {
        html += `
            <div class="table-responsive" style="margin-top: 20px; max-height: 320px; overflow-y: auto;">
                <table class="clients-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Monto</th>
                            <th>Método</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${payments.map(p => {
                            const dateObj = new Date(p.fecha_pago);
                            const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                            const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                            return `
                                <tr>
                                    <td>
                                        <div style="font-weight: 500;">${dateStr}</div>
                                        <div style="font-size: 12px; color: var(--text-secondary);">${timeStr} hs</div>
                                    </td>
                                    <td style="font-weight: 600; color: #10b981;">${formatCurrency(p.monto_pagado)}</td>
                                    <td><span style="font-size: 13px;">${escapeHtml(p.metodo_pago || '-')}</span></td>
                                    <td>
                                        <button class="action-btn pdf-btn" onclick="downloadReceiptFromHistory('${escapeHtml(p.id)}')" title="Descargar PDF">
                                            <i class="ph ph-file-pdf"></i> PDF
                                        </button>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    body.innerHTML = html;
};

window.downloadReceiptFromHistory = (paymentId) => {
    const payment = (window._historyPayments || []).find(p => p.id === paymentId);
    const client = window._historyClient;
    if (!payment || !client) return showToast('No se pudo generar el recibo', 'error');
    generateReceiptPDF({
        clientName: client.nombre,
        service: client.servicio,
        amount: payment.monto_pagado,
        method: payment.metodo_pago || 'Efectivo',
        paymentDate: new Date(payment.fecha_pago),
        receiptId: payment.id
    });
};

// Filtros y búsqueda
document.getElementById('status-filter').addEventListener('change', renderTable);
document.getElementById('search-input').addEventListener('input', renderTable);

// --- CONFIGURACIÓN DE SERVICIOS ---
const loadServices = async () => {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('servicios')
        .select('id, nombre, fecha_creacion')
        .eq('usuario_id', currentUser.id)
        .order('fecha_creacion', { ascending: true });

    if (error) {
        console.error('Error cargando servicios:', error);
        return;
    }
    
    services = data || [];
    renderServicesUI();
};

const renderServicesUI = () => {
    // Render Lista en Configuración
    const list = document.getElementById('services-list');
    list.innerHTML = '';

    if (services.length === 0) {
        const li = document.createElement('li');
        li.style.cssText = 'background: rgba(255,255,255,0.02); padding: 16px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.08); color: var(--text-secondary); font-size: 13px; text-align: center;';
        li.textContent = 'Todavía no creaste ningún servicio. Agregá uno arriba (ej: "Cuota mensual", "Clase suelta").';
        list.appendChild(li);
    }

    services.forEach(srv => {
        const li = document.createElement('li');
        li.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);';
        li.innerHTML = `
            <span>${escapeHtml(srv.nombre)}</span>
            <button class="action-btn delete-btn" onclick="deleteService('${escapeHtml(srv.id)}')" title="Eliminar"><i class="ph ph-trash"></i></button>
        `;
        list.appendChild(li);
    });

    // Render Select en Formulario Nuevo Cliente
    const select = document.getElementById('client-plan');
    select.innerHTML = '<option value="">Seleccioná un servicio...</option>';
    services.forEach(srv => {
        const opt = document.createElement('option');
        opt.value = srv.nombre;
        opt.textContent = srv.nombre;
        select.appendChild(opt);
    });
};

document.getElementById('btn-add-service').addEventListener('click', async () => {
    if (!currentUser) return;
    const input = document.getElementById('new-service-input');
    const val = input.value.trim();
    if (!val) return;
    if (val.length > 60) return showToast('El nombre del servicio es demasiado largo (máx. 60)', 'error');

    // Evitar duplicados
    if (services.find(s => s.nombre.toLowerCase() === val.toLowerCase())) {
        return showToast('Este servicio ya existe', 'info');
    }
    
    const btn = document.getElementById('btn-add-service');
    btn.textContent = '...';
    
    const { data, error } = await supabase
        .from('servicios')
        .insert([{ usuario_id: currentUser.id, nombre: val }])
        .select();
        
    btn.textContent = 'Agregar';

    if (error) return showToast('Error al guardar servicio: ' + error.message, 'error');
    
    showToast('Servicio agregado');
    
    if (data && data[0]) {
        services.push(data[0]);
        renderServicesUI();
        input.value = '';
    }
});

window.deleteService = async (id) => {
    if (!currentUser) return;
    const srv = services.find(s => s.id === id);
    const nombre = srv ? srv.nombre : 'este servicio';
    const ok = await customConfirm(`Vas a eliminar el servicio "${nombre}". Los clientes que ya lo tienen asignado no se ven afectados.`, {
        title: 'Eliminar servicio',
        confirmText: 'Sí, eliminar'
    });
    if (!ok) return;

    const { error } = await supabase.from('servicios').delete()
        .eq('id', id)
        .eq('usuario_id', currentUser.id);
    if (error) return showToast('Error al eliminar: ' + error.message, 'error');
    
    showToast('Servicio eliminado');
    
    services = services.filter(s => s.id !== id);
    renderServicesUI();
};

// --- CONFIGURACIÓN DE WHATSAPP ---
window.lastFocusedTextarea = null;

window.insertTag = (tag) => {
    if(!window.lastFocusedTextarea) {
        window.lastFocusedTextarea = document.getElementById('wp-template-pending');
    }
    
    const txtArea = window.lastFocusedTextarea;
    const start = txtArea.selectionStart;
    const end = txtArea.selectionEnd;
    const text = txtArea.value;
    
    txtArea.value = text.substring(0, start) + tag + text.substring(end);
    txtArea.focus();
    txtArea.selectionStart = txtArea.selectionEnd = start + tag.length;
};

const loadTemplates = async () => {
    if(!currentUser) return;
    
    const { data, error } = await supabase
        .from('configuraciones')
        .select('*')
        .eq('usuario_id', currentUser.id)
        .single();
        
    if (data) {
        if(data.wp_pendiente) wpTemplates.pending = data.wp_pendiente;
        if(data.wp_vencido) wpTemplates.overdue = data.wp_vencido;
    }
    
    document.getElementById('wp-template-pending').value = wpTemplates.pending;
    document.getElementById('wp-template-overdue').value = wpTemplates.overdue;
};

document.getElementById('btn-save-templates').addEventListener('click', async () => {
    wpTemplates.pending = document.getElementById('wp-template-pending').value;
    wpTemplates.overdue = document.getElementById('wp-template-overdue').value;
    
    const btn = document.getElementById('btn-save-templates');
    const originalText = btn.textContent;
    btn.textContent = 'Guardando...';
    
    const { error } = await supabase.from('configuraciones').upsert({
        usuario_id: currentUser.id,
        wp_pendiente: wpTemplates.pending,
        wp_vencido: wpTemplates.overdue
    });
    
    if (error) {
        showToast('Error al guardar en base de datos: ' + error.message, 'error');
        btn.textContent = originalText;
        return;
    }
    
    showToast('Configuración guardada con éxito');
    
    btn.textContent = '¡Guardado en la Nube!';
    btn.style.background = '#10b981';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
    }, 2000);
});

// --- RECIBOS (HISTORIAL) ---
const loadReceipts = async () => {
    if (!currentUser) return;

    const { data, error } = await supabase
        .from('pagos')
        .select(`
            id, monto_pagado, fecha_pago, metodo_pago,
            clientes (nombre, servicio)
        `)
        .eq('usuario_id', currentUser.id)
        .order('fecha_pago', { ascending: false });

    if (error) {
        console.error('Error cargando recibos:', error);
        return;
    }

    receipts = data || [];
    renderReceiptsTable();
};

const renderReceiptsTable = () => {
    const tbody = document.getElementById('receipts-tbody');
    const search = document.getElementById('search-receipts').value.toLowerCase();
    const thead = document.querySelector('#view-recibos .clients-table thead');
    tbody.innerHTML = '';

    // Empty state cuando no hay ningún pago registrado nunca
    if (receipts.length === 0) {
        if (thead) thead.style.display = 'none';
        tbody.innerHTML = `
            <tr><td colspan="6" style="padding: 0;">
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="ph ph-receipt"></i></div>
                    <h2 class="empty-state-title">Todavía no registraste pagos</h2>
                    <p class="empty-state-text">Cuando cobres a un cliente, el recibo va a aparecer acá. Vas a poder descargarlo en PDF o reenviarlo por WhatsApp cuando quieras.</p>
                </div>
            </td></tr>
        `;
        return;
    }

    if (thead) thead.style.display = '';

    // Filtrar por búsqueda
    const filtered = receipts.filter(r => {
        const clientName = r.clientes?.nombre || '';
        return clientName.toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 32px;">No se encontraron pagos para tu búsqueda</td></tr>`;
        return;
    }

    // Guardar cache para que el botón PDF pueda leer los datos
    window._receiptsCache = filtered;

    filtered.forEach(r => {
        const tr = document.createElement('tr');
        
        // Formatear fecha y hora
        const dateObj = new Date(r.fecha_pago);
        const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
        const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute:'2-digit' });
        
        const clientName = r.clientes?.nombre || 'Cliente Eliminado';
        const clientService = r.clientes?.servicio || '-';
        
        const methodIcons = {
            'Efectivo': '💵 Efectivo',
            'Transferencia': '🏦 Transferencia',
            'Tarjeta': '💳 Tarjeta'
        };
        const methodDisplay = methodIcons[r.metodo_pago] || r.metodo_pago || 'Efectivo';

        tr.innerHTML = `
            <td>
                <div style="font-weight: 500; color: var(--text-primary);">${dateStr}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${timeStr} hs</div>
            </td>
            <td>
                <div class="client-cell">
                    <div class="client-avatar">${escapeHtml(getInitials(clientName))}</div>
                    <div class="client-name">${escapeHtml(clientName)}</div>
                </div>
            </td>
            <td>${escapeHtml(clientService)}</td>
            <td>
                <span style="font-size: 13px; color: var(--text-secondary); background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px;">${escapeHtml(methodDisplay)}</span>
            </td>
            <td style="font-weight: 600; color: #10b981;">+ ${formatCurrency(r.monto_pagado)}</td>
            <td>
                <button class="action-btn pdf-btn" onclick="downloadReceiptFromList('${escapeHtml(r.id)}')" title="Descargar recibo PDF">
                    <i class="ph ph-file-pdf"></i> PDF
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
};

window.downloadReceiptFromList = (paymentId) => {
    const r = (window._receiptsCache || []).find(p => p.id === paymentId);
    if (!r) return showToast('Recibo no encontrado', 'error');
    generateReceiptPDF({
        clientName: r.clientes?.nombre || 'Cliente',
        service: r.clientes?.servicio || '-',
        amount: r.monto_pagado,
        method: r.metodo_pago || 'Efectivo',
        paymentDate: new Date(r.fecha_pago),
        receiptId: r.id
    });
};

document.getElementById('search-receipts').addEventListener('input', renderReceiptsTable);


// --- IMPORTAR / EXPORTAR CSV ---
document.getElementById('btn-import-csv').addEventListener('click', () => {
    document.getElementById('csv-file-input').click();
});

// Descargar plantilla CSV de ejemplo
document.getElementById('btn-template-csv').addEventListener('click', () => {
    const today = new Date();
    const futureDate = (days) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
    };

    const headers = ['Nombre', 'Telefono', 'Servicio', 'Monto', 'Vencimiento', 'Estado'];
    const samples = [
        ['Juan Pérez',     '5491123456789', 'Cuota mensual',       '15000', futureDate(10), 'Pendiente'],
        ['María González', '5491198765432', 'Pase libre deportivo','25000', futureDate(-5), 'Vencido'],
        ['Carlos Ramírez', '5491155667788', 'Clase suelta',        '5000',  futureDate(20), 'Al día']
    ];

    const csvContent = [headers, ...samples]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const BOM = '﻿';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_cobrogest.csv';
    link.click();
    URL.revokeObjectURL(url);

    showToast('Plantilla descargada — abrila en Excel para ver el formato 📋');
});

// Estado temporal del CSV en preview (entre selección de archivo y confirmación)
let csvPreviewState = null;

document.getElementById('csv-file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // permitir re-seleccionar mismo archivo
    if (!file) return;
    if (!currentUser) return showToast('Tenés que estar logueado para importar', 'error');

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length < 2) {
        showToast('El archivo CSV está vacío o solo tiene encabezados', 'error');
        return;
    }

    // Detectar separador (comma o semicolon)
    const separator = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase().replace(/"/g, ''));

    // Mapear columnas flexiblemente
    const findCol = (options) => headers.findIndex(h => options.some(o => h.includes(o)));
    const mapping = {
        nombre:       findCol(['nombre', 'name', 'alumno', 'cliente', 'apellido']),
        telefono:     findCol(['telefono', 'teléfono', 'tel', 'phone', 'whatsapp', 'celular', 'cel', 'movil']),
        servicio:     findCol(['servicio', 'plan', 'actividad', 'service']),
        monto:        findCol(['monto', 'precio', 'cuota', 'amount', 'valor', 'importe']),
        vencimiento:  findCol(['vencimiento', 'fecha', 'date', 'vence', 'venc']),
        estado:       findCol(['estado', 'status', 'situacion'])
    };

    if (mapping.nombre === -1) {
        showToast('No encontré la columna de Nombre. La primera fila tiene que ser encabezados.', 'error');
        return;
    }

    // Parsear y validar cada fila
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
        const errors = [];
        const warnings = [];

        const nombre = (cols[mapping.nombre] || '').trim();
        if (!nombre) errors.push('Nombre vacío');
        if (nombre.length > 100) errors.push('Nombre muy largo');

        let telefono = mapping.telefono !== -1 ? (cols[mapping.telefono] || '').trim().replace(/\s+/g, '') : '';
        if (telefono && !/^[0-9+\-()]{6,20}$/.test(telefono)) {
            errors.push('Teléfono inválido');
        }

        const servicio = mapping.servicio !== -1 ? ((cols[mapping.servicio] || '').trim() || 'General') : 'General';
        if (mapping.servicio === -1) warnings.push('Sin servicio → "General"');

        let monto = 0;
        if (mapping.monto === -1) {
            errors.push('Falta columna de monto');
        } else {
            const raw = cols[mapping.monto];
            monto = parseFlexibleAmount(raw);
            if (isNaN(monto) || monto <= 0) errors.push(`Monto inválido ("${raw || ''}")`);
            else if (monto > 100000000) errors.push('Monto muy alto');
        }

        let fecha = null;
        if (mapping.vencimiento === -1) {
            fecha = new Date().toISOString().split('T')[0];
            warnings.push('Sin fecha → hoy');
        } else {
            const raw = cols[mapping.vencimiento];
            fecha = parseFlexibleDate(raw);
            if (!fecha) errors.push(`Fecha inválida ("${raw || ''}")`);
        }

        const estado = mapping.estado !== -1 ? normalizeEstado(cols[mapping.estado]) : 'pendiente';

        rows.push({
            rowNum: i + 1, // +1 para que el usuario vea la fila real del CSV (1 = encabezado)
            nombre, telefono, servicio, monto, fecha, estado,
            errors, warnings,
            valid: errors.length === 0
        });
    }

    csvPreviewState = { rows, mapping, headers };
    renderCsvPreview();
    document.getElementById('csv-preview-modal').classList.add('active');
});

const renderCsvPreview = () => {
    if (!csvPreviewState) return;
    const { rows, mapping, headers } = csvPreviewState;

    // Info de mapeo
    const labels = {
        nombre: 'Nombre', telefono: 'Teléfono', servicio: 'Servicio',
        monto: 'Monto', vencimiento: 'Vencimiento', estado: 'Estado'
    };
    const mappingHtml = Object.entries(mapping).map(([key, idx]) => {
        const label = labels[key];
        if (idx === -1) return `<span style="color: var(--text-secondary);">${label}: <em>no detectado</em></span>`;
        return `<span><strong style="color: #a5b4fc;">${label}</strong> ← "${escapeHtml(headers[idx])}"</span>`;
    }).join(' · ');
    document.getElementById('csv-mapping-info').innerHTML = `
        <div style="margin-bottom: 6px; color: var(--text-secondary); font-size: 12px;">COLUMNAS DETECTADAS</div>
        <div style="line-height: 1.8;">${mappingHtml}</div>
    `;

    // Resumen
    const okCount = rows.filter(r => r.valid).length;
    const errCount = rows.length - okCount;
    document.getElementById('csv-summary').innerHTML = `
        <div class="csv-summary-card ok"><i class="ph ph-check-circle"></i><span><strong>${okCount}</strong> listos para importar</span></div>
        ${errCount > 0 ? `<div class="csv-summary-card err"><i class="ph ph-warning-circle"></i><span><strong>${errCount}</strong> con errores (se saltean)</span></div>` : ''}
    `;

    // Filas
    const tbody = document.getElementById('csv-preview-tbody');
    tbody.innerHTML = rows.map(r => {
        const cls = r.valid ? 'csv-row-ok' : 'csv-row-error';
        const result = r.valid
            ? `<span class="csv-ok-badge"><i class="ph ph-check"></i> Listo</span>`
            : r.errors.map(e => `<span class="csv-error-badge">${escapeHtml(e)}</span>`).join('');
        return `
            <tr class="${cls}">
                <td>${r.rowNum}</td>
                <td>${escapeHtml(r.nombre) || '<em>vacío</em>'}</td>
                <td>${escapeHtml(r.telefono) || '-'}</td>
                <td>${escapeHtml(r.servicio)}</td>
                <td>${isNaN(r.monto) || r.monto <= 0 ? '<span class="csv-cell-error">inválido</span>' : formatCurrency(r.monto)}</td>
                <td>${r.fecha ? formatDate(r.fecha) : '<span class="csv-cell-error">inválida</span>'}</td>
                <td>${translateStatus(r.estado)}</td>
                <td>${result}</td>
            </tr>
        `;
    }).join('');

    // Botón confirmar
    const confirmBtn = document.getElementById('confirm-csv-import');
    if (okCount === 0) {
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Nada para importar';
    } else {
        confirmBtn.disabled = false;
        confirmBtn.textContent = `Importar ${okCount} cliente${okCount === 1 ? '' : 's'}`;
    }
};

// Cerrar modal
const closeCsvPreview = () => {
    document.getElementById('csv-preview-modal').classList.remove('active');
    csvPreviewState = null;
};
document.getElementById('close-csv-preview').addEventListener('click', closeCsvPreview);
document.getElementById('cancel-csv-import').addEventListener('click', closeCsvPreview);
document.getElementById('csv-preview-modal').addEventListener('click', (e) => {
    if (e.target.id === 'csv-preview-modal') closeCsvPreview();
});

// Confirmar importación: insertar en batch
document.getElementById('confirm-csv-import').addEventListener('click', async () => {
    if (!csvPreviewState || !currentUser) return;

    const validRows = csvPreviewState.rows.filter(r => r.valid);
    if (validRows.length === 0) return;

    const btn = document.getElementById('confirm-csv-import');
    const originalText = btn.textContent;
    btn.textContent = 'Importando...';
    btn.disabled = true;

    const payload = validRows.map(r => ({
        usuario_id: currentUser.id,
        nombre: r.nombre,
        telefono: r.telefono,
        servicio: r.servicio,
        monto_mensual: r.monto,
        fecha_vencimiento: r.fecha,
        estado: r.estado
    }));

    // Insertar en chunks de 100 (por las dudas, para evitar timeouts en CSVs muy grandes)
    const chunkSize = 100;
    let imported = 0;
    let failed = 0;
    for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from('clientes').insert(chunk);
        if (error) {
            failed += chunk.length;
            console.error('Error en batch CSV:', error);
        } else {
            imported += chunk.length;
        }
    }

    btn.textContent = originalText;
    btn.disabled = false;

    if (failed > 0) {
        showToast(`Importados ${imported}, ${failed} fallaron al guardar. Revisá la consola.`, 'error');
    } else {
        showToast(`¡${imported} cliente${imported === 1 ? '' : 's'} importado${imported === 1 ? '' : 's'}! 🚀`);
    }

    closeCsvPreview();
    loadData();
});

document.getElementById('btn-export-csv').addEventListener('click', () => {
    if (clients.length === 0) {
        return showToast('No hay clientes para exportar', 'info');
    }
    
    const statusNames = { 'al_dia': 'Al día', 'pendiente': 'Pendiente', 'vencido': 'Vencido' };
    
    const headers = ['Nombre', 'Teléfono', 'Servicio', 'Monto', 'Vencimiento', 'Estado'];
    const rows = clients.map(c => [
        c.nombre,
        c.telefono || '',
        c.servicio,
        c.monto_mensual,
        c.fecha_vencimiento,
        statusNames[c.estado] || c.estado
    ]);
    
    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const dateStr = new Date().toISOString().split('T')[0];
    link.download = `clientes_cobrogest_${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast(`${clients.length} clientes exportados correctamente 📄`);
});

// Mes actual en header
const options = { month: 'long', year: 'numeric' };
const dateStr = new Date().toLocaleDateString('es-ES', options);
document.getElementById('current-month').textContent = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

// --- NAVEGACIÓN SIDEBAR ---
const navItems = document.querySelectorAll('.main-nav .nav-item[data-target]');
const appViews = document.querySelectorAll('.app-view');
const pageTitle = document.getElementById('page-title');

const addClientBtn = document.getElementById('add-client-btn');
const headerSubtitle = document.getElementById('header-subtitle');

const viewMeta = {
    'view-dashboard':     { title: 'Dashboard',           subtitle: true,  showAdd: false },
    'view-clientes':      { title: 'Gestión de Clientes', subtitle: true,  showAdd: true  },
    'view-recibos':       { title: 'Recibos (Historial)', subtitle: true,  showAdd: false },
    'view-configuracion': { title: 'Configuración',       subtitle: false, showAdd: false }
};

const applyViewMeta = (targetId) => {
    const meta = viewMeta[targetId] || viewMeta['view-dashboard'];
    pageTitle.textContent = meta.title;
    addClientBtn.style.display = meta.showAdd ? 'flex' : 'none';
    if (headerSubtitle) headerSubtitle.style.display = meta.subtitle ? '' : 'none';
};

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        // Ignorar el botón de cerrar sesión (se maneja arriba)
        if (item.id === 'btn-logout') return;

        e.preventDefault();

        // Ocultar todos
        navItems.forEach(nav => nav.classList.remove('active'));
        appViews.forEach(view => view.style.display = 'none');

        // Mostrar el seleccionado
        item.classList.add('active');
        const targetId = item.getAttribute('data-target');
        document.getElementById(targetId).style.display = 'block';

        applyViewMeta(targetId);
    });
});

// Estado inicial (Dashboard activo)
applyViewMeta('view-dashboard');

// Filtros desde Dashboard
window.goToFilteredClients = (statusValue) => {
    const navItem = document.getElementById('nav-clientes');
    if (navItem) {
        navItem.click(); // Cambia a la pestaña de clientes
        
        // Esperamos un poquito a que la vista cambie antes de aplicar el filtro
        setTimeout(() => {
            const statusFilter = document.getElementById('status-filter');
            if (statusFilter) {
                statusFilter.value = statusValue;
                renderTable();
            }
        }, 100);
    }
};

}); // Fin DOMContentLoaded
