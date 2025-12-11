<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Second-Order System Identification</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary-dark: #0a1929;
            --primary-blue: #1e3a5f;
            --accent-orange: #ff6b35;
            --accent-cyan: #00d4ff;
            --text-primary: #e8eaf6;
            --text-secondary: #94a3b8;
            --surface: #132337;
            --surface-light: #1a3a52;
            --grid-color: rgba(255, 255, 255, 0.05);
            --success: #00e676;
            --warning: #ffd54f;
            --error: #ff5252;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'IBM Plex Sans', sans-serif;
            background: linear-gradient(135deg, var(--primary-dark) 0%, var(--primary-blue) 100%);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 2rem;
            position: relative;
            overflow-x: hidden;
        }

        body::before {
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: 
                repeating-linear-gradient(0deg, transparent, transparent 2px, var(--grid-color) 2px, var(--grid-color) 3px),
                repeating-linear-gradient(90deg, transparent, transparent 2px, var(--grid-color) 2px, var(--grid-color) 3px);
            background-size: 30px 30px;
            pointer-events: none;
            z-index: 0;
            opacity: 0.3;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
        }

        header {
            text-align: center;
            margin-bottom: 2rem;
            animation: fadeInDown 0.8s ease-out;
        }

        h1 {
            font-family: 'JetBrains Mono', monospace;
            font-size: 2.5rem;
            font-weight: 600;
            margin-bottom: 1rem;
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-orange));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            text-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
        }

        .subtitle {
            font-size: 1rem;
            color: var(--text-secondary);
            max-width: 800px;
            margin: 0 auto;
            line-height: 1.6;
        }

        .main-content {
            background: var(--surface);
            border-radius: 16px;
            padding: 2rem;
            box-shadow: 
                0 8px 32px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.05);
            animation: fadeInUp 0.8s ease-out 0.2s both;
        }

        .info-panel {
            background: var(--surface-light);
            border-left: 4px solid var(--accent-orange);
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            animation: slideInLeft 0.8s ease-out 0.4s both;
        }

        .info-panel h3 {
            font-family: 'JetBrains Mono', monospace;
            font-size: 1.1rem;
            margin-bottom: 0.75rem;
            color: var(--accent-orange);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .info-panel h3::before {
            content: '⚡';
            font-size: 1.2rem;
        }

        .info-panel ul {
            list-style: none;
            padding-left: 0;
        }

        .info-panel li {
            padding: 0.5rem 0;
            padding-left: 1.5rem;
            position: relative;
            color: var(--text-secondary);
            line-height: 1.6;
        }

        .info-panel li::before {
            content: '→';
            position: absolute;
            left: 0;
            color: var(--accent-cyan);
            font-weight: bold;
        }

        .chart-container {
            position: relative;
            height: 400px;
            margin-bottom: 2rem;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 12px;
            padding: 1rem;
            border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .controls {
            display: grid;
            gap: 2rem;
            animation: fadeInUp 0.8s ease-out 0.6s both;
        }

        .control-group {
            background: var(--surface-light);
            padding: 1.5rem;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            transition: all 0.3s ease;
        }

        .control-group:hover {
            border-color: rgba(0, 212, 255, 0.3);
            box-shadow: 0 4px 20px rgba(0, 212, 255, 0.1);
        }

        .control-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
        }

        .control-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.95rem;
            font-weight: 600;
            color: var(--text-primary);
        }

        .control-value {
            font-family: 'JetBrains Mono', monospace;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--accent-cyan);
            min-width: 80px;
            text-align: right;
            padding: 0.25rem 0.75rem;
            background: rgba(0, 212, 255, 0.1);
            border-radius: 6px;
            border: 1px solid rgba(0, 212, 255, 0.2);
        }

        .slider {
            width: 100%;
            height: 8px;
            border-radius: 4px;
            background: linear-gradient(to right, var(--surface), var(--accent-cyan));
            outline: none;
            -webkit-appearance: none;
            position: relative;
        }

        .slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--accent-cyan);
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 212, 255, 0.5);
            transition: all 0.2s ease;
        }

        .slider::-webkit-slider-thumb:hover {
            transform: scale(1.15);
            box-shadow: 0 4px 16px rgba(0, 212, 255, 0.7);
        }

        .slider::-moz-range-thumb {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: var(--accent-cyan);
            cursor: pointer;
            border: none;
            box-shadow: 0 2px 8px rgba(0, 212, 255, 0.5);
            transition: all 0.2s ease;
        }

        .slider::-moz-range-thumb:hover {
            transform: scale(1.15);
            box-shadow: 0 4px 16px rgba(0, 212, 255, 0.7);
        }

        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-top: 2rem;
        }

        .metric-card {
            background: var(--surface-light);
            padding: 1.25rem;
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.05);
            text-align: center;
            transition: all 0.3s ease;
        }

        .metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .metric-label {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
            font-family: 'JetBrains Mono', monospace;
        }

        .metric-value {
            font-size: 1.5rem;
            font-weight: 600;
            font-family: 'JetBrains Mono', monospace;
        }

        .target-system {
            background: linear-gradient(135deg, rgba(255, 107, 53, 0.15), rgba(255, 107, 53, 0.05));
            border: 2px solid var(--accent-orange);
            padding: 1.25rem;
            border-radius: 10px;
            margin-top: 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            animation: pulse 2s ease-in-out infinite;
        }

        .target-label {
            font-family: 'JetBrains Mono', monospace;
            font-size: 1rem;
            color: var(--accent-orange);
            font-weight: 600;
        }

        .target-params {
            font-family: 'JetBrains Mono', monospace;
            font-size: 1.1rem;
            color: var(--text-primary);
        }

        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes slideInLeft {
            from {
                opacity: 0;
                transform: translateX(-30px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        @keyframes pulse {
            0%, 100% {
                box-shadow: 0 0 20px rgba(255, 107, 53, 0.2);
            }
            50% {
                box-shadow: 0 0 30px rgba(255, 107, 53, 0.4);
            }
        }

        @media (max-width: 768px) {
            body {
                padding: 1rem;
            }

            h1 {
                font-size: 1.75rem;
            }

            .main-content {
                padding: 1.5rem;
            }

            .chart-container {
                height: 300px;
            }

            .target-system {
                flex-direction: column;
                gap: 1rem;
                text-align: center;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Second-Order System Identification</h1>
            <p class="subtitle">
                Adjust the parameters to match the unknown system's step response and discover the underlying dynamics
            </p>
        </header>

        <div class="main-content">
            <div class="info-panel">
                <h3>About System Identification</h3>
                <ul>
                    <li><strong>Identification of a dynamic system is of significance when the system parameters are not known</strong>. In real-world applications, we often encounter systems where the underlying dynamics are hidden or uncertain.</li>
                    <li><strong>After identification, we are open to using the knowledge from dynamics systems and control theory to operate the behavior to our liking</strong>. Once we understand the system, we can design controllers and predict behavior.</li>
                    <li><strong>This is a basic application in recognizing the system that gives rise to a second-order step response</strong>. The goal is to match the damping ratio (ζ) and natural frequency (ωₙ) by observing the response characteristics.</li>
                </ul>
            </div>

            <div class="target-system">
                <span class="target-label">🎯 TARGET SYSTEM</span>
                <span class="target-params">ζ = <span id="targetZeta">0.400</span> | ωₙ = <span id="targetWn">5.000</span> rad/s</span>
            </div>

            <div class="chart-container">
                <canvas id="responseChart"></canvas>
            </div>

            <div class="controls">
                <div class="control-group">
                    <div class="control-header">
                        <label class="control-label">Damping Ratio (ζ)</label>
                        <span class="control-value" id="zetaValue">0.700</span>
                    </div>
                    <input type="range" class="slider" id="zetaSlider" min="0.01" max="2.0" step="0.01" value="0.7">
                </div>

                <div class="control-group">
                    <div class="control-header">
                        <label class="control-label">Natural Frequency (ωₙ) [rad/s]</label>
                        <span class="control-value" id="wnValue">3.000</span>
                    </div>
                    <input type="range" class="slider" id="wnSlider" min="0.5" max="15.0" step="0.1" value="3.0">
                </div>
            </div>

            <div class="metrics">
                <div class="metric-card">
                    <div class="metric-label">Mean Squared Error</div>
                    <div class="metric-value" id="mseValue" style="color: var(--accent-cyan);">0.000000</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">ζ Error</div>
                    <div class="metric-value" id="zetaError" style="color: var(--accent-cyan);">0.000</div>
                </div>
                <div class="metric-card">
                    <div class="metric-label">ωₙ Error</div>
                    <div class="metric-value" id="wnError" style="color: var(--accent-cyan);">0.000</div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // System parameters
        const unknownZeta = 0.4;
        const unknownWn = 5.0;
        const tMax = 5;
        const numPoints = 500;

        // Generate time array
        const t = Array.from({length: numPoints}, (_, i) => i * tMax / (numPoints - 1));

        // Calculate step response for a second-order system
        function calculateStepResponse(zeta, wn, timeArray) {
            return timeArray.map(time => {
                if (zeta < 1) {
                    // Underdamped
                    const wd = wn * Math.sqrt(1 - zeta * zeta);
                    const phi = Math.atan2(Math.sqrt(1 - zeta * zeta), zeta);
                    return 1 - (Math.exp(-zeta * wn * time) / Math.sqrt(1 - zeta * zeta)) * 
                           Math.sin(wd * time + phi);
                } else if (zeta === 1) {
                    // Critically damped
                    return 1 - Math.exp(-wn * time) * (1 + wn * time);
                } else {
                    // Overdamped
                    const s1 = -zeta * wn + wn * Math.sqrt(zeta * zeta - 1);
                    const s2 = -zeta * wn - wn * Math.sqrt(zeta * zeta - 1);
                    return 1 + (s1 * Math.exp(s2 * time) - s2 * Math.exp(s1 * time)) / (s2 - s1);
                }
            });
        }

        // Calculate unknown system response
        const unknownResponse = calculateStepResponse(unknownZeta, unknownWn, t);

        // Initialize chart
        const ctx = document.getElementById('responseChart').getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: t,
                datasets: [
                    {
                        label: 'Unknown System (Target)',
                        data: unknownResponse,
                        borderColor: '#ff6b35',
                        backgroundColor: 'rgba(255, 107, 53, 0.1)',
                        borderWidth: 3,
                        pointRadius: 0,
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'Current System',
                        data: [],
                        borderColor: '#00d4ff',
                        backgroundColor: 'rgba(0, 212, 255, 0.1)',
                        borderWidth: 3,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: 300
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#e8eaf6',
                            font: {
                                family: 'JetBrains Mono',
                                size: 12
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(19, 35, 55, 0.95)',
                        titleColor: '#e8eaf6',
                        bodyColor: '#94a3b8',
                        borderColor: 'rgba(0, 212, 255, 0.3)',
                        borderWidth: 1,
                        titleFont: {
                            family: 'JetBrains Mono',
                            size: 13
                        },
                        bodyFont: {
                            family: 'JetBrains Mono',
                            size: 12
                        },
                        padding: 12
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        title: {
                            display: true,
                            text: 'Time (s)',
                            color: '#94a3b8',
                            font: {
                                family: 'IBM Plex Sans',
                                size: 14,
                                weight: '500'
                            }
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'JetBrains Mono',
                                size: 11
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Response',
                            color: '#94a3b8',
                            font: {
                                family: 'IBM Plex Sans',
                                size: 14,
                                weight: '500'
                            }
                        },
                        ticks: {
                            color: '#94a3b8',
                            font: {
                                family: 'JetBrains Mono',
                                size: 11
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)',
                            drawBorder: false
                        },
                        min: 0,
                        max: 1.5
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });

        // Get UI elements
        const zetaSlider = document.getElementById('zetaSlider');
        const wnSlider = document.getElementById('wnSlider');
        const zetaValue = document.getElementById('zetaValue');
        const wnValue = document.getElementById('wnValue');
        const mseValue = document.getElementById('mseValue');
        const zetaError = document.getElementById('zetaError');
        const wnError = document.getElementById('wnError');

        // Update function
        function updateSystem() {
            const currentZeta = parseFloat(zetaSlider.value);
            const currentWn = parseFloat(wnSlider.value);

            // Update display values
            zetaValue.textContent = currentZeta.toFixed(3);
            wnValue.textContent = currentWn.toFixed(3);

            // Calculate current response
            const currentResponse = calculateStepResponse(currentZeta, currentWn, t);

            // Update chart
            chart.data.datasets[1].data = currentResponse;
            chart.data.datasets[1].label = `Current System (ζ=${currentZeta.toFixed(3)}, ωₙ=${currentWn.toFixed(3)})`;
            chart.update('none');

            // Calculate MSE
            let mse = 0;
            for (let i = 0; i < unknownResponse.length; i++) {
                const diff = unknownResponse[i] - currentResponse[i];
                mse += diff * diff;
            }
            mse /= unknownResponse.length;

            // Calculate parameter errors
            const zetaErr = Math.abs(currentZeta - unknownZeta);
            const wnErr = Math.abs(currentWn - unknownWn);

            // Update metrics
            mseValue.textContent = mse.toFixed(6);
            zetaError.textContent = zetaErr.toFixed(3);
            wnError.textContent = wnErr.toFixed(3);

            // Color code based on accuracy
            const getColor = (value, threshold1, threshold2) => {
                if (value < threshold1) return '#00e676';
                if (value < threshold2) return '#ffd54f';
                return '#ff5252';
            };

            mseValue.style.color = getColor(mse, 0.01, 0.1);
            zetaError.style.color = getColor(zetaErr, 0.05, 0.15);
            wnError.style.color = getColor(wnErr, 0.5, 1.5);
        }

        // Event listeners
        zetaSlider.addEventListener('input', updateSystem);
        wnSlider.addEventListener('input', updateSystem);

        // Initial update
        updateSystem();
    </script>
</body>
</html>