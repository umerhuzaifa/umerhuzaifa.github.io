<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Power Monitoring - ESP32 and nRF52 Comparison - Dr. Umer Huzaifa</title>
    <meta name="description" content="Comprehensive power consumption analysis and comparison of ESP32 and nRF52 devices with LED operation patterns.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
    <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --primary-light: #f8fafc;
            --primary-white: #ffffff;
            --accent-orange: #e85d2d;
            --accent-blue: #0066cc;
            --text-primary: #1e293b;
            --text-secondary: #475569;
            --surface: #ffffff;
            --surface-light: #f1f5f9;
            --grid-color: rgba(0, 0, 0, 0.03);
            --border-color: #e2e8f0;
            --success: #059669;
            --warning: #d97706;
            --error: #dc2626;
            --code-bg: #f8fafc;
        }

        body {
            font-family: 'IBM Plex Sans', sans-serif;
            background: linear-gradient(135deg, var(--primary-light) 0%, #e2e8f0 100%);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 0;
            position: relative;
            overflow-x: hidden;
            line-height: 1.6;
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
            opacity: 0.5;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            position: relative;
            z-index: 1;
            padding: 2rem;
        }

        header {
            text-align: center;
            margin-bottom: 2rem;
            animation: fadeInDown 0.8s ease-out;
        }

        h1 {
            font-family: 'JetBrains Mono', monospace;
            font-size: 2.2rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, var(--accent-blue), var(--accent-orange));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1.3;
        }

        .subtitle {
            font-size: 1.1rem;
            color: var(--text-secondary);
            max-width: 800px;
            margin: 0 auto 0.5rem;
        }

        .back-link {
            display: inline-block;
            margin-top: 1rem;
            color: var(--accent-blue);
            text-decoration: none;
            font-size: 0.95rem;
            transition: color 0.2s ease;
        }

        .back-link:hover {
            color: var(--accent-orange);
            text-decoration: underline;
        }

        .back-link::before {
            content: '← ';
        }

        .content-section {
            background: var(--surface);
            border-radius: 12px;
            padding: 2rem;
            margin-bottom: 2rem;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
            border: 1px solid var(--border-color);
            animation: fadeInUp 0.8s ease-out both;
        }

        .content-section:nth-child(2) {
            animation-delay: 0.1s;
        }

        .content-section:nth-child(3) {
            animation-delay: 0.2s;
        }

        .content-section:nth-child(4) {
            animation-delay: 0.3s;
        }

        h2 {
            color: var(--accent-blue);
            font-size: 1.6rem;
            margin-bottom: 1rem;
            font-weight: 600;
            border-bottom: 3px solid var(--accent-blue);
            padding-bottom: 0.5rem;
        }

        h3 {
            color: var(--text-primary);
            font-size: 1.3rem;
            margin: 1.5rem 0 1rem;
            font-weight: 600;
        }

        h4 {
            color: var(--accent-orange);
            font-size: 1.1rem;
            margin: 1rem 0 0.75rem;
            font-weight: 600;
        }

        p {
            margin-bottom: 1rem;
            color: var(--text-secondary);
        }

        ul {
            margin-bottom: 1rem;
            padding-left: 2rem;
        }

        li {
            margin-bottom: 0.5rem;
            color: var(--text-secondary);
        }

        strong {
            color: var(--text-primary);
            font-weight: 600;
        }

        .goal-section {
            background: linear-gradient(135deg, rgba(0, 102, 204, 0.08), rgba(0, 102, 204, 0.04));
            border-left: 4px solid var(--accent-blue);
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
        }

        .goal-section h3 {
            color: var(--accent-blue);
            margin-top: 0;
        }

        .components-section {
            background: var(--surface-light);
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            border: 1px solid var(--border-color);
        }

        .components-section h3 {
            color: var(--accent-orange);
            margin-top: 0;
        }

        .image-container {
            text-align: center;
            margin: 2rem 0;
            padding: 1rem;
            background: var(--surface-light);
            border-radius: 8px;
            border: 1px solid var(--border-color);
        }

        .image-container img {
            max-width: 100%;
            height: auto;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .led-gallery {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin: 2rem 0;
        }

        .led-card {
            background: var(--surface-light);
            padding: 1.5rem;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            transition: all 0.3s ease;
        }

        .led-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
            border-color: var(--accent-blue);
        }

        .led-card h4 {
            text-align: center;
            margin-bottom: 1rem;
        }

        .led-card img {
            width: 100%;
            height: auto;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin: 2rem 0;
            background: var(--surface);
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        }

        thead {
            background: linear-gradient(135deg, var(--accent-blue), #0052a3);
        }

        thead th {
            color: white;
            font-weight: 600;
            padding: 1rem;
            text-align: left;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.95rem;
        }

        tbody tr {
            border-bottom: 1px solid var(--border-color);
            transition: background 0.2s ease;
        }

        tbody tr:hover {
            background: var(--surface-light);
        }

        tbody tr:last-child {
            border-bottom: none;
        }

        tbody td {
            padding: 1rem;
            color: var(--text-secondary);
        }

        tbody td:first-child {
            font-weight: 600;
            color: var(--text-primary);
        }

        .equation {
            background: var(--code-bg);
            padding: 1.5rem;
            border-radius: 8px;
            margin: 1.5rem 0;
            text-align: center;
            border: 1px solid var(--border-color);
            font-family: 'JetBrains Mono', monospace;
            font-size: 1.1rem;
        }

        code {
            background: var(--code-bg);
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            color: var(--accent-orange);
            border: 1px solid var(--border-color);
        }

        .note {
            background: linear-gradient(135deg, rgba(232, 93, 45, 0.08), rgba(232, 93, 45, 0.04));
            border-left: 4px solid var(--accent-orange);
            padding: 1rem;
            border-radius: 6px;
            margin: 1rem 0;
        }

        .note::before {
            content: '💡 Note: ';
            font-weight: 600;
            color: var(--accent-orange);
        }

        footer {
            text-align: center;
            padding: 2rem 0;
            color: var(--text-secondary);
            font-size: 0.9rem;
            border-top: 1px solid var(--border-color);
            margin-top: 2rem;
        }

        footer a {
            color: var(--accent-blue);
            text-decoration: none;
        }

        footer a:hover {
            text-decoration: underline;
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

        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }

            h1 {
                font-size: 1.6rem;
            }

            .content-section {
                padding: 1.5rem;
            }

            .led-gallery {
                grid-template-columns: 1fr;
            }

            table {
                font-size: 0.85rem;
            }

            thead th, tbody td {
                padding: 0.75rem 0.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Power Monitoring and Comparison of ESP32 and nRF52 Device</h1>
            <p class="subtitle">
                Comprehensive analysis of power consumption patterns in embedded systems with LED operation
            </p>
            <a href="/" class="back-link">Back to Home</a>
        </header>

        <div class="content-section">
            <div class="goal-section">
                <h3>🎯 Project Goals</h3>
                <ul>
                    <li>Learn about and use the power saving features in ESP32 and nRF</li>
                    <li>Demonstrate the features in an LED lighting and user data input application</li>
                    <li>Compare the results of the two platforms</li>
                </ul>
            </div>

            <div class="components-section">
                <h3>🔧 Components Needed</h3>
                <ul>
                    <li><strong>ESP32</strong> (ready to go)</li>
                    <li><strong>nRF52832</strong> (or another nRF device)</li>
                    <li><strong>LED with 470 ohm resistor</strong> (3.3V/470Ω ≈ 7 mA)</li>
                    <li><strong>External USB Connector</strong> to measure current (<a href="https://www.amazon.com/DROK-Multimeter-Indicator-Voltmeter-Ampermeter/dp/B00J3JSEG8" target="_blank">DROK USB Tester</a>)</li>
                </ul>
            </div>

            <div class="components-section">
                <h3>💻 Software Requirements</h3>
                <ul>
                    <li><strong>PlatformIO</strong> environment for ESP32</li>
                    <li><strong>VS Code and Zephyr</strong> for nRF Device</li>
                    <li><strong>Hardware access</strong> in both platforms for current measurement</li>
                </ul>
            </div>
        </div>

        <div class="content-section">
            <h2>ESP32 Circuit Design</h2>
            <div class="image-container">
                <img src="/assets/images/esp32_ckt.png" alt="ESP32 Circuit Diagram" style="max-width: 600px;">
            </div>
        </div>

        <div class="content-section">
            <h2>LED Operation Analysis</h2>
            
            <h3>⚡ Always ON Mode</h3>
            <p>Direct current measurements with different LED colors at constant illumination.</p>

            <div class="led-gallery">
                <div class="led-card">
                    <h4>Violet LED</h4>
                    <img src="/assets/images/violet_ON.png" alt="Violet LED ON">
                </div>
                <div class="led-card">
                    <h4>Yellow LED</h4>
                    <img src="/assets/images/yellow_ON.png" alt="Yellow LED ON">
                </div>
                <div class="led-card">
                    <h4>Green LED</h4>
                    <img src="/assets/images/green_ON.png" alt="Green LED ON">
                </div>
                <div class="led-card">
                    <h4>Red LED</h4>
                    <img src="/assets/images/red_ON.png" alt="Red LED ON">
                </div>
            </div>

            <div class="equation">
                \(V_f = V_{in} - I \times 470\)
            </div>

            <table>
                <thead>
                    <tr>
                        <th>LED Color</th>
                        <th>Applied Voltage (V)</th>
                        <th>Current Recorded (mA)</th>
                        <th>Forward Voltage (V)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Violet</td>
                        <td>3.3</td>
                        <td>0.67</td>
                        <td>2.98</td>
                    </tr>
                    <tr>
                        <td>Yellow</td>
                        <td>3.3</td>
                        <td>2.7</td>
                        <td>2.03</td>
                    </tr>
                    <tr>
                        <td>Green</td>
                        <td>3.3</td>
                        <td>2.61</td>
                        <td>2.07</td>
                    </tr>
                    <tr>
                        <td>Red</td>
                        <td>3.3</td>
                        <td>2.83</td>
                        <td>1.97</td>
                    </tr>
                </tbody>
            </table>

            <div class="note">
                The violet LED shows significantly lower current consumption (0.67 mA) compared to other colors, indicating a higher forward voltage drop characteristic of blue/violet LEDs.
            </div>
        </div>

        <div class="content-section">
            <h3>🔄 Blinking Pattern (30 Hz)</h3>
            <p>Current measurements during PWM-controlled LED blinking at 30 Hz frequency.</p>

            <div class="led-gallery">
                <div class="led-card">
                    <h4>Violet LED Blinking</h4>
                    <img src="/assets/images/violet_blink.png" alt="Violet LED Blinking">
                </div>
                <div class="led-card">
                    <h4>Yellow LED Blinking</h4>
                    <img src="/assets/images/yellow_blink.png" alt="Yellow LED Blinking">
                    <p style="text-align: center; margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                        Current: 1.25 - 1.31 mA
                    </p>
                </div>
                <div class="led-card">
                    <h4>Green LED Blinking</h4>
                    <img src="/assets/images/green_blink.png" alt="Green LED Blinking">
                    <p style="text-align: center; margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                        Current: 1.21 - 1.27 mA
                    </p>
                </div>
                <div class="led-card">
                    <h4>Red LED Blinking</h4>
                    <img src="/assets/images/red_blink.png" alt="Red LED Blinking">
                    <p style="text-align: center; margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.9rem;">
                        Current: 1.21 - 1.27 mA
                    </p>
                </div>
            </div>

            <div class="note">
                PWM control at 30 Hz reduces average current consumption by approximately 50% compared to continuous operation, demonstrating effective power management through duty cycle control.
            </div>
        </div>

        <div class="content-section">
            <h2>Key Observations</h2>
            <ul>
                <li><strong>LED Color Impact:</strong> Different LED colors exhibit varying forward voltage characteristics, with violet LEDs showing the highest Vf (2.98V) and red LEDs the lowest (1.97V)</li>
                <li><strong>Current Efficiency:</strong> The 470Ω current-limiting resistor effectively manages LED current within safe operating ranges</li>
                <li><strong>PWM Benefits:</strong> Blinking operation at 30 Hz reduces average power consumption while maintaining perceived brightness</li>
                <li><strong>Power Optimization:</strong> Strategic use of duty cycle modulation enables significant energy savings in battery-powered applications</li>
            </ul>
        </div>

        <footer>
            <p>Part of embedded systems research at the <a href="/research.html">RAL Lab</a></p>
            <p style="margin-top: 0.5rem;">&copy; 2025 Dr. Umer Huzaifa | DePaul University</p>
        </footer>
    </div>
</body>
</html>