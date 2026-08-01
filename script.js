// ==========================================
        // 1. LÓGICA DEL FONDO DE PARTÍCULAS
        //    Motor adaptativo: escala por densidad de píxeles (retina/4K), respeta
        //    prefers-reduced-motion, se pausa en pestañas ocultas para ahorrar batería/CPU,
        //    y ajusta la densidad de partículas al tamaño real y potencia del dispositivo.
        // ==========================================
        const canvas = document.getElementById('network-bg');
        canvas.setAttribute('aria-hidden', 'true');
        const ctx = canvas.getContext('2d', { alpha: false });
        let particles = [];
        let mouse = { x: null, y: null, radius: 150 };
        let animationFrameId = null;
        let cssWidth = window.innerWidth;
        let cssHeight = window.innerHeight;

        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
        const isTouchDevice = () => coarsePointerQuery.matches;

        // Núcleos de CPU disponibles como proxy simple de la potencia del dispositivo.
        // En equipos modestos o móviles reducimos la carga de partículas/conexiones.
        const devicePerformanceFactor = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ? 0.6 : 1;

        function getDevicePixelRatio() {
            // Se limita a 2x: en pantallas 3x/4x no aporta nitidez perceptible y sí mucho costo de render.
            return Math.min(window.devicePixelRatio || 1, 2);
        }

        function resizeCanvas() {
            cssWidth = window.innerWidth;
            cssHeight = window.innerHeight;
            const dpr = getDevicePixelRatio();
            canvas.width = Math.round(cssWidth * dpr);
            canvas.height = Math.round(cssHeight * dpr);
            canvas.style.width = cssWidth + 'px';
            canvas.style.height = cssHeight + 'px';
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        // Debounce del resize: evita recalcular en cada píxel mientras se redimensiona
        // la ventana o rota el dispositivo, lo cual sería costoso e innecesario.
        let resizeTimeout = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                resizeCanvas();
                initParticles();
            }, 150);
        });
        // Recalcula también al cambiar de orientación en móviles/tablets.
        window.addEventListener('orientationchange', () => {
            setTimeout(() => { resizeCanvas(); initParticles(); }, 200);
        });
        resizeCanvas();

        // El efecto de "atracción" con el cursor no aplica en pantallas táctiles (no hay hover real).
        if (!isTouchDevice()) {
            window.addEventListener('mousemove', function (event) {
                mouse.x = event.x;
                mouse.y = event.y;
            });
        }

        class Particle {
            constructor() {
                this.x = Math.random() * cssWidth;
                this.y = Math.random() * cssHeight;
                this.size = Math.random() * 2 + 1;
                this.speedX = Math.random() * 0.5 - 0.25;
                this.speedY = Math.random() * 0.5 - 0.25;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                if (this.x < 0 || this.x > cssWidth) this.speedX *= -1;
                if (this.y < 0 || this.y > cssHeight) this.speedY *= -1;
            }
            draw() {
                ctx.fillStyle = 'rgba(0, 242, 255, 0.8)';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function initParticles() {
            particles = [];
            // Densidad basada en el área visible en CSS px (no en píxeles físicos, que ya
            // están cubiertos por el DPR), con un techo para pantallas ultra-anchas/4K
            // y un recorte adicional en equipos de gama baja o móviles.
            const rawCount = (cssWidth * cssHeight) / 9000;
            const capped = Math.min(rawCount, 160);
            const numberOfParticles = Math.round(capped * devicePerformanceFactor);
            for (let i = 0; i < numberOfParticles; i++) {
                particles.push(new Particle());
            }
        }

        function connectParticles() {
            let opacityValue = 1;
            for (let a = 0; a < particles.length; a++) {
                for (let b = a; b < particles.length; b++) {
                    let distance = Math.sqrt((particles[a].x - particles[b].x) ** 2 + (particles[a].y - particles[b].y) ** 2);
                    if (distance < 120) {
                        opacityValue = 1 - (distance / 120);
                        ctx.strokeStyle = `rgba(0, 242, 255, ${opacityValue * 0.4})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(particles[b].x, particles[b].y);
                        ctx.stroke();
                    }
                }
                if (mouse.x !== null) {
                    let mouseDistance = Math.sqrt((particles[a].x - mouse.x) ** 2 + (particles[a].y - mouse.y) ** 2);
                    if (mouseDistance < 150) {
                        opacityValue = 1 - (mouseDistance / 150);
                        ctx.strokeStyle = `rgba(255, 77, 77, ${opacityValue})`;
                        ctx.lineWidth = 1.2;
                        ctx.beginPath();
                        ctx.moveTo(particles[a].x, particles[a].y);
                        ctx.lineTo(mouse.x, mouse.y);
                        ctx.stroke();
                    }
                }
            }
        }

        function drawStaticFrame() {
            // Para usuarios con "reducir movimiento" activado: un solo frame, sin animación
            // ni bucle de requestAnimationFrame, respetando su preferencia de accesibilidad.
            ctx.fillStyle = '#050a14';
            ctx.fillRect(0, 0, cssWidth, cssHeight);
            particles.forEach(p => p.draw());
        }

        function animateParticles() {
            ctx.fillStyle = '#050a14';
            ctx.fillRect(0, 0, cssWidth, cssHeight);
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
            }
            connectParticles();
            animationFrameId = requestAnimationFrame(animateParticles);
        }

        function startAnimation() {
            if (animationFrameId !== null) return;
            if (reducedMotionQuery.matches) {
                drawStaticFrame();
            } else {
                animateParticles();
            }
        }

        function stopAnimation() {
            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }

        // Pausa el motor de partículas cuando la pestaña no está visible: ahorra batería
        // y CPU en móviles, y evita animar de más cuando el usuario ni lo está viendo.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAnimation();
            } else {
                startAnimation();
            }
        });

        // Si el usuario cambia su preferencia de movimiento en tiempo real (algunos SO lo permiten
        // sin recargar), reaccionamos igual sin necesidad de refrescar la página.
        reducedMotionQuery.addEventListener('change', () => {
            stopAnimation();
            startAnimation();
        });

        initParticles();
        startAnimation();

        // ==========================================
        // 2. DATOS DEL PORTAFOLIO
        // ==========================================
        const data = {
            senati: {
                title: "SENATI",
                subtitle: "Ingeniería de Ciberseguridad",
                color: "#00f2ff",
                sections: {
                    resumen: { icon: "👤", title: "Resumen Técnico", content: `<p class="cv-paragraph">Estudiante de Ciberseguridad con más de un año de experiencia en instalación, configuración y mantenimiento de sistemas de videovigilancia (CCTV) y cableado estructurado. Cuento con conocimientos básicos en redes Cisco y Fortinet, enfocados en diagnóstico inicial, monitoreo y uso de comandos esenciales.</p><p class="cv-paragraph">Me destaco por mi responsabilidad, rápida adaptación, capacidad para resolver problemas técnicos y mi interés permanente en fortalecer mis habilidades en seguridad de redes. Busco oportunidades que me permitan seguir creciendo profesionalmente dentro del área de ciberseguridad y redes.</p>` },
                    experiencia: { 
                        icon: "💼", 
                        title: "Experiencia Profesional", 
                        content: `
                            <div class="exp-item">
                                <div class="exp-header">
                                    <h4 class="exp-role">Practicante (Ciberseguridad y Soporte)</h4>
                                    <span class="exp-date">Feb 2026 – Jun 2026</span>
                                </div>
                                <span class="exp-company">Colegio San Judas Tadeo - Lima</span>
                                <ul class="exp-list">
                                    <li>Apoyo en el mantenimiento de la infraestructura tecnológica de la institución.</li>
                                    <li>Instalación y mantenimiento de cableado estructurado para equipos de cómputo.</li>
                                    <li>Mantenimiento preventivo y correctivo de computadoras.</li>
                                    <li>Instalación, configuración y actualización de Microsoft Office y software institucional.</li>
                                    <li>Soporte técnico a usuarios y solución de incidencias de hardware y software.</li>
                                </ul>
                            </div>
                            <div class="exp-item">
                                <div class="exp-header">
                                    <h4 class="exp-role">Practicante Técnico (CCTV y Cableado)</h4>
                                    <span class="exp-date">Jul 2025 – Nov 2025</span>
                                </div>
                                <span class="exp-company">CISSEP S.R.L. - Huancayo</span>
                                <ul class="exp-list">
                                    <li>Instalación y configuración de cámaras de seguridad (CCTV).</li>
                                    <li>Cableado estructurado para cámaras y equipos de red.</li>
                                    <li>Mantenimiento preventivo y correctivo de sistemas de videovigilancia.</li>
                                    <li>Soporte técnico en campo y resolución de incidencias.</li>
                                    <li>Configuración básica de dispositivos y pruebas de conectividad.</li>
                                </ul>
                            </div>
                            <div class="exp-item">
                                <div class="exp-header">
                                    <h4 class="exp-role">Servicios Generales (CCTV, Cableado y Soporte)</h4>
                                    <span class="exp-date">Feb 2025 – Jun 2025</span>
                                </div>
                                <span class="exp-company">FGF S.A.C. - Huancayo</span>
                                <ul class="exp-list">
                                    <li>Soporte técnico básico a equipos de cómputo (PCs, laptops, periféricos).</li>
                                    <li>Instalación y configuración de sistemas operativos y software básico.</li>
                                    <li>Apoyo en cableado estructurado (ordenamiento, ponchado y verificación).</li>
                                    <li>Diagnóstico de fallas a nivel físico y de red (conectividad, puertos, cables).</li>
                                    <li>Configuración básica de red: IP, pruebas de conectividad (ping).</li>
                                </ul>
                            </div>
                            <div class="exp-item">
                                <div class="exp-header">
                                    <h4 class="exp-role">Asistente de Mecánica</h4>
                                    <span class="exp-date">Feb 2024 – Jul 2024</span>
                                </div>
                                <span class="exp-company">Motores S.A.C.</span>
                                <ul class="exp-list">
                                    <li>Apoyo en el mantenimiento preventivo y correctivo de buses y camiones diésel.</li>
                                    <li>Colaboración en el desmontaje y montaje de componentes mecánicos.</li>
                                    <li>Cambio y verificación de repuestos según indicaciones del técnico.</li>
                                    <li>Cumplimiento de normas de seguridad y limpieza del área de trabajo.</li>
                                </ul>
                            </div>
                        ` 
                    },
                    habilidades: { icon: "🛠", title: "Habilidades Técnicas", content: `<div class="skills-grid-cv"><div class="skill-group"><h5>Redes e Infraestructura</h5><ul><li>Instalación y Configuración de CCTV</li><li>Cableado Estructurado UTP y Fibra</li><li>Redes Cisco (CCNA) - Básico</li><li>Fortinet (Fortigate) - Básico</li><li>Pruebas de Conectividad (Ping, IP)</li></ul></div><div class="skill-group"><h5>Sistemas y Soporte</h5><ul><li>Soporte Técnico (Helpdesk)</li><li>Mantenimiento Preventivo y Correctivo</li><li>Windows OS y Microsoft Office</li><li>Instalación de Software Institucional</li><li>Programación Python (PCAP)</li></ul></div></div>` },
                    cursos: { icon: "📚", title: "Cursos", content: `<div class="block-card"><span class="block-tag">Semestre I (2023-1)</span><h4>Ciclo Inicial</h4><ul class="record-list"><li><span class="course-name">Matemática</span> <span class="grade">17.3</span></li><li><span class="course-name">Física y Química</span> <span class="grade">16.9</span></li><li><span class="course-name">Inglés I</span> <span class="grade">18.0</span></li><li><span class="course-name">Intro. a las Tecnologías de la Info.</span> <span class="grade">15.8</span></li><li><span class="course-name">Competencias Digitales</span> <span class="grade">15.3</span></li><li><span class="course-name">Lenguaje y Comunicación</span> <span class="grade">14.9</span></li><li><span class="course-name">Desarrollo Personal y Liderazgo</span> <span class="grade">18.4</span></li></ul></div><div class="block-card"><span class="block-tag">Semestre II (2023-2)</span><h4>Redes y Sistemas Iniciales</h4><ul class="record-list"><li><span class="course-name">Seguridad e Higiene Industrial</span> <span class="grade">17.2</span></li><li><span class="course-name">IT Essentials (Cisco)</span> <span class="grade">15.6</span></li><li><span class="course-name">Sistemas Operativos Windows</span> <span class="grade">15.2</span></li><li><span class="course-name">CCNA 7 M1: Intro to Networks (Cisco)</span> <span class="grade">17.0</span></li><li><span class="course-name">CCNA 7 M2: SRWE (Cisco)</span> <span class="grade">17.4</span></li><li><span class="course-name">Cybersecurity Essentials (Cisco)</span> <span class="grade">16.9</span></li><li><span class="course-name">Inglés II</span> <span class="grade">15.7</span></li></ul></div><div class="block-card"><span class="block-tag">Semestre III (2024-1)</span><h4>Administración y Programación</h4><ul class="record-list"><li><span class="course-name">Red Hat System Admin I (Linux)</span> <span class="grade">16.9</span></li><li><span class="course-name">CCNA 7 M3: ENSA (Cisco)</span> <span class="grade">15.2</span></li><li><span class="course-name">Fundamentos de Desarrollo Web</span> <span class="grade">14.9</span></li><li><span class="course-name">Algoritmia</span> <span class="grade">15.2</span></li><li><span class="course-name">Inglés III</span> <span class="grade">18.8</span></li><li><span class="course-name">Técnicas de la Comunicación</span> <span class="grade">14.8</span></li></ul></div><div class="block-card"><span class="block-tag">Semestre IV (2025-1)</span><h4>Servidores y Prácticas I</h4><ul class="record-list"><li><span class="course-name">Config. de Servicios con Windows</span> <span class="grade">16.4</span></li><li><span class="course-name">Red Hat System Admin II (Linux)</span> <span class="grade">14.4</span></li><li><span class="course-name">CCNA Cyber Ops (Cisco)</span> <span class="grade">14.4</span></li><li><span class="course-name">Lenguaje de Programación</span> <span class="grade">15.6</span></li><li><span class="course-name">Seguridad en Base de Datos</span> <span class="grade">13.1</span></li><li><span class="course-name">Formación Práctica en Empresa I</span> <span class="grade">12.9</span></li><li><span class="course-name">Seminario Complementación I</span> <span class="grade">15.1</span></li><li><span class="course-name">Desarrollo Humano</span> <span class="grade">15.8</span></li></ul></div><div class="block-card"><span class="block-tag">Semestre V (2025-2)</span><h4>Seguridad Perimetral y Prácticas II</h4><ul class="record-list"><li><span class="course-name">Calidad Total</span> <span class="grade">17.2</span></li><li><span class="course-name">Network Security (Cisco)</span> <span class="grade">17.0</span></li><li><span class="course-name">Criptografía Aplicada</span> <span class="grade">16.7</span></li><li><span class="course-name">Seguridad en Redes Inalámbricas</span> <span class="grade">17.8</span></li><li><span class="course-name">Fortigate Infrastructure (Fortinet)</span> <span class="grade">16.6</span></li><li><span class="course-name">Fortigate Security (Fortinet)</span> <span class="grade">16.0</span></li><li><span class="course-name">Formación Práctica en Empresa II</span> <span class="grade">12.0</span></li><li><span class="course-name">Seminario Complementación II</span> <span class="grade">14.5</span></li><li><span class="course-name">Inglés Técnico</span> <span class="grade">18.2</span></li></ul></div><div class="block-card"><span class="block-tag">Semestre VI (2026-1)</span><h4>Auditoría y Gestión de Amenazas</h4><ul class="record-list"><li><span class="course-name">Formación de Monitores de Empresa</span> <span class="grade">18.6</span></li><li><span class="course-name">Mejora de Métodos en el Trabajo</span> <span class="grade">14.4</span></li><li><span class="course-name">Taller de Integración en Ciberseguridad</span> <span class="grade">18.6</span></li><li><span class="course-name">Gestión Aplicada de Amenazas en Redes</span> <span class="grade">19.1</span></li><li><span class="course-name">Gestión de Servicios y Gobernabilidad TI</span> <span class="grade">19.2</span></li><li><span class="course-name">Normas y Estándares de Seguridad TI</span> <span class="grade">19.8</span></li><li><span class="course-name">Auditoría en Ciberseguridad</span> <span class="grade">18.4</span></li><li><span class="course-name">Formación Práctica en Empresa III</span> <span class="grade">17.5</span></li><li><span class="course-name">Seminario Complementación III</span> <span class="grade">19.0</span></li></ul></div>` },
                    certificados: { icon: "🏆", title: "Certificados", content: `<div class="year-header">📅 Año 2023</div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2023-get-connected.jpg" target="_blank"><img src="certs/senati-2023-get-connected.jpg" alt="Certificado Get Connected" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco Networking Academy</span><h4>Get Connected</h4><p>Certificado de logro (16 Feb 2023). Fundamentos de conectividad y primeros pasos en redes.</p></div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2023-introduction-iot.jpg" target="_blank"><img src="certs/senati-2023-introduction-iot.jpg" alt="Certificado Introduction to IoT" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco Networking Academy</span><h4>Introduction to IoT</h4><p>Certificado de logro (21 Feb 2023). Introducción al Internet de las Cosas y sus aplicaciones.</p></div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2023-entrepreneurship.jpg" target="_blank"><img src="certs/senati-2023-entrepreneurship.jpg" alt="Certificado Entrepreneurship" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco Networking Academy</span><h4>Entrepreneurship</h4><p>Certificado de logro (28 Feb 2023). Fundamentos de emprendimiento y modelos de negocio tecnológico.</p></div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2023-cybersecurity-essentials-1.jpg" target="_blank"><img src="certs/senati-2023-cybersecurity-essentials-1.jpg" alt="Certificado Cybersecurity Essentials" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco Networking Academy</span><h4>Cybersecurity Essentials</h4><p>Certificado de logro (14 Mar 2023). Principios fundamentales de la ciberseguridad y protección de datos.</p></div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2023-pcap-python.jpg" target="_blank"><img src="certs/senati-2023-pcap-python.jpg" alt="Certificado PCAP: Programming Essentials in Python" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco / OpenEDG</span><h4>PCAP: Programming Essentials in Python</h4><p>Certificado de logro (29 May 2023). Conceptos universales de programación, sintaxis de Python, OOP y resolución de problemas de implementación.</p></div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2023-networking-essentials.jpg" target="_blank"><img src="certs/senati-2023-networking-essentials.jpg" alt="Certificado Networking Essentials" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco Networking Academy</span><h4>Networking Essentials</h4><p>Certificado de logro (01 Jun 2023). Fundamentos de redes: direccionamiento IP, medios de transmisión y dispositivos de red.</p></div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2023-ccna-intro-networks.jpg" target="_blank"><img src="certs/senati-2023-ccna-intro-networks.jpg" alt="Certificado CCNAv7: Introduction to Networks" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco</span><h4>CCNAv7: Introduction to Networks</h4><p>Certificado de logro (22 Nov 2023). Arquitectura OSI y TCP/IP, subneteo y configuración básica de routers y switches.</p></div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2023-it-essentials.jpg" target="_blank"><img src="certs/senati-2023-it-essentials.jpg" alt="Certificado IT Essentials: PC Hardware and Software" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco Networking Academy</span><h4>IT Essentials: PC Hardware and Software</h4><p>Certificado de finalización (22 Nov 2023). Ensamblaje, reparación y actualización de PCs. Solución de problemas de SO Windows, redes móviles y seguridad básica.</p></div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2023-ccna-srwe.jpg" target="_blank"><img src="certs/senati-2023-ccna-srwe.jpg" alt="Certificado CCNAv7: Switching, Routing, and Wireless Essentials" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco</span><h4>CCNAv7: Switching, Routing, and Wireless Essentials</h4><p>Certificado de logro (23 Nov 2023). Configuración de VLANs, enrutamiento inter-VLAN, protocolos de enrutamiento dinámico y redes inalámbricas.</p></div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2023-cybersecurity-essentials-2.jpg" target="_blank"><img src="certs/senati-2023-cybersecurity-essentials-2.jpg" alt="Certificado Cybersecurity Essentials" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco Networking Academy</span><h4>Cybersecurity Essentials</h4><p>Certificado de logro (24 Nov 2023). Profundización en amenazas, vulnerabilidades y técnicas de defensa de redes.</p></div><div class="year-header">📅 Año 2025</div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2025-intro-ciberseguridad.jpg" target="_blank"><img src="certs/senati-2025-intro-ciberseguridad.jpg" alt="Certificado Introducción a la Ciberseguridad" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco Networking Academy</span><h4>Introducción a la Ciberseguridad</h4><p>Certificado de logro (15 Mar 2025). Conceptos base de ciberseguridad: amenazas, vulnerabilidades y buenas prácticas de protección.</p></div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2025-fundamentos-python1.jpg" target="_blank"><img src="certs/senati-2025-fundamentos-python1.jpg" alt="Certificado Fundamentos de Python 1" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco Networking Academy</span><h4>Fundamentos de Python 1</h4><p>Certificado de logro (15 Mar 2025). Sintaxis básica de Python, estructuras de control y fundamentos de programación.</p></div><div class="year-header">📅 Año 2026</div><div class="block-card"><div class="cert-image-container"><a href="certs/senati-2026-hacker-etico.jpg" target="_blank"><img src="certs/senati-2026-hacker-etico.jpg" alt="Certificado Hacker Ético" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">SENATI - Sede Independencia</span><h4>Hacker Ético</h4><p>Certificado de logro (03 May 2026). Técnicas de hacking ético y pruebas de penetración, ofrecido por SENATI a través de Cisco Networking Academy.</p></div>` },
                    proyectos: { icon: "🚀", title: "Proyectos", content: `<div class="block-card"><span class="block-tag">Videovigilancia</span><h4>Instalación de CCTV IP</h4><p>Instalación física, cableado y configuración de cámaras de seguridad para sistemas de vigilancia digital.</p></div><div class="block-card"><span class="block-tag">Redes</span><h4>Cableado Estructurado</h4><p>Ordenamiento, ponchado de conectores RJ45 y verificación de conectividad en redes LAN.</p></div><div class="block-card"><span class="block-tag">Soporte</span><h4>Mantenimiento de Laboratorios</h4><p>Mantenimiento preventivo, instalación de SO y software institucional en colegios.</p></div>` }
                }
            },
            utp: {
                title: "UTP",
                subtitle: "Sistemas e Informática",
                color: "#ff4d4d",
                sections: {
                    resumen: { icon: "👤", title: "Resumen Técnico", content: `<p class="cv-paragraph">Estudiante del 1° ciclo de Ingeniería de Sistemas e Informática en la UTP. Con sólida base técnica previa en ciberseguridad, soporte de infraestructura y cableado estructurado.</p><p class="cv-paragraph">Capacidad de adaptación rápida, liderazgo y resolución de problemas en entornos tecnológicos en constante evolución. Busco expandir mis conocimientos en arquitectura de software y desarrollo de sistemas seguros.</p>` },
                    experiencia: { icon: "💼", title: "Experiencia Profesional", content: `<div class="exp-item"><div class="exp-header"><h4 class="exp-role">Asistente de Mecánica</h4><span class="exp-date">Feb 2024 – Jul 2024</span></div><span class="exp-company">Motores S.A.C.</span><ul class="exp-list"><li>Apoyo en el mantenimiento preventivo y correctivo de buses y camiones diésel.</li><li>Colaboración en el desmontaje y montaje de componentes mecánicos.</li><li>Uso y organización de herramientas y equipos de trabajo.</li></ul></div>` },
                    habilidades: { icon: "🛠", title: "Habilidades Técnicas", content: `<div class="skills-grid-cv"><div class="skill-group"><h5>Desarrollo & TI</h5><ul><li>Programación en Python (Básico)</li><li>Soporte Técnico y Helpdesk</li><li>Microsoft Office (Word, Excel, PPT)</li></ul></div><div class="skill-group"><h5>Diseño & Soft Skills</h5><ul><li>Diseño Gráfico (Photoshop, Ilustrator)</li><li>Liderazgo y Comunicación asertiva</li><li>Elaboración de reportes técnicos</li></ul></div></div>` },
                    cursos: { icon: "📚", title: "Cursos", content: `<div class="block-card"><span class="block-tag">2026 - Ciclo 1 (Marzo)</span><h4>Primer Ciclo</h4><ul class="record-list"><li><span class="course-name">Comprensión y redacción de textos I</span> <span class="grade">17</span></li><li><span class="course-name">Herramientas informáticas para la toma de decisiones</span> <span class="grade">19</span></li><li><span class="course-name">Química general</span> <span class="grade">19</span></li><li><span class="course-name">Inglés I</span> <span class="grade">19</span></li><li><span class="course-name">Individuo y medio ambiente</span> <span class="grade">13</span></li><li><span class="course-name">Estadística descriptiva y probabilidades</span> <span class="grade">18</span></li><li><span class="course-name">Introducción a la vida universitaria</span> <span class="grade">20</span></li></ul></div>` },
                    certificados: { icon: "🏆", title: "Certificados", content: `<div class="year-header">📅 Año 2023</div><div class="block-card"><div class="cert-image-container"><a href="https://via.placeholder.com/800x600/1e293b/ff4d4d?text=Certificado+PCAP+Python" target="_blank"><img src="https://via.placeholder.com/400x250/1e293b/ff4d4d?text=PCAP+Python" alt="Certificado PCAP Python" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco / OpenEDG</span><h4>PCAP: Python</h4><p>Programación esencial en Python.</p></div><div class="block-card"><div class="cert-image-container"><a href="https://via.placeholder.com/800x600/1e293b/ff4d4d?text=Certificado+IT+Essentials" target="_blank"><img src="https://via.placeholder.com/400x250/1e293b/ff4d4d?text=IT+Essentials" alt="Certificado IT Essentials" class="cert-image" loading="lazy" onerror="this.closest('.cert-image-container').innerHTML='<span style=\\'color:#94a3b8;font-family:var(--font-mono);font-size:0.75rem;padding:10px;text-align:center;\\'>Imagen no disponible</span>'"></a><span class="cert-view-icon">🔍</span></div><span class="block-tag">Cisco</span><h4>IT Essentials</h4><p>Soporte y mantenimiento de equipos de cómputo.</p></div>` },
                    proyectos: { icon: "🚀", title: "Proyectos", content: `<div class="block-card"><span class="block-tag">Próximamente</span><h4>Proyectos Universitarios</h4><p>A medida que avance en la carrera, se cargarán aquí los proyectos de desarrollo de software, bases de datos e investigaciones.</p></div>` }
                }
            }
        };

        let currentInstitution = 'senati';

        function showToast(message, duration = 3500) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            clearTimeout(showToast._t);
            showToast._t = setTimeout(() => toast.classList.remove('show'), duration);
        }

        // ==========================================
        // BARRA DE PROGRESO DE SCROLL
        // Solo tiene sentido en pantallas con contenido largo (dashboard/contenido).
        // Se oculta automáticamente si el contenido ya cabe entero en pantalla.
        // ==========================================
        const scrollProgressWrap = document.getElementById('scrollProgress');
        const scrollProgressBar = document.getElementById('scrollProgressBar');
        const SCROLLABLE_SCREENS = ['screen-dashboard', 'screen-content'];

        function updateScrollProgress(screenEl) {
            const scrollable = screenEl.scrollHeight - screenEl.clientHeight;
            if (!SCROLLABLE_SCREENS.includes(screenEl.id) || scrollable <= 24) {
                scrollProgressWrap.classList.remove('visible');
                scrollProgressBar.style.width = '0%';
                return;
            }
            scrollProgressWrap.classList.add('visible');
            const pct = Math.min(100, Math.max(0, (screenEl.scrollTop / scrollable) * 100));
            scrollProgressBar.style.width = pct + '%';
        }

        // Un solo listener de scroll por pantalla desplazable, agregado una vez (no en cada navegación).
        SCROLLABLE_SCREENS.forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('scroll', () => {
                if (el.classList.contains('active')) updateScrollProgress(el);
            }, { passive: true });
        });

        function navigateTo(screenId) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const screen = document.getElementById(screenId);
            screen.classList.add('active');
            setTimeout(() => {
                screen.scrollTop = 0;
                window.scrollTo(0, 0);
                updateScrollProgress(screen);
            }, 50);
        }

        // ==========================================
        // BREADCRUMB
        // Ruta de navegación clicable: Inicio / Institución / Sección
        // ==========================================
        function buildBreadcrumb(steps) {
            // steps: [{ label, onClick? }] — el último paso sin onClick se muestra como "actual"
            return steps.map((step, i) => {
                const isLast = i === steps.length - 1;
                const sep = i > 0 ? '<span class="breadcrumb-sep">/</span>' : '';
                if (isLast || !step.onClick) {
                    return `${sep}<span class="breadcrumb-current">${step.label}</span>`;
                }
                return `${sep}<button class="breadcrumb-link" onclick="${step.onClick}">${step.label}</button>`;
            }).join('');
        }

        function openDashboard(institution) {
            currentInstitution = institution;
            const instData = data[institution];
            document.documentElement.style.setProperty('--theme-color', instData.color);
            
            let html = `
                <nav class="breadcrumb" aria-label="Ruta de navegación">
                    ${buildBreadcrumb([
                        { label: 'Inicio', onClick: "navigateTo('screen-home')" },
                        { label: instData.title }
                    ])}
                </nav>
                <div class="dash-header">
                    <h1 class="dash-title">${instData.title}</h1>
                    <p class="dash-subtitle">${instData.subtitle}</p>
                </div>
                <div class="dashboard-section" style="animation-delay: 0.1s;"><h2 class="section-title">${instData.sections.resumen.icon} ${instData.sections.resumen.title}</h2><div>${instData.sections.resumen.content}</div></div>
                <div class="dashboard-section" style="animation-delay: 0.2s;"><h2 class="section-title">${instData.sections.experiencia.icon} ${instData.sections.experiencia.title}</h2><div>${instData.sections.experiencia.content}</div></div>
                <div class="dashboard-section" style="animation-delay: 0.3s;"><h2 class="section-title">${instData.sections.habilidades.icon} ${instData.sections.habilidades.title}</h2><div>${instData.sections.habilidades.content}</div></div>
                <div class="explorer-divider">EXPLORAR INFORMACIÓN</div>
                <div class="dash-grid-3">
                    <div class="dash-card-3" role="button" tabindex="0" aria-label="Ver cursos" onclick="showSection('cursos')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showSection('cursos');}"><div class="dash-icon-3">📚</div><div class="dash-label-3">CURSOS</div></div>
                    <div class="dash-card-3" role="button" tabindex="0" aria-label="Ver certificados" onclick="showSection('certificados')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showSection('certificados');}"><div class="dash-icon-3">🏆</div><div class="dash-label-3">CERTIFICADOS</div></div>
                    <div class="dash-card-3" role="button" tabindex="0" aria-label="Ver proyectos" onclick="showSection('proyectos')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();showSection('proyectos');}"><div class="dash-icon-3">🚀</div><div class="dash-label-3">PROYECTOS</div></div>
                </div>
                <div style="text-align: center;"><button class="nav-btn" onclick="navigateTo('screen-home')">← Volver al Inicio</button></div>
            `;
            document.getElementById('dashboard-content').innerHTML = html;
            navigateTo('screen-dashboard');
        }

        function showSection(sectionKey) {
            const instData = data[currentInstitution];
            const sectionData = instData.sections[sectionKey];
            document.getElementById('content-breadcrumb').innerHTML = buildBreadcrumb([
                { label: 'Inicio', onClick: "navigateTo('screen-home')" },
                { label: instData.title, onClick: "navigateTo('screen-dashboard')" },
                { label: sectionData.title }
            ]);
            document.getElementById('content-title').innerHTML = `${sectionData.icon} ${sectionData.title}`;
            document.getElementById('content-body').innerHTML = sectionData.content;
            navigateTo('screen-content');
        }

        // ==========================================
        // 3. FUNCIÓN: Generar PDF Formato ATS / Harvard
        //    - Paginación dinámica (mide el alto real de cada bloque antes de imprimirlo)
        //    - CV unificado: combina SENATI + UTP (experiencia, habilidades, resumen)
        //    - Manejo de errores si jsPDF no cargó (ej. sin conexión al CDN)
        // ==========================================
        function downloadCV() {
            const btn = document.getElementById('downloadCvBtn');
            const originalLabel = btn.innerHTML;

            try {
                if (!window.jspdf || !window.jspdf.jsPDF) {
                    throw new Error('jsPDF no se cargó. Verifica tu conexión a internet (el generador de PDF se carga desde un CDN externo).');
                }

                btn.disabled = true;
                btn.innerHTML = '⏳ Generando PDF...';

                const { jsPDF } = window.jspdf;
                const doc = new jsPDF('p', 'mm', 'a4');
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                const margin = 15;
                const usableWidth = pageWidth - margin * 2;
                let y = margin;

                // --- Utilidades de medición (calculan el alto ANTES de dibujar) ---
                const lineHeight = (fontSize) => (fontSize * 0.35) + 1.5;

                const measureText = (text, fontSize) => {
                    doc.setFontSize(fontSize);
                    doc.setFont("helvetica", "normal");
                    const lines = doc.splitTextToSize(text, usableWidth);
                    return lines.length * lineHeight(fontSize);
                };

                const ensureSpace = (neededHeight) => {
                    if (y + neededHeight > pageHeight - margin) {
                        doc.addPage();
                        y = margin;
                    }
                };

                const addText = (text, x, fontSize, fontStyle, color, spacing = 4) => {
                    doc.setFontSize(fontSize);
                    doc.setFont("helvetica", fontStyle);
                    doc.setTextColor(color[0], color[1], color[2]);
                    const lines = doc.splitTextToSize(text, usableWidth - (x - margin));
                    const blockHeight = lines.length * lineHeight(fontSize) + spacing;
                    ensureSpace(blockHeight);
                    lines.forEach(line => {
                        doc.text(line, x, y);
                        y += lineHeight(fontSize);
                    });
                    y += spacing;
                };

                const addDivider = () => {
                    ensureSpace(5);
                    doc.setDrawColor(200, 200, 200);
                    doc.line(margin, y, pageWidth - margin, y);
                    y += 5;
                };

                const addSectionTitle = (title) => {
                    // título + línea divisoria deben caber juntos, si no, saltan de página juntos
                    ensureSpace(4 + lineHeight(12) + 2 + 5);
                    y += 4;
                    doc.setFontSize(12);
                    doc.setFont("helvetica", "bold");
                    doc.setTextColor(0, 0, 0);
                    doc.text(title.toUpperCase(), margin, y);
                    y += lineHeight(12) + 2;
                    addDivider();
                };

                // Calcula el alto total que va a ocupar un exp-item completo antes de imprimirlo,
                // así el salto de página ocurre ANTES del bloque, nunca a la mitad.
                const measureExpItem = (role, company, date, listItems) => {
                    let h = lineHeight(10) + 1;          // rol - empresa
                    h += lineHeight(9) + 2;               // fecha
                    listItems.forEach(li => {
                        h += measureText(`- ${li}`, 10) + 1;
                    });
                    h += 3; // espacio final del bloque
                    return h;
                };

                const addExpItem = (role, company, date, listItems) => {
                    const neededHeight = measureExpItem(role, company, date, listItems);
                    ensureSpace(neededHeight);
                    addText(`${role} - ${company}`, margin, 10, "bold", [0, 0, 0], 1);
                    addText(date, margin, 9, "italic", [100, 100, 100], 2);
                    listItems.forEach(li => {
                        addText(`- ${li}`, margin + 2, 10, "normal", [50, 50, 50], 1);
                    });
                    y += 3;
                };

                // --- ENCABEZADO ---
                doc.setFont("helvetica", "bold");
                doc.setFontSize(20);
                doc.setTextColor(0, 0, 0);
                doc.text("YOSHIRO APOLINARIO LOPEZ", pageWidth / 2, y, { align: "center" });
                y += 8;

                doc.setFont("helvetica", "normal");
                doc.setFontSize(11);
                doc.setTextColor(80, 80, 80);
                doc.text("Ing. Ciberseguridad & Sistemas", pageWidth / 2, y, { align: "center" });
                y += 6;

                doc.setFontSize(9);
                const contactText = "yoshiroapolinarioc.333@gmail.com | +51 917 895 746 | Lima, Peru | linkedin.com/in/tu-usuario-linkedin";
                doc.text(contactText, pageWidth / 2, y, { align: "center" });
                y += 6;
                addDivider();

                // --- 1. PERFIL PROFESIONAL (unifica resumen de SENATI + UTP) ---
                addSectionTitle("Perfil Profesional");
                const tempDivResumenSenati = document.createElement('div');
                tempDivResumenSenati.innerHTML = data.senati.sections.resumen.content;
                addText(tempDivResumenSenati.innerText, margin, 10, "normal", [40, 40, 40], 4);

                const tempDivResumenUtp = document.createElement('div');
                tempDivResumenUtp.innerHTML = data.utp.sections.resumen.content;
                addText(tempDivResumenUtp.innerText, margin, 10, "normal", [40, 40, 40], 4);

                // --- 2. EXPERIENCIA PROFESIONAL (unifica SENATI + UTP, sin duplicar) ---
                addSectionTitle("Experiencia Profesional");
                const expDivSenati = document.createElement('div');
                expDivSenati.innerHTML = data.senati.sections.experiencia.content;

                expDivSenati.querySelectorAll('.exp-item').forEach(item => {
                    const role = item.querySelector('.exp-role') ? item.querySelector('.exp-role').innerText : '';
                    const company = item.querySelector('.exp-company') ? item.querySelector('.exp-company').innerText : '';
                    const date = item.querySelector('.exp-date') ? item.querySelector('.exp-date').innerText : '';
                    const listItems = Array.from(item.querySelectorAll('.exp-list li')).map(li => li.innerText);
                    addExpItem(role, company, date, listItems);
                });
                // Nota: la experiencia de UTP (Motores S.A.C.) ya está incluida arriba (mismo puesto que en SENATI),
                // por lo que no se repite para evitar duplicar la misma entrada en el PDF.

                // --- 3. EDUCACIÓN ---
                addSectionTitle("Educacion");
                addText("Ingenieria de Ciberseguridad", margin, 10, "bold", [0, 0, 0], 1);
                addText("SENATI | 2023 - 2026 | Lima, Peru", margin, 9, "italic", [100, 100, 100], 3);

                addText("Ingenieria de Sistemas e Informatica", margin, 10, "bold", [0, 0, 0], 1);
                addText("Universidad Tecnologica del Peru (UTP) | 2026 - En curso | Lima, Peru", margin, 9, "italic", [100, 100, 100], 4);

                // --- 4. HABILIDADES TÉCNICAS (unifica SENATI + UTP) ---
                addSectionTitle("Habilidades Tecnicas");
                const skillsDivSenati = document.createElement('div');
                skillsDivSenati.innerHTML = data.senati.sections.habilidades.content;
                const skillsDivUtp = document.createElement('div');
                skillsDivUtp.innerHTML = data.utp.sections.habilidades.content;

                const allSkillGroups = [
                    ...skillsDivSenati.querySelectorAll('.skill-group'),
                    ...skillsDivUtp.querySelectorAll('.skill-group')
                ];

                allSkillGroups.forEach(group => {
                    const title = group.querySelector('h5').innerText;
                    const skills = Array.from(group.querySelectorAll('li')).map(li => li.innerText).join(', ');
                    const neededHeight = lineHeight(10) + 1 + measureText(skills, 10) + 3;
                    ensureSpace(neededHeight);
                    addText(`${title}:`, margin, 10, "bold", [0, 0, 0], 1);
                    addText(skills, margin + 2, 10, "normal", [50, 50, 50], 3);
                });

                // --- 5. CERTIFICACIONES ---
                addSectionTitle("Certificaciones");
                const certDiv = document.createElement('div');
                certDiv.innerHTML = data.senati.sections.certificados.content + data.utp.sections.certificados.content;
                const certCards = certDiv.querySelectorAll('.block-card');

                certCards.forEach(card => {
                    const certTitle = card.querySelector('h4') ? card.querySelector('h4').innerText : '';
                    const issuer = card.querySelector('.block-tag') ? card.querySelector('.block-tag').innerText : '';
                    const desc = card.querySelector('p') ? card.querySelector('p').innerText : '';
                    const neededHeight = lineHeight(10) + 1 + measureText(desc, 10) + 3;
                    ensureSpace(neededHeight);
                    addText(`${certTitle} - ${issuer}`, margin, 10, "bold", [0, 0, 0], 1);
                    addText(desc, margin + 2, 10, "normal", [50, 50, 50], 3);
                });

                // --- 6. PROYECTOS DESTACADOS ---
                addSectionTitle("Proyectos Destacados");
                const projDiv = document.createElement('div');
                projDiv.innerHTML = data.senati.sections.proyectos.content;
                const projCards = projDiv.querySelectorAll('.block-card');

                projCards.forEach(card => {
                    const projTitle = card.querySelector('h4') ? card.querySelector('h4').innerText : '';
                    const desc = card.querySelector('p') ? card.querySelector('p').innerText : '';
                    const fullText = `- ${projTitle}: ${desc}`;
                    const neededHeight = measureText(fullText, 10) + 2;
                    ensureSpace(neededHeight);
                    addText(fullText, margin, 10, "normal", [50, 50, 50], 2);
                });

                doc.save("CV_Yoshiro_Apolinario_Lopez.pdf");
            } catch (err) {
                console.error('Error generando el PDF:', err);
                showToast('⚠️ No se pudo generar el PDF. Revisa tu conexión e inténtalo de nuevo.');
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalLabel;
            }
        }

        setTimeout(() => {
            navigateTo('screen-home');
        }, 3000);
