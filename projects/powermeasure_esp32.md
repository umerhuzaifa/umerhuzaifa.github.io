---
layout: custom
title: Power Measure
---

# Power Monitoring and Comparison of ESP32 and nRF52 Device

### **Goal:**

- learn about and use the power saving features in ESP32 adn nRF
- Demonstrate the features in an LED lighting and user data input application
- Compare the results of the two

### **Components Needed:**

- ESP32 (ready to go)
- nRF52832 (or another nRF device)
- LED with 470 ohm resistor (3.3/470 gives ~7 mA)
- An external USB Connector to measure the current ([DROK USB Tester](https://www.notion.so/Power-Monitoring-and-Comparison-of-ESP32-and-nRF52-Device-2c2ca269b2bb80dfbda4c2428080980f?pvs=21))

### **Software Needs:**

- PlatformIO environment for ESP32
- VS Code and Zephyr for nRF Device
- Hardware access in both for current measurement

### **ESP32 Circuit:**

![../assets/images/image.png](../assets/images/esp32_ckt.png)

## LED Operation

### Always ON

Ammeter Readings and circuit diagrams in action
Violet LED: 

<img src="/assets/images/violet_ON.png" alt="Violet LED ON" width="200">

Yellow LED:

<img src="/assets/images/yellow_ON.png" alt="Yellow LED ON" width="200">

Green LED:

<img src="/assets/images/green_ON.png" alt="Green LED ON" width="200">

Red LED:

<img src="/assets/images/red_ON.png" alt="Red LED ON" width="200">

$$
V_f = V_{in}-I\times 470
$$

| **LED Color** | **Applied Voltage (V)** | **Current Recorded (mA)** | **Forward Voltage (V)** |
| --- | --- | --- | --- |
| Violet | 3.3 | 0.67 | 2.98 |
| Yellow | 3.3 | 2.7 | 2.03 |
| Green | 3.3 | 2.61 | 2.07 |
| Red | 3.3 | 2.83 | 1.97 |

### Blinking Pattern (30 Hz)
Violet:

<img src="/assets/images/violet_blink.png" alt="Violet LED Blinking" width="200">

Yellow: (1.25 mA - 1.31 mA)

<img src="/assets/images/yellow_blink.png" alt="Yellow LED Blinking" width="200">

Green: (1.21 mA - 1.27 mA)

<img src="/assets/images/green_blink.png" alt="Green LED Blinking" width="200">

RED: (1.21 mA - 1.27 mA)

<img src="/assets/images/red_blink.png" alt="Red LED Blinking" width="200">